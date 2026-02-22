package tui

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type FrontendWorkflow struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	UpdatedAt int64  `json:"updatedAt"`
	NodeCount int    `json:"nodeCount"`
	Status    string `json:"status"`
}

type workflowsResponse struct {
	Workflows []FrontendWorkflow `json:"workflows"`
	Error     string             `json:"error"`
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
