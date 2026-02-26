package tui

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"regexp"
	"strings"
	"time"
)

type FrontendWorkflow struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	UpdatedAt       int64  `json:"updatedAt"`
	NodeCount       int    `json:"nodeCount"`
	Status          string `json:"status"`
	CompilerVersion string `json:"compilerVersion"`
}

type workflowsResponse struct {
	Workflows []FrontendWorkflow `json:"workflows"`
	Error     string             `json:"error"`
}

type WorkflowBundle struct {
	FileName string
	Content  []byte
}

type bundleDownloadResponse struct {
	DownloadURL     string `json:"downloadUrl"`
	FileName        string `json:"fileName"`
	CompilerVersion string `json:"compilerVersion"`
	Error           string `json:"error"`
	Detail          string `json:"detail"`
}

type workflowSecretUpdateRequest struct {
	Action     string `json:"action"`
	SecretName string `json:"secretName"`
}

type workflowSecretUpdateResponse struct {
	OK    bool   `json:"ok"`
	Error string `json:"error"`
}

var ErrFrontendUnauthorized = errors.New("unauthorized")

func NormalizeBaseURL(baseURL string) string {
	return strings.TrimRight(baseURL, "/")
}

func FetchFrontendWorkflows(baseURL, token string) ([]FrontendWorkflow, error) {
	url := NormalizeBaseURL(baseURL) + "/api/tui/workflows"

	client := &http.Client{Timeout: 20 * time.Second}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var payload workflowsResponse
	_ = json.NewDecoder(resp.Body).Decode(&payload)

	if resp.StatusCode == http.StatusUnauthorized {
		if payload.Error != "" {
			return nil, fmt.Errorf("%w: %s", ErrFrontendUnauthorized, payload.Error)
		}
		return nil, ErrFrontendUnauthorized
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if payload.Error != "" {
			return nil, errors.New(payload.Error)
		}
		return nil, fmt.Errorf("request failed with status %d", resp.StatusCode)
	}

	if payload.Workflows == nil {
		return nil, errors.New("invalid API response from /api/tui/workflows")
	}

	return payload.Workflows, nil
}

func parseFileNameFromDisposition(header string) string {
	re := regexp.MustCompile(`(?i)filename=\"?([^\";]+)\"?`)
	matches := re.FindStringSubmatch(header)
	if len(matches) < 2 {
		return "workflow-cre-bundle.zip"
	}
	return path.Base(strings.TrimSpace(matches[1]))
}

func DownloadWorkflowBundle(baseURL, token, workflowID string) (*WorkflowBundle, error) {
	url := fmt.Sprintf("%s/api/tui/workflows/%s/bundle", NormalizeBaseURL(baseURL), workflowID)

	client := &http.Client{Timeout: 60 * time.Second}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var metadata bundleDownloadResponse
	if err := json.NewDecoder(resp.Body).Decode(&metadata); err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, ErrFrontendUnauthorized
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		message := strings.TrimSpace(metadata.Error)
		if message == "" {
			message = fmt.Sprintf("request failed with status %d", resp.StatusCode)
		}
		if strings.TrimSpace(metadata.Detail) != "" {
			message = message + ": " + strings.TrimSpace(metadata.Detail)
		}
		return nil, errors.New(message)
	}
	if strings.TrimSpace(metadata.DownloadURL) == "" {
		return nil, errors.New("bundle endpoint returned no downloadUrl")
	}

	zipReq, err := http.NewRequest(http.MethodGet, metadata.DownloadURL, nil)
	if err != nil {
		return nil, err
	}
	zipReq.Header.Set("Accept", "application/zip")

	zipResp, err := client.Do(zipReq)
	if err != nil {
		return nil, err
	}
	defer zipResp.Body.Close()
	if zipResp.StatusCode < 200 || zipResp.StatusCode >= 300 {
		return nil, fmt.Errorf("failed to fetch compiled artifact zip (status %d)", zipResp.StatusCode)
	}

	body := new(bytes.Buffer)
	if _, err := io.Copy(body, zipResp.Body); err != nil {
		return nil, err
	}

	fileName := strings.TrimSpace(metadata.FileName)
	if fileName == "" {
		fileName = parseFileNameFromDisposition(zipResp.Header.Get("Content-Disposition"))
	}
	return &WorkflowBundle{
		FileName: fileName,
		Content:  body.Bytes(),
	}, nil
}

func UpdateWorkflowSecretInFrontend(baseURL, token, workflowID, action, secretName string) error {
	url := fmt.Sprintf("%s/api/tui/workflows/%s/secrets", NormalizeBaseURL(baseURL), workflowID)

	normalizedSecret := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(secretName), " ", "_"))
	payload := workflowSecretUpdateRequest{
		Action:     strings.TrimSpace(strings.ToLower(action)),
		SecretName: normalizedSecret,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	client := &http.Client{Timeout: 20 * time.Second}
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var result workflowSecretUpdateResponse
	_ = json.NewDecoder(resp.Body).Decode(&result)

	if resp.StatusCode == http.StatusUnauthorized {
		return ErrFrontendUnauthorized
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if strings.TrimSpace(result.Error) != "" {
			return errors.New(strings.TrimSpace(result.Error))
		}
		return fmt.Errorf("request failed with status %d", resp.StatusCode)
	}

	return nil
}
