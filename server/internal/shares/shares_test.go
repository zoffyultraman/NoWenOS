package shares

import (
	"testing"

	"nowenos-server/internal/database"
)

func setupTestDB(t *testing.T) {
	t.Helper()
	database.InitTestDB()
	InitTable()
}

func TestValidateSharePath(t *testing.T) {
	// Empty path always fails
	err := ValidateSharePath("")
	if err == nil {
		t.Error("expected error for empty path")
	}

	// Valid paths should pass
	validPaths := []string{"/mnt/data", "/home/user/shared", "/srv/nas"}
	for _, p := range validPaths {
		err := ValidateSharePath(p)
		if err != nil {
			t.Errorf("ValidateSharePath(%q) unexpected error: %v", p, err)
		}
	}
}

func TestCreateShare(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	share, err := CreateShare(CreateShareRequest{
		Name:     "testshare",
		Path:     "/mnt/data/test",
		Protocol: "smb",
		ReadOnly: false,
		Guest:    false,
		Comment:  "test comment",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if share.Name != "testshare" {
		t.Errorf("expected name 'testshare', got '%s'", share.Name)
	}
	if share.Path != "/mnt/data/test" {
		t.Errorf("expected path '/mnt/data/test', got '%s'", share.Path)
	}
	if share.Protocol != "smb" {
		t.Errorf("expected protocol 'smb', got '%s'", share.Protocol)
	}
	if !share.Enabled {
		t.Error("expected share to be enabled by default")
	}
}

func TestCreateShare_BlockedPath(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	// Empty path is always blocked
	_, err := CreateShare(CreateShareRequest{
		Name:     "bad",
		Path:     "",
		Protocol: "smb",
	})
	if err == nil {
		t.Error("expected error for empty path")
	}
}

func TestCreateShare_EmptyName(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	_, err := CreateShare(CreateShareRequest{
		Name:     "",
		Path:     "/mnt/data",
		Protocol: "smb",
	})
	if err == nil {
		t.Error("expected error for empty name")
	}
}

func TestGetShares(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	CreateShare(CreateShareRequest{Name: "s1", Path: "/mnt/a", Protocol: "smb"})
	CreateShare(CreateShareRequest{Name: "s2", Path: "/mnt/b", Protocol: "nfs"})

	shares := GetShares()
	if len(shares) != 2 {
		t.Errorf("expected 2 shares, got %d", len(shares))
	}
}

func TestGetShare(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	created, _ := CreateShare(CreateShareRequest{Name: "myshare", Path: "/mnt/x", Protocol: "webdav"})

	found, err := GetShare(created.ID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if found.Name != "myshare" {
		t.Errorf("expected name 'myshare', got '%s'", found.Name)
	}
}

func TestGetShare_NotFound(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	_, err := GetShare(999)
	if err == nil {
		t.Error("expected error for non-existent share")
	}
}

func TestUpdateShare(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	created, _ := CreateShare(CreateShareRequest{Name: "original", Path: "/mnt/a", Protocol: "smb"})

	updated, err := UpdateShare(created.ID, CreateShareRequest{
		Name:     "renamed",
		Path:     "/mnt/b",
		Protocol: "nfs",
		ReadOnly: true,
		Comment:  "updated",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if updated.Name != "renamed" {
		t.Errorf("expected name 'renamed', got '%s'", updated.Name)
	}
	if updated.Protocol != "nfs" {
		t.Errorf("expected protocol 'nfs', got '%s'", updated.Protocol)
	}
	if !updated.ReadOnly {
		t.Error("expected readOnly to be true")
	}
}

func TestToggleShare(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	created, _ := CreateShare(CreateShareRequest{Name: "toggle", Path: "/mnt/t", Protocol: "smb"})

	err := ToggleShare(created.ID, false)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	found, _ := GetShare(created.ID)
	if found.Enabled {
		t.Error("expected share to be disabled after toggle")
	}
}

func TestDeleteShare(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	created, _ := CreateShare(CreateShareRequest{Name: "todelete", Path: "/mnt/d", Protocol: "smb"})

	err := DeleteShare(created.ID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	_, err = GetShare(created.ID)
	if err == nil {
		t.Error("expected error after deletion")
	}
}

func TestBoolToInt(t *testing.T) {
	if boolToInt(true) != 1 {
		t.Error("expected boolToInt(true) == 1")
	}
	if boolToInt(false) != 0 {
		t.Error("expected boolToInt(false) == 0")
	}
}

