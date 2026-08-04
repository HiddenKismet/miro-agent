package ui

import (
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
