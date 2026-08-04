package ui

import "testing"

func TestFuzzyMatch(t *testing.T) {
	cases := []struct {
		q, target string
		want      bool
	}{
		{"mro", "/home/hkun/miro-agent", true},     // fuzzy basename
		{"hku/mro", "/home/hkun/miro-agent", true}, // path segments
		{"hku mro", "/home/hkun/miro-agent", true}, // space-separated segments
		{"home/hkun", "/home/hkun/miro-agent", true},
		{"miro", "/home/hkun/miro-agent", true},
		{"miro-agent", "/home/hkun/miro-agent", true},
		{"agent", "/home/hkun/miro-agent", true},
		{"", "/home/hkun/miro-agent", true},
		{"zxc", "/home/hkun/miro-agent", false},
		{"hku/zzz", "/home/hkun/miro-agent", false},
		// order-exchangeable terms (AND semantics, any order)
		{"agent miro", "/home/hkun/miro-agent", true},
		{"miro home", "/home/hkun/miro-agent", true},
		{"tui miro", "/home/hkun/miro-agent/miro-tui", true},
		{"hkun zzz", "/home/hkun/miro-agent", false},
		{"zzz miro", "/home/hkun/miro-agent", false},
		// camelCase fuzzy matching
		{"PS", "/home/hkun/PaperSpine", true},
		{"pps", "/home/hkun/PaperSpine", true},
	}
	for _, c := range cases {
		got, _ := FuzzyMatch(c.q, c.target)
		if got != c.want {
			t.Errorf("FuzzyMatch(%q, %q) = %v, want %v", c.q, c.target, got, c.want)
		}
	}
}

func score(q, target string) int {
	_, s := FuzzyMatch(q, target)
	return s
}

func TestFuzzyMatchRanking(t *testing.T) {
	// best alignment, not greedy: "mro" must anchor on the basename "miro"
	// instead of locking the 'm' onto an earlier occurrence in a parent dir
	if s1, s2 := score("mro", "/home/hkun/miro-agent"), score("mro", "/home/hkun/amor/os"); s1 <= s2 {
		t.Errorf("basename alignment should beat parent-dir hit: %d vs %d", s1, s2)
	}
	// a more complete basename match ranks above a partial one
	if s1, s2 := score("miro", "/home/hkun/miro-agent"), score("mro", "/home/hkun/miro-agent"); s1 <= s2 {
		t.Errorf("fuller basename match should rank higher: %d vs %d", s1, s2)
	}
	// segment-start anchored matches rank above mid-word hits
	if s1, s2 := score("mt", "/home/hkun/miro-tui"), score("mt", "/home/hkun/smtp"); s1 <= s2 {
		t.Errorf("segment-start match should rank higher: %d vs %d", s1, s2)
	}
}
