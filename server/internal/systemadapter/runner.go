package systemadapter

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"os/exec"
	"sync"
	"time"
)

var (
	ErrNotImplemented = fmt.Errorf("not implemented")
)

// CommandResult holds the output of a command execution.
type CommandResult struct {
	Stdout   string
	Stderr   string
	ExitCode int
}

// Run executes a single binary with the given arguments and timeout.
// The binary MUST be in the allowlist. Args are validated for shell metacharacters.
// This never uses sh -c; commands are executed directly via exec.CommandContext.
func Run(binary string, args []string, timeout time.Duration) (*CommandResult, error) {
	return RunStreamed(binary, args, timeout, nil)
}

// RunStreamed executes a binary like Run, but calls onLine for each line of
// stdout/stderr output in real time. onLine receives the stream name ("stdout"
// or "stderr") and the line content (without trailing newline). If onLine is
// nil, output is only captured into the returned CommandResult (same as Run).
func RunStreamed(binary string, args []string, timeout time.Duration, onLine func(stream, line string)) (*CommandResult, error) {
	if err := ValidateBinary(binary); err != nil {
		return nil, err
	}
	if err := ValidateArgs(args); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	var cmd *exec.Cmd
	if RequiresSudo(binary) {
		sudoArgs := append([]string{"-n", binary}, args...)
		cmd = exec.CommandContext(ctx, "sudo", sudoArgs...)
	} else {
		cmd = exec.CommandContext(ctx, binary, args...)
	}

	// When onLine is nil, use simple buffer capture (same as old Run).
	if onLine == nil {
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

	// Streaming mode: use pipes and goroutines to capture line-by-line.
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start command: %w", err)
	}

	var stdoutBuf, stderrBuf bytes.Buffer
	var wg sync.WaitGroup

	// Goroutine to read stdout line-by-line
	wg.Add(1)
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stdoutPipe)
		for scanner.Scan() {
			line := scanner.Text()
			stdoutBuf.WriteString(line + "\n")
			onLine("stdout", line)
		}
	}()

	// Goroutine to read stderr line-by-line
	wg.Add(1)
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderrPipe)
		for scanner.Scan() {
			line := scanner.Text()
			stderrBuf.WriteString(line + "\n")
			onLine("stderr", line)
		}
	}()

	// Wait for pipe readers to finish, then wait for the command.
	wg.Wait()
	err = cmd.Wait()

	// Drain any remaining partial lines (no trailing newline)
	if rest := drainReader(stdoutPipe); rest != "" {
		stdoutBuf.WriteString(rest)
		onLine("stdout", rest)
	}
	if rest := drainReader(stderrPipe); rest != "" {
		stderrBuf.WriteString(rest)
		onLine("stderr", rest)
	}

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return nil, fmt.Errorf("command execution failed: %w", err)
		}
	}

	return &CommandResult{
		Stdout:   stdoutBuf.String(),
		Stderr:   stderrBuf.String(),
		ExitCode: exitCode,
	}, nil
}

// drainReader reads any remaining bytes from r (for partial last lines).
func drainReader(r io.ReadCloser) string {
	var buf bytes.Buffer
	remaining, err := io.ReadAll(r)
	if err != nil || len(remaining) == 0 {
		return ""
	}
	buf.Write(remaining)
	return buf.String()
}

// RunWithStdin executes a binary with the given arguments and feeds
// stdinData to its standard input. Used for commands like `wg pubkey`
// that read from stdin.
func RunWithStdin(binary string, args []string, stdinData string, timeout time.Duration) (*CommandResult, error) {
	if err := ValidateBinary(binary); err != nil {
		return nil, err
	}
	if err := ValidateArgs(args); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	var cmd *exec.Cmd
	if RequiresSudo(binary) {
		sudoArgs := append([]string{"-n", binary}, args...)
		cmd = exec.CommandContext(ctx, "sudo", sudoArgs...)
	} else {
		cmd = exec.CommandContext(ctx, binary, args...)
	}
	cmd.Stdin = bytes.NewReader([]byte(stdinData))
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

// PipelineStage represents one command in a pipeline.
type PipelineStage struct {
	Binary string
	Args   []string
}

// RunPipeline executes multiple commands, piping the stdout of each
// into the stdin of the next. All binaries must be in the allowlist.
// Returns the output of the final command.
func RunPipeline(stages []PipelineStage, timeout time.Duration) (*CommandResult, error) {
	if len(stages) == 0 {
		return nil, fmt.Errorf("pipeline must have at least one stage")
	}

	for _, stage := range stages {
		if err := ValidateBinary(stage.Binary); err != nil {
			return nil, err
		}
		if err := ValidateArgs(stage.Args); err != nil {
			return nil, err
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	var cmds []*exec.Cmd
	for _, stage := range stages {
		if RequiresSudo(stage.Binary) {
			sudoArgs := append([]string{"-n", stage.Binary}, stage.Args...)
			cmds = append(cmds, exec.CommandContext(ctx, "sudo", sudoArgs...))
		} else {
			cmds = append(cmds, exec.CommandContext(ctx, stage.Binary, stage.Args...))
		}
	}

	// Wire up pipes between consecutive commands
	for i := 0; i < len(cmds)-1; i++ {
		pipe, err := cmds[i].StdoutPipe()
		if err != nil {
			return nil, fmt.Errorf("failed to create pipe: %w", err)
		}
		cmds[i+1].Stdin = pipe
	}

	// Capture the last command's output
	var stdout, stderr bytes.Buffer
	cmds[len(cmds)-1].Stdout = &stdout
	// Collect stderr from all commands
	for _, cmd := range cmds {
		cmd.Stderr = &stderr
	}

	// Start all commands
	for _, cmd := range cmds {
		if err := cmd.Start(); err != nil {
			return nil, fmt.Errorf("failed to start command: %w", err)
		}
	}

	// Wait for all commands to finish
	err := cmds[len(cmds)-1].Wait()
	// Close intermediate pipes by waiting on earlier commands
	for i := 0; i < len(cmds)-1; i++ {
		cmds[i].Wait()
	}

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return nil, fmt.Errorf("pipeline execution failed: %w", err)
		}
	}

	return &CommandResult{
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		ExitCode: exitCode,
	}, nil
}

// RunShell executes a command through sh -c. This is intended ONLY for
// user-defined commands in the cronmanager feature. All executions are
// logged for audit purposes. The command string is NOT validated against
// the allowlist since it is user-defined, but a warning is logged.
//
// For all other use cases, prefer Run() which validates the binary.
func RunShell(command string, timeout time.Duration) (*CommandResult, error) {
	log.Printf("[systemadapter] RunShell: executing user-defined command (len=%d)", len(command))

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// Run user shells as nobody to sandbox them
	cmd := exec.CommandContext(ctx, "sudo", "-u", "nobody", "sh", "-c", command)
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

	log.Printf("[systemadapter] RunShell: completed exitCode=%d", exitCode)

	return &CommandResult{
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		ExitCode: exitCode,
	}, nil
}

// RunScript executes a script string through sh -c with logging.
// This is used for DDNS custom scripts where the script content
// comes from user configuration. All executions are logged.
//
// The script is expected to be a simple command or script snippet.
// Returns an error if the script is empty.
func RunScript(script string, timeout time.Duration) (*CommandResult, error) {
	if script == "" {
		return nil, fmt.Errorf("script is empty")
	}
	log.Printf("[systemadapter] RunScript: executing user script (len=%d)", len(script))

	result, err := RunShell(script, timeout)
	if err != nil {
		log.Printf("[systemadapter] RunScript: failed: %v", err)
		return result, err
	}

	log.Printf("[systemadapter] RunScript: completed exitCode=%d", result.ExitCode)
	return result, nil
}
