package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"runtime"
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

type secretPickItem struct {
	id           string
	key          string
	kind         string
	section      string
	currentValue string
	description  string
	selectable   bool
}

func (i secretPickItem) Title() string       { return i.id }
func (i secretPickItem) Description() string { return i.description }
func (i secretPickItem) FilterValue() string { return i.id }

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
	Clear:  key.NewBinding(key.WithKeys("c"), key.WithHelp("c", "copy selected line")),
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
	err  error
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

type secretOptionsLoadedMsg struct {
	actionID string
	logs     []string
	options  []core.LocalSecretEntry
	err      error
}

type variableOptionsLoadedMsg struct {
	logs    []string
	options []core.LocalVariableEntry
	err     error
}

type copyNoticeClearedMsg struct {
	id int
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
	secretPickOpen          bool
	secretPickAction        string
	secretPickList          list.Model
	variablePickerOpen      bool
	variablePickerFocus     int
	systemVariableList      list.Model
	environmentVariableList list.Model
	secretFormOpen          bool
	secretFormMode          string
	secretFormVariableKind  string
	secretFormVariableKey   string
	secretIDInput           textinput.Model
	secretValueInput        textinput.Model
	secretFormActiveField   int
	secretFormError         string
	secretIDLocked          bool
	secretRemoveFromConvex  bool
	consoleLines            []string
	consoleSelected         int
	copyNotice              string
	copyNoticeID            int

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

func newVariableList(title string, items []list.Item) list.Model {
	d := list.NewDefaultDelegate()
	d.ShowDescription = true
	d.SetHeight(2)
	// Remove default selected left marker block for cleaner two-pane picker.
	d.Styles.SelectedTitle = lipgloss.NewStyle().
		Padding(0, 0, 0, 2).
		Border(lipgloss.NormalBorder(), false, false, false, false).
		Foreground(lipgloss.Color("13")).
		Bold(true)
	d.Styles.SelectedDesc = lipgloss.NewStyle().
		Padding(0, 0, 0, 2).
		Border(lipgloss.NormalBorder(), false, false, false, false).
		Foreground(lipgloss.Color("13"))

	l := list.New(items, d, 20, 10)
	l.Title = title
	l.SetFilteringEnabled(false)
	l.SetShowHelp(false)
	l.SetShowStatusBar(false)
	l.SetShowPagination(false)
	l.DisableQuitKeybindings()
	return l
}

func buildSecretsActions() []list.Item {
	coreActions := []list.Item{
		actionItem{id: "read", title: "READ", description: "Inspect local secrets from secrets.yaml + .env"},
		actionItem{id: "update", title: "UPDATE", description: "Update system/environment variable values"},
		actionItem{id: "add", title: "ADD", description: "Add secret key+value locally and to frontend config"},
		actionItem{id: "remove", title: "REMOVE", description: "Clear local value (optional frontend removal)"},
	}
	backAction := actionItem{id: "back", title: "Back", description: "Close secrets submenu"}
	return append(coreActions, backAction)
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
		actionItem{id: "simulate", title: "Simulate", description: "Run local simulation of the workflow (using local secrets)"},
		actionItem{id: "secrets", title: "Secrets", description: "Manage secrets in local environment"},
		actionItem{id: "deploy", title: "Deploy (Unavailable)", description: "Not available in current CLI version"},
	}
	secretsActions := buildSecretsActions()
	secretPickList := newList("Select secret", []list.Item{})
	systemVariableList := newVariableList("System Variables", []list.Item{})
	environmentVariableList := newVariableList("Environment Variables", []list.Item{})

	sp := spinner.New()
	sp.Spinner = spinner.Line

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
		phase:                   phaseCheckingAuth,
		authState:               authDisconnected,
		lastSyncAt:              "never",
		user:                    user,
		webBaseURL:              base,
		focus:                   focusWorkflows,
		workflowList:            newList("Workflows", []list.Item{}),
		actionList:              newList("Actions", actions),
		secretsMenu:             newList("Secrets submenu", secretsActions),
		secretPickList:          secretPickList,
		systemVariableList:      systemVariableList,
		environmentVariableList: environmentVariableList,
		secretsTargets:          []string{"staging-settings"},
		secretIDInput:           secretIDInput,
		secretValueInput:        secretValueInput,
		console:                 v,
		help:                    help.New(),
		spinner:                 sp,
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

func actionCmd(actionID, workflowID, workflowName string) tea.Cmd {
	return func() tea.Msg {
		var logs []string
		var err error
		switch actionID {
		case "simulate":
			result, runErr := core.RunWorkflowSimulateLocal(workflowID, workflowName, "staging-settings")
			if result != nil {
				logs = append(logs, result.Logs...)
			}
			err = runErr
		case "deploy":
			time.Sleep(300 * time.Millisecond)
			logs = append(logs, "Deploy is not available in the current CI version.")
			time.Sleep(250 * time.Millisecond)
			logs = append(logs, "Use local simulation/sync flows for now.")
		}
		return actionFinishedMsg{logs: logs, err: err}
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

func normalizeSecretNameInput(raw string) string {
	return strings.TrimSpace(raw)
}

func secretsCommandCmd(baseURL, token, actionID, workflowID, workflowName, target, secretID, secretValue, frontendSyncAction string) tea.Cmd {
	return func() tea.Msg {
		var (
			result *core.SecretsCommandResult
			err    error
			label  string
			logs   []string
		)

		switch actionID {
		case "read":
			label = "Secrets read"
			result, err = core.InspectLocalSecrets(workflowID, workflowName, target)
		case "add":
			label = "Secrets add"
			result, err = core.CreateLocalSecret(workflowID, workflowName, target, secretID, secretValue)
		case "remove":
			label = "Secrets remove"
			result, err = core.DeleteLocalSecret(workflowID, workflowName, target, secretID)
		default:
			return secretsCmdFinishedMsg{
				label: "Secrets",
				err:   fmt.Errorf("unsupported secrets action %q", actionID),
			}
		}

		if result != nil {
			logs = append(logs, result.Logs...)
		}

		if err != nil {
			return secretsCmdFinishedMsg{logs: logs, label: label, err: err}
		}

		syncAction := strings.TrimSpace(strings.ToLower(frontendSyncAction))
		if syncAction != "" {
			if strings.TrimSpace(token) == "" {
				return secretsCmdFinishedMsg{
					logs:  logs,
					label: label,
					err:   errors.New("cannot sync workflow secret to frontend without auth session"),
				}
			}
			if err := core.UpdateWorkflowSecretInFrontend(baseURL, token, workflowID, syncAction, normalizeSecretNameInput(secretID)); err != nil {
				return secretsCmdFinishedMsg{
					logs:  logs,
					label: label,
					err:   fmt.Errorf("local update succeeded but frontend sync failed: %w", err),
				}
			}
			logs = append(logs, fmt.Sprintf("Synced secret %s to frontend workflow config (%s).", normalizeSecretNameInput(secretID), syncAction))
		}

		return secretsCmdFinishedMsg{logs: logs, label: label, err: nil}
	}
}

func secretOptionsCmd(actionID, workflowID, workflowName, target string) tea.Cmd {
	return func() tea.Msg {
		result, err := core.ListLocalSecrets(workflowID, workflowName, target)
		if err != nil {
			if result != nil {
				return secretOptionsLoadedMsg{actionID: actionID, logs: result.Logs, err: err}
			}
			return secretOptionsLoadedMsg{actionID: actionID, err: err}
		}
		return secretOptionsLoadedMsg{
			actionID: actionID,
			logs:     result.Logs,
			options:  result.Entries,
			err:      nil,
		}
	}
}

func variableOptionsCmd(workflowID, workflowName, target string) tea.Cmd {
	return func() tea.Msg {
		result, err := core.ListLocalVariableOptions(workflowID, workflowName, target)
		if err != nil {
			if result != nil {
				return variableOptionsLoadedMsg{logs: result.Logs, err: err}
			}
			return variableOptionsLoadedMsg{err: err}
		}
		return variableOptionsLoadedMsg{
			logs:    result.Logs,
			options: result.Entries,
			err:     nil,
		}
	}
}

func updateVariableCmd(workflowID, workflowName, target, kind, key, value string) tea.Cmd {
	return func() tea.Msg {
		result, err := core.UpdateLocalVariable(workflowID, workflowName, target, kind, key, value)
		label := "Update value"
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
	return tea.Batch(m.spinner.Tick, initSessionCmd(), creWhoAmICmd(), tea.HideCursor)
}

func classifyLogColor(line string) lipgloss.Color {
	lower := strings.ToLower(line)
	switch {
	case strings.Contains(lower, "[cre]"):
		return lipgloss.Color("12")
	case strings.Contains(lower, "[bun]"):
		return lipgloss.Color("10")
	case strings.Contains(lower, "frontend"):
		return lipgloss.Color("6")
	case strings.Contains(lower, "convex"):
		return lipgloss.Color("13")
	case strings.Contains(lower, "update value"):
		return lipgloss.Color("11")
	case strings.Contains(lower, "failed") || strings.Contains(lower, "error"):
		return lipgloss.Color("9")
	default:
		return lipgloss.Color("7")
	}
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

	type renderedLine struct {
		text  string
		color lipgloss.Color
	}

	rendered := make([]renderedLine, 0, len(m.logs))
	for _, line := range m.logs {
		color := classifyLogColor(line)
		for _, segment := range wrapLine(line, width) {
			rendered = append(rendered, renderedLine{text: segment, color: color})
		}
	}

	if len(rendered) == 0 {
		rendered = append(rendered, renderedLine{text: "", color: lipgloss.Color("7")})
	}
	if m.consoleSelected < 0 {
		m.consoleSelected = 0
	}
	if m.consoleSelected >= len(rendered) {
		m.consoleSelected = len(rendered) - 1
	}

	m.consoleLines = m.consoleLines[:0]
	styled := make([]string, 0, len(rendered))
	for idx, line := range rendered {
		m.consoleLines = append(m.consoleLines, line.text)
		if idx == m.consoleSelected {
			styled = append(styled, lipgloss.NewStyle().Foreground(lipgloss.Color("0")).Background(lipgloss.Color("11")).Render(line.text))
			continue
		}
		styled = append(styled, lipgloss.NewStyle().Foreground(line.color).Render(line.text))
	}
	m.console.SetContent(strings.Join(styled, "\n"))
	m.ensureConsoleSelectionVisible()
}

func (m *model) appendLog(line string) {
	atBottom := m.console.AtBottom() || len(m.consoleLines) == 0 || m.consoleSelected >= len(m.consoleLines)-1
	m.logs = append(m.logs, withTimestamp(line))
	if atBottom {
		m.consoleSelected = len(m.consoleLines)
	}
	m.refreshConsoleContent()
	if atBottom {
		m.console.GotoBottom()
	}
}

func (m *model) ensureConsoleSelectionVisible() {
	if len(m.consoleLines) == 0 {
		return
	}
	if m.consoleSelected < m.console.YOffset {
		diff := m.console.YOffset - m.consoleSelected
		if diff > 0 {
			m.console.LineUp(diff)
		}
		return
	}
	bottom := m.console.YOffset + m.console.Height - 1
	if m.consoleSelected > bottom {
		diff := m.consoleSelected - bottom
		if diff > 0 {
			m.console.LineDown(diff)
		}
	}
}

func copyToClipboard(value string) error {
	text := strings.TrimSpace(value)
	if text == "" {
		return errors.New("nothing to copy")
	}
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("pbcopy")
	case "linux":
		if _, err := exec.LookPath("wl-copy"); err == nil {
			cmd = exec.Command("wl-copy")
		} else if _, err := exec.LookPath("xclip"); err == nil {
			cmd = exec.Command("xclip", "-selection", "clipboard")
		} else if _, err := exec.LookPath("xsel"); err == nil {
			cmd = exec.Command("xsel", "--clipboard", "--input")
		} else {
			return errors.New("no clipboard tool found (install wl-copy/xclip/xsel)")
		}
	case "windows":
		cmd = exec.Command("cmd", "/c", "clip")
	default:
		return errors.New("unsupported platform for clipboard copy")
	}
	cmd.Stdin = strings.NewReader(text)
	return cmd.Run()
}

func clearCopyNoticeCmd(id int) tea.Cmd {
	return tea.Tick(1400*time.Millisecond, func(_ time.Time) tea.Msg {
		return copyNoticeClearedMsg{id: id}
	})
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
		description := fmt.Sprintf("%s • %d nodes • %s", item.Status, item.NodeCount, updated)
		if item.Status == "ready" {
			compilerVersion := strings.TrimSpace(item.CompilerVersion)
			if compilerVersion == "" {
				compilerVersion = "unknown"
			}
			description = fmt.Sprintf(
				"%s • compiler %s • %d nodes • %s",
				item.Status,
				compilerVersion,
				item.NodeCount,
				updated,
			)
		}
		listItems = append(listItems, workflowItem{
			id:          item.ID,
			title:       item.Name,
			description: description,
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
	m.secretPickList.SetSize(leftW-4, actionH-2)
	m.systemVariableList.SetSize(max(20, (m.width/2)-10), max(8, actionH))
	m.environmentVariableList.SetSize(max(20, (m.width/2)-10), max(8, actionH))
	m.console.Width = rightW - 2
	// Console pane also has a 1-line header, so keep viewport 1 line shorter.
	m.console.Height = max(6, mainH-3)
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

func (m *model) refreshSecretsMenu() {
	items := buildSecretsActions()
	m.secretsMenu.SetItems(items)
	m.secretsMenu.Select(0)
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
		if msg.err != nil {
			m.appendLog("Action failed: " + msg.err.Error())
			m.busy = false
			return m, nil
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
			if msg.label == "Update value" || strings.HasPrefix(msg.label, "Secrets ") {
				m.secretFormError = msg.err.Error()
				m.secretFormOpen = m.secretFormMode != ""
			}
			m.appendLog(msg.label + " failed: " + msg.err.Error())
			m.busy = false
			return m, nil
		}
		if msg.label == "Update value" || strings.HasPrefix(msg.label, "Secrets ") {
			m.secretFormOpen = false
			m.secretFormMode = ""
			m.secretFormVariableKind = ""
			m.secretFormVariableKey = ""
			m.secretFormError = ""
			m.secretIDLocked = false
			m.secretRemoveFromConvex = false
			m.secretIDInput.SetValue("")
			m.secretValueInput.SetValue("")
		}
		m.appendLog("Action \"" + msg.label + "\" completed.")
		m.busy = false
		return m, nil

	case secretOptionsLoadedMsg:
		for _, line := range msg.logs {
			m.appendLog(line)
		}
		if msg.err != nil {
			m.appendLog("Unable to list secrets: " + msg.err.Error())
			m.busy = false
			return m, nil
		}

		items := make([]list.Item, 0, len(msg.options))
		for _, option := range msg.options {
			switch msg.actionID {
			case "add":
				if option.HasValue {
					continue
				}
			}
			status := "missing in .env"
			if option.HasValue {
				status = "present in .env"
			}
			description := status
			if strings.TrimSpace(option.EnvVar) != "" {
				description = fmt.Sprintf("%s (%s)", option.EnvVar, status)
			}
			items = append(items, secretPickItem{
				id:          option.ID,
				key:         option.ID,
				kind:        "secret_env",
				section:     "environment",
				description: description,
				selectable:  true,
			})
		}

		if len(items) == 0 {
			switch msg.actionID {
			case "add":
				m.appendLog("No missing secrets to add.")
			case "update":
				m.appendLog("No secrets available to update.")
			case "remove":
				m.appendLog("No configured secrets to remove.")
			}
			m.busy = false
			return m, nil
		}

		m.secretPickAction = msg.actionID
		m.secretPickOpen = true
		m.secretPickList.SetItems(items)
		m.secretPickList.Select(0)
		m.busy = false
		m.appendLog("Pick a secret from the list and press Enter.")
		return m, nil

	case variableOptionsLoadedMsg:
		for _, line := range msg.logs {
			m.appendLog(line)
		}
		if msg.err != nil {
			m.appendLog("Unable to list variables: " + msg.err.Error())
			m.busy = false
			return m, nil
		}
		systemItems := make([]list.Item, 0)
		environmentItems := make([]list.Item, 0)
		for _, option := range msg.options {
			switch option.Section {
			case "system":
				systemItems = append(systemItems, secretPickItem{
					id:           option.Label,
					key:          option.Key,
					kind:         option.Kind,
					section:      option.Section,
					currentValue: option.CurrentValue,
					description:  option.Description,
					selectable:   true,
				})
			case "environment":
				environmentItems = append(environmentItems, secretPickItem{
					id:           option.Label,
					key:          option.Key,
					kind:         option.Kind,
					section:      option.Section,
					currentValue: option.CurrentValue,
					description:  option.Description,
					selectable:   true,
				})
			}
		}
		if len(systemItems) == 0 && len(environmentItems) == 0 {
			m.appendLog("No variables available to update.")
			m.busy = false
			return m, nil
		}
		m.secretPickAction = "update"
		m.variablePickerOpen = true
		m.systemVariableList.SetItems(systemItems)
		m.environmentVariableList.SetItems(environmentItems)
		if len(systemItems) > 0 {
			m.systemVariableList.Select(0)
		}
		if len(environmentItems) > 0 {
			m.environmentVariableList.Select(0)
		}
		if len(systemItems) > 0 {
			m.variablePickerFocus = 0
		} else {
			m.variablePickerFocus = 1
		}
		m.busy = false
		m.appendLog("Update value picker opened. Choose from System (left) or Environment (right).")
		return m, nil

	case copyNoticeClearedMsg:
		if msg.id == m.copyNoticeID {
			m.copyNotice = ""
		}
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

		if m.secretFormOpen {
			if m.secretFormMode == "remove" {
				switch msg.String() {
				case "t", "T", "ctrl+t":
					m.secretRemoveFromConvex = !m.secretRemoveFromConvex
					if m.secretRemoveFromConvex {
						m.appendLog("REMOVE mode: Convex removal enabled.")
					} else {
						m.appendLog("REMOVE mode: Convex removal disabled (clear local value only).")
					}
					return m, nil
				}
			}

			switch msg.String() {
			case "esc":
				m.secretFormOpen = false
				m.secretFormMode = ""
				m.secretFormVariableKind = ""
				m.secretFormVariableKey = ""
				m.secretFormError = ""
				m.secretIDLocked = false
				m.secretRemoveFromConvex = false
				m.secretIDInput.SetValue("")
				m.secretValueInput.SetValue("")
				m.appendLog("Secrets form canceled.")
				return m, nil
			case "enter":
				if m.busy {
					return m, nil
				}
				id := normalizeSecretNameInput(m.secretIDInput.Value())
				value := strings.TrimSpace(m.secretValueInput.Value())
				if m.secretFormMode != "update" && id == "" {
					m.secretFormError = "Secret ID is required."
					return m, nil
				}
				if !m.secretIDLocked && m.secretFormMode != "remove" && m.secretFormMode != "update" && m.secretFormActiveField == 0 {
					m.secretFormActiveField = 1
					m.secretIDInput.Blur()
					m.secretValueInput.Focus()
					return m, nil
				}
				if m.secretFormMode != "remove" && value == "" {
					m.secretFormError = "Secret value is required."
					return m, nil
				}
				m.busy = true
				m.secretFormError = ""
				m.appendLog(fmt.Sprintf("Applying %s for %s...", m.secretFormMode, m.secretsWorkflowName))
				if m.secretFormMode == "update" {
					return m, updateVariableCmd(
						m.secretsWorkflowID,
						m.secretsWorkflowName,
						m.currentSecretsTarget(),
						m.secretFormVariableKind,
						m.secretFormVariableKey,
						value,
					)
				}
				frontendSyncAction := ""
				if m.secretFormMode == "add" {
					frontendSyncAction = "add"
				}
				if m.secretFormMode == "remove" && m.secretRemoveFromConvex {
					frontendSyncAction = "remove"
				}
				return m, secretsCommandCmd(
					m.webBaseURL,
					m.token,
					m.secretFormMode,
					m.secretsWorkflowID,
					m.secretsWorkflowName,
					m.currentSecretsTarget(),
					id,
					value,
					frontendSyncAction,
				)
			case "tab", "shift+tab", "up", "down":
				if m.secretIDLocked || m.secretFormMode == "remove" || m.secretFormMode == "update" {
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
			if !m.secretIDLocked && (m.secretFormMode == "remove" || m.secretFormActiveField == 0) {
				m.secretIDInput, cmd = m.secretIDInput.Update(msg)
			} else {
				m.secretValueInput, cmd = m.secretValueInput.Update(msg)
			}
			return m, cmd
		}

		if m.variablePickerOpen {
			switch msg.String() {
			case "esc", "backspace", "b":
				m.variablePickerOpen = false
				m.secretPickAction = ""
				m.secretFormVariableKind = ""
				m.secretFormVariableKey = ""
				m.appendLog("Update value picker canceled.")
				return m, nil
			case "tab", "left", "right":
				if m.variablePickerFocus == 0 {
					if len(m.environmentVariableList.Items()) > 0 {
						m.variablePickerFocus = 1
					}
				} else if len(m.systemVariableList.Items()) > 0 {
					m.variablePickerFocus = 0
				}
				return m, nil
			}

			if key.Matches(msg, keys.Run) {
				if m.busy {
					return m, nil
				}
				var selectedItem list.Item
				var ok bool
				if m.variablePickerFocus == 0 {
					selectedItem = m.systemVariableList.SelectedItem()
				} else {
					selectedItem = m.environmentVariableList.SelectedItem()
				}
				selected, castOK := selectedItem.(secretPickItem)
				ok = castOK
				if !ok {
					m.appendLog("Select a variable first.")
					return m, nil
				}
				m.variablePickerOpen = false
				m.secretIDInput.SetValue(selected.id)
				m.secretValueInput.SetValue(selected.currentValue)
				m.secretFormError = ""
				m.secretIDLocked = true
				m.secretRemoveFromConvex = false
				m.secretFormVariableKind = selected.kind
				m.secretFormVariableKey = selected.key
				m.secretFormOpen = true
				m.secretFormMode = "update"
				m.secretFormActiveField = 1
				m.secretIDInput.Blur()
				m.secretValueInput.Focus()
				m.appendLog(fmt.Sprintf("Selected %s for update.", selected.id))
				return m, nil
			}

			var cmd tea.Cmd
			if m.variablePickerFocus == 0 {
				m.systemVariableList, cmd = m.systemVariableList.Update(msg)
			} else {
				m.environmentVariableList, cmd = m.environmentVariableList.Update(msg)
			}
			return m, cmd
		}

		if m.secretPickOpen {
			if msg.String() == "esc" || msg.String() == "backspace" || msg.String() == "b" {
				m.secretPickOpen = false
				m.secretPickAction = ""
				m.secretFormVariableKind = ""
				m.secretFormVariableKey = ""
				m.appendLog("Secret picker canceled.")
				return m, nil
			}

			if key.Matches(msg, keys.Run) {
				if m.busy {
					return m, nil
				}
				selected, ok := m.secretPickList.SelectedItem().(secretPickItem)
				if !ok {
					return m, nil
				}
				if !selected.selectable {
					m.appendLog("Select a variable row, not a section header.")
					return m, nil
				}
				m.secretPickOpen = false
				m.secretIDInput.SetValue(selected.id)
				m.secretValueInput.SetValue(selected.currentValue)
				m.secretFormError = ""
				m.secretIDLocked = true
				m.secretRemoveFromConvex = false
				m.secretFormVariableKind = selected.kind
				m.secretFormVariableKey = selected.key

				m.secretFormOpen = true
				m.secretFormMode = m.secretPickAction
				if m.secretPickAction == "remove" {
					m.secretFormActiveField = 0
					m.secretIDInput.Blur()
					m.secretValueInput.Blur()
				} else {
					m.secretFormActiveField = 1
					m.secretIDInput.Blur()
					m.secretValueInput.Focus()
				}
				m.appendLog(fmt.Sprintf("Selected %s for %s.", selected.id, m.secretPickAction))
				return m, nil
			}

			var cmd tea.Cmd
			m.secretPickList, cmd = m.secretPickList.Update(msg)
			return m, cmd
		}

		if m.secretsMenuOpen {
			if msg.String() == "esc" || msg.String() == "backspace" || msg.String() == "b" {
				m.secretsMenuOpen = false
				m.secretPickOpen = false
				m.variablePickerOpen = false
				m.secretPickAction = ""
				m.secretFormVariableKind = ""
				m.secretFormVariableKey = ""
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
					m.secretPickOpen = false
					m.variablePickerOpen = false
					m.secretPickAction = ""
					m.secretFormVariableKind = ""
					m.secretFormVariableKey = ""
					m.secretsWorkflowID = ""
					m.secretsWorkflowName = ""
					m.appendLog("Closed secrets submenu.")
					return m, nil
				}
				if selected.id == "add" || selected.id == "update" || selected.id == "remove" {
					if selected.id == "add" {
						m.secretFormOpen = true
						m.secretFormMode = "add"
						m.secretFormError = ""
						m.secretIDLocked = false
						m.secretRemoveFromConvex = false
						m.secretFormActiveField = 0
						m.secretIDInput.SetValue("")
						m.secretValueInput.SetValue("")
						m.secretIDInput.Focus()
						m.secretValueInput.Blur()
						m.appendLog("Secrets add form opened. New key will be added to local secrets.yaml and frontend config.")
						return m, nil
					}
					if selected.id == "update" {
						m.busy = true
						m.appendLog("Loading variables for UPDATE VALUE...")
						return m, variableOptionsCmd(m.secretsWorkflowID, m.secretsWorkflowName, m.currentSecretsTarget())
					}
					m.busy = true
					m.appendLog(fmt.Sprintf("Loading secrets list for %s...", strings.ToUpper(selected.id)))
					return m, secretOptionsCmd(selected.id, m.secretsWorkflowID, m.secretsWorkflowName, m.currentSecretsTarget())
				}

				m.busy = true
				m.appendLog(fmt.Sprintf("Starting %s for %s...", selected.title, m.secretsWorkflowName))
				return m, secretsCommandCmd(
					m.webBaseURL,
					m.token,
					selected.id,
					m.secretsWorkflowID,
					m.secretsWorkflowName,
					m.currentSecretsTarget(),
					"",
					"",
					"",
				)
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
				if m.consoleSelected > 0 {
					m.consoleSelected--
				}
				m.refreshConsoleContent()
			case "down", "j":
				if m.consoleSelected < len(m.consoleLines)-1 {
					m.consoleSelected++
				}
				m.refreshConsoleContent()
			case "g":
				m.consoleSelected = 0
				m.refreshConsoleContent()
			case "G":
				if len(m.consoleLines) > 0 {
					m.consoleSelected = len(m.consoleLines) - 1
				}
				m.refreshConsoleContent()
			case "c":
				if len(m.consoleLines) == 0 {
					m.appendLog("No logs to copy.")
					return m, nil
				}
				selected := m.consoleLines[m.consoleSelected]
				if err := copyToClipboard(selected); err != nil {
					m.appendLog("Copy failed: " + err.Error())
					return m, nil
				}
				m.copyNoticeID++
				m.copyNotice = "Copied to clipboard"
				return m, clearCopyNoticeCmd(m.copyNoticeID)
			case "Y":
				if len(m.logs) == 0 {
					m.appendLog("No logs to copy.")
					return m, nil
				}
				all := strings.Join(m.logs, "\n")
				if err := copyToClipboard(all); err != nil {
					m.appendLog("Copy failed: " + err.Error())
					return m, nil
				}
				m.appendLog("Copied all log lines to clipboard.")
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
					m.secretPickOpen = false
					m.variablePickerOpen = false
					m.secretPickAction = ""
					m.secretsWorkflowID = workflow.id
					m.secretsWorkflowName = workflow.title
					m.refreshSecretsMenu()
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
				return m, actionCmd(action.id, workflow.id, workflow.title)
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
	head := lipgloss.NewStyle().Bold(true).Render("六 6FLOW")
	subText := fmt.Sprintf(
		"user=%s  cre=%s  workflows=%d",
		m.user,
		creState,
		m.workflowCount,
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

func (m model) renderSecretFormPrompt() string {
	modeTitle := strings.ToUpper(m.secretFormMode)
	title := lipgloss.NewStyle().Bold(true).Render("Secrets " + modeTitle)
	noticeText := "Local simulation mode: updates only secrets.yaml and workflow .env."
	if m.secretFormMode == "update" {
		noticeText = "Update selected variable in local .env or project.yaml."
	}
	notice := lipgloss.NewStyle().Foreground(lipgloss.Color("11")).Render(noticeText)
	target := lipgloss.NewStyle().Foreground(lipgloss.Color("8")).Render(
		fmt.Sprintf("workflow: %s | target: %s", m.secretsWorkflowName, m.currentSecretsTarget()),
	)
	hints := "Enter submits. Esc cancels."
	if m.secretFormMode != "remove" && !m.secretIDLocked {
		hints = "Tab to switch fields. Enter on value submits. Esc cancels."
	}
	if m.secretIDLocked {
		hints = "Secret ID is selected from list. Enter submits. Esc cancels."
	}
	if m.secretFormMode == "update" {
		hints = "Variable is selected from list. Enter submits. Esc cancels."
	}
	if m.secretFormMode == "remove" {
		hints = "Enter clears local value. Press T to toggle removing from frontend config. Esc cancels."
	}
	hintsView := lipgloss.NewStyle().Foreground(lipgloss.Color("8")).Render(hints)

	secretIDLabel := "Secret ID"
	secretValueLabel := "Secret value"
	if m.secretFormMode == "update" {
		secretIDLabel = "Variable"
		secretValueLabel = "Value"
	}
	if m.secretFormMode != "remove" && !m.secretIDLocked {
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
	}
	if m.secretIDLocked {
		lines = append(lines, lipgloss.NewStyle().Foreground(lipgloss.Color("14")).Render(m.secretIDInput.Value()))
	} else {
		lines = append(lines, m.secretIDInput.View())
	}
	if m.secretFormMode != "remove" {
		lines = append(lines, "", secretValueLabel, m.secretValueInput.View())
	} else {
		removeMode := "OFF (default: clear local value only)"
		if m.secretRemoveFromConvex {
			removeMode = "ON (also remove from web)"
		}
		lines = append(lines, "", "Remove from web", removeMode)
	}
	lines = append(lines, hintsView)

	if strings.TrimSpace(m.secretFormError) != "" {
		lines = append(lines, lipgloss.NewStyle().Foreground(lipgloss.Color("9")).Render(m.secretFormError))
	}

	panel := paneStyle(true).Padding(1, 2).Width(max(70, m.width-2))
	return panel.Render(strings.Join(lines, "\n"))
}

func (m model) renderVariablePickerPrompt() string {
	title := lipgloss.NewStyle().Bold(true).Render("Update Value")
	subtitle := lipgloss.NewStyle().Foreground(lipgloss.Color("8")).Render(
		"Select from System Variables (left) or Environment Variables (right). Tab/Left/Right to switch panel, Enter to edit, Esc to close.",
	)

	systemList := m.systemVariableList
	environmentList := m.environmentVariableList
	panelWidth := max(90, m.width-2)
	listWidth := (panelWidth - 12) / 2
	listHeight := max(10, m.height/3)
	systemList.SetSize(listWidth, max(6, listHeight-2))
	environmentList.SetSize(listWidth, max(6, listHeight-2))
	systemList.Title = ""
	environmentList.Title = ""

	activeHeader := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("14")).
		Underline(true)
	inactiveHeader := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("8"))
	leftHeader := inactiveHeader.Render("System Variables")
	rightHeader := inactiveHeader.Render("Environment Variables")
	if m.variablePickerFocus == 0 {
		leftHeader = activeHeader.Render("System Variables")
	} else {
		rightHeader = activeHeader.Render("Environment Variables")
	}

	leftBody := lipgloss.JoinVertical(lipgloss.Left, leftHeader, systemList.View())
	rightBody := lipgloss.JoinVertical(lipgloss.Left, rightHeader, environmentList.View())
	leftStyle := lipgloss.NewStyle().Width(listWidth+2).Padding(0, 1)
	rightStyle := lipgloss.NewStyle().Width(listWidth+2).Padding(0, 1)
	lists := lipgloss.JoinHorizontal(
		lipgloss.Top,
		leftStyle.Render(leftBody),
		"  ",
		rightStyle.Render(rightBody),
	)

	panel := paneStyle(true).Padding(1, 2).Width(panelWidth)
	return panel.Render(lipgloss.JoinVertical(lipgloss.Left, title, subtitle, "", lists))
}

func (m model) View() string {
	if m.width == 0 || m.height == 0 {
		return "Loading..."
	}

	if m.phase != phaseReady {
		return lipgloss.JoinVertical(lipgloss.Left, m.headerView(), m.authView(), m.help.View(keys))
	}

	leftW := m.workflowList.Width() + 4
	rightW := m.console.Width

	wf := paneStyle(m.focus == focusWorkflows).Width(leftW).Render(m.workflowList.View())
	actionsPane := m.actionList.View()
	if m.secretsMenuOpen {
		if m.secretPickOpen {
			pickLabel := "secret"
			if m.secretPickAction == "update" {
				pickLabel = "variable"
			}
			m.secretPickList.Title = fmt.Sprintf("Pick %s for %s: %s (esc back)", pickLabel, strings.ToUpper(m.secretPickAction), m.secretsWorkflowName)
			actionsPane = m.secretPickList.View()
		} else {
			m.secretsMenu.Title = fmt.Sprintf("Secrets submenu: %s | target=%s (esc back)", m.secretsWorkflowName, m.currentSecretsTarget())
			actionsPane = m.secretsMenu.View()
		}
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
	buildRightCol := func(width int) string {
		if width < 10 {
			width = 10
		}
		return paneStyle(m.focus == focusConsole).Width(width).Render(consoleBody)
	}
	rightCol := buildRightCol(rightW)
	body := lipgloss.JoinHorizontal(lipgloss.Top, leftCol, rightCol)
	for lipgloss.Width(body) > m.width && rightW > 10 {
		rightW--
		rightCol = buildRightCol(rightW)
		body = lipgloss.JoinHorizontal(lipgloss.Top, leftCol, rightCol)
	}
	footer := m.help.View(keys)
	if m.focus == focusConsole {
		footer += lipgloss.NewStyle().Foreground(lipgloss.Color("8")).Render(" • c copy selected line")
	}
	if strings.TrimSpace(m.copyNotice) != "" {
		footer += " " + lipgloss.NewStyle().Foreground(lipgloss.Color("10")).Render("· "+m.copyNotice)
	}
	sections := []string{m.headerView(), body}
	if m.variablePickerOpen {
		sections = append(sections, m.renderVariablePickerPrompt())
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
