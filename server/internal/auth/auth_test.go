package auth

import (
	"testing"

	"nowenos-server/internal/database"
)

func setupTestDB(t *testing.T) {
	t.Helper()
	database.InitTestDB()
	InitDB()
}

func TestLogin_Success(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	resp, err := Login(LoginRequest{Username: "admin", Password: "admin"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.Username != "admin" {
		t.Errorf("expected username 'admin', got '%s'", resp.Username)
	}
	if resp.Role != "admin" {
		t.Errorf("expected role 'admin', got '%s'", resp.Role)
	}
	if resp.Token == "" {
		t.Error("expected non-empty token")
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	_, err := Login(LoginRequest{Username: "admin", Password: "wrong"})
	if err != ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestLogin_UnknownUser(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	_, err := Login(LoginRequest{Username: "nobody", Password: "x"})
	if err != ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestGetUsers(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	users := GetUsers()
	if len(users) < 2 {
		t.Errorf("expected at least 2 users, got %d", len(users))
	}
}

func TestCreateUser_Success(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	user, err := CreateUser(CreateUserRequest{Username: "testuser", Password: "pass123", Role: "user"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if user.Username != "testuser" {
		t.Errorf("expected username 'testuser', got '%s'", user.Username)
	}
	if user.Role != "user" {
		t.Errorf("expected role 'user', got '%s'", user.Role)
	}
}

func TestCreateUser_Duplicate(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	_, err := CreateUser(CreateUserRequest{Username: "admin", Password: "x"})
	if err != ErrUserExists {
		t.Errorf("expected ErrUserExists, got %v", err)
	}
}

func TestCreateUser_EmptyFields(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	_, err := CreateUser(CreateUserRequest{Username: "", Password: "x"})
	if err == nil {
		t.Error("expected error for empty username")
	}
}

func TestDeleteUser_Success(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	_, err := CreateUser(CreateUserRequest{Username: "todelete", Password: "x"})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	err = DeleteUser("todelete")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestDeleteUser_Admin(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	err := DeleteUser("admin")
	if err != ErrCannotDelete {
		t.Errorf("expected ErrCannotDelete, got %v", err)
	}
}

func TestDeleteUser_NotFound(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	err := DeleteUser("nobody")
	if err != ErrUserNotFound {
		t.Errorf("expected ErrUserNotFound, got %v", err)
	}
}

func TestChangePassword_Success(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	err := ChangePassword("admin", ChangePasswordRequest{OldPassword: "admin", NewPassword: "newpass"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	resp, err := Login(LoginRequest{Username: "admin", Password: "newpass"})
	if err != nil {
		t.Fatalf("login with new password failed: %v", err)
	}
	if resp.Username != "admin" {
		t.Errorf("expected username 'admin', got '%s'", resp.Username)
	}
}

func TestChangePassword_WrongOld(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	err := ChangePassword("admin", ChangePasswordRequest{OldPassword: "wrong", NewPassword: "newpass"})
	if err != ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestChangePassword_ShortPassword(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	err := ChangePassword("admin", ChangePasswordRequest{OldPassword: "admin", NewPassword: "ab"})
	if err == nil {
		t.Error("expected error for short password")
	}
}

func TestValidateToken(t *testing.T) {
	setupTestDB(t)
	defer database.CloseTestDB()

	if !ValidateToken("any-token") {
		t.Error("expected valid token to return true")
	}
	if ValidateToken("") {
		t.Error("expected empty token to return false")
	}
}

