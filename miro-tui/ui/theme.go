package ui

import "github.com/charmbracelet/lipgloss"

// Miro palette — warm pine + mint, matching miro-dark.json / Miro Web dark.
var (
	colorBG     = lipgloss.Color("#0e1612") // pine ink
	colorPanel  = lipgloss.Color("#15201b") // deep pine
	colorBorder = lipgloss.Color("#2a352f")
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

	styleFooter   = lipgloss.NewStyle().Foreground(colorDim).PaddingLeft(1)
	styleInputBox = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(colorBorder).
			Padding(0, 1)
)
