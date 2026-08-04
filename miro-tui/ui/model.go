package ui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/HiddenKismet/miro-agent/miro-tui/rpc"
)

type lineKind int

const (
	kindUser lineKind = iota
	kindAssistant
	kindTool
	kindInfo
)

type chatLine struct {
	kind lineKind
	text string
}

// Model is the root bubbletea model.
type Model struct {
	client *rpc.Client

	width  int
	height int

	lines    []chatLine
	viewport viewport.Model
	textarea textarea.Model
	spinner  spinner.Model

	menu slashMenuState

	// session picker for /resume
	picker *sessionPickerState

	busy        bool
	err         error
	cwd         string
	sessionName string
}

// sessionPickerState renders the historical-session chooser.
type sessionPickerState struct {
	active   bool
	sessions []Session
	selected int
}

// switchResultMsg reports the outcome of a session switch / new session.
type switchResultMsg struct {
	label     string
	err       error
	cancelled bool
}

// RPCMsg carries one pi RPC event into the bubbletea loop.
type RPCMsg struct{ Evt rpc.Event }

// ExitMsg signals that the pi subprocess has terminated.
type ExitMsg struct{}

// New creates the root model.
func New(client *rpc.Client) Model {
	ta := textarea.New()
	ta.Placeholder = "Ask Miro anything… (Enter to send)"
	ta.Focus()
	ta.SetHeight(1)
	ta.ShowLineNumbers = false
	ta.Prompt = "❯ "

	sp := spinner.New()
	sp.Spinner = spinner.Points
	sp.Style = lipgloss.NewStyle().Foreground(colorAccent)

	return Model{
		client:   client,
		lines:    []chatLine{{kind: kindInfo, text: "✦ Miro · Let Miro sort your mind"}},
		textarea: ta,
		spinner:  sp,
	}
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(
		textarea.Blink,
		m.spinner.Tick,
	)
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.viewport.Width = msg.Width
		m.viewport.Height = msg.Height - 6 // header + input + footer
		if m.viewport.Height < 3 {
			m.viewport.Height = 3
		}

	case tea.KeyMsg:
		// session picker keys take top priority
		if m.picker != nil && m.picker.active {
			switch msg.String() {
			case "up":
				m.picker.selected--
				if m.picker.selected < 0 {
					m.picker.selected = len(m.picker.sessions) - 1
				}
				return m, nil
			case "down":
				m.picker.selected++
				if m.picker.selected >= len(m.picker.sessions) {
					m.picker.selected = 0
				}
				return m, nil
			case "enter":
				return m, m.selectSessionCmd()
			case "esc", "ctrl+c":
				m.picker.active = false
				m.picker = nil
				return m, nil
			default:
				return m, nil // swallow other keys while picking
			}
		}
		// slash-command menu keys take priority while the menu is open
		if m.menu.active && len(m.menu.matches) > 0 {
			switch msg.String() {
			case "up":
				m.menu.selected--
				if m.menu.selected < 0 {
					m.menu.selected = len(m.menu.matches) - 1
				}
				return m, nil
			case "down":
				m.menu.selected++
				if m.menu.selected >= len(m.menu.matches) {
					m.menu.selected = 0
				}
				return m, nil
			case "tab":
				m.menu.complete(&m.textarea)
				m.menu.update(m.textarea.Value())
				return m, nil
			case "esc":
				m.menu.reset()
				return m, nil
			}
		}
		switch msg.String() {
		case "ctrl+d":
			return m, tea.Quit
		case "ctrl+c", "esc":
			if m.busy {
				_ = m.client.Abort()
				m.lines = append(m.lines, chatLine{kind: kindInfo, text: "■ interrupted"})
			} else if msg.String() == "ctrl+c" {
				return m, tea.Quit
			}
		case "enter":
			text := strings.TrimSpace(m.textarea.Value())
			if text == "" {
				return m, nil
			}

			// /resume → open the session picker instead of sending
			if text == "/resume" || strings.HasPrefix(text, "/resume ") {
				sessions := ListSessions()
				if len(sessions) == 0 {
					m.lines = append(m.lines, chatLine{kind: kindInfo, text: "⚠ 没有找到历史会话"})
					m.textarea.SetValue("")
					return m, nil
				}
				m.picker = &sessionPickerState{active: true, sessions: sessions}
				m.menu.reset()
				m.textarea.SetValue("")
				return m, nil
			}

			// /new → RPC new_session, not a plain prompt
			if text == "/new" {
				m.textarea.SetValue("")
				m.lines = append(m.lines, chatLine{kind: kindInfo, text: "↻ 新会话…"})
				return m, func() tea.Msg {
					resp, err := m.client.CallTimeout(map[string]any{"type": "new_session"}, 15*time.Second)
					if err != nil {
						return switchResultMsg{label: "/new", err: err}
					}
					cancelled, _ := resp["data"].(map[string]any)["cancelled"].(bool)
					return switchResultMsg{label: "/new", cancelled: cancelled}
				}
			}

			m.lines = append(m.lines, chatLine{kind: kindUser, text: text})
			m.textarea.SetValue("")
			m.busy = true
			if err := m.client.SendUserMessage(text); err != nil {
				m.err = err
				m.busy = false
			}
			return m, nil
		}

	case switchResultMsg:
		if msg.err != nil {
			m.err = msg.err
		} else if msg.cancelled {
			m.lines = append(m.lines, chatLine{kind: kindInfo, text: "↷ 切换已取消"})
		} else {
			m.lines = append(m.lines, chatLine{kind: kindInfo, text: "✓ " + msg.label})
			m.busy = false
		}

	case RPCMsg:
		m.handleRPC(msg.Evt)

	case ExitMsg:
		m.err = fmt.Errorf("pi subprocess exited")
		m.busy = false
		return m, tea.Quit

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		cmds = append(cmds, cmd)
	}

	var cmd tea.Cmd
	m.textarea, cmd = m.textarea.Update(msg)
	cmds = append(cmds, cmd)
	m.menu.update(m.textarea.Value())
	m.viewport, cmd = m.viewport.Update(msg)
	cmds = append(cmds, cmd)
	m.refreshViewport()

	return m, tea.Batch(cmds...)
}

// selectSessionCmd switches to the picked session via the RPC protocol.
func (m *Model) selectSessionCmd() tea.Cmd {
	if m.picker == nil || len(m.picker.sessions) == 0 {
		return nil
	}
	if m.picker.selected < 0 || m.picker.selected >= len(m.picker.sessions) {
		return nil
	}
	sel := m.picker.sessions[m.picker.selected]
	label := sel.Name
	if label == "" {
		label = sel.Path
	}
	m.picker.active = false
	m.picker = nil
	m.lines = append(m.lines, chatLine{kind: kindInfo, text: "↻ 切换会话: " + label})

	return func() tea.Msg {
		resp, err := m.client.CallTimeout(map[string]any{
			"type":        "switch_session",
			"sessionPath": sel.Path,
		}, 20*time.Second)
		if err != nil {
			return switchResultMsg{label: label, err: err}
		}
		cancelled := false
		if data, ok := resp["data"].(map[string]any); ok {
			cancelled, _ = data["cancelled"].(bool)
		}
		return switchResultMsg{label: label, cancelled: cancelled}
	}
}

// refreshViewport rebuilds the message pane from the current lines.
// Must run inside Update: View() has a value receiver, so mutations there
// would be discarded.
func (m *Model) refreshViewport() {
	var b strings.Builder
	for _, l := range m.lines {
		switch l.kind {
		case kindUser:
			b.WriteString(styleUserPrefix.Render("❯ ") + l.text)
		case kindAssistant:
			b.WriteString("  " + l.text)
		case kindTool:
			b.WriteString("  " + styleToolRun.Render(l.text))
		case kindInfo:
			b.WriteString(styleHeaderText.Render(l.text))
		}
		b.WriteString("\n")
	}
	if m.busy {
		b.WriteString("  " + m.spinner.View() + "\n")
	}
	m.viewport.SetContent(b.String())
	m.viewport.GotoBottom()
}

func (m *Model) handleRPC(evt rpc.Event) {
	switch evt.Type {
	case "session_info", "session":
		if name, ok := evt.Data["name"].(string); ok && name != "" {
			m.sessionName = name
		}
	case "message_start":
		msg, _ := evt.Data["message"].(map[string]any)
		if msg == nil {
			return
		}
		role, _ := msg["role"].(string)
		if role == "user" {
			// already echoed optimistically on send
			return
		}
	case "message_update":
		// streaming partial arrives under assistantMessageEvent.partial
		msg, _ := evt.Data["message"].(map[string]any)
		if msg == nil {
			if ame, ok := evt.Data["assistantMessageEvent"].(map[string]any); ok {
				msg, _ = ame["partial"].(map[string]any)
			}
		}
		if msg == nil {
			return
		}
		if role, _ := msg["role"].(string); role == "assistant" {
			text := extractText(msg)
			tools := extractToolSummary(msg)
			m.replaceAssistant(text, tools)
		}
	case "message_end":
		m.busy = false
	case "agent_settled":
		m.busy = false
	case "agent_start":
		m.busy = true
	case "tool_execution_start":
		if name, ok := evt.Data["toolName"].(string); ok {
			m.lines = append(m.lines, chatLine{kind: kindTool, text: "◐ " + name + " …"})
		}
	case "tool_execution_end":
		// status marker handled on next message_update
	case "extension_ui_request":
		if method, _ := evt.Data["method"].(string); method == "notify" {
			if text, ok := evt.Data["message"].(string); ok && text != "" {
				m.lines = append(m.lines, chatLine{kind: kindInfo, text: text})
			}
		}
	case "extension_error", "server_error":
		if msg, ok := evt.Data["message"].(string); ok {
			m.err = fmt.Errorf("%s", msg)
		}
	}
}

// replaceAssistant updates (or appends) the trailing assistant block.
func (m *Model) replaceAssistant(text string, tools []string) {
	block := []chatLine{}
	for _, t := range tools {
		block = append(block, chatLine{kind: kindTool, text: t})
	}
	if strings.TrimSpace(text) != "" {
		for _, l := range strings.Split(strings.TrimRight(text, "\n"), "\n") {
			block = append(block, chatLine{kind: kindAssistant, text: l})
		}
	}
	if len(block) == 0 {
		return
	}

	// remove previous trailing assistant/tool lines from the current turn
	i := len(m.lines)
	for i > 0 {
		k := m.lines[i-1].kind
		if k == kindAssistant || k == kindTool {
			i--
			continue
		}
		break
	}
	m.lines = append(m.lines[:i], block...)
}

func (m Model) View() string {
	if m.width == 0 {
		return "loading…"
	}

	// header
	title := styleHeader.Render("✦ Miro")
	meta := styleHeaderText.Render(fmt.Sprintf("  %s", m.sessionName))
	header := lipgloss.JoinHorizontal(lipgloss.Left, title, meta)

	// message pane
	m.viewport.GotoBottom()

	// session picker
	picker := ""
	if m.picker != nil && m.picker.active && len(m.picker.sessions) > 0 {
		items := make([]string, 0, len(m.picker.sessions)+1)
		header := lipgloss.NewStyle().Foreground(colorAccent).Bold(true).Render("会话历史 — ↑↓ 选择 · Enter 恢复 · Esc 取消")
		items = append(items, header)
		show := m.picker.sessions
		if len(show) > 9 {
			show = show[:9]
		}
		for i, s := range show {
			prefix := "  "
			style := lipgloss.NewStyle().Foreground(colorMuted)
			if i == m.picker.selected {
				prefix = "❯ "
				style = lipgloss.NewStyle().Foreground(colorAccent).Bold(true)
			}
			name := s.Name
			if name == "" {
				name = s.Path
			}
			preview := []rune(s.Preview)
			if len(preview) > 42 {
				preview = append(preview[:42], []rune("…")...)
			}
			ts := s.ModTime.Format("01-02 15:04")
			line := style.Render(prefix+name) +
				" " + lipgloss.NewStyle().Foreground(colorDim).Render(string(preview)+" · "+ts)
			items = append(items, line)
		}
		picker = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(colorAccent).
			Width(m.width - 4).
			Padding(0, 1).
			Render(strings.Join(items, "\n")) + "\n"
	}

	// slash-command menu
	menu := ""
	if m.menu.active && len(m.menu.matches) > 0 {
		lines := make([]string, 0, len(m.menu.matches))
		for i, c := range m.menu.matches {
			prefix := "  "
			style := lipgloss.NewStyle().Foreground(colorMuted)
			if i == m.menu.selected {
				prefix = "❯ "
				style = lipgloss.NewStyle().Foreground(colorAccent).Bold(true)
			}
			lines = append(lines, style.Render(prefix+"/"+c.Name)+" "+lipgloss.NewStyle().Foreground(colorDim).Render(c.Desc))
		}
		menu = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(colorBorder).
			Width(m.width - 4).
			Padding(0, 1).
			Render(strings.Join(lines, "\n")) + "\n"
	}

	// input + footer
	input := styleInputBox.Width(m.width - 4).Render(m.textarea.View())
	footer := styleFooter.Render(fmt.Sprintf("⌃C interrupt   ⌃D quit   • Miro TUI v0.1.0"))

	return lipgloss.JoinVertical(lipgloss.Left,
		header,
		m.viewport.View(),
		picker,
		menu,
		input,
		footer,
	)
}

// extractText joins all text blocks of a message's content.
func extractText(msg map[string]any) string {
	content, _ := msg["content"].([]any)
	parts := []string{}
	for _, c := range content {
		block, ok := c.(map[string]any)
		if !ok {
			continue
		}
		if t, _ := block["type"].(string); t == "text" {
			if s, ok := block["text"].(string); ok {
				parts = append(parts, s)
			}
		}
	}
	return strings.Join(parts, "\n")
}

// extractToolSummary lists toolCall blocks as "▣ name" lines.
func extractToolSummary(msg map[string]any) []string {
	content, _ := msg["content"].([]any)
	out := []string{}
	for _, c := range content {
		block, ok := c.(map[string]any)
		if !ok {
			continue
		}
		if t, _ := block["type"].(string); t == "toolCall" {
			name, _ := block["name"].(string)
			if name == "" {
				name = "tool"
			}
			out = append(out, "▣ "+name)
		}
	}
	return out
}

