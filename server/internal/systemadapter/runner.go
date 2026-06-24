package systemadapter

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"time"
)

var (
	ErrNotImplemented = fmt.Errorf("not implemented")
	ErrCommandBlocked = fmt.Errorf("command not allowed")
)

// BlockedCommands is a list of command prefixes that are never allowed.
var BlockedCommands = []string{
	"rm -rf /", "mkfs", "dd if=", "fdisk", "parted", "wipefs",
	"halt", "reboot", "shutdown", "init 0", "init 6",
}

// CommandResult holds the output of a command execution.
type CommandResult struct {
	Stdout   string
	Stderr   string
	ExitCode int
}

// RunCommand executes a shell command with safety checks and timeout.
func RunCommand(command string, timeout time.Duration) (*CommandResult, error) {
	// Safety check against dangerous commands
	for _, blocked := range BlockedCommands {
		if len(command) >= len(blocked) && command[:len(blocked)] == blocked {
			return nil, ErrCommandBlocked
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "sh", "-c", command)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return nil, fmt.Errorf("command execution failed: %w", err)
		}
	}

	return &CommandResult{
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		ExitCode: exitCode,
	}, nil
}
