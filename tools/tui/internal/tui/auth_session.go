package tui

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type AuthSession struct {
	Token   string `json:"token"`
	Exp     *int64 `json:"exp"`
	SavedAt string `json:"savedAt"`
}

func sessionFilePath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".6flow/tui-auth.json"
	}
	return filepath.Join(home, ".6flow", "tui-auth.json")
}

func decodeJWTExp(token string) *int64 {
	parts := strings.Split(token, ".")
	if len(parts) < 2 {
		return nil
	}

	payloadPart := parts[1]
	if rem := len(payloadPart) % 4; rem != 0 {
		payloadPart += strings.Repeat("=", 4-rem)
	}

	decoded, err := base64.URLEncoding.DecodeString(payloadPart)
	if err != nil {
		return nil
	}

	var payload map[string]any
	if err := json.Unmarshal(decoded, &payload); err != nil {
		return nil
	}

	expFloat, ok := payload["exp"].(float64)
	if !ok {
		return nil
	}

	exp := int64(expFloat)
	return &exp
}

func IsSessionValid(session *AuthSession) bool {
	if session == nil || session.Token == "" || session.Exp == nil {
		return false
	}

	return (*session.Exp)*1000 > time.Now().UnixMilli()+5000
}

func LoadAuthSession() (*AuthSession, error) {
	content, err := os.ReadFile(sessionFilePath())
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var session AuthSession
	if err := json.Unmarshal(content, &session); err != nil {
		return nil, nil
	}
	if session.Token == "" {
		return nil, nil
	}
	if session.Exp == nil {
		session.Exp = decodeJWTExp(session.Token)
	}
	if session.SavedAt == "" {
		session.SavedAt = time.Now().UTC().Format(time.RFC3339)
	}

	return &session, nil
}

func SaveAuthSession(token string) (*AuthSession, error) {
	exp := decodeJWTExp(token)
	session := &AuthSession{
		Token:   token,
		Exp:     exp,
		SavedAt: time.Now().UTC().Format(time.RFC3339),
	}

	file := sessionFilePath()
	if err := os.MkdirAll(filepath.Dir(file), 0o700); err != nil {
		return nil, err
	}

	content, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return nil, err
	}

	if err := os.WriteFile(file, content, 0o600); err != nil {
		return nil, err
	}

	return session, nil
}

func ClearAuthSession() error {
	err := os.Remove(sessionFilePath())
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
