package tui

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

type BrowserLoginOptions struct {
	WebBaseURL string
	Timeout    time.Duration
}

type BrowserLoginResult struct {
	Token string
}

type callbackBody struct {
	Token string `json:"token"`
	Nonce string `json:"nonce"`
}

type callbackResult struct {
	Token string
	Err   error
}

func randomNonce() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func tryOpenBrowser(link string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", link)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", "", link)
	default:
		cmd = exec.Command("xdg-open", link)
	}
	_ = cmd.Start()
}

func sendJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func RunBrowserLoginFlow(options BrowserLoginOptions) (BrowserLoginResult, error) {
	if options.Timeout <= 0 {
		options.Timeout = 3 * time.Minute
	}

	nonce, err := randomNonce()
	if err != nil {
		return BrowserLoginResult{}, err
	}

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return BrowserLoginResult{}, err
	}
	defer ln.Close()

	resultCh := make(chan callbackResult, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			sendJSON(w, http.StatusNoContent, map[string]any{})
			return
		}
		if r.Method != http.MethodPost {
			sendJSON(w, http.StatusNotFound, map[string]string{"error": "Not found"})
			return
		}

		var body callbackBody
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32_000)).Decode(&body); err != nil {
			sendJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON payload"})
			return
		}

		if body.Nonce != nonce {
			sendJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid nonce"})
			return
		}
		if strings.TrimSpace(body.Token) == "" {
			sendJSON(w, http.StatusBadRequest, map[string]string{"error": "Token is required"})
			return
		}

		sendJSON(w, http.StatusOK, map[string]bool{"ok": true})

		select {
		case resultCh <- callbackResult{Token: body.Token}:
		default:
		}
	})

	server := &http.Server{Handler: mux}
	go func() {
		if err := server.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			select {
			case resultCh <- callbackResult{Err: err}:
			default:
			}
		}
	}()

	callbackURL := url.URL{
		Scheme: "http",
		Host:   ln.Addr().String(),
		Path:   "/callback",
	}

	base := NormalizeBaseURL(options.WebBaseURL)
	if base == "" {
		base = "http://localhost:3000"
	}

	browserURL := fmt.Sprintf(
		"%s/tui/link?callback=%s&nonce=%s",
		base,
		url.QueryEscape(callbackURL.String()),
		url.QueryEscape(nonce),
	)
	tryOpenBrowser(browserURL)

	timer := time.NewTimer(options.Timeout)
	defer timer.Stop()

	select {
	case result := <-resultCh:
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
		if result.Err != nil {
			return BrowserLoginResult{}, result.Err
		}
		return BrowserLoginResult{Token: result.Token}, nil
	case <-timer.C:
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
		return BrowserLoginResult{}, errors.New("authentication timed out")
	}
}
