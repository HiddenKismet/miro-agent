package ui

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/charmbracelet/bubbles/textarea"
)

func TestScanPathPrefix(t *testing.T) {
	dir := t.TempDir()
	for _, d := range []string{"alpha", "alpine", "beta"} {
		if err := os.Mkdir(filepath.Join(dir, d), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(dir, "alpha.txt"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	hits := scanPathPrefix(filepath.Join(dir, "al"), 10)
	if len(hits) != 2 {
		t.Fatalf("expected 2 dir hits for %q, got %d", "al", len(hits))
	}
	// files must never be suggested, and fuzzy must not match "beta"
	for _, h := range hits {
		if filepath.Base(h.path) == "alpha.txt" || filepath.Base(h.path) == "beta" {
			t.Errorf("unexpected hit %q", h.path)
		}
	}

	// non-existent parent → no hits
	if h := scanPathPrefix(filepath.Join(dir, "nope", "x"), 10); len(h) != 0 {
		t.Errorf("expected no hits for missing parent, got %v", h)
	}

	// limit is respected
	if h := scanPathPrefix(filepath.Join(dir, "a"), 1); len(h) != 1 {
		t.Errorf("expected limit 1, got %d hits", len(h))
	}
}

func TestPathMenuState(t *testing.T) {
	projects := []Project{{Dir: "/home/hkun/miro-agent", Branch: "main"}}
	var pm pathMenuState

	pm.update("hello world", projects)
	if pm.active {
		t.Error("menu must not activate for plain input")
	}

	pm.update("/project", projects)
	if pm.active {
		t.Error("menu must not activate without a path argument")
	}

	pm.update("/project miro", projects)
	if !pm.active {
		t.Fatal("menu should activate for /project <arg>")
	}
	if pm.filter != "miro" {
		t.Errorf("filter = %q, want %q", pm.filter, "miro")
	}
	found := false
	for _, s := range pm.matches {
		if s.Path == "/home/hkun/miro-agent" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected miro-agent in matches, got %+v", pm.matches)
	}

	pm.update("/project ", projects)
	if pm.active {
		t.Error("menu must close for an empty argument")
	}
}

func TestPathMenuComplete(t *testing.T) {
	ta := textarea.New()
	ta.SetValue("/project miro")
	pm := pathMenuState{
		active:  true,
		filter:  "miro",
		matches: []PathSuggestion{{Path: "/home/hkun/miro-agent", Hint: "main"}},
	}
	pm.complete(&ta)
	if got := ta.Value(); got != "/project /home/hkun/miro-agent " {
		t.Errorf("complete() = %q", got)
	}
}
