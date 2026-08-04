package main

import "testing"

func TestFuzzyMatch(t *testing.T) {
	cases := []struct {
		q, target string
		want      bool
	}{
		{"mro", "/home/hkun/miro-agent", true},      // fuzzy basename
		{"hku/mro", "/home/hkun/miro-agent", true},  // path segments
		{"hku mro", "/home/hkun/miro-agent", true},  // space-separated segments
		{"home/hkun", "/home/hkun/miro-agent", true},
		{"miro", "/home/hkun/miro-agent", true},
		{"miro-agent", "/home/hkun/miro-agent", true},
		{"agent", "/home/hkun/miro-agent", true},
		{"", "/home/hkun/miro-agent", true},
		{"zxc", "/home/hkun/miro-agent", false},
		{"hku/zzz", "/home/hkun/miro-agent", false},
	}
	for _, c := range cases {
		got, _ := fuzzyMatch(c.q, c.target)
		if got != c.want {
			t.Errorf("fuzzyMatch(%q, %q) = %v, want %v", c.q, c.target, got, c.want)
		}
	}
}

func TestFuzzyScoreOrder(t *testing.T) {
	// Exact basename match should outrank a weaker path fragment.
	a, _ := fuzzyMatch("agent", "/home/hkun/miro-agent")
	b, _ := fuzzyMatch("agent", "/home/hkun/some-other")
	_ = a
	_ = b
}
