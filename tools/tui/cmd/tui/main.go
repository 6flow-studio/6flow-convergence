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

type model struct {
	phase     appPhase
	authState authState
	token     string

	busy       bool
	lastSyncAt string
	user       string
	webBaseURL string

	width  int
	height int
	focus  focusPane

	workflowList list.Model
	actionList   list.Model
	console      viewport.Model
	help         help.Model
	spinner      spinner.Model

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
		actionItem{id: "refresh", title: "Sync", description: "Fetch workflows from frontend API"},
		actionItem{id: "simulate", title: "Simulate", description: "Mock run for selected workflow"},
		actionItem{id: "deploy", title: "Deploy", description: "Placeholder deploy flow"},
		actionItem{id: "secrets", title: "Manage secrets", description: "Placeholder secret flow"},
	}

	sp := spinner.New()
	sp.Spinner = spinner.Line

	v := viewport.New(40, 10)
	v.SetContent(withTimestamp(fmt.Sprintf("Frontend API mode enabled (%s).", base)) + "\n" + withTimestamp("Checking local authentication session..."))
	v.GotoBottom()

	return model{
		phase:        phaseCheckingAuth,
		authState:    authDisconnected,
		lastSyncAt:   "never",
		user:         user,
		webBaseURL:   base,
		focus:        focusWorkflows,
		workflowList: newList("Workflows", []list.Item{}),
		actionList:   newList("Actions", actions),
		console:      v,
		help:         help.New(),
		spinner:      sp,
		logs: []string{
			withTimestamp(fmt.Sprintf("Frontend API mode enabled (%s).", base)),
			withTimestamp("Checking local authentication session..."),
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
			logs = append(logs, "Deploy flow is placeholder-only in this iteration.")
			time.Sleep(250 * time.Millisecond)
			logs = append(logs, "Next phase: hook this action to CRE deploy API.")
		case "secrets":
			time.Sleep(300 * time.Millisecond)
			logs = append(logs, "Secret manager flow is placeholder-only in this iteration.")
			time.Sleep(250 * time.Millisecond)
			logs = append(logs, "Next phase: attach to frontend secret APIs.")
		}
		return actionFinishedMsg{logs: logs}
	}
}

func (m model) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, initSessionCmd())
}

func (m *model) appendLog(line string) {
	atBottom := m.console.AtBottom()
	m.logs = append(m.logs, withTimestamp(line))
	m.console.SetContent(strings.Join(m.logs, "\n"))
	if atBottom {
		m.console.GotoBottom()
	}
}

func (m *model) setWorkflows(items []core.FrontendWorkflow) {
	prev := ""
	if current, ok := m.workflowList.SelectedItem().(workflowItem); ok {
		prev = current.id
	}

	listItems := make([]list.Item, 0, len(items))
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
		})
		if item.ID == prev {
			selected = idx
		}
	}

	m.workflowList.SetItems(listItems)
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
	m.console.Width = rightW - 2
	m.console.Height = mainH - 2
}

func (m model) selectedWorkflow() *workflowItem {
	item, ok := m.workflowList.SelectedItem().(workflowItem)
	if !ok {
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
		return m, refreshWorkflowsCmd(m.webBaseURL, m.token)

	case actionFinishedMsg:
		for _, line := range msg.logs {
			m.appendLog(line)
		}
		if action := m.selectedAction(); action != nil {
			m.appendLog(fmt.Sprintf("Action %q completed.", action.title))
		}
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
				m.console.SetContent(strings.Join(m.logs, "\n"))
				m.console.GotoBottom()
			}
			return m, nil
		}

		if m.focus == focusWorkflows {
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
				if action.id == "refresh" {
					if strings.TrimSpace(m.token) == "" {
						m.phase = phaseAuthGate
						m.authState = authDisconnected
						m.appendLog("No active session. Please log in first.")
						return m, nil
					}
					m.busy = true
					m.appendLog("Refreshing workflows from frontend API...")
					return m, refreshWorkflowsCmd(m.webBaseURL, m.token)
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
	head := lipgloss.NewStyle().Bold(true).Render("6FLOW TUI")
	sub := lipgloss.NewStyle().Foreground(lipgloss.Color("8")).Render(
		fmt.Sprintf("user=%s  mode=frontend-api  auth=%s  workflows=%d  last_sync=%s", m.user, state, len(m.workflowList.Items()), m.lastSyncAt),
	)
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
	ac := paneStyle(m.focus == focusActions).Width(leftW).Render(m.actionList.View())
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
	return lipgloss.JoinVertical(lipgloss.Left, m.headerView(), body, footer)
}

func main() {
	p := tea.NewProgram(initialModel(), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
