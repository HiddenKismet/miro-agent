package ui

import (
	"fmt"
	"path/filepath"
	"sort"
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
	kindThinking
	kindInfo
	kindBanner
)

type chatLine struct {
	kind   lineKind
	text   string
	toolID string
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

	// task board overlay for /kanban
	board *taskBoardState

	// project picker overlay for /project
	ppicker *projectPickerState

	// inline path autocomplete for "/project <path>" typed directly
	pmenu *pathMenuState

	// cached project list for the picker and the inline path autocomplete
	// (project discovery shells out to git, so it must not run per keystroke)
	projectsCache   []Project
	projectsCacheAt time.Time

	// when set, the TUI quits and main relaunches with --project <dir>
	relaunchDir string

	// tool status badges: toolCallId → "running" | "ok" | "error"
	toolStatus map[string]string

	busy        bool
	err         error
	cwd         string
	sessionName string

	// timestamp of the most recent Ctrl+C press (double-press-to-quit)
	ctrlCAt time.Time

	// cached, width-centered colored startup banner
	banner      string
	bannerWidth int
}

// A single Ctrl+C interrupts the current task; two presses within this
// window exit the TUI.
const ctrlCQuitWindow = 1200 * time.Millisecond

// fullBannerMinHeight leaves room for the header, six-row logo, greeting,
// input, and footer. Below this height, rendering the full logo would make
// the terminal clip its bottom rows and look like a broken banner.
const fullBannerMinHeight = 12

// sessionPickerState renders the historical-session chooser.
type sessionPickerState struct {
	active   bool
	sessions []Session
	selected int
}

// projectPickerState is the /project chooser overlay (fuzzy-filtered list of
// git repositories with context hints). Selecting one relaunches the TUI into
// that directory.
type projectPickerState struct {
	active   bool
	all      []Project
	items    []Project
	filter   []rune
	selected int
}

func (m *Model) ppRecalc() {
	if m.ppicker == nil {
		return
	}
	q := string(m.ppicker.filter)
	m.ppicker.items = m.ppicker.all
	if strings.TrimSpace(q) != "" {
		type hit struct {
			p     Project
			score int
		}
		var hits []hit
		for _, p := range m.ppicker.all {
			if ok, s := FuzzyMatch(q, p.Dir); ok {
				hits = append(hits, hit{p, s})
			}
		}
		sort.SliceStable(hits, func(i, j int) bool { return hits[i].score > hits[j].score })
		m.ppicker.items = make([]Project, 0, len(hits))
		for _, h := range hits {
			m.ppicker.items = append(m.ppicker.items, h.p)
		}
	}
	if m.ppicker.selected >= len(m.ppicker.items) {
		m.ppicker.selected = len(m.ppicker.items) - 1
	}
	if m.ppicker.selected < 0 && len(m.ppicker.items) > 0 {
		m.ppicker.selected = 0
	}
}

// knownProjects returns the cached project list, refreshing it when missing
// or stale. ListProjects shells out to git per repository, so it must not
// run on every keystroke.
func (m *Model) knownProjects() []Project {
	if m.projectsCache != nil && time.Since(m.projectsCacheAt) < 60*time.Second {
		return m.projectsCache
	}
	m.projectsCache = ListProjects()
	m.projectsCacheAt = time.Now()
	return m.projectsCache
}

// RelaunchDir returns the directory to relaunch into, or "" for a normal exit.
func (m Model) RelaunchDir() string { return m.relaunchDir }

// switchResultMsg reports the outcome of a session switch / new session.
type switchResultMsg struct {
	label     string
	err       error
	cancelled bool
}

// RPCMsg carries one engine RPC event into the bubbletea loop.
type RPCMsg struct{ Evt rpc.Event }

// ExitMsg signals that the engine subprocess has terminated.
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
		client: client,
		lines: []chatLine{
			{kind: kindBanner, text: miroBanner},
			{kind: kindInfo, text: "✦ Miro · Let Miro sort your mind"},
		},
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
			case "esc":
				m.picker.active = false
				m.picker = nil
				return m, nil
			case "ctrl+c":
				m.picker.active = false
				m.picker = nil
				m.ctrlCAt = time.Now() // count as the first press of a double-tap
				return m, nil
			default:
				return m, nil // swallow other keys while picking
			}
		}
		// task board overlay keys take priority next
		if m.board != nil && m.board.active {
			switch msg.String() {
			case "up":
				idx := m.board.selected
				for {
					idx--
					if idx < 0 {
						idx = len(m.board.rows) - 1
					}
					if !m.board.rows[idx].header {
						break
					}
				}
				m.board.selected = idx
				return m, nil
			case "down":
				idx := m.board.selected
				for {
					idx++
					if idx >= len(m.board.rows) {
						idx = 0
					}
					if !m.board.rows[idx].header {
						break
					}
				}
				m.board.selected = idx
				return m, nil
			case "enter":
				ri := m.board.rows[m.board.selected]
				if ri.header || ri.idx < 0 || ri.idx >= len(m.board.tasks) {
					return m, nil
				}
				task := m.board.tasks[ri.idx]
				text := "继续任务 " + task.ID
				m.board.active = false
				m.board = nil
				m.lines = append(m.lines, chatLine{kind: kindUser, text: text})
				m.textarea.SetValue("")
				m.busy = true
				if err := m.client.SendUserMessage(text); err != nil {
					m.err = err
					m.busy = false
				}
				return m, nil
			case "esc", "ctrl+c":
				m.board.active = false
				m.board = nil
				m.ctrlCAt = time.Now()
				return m, nil
			default:
				return m, nil // swallow other keys while the board is open
			}
		}
		// project picker overlay keys take priority next
		if m.ppicker != nil && m.ppicker.active {
			switch msg.String() {
			case "up", "k":
				if len(m.ppicker.items) > 0 {
					m.ppicker.selected--
					if m.ppicker.selected < 0 {
						m.ppicker.selected = len(m.ppicker.items) - 1
					}
				}
				return m, nil
			case "down", "j":
				if len(m.ppicker.items) > 0 {
					m.ppicker.selected++
					if m.ppicker.selected >= len(m.ppicker.items) {
						m.ppicker.selected = 0
					}
				}
				return m, nil
			case "enter":
				if len(m.ppicker.items) > 0 && m.ppicker.selected >= 0 {
					m.relaunchDir = m.ppicker.items[m.ppicker.selected].Dir
				} else if f := strings.TrimSpace(string(m.ppicker.filter)); f != "" {
					m.relaunchDir = expandUserPath(f) // no match: typed text as a path
				}
				m.ppicker.active = false
				m.ppicker = nil
				if m.relaunchDir != "" {
					return m, tea.Quit
				}
				return m, nil
			case "esc", "ctrl+c":
				m.ppicker.active = false
				m.ppicker = nil
				m.ctrlCAt = time.Now()
				return m, nil
			default:
				if len(msg.Runes) > 0 {
					m.ppicker.filter = append(m.ppicker.filter, msg.Runes...)
					m.ppRecalc()
				} else if msg.String() == "backspace" && len(m.ppicker.filter) > 0 {
					m.ppicker.filter = m.ppicker.filter[:len(m.ppicker.filter)-1]
					m.ppRecalc()
				}
				return m, nil
			}
		}
		// inline path autocomplete for "/project <path>" — selection keys take
		// priority; other keys fall through to the textarea so the menu can be
		// recomputed from the updated input below
		if m.pmenu != nil && m.pmenu.active {
			switch msg.String() {
			case "up", "k":
				if len(m.pmenu.matches) > 0 {
					m.pmenu.selected--
					if m.pmenu.selected < 0 {
						m.pmenu.selected = len(m.pmenu.matches) - 1
					}
				}
				return m, nil
			case "down", "j":
				if len(m.pmenu.matches) > 0 {
					m.pmenu.selected++
					if m.pmenu.selected >= len(m.pmenu.matches) {
						m.pmenu.selected = 0
					}
				}
				return m, nil
			case "tab":
				if len(m.pmenu.matches) > 0 {
					m.pmenu.complete(&m.textarea)
				}
				m.pmenu.active = false
				return m, nil
			case "esc":
				m.pmenu.active = false
				return m, nil
			case "enter":
				m.pmenu.active = false
				if len(m.pmenu.matches) > 0 && m.pmenu.selected >= 0 {
					m.relaunchDir = m.pmenu.matches[m.pmenu.selected].Path
					m.textarea.SetValue("")
					return m, tea.Quit
				}
				// no match: fall through to the normal /project handling below
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
		case "ctrl+c":
			// one press interrupts the current task; two quick presses exit
			now := time.Now()
			if !m.ctrlCAt.IsZero() && now.Sub(m.ctrlCAt) < ctrlCQuitWindow {
				return m, tea.Quit
			}
			m.ctrlCAt = now
			if m.busy {
				_ = m.client.Abort()
				m.lines = append(m.lines, chatLine{kind: kindInfo, text: "■ interrupted · ⌃C 再按一次退出"})
				m.busy = false
			} else {
				m.lines = append(m.lines, chatLine{kind: kindInfo, text: "⌃C 再按一次退出 · press ⌃C again to quit"})
			}
		case "esc":
			if m.busy {
				_ = m.client.Abort()
				m.lines = append(m.lines, chatLine{kind: kindInfo, text: "■ interrupted"})
				m.busy = false
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

			// /kanban → open the full-screen task board overlay instead of sending
			if text == "/kanban" || strings.HasPrefix(text, "/kanban ") {
				m.textarea.SetValue("")
				m.menu.reset()
				tasks := ListTasks()
				if len(tasks) == 0 {
					m.lines = append(m.lines, chatLine{kind: kindInfo, text: "⚠ 还没有任务（在对话里说「创建任务：…」即可提出）"})
					return m, nil
				}
				m.board = openTaskBoard(tasks)
				return m, nil
			}

			// /project → enter a specific directory (relaunch TUI into it)
			if text == "/project" || strings.HasPrefix(text, "/project ") {
				rest := strings.TrimSpace(strings.TrimPrefix(text, "/project"))
				m.textarea.SetValue("")
				m.menu.reset()
				if rest != "" {
					m.relaunchDir = expandUserPath(rest)
					return m, tea.Quit
				}
				projects := m.knownProjects()
				if len(projects) == 0 {
					m.lines = append(m.lines, chatLine{kind: kindInfo, text: "⚠ 没有找到项目（可输入 /project <路径> 直接进入）"})
					return m, nil
				}
				m.ppicker = &projectPickerState{active: true, all: projects}
				m.ppRecalc()
				return m, nil
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
		m.err = fmt.Errorf("engine subprocess exited")
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
	// inline path autocomplete: recompute whenever "/project <path>" is typed
	text := m.textarea.Value()
	if m.pmenu != nil && !strings.HasPrefix(text, "/project ") {
		m.pmenu.update("", nil)
	} else if strings.HasPrefix(text, "/project ") {
		if m.pmenu == nil {
			m.pmenu = &pathMenuState{}
		}
		m.pmenu.update(text, m.knownProjects())
	}
	m.viewport, cmd = m.viewport.Update(msg)
	cmds = append(cmds, cmd)
	m.layout()
	_, resizing := msg.(tea.WindowSizeMsg)
	m.refreshViewport(!resizing)

	return m, tea.Batch(cmds...)
}

// layout sizes the textarea and message viewport from the current terminal
// dimensions. The textarea must be sized explicitly: bubbles keeps its own
// internal width (default 80) otherwise, which makes input wrap long before
// the styled box edge.
func (m *Model) layout() {
	// textarea content width = box width (m.width-4) minus border(2) + padding(2)
	w := m.width - 8
	if w < 4 {
		w = 4
	}
	m.textarea.SetWidth(w)

	// auto-grow the input up to 8 lines as the text wraps, and shrink the
	// message pane to match so nothing overlaps.
	lines := wrappedLineCount(m.textarea.Value(), w)
	if lines < 1 {
		lines = 1
	}
	if lines > 8 {
		lines = 8
	}
	m.textarea.SetHeight(lines)

	m.viewport.Width = m.width
	h := m.height - 4 - lines // header(1) + footer(1) + input box
	if h < 3 {
		h = 3
	}
	m.viewport.Height = h
}

// wrappedLineCount counts how many screen rows `s` occupies when wrapped at
// `width` runes per line, respecting explicit newlines.
func wrappedLineCount(s string, width int) int {
	if width < 1 {
		width = 1
	}
	count := 0
	for _, line := range strings.Split(s, "\n") {
		n := len([]rune(line))
		if n == 0 {
			count++
			continue
		}
		count += (n + width - 1) / width
	}
	return count
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
func (m *Model) refreshViewport(scrollBottom ...bool) {
	wrapWidth := m.width - 6
	if wrapWidth < 10 {
		wrapWidth = 10
	}
	var b strings.Builder
	for _, l := range m.lines {
		switch l.kind {
		case kindUser:
			wrapped := wrapText(l.text, wrapWidth)
			b.WriteString(styleUserPrefix.Render("❯ ") + wrapped[0])
			for _, w := range wrapped[1:] {
				b.WriteString("\n  " + w)
			}
		case kindAssistant:
			b.WriteString("  " + strings.Join(wrapText(l.text, wrapWidth), "\n  "))
		case kindTool:
			badge := "◐"
			if l.toolID != "" {
				if st, ok := m.toolStatus[l.toolID]; ok {
					switch st {
					case "ok":
						badge = "✓"
					case "error":
						badge = "✗"
					}
				}
			}
			b.WriteString("  " + styleToolRun.Render(badge+" "+l.text))
		case kindThinking:
			// dim reasoning preview, truncated to one short line
			r := []rune(l.text)
			if len(r) > 88 {
				r = append(r[:88], []rune("…")...)
			}
			b.WriteString("  " + styleThinking.Render("▸ "+string(r)) + "\n")
		case kindInfo:
			b.WriteString(styleHeaderText.Render(l.text))
		case kindBanner:
			if m.height > 0 && m.height < fullBannerMinHeight {
				b.WriteString("✦ Miro\n")
			} else {
				b.WriteString(m.bannerView() + "\n")
			}
		}
		b.WriteString("\n")
	}
	if m.busy {
		b.WriteString("  " + m.spinner.View() + "\n")
	}
	m.viewport.SetContent(b.String())
	if len(scrollBottom) == 0 || scrollBottom[0] {
		m.viewport.GotoBottom()
	}
}

// bannerView returns the colored startup banner, re-rendered only when the
// terminal width changes (glyphs are colorized per-character, so it is cached).
func (m *Model) bannerView() string {
	if m.banner == "" || m.bannerWidth != m.width {
		m.banner = renderBanner(m.width)
		m.bannerWidth = m.width
	}
	return m.banner
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
			tools := m.extractToolSummary(msg)
			thinking := extractThinking(msg)
			m.replaceAssistant(text, tools, thinking)
		}
	case "message_end":
		m.busy = false
	case "agent_settled":
		m.busy = false
	case "agent_start":
		m.busy = true
	case "tool_execution_start":
		if id, ok := evt.Data["toolCallId"].(string); ok && id != "" {
			if m.toolStatus == nil {
				m.toolStatus = map[string]string{}
			}
			m.toolStatus[id] = "running"
			m.refreshViewport()
		}
	case "tool_execution_end":
		if id, ok := evt.Data["toolCallId"].(string); ok && id != "" {
			if m.toolStatus == nil {
				m.toolStatus = map[string]string{}
			}
			if isErr, _ := evt.Data["isError"].(bool); isErr {
				m.toolStatus[id] = "error"
			} else {
				m.toolStatus[id] = "ok"
			}
			m.refreshViewport()
		}
	case "extension_ui_request":
		if method, _ := evt.Data["method"].(string); method == "notify" {
			if text, ok := evt.Data["message"].(string); ok && text != "" && !suppressStartupNoise(text) {
				m.lines = append(m.lines, chatLine{kind: kindInfo, text: text})
			}
		}
	case "extension_error", "server_error":
		if msg, ok := evt.Data["message"].(string); ok {
			m.err = fmt.Errorf("%s", msg)
		}
	}
}

// suppressStartupNoise hides low-value informational notifications that
// third-party packages fire on every session start (the goal/loop package's
// provider note and its conversation-load wait), keeping the Miro startup
// screen clean. Informational only — the underlying behavior is unaffected.
func suppressStartupNoise(text string) bool {
	return strings.HasPrefix(text, "pi-goal-list-loop-audit: session provider") ||
		strings.HasPrefix(text, "glla: pi has not loaded a conversation yet")
}

// replaceAssistant updates (or appends) the trailing assistant block.
func (m *Model) replaceAssistant(text string, tools []chatLine, thinking string) {
	block := []chatLine{}
	if strings.TrimSpace(thinking) != "" {
		for _, l := range strings.Split(strings.TrimRight(thinking, "\n"), "\n") {
			block = append(block, chatLine{kind: kindThinking, text: l})
		}
	}
	block = append(block, tools...)
	if strings.TrimSpace(text) != "" {
		for _, l := range strings.Split(strings.TrimRight(text, "\n"), "\n") {
			block = append(block, chatLine{kind: kindAssistant, text: l})
		}
	}
	if len(block) == 0 {
		return
	}

	// remove previous trailing assistant/tool/thinking lines from the current turn
	i := len(m.lines)
	for i > 0 {
		k := m.lines[i-1].kind
		if k == kindAssistant || k == kindTool || k == kindThinking {
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
			Width(m.width-4).
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
			Width(m.width-4).
			Padding(0, 1).
			Render(strings.Join(lines, "\n")) + "\n"
	}

	// inline path autocomplete for "/project <path>"
	pathMenu := ""
	if m.pmenu != nil && m.pmenu.active && len(m.pmenu.matches) > 0 {
		lines := []string{
			lipgloss.NewStyle().Foreground(colorAccent).Bold(true).Render("路径联想 · ↑↓ 选择 · Tab 补全 · Enter 进入 · Esc 关闭"),
		}
		for i, s := range m.pmenu.matches {
			prefix := "   "
			style := lipgloss.NewStyle().Foreground(colorMuted)
			if i == m.pmenu.selected {
				prefix = " ❯ "
				style = lipgloss.NewStyle().Foreground(colorAccent).Bold(true)
			}
			line := style.Render(prefix + filepath.Base(s.Path))
			if s.Hint != "" {
				line += " " + lipgloss.NewStyle().Foreground(colorDim).Render(s.Hint)
			}
			lines = append(lines, line)
		}
		pathMenu = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(colorBorder).
			Width(m.width-4).
			Padding(0, 1).
			Render(strings.Join(lines, "\n")) + "\n"
	}

	// task board overlay (/kanban)
	board := ""
	if m.board != nil && m.board.active {
		bl := make([]string, 0, len(m.board.rows)+2)
		for ri, row := range m.board.rows {
			if row.header {
				bl = append(bl, lipgloss.NewStyle().Foreground(colorAccent).Bold(true).Render(" ▸ "+row.label))
				continue
			}
			t := m.board.tasks[row.idx]
			prefix := "   "
			style := lipgloss.NewStyle().Foreground(colorMuted)
			if ri == m.board.selected {
				prefix = " ❯ "
				style = lipgloss.NewStyle().Foreground(colorAccent).Bold(true)
			}
			meta := t.Branch
			if t.CommitCount > 0 {
				meta += fmt.Sprintf(" · %d commits", t.CommitCount)
			}
			if t.Uncommitted > 0 {
				meta += fmt.Sprintf(" · ●%d", t.Uncommitted)
			}
			if t.Repo != "" {
				meta += " · " + t.Repo
			}
			metaLine := lipgloss.NewStyle().Foreground(colorDim).Render(meta)
			bl = append(bl, style.Render(prefix+t.ID+"  "+t.Title)+" "+metaLine)
		}
		bl = append(bl, "")
		bl = append(bl, lipgloss.NewStyle().Foreground(colorDim).Render("Enter 继续该任务 · ↑↓ 选择 · Esc 关闭"))
		board = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(colorAccent).
			Width(m.width-4).
			Padding(0, 1).
			Render(strings.Join(bl, "\n")) + "\n"
	}

	// project picker overlay (/project)
	ppicker := ""
	if m.ppicker != nil && m.ppicker.active {
		pl := []string{"  > " + string(m.ppicker.filter) + "▏"}
		if len(m.ppicker.items) == 0 {
			pl = append(pl, lipgloss.NewStyle().Foreground(colorDim).Render("    （无匹配 · Enter 将输入作为路径）"))
		}
		for i, p := range m.ppicker.items {
			prefix := "   "
			style := lipgloss.NewStyle().Foreground(colorMuted)
			if i == m.ppicker.selected {
				prefix = " ❯ "
				style = lipgloss.NewStyle().Foreground(colorAccent).Bold(true)
			}
			pl = append(pl, style.Render(prefix+filepath.Base(p.Dir))+" "+lipgloss.NewStyle().Foreground(colorDim).Render(ProjectHint(p)))
		}
		pl = append(pl, "", lipgloss.NewStyle().Foreground(colorDim).Render("输入过滤（路径片段）· ↑↓ 选择 · Enter 进入 · Esc 取消"))
		ppicker = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(colorAccent).
			Width(m.width-4).
			Padding(0, 1).
			Render(strings.Join(pl, "\n")) + "\n"
	}

	// input + footer
	input := styleInputBox.Width(m.width - 4).Render(m.textarea.View())
	gitPart := ""
	if gm := gitMarker(); gm != "" {
		gitPart = "   " + lipgloss.NewStyle().Foreground(colorAccent).Render(gm)
	}
	footer := styleFooter.Render(fmt.Sprintf("⌃C 中断 · 连按两次退出   ⌃D quit%s   • Miro TUI v%s", gitPart, agentVersion()))

	return lipgloss.JoinVertical(lipgloss.Left,
		header,
		m.viewport.View(),
		picker,
		menu,
		pathMenu,
		board,
		ppicker,
		input,
		footer,
	)
}

// wrapText soft-wraps text to at most `width` runes per line, preserving
// existing newlines. Rune-based so CJK text wraps correctly.
func wrapText(text string, width int) []string {
	if width < 1 {
		width = 1
	}
	var out []string
	for _, line := range strings.Split(text, "\n") {
		if line == "" {
			out = append(out, "")
			continue
		}
		r := []rune(line)
		for len(r) > width {
			out = append(out, string(r[:width]))
			r = r[width:]
		}
		out = append(out, string(r))
	}
	return out
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

// extractToolSummary lists toolCall blocks as chatLine{kind: kindTool}.
// The status badge is applied at render time from m.toolStatus, so late
// tool_execution_end events update the badge without rebuilding the lines.
func (m *Model) extractToolSummary(msg map[string]any) []chatLine {
	content, _ := msg["content"].([]any)
	out := []chatLine{}
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
			id, _ := block["id"].(string)
			out = append(out, chatLine{kind: kindTool, text: name, toolID: id})
		}
	}
	return out
}

// extractThinking joins all thinking blocks (dimmed reasoning preview).
func extractThinking(msg map[string]any) string {
	content, _ := msg["content"].([]any)
	parts := []string{}
	for _, c := range content {
		block, ok := c.(map[string]any)
		if !ok {
			continue
		}
		if t, _ := block["type"].(string); t == "thinking" {
			if s, ok := block["thinking"].(string); ok && s != "" {
				parts = append(parts, s)
			}
		}
	}
	return strings.Join(parts, "\n")
}
