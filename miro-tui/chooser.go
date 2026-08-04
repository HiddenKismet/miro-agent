package main

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/HiddenKismet/miro-agent/miro-tui/ui"
)

// choiceItem is one selectable startup option.
type choiceItem struct {
	label string
	hint  string
	dir   string
	kind  string // "cwd" | "scratch" | "project" | "manual"
}

// humanTime renders a compact relative time for the hint line.
func humanTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	d := time.Since(t)
	switch {
	case d < time.Minute:
		return "刚刚"
	case d < time.Hour:
		return fmt.Sprintf("%d 分钟前", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%d 小时前", int(d.Hours()))
	default:
		return fmt.Sprintf("%d 天前", int(d.Hours()/24))
	}
}

// projectHint builds the context line for a project item.
func projectHint(p ui.Project) string {
	parts := []string{p.Dir}
	if p.Branch != "" {
		parts = append(parts, p.Branch)
	}
	if p.Dirty > 0 {
		parts = append(parts, fmt.Sprintf("●%d", p.Dirty))
	}
	if p.Remote != "" {
		parts = append(parts, p.Remote)
	}
	if when := humanTime(p.LastUsed); when != "" {
		parts = append(parts, when)
	}
	return strings.Join(parts, " · ")
}

// scratchDir is where 临时会话 (scratch) records live.
func scratchDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(os.TempDir(), "miro-scratch")
	}
	return filepath.Join(home, ".miro", "scratch")
}

func expandUser(p string) string {
	home, _ := os.UserHomeDir()
	if p == "~" {
		return home
	}
	if strings.HasPrefix(p, "~/") {
		return filepath.Join(home, p[2:])
	}
	return p
}

// chooserModel is a tiny bubbletea list for the startup picker.
type chooserModel struct {
	title    string
	items    []choiceItem
	selected int
}

func (m chooserModel) Init() tea.Cmd { return nil }

func (m chooserModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if msg, ok := msg.(tea.KeyMsg); ok {
		switch msg.String() {
		case "up", "k":
			m.selected--
			if m.selected < 0 {
				m.selected = len(m.items) - 1
			}
		case "down", "j":
			m.selected++
			if m.selected >= len(m.items) {
				m.selected = 0
			}
		case "enter":
			return m, tea.Quit
		case "esc", "q", "ctrl+c":
			m.selected = -1
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m chooserModel) View() string {
	var b strings.Builder
	b.WriteString("\n  " + m.title + "\n\n")
	for i, it := range m.items {
		mark := "  "
		style := lipgloss.NewStyle().Foreground(lipgloss.Color("240"))
		if i == m.selected {
			mark = "❯ "
			style = lipgloss.NewStyle().Foreground(lipgloss.Color("86"))
		}
		b.WriteString("  " + mark + it.label + "\n")
		if it.hint != "" {
			b.WriteString("    " + style.Render(it.hint) + "\n")
		}
	}
	b.WriteString("\n  ↑↓ 选择 · Enter 确认 · Esc 取消\n")
	return b.String()
}

// runChooser shows a full-screen list and returns the picked item (ok=false
// when the user cancels).
func runChooser(title string, items []choiceItem) (choiceItem, bool) {
	p := tea.NewProgram(chooserModel{title: title, items: items}, tea.WithAltScreen())
	m, err := p.Run()
	if err != nil {
		return choiceItem{}, false
	}
	cm := m.(chooserModel)
	if cm.selected < 0 || cm.selected >= len(items) {
		return choiceItem{}, false
	}
	return items[cm.selected], true
}

// resolveStartDir picks the working directory before the engine starts.
//
// Priority: --project <path> | --project=<path> > MIRO_PROJECT > interactive
// chooser (当前目录 / 临时会话 / 进入项目). Returns the chosen dir and the
// remaining args with any --project flag removed.
func resolveStartDir(args []string) (string, []string, error) {
	for i := 0; i < len(args); i++ {
		if args[i] == "--project" && i+1 < len(args) {
			rest := append(append([]string{}, args[:i]...), args[i+2:]...)
			return expandUser(args[i+1]), rest, nil
		}
		if strings.HasPrefix(args[i], "--project=") {
			p := strings.TrimPrefix(args[i], "--project=")
			rest := append(append([]string{}, args[:i]...), args[i+1:]...)
			return expandUser(p), rest, nil
		}
	}
	if p := os.Getenv("MIRO_PROJECT"); p != "" {
		return expandUser(p), args, nil
	}

	cwd, _ := os.Getwd()
	scratch := scratchDir()

	first := []choiceItem{}
	if ui.IsGitRepo(cwd) {
		branch, dirty, _ := ui.ProjectGitInfo(cwd)
		hint := cwd
		if branch != "" {
			hint += " · " + branch
		}
		if dirty > 0 {
			hint += fmt.Sprintf(" · ●%d", dirty)
		}
		first = append(first, choiceItem{label: "当前目录（在此项目）", hint: hint, dir: cwd, kind: "cwd"})
	}
	first = append(first,
		choiceItem{label: "临时会话 (scratch)", hint: scratch, dir: scratch, kind: "scratch"},
		choiceItem{label: "进入项目…", kind: "project"},
	)

	picked, ok := runChooser("✦ Miro ✦ Personal Agent · 选择工作目录", first)
	if !ok {
		return "", args, fmt.Errorf("已取消")
	}
	if picked.kind == "scratch" {
		if err := os.MkdirAll(scratch, 0o755); err != nil {
			return "", args, err
		}
		return scratch, args, nil
	}
	if picked.kind == "cwd" {
		return cwd, args, nil
	}

	projects := ui.ListProjects()
	items := make([]choiceItem, 0, len(projects)+1)
	for _, p := range projects {
		items = append(items, choiceItem{label: filepath.Base(p.Dir), hint: projectHint(p), dir: p.Dir, kind: "project"})
	}
	items = append(items, choiceItem{label: "手动输入路径…", kind: "manual"})
	p2, ok2 := runChooser("进入项目", items)
	if !ok2 {
		return "", args, fmt.Errorf("已取消")
	}
	if p2.kind == "manual" {
		fmt.Print("  项目路径: ")
		r := bufio.NewReader(os.Stdin)
		line, err := r.ReadString('\n')
		if err != nil {
			return "", args, err
		}
		p2.dir = expandUser(strings.TrimSpace(line))
	}
	if p2.dir == "" {
		return "", args, fmt.Errorf("未提供项目路径")
	}
	return p2.dir, args, nil
}
