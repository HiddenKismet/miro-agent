package ui

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// BoardTask is one entry on the git-backed task board (mirrors the registry
// fields in ~/.miro/agent/tasks/<id>.json, enriched with git metadata).
type BoardTask struct {
	ID          string
	Title       string
	Stage       string
	Branch      string
	Cwd         string
	Repo        string
	CommitCount int
	Uncommitted int
	UpdatedAt   time.Time
}

// boardRow is one display row of the /kanban overlay: a stage header or a task.
type boardRow struct {
	header bool
	label  string
	idx    int
}

// taskBoardState renders the /kanban full-screen task list.
type taskBoardState struct {
	active   bool
	tasks    []BoardTask
	rows     []boardRow
	selected int
}

// tasksDir returns the task registry directory under the Miro agent home.
func tasksDir() string {
	dir := os.Getenv("MIRO_CODING_AGENT_DIR")
	if dir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		dir = filepath.Join(home, ".miro", "agent")
	}
	return filepath.Join(dir, "tasks")
}

// ListTasks reads the task registry and enriches each entry with git metadata.
func ListTasks() []BoardTask {
	dir := tasksDir()
	if dir == "" {
		return nil
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var out []BoardTask
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		b, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		var raw struct {
			ID        string `json:"id"`
			Title     string `json:"title"`
			Stage     string `json:"stage"`
			Branch    string `json:"branch"`
			Cwd       string `json:"cwd"`
			UpdatedAt string `json:"updatedAt"`
		}
		if json.Unmarshal(b, &raw) != nil || raw.ID == "" {
			continue
		}
		bt := BoardTask{
			ID:     raw.ID,
			Title:  raw.Title,
			Stage:  raw.Stage,
			Branch: raw.Branch,
			Cwd:    raw.Cwd,
		}
		if raw.Cwd != "" {
			bt.Repo = filepath.Base(strings.TrimRight(raw.Cwd, "/"))
		}
		if t, err := time.Parse(time.RFC3339, raw.UpdatedAt); err == nil {
			bt.UpdatedAt = t
		}
		if raw.Branch != "" {
			bt.CommitCount, bt.Uncommitted = gitTaskMeta(raw.Cwd, raw.Branch)
		}
		out = append(out, bt)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].UpdatedAt.After(out[j].UpdatedAt) })
	return out
}

// gitTaskMeta counts commits on a task branch and, when it is checked out, the
// uncommitted working-tree changes. Returns (commits, uncommitted).
func gitTaskMeta(cwd, branch string) (int, int) {
	if cwd == "" {
		return 0, 0
	}
	commits := 0
	out, err := exec.Command("git", "-C", cwd, "rev-list", "--count", branch).Output()
	if err == nil {
		n := strings.TrimSpace(string(out))
		if n != "" {
			if _, perr := fmt.Sscanf(n, "%d", &commits); perr != nil {
				commits = 0
			}
		}
	}
	head, _ := exec.Command("git", "-C", cwd, "rev-parse", "--abbrev-ref", "HEAD").Output()
	if strings.TrimSpace(string(head)) != branch {
		return commits, 0
	}
	status, err := exec.Command("git", "-C", cwd, "status", "--porcelain").Output()
	if err != nil {
		return commits, 0
	}
	uncommitted := 0
	for _, line := range strings.Split(string(status), "\n") {
		if strings.TrimSpace(line) != "" {
			uncommitted++
		}
	}
	return commits, uncommitted
}

// openTaskBoard builds the grouped /kanban overlay rows (in_progress first so
// active work sits on top) and selects the first task row.
func openTaskBoard(tasks []BoardTask) *taskBoardState {
	order := []string{"in_progress", "pending_review", "proposed", "done"}
	labels := map[string]string{
		"in_progress":    "进行中",
		"pending_review": "待审核",
		"proposed":       "提出",
		"done":           "已完成",
	}
	var rows []boardRow
	for _, stage := range order {
		rows = append(rows, boardRow{header: true, label: labels[stage]})
		for i := range tasks {
			if tasks[i].Stage == stage {
				rows = append(rows, boardRow{idx: i})
			}
		}
	}
	sel := 0
	for sel < len(rows) && rows[sel].header {
		sel++
	}
	if sel >= len(rows) {
		sel = 0
	}
	return &taskBoardState{active: true, tasks: tasks, rows: rows, selected: sel}
}
