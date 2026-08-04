package ui

import (
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/charmbracelet/bubbles/textarea"
)

// SlashCommand is one known command offered by the autocomplete menu.
type SlashCommand struct {
	Name string // without the leading "/"
	Desc string
}

// known commands: Miro built-ins + extension packages + pi core commands.
// Commands are executed by the pi kernel: sending "/name" as a prompt runs
// the extension command (docs/rpc.md: extension commands execute immediately).
var knownSlashCommands = []SlashCommand{
	{Name: "web", Desc: "打开 Miro Web 浏览器界面"},
	{Name: "web-stop", Desc: "停止 Miro Web"},
	{Name: "project", Desc: "进入项目目录（输入 /project <路径> 直接进入）"},
	{Name: "task", Desc: "管理工作流任务"},
	{Name: "goal", Desc: "设定/审计目标"},
	{Name: "list", Desc: "查看列表队列"},
	{Name: "loop", Desc: "循环优化目标"},
	{Name: "run", Desc: "运行子代理"},
	{Name: "parallel", Desc: "并行子代理"},
	{Name: "model", Desc: "切换模型"},
	{Name: "settings", Desc: "打开设置"},
	{Name: "compact", Desc: "压缩上下文"},
	{Name: "new", Desc: "开始新会话"},
	{Name: "name", Desc: "给会话命名"},
	{Name: "resume", Desc: "恢复历史会话"},
	{Name: "tree", Desc: "查看消息树"},
	{Name: "export", Desc: "导出当前会话"},
	{Name: "login", Desc: "配置凭据/登录"},
	{Name: "clear", Desc: "清空界面"},
	{Name: "help", Desc: "查看帮助"},
}

// slashMenuState tracks the open autocomplete menu.
type slashMenuState struct {
	active   bool
	filter   string // text after the "/"
	selected int
	matches  []SlashCommand
}

func (m *slashMenuState) reset() {
	m.active = false
	m.filter = ""
	m.selected = 0
	m.matches = nil
}

// update recomputes the menu from the current input text.
// A menu opens when the input starts with "/" and is still open while the
// filter text changes; it closes when the input no longer starts with "/".
func (m *slashMenuState) update(text string) {
	if !strings.HasPrefix(text, "/") {
		m.reset()
		return
	}
	m.active = true
	m.filter = strings.TrimPrefix(text, "/")
	// only autocomplete the first token
	if i := strings.IndexAny(m.filter, " \t"); i >= 0 {
		m.filter = m.filter[:i]
	}
	matches := []SlashCommand{}
	for _, c := range knownSlashCommands {
		if strings.HasPrefix(c.Name, m.filter) {
			matches = append(matches, c)
		}
	}
	m.matches = matches
	if m.selected >= len(m.matches) {
		m.selected = len(m.matches) - 1
	}
	if m.selected < 0 && len(m.matches) > 0 {
		m.selected = 0
	}
}

// complete replaces the current token with the selected command + space.
func (m *slashMenuState) complete(ta *textarea.Model) {
	if len(m.matches) == 0 {
		return
	}
	sel := m.matches[m.selected]
	text := ta.Value()
	// replace the token after the "/"
	rest := ""
	if i := strings.IndexAny(text, " \t"); i >= 0 {
		rest = text[i:]
	}
	ta.SetValue("/" + sel.Name + " " + rest)
	ta.CursorEnd()
}

// maxPathSuggestions caps the inline "/project <path>" autocomplete list.
const maxPathSuggestions = 8

// PathSuggestion is one candidate in the "/project <path>" autocomplete.
type PathSuggestion struct {
	Path string // fully resolved directory to enter
	Hint string // context hint for known projects (branch · dirty · remote)
}

// pathMenuState is the live autocomplete menu shown while typing a path
// argument after "/project " in the input. Candidates combine fuzzy matches
// over known projects with a scan of the typed prefix's parent directory.
type pathMenuState struct {
	active   bool
	filter   string // the text after "/project "
	selected int
	matches  []PathSuggestion
}

func (m *pathMenuState) reset() {
	m.active = false
	m.filter = ""
	m.selected = 0
	m.matches = nil
}

// update recomputes the menu from the current input text. It activates only
// while the input is "/project <non-empty path>"; any other input closes it.
func (m *pathMenuState) update(text string, projects []Project) {
	m.reset()
	if !strings.HasPrefix(text, "/project ") {
		return
	}
	f := strings.TrimSpace(strings.TrimPrefix(text, "/project"))
	if f == "" {
		return
	}
	m.filter = f
	m.active = true

	type hit struct {
		s     PathSuggestion
		score int
	}
	var hits []hit
	seen := map[string]bool{}
	add := func(path, hint string, score int) {
		if seen[path] {
			return
		}
		seen[path] = true
		hits = append(hits, hit{PathSuggestion{Path: path, Hint: hint}, score})
	}
	for _, pr := range projects {
		if ok, s := FuzzyMatch(f, pr.Dir); ok {
			add(pr.Dir, ProjectHint(pr), s)
		}
	}
	for _, d := range scanPathPrefix(f, maxPathSuggestions) {
		if ok, s := FuzzyMatch(f, d.path); ok {
			add(d.path, "", d.score+s)
		}
	}
	sort.SliceStable(hits, func(i, j int) bool { return hits[i].score > hits[j].score })
	if len(hits) > maxPathSuggestions {
		hits = hits[:maxPathSuggestions]
	}
	m.matches = make([]PathSuggestion, 0, len(hits))
	for _, h := range hits {
		m.matches = append(m.matches, h.s)
	}
}

// complete replaces the path argument after "/project " with the selected
// candidate's full path and moves the cursor to the end.
func (m *pathMenuState) complete(ta *textarea.Model) {
	if len(m.matches) == 0 || m.selected < 0 || m.selected >= len(m.matches) {
		return
	}
	ta.SetValue("/project " + m.matches[m.selected].Path + " ")
	ta.CursorEnd()
}

// pathHit is one filesystem completion candidate from scanPathPrefix.
type pathHit struct {
	path  string
	score int
}

// scanPathPrefix lists directories whose names fuzzy-match the trailing
// fragment of p, under p's literal parent directory ("~" expanded; relative
// paths resolved against the current directory). Only directories are
// returned, sorted best match first, capped at limit.
func scanPathPrefix(p string, limit int) []pathHit {
	e := expandUserPath(p)
	if e == "" {
		return nil
	}
	dir := filepath.Dir(e)
	frag := filepath.Base(e)
	if frag == "" || frag == "." || frag == string(filepath.Separator) {
		return nil
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var hits []pathHit
	for _, en := range entries {
		if !en.IsDir() {
			continue
		}
		if ok, s := FuzzyMatch(frag, en.Name()); ok {
			hits = append(hits, pathHit{path: filepath.Join(dir, en.Name()), score: s})
		}
	}
	sort.Slice(hits, func(i, j int) bool { return hits[i].score > hits[j].score })
	if len(hits) > limit {
		hits = hits[:limit]
	}
	return hits
}
