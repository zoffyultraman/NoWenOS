package certs

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"database/sql"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"nowenos-server/internal/database"
	"nowenos-server/internal/systemadapter"
)

const (
	certDir     = "/var/lib/nowenos/certs"
	certbotBin  = "certbot"
	renewalDays = 30
)

// domainRe validates domain names: alphanumeric, dots, and hyphens only.
var domainRe = regexp.MustCompile(`^[a-zA-Z0-9.-]+$`)

// validateDomain checks that the domain name is safe for use in cert commands.
func validateDomain(domain string) error {
	if domain == "" {
		return errors.New("domain is empty")
	}
	if !domainRe.MatchString(domain) {
		return fmt.Errorf("invalid domain: %q", domain)
	}
	return nil
}

// Certificate represents a stored TLS certificate record.
type Certificate struct {
	ID         int64  `json:"id"`
	Domain     string `json:"domain"`
	Type       string `json:"type"`       // letsencrypt, selfsigned
	CertPath   string `json:"certPath"`
	KeyPath    string `json:"keyPath"`
	ExpiresAt  string `json:"expiresAt"`
	AutoRenew  bool   `json:"autoRenew"`
	CreatedAt  string `json:"createdAt"`
}

// CreateLERequest is the input for requesting a Let's Encrypt certificate.
type CreateLERequest struct {
	Domain    string `json:"domain"`
	Email     string `json:"email"`
	AutoRenew bool   `json:"autoRenew"`
}

// CreateSelfSignedRequest is the input for generating a self-signed certificate.
type CreateSelfSignedRequest struct {
	Domain    string `json:"domain"`
	Days      int    `json:"days"`
	AutoRenew bool   `json:"autoRenew"`
}

// Status reports whether certbot is available on the system.
type Status struct {
	CertbotInstalled bool   `json:"certbotInstalled"`
	CertbotVersion   string `json:"certbotVersion,omitempty"`
}

// InitTable creates the certificates table if it doesn't exist.
func InitTable() {
	db := database.GetDB()
	db.Exec(`CREATE TABLE IF NOT EXISTS certificates (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		domain TEXT NOT NULL,
		type TEXT NOT NULL DEFAULT 'selfsigned',
		cert_path TEXT NOT NULL,
		key_path TEXT NOT NULL,
		expires_at DATETIME,
		auto_renew INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	db.Exec("CREATE INDEX IF NOT EXISTS idx_certificates_domain ON certificates(domain)")
	os.MkdirAll(certDir, 0755)
}

// ListCertificates returns all certificate records ordered by creation time.
func ListCertificates() []Certificate {
	db := database.GetDB()
	rows, err := db.Query("SELECT id, domain, type, cert_path, key_path, expires_at, auto_renew, created_at FROM certificates ORDER BY created_at DESC")
	if err != nil {
		return []Certificate{}
	}
	defer rows.Close()
	return scanRows(rows)
}

// GetCertificate returns a single certificate by ID.
func GetCertificate(id int64) (*Certificate, error) {
	db := database.GetDB()
	row := db.QueryRow("SELECT id, domain, type, cert_path, key_path, expires_at, auto_renew, created_at FROM certificates WHERE id = ?", id)
	var cert Certificate
	var autoRenew int
	err := row.Scan(&cert.ID, &cert.Domain, &cert.Type, &cert.CertPath, &cert.KeyPath, &cert.ExpiresAt, &autoRenew, &cert.CreatedAt)
	if err != nil {
		return nil, err
	}
	cert.AutoRenew = autoRenew == 1
	return &cert, nil
}

// RequestLetsEncrypt obtains a certificate via certbot.
func RequestLetsEncrypt(req CreateLERequest) (*Certificate, error) {
	if req.Domain == "" {
		return nil, errors.New("domain is required")
	}
	if err := validateDomain(req.Domain); err != nil {
		return nil, err
	}
	if req.Email == "" {
		return nil, errors.New("email is required for Let's Encrypt")
	}

	domainDir := filepath.Join(certDir, req.Domain)
	os.MkdirAll(domainDir, 0755)

	certPath := filepath.Join(domainDir, "fullchain.pem")
	keyPath := filepath.Join(domainDir, "privkey.pem")

	// Run certbot in standalone mode
	result, err := systemadapter.Run(certbotBin, []string{
		"certonly",
		"--standalone",
		"--non-interactive",
		"--agree-tos",
		"--email", req.Email,
		"-d", req.Domain,
		"--cert-path", certPath,
		"--key-path", keyPath,
		"--fullchain-path", certPath,
	}, 120*time.Second)
	if err != nil {
		return nil, fmt.Errorf("certbot failed: %w", err)
	}
	if result.ExitCode != 0 {
		return nil, fmt.Errorf("certbot failed: %s", result.Stderr+result.Stdout)
	}

	// Parse expiry from the certificate
	expiresAt := parseCertExpiry(certPath)

	db := database.GetDB()
	autoRenewInt := 0
	if req.AutoRenew {
		autoRenewInt = 1
	}
	dbResult, err := db.Exec(
		"INSERT INTO certificates (domain, type, cert_path, key_path, expires_at, auto_renew) VALUES (?, 'letsencrypt', ?, ?, ?, ?)",
		req.Domain, certPath, keyPath, expiresAt, autoRenewInt,
	)
	if err != nil {
		return nil, fmt.Errorf("save certificate record: %w", err)
	}

	id, _ := dbResult.LastInsertId()
	return GetCertificate(id)
}

// GenerateSelfSigned creates a self-signed certificate for the given domain.
func GenerateSelfSigned(req CreateSelfSignedRequest) (*Certificate, error) {
	if req.Domain == "" {
		return nil, errors.New("domain is required")
	}
	if req.Days <= 0 {
		req.Days = 365
	}

	domainDir := filepath.Join(certDir, req.Domain)
	os.MkdirAll(domainDir, 0755)

	certPath := filepath.Join(domainDir, "fullchain.pem")
	keyPath := filepath.Join(domainDir, "privkey.pem")

	// Generate ECDSA private key
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate key: %w", err)
	}

	serialNumber, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return nil, fmt.Errorf("generate serial: %w", err)
	}

	notBefore := time.Now()
	notAfter := notBefore.AddDate(0, 0, req.Days)

	template := x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			CommonName:   req.Domain,
			Organization: []string{"NoWenOS Self-Signed"},
		},
		NotBefore:             notBefore,
		NotAfter:              notAfter,
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		DNSNames:              []string{req.Domain},
	}

	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &privateKey.PublicKey, privateKey)
	if err != nil {
		return nil, fmt.Errorf("create certificate: %w", err)
	}

	// Write certificate PEM
	certFile, err := os.Create(certPath)
	if err != nil {
		return nil, fmt.Errorf("create cert file: %w", err)
	}
	defer certFile.Close()
	pem.Encode(certFile, &pem.Block{Type: "CERTIFICATE", Bytes: certDER})

	// Write private key PEM
	keyDER, err := x509.MarshalECPrivateKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("marshal key: %w", err)
	}
	keyFile, err := os.Create(keyPath)
	if err != nil {
		return nil, fmt.Errorf("create key file: %w", err)
	}
	defer keyFile.Close()
	pem.Encode(keyFile, &pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})

	expiresAt := notAfter.Format(time.RFC3339)

	db := database.GetDB()
	autoRenewInt := 0
	if req.AutoRenew {
		autoRenewInt = 1
	}
	result, err := db.Exec(
		"INSERT INTO certificates (domain, type, cert_path, key_path, expires_at, auto_renew) VALUES (?, 'selfsigned', ?, ?, ?, ?)",
		req.Domain, certPath, keyPath, expiresAt, autoRenewInt,
	)
	if err != nil {
		return nil, fmt.Errorf("save certificate record: %w", err)
	}

	id, _ := result.LastInsertId()
	return GetCertificate(id)
}

// DeleteCertificate removes a certificate record and its files.
func DeleteCertificate(id int64) error {
	cert, err := GetCertificate(id)
	if err != nil {
		return errors.New("certificate not found")
	}

	// Remove files
	os.Remove(cert.CertPath)
	os.Remove(cert.KeyPath)
	// Remove domain directory if empty
	dir := filepath.Dir(cert.CertPath)
	os.Remove(dir)

	db := database.GetDB()
	_, err = db.Exec("DELETE FROM certificates WHERE id = ?", id)
	return err
}

// RenewCertificate renews a certificate. For Let's Encrypt, runs certbot renew.
// For self-signed, generates a new one with the same parameters.
func RenewCertificate(id int64) (*Certificate, error) {
	cert, err := GetCertificate(id)
	if err != nil {
		return nil, errors.New("certificate not found")
	}

	switch cert.Type {
	case "letsencrypt":
		result, err := systemadapter.Run(certbotBin, []string{
			"renew",
			"--cert-name", cert.Domain,
			"--non-interactive",
		}, 120*time.Second)
		if err != nil {
			return nil, fmt.Errorf("certbot renew failed: %w", err)
		}
		if result.ExitCode != 0 {
			return nil, fmt.Errorf("certbot renew failed: %s", result.Stderr+result.Stdout)
		}

		// Update expiry
		newExpiry := parseCertExpiry(cert.CertPath)
		db := database.GetDB()
		db.Exec("UPDATE certificates SET expires_at = ? WHERE id = ?", newExpiry, id)
		return GetCertificate(id)

	case "selfsigned":
		// Delete old files and regenerate
		os.Remove(cert.CertPath)
		os.Remove(cert.KeyPath)

		days := 365
		if cert.ExpiresAt != "" {
			expiry, err := time.Parse(time.RFC3339, cert.ExpiresAt)
			if err == nil {
				remaining := time.Until(expiry)
				if remaining > 0 {
					days = 365 // always regenerate for 1 year
				}
			}
		}

		// Generate new self-signed cert in-place
		domainDir := filepath.Dir(cert.CertPath)
		os.MkdirAll(domainDir, 0755)

		privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return nil, fmt.Errorf("generate key: %w", err)
		}

		serialNumber, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
		if err != nil {
			return nil, fmt.Errorf("generate serial: %w", err)
		}

		notBefore := time.Now()
		notAfter := notBefore.AddDate(0, 0, days)

		template := x509.Certificate{
			SerialNumber: serialNumber,
			Subject: pkix.Name{
				CommonName:   cert.Domain,
				Organization: []string{"NoWenOS Self-Signed"},
			},
			NotBefore:             notBefore,
			NotAfter:              notAfter,
			KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
			ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
			BasicConstraintsValid: true,
			DNSNames:              []string{cert.Domain},
		}

		certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &privateKey.PublicKey, privateKey)
		if err != nil {
			return nil, fmt.Errorf("create certificate: %w", err)
		}

		certFile, err := os.Create(cert.CertPath)
		if err != nil {
			return nil, fmt.Errorf("create cert file: %w", err)
		}
		pem.Encode(certFile, &pem.Block{Type: "CERTIFICATE", Bytes: certDER})
		certFile.Close()

		keyDER, err := x509.MarshalECPrivateKey(privateKey)
		if err != nil {
			return nil, fmt.Errorf("marshal key: %w", err)
		}
		keyFile, err := os.Create(cert.KeyPath)
		if err != nil {
			return nil, fmt.Errorf("create key file: %w", err)
		}
		pem.Encode(keyFile, &pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})
		keyFile.Close()

		expiresAt := notAfter.Format(time.RFC3339)
		db := database.GetDB()
		db.Exec("UPDATE certificates SET expires_at = ? WHERE id = ?", expiresAt, id)
		return GetCertificate(id)

	default:
		return nil, fmt.Errorf("unknown certificate type: %s", cert.Type)
	}
}

// ToggleAutoRenew enables or disables auto-renewal for a certificate.
func ToggleAutoRenew(id int64, autoRenew bool) error {
	db := database.GetDB()
	v := 0
	if autoRenew {
		v = 1
	}
	_, err := db.Exec("UPDATE certificates SET auto_renew = ? WHERE id = ?", v, id)
	return err
}

// GetStatus reports whether certbot is installed.
func GetStatus() Status {
	s := Status{}
	if !systemadapter.IsBinaryAvailable(certbotBin) {
		return s
	}
	s.CertbotInstalled = true
	result, err := systemadapter.Run(certbotBin, []string{"--version"}, 10*time.Second)
	if err == nil {
		s.CertbotVersion = result.Stdout + result.Stderr
	}
	return s
}

// AutoRenewCertificates renews all certificates with auto_renew enabled
// that are within the renewal window.
func AutoRenewCertificates() {
	db := database.GetDB()
	dbRows, err := db.Query(
		"SELECT id, domain, type, cert_path, key_path, expires_at, auto_renew, created_at FROM certificates WHERE auto_renew = 1",
	)
	if err != nil {
		return
	}
	defer dbRows.Close()

	certs := scanRows(dbRows)
	for _, cert := range certs {
		if cert.ExpiresAt == "" {
			continue
		}
		expiry, err := time.Parse(time.RFC3339, cert.ExpiresAt)
		if err != nil {
			continue
		}
		if time.Until(expiry) > renewalDays*24*time.Hour {
			continue
		}
		// Attempt renewal
		RenewCertificate(cert.ID)
	}
}

// StartAutoRenewScheduler runs auto-renewal checks daily.
func StartAutoRenewScheduler() {
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			AutoRenewCertificates()
		}
	}()
}

// --- helpers ---

func parseCertExpiry(certPath string) string {
	data, err := os.ReadFile(certPath)
	if err != nil {
		return ""
	}
	block, _ := pem.Decode(data)
	if block == nil {
		return ""
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return ""
	}
	return cert.NotAfter.Format(time.RFC3339)
}

func scanRows(rows *sql.Rows) []Certificate {
	var certs []Certificate
	for rows.Next() {
		var c Certificate
		var autoRenew int
		if err := rows.Scan(&c.ID, &c.Domain, &c.Type, &c.CertPath, &c.KeyPath, &c.ExpiresAt, &autoRenew, &c.CreatedAt); err != nil {
			continue
		}
		c.AutoRenew = autoRenew == 1
		certs = append(certs, c)
	}
	if certs == nil {
		return []Certificate{}
	}
	return certs
}

// ExportP12 reads the PEM cert and key files for the given certificate record
// and returns a PKCS#12 (.p12) byte slice. Uses openssl for conversion.
func ExportP12(id int64) ([]byte, error) {
	cert, err := GetCertificate(id)
	if err != nil {
		return nil, errors.New("certificate not found")
	}

	tmpFile, err := os.CreateTemp("", "nowenos-p12-*.p12")
	if err != nil {
		return nil, fmt.Errorf("create temp file: %w", err)
	}
	tmpFile.Close()
	defer os.Remove(tmpFile.Name())

	result, err := systemadapter.Run("openssl", []string{
		"pkcs12", "-export",
		"-in", cert.CertPath,
		"-inkey", cert.KeyPath,
		"-out", tmpFile.Name(),
		"-passout", "pass:",
	}, 30*time.Second)
	if err != nil {
		return nil, fmt.Errorf("openssl pkcs12 failed: %w", err)
	}
	if result.ExitCode != 0 {
		return nil, fmt.Errorf("openssl pkcs12 failed: %s", result.Stderr+result.Stdout)
	}

	data, err := os.ReadFile(tmpFile.Name())
	if err != nil {
		return nil, fmt.Errorf("read p12 file: %w", err)
	}
	return data, nil
}
