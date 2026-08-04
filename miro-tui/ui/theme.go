package ui

import "github.com/charmbracelet/lipgloss"

// OpenCode-inspired palette
var (
	colorBG     = lipgloss.Color("#0a0a0a")
	colorPanel  = lipgloss.Color("#1e1e1e")
	colorBorder = lipgloss.Color("#333333")
	colorAccent = lipgloss.Color("#5fbfa4")
	colorOrange = lipgloss.Color("#f5a742")
	colorGreen  = lipgloss.Color("#7fbf8e")
	colorRed    = lipgloss.Color("#e07a6f")
	colorMuted  = lipgloss.Color("#8a9a94")
	colorDim    = lipgloss.Color("#5f6d68")
)

var (
	styleHeader = lipgloss.NewStyle().
			Background(colorPanel).
			Foreground(colorAccent).
			Bold(true).
			PaddingLeft(1)

	styleHeaderText = lipgloss.NewStyle().Foreground(colorMuted)

	styleUserPrefix = lipgloss.NewStyle().Foreground(colorOrange).Bold(true)
	styleAsstPrefix = lipgloss.NewStyle().Foreground(colorAccent).Bold(true)
	styleToolOK     = lipgloss.NewStyle().Foreground(colorGreen)
	styleToolRun    = lipgloss.NewStyle().Foreground(colorOrange)
	styleToolName   = lipgloss.NewStyle().Foreground(colorMuted)
	styleThinking   = lipgloss.NewStyle().Foreground(colorDim).Italic(true)

	styleFooter  = lipgloss.NewStyle().Foreground(colorDim).PaddingLeft(1)
	styleInputBox = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(colorBorder).
			Padding(0, 1)
)
