// Miro TUI — a full-screen Bubble Tea frontend for the Miro Personal Agent
// (white-labeled Pi Agent core, driven over the pi --mode rpc protocol).
package main

import (
	"fmt"
	"os"
	"path/filepath"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/HiddenKismet/miro-agent/miro-tui/rpc"
	"github.com/HiddenKismet/miro-agent/miro-tui/ui"
)

func main() {
	// Locate the Miro core engine: flag > env > default
	coreBin := ""
	args := os.Args[1:]
	if len(args) >= 2 && args[0] == "--core" {
		coreBin = args[1]
		args = args[2:]
	}
	if coreBin == "" {
		coreBin = os.Getenv("MIRO_CORE_BIN")
	}
	if coreBin == "" {
		home := os.Getenv("MIRO_HOME")
		if home == "" {
			home = filepath.Join(os.Getenv("HOME"), ".miro")
		}
		coreBin = filepath.Join(home, "core", "node_modules", ".bin", "pi")
	}

	// Startup working-directory chooser (临时会话 / 进入项目), unless a
	// --project flag or MIRO_PROJECT env is given.
	dir, args, err := resolveStartDir(args)
	if err != nil {
		fmt.Fprintf(os.Stderr, "miro: %v\n", err)
		os.Exit(1)
	}
	if err := os.Chdir(dir); err != nil {
		fmt.Fprintf(os.Stderr, "miro: cannot enter %s: %v\n", dir, err)
		os.Exit(1)
	}

	client, err := rpc.New(coreBin, args...)
	if err != nil {
		fmt.Fprintf(os.Stderr, "miro: %v\n", err)
		os.Exit(1)
	}
	defer client.Close()

	p := tea.NewProgram(ui.New(client), tea.WithAltScreen())

	// bridge engine RPC events into the bubbletea loop
	go func() {
		for evt := range client.Events() {
			p.Send(ui.RPCMsg{Evt: evt})
		}
	}()
	go func() {
		<-client.Done()
		p.Send(ui.ExitMsg{})
	}()

	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "miro: %v\n", err)
		os.Exit(1)
	}
}
