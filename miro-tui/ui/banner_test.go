package ui

import (
	"strings"
	"testing"
	"unicode/utf8"

	tea "github.com/charmbracelet/bubbletea"
)

func TestMiroBannerIsTerminalSafe(t *testing.T) {
	if !utf8.ValidString(miroBanner) {
		t.Fatal("banner is not valid UTF-8")
	}
	if rows := strings.Count(miroBanner, "\n") + 1; rows != 6 {
		t.Fatalf("banner has %d rows, want 6", rows)
	}
	if !strings.Contains(miroBanner, "███╗") || !strings.Contains(miroBanner, "╚═════╝") {
		t.Fatal("banner does not contain the complete Miro logo")
	}
	raw := renderBanner(80)
	clean := stripANSI(raw)
	if !strings.Contains(clean, "███╗") {
		t.Fatalf("rendered banner missing logo art: %q", clean)
	}
	if strings.TrimSpace(clean) == "" {
		t.Fatal("rendered banner is empty")
	}
}

func TestStartupBannerDoesNotStartScrolledToBottom(t *testing.T) {
	m := New(nil)
	// Startup ticks/RPC events can refresh the viewport before the terminal
	// sends its first WindowSizeMsg.
	m.refreshViewport()
	updated, _ := m.Update(tea.WindowSizeMsg{Width: 80, Height: 13})
	model := updated.(Model)
	visible := stripANSI(model.viewport.View())
	if !strings.Contains(visible, "███╗   ███╗") {
		t.Fatalf("startup viewport starts below the first banner row: %q", visible)
	}
}

func stripANSI(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] == 0x1b {
			// skip until 'm' terminator
			for i < len(s) && s[i] != 'm' {
				i++
			}
			continue
		}
		b.WriteByte(s[i])
	}
	return b.String()
}
