package systemadapter

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type ComposeProject struct {
	Name       string `json:"name"`
	Status     string `json:"status"`
	ConfigFile string `json:"configFile"`
	Services   int    `json:"services"`
}

type ComposeService struct {
	Name  string `json:"name"`
	Image string `json:"image"`
	State string `json:"state"`
	Ports string `json:"ports"`
}

func ListComposeProjects() ([]ComposeProject, error) {
	result, err := Run("docker", []string{"compose", "ls", "--format", "json"}, 30*time.Second)
	if err != nil {
		return []ComposeProject{}, nil
	}

	projects := make([]ComposeProject, 0)
	lines := splitLines([]byte(result.Stdout))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var p struct {
			Name        string `json:"Name"`
			Status      string `json:"Status"`
			ConfigFiles string `json:"ConfigFiles"`
		}
		if err := json.Unmarshal([]byte(line), &p); err != nil {
			continue
		}
		projects = append(projects, ComposeProject{
			Name:       p.Name,
			Status:     p.Status,
			ConfigFile: p.ConfigFiles,
		})
	}

	return projects, nil
}

func GetComposeProject(name string) ([]ComposeService, error) {
	if name == "" {
		return nil, errors.New("project name is required")
	}

	result, err := Run("docker", []string{"compose", "-p", name, "ps", "--format", "json"}, 30*time.Second)
	if err != nil {
		return nil, errors.New("failed to get project services: " + err.Error())
	}

	services := make([]ComposeService, 0)
	lines := splitLines([]byte(result.Stdout))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var s struct {
			Name  string `json:"Name"`
			Image string `json:"Image"`
			State string `json:"State"`
			Ports string `json:"Ports"`
		}
		if err := json.Unmarshal([]byte(line), &s); err != nil {
			continue
		}
		services = append(services, ComposeService{
			Name:  strings.TrimPrefix(s.Name, "/"),
			Image: s.Image,
			State: s.State,
			Ports: s.Ports,
		})
	}

	return services, nil
}

func ComposeUp(name string, filePath string) error {
	if name == "" {
		return errors.New("project name is required")
	}
	args := []string{"compose", "-p", name}
	if filePath != "" {
		args = append(args, "-f", filePath)
	}
	args = append(args, "up", "-d")

	result, err := Run("docker", args, 120*time.Second)
	if err != nil {
		return err
	}
	if result.ExitCode != 0 {
		return errors.New(result.Stdout + result.Stderr)
	}
	return nil
}

func ComposeDown(name string, filePath string) error {
	if name == "" {
		return errors.New("project name is required")
	}
	args := []string{"compose", "-p", name}
	if filePath != "" {
		args = append(args, "-f", filePath)
	}
	args = append(args, "down")

	result, err := Run("docker", args, 60*time.Second)
	if err != nil {
		return err
	}
	if result.ExitCode != 0 {
		return errors.New(result.Stdout + result.Stderr)
	}
	return nil
}

func ComposeRestart(name string, filePath string) error {
	if name == "" {
		return errors.New("project name is required")
	}
	args := []string{"compose", "-p", name}
	if filePath != "" {
		args = append(args, "-f", filePath)
	}
	args = append(args, "restart")

	result, err := Run("docker", args, 60*time.Second)
	if err != nil {
		return err
	}
	if result.ExitCode != 0 {
		return errors.New(result.Stdout + result.Stderr)
	}
	return nil
}

func ComposeLogs(name string, tail int) (string, error) {
	if name == "" {
		return "", errors.New("project name is required")
	}
	if tail <= 0 || tail > 1000 {
		tail = 100
	}

	result, err := Run("docker", []string{"compose", "-p", name, "logs", "--tail", strconv.Itoa(tail)}, 30*time.Second)
	if err != nil {
		return "", err
	}
	if result.ExitCode != 0 {
		return "", errors.New(result.Stdout + result.Stderr)
	}
	return result.Stdout + result.Stderr, nil
}

// --- Compose File Operations ---

func ReadComposeFile(path string) (string, error) {
	if path == "" {
		return "", errors.New("file path is required")
	}
	ext := filepath.Ext(path)
	if ext != ".yml" && ext != ".yaml" {
		return "", errors.New("only .yml and .yaml files are allowed")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", errors.New("failed to read file: " + err.Error())
	}
	return string(data), nil
}

func WriteComposeFile(path string, content string) error {
	if path == "" {
		return errors.New("file path is required")
	}
	ext := filepath.Ext(path)
	if ext != ".yml" && ext != ".yaml" {
		return errors.New("only .yml and .yaml files are allowed")
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return errors.New("failed to create directory: " + err.Error())
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return errors.New("failed to write file: " + err.Error())
	}
	return nil
}

func ValidateComposeFile(path string) (string, error) {
	if path == "" {
		return "", errors.New("file path is required")
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return "", errors.New("file does not exist: " + path)
	}
	result, err := Run("docker", []string{"compose", "-f", path, "config"}, 30*time.Second)
	if err != nil {
		return result.Stderr, errors.New("validation failed: " + result.Stdout + result.Stderr)
	}
	if result.ExitCode != 0 {
		return result.Stdout + result.Stderr, errors.New("validation failed")
	}
	return result.Stdout, nil
}

func DeployComposeFile(path string) error {
	if path == "" {
		return errors.New("file path is required")
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return errors.New("file does not exist: " + path)
	}
	result, err := Run("docker", []string{"compose", "-f", path, "up", "-d"}, 120*time.Second)
	if err != nil {
		return errors.New("deploy failed: " + result.Stdout + result.Stderr)
	}
	if result.ExitCode != 0 {
		return errors.New("deploy failed: " + result.Stdout + result.Stderr)
	}
	return nil
}
