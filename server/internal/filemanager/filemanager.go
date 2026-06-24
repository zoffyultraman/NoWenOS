package filemanager

import (
	"archive/tar"
	"compress/gzip"
	"errors"
	"fmt"
	"io"
	"os"
	"os/user"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"syscall"
)

var (
	ErrPathRequired      = errors.New("path is required")
	ErrPathNotFound      = errors.New("path not found")
	ErrNotDirectory      = errors.New("path is not a directory")
	ErrNotFile           = errors.New("path is not a file")
	ErrFileExists        = errors.New("file already exists")
	ErrDeleteFailed      = errors.New("delete failed")
	ErrInvalidMode       = errors.New("invalid permission mode")
	ErrChmodFailed       = errors.New("chmod failed")
	ErrChownFailed       = errors.New("chown failed")
	ErrAccessDenied      = errors.New("access denied")

	// maxUploadSize is the default max upload size (10GB)
	maxUploadSize int64 = 10 * 1024 * 1024 * 1024

	// protectedPaths are system critical paths that cannot be deleted
	protectedPaths = []string{"/etc", "/var", "/usr", "/boot", "/sys", "/proc", "/dev"}
)

// getFileRoot returns the allowed root directory for file operations.
// Reads from NOWENOS_FILE_ROOT env var, defaults to "/".
func getFileRoot() string {
	if root := os.Getenv("NOWENOS_FILE_ROOT"); root != "" {
		return filepath.Clean(root)
	}
	return "/"
}

// isWithinRoot checks if the given path is within the allowed root directory.
func isWithinRoot(path string) error {
	root := getFileRoot()
	if root == "/" {
		return nil // no restriction when root is /
	}
	cleanPath := filepath.Clean(path)
	cleanRoot := filepath.Clean(root)
	if cleanPath == cleanRoot {
		return nil
	}
	if !strings.HasPrefix(cleanPath, cleanRoot+string(os.PathSeparator)) {
		return ErrAccessDenied
	}
	return nil
}

type FileEntry struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	IsDir   bool   `json:"isDir"`
	Size    int64  `json:"size"`
	ModTime string `json:"modTime"`
}

type BrowseResult struct {
	Path    string      `json:"path"`
	Parent  string      `json:"parent"`
	Entries []FileEntry `json:"entries"`
}

func Browse(dirPath string) (*BrowseResult, error) {
	if dirPath == "" {
		return nil, ErrPathRequired
	}

	dirPath = filepath.Clean(dirPath)

	if err := isWithinRoot(dirPath); err != nil {
		return nil, err
	}

	info, err := os.Stat(dirPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrPathNotFound
		}
		return nil, err
	}

	if !info.IsDir() {
		return nil, ErrNotDirectory
	}

	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, err
	}

	files := make([]FileEntry, 0, len(entries))
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), ".") {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		files = append(files, FileEntry{
			Name:    entry.Name(),
			Path:    filepath.Join(dirPath, entry.Name()),
			IsDir:   entry.IsDir(),
			Size:    info.Size(),
			ModTime: info.ModTime().Format("2006-01-02 15:04:05"),
		})
	}

	sort.Slice(files, func(i, j int) bool {
		if files[i].IsDir != files[j].IsDir {
			return files[i].IsDir
		}
		return strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
	})

	parent := filepath.Dir(dirPath)
	if parent == dirPath {
		parent = ""
	}

	return &BrowseResult{
		Path:    dirPath,
		Parent:  parent,
		Entries: files,
	}, nil
}

func GetFileInfo(filePath string) (*FileEntry, error) {
	if filePath == "" {
		return nil, ErrPathRequired
	}

	filePath = filepath.Clean(filePath)

	if err := isWithinRoot(filePath); err != nil {
		return nil, err
	}

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

	return &FileEntry{
		Name:    info.Name(),
		Path:    filePath,
		IsDir:   false,
		Size:    info.Size(),
		ModTime: info.ModTime().Format("2006-01-02 15:04:05"),
	}, nil
func GetFileInfo(filePath string) (*FileDetails, error) {
	return GetFileDetails(filePath)
}

func OpenFile(filePath string) (*os.File, error) {
	if filePath == "" {
		return nil, ErrPathRequired
	}

	filePath = filepath.Clean(filePath)

	if err := isWithinRoot(filePath); err != nil {
		return nil, err
	}

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

	return os.Open(filePath)
}

func Upload(dirPath string, filename string, reader io.Reader) (*FileEntry, error) {
	if dirPath == "" {
		return nil, ErrPathRequired
	}

	dirPath = filepath.Clean(dirPath)

	if err := isWithinRoot(dirPath); err != nil {
		return nil, err
	}

	info, err := os.Stat(dirPath)
	if err != nil {
		return nil, ErrPathNotFound
	}

	if !info.IsDir() {
		return nil, ErrNotDirectory
	}

	filename = filepath.Base(filename)
	if filename == "." || filename == ".." {
		return nil, errors.New("invalid filename")
	}

	targetPath := filepath.Join(dirPath, filename)

	if _, err := os.Stat(targetPath); err == nil {
		return nil, ErrFileExists
	}

	dst, err := os.Create(targetPath)
	if err != nil {
		return nil, err
	}
	defer dst.Close()

	// Limit upload size to prevent abuse
	limitedReader := io.LimitReader(reader, maxUploadSize+1)
	written, err := io.Copy(dst, limitedReader)
	if written > maxUploadSize {
		dst.Close()
		os.Remove(targetPath)
		return nil, fmt.Errorf("file too large: max upload size is %d bytes", maxUploadSize)
	}
	if err != nil {
		os.Remove(targetPath)
		return nil, err
	}

	dstInfo, err := os.Stat(targetPath)
	if err != nil {
		return nil, err
	}

	return &FileEntry{
		Name:    filename,
		Path:    targetPath,
		IsDir:   false,
		Size:    written,
		ModTime: dstInfo.ModTime().Format("2006-01-02 15:04:05"),
	}, nil
}

func Delete(targetPath string) error {
	if targetPath == "" {
		return ErrPathRequired
	}

	targetPath = filepath.Clean(targetPath)

	if targetPath == "/" || targetPath == "." || targetPath == ".." {
		return errors.New("cannot delete this path")
	}

	if err := isWithinRoot(targetPath); err != nil {
		return err
	}

	// Protect system critical paths
	for _, p := range protectedPaths {
		if targetPath == p || strings.HasPrefix(targetPath, p+string(os.PathSeparator)) {
			return fmt.Errorf("cannot delete system critical path: %s", targetPath)
		}
	}

	info, err := os.Stat(targetPath)
	if err != nil {
		return ErrPathNotFound
	}

	if info.IsDir() {
		return os.RemoveAll(targetPath)
	}

	return os.Remove(targetPath)
}

func CreateDir(parentPath, dirName string) (*FileEntry, error) {
	if parentPath == "" {
		return nil, ErrPathRequired
	}

	parentPath = filepath.Clean(parentPath)

	if err := isWithinRoot(parentPath); err != nil {
		return nil, err
	}

	info, err := os.Stat(parentPath)
	if err != nil {
		return nil, ErrPathNotFound
	}

	if !info.IsDir() {
		return nil, ErrNotDirectory
	}

	dirName = filepath.Base(dirName)
	if dirName == "." || dirName == ".." {
		return nil, errors.New("invalid directory name")
	}

	newPath := filepath.Join(parentPath, dirName)

	if err := os.MkdirAll(newPath, 0755); err != nil {
		return nil, err
	}

	return &FileEntry{
		Name:    dirName,
		Path:    newPath,
		IsDir:   true,
		Size:    0,
		ModTime: "",
	}, nil
}

func Rename(oldPath, newName string) (*FileEntry, error) {
	if oldPath == "" || newName == "" {
		return nil, ErrPathRequired
	}
	oldPath = filepath.Clean(oldPath)
	newName = filepath.Base(newName)
	if newName == "." || newName == ".." {
		return nil, errors.New("invalid name")
	}

	if err := isWithinRoot(oldPath); err != nil {
		return nil, err
	}

	info, err := os.Stat(oldPath)
	if err != nil {
		return nil, ErrPathNotFound
	}

	newPath := filepath.Join(filepath.Dir(oldPath), newName)
	if _, err := os.Stat(newPath); err == nil {
		return nil, ErrFileExists
	}

	if err := os.Rename(oldPath, newPath); err != nil {
		return nil, err
	}

	newInfo, _ := os.Stat(newPath)
	return &FileEntry{
		Name:    newName,
		Path:    newPath,
		IsDir:   info.IsDir(),
		Size:    newInfo.Size(),
		ModTime: newInfo.ModTime().Format("2006-01-02 15:04:05"),
	}, nil
}

func Move(sourcePath, destDir string) (*FileEntry, error) {
	if sourcePath == "" || destDir == "" {
		return nil, ErrPathRequired
	}
	sourcePath = filepath.Clean(sourcePath)
	destDir = filepath.Clean(destDir)

	if err := isWithinRoot(sourcePath); err != nil {
		return nil, err
	}
	if err := isWithinRoot(destDir); err != nil {
		return nil, err
	}

	info, err := os.Stat(sourcePath)
	if err != nil {
		return nil, ErrPathNotFound
	}

	destInfo, err := os.Stat(destDir)
	if err != nil || !destInfo.IsDir() {
		return nil, ErrNotDirectory
	}

	newPath := filepath.Join(destDir, filepath.Base(sourcePath))
	if _, err := os.Stat(newPath); err == nil {
		return nil, ErrFileExists
	}

	if err := os.Rename(sourcePath, newPath); err != nil {
		return nil, err
	}

	newInfo, _ := os.Stat(newPath)
	return &FileEntry{
		Name:    filepath.Base(newPath),
		Path:    newPath,
		IsDir:   info.IsDir(),
		Size:    newInfo.Size(),
		ModTime: newInfo.ModTime().Format("2006-01-02 15:04:05"),
	}, nil
}

var ErrSearchLimitReached = errors.New("search result limit reached")

func SearchFiles(rootPath, query string) ([]FileEntry, error) {
	if rootPath == "" {
		return nil, ErrPathRequired
	}
	if query == "" {
		return nil, errors.New("search query is required")
	}

	rootPath = filepath.Clean(rootPath)

	if err := isWithinRoot(rootPath); err != nil {
		return nil, err
	}

	info, err := os.Stat(rootPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrPathNotFound
		}
		return nil, err
	}
	if !info.IsDir() {
		return nil, ErrNotDirectory
	}

	query = strings.ToLower(query)
	results := make([]FileEntry, 0)
	limit := 100

	err = filepath.Walk(rootPath, func(path string, fi os.FileInfo, err error) error {
		if err != nil {
			return nil // skip entries we can't access
		}
		if strings.HasPrefix(fi.Name(), ".") {
			if fi.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.Contains(strings.ToLower(fi.Name()), query) {
			results = append(results, FileEntry{
				Name:    fi.Name(),
				Path:    path,
				IsDir:   fi.IsDir(),
				Size:    fi.Size(),
				ModTime: fi.ModTime().Format("2006-01-02 15:04:05"),
			})
			if len(results) >= limit {
				return ErrSearchLimitReached
			}
		}
		return nil
	})
	if err != nil && !errors.Is(err, ErrSearchLimitReached) {
		return nil, err
	}

	sort.Slice(results, func(i, j int) bool {
		if results[i].IsDir != results[j].IsDir {
			return results[i].IsDir
		}
		return strings.ToLower(results[i].Name) < strings.ToLower(results[j].Name)
	})

	return results, nil
}

func CompressFiles(paths []string, destPath string) error {
	if len(paths) == 0 {
		return errors.New("at least one source path is required")
	}
	if destPath == "" {
		return ErrPathRequired
	}

	destPath = filepath.Clean(destPath)
	if !strings.HasSuffix(destPath, ".tar.gz") {
		return errors.New("destination must have .tar.gz extension")
	}

	if err := isWithinRoot(destPath); err != nil {
		return err
	}

	// Validate all source paths exist
	for _, p := range paths {
		p = filepath.Clean(p)
		if err := isWithinRoot(p); err != nil {
			return err
		}
		if _, err := os.Stat(p); err != nil {
			return fmt.Errorf("source path not found: %s", p)
		}
	}

	outFile, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("failed to create archive: %w", err)
	}
	defer outFile.Close()

	gw := gzip.NewWriter(outFile)
	defer gw.Close()

	tw := tar.NewWriter(gw)
	defer tw.Close()

	for _, srcPath := range paths {
		srcPath = filepath.Clean(srcPath)
		baseName := filepath.Base(srcPath)

		err := filepath.Walk(srcPath, func(fullPath string, fi os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			// Build the name relative to the parent of srcPath
			relPath, err := filepath.Rel(filepath.Dir(srcPath), fullPath)
			if err != nil {
				return err
			}

			header, err := tar.FileInfoHeader(fi, "")
			if err != nil {
				return err
			}
			header.Name = relPath

			if fi.Mode().IsDir() {
				header.Name += "/"
			}

			if err := tw.WriteHeader(header); err != nil {
				return err
			}

			if !fi.Mode().IsRegular() {
				return nil
			}

			f, err := os.Open(fullPath)
			if err != nil {
				return err
			}
			defer f.Close()

			if _, err := io.Copy(tw, f); err != nil {
				return err
			}

			return nil
		})
		if err != nil {
			return fmt.Errorf("failed to archive %s: %w", baseName, err)
		}
	}

	return nil
}

func ExtractFile(archivePath, destDir string) error {
	if archivePath == "" || destDir == "" {
		return ErrPathRequired
	}

	archivePath = filepath.Clean(archivePath)
	destDir = filepath.Clean(destDir)

	if err := isWithinRoot(archivePath); err != nil {
		return err
	}
	if err := isWithinRoot(destDir); err != nil {
		return err
	}

	if _, err := os.Stat(archivePath); err != nil {
		return ErrPathNotFound
	}

	// Ensure destination directory exists
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	f, err := os.Open(archivePath)
	if err != nil {
		return fmt.Errorf("failed to open archive: %w", err)
	}
	defer f.Close()

	gr, err := gzip.NewReader(f)
	if err != nil {
		return fmt.Errorf("failed to read gzip: %w", err)
	}
	defer gr.Close()

	tr := tar.NewReader(gr)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read tar entry: %w", err)
		}

		target := filepath.Join(destDir, header.Name)

		// Prevent path traversal
		if !strings.HasPrefix(filepath.Clean(target), filepath.Clean(destDir)) {
			return fmt.Errorf("invalid archive entry: %s", header.Name)
		}

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, os.FileMode(header.Mode)); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}
			outFile, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(header.Mode))
			if err != nil {
				return err
			}
			if _, err := io.Copy(outFile, tr); err != nil {
				outFile.Close()
				return err
			}
			outFile.Close()
		}
	}

	return nil
}

// FileDetails contains extended file information including permissions and ownership.
type FileDetails struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	IsDir     bool   `json:"isDir"`
	Size      int64  `json:"size"`
	ModTime   string `json:"modTime"`
	Mode      string `json:"mode"`      // e.g. "rwxr-xr-x"
	ModeOctal string `json:"modeOctal"` // e.g. "755"
	Owner     string `json:"owner"`
	Group     string `json:"group"`
	UID       uint32 `json:"uid"`
	GID       uint32 `json:"gid"`
}

// GetFileDetails returns detailed file info including permissions, owner and group.
func GetFileDetails(filePath string) (*FileDetails, error) {
	if filePath == "" {
		return nil, ErrPathRequired
	}

	filePath = filepath.Clean(filePath)

	if err := isWithinRoot(filePath); err != nil {
		return nil, err
	}

	info, err := os.Lstat(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrPathNotFound
		}
		return nil, err
	}

	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return &FileDetails{
			Name:      info.Name(),
			Path:      filePath,
			IsDir:     info.IsDir(),
			Size:      info.Size(),
			ModTime:   info.ModTime().Format("2006-01-02 15:04:05"),
			Mode:      info.Mode().Perm().String(),
			ModeOctal: fmt.Sprintf("%04o", info.Mode().Perm()),
		}, nil
	}

	ownerName := lookupUsername(stat.Uid)
	groupName := lookupGroupname(stat.Gid)

	return &FileDetails{
		Name:      info.Name(),
		Path:      filePath,
		IsDir:     info.IsDir(),
		Size:      info.Size(),
		ModTime:   info.ModTime().Format("2006-01-02 15:04:05"),
		Mode:      formatPermission(info.Mode().Perm()),
		ModeOctal: fmt.Sprintf("%04o", info.Mode().Perm()),
		Owner:     ownerName,
		Group:     groupName,
		UID:       stat.Uid,
		GID:       stat.Gid,
	}, nil
}

func lookupUsername(uid uint32) string {
	u, err := user.LookupId(strconv.FormatUint(uint64(uid), 10))
	if err != nil {
		return strconv.FormatUint(uint64(uid), 10)
	}
	return u.Username
}

func lookupGroupname(gid uint32) string {
	g, err := user.LookupGroupId(strconv.FormatUint(uint64(gid), 10))
	if err != nil {
		return strconv.FormatUint(uint64(gid), 10)
	}
	return g.Name
}

func formatPermission(mode os.FileMode) string {
	return fmt.Sprintf("%s%s%s%s%s%s%s%s%s",
		boolStr(mode&0400 != 0, "r", "-"),
		boolStr(mode&0200 != 0, "w", "-"),
		boolStr(mode&0100 != 0, "x", "-"),
		boolStr(mode&040 != 0, "r", "-"),
		boolStr(mode&020 != 0, "w", "-"),
		boolStr(mode&010 != 0, "x", "-"),
		boolStr(mode&04 != 0, "r", "-"),
		boolStr(mode&02 != 0, "w", "-"),
		boolStr(mode&01 != 0, "x", "-"),
	)
}

func boolStr(cond bool, yes, no string) string {
	if cond {
		return yes
	}
	return no
}

// ParseMode parses a permission mode string. Supports octal (e.g. "755") and symbolic (e.g. "u+x,go-w").
func ParseMode(modeStr string) (os.FileMode, error) {
	modeStr = strings.TrimSpace(modeStr)
	if modeStr == "" {
		return 0, ErrInvalidMode
	}

	// Try octal first
	if mode, err := parseOctalMode(modeStr); err == nil {
		return mode, nil
	}

	// Try symbolic mode
	return parseSymbolicMode(modeStr)
}

func parseOctalMode(s string) (os.FileMode, error) {
	// Allow 3 or 4 digit octal
	if len(s) == 3 || len(s) == 4 {
		val, err := strconv.ParseUint(s, 8, 32)
		if err != nil {
			return 0, err
		}
		return os.FileMode(val), nil
	}
	return 0, fmt.Errorf("not octal")
}

func parseSymbolicMode(modeStr string) (os.FileMode, error) {
	// Symbolic mode: u+r,g-w,o=rx  etc.
	parts := strings.Split(modeStr, ",")
	var result os.FileMode

	for _, part := range parts {
		part = strings.TrimSpace(part)
		if len(part) < 2 {
			return 0, ErrInvalidMode
		}

		// Determine the operator position
		var opIdx int
		for i, ch := range part {
			if ch == '+' || ch == '-' || ch == '=' {
				opIdx = i
				break
			}
		}
		if opIdx == 0 {
			return 0, ErrInvalidMode
		}

		who := part[:opIdx]
		op := rune(part[opIdx])
		perms := part[opIdx+1:]

		var permBits os.FileMode
		for _, p := range perms {
			switch p {
			case 'r':
				permBits |= 4
			case 'w':
				permBits |= 2
			case 'x':
				permBits |= 1
			default:
				return 0, ErrInvalidMode
			}
		}

		var userBits os.FileMode
		for _, w := range who {
			switch w {
			case 'u':
				userBits |= 0700
			case 'g':
				userBits |= 0070
			case 'o':
				userBits |= 0007
			case 'a':
				userBits |= 0777
			default:
				return 0, ErrInvalidMode
			}
		}

		// Apply permissions
		var fullPerm os.FileMode
		if userBits&0700 != 0 {
			fullPerm |= permBits << 6
		}
		if userBits&0070 != 0 {
			fullPerm |= permBits << 3
		}
		if userBits&0007 != 0 {
			fullPerm |= permBits
		}

		switch op {
		case '+':
			result |= fullPerm
		case '-':
			result &^= fullPerm
		case '=':
			var clearMask os.FileMode
			if userBits&0700 != 0 {
				clearMask |= 0700
			}
			if userBits&0070 != 0 {
				clearMask |= 0070
			}
			if userBits&0007 != 0 {
				clearMask |= 0007
			}
			result &^= clearMask
			result |= fullPerm
		}
	}

	return result, nil
}

// ChangePermissions changes the permissions of a file or directory.
// modeStr supports octal ("755") and symbolic ("u+x,go-w") formats.
// If recursive is true and the target is a directory, permissions are applied recursively.
func ChangePermissions(path string, modeStr string, recursive bool) error {
	if path == "" {
		return ErrPathRequired
	}

	path = filepath.Clean(path)

	if err := isWithinRoot(path); err != nil {
		return err
	}

	info, err := os.Lstat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return ErrPathNotFound
		}
		return err
	}

	mode, err := ParseMode(modeStr)
	if err != nil {
		return fmt.Errorf("%w: %s", ErrInvalidMode, err)
	}

	if err := os.Chmod(path, mode); err != nil {
		return fmt.Errorf("%w: %s", ErrChmodFailed, err)
	}

	if recursive && info.IsDir() {
		err := filepath.Walk(path, func(walkPath string, fi os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if walkPath == path {
				return nil
			}
			if e := os.Chmod(walkPath, mode); e != nil {
				return nil
			}
			return nil
		})
		if err != nil {
			return err
		}
	}

	return nil
}

// ChangeOwner changes the owner and/or group of a file or directory.
// Pass empty string to keep the current owner or group.
// If recursive is true and the target is a directory, ownership is applied recursively.
func ChangeOwner(path string, ownerName string, groupName string, recursive bool) error {
	if path == "" {
		return ErrPathRequired
	}

	path = filepath.Clean(path)

	if err := isWithinRoot(path); err != nil {
		return err
	}

	info, err := os.Lstat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return ErrPathNotFound
		}
		return err
	}

	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return errors.New("cannot determine current ownership")
	}

	uid := int(stat.Uid)
	gid := int(stat.Gid)

	if ownerName != "" {
		u, err := user.Lookup(ownerName)
		if err != nil {
			return fmt.Errorf("user not found: %s", ownerName)
		}
		uidVal, err := strconv.Atoi(u.Uid)
		if err != nil {
			return fmt.Errorf("invalid uid for user: %s", ownerName)
		}
		uid = uidVal
	}

	if groupName != "" {
		g, err := user.LookupGroup(groupName)
		if err != nil {
			return fmt.Errorf("group not found: %s", groupName)
		}
		gidVal, err := strconv.Atoi(g.Gid)
		if err != nil {
			return fmt.Errorf("invalid gid for group: %s", groupName)
		}
		gid = gidVal
	}

	if err := os.Lchown(path, uid, gid); err != nil {
		return fmt.Errorf("%w: %s", ErrChownFailed, err)
	}

	if recursive && info.IsDir() {
		err := filepath.Walk(path, func(walkPath string, fi os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if walkPath == path {
				return nil
			}
			if e := os.Lchown(walkPath, uid, gid); e != nil {
				return nil
			}
			return nil
		})
		if err != nil {
			return err
		}
	}

	return nil
}