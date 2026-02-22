package tui

import (
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

	return false, "CRE_ETH_PRIVATE_KEY is not configured. Use Setup secrets env in the Secrets submenu.", nil
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
	return normalized + "_ALL"
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

	_, exists := manifest.SecretsNames[id]
	if mustExist && !exists {
		return &SecretsCommandResult{Logs: logs}, fmt.Errorf("secret %q does not exist", id)
	}
	if !mustExist && exists {
		return &SecretsCommandResult{Logs: logs}, fmt.Errorf("secret %q already exists", id)
	}

	envVar := defaultEnvVarForSecret(id)
	manifest.SecretsNames[id] = []string{envVar}
	if err := saveSecretsManifest(secretsYamlPath, manifest); err != nil {
		return &SecretsCommandResult{Logs: logs}, err
	}
	if err := setDotEnvValue(dotEnvPath, envVar, strings.TrimSpace(secretValue)); err != nil {
		return &SecretsCommandResult{Logs: logs}, err
	}

	if mustExist {
		appendLog(fmt.Sprintf("Updated secret %s in secrets.yaml and .env", id))
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

	delete(manifest.SecretsNames, id)
	if err := saveSecretsManifest(secretsYamlPath, manifest); err != nil {
		return &SecretsCommandResult{Logs: logs}, err
	}
	for _, envVar := range envVars {
		_ = removeDotEnvValue(dotEnvPath, envVar)
	}

	appendLog(fmt.Sprintf("Deleted secret %s from secrets.yaml and removed mapped env vars from .env", id))
	return &SecretsCommandResult{Logs: logs}, nil
}
