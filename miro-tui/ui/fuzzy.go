package ui

import (
	"strings"
	"time"
)

// FuzzyMatch implements a VSCode quick-open style matcher: the query (terms
// split by '/', '\', ':' or space) must appear as subsequences of the target
// path in order, with scoring bonuses for matches at path-segment starts and
// word boundaries. Returns whether it matched and a score (higher = better).
//
//	FuzzyMatch("mro", "/home/hkun/miro-agent")    -> true
//	FuzzyMatch("hku/mro", "/home/hkun/miro-agent") -> true
//	FuzzyMatch("zxc", "/home/hkun/miro-agent")     -> false
func FuzzyMatch(query, target string) (bool, int) {
	q := strings.ToLower(strings.TrimSpace(query))
	t := strings.ToLower(target)
	if q == "" {
		return true, 0
	}
	terms := strings.FieldsFunc(q, func(r rune) bool {
		return r == '/' || r == '\\' || r == ':' || r == ' '
	})
	if len(terms) == 0 {
		return true, 0
	}
	pos := 0
	score := 0
	for _, term := range terms {
		end, ok, s := subseqMatch(term, t, pos)
		if !ok {
			return false, 0
		}
		score += s
		pos = end + 1
	}
	return true, score
}

// HumanTime renders a compact relative time for hint lines.
func HumanTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	d := time.Since(t)
	switch {
	case d < time.Minute:
		return "刚刚"
	case d < time.Hour:
		return itoa(int(d.Minutes())) + " 分钟前"
	case d < 24*time.Hour:
		return itoa(int(d.Hours())) + " 小时前"
	default:
		return itoa(int(d.Hours()/24)) + " 天前"
	}
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

// ProjectHint builds the context line for a project item.
func ProjectHint(p Project) string {
	parts := []string{p.Dir}
	if p.Branch != "" {
		parts = append(parts, p.Branch)
	}
	if p.Dirty > 0 {
		parts = append(parts, "●"+itoa(p.Dirty))
	}
	if p.Remote != "" {
		parts = append(parts, p.Remote)
	}
	if when := HumanTime(p.LastUsed); when != "" {
		parts = append(parts, when)
	}
	return strings.Join(parts, " · ")
}

func isSegmentStart(s string, i int) bool {
	if i == 0 {
		return true
	}
	switch s[i-1] {
	case '/', '\\', ':', ' ', '.':
		return true
	}
	return false
}

func isWordBoundary(s string, i int) bool {
	if i == 0 {
		return true
	}
	switch s[i-1] {
	case '-', '_', '.', ' ', ':', '/', '\\':
		return true
	}
	return false
}

// subseqMatch finds term as a subsequence of t starting at start. Returns the
// matched end index, whether it matched, and a VSCode-like score.
func subseqMatch(term, t string, start int) (int, bool, int) {
	ti := start
	score := 0
	prev := -1
	for qi := 0; qi < len(term); qi++ {
		c := term[qi]
		j := ti
		for j < len(t) && t[j] != c {
			j++
		}
		if j >= len(t) {
			return 0, false, 0
		}
		switch {
		case isSegmentStart(t, j):
			score += 15
		case isWordBoundary(t, j):
			score += 8
		}
		if qi == 0 {
			score += 5
		}
		if j == prev+1 {
			score += 6 // consecutive run
		}
		prev = j
		ti = j + 1
	}
	return prev, true, score
}
