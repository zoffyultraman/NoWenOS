package tlsconfig

import "os"

// TLSConfig holds TLS configuration loaded from environment variables.
type TLSConfig struct {
	CertFile string
	KeyFile  string
	Enabled  bool
}

// Load reads TLS configuration from environment variables.
func Load() TLSConfig {
	cert := os.Getenv("NOWENOS_TLS_CERT")
	key := os.Getenv("NOWENOS_TLS_KEY")
	return TLSConfig{
		CertFile: cert,
		KeyFile:  key,
		Enabled:  cert != "" && key != "",
	}
}
