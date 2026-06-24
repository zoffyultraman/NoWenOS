package filemanager

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

const maxPreviewSize int64 = 10 * 1024 * 1024 // 10MB

var (
	ErrFileTooLarge      = errors.New("file too large for preview (max 10MB)")
	ErrUnsupportedType   = errors.New("file type not supported for preview")
	ErrPreviewFailed     = errors.New("preview generation failed")
)

// PreviewType indicates how the frontend should render the preview.
type PreviewType string

const (
	PreviewTypeImage PreviewType = "image"
	PreviewTypeText  PreviewType = "text"
	PreviewTypePDF   PreviewType = "pdf"
)

// PreviewResult holds the data returned by PreviewFile.
type PreviewResult struct {
	Type        PreviewType `json:"type"`
	Name        string      `json:"name"`
	Size        int64       `json:"size"`
	ContentType string      `json:"contentType"`
	// For image: base64-encoded data URL (data:mime;base64,...)
	// For text:  raw file content
	Content string `json:"content"`
	// For PDF: preview download URL
	URL string `json:"url,omitempty"`
}

var imageExtensions = map[string]string{
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".gif":  "image/gif",
	".webp": "image/webp",
}

var textExtensions = map[string]string{
	".txt":  "text/plain",
	".md":   "text/markdown",
	".json": "application/json",
	".yaml": "text/yaml",
	".yml":  "text/yaml",
	".xml":  "application/xml",
	".go":   "text/x-go",
	".js":   "text/javascript",
	".ts":   "text/typescript",
	".tsx":  "text/typescript",
	".css":  "text/css",
	".html": "text/html",
	".sh":   "text/x-shellscript",
	".py":   "text/x-python",
	".csv":  "text/csv",
	".log":  "text/plain",
	".toml": "text/plain",
	".ini":  "text/plain",
	".conf": "text/plain",
	".cfg":  "text/plain",
	".env":  "text/plain",
}

var pdfExtensions = map[string]bool{
	".pdf": true,
}

// PreviewFile reads a file and returns preview data based on its type.
// Supported: images (jpg/png/gif/webp), text files, PDF.
// Max file size: 10MB.
func PreviewFile(filePath string) (*PreviewResult, error) {
	if filePath == "" {
		return nil, ErrPathRequired
	}

	filePath = filepath.Clean(filePath)

	info, err := os.Stat(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrPathNotFound
		}
		return nil, err
	}

	if info.IsDir() {
		return nil, ErrNotFile
	}

	if info.Size() > maxPreviewSize {
		return nil, ErrFileTooLarge
	}

	ext := strings.ToLower(filepath.Ext(filePath))
	name := info.Name()

	// Image -> base64
	if mimeType, ok := imageExtensions[ext]; ok {
		data, err := os.ReadFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrPreviewFailed, err)
		}
		encoded := base64.StdEncoding.EncodeToString(data)
		return &PreviewResult{
			Type:        PreviewTypeImage,
			Name:        name,
			Size:        info.Size(),
			ContentType: mimeType,
			Content:     fmt.Sprintf("data:%s;base64,%s", mimeType, encoded),
		}, nil
	}

	// Text -> raw content
	if mimeType, ok := textExtensions[ext]; ok {
		data, err := os.ReadFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrPreviewFailed, err)
		}
		return &PreviewResult{
			Type:        PreviewTypeText,
			Name:        name,
			Size:        info.Size(),
			ContentType: mimeType,
			Content:     string(data),
		}, nil
	}

	// PDF -> download URL
	if pdfExtensions[ext] {
		return &PreviewResult{
			Type:        PreviewTypePDF,
			Name:        name,
			Size:        info.Size(),
			ContentType: "application/pdf",
			URL:         fmt.Sprintf("/api/v1/files/download?path=%s", url.QueryEscape(filePath)),
		}, nil
	}

	return nil, ErrUnsupportedType
}
