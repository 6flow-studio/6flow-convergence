package tui

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

type SyncLocalResult struct {
	OutputDir string
	Logs      []string
}

type workflowArtifacts struct {
	WorkflowPath string `yaml:"workflow-path"`
	ConfigPath   string `yaml:"config-path"`
	SecretsPath  string `yaml:"secrets-path"`
}

type userWorkflow struct {
	WorkflowName string `yaml:"workflow-name"`
}

type targetSettings struct {
	UserWorkflow      userWorkflow      `yaml:"user-workflow"`
	WorkflowArtifacts workflowArtifacts `yaml:"workflow-artifacts"`
}

type workflowYAML map[string]targetSettings

type normalizedWorkflowInfo struct {
	StagingConfigPath    string
	ProductionConfigPath string
}

func slugify(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	if value == "" {
		return "workflow"
	}

	out := make([]rune, 0, len(value))
	lastDash := false
	for _, r := range value {
		isAZ09 := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
		if isAZ09 {
			out = append(out, r)
			lastDash = false
			continue
		}
		if !lastDash {
			out = append(out, '-')
			lastDash = true
		}
	}

	result := strings.Trim(string(out), "-")
	if result == "" {
		return "workflow"
	}
	return result
}

func workflowsRootDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".6flow/workflows"
	}
	return filepath.Join(home, ".6flow", "workflows")
}

func ensureParent(path string) error {
	return os.MkdirAll(filepath.Dir(path), 0o755)
}

func safeJoin(base, name string) (string, error) {
	cleanBase := filepath.Clean(base)
	candidate := filepath.Join(cleanBase, name)
	cleanCandidate := filepath.Clean(candidate)

	rel, err := filepath.Rel(cleanBase, cleanCandidate)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(rel, "..") || rel == "." && strings.Contains(name, "..") {
		return "", fmt.Errorf("unsafe zip entry path: %s", name)
	}

	return cleanCandidate, nil
}

func unzipToDir(zipBytes []byte, dest string) error {
	readerAt := bytes.NewReader(zipBytes)
	zr, err := zip.NewReader(readerAt, int64(len(zipBytes)))
	if err != nil {
		return err
	}

	for _, f := range zr.File {
		target, err := safeJoin(dest, f.Name)
		if err != nil {
			return err
		}

		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}

		if err := ensureParent(target); err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			return err
		}

		content, err := io.ReadAll(rc)
		_ = rc.Close()
		if err != nil {
			return err
		}

		if err := os.WriteFile(target, content, 0o644); err != nil {
			return err
		}
	}

	return nil
}

func findFirstFile(root, name string) (string, error) {
	var found string
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if strings.EqualFold(filepath.Base(path), name) {
			found = path
			return io.EOF
		}
		return nil
	})
	if err != nil && !errors.Is(err, io.EOF) {
		return "", err
	}
	if found == "" {
		return "", os.ErrNotExist
	}
	return found, nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	if err := ensureParent(dst); err != nil {
		return err
	}

	out, err := os.Create(dst)
	if err != nil {
		return err
	}

	if _, err := io.Copy(out, in); err != nil {
		_ = out.Close()
		return err
	}
	if err := out.Close(); err != nil {
		return err
	}
	return nil
}

func copyDirRecursive(src, dst string, skip map[string]bool) error {
	return filepath.WalkDir(src, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}

		if skip[strings.ToLower(filepath.Base(path))] {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		target := filepath.Join(dst, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		return copyFile(path, target)
	})
}

func normalizePathField(value string, fallbackFile string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		if fallbackFile == "" {
			return ""
		}
		return "./" + fallbackFile
	}

	trimmed = filepath.Clean(trimmed)
	if strings.HasPrefix(trimmed, "../") {
		return trimmed
	}
	if strings.HasPrefix(trimmed, "./") {
		return trimmed
	}
	return "./" + strings.TrimPrefix(trimmed, "/")
}

func normalizeWorkflowYaml(workflowYamlPath string, workflowDirName string, hasSecrets bool) (*normalizedWorkflowInfo, error) {
	raw, err := os.ReadFile(workflowYamlPath)
	if err != nil {
		return nil, err
	}

	var data workflowYAML
	if err := yaml.Unmarshal(raw, &data); err != nil {
		return nil, err
	}

	if len(data) == 0 {
		data = workflowYAML{}
	}

	ensureTarget := func(targetKey, defaultConfig, defaultSuffix string) {
		settings, ok := data[targetKey]
		if !ok {
			settings = targetSettings{
				UserWorkflow: userWorkflow{
					WorkflowName: fmt.Sprintf("%s-%s", workflowDirName, defaultSuffix),
				},
				WorkflowArtifacts: workflowArtifacts{
					WorkflowPath: "./main.ts",
					ConfigPath:   "./" + defaultConfig,
				},
			}
		}

		if strings.TrimSpace(settings.UserWorkflow.WorkflowName) == "" {
			settings.UserWorkflow.WorkflowName = fmt.Sprintf("%s-%s", workflowDirName, defaultSuffix)
		}

		wa := settings.WorkflowArtifacts
		wa.WorkflowPath = normalizePathField(wa.WorkflowPath, "main.ts")
		wa.ConfigPath = normalizePathField(wa.ConfigPath, defaultConfig)
		if hasSecrets {
			wa.SecretsPath = "../secrets.yaml"
		}
		settings.WorkflowArtifacts = wa
		data[targetKey] = settings
	}

	ensureTarget("staging-settings", "config.staging.json", "staging")
	ensureTarget("production-settings", "config.production.json", "production")

	updated, err := yaml.Marshal(data)
	if err != nil {
		return nil, err
	}

	if err := os.WriteFile(workflowYamlPath, updated, 0o644); err != nil {
		return nil, err
	}

	return &normalizedWorkflowInfo{
		StagingConfigPath:    strings.TrimSpace(data["staging-settings"].WorkflowArtifacts.ConfigPath),
		ProductionConfigPath: strings.TrimSpace(data["production-settings"].WorkflowArtifacts.ConfigPath),
	}, nil
}

func normalizeProjectYaml(projectYamlPath string) error {
	raw, err := os.ReadFile(projectYamlPath)
	if err != nil {
		return err
	}

	var data map[string]any
	if err := yaml.Unmarshal(raw, &data); err != nil {
		return err
	}
	if len(data) == 0 {
		data = map[string]any{}
	}

	staging, hasStaging := data["staging-settings"]
	production, hasProduction := data["production-settings"]
	if hasStaging && !hasProduction {
		data["production-settings"] = staging
	}
	if !hasStaging && hasProduction {
		data["staging-settings"] = production
	}
	if _, ok := data["staging-settings"]; !ok {
		data["staging-settings"] = map[string]any{}
	}
	if _, ok := data["production-settings"]; !ok {
		data["production-settings"] = map[string]any{}
	}

	updated, err := yaml.Marshal(data)
	if err != nil {
		return err
	}
	return os.WriteFile(projectYamlPath, updated, 0o644)
}

func ensureConfigFile(workflowDir, configPath, fallbackConfigPath string) (bool, error) {
	if strings.TrimSpace(configPath) == "" {
		return false, nil
	}
	trimmed := strings.TrimSpace(strings.TrimPrefix(configPath, "./"))
	destPath := filepath.Join(workflowDir, trimmed)
	if _, err := os.Stat(destPath); err == nil {
		return false, nil
	}

	if strings.TrimSpace(fallbackConfigPath) != "" {
		fallbackTrimmed := strings.TrimSpace(strings.TrimPrefix(fallbackConfigPath, "./"))
		srcPath := filepath.Join(workflowDir, fallbackTrimmed)
		if _, err := os.Stat(srcPath); err == nil {
			if err := copyFile(srcPath, destPath); err != nil {
				return false, err
			}
			return true, nil
		}
	}

	if err := ensureParent(destPath); err != nil {
		return false, err
	}
	if err := os.WriteFile(destPath, []byte("{}\n"), 0o644); err != nil {
		return false, err
	}
	return true, nil
}

func SyncWorkflowToLocal(baseURL, token, workflowID, workflowName string) (*SyncLocalResult, error) {
	logs := []string{}
	appendLog := func(msg string) {
		logs = append(logs, msg)
	}

	bundle, err := DownloadWorkflowBundle(baseURL, token, workflowID)
	if err != nil {
		return nil, err
	}
	appendLog("Downloaded compiled workflow bundle.")

	root := workflowsRootDir()
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, err
	}

	folderName := fmt.Sprintf("%s--%s", slugify(workflowName), workflowID)
	finalDir := filepath.Join(root, folderName)
	tmpDir, err := os.MkdirTemp(root, ".sync-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmpDir)

	zipPath := filepath.Join(tmpDir, bundle.FileName)
	if err := os.WriteFile(zipPath, bundle.Content, 0o644); err != nil {
		return nil, err
	}
	appendLog("Saved bundle zip to temporary path.")

	extractedDir := filepath.Join(tmpDir, "extracted")
	if err := os.MkdirAll(extractedDir, 0o755); err != nil {
		return nil, err
	}
	if err := unzipToDir(bundle.Content, extractedDir); err != nil {
		return nil, err
	}
	appendLog("Extracted bundle zip.")

	projectYamlSrc, err := findFirstFile(extractedDir, "project.yaml")
	if err != nil {
		return nil, errors.New("bundle is missing project.yaml")
	}
	workflowYamlSrc, err := findFirstFile(extractedDir, "workflow.yaml")
	if err != nil {
		return nil, errors.New("bundle is missing workflow.yaml")
	}

	workflowSrcDir := filepath.Dir(workflowYamlSrc)
	stagedDir := filepath.Join(tmpDir, "staged")
	workflowDirName := slugify(workflowName)
	workflowDir := filepath.Join(stagedDir, workflowDirName)
	if err := os.MkdirAll(workflowDir, 0o755); err != nil {
		return nil, err
	}

	skip := map[string]bool{"project.yaml": true, "secrets.yaml": true}
	if err := copyDirRecursive(workflowSrcDir, workflowDir, skip); err != nil {
		return nil, err
	}

	projectYamlDst := filepath.Join(stagedDir, "project.yaml")
	if err := copyFile(projectYamlSrc, projectYamlDst); err != nil {
		return nil, err
	}

	hasSecrets := false
	if secretsYamlSrc, err := findFirstFile(extractedDir, "secrets.yaml"); err == nil {
		hasSecrets = true
		if err := copyFile(secretsYamlSrc, filepath.Join(stagedDir, "secrets.yaml")); err != nil {
			return nil, err
		}
	}

	workflowYamlDst, err := findFirstFile(workflowDir, "workflow.yaml")
	if err != nil {
		return nil, errors.New("workflow.yaml was not copied into workflow directory")
	}
	normalizedWorkflow, err := normalizeWorkflowYaml(workflowYamlDst, workflowDirName, hasSecrets)
	if err != nil {
		return nil, err
	}
	if err := normalizeProjectYaml(projectYamlDst); err != nil {
		return nil, err
	}

	createdStagingConfig, err := ensureConfigFile(
		workflowDir,
		normalizedWorkflow.StagingConfigPath,
		"",
	)
	if err != nil {
		return nil, err
	}
	createdProductionConfig, err := ensureConfigFile(
		workflowDir,
		normalizedWorkflow.ProductionConfigPath,
		normalizedWorkflow.StagingConfigPath,
	)
	if err != nil {
		return nil, err
	}

	appendLog("Reshaped workflow into CRE-compatible project structure.")
	if createdStagingConfig {
		appendLog("Created missing staging config file.")
	}
	if createdProductionConfig {
		appendLog("Created missing production config file.")
	}

	if err := os.RemoveAll(finalDir); err != nil {
		return nil, err
	}
	if err := os.Rename(stagedDir, finalDir); err != nil {
		return nil, err
	}

	entries, _ := os.ReadDir(finalDir)
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)
	appendLog("Local project written to: " + finalDir)
	appendLog("Top-level files: " + strings.Join(names, ", "))
	appendLog("To simulate:")
	appendLog("cd " + finalDir)
	appendLog("cre workflow simulate ./" + workflowDirName + " --target=staging-settings")

	return &SyncLocalResult{OutputDir: finalDir, Logs: logs}, nil
}
