package main

import "strings"

// fuzzyMatch implements a VSCode quick-open style matcher: the query (terms
// split by '/', '\', ':' or space) must appear as subsequences of the target
// path in order, with scoring bonuses for matches at path-segment starts and
// word boundaries. Returns whether it matched and a score (higher = better).
//
//   fuzzyMatch("mro", "/home/hkun/miro-agent")    -> true
//   fuzzyMatch("hku/mro", "/home/hkun/miro-agent") -> true
//   fuzzyMatch("zxc", "/home/hkun/miro-agent")     -> false
func fuzzyMatch(query, target string) (bool, int) {
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
