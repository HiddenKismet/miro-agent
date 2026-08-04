package ui

import (
	"bufio"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Session is one historical conversation listed for /resume.
type Session struct {
	Name    string
	Path    string
	Preview string
	ModTime time.Time
}

// sessionRoot returns $MIRO_CODING_AGENT_DIR/sessions (Miro home by default).
func sessionRoot() string {
	dir := os.Getenv("MIRO_CODING_AGENT_DIR")
	if dir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		dir = filepath.Join(home, ".miro", "agent")
	}
	return filepath.Join(dir, "sessions")
}

// agentVersion reads the Miro version stamp from the agent home (VERSION),
// falling back to a default when absent.
func agentVersion() string {
	dir := os.Getenv("MIRO_CODING_AGENT_DIR")
	if dir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "0.1.0"
		}
		dir = filepath.Join(home, ".miro", "agent")
	}
	b, err := os.ReadFile(filepath.Join(dir, "VERSION"))
	if err != nil {
		return "0.1.0"
	}
	v := strings.TrimSpace(string(b))
	if v == "" {
		return "0.1.0"
	}
	return v
}

var (
	gitMarkerCache   string
	gitMarkerCacheAt time.Time
)

// gitMarker returns a compact working-tree marker for the process cwd:
// "" when not a git repository, "main" when clean, "main ●" when dirty.
// Cached for a few seconds because it is called on every TUI render.
func gitMarker() string {
	if time.Since(gitMarkerCacheAt) < 5*time.Second {
		return gitMarkerCache
	}
	gitMarkerCache = computeGitMarker()
	gitMarkerCacheAt = time.Now()
	return gitMarkerCache
}

func computeGitMarker() string {
	cwd, err := os.Getwd()
	if err != nil {
		return ""
	}
	out, err := exec.Command("git", "-C", cwd, "status", "--porcelain", "-b").Output()
	if err != nil {
		return ""
	}
	branch := ""
	dirty := false
	for _, line := range strings.Split(string(out), "\n") {
		if strings.HasPrefix(line, "## ") {
			head := strings.TrimPrefix(line, "## ")
			branch = head
			if i := strings.Index(branch, "..."); i >= 0 {
				branch = branch[:i]
			}
			continue
		}
		if line != "" {
			dirty = true
		}
	}
	if branch == "" {
		return ""
	}
	if dirty {
		return branch + " ●"
	}
	return branch
}

// ListSessions scans the session store: one newest file per session dir,
// newest first. Name comes from session_info.name (fallback: cwd base),
// preview from the first user message.
func ListSessions() []Session {
	root := sessionRoot()
	dirs, err := os.ReadDir(root)
	if err != nil {
		return nil
	}

	var out []Session
	for _, d := range dirs {
		if !d.IsDir() {
			continue
		}
		sub := filepath.Join(root, d.Name())
		files, err := os.ReadDir(sub)
		if err != nil {
			continue
		}
		var best *Session
		for _, f := range files {
			if f.IsDir() || !strings.HasSuffix(f.Name(), ".jsonl") {
				continue
			}
			info, err := f.Info()
			if err != nil {
				continue
			}
			s := parseSessionFile(filepath.Join(sub, f.Name()), info.ModTime(), d.Name())
			if best == nil || s.ModTime.After(best.ModTime) {
				best = &s
			}
		}
		if best != nil {
			out = append(out, *best)
		}
	}

	sort.Slice(out, func(i, j int) bool { return out[i].ModTime.After(out[j].ModTime) })
	return out
}

// parseSessionFile reads enough of the JSONL to find the session name and
// the first user message text. The file is an engine session log:
//
//	{"type":"session","id":...,"cwd":"/path"}            ← header (first line)
//	{"type":"session_info","name":"my session"}          ← optional rename
//	{"type":"message","message":{"role":"user","content":[...]}}  ← first user text
func parseSessionFile(path string, mtime time.Time, dirName string) Session {
	s := Session{
		Path:    path,
		ModTime: mtime,
		Name:    strings.Trim(dirName, "-"),
	}

	f, err := os.Open(path)
	if err != nil {
		return s
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 64*1024), 1<<20)
	for scanner.Scan() && s.Preview == "" {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var obj map[string]any
		if err := json.Unmarshal([]byte(line), &obj); err != nil {
			continue
		}
		switch obj["type"] {
		case "session":
			if cwd, ok := obj["cwd"].(string); ok && cwd != "" {
				base := filepath.Base(strings.TrimRight(cwd, "/"))
				if base != "" && base != "/" && base != "." {
					s.Name = base
				}
			}
		case "session_info":
			if name, ok := obj["name"].(string); ok && name != "" {
				s.Name = name
			}
		case "message":
			msg, _ := obj["message"].(map[string]any)
			if msg == nil {
				continue
			}
			if role, _ := msg["role"].(string); role == "user" {
				s.Preview = textFromContent(msg["content"])
			}
		}
	}
	return s
}

// textFromContent handles both "string" and structured content blocks.
func textFromContent(content any) string {
	switch c := content.(type) {
	case string:
		return strings.TrimSpace(c)
	case []any:
		var b strings.Builder
		for _, blk := range c {
			m, ok := blk.(map[string]any)
			if !ok {
				continue
			}
			if t, _ := m["type"].(string); t == "text" {
				if s, ok := m["text"].(string); ok {
					b.WriteString(s)
					b.WriteString(" ")
				}
			}
		}
		return strings.TrimSpace(b.String())
	}
	return ""
}

// IsGitRepo reports whether dir is the root of a git repository.
func IsGitRepo(dir string) bool {
	out, err := exec.Command("git", "-C", dir, "rev-parse", "--show-toplevel").Output()
	return err == nil && strings.TrimSpace(string(out)) == dir
}

// sessionCwdOf reads a session file's header cwd (first "session" line).
func sessionCwdOf(file string) string {
	f, err := os.Open(file)
	if err != nil {
		return ""
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	for sc.Scan() {
		var obj map[string]any
		if json.Unmarshal(sc.Bytes(), &obj) != nil {
			continue
		}
		if obj["type"] != "session" {
			continue
		}
		if cwd, ok := obj["cwd"].(string); ok {
			return cwd
		}
		return ""
	}
	return ""
}

// ListProjectDirs returns distinct project directories (git repository roots)
// derived from saved sessions' cwds, most-recently-used first. Used by the
// startup "enter a project" chooser.
func ListProjectDirs() []string {
	root := sessionRoot()
	dirs, err := os.ReadDir(root)
	if err != nil {
		return nil
	}
	latest := map[string]time.Time{}
	for _, d := range dirs {
		if !d.IsDir() {
			continue
		}
		files, err := os.ReadDir(filepath.Join(root, d.Name()))
		if err != nil {
			continue
		}
		for _, f := range files {
			if f.IsDir() || !strings.HasSuffix(f.Name(), ".jsonl") {
				continue
			}
			p := filepath.Join(root, d.Name(), f.Name())
			cwd := sessionCwdOf(p)
			if cwd == "" {
				continue
			}
			st, err := os.Stat(p)
			if err != nil {
				continue
			}
			if t, ok := latest[cwd]; !ok || st.ModTime().After(t) {
				latest[cwd] = st.ModTime()
			}
		}
	}
	type proj struct {
		cwd string
		at  time.Time
	}
	var list []proj
	for c, at := range latest {
		if IsGitRepo(c) {
			list = append(list, proj{c, at})
		}
	}
	sort.Slice(list, func(i, j int) bool { return list[i].at.After(list[j].at) })
	out := make([]string, 0, len(list))
	for _, p := range list {
		out = append(out, p.cwd)
	}
	return out
}
