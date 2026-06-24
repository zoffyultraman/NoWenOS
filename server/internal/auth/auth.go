package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
	"nowenos-server/internal/database"
)

var (
	secretKey       []byte
	once            sync.Once
	ErrUserExists   = errors.New("user already exists")
	ErrUserNotFound = errors.New("user not found")
	ErrCannotDelete = errors.New("cannot delete this user")
)

func initSecret() {
	once.Do(func() {
		keyPath := "data/secret.key"
		os.MkdirAll("data", 0755)

		if data, err := os.ReadFile(keyPath); err == nil && len(data) >= 32 {
			secretKey = data[:32]
			return
		}

		key := make([]byte, 32)
		rand.Read(key)
		os.WriteFile(keyPath, key, 0600)
		secretKey = key
	})
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token    string `json:"token"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

type UserInfo struct {
	Username string `json:"username"`
	Role     string `json:"role"`
}

type CreateUserRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}
type ChangePasswordRequest struct {
	OldPassword string `json:"oldPassword"`
	NewPassword string `json:"newPassword"`
}


func InitDB() {
	db := database.GetDB()

	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users WHERE username = 'admin'").Scan(&count)
	if err != nil || count == 0 {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Failed to hash admin password: %v", err)
			return
		}
		_, err = db.Exec("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", "admin", string(hashedPassword), "admin")
		if err != nil {
			log.Printf("Failed to create admin user: %v", err)
		}
	}

	err = db.QueryRow("SELECT COUNT(*) FROM users WHERE username = 'user'").Scan(&count)
	if err != nil || count == 0 {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("user"), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Failed to hash user password: %v", err)
			return
		}
		_, err = db.Exec("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", "user", string(hashedPassword), "user")
		if err != nil {
			log.Printf("Failed to create user: %v", err)
		}
	}
}

func Login(req LoginRequest) (*LoginResponse, error) {
	initSecret()

	db := database.GetDB()
	var user struct {
		Username string
		Password string
		Role     string
	}

	err := db.QueryRow("SELECT username, password, role FROM users WHERE username = ?", req.Username).
		Scan(&user.Username, &user.Password, &user.Role)
	if err == sql.ErrNoRows {
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	token, err := GenerateToken(req.Username)
	if err != nil {
		return nil, err
	}

	return &LoginResponse{
		Token:    token,
		Username: user.Username,
		Role:     user.Role,
	}, nil
}

// ValidateCredentials checks if the username and password are correct
// without generating a token. Used for 2FA flow where we need to
// validate credentials before asking for a TOTP code.
func ValidateCredentials(username, password string) error {
	db := database.GetDB()
	var storedPassword string

	err := db.QueryRow("SELECT password FROM users WHERE username = ?", username).Scan(&storedPassword)
	if err == sql.ErrNoRows {
		return ErrInvalidCredentials
	}
	if err != nil {
		return err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(password)); err != nil {
		return ErrInvalidCredentials
	}

	return nil
}

func GetUsers() []UserInfo {
	db := database.GetDB()
	rows, err := db.Query("SELECT username, role FROM users ORDER BY id")
	if err != nil {
		return []UserInfo{}
	}
	defer rows.Close()

	users := make([]UserInfo, 0)
	for rows.Next() {
		var user UserInfo
		if err := rows.Scan(&user.Username, &user.Role); err != nil {
			continue
		}
		users = append(users, user)
	}

	return users
}

func CreateUser(req CreateUserRequest) (*UserInfo, error) {
	if req.Username == "" || req.Password == "" {
		return nil, errors.New("username and password are required")
	}

	db := database.GetDB()

	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", req.Username).Scan(&count)
	if err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, ErrUserExists
	}

	role := req.Role
	if role == "" {
		role = "user"
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	_, err = db.Exec("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", req.Username, string(hashedPassword), role)
	if err != nil {
		return nil, err
	}

	return &UserInfo{
		Username: req.Username,
		Role:     role,
	}, nil
}

func DeleteUser(username string) error {
	if username == "" {
		return ErrUserNotFound
	}

	if username == "admin" {
		return ErrCannotDelete
	}

	db := database.GetDB()

	result, err := db.Exec("DELETE FROM users WHERE username = ?", username)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrUserNotFound
	}

	return nil
}

func ChangePassword(username string, req ChangePasswordRequest) error {
	if req.NewPassword == "" {
		return errors.New("new password is required")
	}
	if len(req.NewPassword) < 4 {
		return errors.New("password must be at least 4 characters")
	}

	db := database.GetDB()

	var currentPassword string
	err := db.QueryRow("SELECT password FROM users WHERE username = ?", username).Scan(&currentPassword)
	if err == sql.ErrNoRows {
		return ErrUserNotFound
	}
	if err != nil {
		return err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(currentPassword), []byte(req.OldPassword)); err != nil {
		return ErrInvalidCredentials
	}

	hashedNewPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	_, err = db.Exec("UPDATE users SET password = ? WHERE username = ?", string(hashedNewPassword), username)
	return err
}

func GenerateToken(username string) (string, error) {
	initSecret()

	payload := username + "|" + time.Now().Format(time.RFC3339Nano)
	mac := hmac.New(sha256.New, secretKey)
	mac.Write([]byte(payload))
	sig := hex.EncodeToString(mac.Sum(nil))

	return payload + "|" + sig, nil
}

func ValidateTokenAndExtractUser(token string) (string, error) {
	initSecret()

	parts := strings.SplitN(token, "|", 3)
	if len(parts) != 3 {
		return "", errors.New("invalid token format")
	}

	username := parts[0]
	timestampStr := parts[1]
	signature := parts[2]

	// Verify timestamp is not too old (24 hours)
	t, err := time.Parse(time.RFC3339Nano, timestampStr)
	if err != nil {
		return "", errors.New("invalid token timestamp")
	}
	if time.Since(t) > 24*time.Hour {
		return "", errors.New("token expired")
	}

	// Verify HMAC
	payload := username + "|" + timestampStr
	mac := hmac.New(sha256.New, secretKey)
	mac.Write([]byte(payload))
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(signature), []byte(expected)) {
		return "", errors.New("invalid token signature")
	}

	return username, nil
}

func GetUserRole(username string) string {
	db := database.GetDB()
	var role string
	err := db.QueryRow("SELECT role FROM users WHERE username = ?", username).Scan(&role)
	if err != nil {
		return "user"
	}
	return role
}

