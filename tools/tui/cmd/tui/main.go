package main

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	core "github.com/6flow/6flow-convergence/tools/tui/internal/tui"
)

type appPhase string

type focusPane int

const (
	phaseCheckingAuth appPhase = "checkingAuth"
	phaseAuthGate     appPhase = "authGate"
	phaseLinking      appPhase = "linking"
	phaseReady        appPhase = "ready"
)

const workflowSyncListItemID = "__sync_list__"

const (
	focusWorkflows focusPane = iota
	focusActions
	focusConsole
)

type authState string

const (
	authConnected    authState = "connected"
	authDisconnected authState = "disconnected"
)

type workflowItem struct {
	id          string
	title       string
	description string
	status      string
}

func (i workflowItem) Title() string       { return i.title }
func (i workflowItem) Description() string { return i.description }
func (i workflowItem) FilterValue() string { return i.title }

type actionItem struct {
	id          string
	title       string
	description string
}

func (i actionItem) Title() string       { return i.title }
func (i actionItem) Description() string { return i.description }
func (i actionItem) FilterValue() string { return i.title }

type keyMap struct {
	Pane1  key.Binding
	Pane2  key.Binding
	Pane3  key.Binding
	Next   key.Binding
	Up     key.Binding
	Down   key.Binding
	Run    key.Binding
	Top    key.Binding
	Bottom key.Binding
	Clear  key.Binding
	Login  key.Binding
	Quit   key.Binding
}

func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Next, k.Run, k.Quit}
}

func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Pane1, k.Pane2, k.Pane3, k.Next},
		{k.Up, k.Down, k.Run, k.Clear},
		{k.Top, k.Bottom, k.Login, k.Quit},
	}
}

var keys = keyMap{
	Pane1:  key.NewBinding(key.WithKeys("1"), key.WithHelp("1", "workflows")),
	Pane2:  key.NewBinding(key.WithKeys("2"), key.WithHelp("2", "actions")),
	Pane3:  key.NewBinding(key.WithKeys("3"), key.WithHelp("3", "console")),
	Next:   key.NewBinding(key.WithKeys("tab"), key.WithHelp("tab", "next pane")),
	Up:     key.NewBinding(key.WithKeys("up", "k"), key.WithHelp("↑/k", "up")),
	Down:   key.NewBinding(key.WithKeys("down", "j"), key.WithHelp("↓/j", "down")),
	Run:    key.NewBinding(key.WithKeys("enter", "space"), key.WithHelp("enter", "run/select")),
	Top:    key.NewBinding(key.WithKeys("g"), key.WithHelp("g", "console top")),
	Bottom: key.NewBinding(key.WithKeys("G"), key.WithHelp("G", "console bottom")),
	Clear:  key.NewBinding(key.WithKeys("c"), key.WithHelp("c", "clear console")),
	Login:  key.NewBinding(key.WithKeys("y", "n"), key.WithHelp("y/n", "login or quit")),
	Quit:   key.NewBinding(key.WithKeys("q", "ctrl+c"), key.WithHelp("q", "quit")),
}

type loadedSessionMsg struct {
	session *core.AuthSession
	err     error
}

type workflowsLoadedMsg struct {
	workflows []core.FrontendWorkflow
	err       error
}

type loginFinishedMsg struct {
	token string
	err   error
}

type actionFinishedMsg struct {
	logs []string
}

type syncLocalFinishedMsg struct {
	logs []string
	err  error
}

type creWhoAmIFinishedMsg struct {
	identity string
	raw      string
	err      error
}

type secretsCmdFinishedMsg struct {
	logs  []string
	label string
	err   error
}

type model struct {
	phase     appPhase
	authState authState
	token     string

	busy          bool
	lastSyncAt    string
	user          string
	webBaseURL    string
	workflowCount int
	creLoggedIn   bool
	creIdentity   string

	width  int
	height int
	focus  focusPane

	workflowList list.Model
	actionList   list.Model
	secretsMenu  list.Model
	console      viewport.Model
	help         help.Model
	spinner      spinner.Model

	secretsMenuOpen         bool
	secretsWorkflowID       string
	secretsWorkflowName     string
	secretsTargets          []string
	secretsTargetIndex      int
	setupSecretsPromptOpen  bool
	setupPrivateKeyInput    textinput.Model
	setupRPCURLInput        textinput.Model
	setupPromptActiveField  int
	setupSecretsPromptError string
	secretFormOpen          bool
	secretFormMode          string
	secretIDInput           textinput.Model
	secretValueInput        textinput.Model
	secretFormActiveField   int
	secretFormError         string

	logs []string
}

func nowStamp() string {
	return time.Now().Format("15:04:05")
}

func withTimestamp(s string) string {
	return fmt.Sprintf("[%s] %s", nowStamp(), s)
}

func newList(title string, items []list.Item) list.Model {
	d := list.NewDefaultDelegate()
	d.ShowDescription = true
	d.SetHeight(2)
	l := list.New(items, d, 20, 10)
	l.Title = title
	l.SetFilteringEnabled(false)
	l.SetShowHelp(false)
	l.SetShowStatusBar(false)
	l.SetShowPagination(false)
	l.DisableQuitKeybindings()
	return l
}

func initialModel() model {
	base := os.Getenv("SIXFLOW_WEB_URL")
	if strings.TrimSpace(base) == "" {
		base = "http://localhost:3000"
	}

	user := os.Getenv("USER")
	if strings.TrimSpace(user) == "" {
		user = "unknown"
	}

	actions := []list.Item{
		actionItem{id: "simulate", title: "Simulate", description: "Mock run for selected workflow"},
		actionItem{id: "secrets", title: "Secrets", description: "Open secrets submenu (setup/read/create/update/delete)"},
		actionItem{id: "deploy", title: "Deploy (CI unavailable)", description: "Not available in current CI version"},
	}
	secretsActions := []list.Item{
		actionItem{id: "setup-secrets-env", title: "Setup secrets env", description: "Set private key + RPC URL locally"},
		actionItem{id: "read", title: "Read", description: "Inspect local secrets from secrets.yaml + .env"},
		actionItem{id: "create", title: "Create", description: "Create secret in secrets.yaml + .env"},
		actionItem{id: "update", title: "Update", description: "Update secret value in .env"},
		actionItem{id: "delete", title: "Delete", description: "Delete secret from secrets.yaml + .env"},
		actionItem{id: "back", title: "Back", description: "Close secrets submenu"},
	}

	sp := spinner.New()
	sp.Spinner = spinner.Line

	keyInput := textinput.New()
	keyInput.Placeholder = "0x... or 64-hex private key"
	keyInput.Prompt = "private key> "
	keyInput.EchoMode = textinput.EchoPassword
	keyInput.EchoCharacter = '•'
	keyInput.CharLimit = 80
	keyInput.Width = 70

	rpcInput := textinput.New()
	rpcInput.Placeholder = "https://..."
	rpcInput.Prompt = "rpc url> "
	rpcInput.CharLimit = 256
	rpcInput.Width = 70

	secretIDInput := textinput.New()
	secretIDInput.Placeholder = "API_KEY"
	secretIDInput.Prompt = "secret id> "
	secretIDInput.CharLimit = 120
	secretIDInput.Width = 70

	secretValueInput := textinput.New()
	secretValueInput.Placeholder = "secret value"
	secretValueInput.Prompt = "secret value> "
	secretValueInput.CharLimit = 512
	secretValueInput.Width = 70

	v := viewport.New(40, 10)
	v.SetContent(withTimestamp(fmt.Sprintf("Frontend API mode enabled (%s).", base)) + "\n" + withTimestamp("Checking local authentication session..."))
	v.GotoBottom()

	return model{
		phase:                phaseCheckingAuth,
		authState:            authDisconnected,
		lastSyncAt:           "never",
		user:                 user,
		webBaseURL:           base,
		focus:                focusWorkflows,
		workflowList:         newList("Workflows", []list.Item{}),
		actionList:           newList("Actions", actions),
		secretsMenu:          newList("Secrets submenu", secretsActions),
		secretsTargets:       []string{"staging-settings"},
		setupPrivateKeyInput: keyInput,
		setupRPCURLInput:     rpcInput,
		secretIDInput:        secretIDInput,
		secretValueInput:     secretValueInput,
		console:              v,
		help:                 help.New(),
		spinner:              sp,
		logs: []string{
			withTimestamp(fmt.Sprintf("Frontend API mode enabled (%s).", base)),
			withTimestamp("Checking local authentication session..."),
			withTimestamp("Checking CRE CLI identity (`cre whoami`) ..."),
		},
	}
}

func initSessionCmd() tea.Cmd {
	return func() tea.Msg {
		session, err := core.LoadAuthSession()
		return loadedSessionMsg{session: session, err: err}
	}
}

func refreshWorkflowsCmd(baseURL, token string) tea.Cmd {
	return func() tea.Msg {
		workflows, err := core.FetchFrontendWorkflows(baseURL, token)
		return workflowsLoadedMsg{workflows: workflows, err: err}
	}
}

func loginCmd(baseURL string) tea.Cmd {
	return func() tea.Msg {
		result, err := core.RunBrowserLoginFlow(core.BrowserLoginOptions{WebBaseURL: baseURL})
		if err != nil {
			return loginFinishedMsg{err: err}
		}
		return loginFinishedMsg{token: result.Token}
	}
}

func actionCmd(actionID, workflowID string) tea.Cmd {
	return func() tea.Msg {
		var logs []string
		switch actionID {
		case "simulate":
			time.Sleep(300 * time.Millisecond)
			logs = append(logs, fmt.Sprintf("Mock: building run plan for %q...", workflowID))
			time.Sleep(450 * time.Millisecond)
			logs = append(logs, "Mock: cre workflow simulate --config ./tmp/config.json")
			time.Sleep(550 * time.Millisecond)
			logs = append(logs, "Simulation finished (placeholder): no process was executed.")
		case "deploy":
			time.Sleep(300 * time.Millisecond)
			logs = append(logs, "Deploy is not available in the current CI version.")
			time.Sleep(250 * time.Millisecond)
			logs = append(logs, "Use local simulation/sync flows for now.")
		}
		return actionFinishedMsg{logs: logs}
	}
}

func syncLocalCmd(baseURL, token, workflowID, workflowName string) tea.Cmd {
	return func() tea.Msg {
		result, err := core.SyncWorkflowToLocal(baseURL, token, workflowID, workflowName)
		if err != nil {
			return syncLocalFinishedMsg{err: err}
		}
		return syncLocalFinishedMsg{
			logs: result.Logs,
			err:  nil,
		}
	}
}

func creWhoAmICmd() tea.Cmd {
	return func() tea.Msg {
		result, err := core.GetCREWhoAmI()
		if err != nil {
			return creWhoAmIFinishedMsg{err: err}
		}
		return creWhoAmIFinishedMsg{
			identity: result.Identity,
			raw:      result.Raw,
			err:      nil,
		}
	}
}

func secretsCommandCmd(actionID, workflowID, workflowName, target, secretID, secretValue string) tea.Cmd {
	return func() tea.Msg {
		var (
			result *core.SecretsCommandResult
			err    error
			label  string
		)

		switch actionID {
		case "read":
			label = "Secrets read"
			result, err = core.InspectLocalSecrets(workflowID, workflowName, target)
		case "create":
			label = "Secrets create"
			result, err = core.CreateLocalSecret(workflowID, workflowName, target, secretID, secretValue)
		case "update":
			label = "Secrets update"
			result, err = core.UpdateLocalSecret(workflowID, workflowName, target, secretID, secretValue)
		case "delete":
			label = "Secrets delete"
			result, err = core.DeleteLocalSecret(workflowID, workflowName, target, secretID)
		default:
			return secretsCmdFinishedMsg{
				label: "Secrets",
				err:   fmt.Errorf("unsupported secrets action %q", actionID),
			}
		}

		if err != nil {
			if result != nil && len(result.Logs) > 0 {
				return secretsCmdFinishedMsg{logs: result.Logs, label: label, err: err}
			}
			return secretsCmdFinishedMsg{label: label, err: err}
		}
		return secretsCmdFinishedMsg{logs: result.Logs, label: label, err: nil}
	}
}

func saveSecretsSetupCmd(workflowID, workflowName, target, privateKey, rpcURL string) tea.Cmd {
	return func() tea.Msg {
		result, err := core.SaveWorkflowSecretsSetup(
			workflowID,
			workflowName,
			target,
			privateKey,
			rpcURL,
		)
		label := "Setup secrets env"
		if err != nil {
			if result != nil && len(result.Logs) > 0 {
				return secretsCmdFinishedMsg{logs: result.Logs, label: label, err: err}
			}
			return secretsCmdFinishedMsg{label: label, err: err}
		}
		return secretsCmdFinishedMsg{logs: result.Logs, label: label, err: nil}
	}
}

func (m model) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, initSessionCmd(), creWhoAmICmd())
}

func wrapLine(input string, width int) []string {
	if width <= 1 {
		return []string{input}
	}

	runes := []rune(input)
	if len(runes) <= width {
		return []string{input}
	}

	out := make([]string, 0, (len(runes)/width)+1)
	for len(runes) > width {
		out = append(out, string(runes[:width]))
		runes = runes[width:]
	}
	if len(runes) > 0 {
		out = append(out, string(runes))
	}
	return out
}

func (m *model) refreshConsoleContent() {
	width := m.console.Width
	if width <= 0 {
		width = 80
	}

	wrapped := make([]string, 0, len(m.logs))
	for _, line := range m.logs {
		wrapped = append(wrapped, wrapLine(line, width)...)
	}
	m.console.SetContent(strings.Join(wrapped, "\n"))
}

func (m *model) appendLog(line string) {
	atBottom := m.console.AtBottom()
	m.logs = append(m.logs, withTimestamp(line))
	m.refreshConsoleContent()
	if atBottom {
		m.console.GotoBottom()
	}
}

func (m *model) setWorkflows(items []core.FrontendWorkflow) {
	prev := ""
	if current, ok := m.workflowList.SelectedItem().(workflowItem); ok {
		prev = current.id
	}

	listItems := make([]list.Item, 0, len(items)+1)
	selected := 0
	for idx, item := range items {
		updated := "-"
		if item.UpdatedAt > 0 {
			updated = time.UnixMilli(item.UpdatedAt).Local().Format("2006-01-02 15:04")
		}
		listItems = append(listItems, workflowItem{
			id:          item.ID,
			title:       item.Name,
			description: fmt.Sprintf("%s • %d nodes • %s", item.Status, item.NodeCount, updated),
			status:      item.Status,
		})
		if item.ID == prev {
			selected = idx
		}
	}
	listItems = append(listItems, workflowItem{
		id:          workflowSyncListItemID,
		title:       "🔄 Sync list",
		description: "Refresh workflow list from frontend API",
		status:      "meta",
	})

	m.workflowList.SetItems(listItems)
	m.workflowCount = len(items)
	m.workflowList.Title = "Workflows (Enter: sync selected, choose 'Sync list' to refresh)"
	if len(listItems) > 0 {
		m.workflowList.Select(selected)
	}
}

func clamp(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func (m *model) resize() {
	if m.width <= 0 || m.height <= 0 {
		return
	}

	headerH := 3
	footerH := 2
	mainH := m.height - headerH - footerH
	if mainH < 12 {
		mainH = 12
	}

	leftW := clamp(int(float64(m.width)*0.34), 34, 52)
	if leftW > m.width-30 {
		leftW = m.width - 30
	}
	if leftW < 24 {
		leftW = 24
	}
	rightW := m.width - leftW - 1
	if rightW < 20 {
		rightW = 20
	}

	wfH := clamp(int(float64(mainH)*0.62), 8, mainH-6)
	actionH := mainH - wfH
	if actionH < 6 {
		actionH = 6
		wfH = mainH - actionH
	}

	m.workflowList.SetSize(leftW-4, wfH-2)
	m.actionList.SetSize(leftW-4, actionH-2)
	m.secretsMenu.SetSize(leftW-4, actionH-2)
	m.console.Width = rightW - 2
	m.console.Height = mainH - 2
	m.refreshConsoleContent()
}

func (m model) currentSecretsTarget() string {
	if len(m.secretsTargets) == 0 {
		return "staging-settings"
	}
	if m.secretsTargetIndex < 0 || m.secretsTargetIndex >= len(m.secretsTargets) {
		return m.secretsTargets[0]
	}
	return m.secretsTargets[m.secretsTargetIndex]
}

func (m *model) nextSecretsTarget() {
	if len(m.secretsTargets) == 0 {
		return
	}
	m.secretsTargetIndex = (m.secretsTargetIndex + 1) % len(m.secretsTargets)
}

func (m model) selectedWorkflow() *workflowItem {
	item, ok := m.workflowList.SelectedItem().(workflowItem)
	if !ok {
		return nil
	}
	if item.id == workflowSyncListItemID {
		return nil
	}
	return &item
}

func (m model) selectedAction() *actionItem {
	item, ok := m.actionList.SelectedItem().(actionItem)
	if !ok {
		return nil
	}
	return &item
}

func compactIdentity(identity string) string {
	trimmed := strings.TrimSpace(identity)
	if trimmed == "" {
		return "unknown"
	}
	if len(trimmed) <= 24 {
		return trimmed
	}
	return trimmed[:21] + "..."
}

func (m *model) guardCRELoggedIn() bool {
	if m.creLoggedIn {
		return true
	}
	m.appendLog("CRE CLI login required. Run `cre auth login` first, then use Sync list.")
	return false
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case spinner.TickMsg:
		if m.phase != phaseReady {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}
		return m, nil

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.resize()
		return m, nil

	case loadedSessionMsg:
		if msg.err != nil {
			m.phase = phaseAuthGate
			m.authState = authDisconnected
			m.appendLog("Failed to read session. Login required.")
			return m, nil
		}

		if core.IsSessionValid(msg.session) {
			m.token = msg.session.Token
			m.authState = authConnected
			m.phase = phaseReady
			m.busy = true
			m.appendLog("Found valid local session.")
			m.appendLog("Loading workflows from frontend API...")
			return m, refreshWorkflowsCmd(m.webBaseURL, m.token)
		}

		if msg.session != nil {
			_ = core.ClearAuthSession()
			m.appendLog("Saved session is expired. Login required.")
		} else {
			m.appendLog("No saved session found.")
		}
		m.phase = phaseAuthGate
		m.authState = authDisconnected
		return m, nil

	case workflowsLoadedMsg:
		m.busy = false
		if msg.err != nil {
			if errors.Is(msg.err, core.ErrFrontendUnauthorized) {
				m.appendLog("Session rejected by frontend API. Login required.")
				_ = core.ClearAuthSession()
				m.token = ""
				m.authState = authDisconnected
				m.phase = phaseAuthGate
				return m, nil
			}
			m.appendLog("Workflow fetch failed: " + msg.err.Error())
			return m, nil
		}

		m.setWorkflows(msg.workflows)
		m.lastSyncAt = time.Now().Local().Format("2006-01-02 15:04:05")
		m.appendLog(fmt.Sprintf("Fetched %d workflow(s) from frontend API.", len(msg.workflows)))
		return m, nil

	case creWhoAmIFinishedMsg:
		if msg.err != nil {
			m.creLoggedIn = false
			m.creIdentity = ""
			m.appendLog("CRE CLI not logged in. Run `cre auth login` to use workflow/actions.")
			m.appendLog("CRE whoami: " + msg.err.Error())
			return m, nil
		}
		m.creLoggedIn = true
		m.creIdentity = compactIdentity(msg.identity)
		if strings.TrimSpace(msg.raw) != "" {
			m.appendLog("CRE CLI logged in as " + msg.identity)
		}
		return m, nil

	case loginFinishedMsg:
		if msg.err != nil {
			m.phase = phaseAuthGate
			m.authState = authDisconnected
			m.busy = false
			m.appendLog("Login flow failed: " + msg.err.Error())
			return m, nil
		}

		session, err := core.SaveAuthSession(msg.token)
		if err != nil || !core.IsSessionValid(session) {
			m.phase = phaseAuthGate
			m.authState = authDisconnected
			m.busy = false
			if err != nil {
				m.appendLog("Failed to save session: " + err.Error())
			} else {
				m.appendLog("Received an invalid or expired token.")
			}
			return m, nil
		}

		m.token = msg.token
		m.authState = authConnected
		m.phase = phaseReady
		m.busy = true
		m.appendLog("Authentication completed. Loading workflows...")
		m.appendLog("Loading workflows from frontend API...")
		return m, tea.Batch(refreshWorkflowsCmd(m.webBaseURL, m.token), creWhoAmICmd())

	case actionFinishedMsg:
		for _, line := range msg.logs {
			m.appendLog(line)
		}
		if action := m.selectedAction(); action != nil {
			m.appendLog(fmt.Sprintf("Action %q completed.", action.title))
		}
		m.busy = false
		return m, nil

	case syncLocalFinishedMsg:
		if msg.err != nil {
			m.appendLog("Sync to local failed: " + msg.err.Error())
			m.busy = false
			return m, nil
		}
		for _, line := range msg.logs {
			m.appendLog(line)
		}
		m.appendLog("Action \"Sync to local\" completed.")
		m.busy = false
		return m, nil

	case secretsCmdFinishedMsg:
		for _, line := range msg.logs {
			m.appendLog(line)
		}
		if msg.err != nil {
			if msg.label == "Setup secrets env" {
				m.setupSecretsPromptError = msg.err.Error()
				m.setupSecretsPromptOpen = true
			} else if strings.HasPrefix(msg.label, "Secrets ") {
				m.secretFormError = msg.err.Error()
				m.secretFormOpen = m.secretFormMode != ""
			}
			m.appendLog(msg.label + " failed: " + msg.err.Error())
			m.busy = false
			return m, nil
		}
		if msg.label == "Setup secrets env" {
			m.setupSecretsPromptOpen = false
			m.setupSecretsPromptError = ""
			m.setupPrivateKeyInput.SetValue("")
			m.setupRPCURLInput.SetValue("")
		}
		if strings.HasPrefix(msg.label, "Secrets ") {
			m.secretFormOpen = false
			m.secretFormMode = ""
			m.secretFormError = ""
			m.secretIDInput.SetValue("")
			m.secretValueInput.SetValue("")
		}
		m.appendLog("Action \"" + msg.label + "\" completed.")
		m.busy = false
		return m, nil

	case tea.KeyMsg:
		if key.Matches(msg, keys.Quit) {
			return m, tea.Quit
		}

		if m.phase == phaseAuthGate {
			switch strings.ToLower(msg.String()) {
			case "y":
				m.phase = phaseLinking
				m.busy = true
				m.appendLog("Starting browser login flow...")
				m.appendLog("Waiting for browser authentication...")
				return m, loginCmd(m.webBaseURL)
			case "n":
				return m, tea.Quit
			default:
				return m, nil
			}
		}

		if m.phase != phaseReady {
			return m, nil
		}

		if m.setupSecretsPromptOpen {
			switch msg.String() {
			case "esc":
				m.setupSecretsPromptOpen = false
				m.setupSecretsPromptError = ""
				m.setupPrivateKeyInput.SetValue("")
				m.setupRPCURLInput.SetValue("")
				m.appendLog("Setup secrets env canceled.")
				return m, nil
			case "enter":
				if m.busy {
					return m, nil
				}
				if m.setupPromptActiveField == 0 {
					m.setupPromptActiveField = 1
					return m, nil
				}
				privateKey := strings.TrimSpace(m.setupPrivateKeyInput.Value())
				rpcURL := strings.TrimSpace(m.setupRPCURLInput.Value())
				if privateKey == "" || rpcURL == "" {
					m.setupSecretsPromptError = "Private key and RPC URL are required."
					return m, nil
				}
				m.busy = true
				m.setupSecretsPromptError = ""
				m.appendLog("Saving local secrets environment (.env + project.yaml) ...")
				return m, saveSecretsSetupCmd(
					m.secretsWorkflowID,
					m.secretsWorkflowName,
					m.currentSecretsTarget(),
					privateKey,
					rpcURL,
				)
			case "tab", "shift+tab", "up", "down":
				if m.setupPromptActiveField == 0 {
					m.setupPromptActiveField = 1
					m.setupPrivateKeyInput.Blur()
					m.setupRPCURLInput.Focus()
				} else {
					m.setupPromptActiveField = 0
					m.setupRPCURLInput.Blur()
					m.setupPrivateKeyInput.Focus()
				}
				return m, nil
			}

			var cmd tea.Cmd
			if m.setupPromptActiveField == 0 {
				m.setupPrivateKeyInput, cmd = m.setupPrivateKeyInput.Update(msg)
			} else {
				m.setupRPCURLInput, cmd = m.setupRPCURLInput.Update(msg)
			}
			return m, cmd
		}
		if m.secretFormOpen {
			switch msg.String() {
			case "esc":
				m.secretFormOpen = false
				m.secretFormMode = ""
				m.secretFormError = ""
				m.secretIDInput.SetValue("")
				m.secretValueInput.SetValue("")
				m.appendLog("Secrets form canceled.")
				return m, nil
			case "enter":
				if m.busy {
					return m, nil
				}
				id := strings.TrimSpace(m.secretIDInput.Value())
				value := strings.TrimSpace(m.secretValueInput.Value())
				if id == "" {
					m.secretFormError = "Secret ID is required."
					return m, nil
				}
				if m.secretFormMode != "delete" && m.secretFormActiveField == 0 {
					m.secretFormActiveField = 1
					m.secretIDInput.Blur()
					m.secretValueInput.Focus()
					return m, nil
				}
				if m.secretFormMode != "delete" && value == "" {
					m.secretFormError = "Secret value is required."
					return m, nil
				}
				m.busy = true
				m.secretFormError = ""
				m.appendLog(fmt.Sprintf("Applying secrets %s for %s...", m.secretFormMode, m.secretsWorkflowName))
				return m, secretsCommandCmd(
					m.secretFormMode,
					m.secretsWorkflowID,
					m.secretsWorkflowName,
					m.currentSecretsTarget(),
					id,
					value,
				)
			case "tab", "shift+tab", "up", "down":
				if m.secretFormMode == "delete" {
					return m, nil
				}
				if m.secretFormActiveField == 0 {
					m.secretFormActiveField = 1
					m.secretIDInput.Blur()
					m.secretValueInput.Focus()
				} else {
					m.secretFormActiveField = 0
					m.secretValueInput.Blur()
					m.secretIDInput.Focus()
				}
				return m, nil
			}

			var cmd tea.Cmd
			if m.secretFormMode == "delete" || m.secretFormActiveField == 0 {
				m.secretIDInput, cmd = m.secretIDInput.Update(msg)
			} else {
				m.secretValueInput, cmd = m.secretValueInput.Update(msg)
			}
			return m, cmd
		}

		if m.secretsMenuOpen {
			if msg.String() == "esc" || msg.String() == "backspace" || msg.String() == "b" {
				m.secretsMenuOpen = false
				m.secretsWorkflowID = ""
				m.secretsWorkflowName = ""
				m.appendLog("Closed secrets submenu.")
				return m, nil
			}

			if key.Matches(msg, keys.Run) {
				if m.busy {
					return m, nil
				}
				selected, ok := m.secretsMenu.SelectedItem().(actionItem)
				if !ok {
					return m, nil
				}
				if selected.id == "back" {
					m.secretsMenuOpen = false
					m.secretsWorkflowID = ""
					m.secretsWorkflowName = ""
					m.appendLog("Closed secrets submenu.")
					return m, nil
				}
				if selected.id == "setup-secrets-env" {
					m.setupSecretsPromptOpen = true
					m.setupSecretsPromptError = ""
					m.setupPromptActiveField = 0
					m.setupPrivateKeyInput.SetValue("")
					defaultRPC, err := core.GetWorkflowSecretsSetupDefaults(m.secretsWorkflowID, m.secretsWorkflowName, m.currentSecretsTarget())
					if err == nil {
						m.setupRPCURLInput.SetValue(defaultRPC)
					} else {
						m.setupRPCURLInput.SetValue("")
					}
					m.setupPrivateKeyInput.Focus()
					m.setupRPCURLInput.Blur()
					m.appendLog("Setup secrets env opened. Values are stored locally only.")
					return m, nil
				}
				if selected.id == "create" || selected.id == "update" || selected.id == "delete" {
					m.secretFormOpen = true
					m.secretFormMode = selected.id
					m.secretFormError = ""
					m.secretFormActiveField = 0
					m.secretIDInput.SetValue("")
					m.secretValueInput.SetValue("")
					m.secretIDInput.Focus()
					m.secretValueInput.Blur()
					m.appendLog(fmt.Sprintf("Opened secrets %s form for %s.", selected.id, m.secretsWorkflowName))
					return m, nil
				}

				m.busy = true
				m.appendLog(fmt.Sprintf("Starting %s for %s...", selected.title, m.secretsWorkflowName))
				return m, secretsCommandCmd(selected.id, m.secretsWorkflowID, m.secretsWorkflowName, m.currentSecretsTarget(), "", "")
			}

			var cmd tea.Cmd
			m.secretsMenu, cmd = m.secretsMenu.Update(msg)
			return m, cmd
		}

		switch {
		case key.Matches(msg, keys.Pane1):
			m.focus = focusWorkflows
			return m, nil
		case key.Matches(msg, keys.Pane2):
			m.focus = focusActions
			return m, nil
		case key.Matches(msg, keys.Pane3):
			m.focus = focusConsole
			return m, nil
		case key.Matches(msg, keys.Next):
			m.focus = (m.focus + 1) % 3
			return m, nil
		}

		if m.focus == focusConsole {
			switch msg.String() {
			case "up", "k":
				m.console.LineUp(1)
			case "down", "j":
				m.console.LineDown(1)
			case "g":
				m.console.GotoTop()
			case "G":
				m.console.GotoBottom()
			case "c":
				m.logs = []string{withTimestamp("Console cleared.")}
				m.refreshConsoleContent()
				m.console.GotoBottom()
			}
			return m, nil
		}

		if m.focus == focusWorkflows {
			if key.Matches(msg, keys.Run) {
				if m.busy {
					return m, nil
				}
				item, ok := m.workflowList.SelectedItem().(workflowItem)
				if !ok {
					return m, nil
				}
				if item.id == workflowSyncListItemID {
					if strings.TrimSpace(m.token) == "" {
						m.phase = phaseAuthGate
						m.authState = authDisconnected
						m.appendLog("No active session. Please log in first.")
						return m, nil
					}
					m.busy = true
					m.appendLog("Refreshing workflows from frontend API...")
					return m, tea.Batch(refreshWorkflowsCmd(m.webBaseURL, m.token), creWhoAmICmd())
				}
				if !m.guardCRELoggedIn() {
					return m, creWhoAmICmd()
				}
				if strings.TrimSpace(m.token) == "" {
					m.phase = phaseAuthGate
					m.authState = authDisconnected
					m.appendLog("No active session. Please log in first.")
					return m, nil
				}
				if item.status != "ready" {
					m.appendLog("Workflow is not compiled yet. Compile first before syncing.")
					return m, nil
				}
				m.busy = true
				m.appendLog(fmt.Sprintf("Starting sync to local for %s...", item.title))
				return m, syncLocalCmd(m.webBaseURL, m.token, item.id, item.title)
			}

			var cmd tea.Cmd
			m.workflowList, cmd = m.workflowList.Update(msg)
			cmds = append(cmds, cmd)
			return m, tea.Batch(cmds...)
		}

		if m.focus == focusActions {
			if key.Matches(msg, keys.Run) {
				if m.busy {
					return m, nil
				}
				action := m.selectedAction()
				if action == nil {
					return m, nil
				}
				if !m.guardCRELoggedIn() {
					return m, creWhoAmICmd()
				}
				if action.id == "secrets" {
					workflow := m.selectedWorkflow()
					if workflow == nil {
						m.appendLog("Select a workflow first.")
						return m, nil
					}
					m.secretsMenuOpen = true
					m.secretsWorkflowID = workflow.id
					m.secretsWorkflowName = workflow.title
					m.focus = focusActions
					m.appendLog(fmt.Sprintf("Opened secrets submenu for %s. Press esc to go back.", workflow.title))
					return m, nil
				}

				workflow := m.selectedWorkflow()
				if workflow == nil {
					m.appendLog("Select a workflow first.")
					return m, nil
				}

				m.busy = true
				m.appendLog(fmt.Sprintf("Action %q started for %s.", action.title, workflow.title))
				return m, actionCmd(action.id, workflow.id)
			}

			var cmd tea.Cmd
			m.actionList, cmd = m.actionList.Update(msg)
			cmds = append(cmds, cmd)
			return m, tea.Batch(cmds...)
		}
	}

	return m, tea.Batch(cmds...)
}

func paneStyle(focused bool) lipgloss.Style {
	border := lipgloss.Color("8")
	if focused {
		border = lipgloss.Color("14")
	}
	return lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(border)
}

func (m model) headerView() string {
	state := string(m.authState)
	if m.busy {
		state += " • busy"
	}
	creState := "login-required"
	if m.creLoggedIn {
		creState = "connected:" + m.creIdentity
	}
	head := lipgloss.NewStyle().Bold(true).Render("6FLOW TUI")
	subText := fmt.Sprintf(
		"user=%s  mode=frontend-api  auth=%s  cre=%s  workflows=%d  secrets_mode=staging-only (%s)  last_sync=%s",
		m.user,
		state,
		creState,
		m.workflowCount,
		m.currentSecretsTarget(),
		m.lastSyncAt,
	)
	wrapWidth := m.width - 2
	if wrapWidth < 40 {
		wrapWidth = 40
	}
	subLines := wrapLine(subText, wrapWidth)
	sub := lipgloss.NewStyle().Foreground(lipgloss.Color("8")).Render(strings.Join(subLines, "\n"))
	return lipgloss.JoinVertical(lipgloss.Left, head, sub)
}

func (m model) authView() string {
	panel := paneStyle(true).Padding(1, 2)
	lines := []string{"Authentication"}
	if m.phase == phaseCheckingAuth || m.phase == phaseLinking {
		lines = append(lines, fmt.Sprintf("%s %s", m.spinner.View(), "Checking/processing authentication..."))
	}
	if m.phase == phaseAuthGate {
		lines = append(lines, "Log in now?")
		lines = append(lines, "Press Y to start login flow, or N to quit.")
	}
	lines = append(lines, "")
	start := len(m.logs) - 10
	if start < 0 {
		start = 0
	}
	lines = append(lines, m.logs[start:]...)

	return panel.Width(max(50, m.width-2)).Render(strings.Join(lines, "\n"))
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func (m model) renderSetupSecretsPrompt() string {
	title := lipgloss.NewStyle().Bold(true).Render("Setup secrets environment")
	notice := lipgloss.NewStyle().Foreground(lipgloss.Color("11")).Render(
		"Values are stored locally (.env + project.yaml). Nothing is sent to 6flow servers.",
	)
	target := lipgloss.NewStyle().Foreground(lipgloss.Color("8")).Render(
		fmt.Sprintf("workflow: %s | target: %s", m.secretsWorkflowName, m.currentSecretsTarget()),
	)
	hints := lipgloss.NewStyle().Foreground(lipgloss.Color("8")).Render("Tab to switch fields. Enter on RPC field saves. Esc cancels.")
	errorLine := ""
	if strings.TrimSpace(m.setupSecretsPromptError) != "" {
		errorLine = lipgloss.NewStyle().Foreground(lipgloss.Color("9")).Render(m.setupSecretsPromptError)
	}

	privateKeyLabel := "Private key"
	rpcLabel := "RPC URL"
	if m.setupPromptActiveField == 0 {
		privateKeyLabel = lipgloss.NewStyle().Foreground(lipgloss.Color("14")).Render(privateKeyLabel)
	} else {
		rpcLabel = lipgloss.NewStyle().Foreground(lipgloss.Color("14")).Render(rpcLabel)
	}

	lines := []string{
		title,
		notice,
		target,
		"",
		privateKeyLabel,
		m.setupPrivateKeyInput.View(),
		"",
		rpcLabel,
		m.setupRPCURLInput.View(),
		hints,
	}
	if errorLine != "" {
		lines = append(lines, errorLine)
	}

	panel := paneStyle(true).Padding(1, 2).Width(max(70, m.width-2))
	return panel.Render(strings.Join(lines, "\n"))
}

func (m model) renderSecretFormPrompt() string {
	modeTitle := strings.ToUpper(m.secretFormMode)
	title := lipgloss.NewStyle().Bold(true).Render("Secrets " + modeTitle)
	notice := lipgloss.NewStyle().Foreground(lipgloss.Color("11")).Render(
		"Local simulation mode: updates only secrets.yaml and workflow .env.",
	)
	target := lipgloss.NewStyle().Foreground(lipgloss.Color("8")).Render(
		fmt.Sprintf("workflow: %s | target: %s", m.secretsWorkflowName, m.currentSecretsTarget()),
	)
	hints := "Enter submits. Esc cancels."
	if m.secretFormMode != "delete" {
		hints = "Tab to switch fields. Enter on value submits. Esc cancels."
	}
	hintsView := lipgloss.NewStyle().Foreground(lipgloss.Color("8")).Render(hints)

	secretIDLabel := "Secret ID"
	secretValueLabel := "Secret value"
	if m.secretFormMode != "delete" {
		if m.secretFormActiveField == 0 {
			secretIDLabel = lipgloss.NewStyle().Foreground(lipgloss.Color("14")).Render(secretIDLabel)
		} else {
			secretValueLabel = lipgloss.NewStyle().Foreground(lipgloss.Color("14")).Render(secretValueLabel)
		}
	} else {
		secretIDLabel = lipgloss.NewStyle().Foreground(lipgloss.Color("14")).Render(secretIDLabel)
	}

	lines := []string{
		title,
		notice,
		target,
		"",
		secretIDLabel,
		m.secretIDInput.View(),
	}
	if m.secretFormMode != "delete" {
		lines = append(lines, "", secretValueLabel, m.secretValueInput.View())
	}
	lines = append(lines, hintsView)

	if strings.TrimSpace(m.secretFormError) != "" {
		lines = append(lines, lipgloss.NewStyle().Foreground(lipgloss.Color("9")).Render(m.secretFormError))
	}

	panel := paneStyle(true).Padding(1, 2).Width(max(70, m.width-2))
	return panel.Render(strings.Join(lines, "\n"))
}

func (m model) View() string {
	if m.width == 0 || m.height == 0 {
		return "Loading..."
	}

	if m.phase != phaseReady {
		return lipgloss.JoinVertical(lipgloss.Left, m.headerView(), m.authView(), m.help.View(keys))
	}

	leftW := m.workflowList.Width() + 4
	rightW := m.console.Width + 2

	wf := paneStyle(m.focus == focusWorkflows).Width(leftW).Render(m.workflowList.View())
	actionsPane := m.actionList.View()
	if m.secretsMenuOpen {
		m.secretsMenu.Title = fmt.Sprintf("Secrets submenu (staging-only): %s | target=%s (esc back)", m.secretsWorkflowName, m.currentSecretsTarget())
		actionsPane = m.secretsMenu.View()
	} else {
		m.actionList.Title = "Actions"
	}
	ac := paneStyle(m.focus == focusActions).Width(leftW).Render(actionsPane)
	leftCol := lipgloss.JoinVertical(lipgloss.Left, wf, ac)

	consoleHeader := "Console"
	if m.busy {
		consoleHeader = fmt.Sprintf("%s %s", m.spinner.View(), consoleHeader)
	}
	consoleBody := lipgloss.JoinVertical(lipgloss.Left,
		lipgloss.NewStyle().Bold(true).Render(consoleHeader),
		m.console.View(),
	)
	rightCol := paneStyle(m.focus == focusConsole).Width(rightW).Render(consoleBody)

	body := lipgloss.JoinHorizontal(lipgloss.Top, leftCol, rightCol)
	footer := m.help.View(keys)
	sections := []string{m.headerView(), body}
	if m.setupSecretsPromptOpen {
		sections = append(sections, m.renderSetupSecretsPrompt())
	}
	if m.secretFormOpen {
		sections = append(sections, m.renderSecretFormPrompt())
	}
	sections = append(sections, footer)
	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

func main() {
	p := tea.NewProgram(initialModel(), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
