package tui

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

type SecretsCommandResult struct {
	Logs []string
}

type CREWhoAmIResult struct {
	Identity string
	Raw      string
}

type SimulateCommandResult struct {
	Logs []string
}

type LocalSecretEntry struct {
	ID       string
	EnvVar   string
	HasValue bool
}

type LocalSecretsListResult struct {
	Logs    []string
	Entries []LocalSecretEntry
}

type LocalVariableEntry struct {
	Section      string
	Kind         string
	ID           string
	Key          string
	Label        string
	Description  string
	CurrentValue string
}

type LocalVariableListResult struct {
	Logs    []string
	Entries []LocalVariableEntry
}

const (
	stagingChainName  = "ethereum-testnet-sepolia"
	mainnetChainName  = "ethereum-mainnet"
	defaultMainnetRPC = "https://0xrpc.io/eth"
)

type rpcEntry struct {
	ChainName string `yaml:"chain-name"`
	URL       string `yaml:"url"`
}

type projectTarget struct {
	RPCs []rpcEntry `yaml:"rpcs"`
}

type projectYAML map[string]projectTarget

type secretsManifest struct {
	SecretsNames map[string][]string `yaml:"secretsNames"`
}

var emailLinePattern = regexp.MustCompile(`(?i)Email:\s*([^\s|]+@[^\s|]+)`)

func parseCREWhoAmIIdentity(output string) string {
	trimmed := strings.TrimSpace(output)
	if trimmed == "" {
		return ""
	}
	if match := emailLinePattern.FindStringSubmatch(trimmed); len(match) > 1 {
		return strings.TrimSpace(match[1])
	}
	for _, line := range strings.Split(trimmed, "\n") {
		clean := strings.TrimSpace(strings.Trim(line, "│"))
		if clean == "" {
			continue
		}
		if strings.Contains(strings.ToLower(clean), "email:") {
			parts := strings.SplitN(clean, ":", 2)
			if len(parts) == 2 {
				val := strings.TrimSpace(parts[1])
				if val != "" {
					return val
				}
			}
		}
	}
	return ""
}

func GetCREWhoAmI() (*CREWhoAmIResult, error) {
	cmd := exec.Command("cre", "whoami")
	output, err := cmd.CombinedOutput()
	raw := strings.TrimSpace(string(output))
	if err != nil {
		if raw == "" {
			raw = err.Error()
		}
		return nil, errors.New(raw)
	}
	identity := parseCREWhoAmIIdentity(raw)
	if identity == "" {
		identity = "logged-in"
	}
	return &CREWhoAmIResult{
		Identity: identity,
		Raw:      raw,
	}, nil
}

func splitOutputLines(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	lines := strings.Split(trimmed, "\n")
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		clean := strings.TrimSpace(line)
		if clean == "" {
			continue
		}
		out = append(out, clean)
	}
	return out
}

func runCommand(cwd string, name string, args ...string) ([]string, error) {
	cmd := exec.Command(name, args...)
	cmd.Dir = cwd
	out, err := cmd.CombinedOutput()
	lines := splitOutputLines(string(out))
	if err != nil {
		if len(lines) == 0 {
			lines = []string{err.Error()}
		}
		return lines, err
	}
	return lines, nil
}

func localWorkflowProjectRoot(workflowID, workflowName string) string {
	folderName := fmt.Sprintf("%s--%s", slugify(workflowName), workflowID)
	return filepath.Join(workflowsRootDir(), folderName)
}

func localWorkflowDir(workflowID, workflowName string) string {
	return filepath.Join(localWorkflowProjectRoot(workflowID, workflowName), slugify(workflowName))
}

func readDotEnvValue(dotEnvPath, key string) (string, error) {
	raw, err := os.ReadFile(dotEnvPath)
	if err != nil {
		return "", err
	}

	lines := strings.Split(string(raw), "\n")
	prefix := key + "="
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, prefix) {
			return strings.TrimSpace(strings.TrimPrefix(line, prefix)), nil
		}
	}

	return "", nil
}

func setDotEnvValue(dotEnvPath, key, value string) error {
	raw, _ := os.ReadFile(dotEnvPath)
	lines := []string{}
	if len(raw) > 0 {
		lines = strings.Split(strings.TrimRight(string(raw), "\n"), "\n")
	}

	prefix := key + "="
	updated := false
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, prefix) {
			lines[i] = prefix + value
			updated = true
		}
	}
	if !updated {
		if len(lines) > 0 {
			lines = append(lines, "")
		}
		lines = append(lines, "# Required for CRE simulation secrets")
		lines = append(lines, prefix+value)
	}

	if err := ensureParent(dotEnvPath); err != nil {
		return err
	}
	content := strings.Join(lines, "\n")
	if !strings.HasSuffix(content, "\n") {
		content += "\n"
	}
	return os.WriteFile(dotEnvPath, []byte(content), 0o600)
}

func removeDotEnvValue(dotEnvPath, key string) error {
	raw, err := os.ReadFile(dotEnvPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	lines := strings.Split(strings.TrimRight(string(raw), "\n"), "\n")
	prefix := key + "="
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, prefix) {
			continue
		}
		out = append(out, line)
	}

	content := strings.Join(out, "\n")
	if content != "" && !strings.HasSuffix(content, "\n") {
		content += "\n"
	}
	return os.WriteFile(dotEnvPath, []byte(content), 0o600)
}

func isValidPrivateKey(value string) bool {
	trimmed := strings.TrimSpace(value)
	if strings.HasPrefix(trimmed, "0x") {
		trimmed = strings.TrimPrefix(trimmed, "0x")
	}
	if len(trimmed) != 64 {
		return false
	}
	return regexp.MustCompile(`^[0-9a-fA-F]{64}$`).MatchString(trimmed)
}

func workflowHasTarget(workflowYamlPath, target string) (bool, error) {
	raw, err := os.ReadFile(workflowYamlPath)
	if err != nil {
		return false, err
	}

	var parsed map[string]any
	if err := yaml.Unmarshal(raw, &parsed); err != nil {
		return false, err
	}
	_, ok := parsed[target]
	return ok, nil
}

func preflightWorkflowSecrets(workflowID, workflowName, target string) (projectRoot string, secretsYamlPath string, dotEnvPath string, logs []string, err error) {
	projectRoot = localWorkflowProjectRoot(workflowID, workflowName)
	workflowDir := localWorkflowDir(workflowID, workflowName)
	workflowYamlPath := filepath.Join(workflowDir, "workflow.yaml")
	projectYamlPath := filepath.Join(projectRoot, "project.yaml")
	secretsYamlPath = filepath.Join(projectRoot, "secrets.yaml")
	dotEnvPath = filepath.Join(workflowDir, ".env")

	if _, err := os.Stat(projectRoot); err != nil {
		if os.IsNotExist(err) {
			return "", "", "", nil, errors.New("local workflow project not found. Run sync to local first")
		}
		return "", "", "", nil, err
	}
	if _, err := os.Stat(projectYamlPath); err != nil {
		return "", "", "", nil, errors.New("missing project.yaml in synced workflow project")
	}
	if _, err := os.Stat(secretsYamlPath); err != nil {
		return "", "", "", nil, errors.New("missing secrets.yaml in synced workflow project")
	}
	if _, err := os.Stat(workflowYamlPath); err != nil {
		return "", "", "", nil, errors.New("missing workflow.yaml in synced workflow directory")
	}

	hasTarget, err := workflowHasTarget(workflowYamlPath, target)
	if err != nil {
		return "", "", "", nil, err
	}
	if !hasTarget {
		return "", "", "", nil, fmt.Errorf("workflow.yaml does not define target %q", target)
	}

	logs = []string{
		"project: " + projectRoot,
		"target: " + target,
		"secrets mode: local simulation (.env + secrets.yaml)",
	}
	return projectRoot, secretsYamlPath, dotEnvPath, logs, nil
}

func ensurePrivateKeyConfigured(dotEnvPath string) (bool, string, error) {
	privateKey := os.Getenv("CRE_ETH_PRIVATE_KEY")
	if strings.TrimSpace(privateKey) != "" && isValidPrivateKey(privateKey) {
		return true, "CRE_ETH_PRIVATE_KEY found in environment.", nil
	}

	if envValue, err := readDotEnvValue(dotEnvPath, "CRE_ETH_PRIVATE_KEY"); err == nil && isValidPrivateKey(envValue) {
		return true, "CRE_ETH_PRIVATE_KEY found in workflow .env.", nil
	}

	return false, "CRE_ETH_PRIVATE_KEY is not configured. Use Secrets -> UPDATE VALUE in the TUI.", nil
}

func readProjectRPC(projectYamlPath, target string) (string, error) {
	raw, err := os.ReadFile(projectYamlPath)
	if err != nil {
		return "", err
	}
	var parsed projectYAML
	if err := yaml.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	cfg, ok := parsed[target]
	if !ok || len(cfg.RPCs) == 0 {
		return "", nil
	}
	for _, rpc := range cfg.RPCs {
		if strings.EqualFold(strings.TrimSpace(rpc.ChainName), stagingChainName) {
			return strings.TrimSpace(rpc.URL), nil
		}
	}
	return strings.TrimSpace(cfg.RPCs[0].URL), nil
}

func setProjectRPC(projectYamlPath, target, stagingRPCURL string) error {
	raw, err := os.ReadFile(projectYamlPath)
	if err != nil {
		return err
	}
	var parsed projectYAML
	if err := yaml.Unmarshal(raw, &parsed); err != nil {
		return err
	}
	if parsed == nil {
		parsed = projectYAML{}
	}
	cfg := parsed[target]
	if len(cfg.RPCs) == 0 {
		cfg.RPCs = []rpcEntry{
			{ChainName: stagingChainName, URL: stagingRPCURL},
			{ChainName: mainnetChainName, URL: defaultMainnetRPC},
		}
	} else {
		hasMainnet := -1
		hasSepolia := -1
		for i, rpc := range cfg.RPCs {
			chain := strings.TrimSpace(strings.ToLower(rpc.ChainName))
			if chain == strings.ToLower(mainnetChainName) {
				hasMainnet = i
			}
			if chain == strings.ToLower(stagingChainName) {
				hasSepolia = i
			}
		}

		if hasSepolia >= 0 {
			cfg.RPCs[hasSepolia].URL = stagingRPCURL
		} else {
			cfg.RPCs = append(cfg.RPCs, rpcEntry{ChainName: stagingChainName, URL: stagingRPCURL})
		}

		if hasMainnet >= 0 {
			cfg.RPCs[hasMainnet].URL = defaultMainnetRPC
		} else {
			cfg.RPCs = append(cfg.RPCs, rpcEntry{ChainName: mainnetChainName, URL: defaultMainnetRPC})
		}
	}
	parsed[target] = cfg
	updated, err := yaml.Marshal(parsed)
	if err != nil {
		return err
	}
	return os.WriteFile(projectYamlPath, updated, 0o644)
}

func normalizeRPCURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", errors.New("RPC URL is required")
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", errors.New("invalid RPC URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", errors.New("RPC URL must start with http:// or https://")
	}
	return trimmed, nil
}

func demoPrivateKeyForProject(workflowID string) string {
	sum := sha256.Sum256([]byte("6flow-demo-private-key:" + strings.TrimSpace(workflowID)))
	return hex.EncodeToString(sum[:])
}

func targetIsTestnet(target string) bool {
	switch strings.TrimSpace(target) {
	case "production-settings":
		return false
	default:
		return true
	}
}

func readProjectRPCMap(projectYamlPath, target string) (map[string]string, error) {
	raw, err := os.ReadFile(projectYamlPath)
	if err != nil {
		return nil, err
	}
	var parsed projectYAML
	if err := yaml.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	out := map[string]string{}
	cfg, ok := parsed[target]
	if !ok {
		return out, nil
	}
	for _, rpc := range cfg.RPCs {
		chainName := strings.TrimSpace(rpc.ChainName)
		if chainName == "" {
			continue
		}
		out[chainName] = strings.TrimSpace(rpc.URL)
	}
	return out, nil
}

func setProjectTargetRPC(projectYamlPath, target, chainName, rpcURL string) error {
	raw, err := os.ReadFile(projectYamlPath)
	if err != nil {
		return err
	}
	var parsed projectYAML
	if err := yaml.Unmarshal(raw, &parsed); err != nil {
		return err
	}
	if parsed == nil {
		parsed = projectYAML{}
	}
	cfg := parsed[target]
	updated := false
	for i := range cfg.RPCs {
		if strings.EqualFold(strings.TrimSpace(cfg.RPCs[i].ChainName), strings.TrimSpace(chainName)) {
			cfg.RPCs[i].URL = rpcURL
			updated = true
			break
		}
	}
	if !updated {
		cfg.RPCs = append(cfg.RPCs, rpcEntry{
			ChainName: chainName,
			URL:       rpcURL,
		})
	}
	parsed[target] = cfg
	updatedYAML, err := yaml.Marshal(parsed)
	if err != nil {
		return err
	}
	return os.WriteFile(projectYamlPath, updatedYAML, 0o644)
}

func ListLocalVariableOptions(workflowID, workflowName, target string) (*LocalVariableListResult, error) {
	logs := []string{}
	appendLog := func(msg string) { logs = append(logs, msg) }

	projectRoot, secretsYamlPath, dotEnvPath, preflightLogs, err := preflightWorkflowSecrets(workflowID, workflowName, target)
	if err != nil {
		return nil, err
	}
	for _, l := range preflightLogs {
		appendLog(l)
	}

	entries := []LocalVariableEntry{}
	privateKey, _ := readDotEnvValue(dotEnvPath, "CRE_ETH_PRIVATE_KEY")
	privateKey = strings.TrimSpace(privateKey)
	if !isValidPrivateKey(privateKey) {
		privateKey = demoPrivateKeyForProject(workflowID)
	}
	entries = append(entries, LocalVariableEntry{
		Section:      "system",
		Kind:         "private_key",
		ID:           "CRE_ETH_PRIVATE_KEY",
		Key:          "CRE_ETH_PRIVATE_KEY",
		Label:        "CRE_ETH_PRIVATE_KEY",
		Description:  "System private key for simulation",
		CurrentValue: privateKey,
	})

	projectYamlPath := filepath.Join(projectRoot, "project.yaml")
	rpcMap, err := readProjectRPCMap(projectYamlPath, target)
	if err != nil {
		return &LocalVariableListResult{Logs: logs}, err
	}
	for _, chain := range supportedChainsForTarget(targetIsTestnet(target)) {
		current := strings.TrimSpace(rpcMap[chain.ChainName])
		if current == "" {
			current = chain.DefaultRPCURL
		}
		entries = append(entries, LocalVariableEntry{
			Section:      "system",
			Kind:         "rpc",
			ID:           "RPC:" + chain.ChainName,
			Key:          chain.ChainName,
			Label:        "RPC: " + chain.Name,
			Description:  chain.ChainName,
			CurrentValue: current,
		})
	}

	manifest, err := loadSecretsManifest(secretsYamlPath)
	if err != nil {
		return &LocalVariableListResult{Logs: logs}, err
	}
	localSecrets := listLocalSecretEntries(manifest, dotEnvPath)
	for _, entry := range localSecrets {
		currentValue := ""
		if strings.TrimSpace(entry.EnvVar) != "" {
			currentValue, _ = readDotEnvValue(dotEnvPath, entry.EnvVar)
		}
		status := "missing in .env"
		if entry.HasValue {
			status = "present in .env"
		}
		desc := status
		if strings.TrimSpace(entry.EnvVar) != "" {
			desc = fmt.Sprintf("%s (%s)", entry.EnvVar, status)
		}
		entries = append(entries, LocalVariableEntry{
			Section:      "environment",
			Kind:         "secret_env",
			ID:           entry.ID,
			Key:          entry.ID,
			Label:        entry.ID,
			Description:  desc,
			CurrentValue: strings.TrimSpace(currentValue),
		})
	}

	return &LocalVariableListResult{
		Logs:    logs,
		Entries: entries,
	}, nil
}

func UpdateLocalVariable(workflowID, workflowName, target, kind, key, value string) (*SecretsCommandResult, error) {
	logs := []string{}
	appendLog := func(msg string) { logs = append(logs, msg) }

	projectRoot, secretsYamlPath, dotEnvPath, preflightLogs, err := preflightWorkflowSecrets(workflowID, workflowName, target)
	if err != nil {
		return nil, err
	}
	for _, l := range preflightLogs {
		appendLog(l)
	}

	value = strings.TrimSpace(value)
	if value == "" {
		return &SecretsCommandResult{Logs: logs}, errors.New("value is required")
	}

	switch strings.TrimSpace(kind) {
	case "private_key":
		if !isValidPrivateKey(value) {
			return &SecretsCommandResult{Logs: logs}, errors.New("invalid private key format (expected 64 hex chars, optional 0x)")
		}
		normalizedKey := value
		if strings.HasPrefix(normalizedKey, "0x") {
			normalizedKey = strings.TrimPrefix(normalizedKey, "0x")
		}
		if err := setDotEnvValue(dotEnvPath, "CRE_ETH_PRIVATE_KEY", normalizedKey); err != nil {
			return &SecretsCommandResult{Logs: logs}, err
		}
		appendLog("Updated CRE_ETH_PRIVATE_KEY in local workflow .env.")
		appendLog(".env path: " + dotEnvPath)
		return &SecretsCommandResult{Logs: logs}, nil
	case "rpc":
		normalizedRPC, err := normalizeRPCURL(value)
		if err != nil {
			return &SecretsCommandResult{Logs: logs}, err
		}
		chainName := strings.TrimSpace(key)
		if chainName == "" {
			return &SecretsCommandResult{Logs: logs}, errors.New("chain name is required for rpc update")
		}
		projectYamlPath := filepath.Join(projectRoot, "project.yaml")
		if err := setProjectTargetRPC(projectYamlPath, target, chainName, normalizedRPC); err != nil {
			return &SecretsCommandResult{Logs: logs}, err
		}
		appendLog(fmt.Sprintf("Updated RPC for %s in project.yaml.", chainName))
		appendLog("project path: " + projectYamlPath)
		return &SecretsCommandResult{Logs: logs}, nil
	case "secret_env":
		secretID := normalizeSecretID(key)
		if secretID == "" {
			return &SecretsCommandResult{Logs: logs}, errors.New("secret id is required")
		}
		manifest, err := loadSecretsManifest(secretsYamlPath)
		if err != nil {
			return &SecretsCommandResult{Logs: logs}, err
		}
		envVars, exists := manifest.SecretsNames[secretID]
		if !exists {
			return &SecretsCommandResult{Logs: logs}, fmt.Errorf("secret %q does not exist", secretID)
		}
		envVar := ""
		if len(envVars) > 0 {
			envVar = strings.TrimSpace(envVars[0])
		}
		if envVar == "" {
			return &SecretsCommandResult{Logs: logs}, fmt.Errorf("secret %q has no env var mapping", secretID)
		}
		if err := setDotEnvValue(dotEnvPath, envVar, value); err != nil {
			return &SecretsCommandResult{Logs: logs}, err
		}
		appendLog(fmt.Sprintf("Updated secret value for %s in .env", secretID))
		return &SecretsCommandResult{Logs: logs}, nil
	default:
		return &SecretsCommandResult{Logs: logs}, fmt.Errorf("unsupported variable kind %q", kind)
	}
}

func GetWorkflowSecretsSetupDefaults(workflowID, workflowName, target string) (string, error) {
	projectRoot := localWorkflowProjectRoot(workflowID, workflowName)
	projectYamlPath := filepath.Join(projectRoot, "project.yaml")
	if _, err := os.Stat(projectYamlPath); err != nil {
		return "", err
	}
	return readProjectRPC(projectYamlPath, target)
}

func SaveWorkflowSecretsSetup(workflowID, workflowName, target, privateKey, rpcURL string) (*SecretsCommandResult, error) {
	logs := []string{}
	appendLog := func(msg string) { logs = append(logs, msg) }

	projectRoot, _, dotEnvPath, preflightLogs, err := preflightWorkflowSecrets(workflowID, workflowName, target)
	if err != nil {
		return nil, err
	}
	for _, line := range preflightLogs {
		appendLog(line)
	}

	if !isValidPrivateKey(privateKey) {
		return &SecretsCommandResult{Logs: logs}, errors.New("invalid private key format (expected 64 hex chars, optional 0x)")
	}
	normalizedRPC, err := normalizeRPCURL(rpcURL)
	if err != nil {
		return &SecretsCommandResult{Logs: logs}, err
	}

	normalizedKey := strings.TrimSpace(privateKey)
	if strings.HasPrefix(normalizedKey, "0x") {
		normalizedKey = strings.TrimPrefix(normalizedKey, "0x")
	}

	if err := setDotEnvValue(dotEnvPath, "CRE_ETH_PRIVATE_KEY", normalizedKey); err != nil {
		return &SecretsCommandResult{Logs: logs}, err
	}

	projectYamlPath := filepath.Join(projectRoot, "project.yaml")
	if err := setProjectRPC(projectYamlPath, target, normalizedRPC); err != nil {
		return &SecretsCommandResult{Logs: logs}, err
	}

	appendLog("Saved CRE_ETH_PRIVATE_KEY to local workflow .env.")
	appendLog("Saved staging RPC URL and normalized target RPC entries in local project.yaml.")
	appendLog("No secret values are sent to 6flow servers by this setup form.")
	appendLog(".env path: " + dotEnvPath)
	appendLog("project path: " + projectYamlPath)
	return &SecretsCommandResult{Logs: logs}, nil
}

func IsWorkflowSecretsSetupReady(workflowID, workflowName, target string) (bool, error) {
	dotEnvPath := filepath.Join(localWorkflowDir(workflowID, workflowName), ".env")
	privateKeyConfigured, _, err := ensurePrivateKeyConfigured(dotEnvPath)
	if err != nil {
		return false, err
	}
	return privateKeyConfigured, nil
}

func loadSecretsManifest(secretsYamlPath string) (*secretsManifest, error) {
	raw, err := os.ReadFile(secretsYamlPath)
	if err != nil {
		return nil, err
	}
	var m secretsManifest
	if err := yaml.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	if m.SecretsNames == nil {
		m.SecretsNames = map[string][]string{}
	}
	return &m, nil
}

func saveSecretsManifest(secretsYamlPath string, manifest *secretsManifest) error {
	if manifest.SecretsNames == nil {
		manifest.SecretsNames = map[string][]string{}
	}
	updated, err := yaml.Marshal(manifest)
	if err != nil {
		return err
	}
	return os.WriteFile(secretsYamlPath, updated, 0o644)
}

func normalizeSecretID(secretID string) string {
	trimmed := strings.TrimSpace(secretID)
	if trimmed == "" {
		return ""
	}
	return strings.ToUpper(strings.ReplaceAll(trimmed, " ", "_"))
}

func defaultEnvVarForSecret(secretID string) string {
	normalized := normalizeSecretID(secretID)
	normalized = regexp.MustCompile(`[^A-Z0-9_]`).ReplaceAllString(normalized, "_")
	if normalized == "" {
		normalized = "SECRET"
	}
	return normalized
}

func listLocalSecretEntries(manifest *secretsManifest, dotEnvPath string) []LocalSecretEntry {
	ids := make([]string, 0, len(manifest.SecretsNames))
	for id := range manifest.SecretsNames {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	entries := make([]LocalSecretEntry, 0, len(ids))
	for _, id := range ids {
		envVar := ""
		if envVars := manifest.SecretsNames[id]; len(envVars) > 0 {
			envVar = strings.TrimSpace(envVars[0])
		}
		value := ""
		if envVar != "" {
			value, _ = readDotEnvValue(dotEnvPath, envVar)
		}
		entries = append(entries, LocalSecretEntry{
			ID:       id,
			EnvVar:   envVar,
			HasValue: strings.TrimSpace(value) != "",
		})
	}
	return entries
}

func ListLocalSecrets(workflowID, workflowName, target string) (*LocalSecretsListResult, error) {
	logs := []string{}
	appendLog := func(msg string) { logs = append(logs, msg) }

	_, secretsYamlPath, dotEnvPath, preflightLogs, err := preflightWorkflowSecrets(workflowID, workflowName, target)
	if err != nil {
		return nil, err
	}
	for _, l := range preflightLogs {
		appendLog(l)
	}

	manifest, err := loadSecretsManifest(secretsYamlPath)
	if err != nil {
		return &LocalSecretsListResult{Logs: logs}, err
	}

	entries := listLocalSecretEntries(manifest, dotEnvPath)
	return &LocalSecretsListResult{Logs: logs, Entries: entries}, nil
}

func InspectLocalSecrets(workflowID, workflowName, target string) (*SecretsCommandResult, error) {
	logs := []string{}
	appendLog := func(msg string) { logs = append(logs, msg) }

	_, secretsYamlPath, dotEnvPath, preflightLogs, err := preflightWorkflowSecrets(workflowID, workflowName, target)
	if err != nil {
		return nil, err
	}
	for _, l := range preflightLogs {
		appendLog(l)
	}

	manifest, err := loadSecretsManifest(secretsYamlPath)
	if err != nil {
		return &SecretsCommandResult{Logs: logs}, err
	}

	if len(manifest.SecretsNames) == 0 {
		appendLog("No secrets declared in secrets.yaml")
		return &SecretsCommandResult{Logs: logs}, nil
	}

	ids := make([]string, 0, len(manifest.SecretsNames))
	for id := range manifest.SecretsNames {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	appendLog("Declared secrets:")
	for _, id := range ids {
		envVars := manifest.SecretsNames[id]
		if len(envVars) == 0 {
			appendLog("- " + id + " => (no env var mapping)")
			continue
		}
		envVar := envVars[0]
		value, _ := readDotEnvValue(dotEnvPath, envVar)
		status := "missing in .env"
		if strings.TrimSpace(value) != "" {
			status = "present in .env"
		}
		appendLog(fmt.Sprintf("- %s => %s (%s)", id, envVar, status))
	}

	return &SecretsCommandResult{Logs: logs}, nil
}

func CreateLocalSecret(workflowID, workflowName, target, secretID, secretValue string) (*SecretsCommandResult, error) {
	return upsertLocalSecret(workflowID, workflowName, target, secretID, secretValue, false)
}

func UpdateLocalSecret(workflowID, workflowName, target, secretID, secretValue string) (*SecretsCommandResult, error) {
	return upsertLocalSecret(workflowID, workflowName, target, secretID, secretValue, true)
}

func upsertLocalSecret(workflowID, workflowName, target, secretID, secretValue string, mustExist bool) (*SecretsCommandResult, error) {
	logs := []string{}
	appendLog := func(msg string) { logs = append(logs, msg) }

	_, secretsYamlPath, dotEnvPath, preflightLogs, err := preflightWorkflowSecrets(workflowID, workflowName, target)
	if err != nil {
		return nil, err
	}
	for _, l := range preflightLogs {
		appendLog(l)
	}

	id := normalizeSecretID(secretID)
	if id == "" {
		return &SecretsCommandResult{Logs: logs}, errors.New("secret id is required")
	}
	if strings.TrimSpace(secretValue) == "" {
		return &SecretsCommandResult{Logs: logs}, errors.New("secret value is required")
	}

	manifest, err := loadSecretsManifest(secretsYamlPath)
	if err != nil {
		return &SecretsCommandResult{Logs: logs}, err
	}

	envVars, exists := manifest.SecretsNames[id]
	if mustExist && !exists {
		return &SecretsCommandResult{Logs: logs}, fmt.Errorf("secret %q does not exist", id)
	}
	if !mustExist && exists {
		return &SecretsCommandResult{Logs: logs}, fmt.Errorf("secret %q already exists", id)
	}

	envVar := ""
	if len(envVars) > 0 {
		envVar = strings.TrimSpace(envVars[0])
	}
	if envVar == "" {
		envVar = defaultEnvVarForSecret(id)
		manifest.SecretsNames[id] = []string{envVar}
		if err := saveSecretsManifest(secretsYamlPath, manifest); err != nil {
			return &SecretsCommandResult{Logs: logs}, err
		}
	}
	if err := setDotEnvValue(dotEnvPath, envVar, strings.TrimSpace(secretValue)); err != nil {
		return &SecretsCommandResult{Logs: logs}, err
	}

	if mustExist {
		appendLog(fmt.Sprintf("Updated secret value for %s in .env", id))
	} else {
		appendLog(fmt.Sprintf("Created secret %s in secrets.yaml and .env", id))
	}
	return &SecretsCommandResult{Logs: logs}, nil
}

func DeleteLocalSecret(workflowID, workflowName, target, secretID string) (*SecretsCommandResult, error) {
	logs := []string{}
	appendLog := func(msg string) { logs = append(logs, msg) }

	_, secretsYamlPath, dotEnvPath, preflightLogs, err := preflightWorkflowSecrets(workflowID, workflowName, target)
	if err != nil {
		return nil, err
	}
	for _, l := range preflightLogs {
		appendLog(l)
	}

	id := normalizeSecretID(secretID)
	if id == "" {
		return &SecretsCommandResult{Logs: logs}, errors.New("secret id is required")
	}

	manifest, err := loadSecretsManifest(secretsYamlPath)
	if err != nil {
		return &SecretsCommandResult{Logs: logs}, err
	}
	envVars, exists := manifest.SecretsNames[id]
	if !exists {
		return &SecretsCommandResult{Logs: logs}, fmt.Errorf("secret %q does not exist", id)
	}

	for _, envVar := range envVars {
		if err := setDotEnvValue(dotEnvPath, envVar, ""); err != nil {
			return &SecretsCommandResult{Logs: logs}, err
		}
	}

	appendLog(fmt.Sprintf("Cleared secret value for %s in .env (declaration kept in secrets.yaml)", id))
	return &SecretsCommandResult{Logs: logs}, nil
}

func RunWorkflowSimulateLocal(workflowID, workflowName, target string) (*SimulateCommandResult, error) {
	logs := []string{}
	appendLog := func(msg string) { logs = append(logs, msg) }

	projectRoot := localWorkflowProjectRoot(workflowID, workflowName)
	workflowDirName := slugify(workflowName)
	workflowDir := filepath.Join(projectRoot, workflowDirName)
	workflowYamlPath := filepath.Join(workflowDir, "workflow.yaml")
	secretsYamlPath := filepath.Join(projectRoot, "secrets.yaml")
	dotEnvPath := filepath.Join(workflowDir, ".env")
	packageJSONPath := filepath.Join(workflowDir, "package.json")

	if _, err := os.Stat(projectRoot); err != nil {
		if os.IsNotExist(err) {
			return &SimulateCommandResult{Logs: logs}, errors.New("local workflow project not found. Run sync to local first")
		}
		return &SimulateCommandResult{Logs: logs}, err
	}
	if _, err := os.Stat(workflowDir); err != nil {
		return &SimulateCommandResult{Logs: logs}, errors.New("workflow directory not found in local sync. Run sync to local again")
	}
	if _, err := os.Stat(packageJSONPath); err != nil {
		return &SimulateCommandResult{Logs: logs}, errors.New("missing workflow package.json. Run sync to local again")
	}
	if _, err := os.Stat(secretsYamlPath); err != nil {
		return &SimulateCommandResult{Logs: logs}, errors.New("missing secrets.yaml in local workflow project. Run sync to local again")
	}

	hasTarget, err := workflowHasTarget(workflowYamlPath, target)
	if err != nil {
		return &SimulateCommandResult{Logs: logs}, err
	}
	if !hasTarget {
		return &SimulateCommandResult{Logs: logs}, fmt.Errorf("workflow.yaml does not define target %q", target)
	}

	appendLog("project: " + projectRoot)
	appendLog("workflow: " + workflowDirName)
	appendLog("target: " + target)
	appendLog("Validating local secrets before simulation...")

	privateKeyReady, privateKeyMsg, _ := ensurePrivateKeyConfigured(dotEnvPath)
	appendLog(privateKeyMsg)
	manifest, err := loadSecretsManifest(secretsYamlPath)
	if err != nil {
		return &SimulateCommandResult{Logs: logs}, err
	}
	entries := listLocalSecretEntries(manifest, dotEnvPath)
	missing := make([]LocalSecretEntry, 0)
	for _, entry := range entries {
		if !entry.HasValue {
			missing = append(missing, entry)
		}
	}
	if !privateKeyReady || len(missing) > 0 {
		appendLog("Simulation blocked. Missing required local secret setup:")
		if !privateKeyReady {
			appendLog("- CRE_ETH_PRIVATE_KEY is missing. Open Secrets -> UPDATE VALUE.")
		}
		for _, entry := range missing {
			if entry.EnvVar == "" {
				appendLog(fmt.Sprintf("- %s has no env var mapping in secrets.yaml", entry.ID))
				continue
			}
			appendLog(fmt.Sprintf("- %s (%s) is missing in .env", entry.ID, entry.EnvVar))
		}
		return &SimulateCommandResult{Logs: logs}, errors.New("cannot simulate until all secrets are configured")
	}
	appendLog("All required secrets are configured.")

	appendLog("Running dependency setup: bun install")
	installLines, installErr := runCommand(workflowDir, "bun", "install")
	for _, line := range installLines {
		appendLog("[bun] " + line)
	}
	if installErr != nil {
		return &SimulateCommandResult{Logs: logs}, fmt.Errorf("bun install failed: %w", installErr)
	}

	envArg := filepath.ToSlash(filepath.Join(workflowDirName, ".env"))
	appendLog("Running simulation: cre workflow simulate " + workflowDirName + " --target " + target + " -e " + envArg)
	simulateLines, simulateErr := runCommand(projectRoot, "cre", "workflow", "simulate", workflowDirName, "--target", target, "-e", envArg)
	for _, line := range simulateLines {
		appendLog("[cre] " + line)
	}
	if simulateErr != nil {
		return &SimulateCommandResult{Logs: logs}, fmt.Errorf("simulate failed: %w", simulateErr)
	}

	appendLog("Simulation completed.")
	return &SimulateCommandResult{Logs: logs}, nil
}
