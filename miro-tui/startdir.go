package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall"
)

// scratchDir is where 临时会话 (scratch) records live.
func scratchDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(os.TempDir(), "miro-scratch")
	}
	return filepath.Join(home, ".miro", "scratch")
}

func expandUser(p string) string {
	home, _ := os.UserHomeDir()
	if p == "~" {
		return home
	}
	if strings.HasPrefix(p, "~/") {
		return filepath.Join(home, p[2:])
	}
	return p
}

// resolveStartDir picks the working directory before the engine starts.
//
// Priority: --project <path> | --project=<path> > MIRO_PROJECT > default
// scratch (~/.miro/scratch). To enter another project at runtime use /project.
// Returns the chosen dir and the remaining args with any --project flag removed.
func resolveStartDir(args []string) (string, []string, error) {
	for i := 0; i < len(args); i++ {
		if args[i] == "--project" && i+1 < len(args) {
			rest := append(append([]string{}, args[:i]...), args[i+2:]...)
			return expandUser(args[i+1]), rest, nil
		}
		if strings.HasPrefix(args[i], "--project=") {
			p := strings.TrimPrefix(args[i], "--project=")
			rest := append(append([]string{}, args[:i]...), args[i+1:]...)
			return expandUser(p), rest, nil
		}
	}
	if p := os.Getenv("MIRO_PROJECT"); p != "" {
		return expandUser(p), args, nil
	}
	scratch := scratchDir()
	if err := os.MkdirAll(scratch, 0o755); err != nil {
		return "", args, err
	}
	return scratch, args, nil
}

// relaunchIn restarts this TUI process with --project <dir> so the engine
// starts fresh in the given directory. The process image is replaced in
// place (exec) instead of spawning a child and exiting: a child of a dying
// parent becomes an orphaned process group, which the kernel refuses to
// grant the controlling terminal (tcsetattr fails with EIO, bubbletea
// reports "error entering raw mode"). exec keeps the same PID and process
// group, so the shell and terminal stay satisfied.
func relaunchIn(dir string) {
	self, err := os.Executable()
	if err != nil {
		fmt.Fprintf(os.Stderr, "miro: cannot relaunch: %v\n", err)
		os.Exit(1)
	}
	err = syscall.Exec(self, []string{self, "--project", dir}, os.Environ())
	if err != nil {
		fmt.Fprintf(os.Stderr, "miro: cannot relaunch: %v\n", err)
		os.Exit(1)
	}
}
