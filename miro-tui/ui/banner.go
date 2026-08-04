package ui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// miroBanner is rendered as one complete six-row logo. Keeping the rows in a
// single literal avoids losing trailing rows while composing per-letter
// glyphs during terminal startup.
var miroBanner = `███╗   ███╗ ██╗ ██████╗   ██████╗
████╗ ████║ ██║ ██╔══██╗ ██╔═══██╗
██╔████╔██║ ██║ ██████╔╝ ██║   ██║
██║╚██╔╝██║ ██║ ██╔══██╗ ██║   ██║
██║ ╚═╝ ██║ ██║ ██║  ██║ ╚██████╔╝
╚═╝     ╚═╝ ╚═╝ ╚═╝  ╚═╝  ╚═════╝`

// bannerStops is the left→right color ramp for the logo (Miro palette).
var bannerStops = [][3]int{
	{95, 191, 164},  // mint
	{127, 196, 212}, // cyan
	{180, 163, 217}, // lavender
	{224, 192, 104}, // gold
}

// renderBanner colorizes the Miro logo with a left→right gradient and centers
// it within the given terminal width.
func renderBanner(width int) string {
	lines := strings.Split(miroBanner, "\n")
	artWidth := 0
	chars := 0
	for _, l := range lines {
		n := len([]rune(l))
		if n > artWidth {
			artWidth = n
		}
		chars += n
	}

	idx := 0
	colored := make([]string, len(lines))
	for i, l := range lines {
		var b strings.Builder
		for _, r := range l {
			if r == ' ' {
				b.WriteRune(r)
			} else {
				b.WriteString(lipgloss.NewStyle().Foreground(bannerGradient(idx, chars)).Render(string(r)))
				idx++
			}
		}
		colored[i] = b.String()
	}

	if width > artWidth {
		pad := strings.Repeat(" ", (width-artWidth)/2)
		for i := range colored {
			colored[i] = pad + colored[i]
		}
	}
	return strings.Join(colored, "\n")
}

// bannerGradient returns the color for the index-th glyph of the logo.
func bannerGradient(index, total int) lipgloss.Color {
	if total <= 1 {
		return lipgloss.Color("#5fbfa4")
	}
	t := float64(index) / float64(total-1)
	seg := t * float64(len(bannerStops)-1)
	lo := int(seg)
	hi := lo + 1
	if hi >= len(bannerStops) {
		hi = len(bannerStops) - 1
	}
	f := seg - float64(lo)
	c := bannerStops[lo]
	d := bannerStops[hi]
	r := c[0] + int(float64(d[0]-c[0])*f)
	g := c[1] + int(float64(d[1]-c[1])*f)
	b := c[2] + int(float64(d[2]-c[2])*f)
	return lipgloss.Color(fmt.Sprintf("#%02x%02x%02x", r, g, b))
}
