package ui

import (
	"strings"
	"time"
)

// FuzzyMatch implements a VSCode quick-open style matcher with
// order-exchangeable terms: the query (terms split by '/', '\', ':' or
// space) must match the target path as a subsequence — every term
// independently, in any order (AND semantics). Each term uses its
// best-scoring alignment rather than a greedy first match, with bonuses for
// path-segment starts, word boundaries, camelCase transitions, basename
// matches and consecutive runs, and a penalty for gaps between matched
// characters. Returns whether it matched and a score (higher = better).
//
//	FuzzyMatch("mro", "/home/hkun/miro-agent")        -> true
//	FuzzyMatch("hku/mro", "/home/hkun/miro-agent")    -> true
//	FuzzyMatch("agent miro", "/home/hkun/miro-agent") -> true
//	FuzzyMatch("zxc", "/home/hkun/miro-agent")        -> false
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
	total := 0
	baseStart := strings.LastIndexAny(t, "/\\") + 1
	for _, term := range terms {
		s, ok := bestMatch(term, t, target, baseStart)
		if !ok {
			return false, 0
		}
		total += s
	}
	return true, total
}

// bestMatch finds the highest-scoring subsequence alignment of term inside t
// with memoized search over (termIndex, startPosition). A greedy first match
// is deliberately avoided: the best alignment wins (e.g. the 'm' of "mro"
// prefers the basename "miro" over an earlier 'm' in "/home").
func bestMatch(term, t, tOrig string, baseStart int) (int, bool) {
	n := len(t)
	memo := make([][]int, len(term)+1)
	visited := make([][]bool, len(term)+1)
	for i := range memo {
		memo[i] = make([]int, n+1)
		visited[i] = make([]bool, n+1)
	}
	var rec func(qi, start int) int
	rec = func(qi, start int) int {
		if qi == len(term) {
			return 0
		}
		if visited[qi][start] {
			return memo[qi][start]
		}
		visited[qi][start] = true
		best := impossibleScore
		c := term[qi]
		for j := start; j < n; j++ {
			if t[j] != c {
				continue
			}
			rest := rec(qi+1, j+1)
			if rest == impossibleScore {
				continue
			}
			if s := charScore(t, tOrig, j, start-1, qi, baseStart) + rest; s > best {
				best = s
			}
		}
		memo[qi][start] = best
		return best
	}
	best := rec(0, 0)
	return best, best != impossibleScore
}

const impossibleScore = -(1 << 30)

// charScore scores matching the term's qi-th character at position j, with
// the previous matched position prev (-1 for the term's first character).
func charScore(t, tOrig string, j, prev, qi, baseStart int) int {
	s := 0
	if qi == 0 {
		s += 20 // first query character of the term
	}
	if j == 0 {
		s += 100 // target start counts as a segment start
	} else if ch := t[j-1]; ch == '/' || ch == '\\' || ch == ':' {
		s += 100 // path-segment start
	} else if ch == '-' || ch == '_' || ch == '.' || ch == ' ' {
		s += 50 // word boundary
	} else if isLowerAscii(tOrig[j-1]) && isUpperAscii(tOrig[j]) {
		s += 50 // camelCase transition
	}
	if j >= baseStart {
		s += 30 // inside the basename (last path segment)
	}
	if prev >= 0 {
		if j == prev+1 {
			s += 15 // consecutive run
		} else if gap := j - prev - 1; gap > 0 {
			p := 4 * gap
			if p > 32 {
				p = 32
			}
			s -= p // spread-out matches lose points
		}
	}
	return s
}

func isLowerAscii(b byte) bool { return b >= 'a' && b <= 'z' }
func isUpperAscii(b byte) bool { return b >= 'A' && b <= 'Z' }

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
