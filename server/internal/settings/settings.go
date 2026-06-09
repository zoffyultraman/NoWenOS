package settings

import (
	"log"
	"strconv"
	"sync"

	"nowenos-server/internal/database"
)

var (
	once     sync.Once
	settings *Settings
)

type Settings struct {
	Hostname   string `json:"hostname"`
	HTTPPort   int    `json:"httpPort"`
	LogLevel   string `json:"logLevel"`
	AutoUpdate bool   `json:"autoUpdate"`
	MaxUpload  int64  `json:"maxUpload"` // MB
}

func defaultSettings() *Settings {
	return &Settings{
		Hostname:   "nowenos",
		HTTPPort:   8080,
		LogLevel:   "info",
		AutoUpdate: false,
		MaxUpload:  1024,
	}
}

func load() {
	once.Do(func() {
		settings = defaultSettings()

		db := database.GetDB()

		// Read each setting from SQLite; insert defaults if missing
		defaults := map[string]string{
			"hostname":   settings.Hostname,
			"httpPort":   strconv.Itoa(settings.HTTPPort),
			"logLevel":   settings.LogLevel,
			"autoUpdate": "false",
			"maxUpload":  strconv.FormatInt(settings.MaxUpload, 10),
		}

		for key, def := range defaults {
			var val string
			err := db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&val)
			if err != nil {
				// Key doesn't exist yet, insert default
				_, err = db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", key, def)
				if err != nil {
					log.Printf("settings: failed to insert default %s: %v", key, err)
				}
				continue
			}

			switch key {
			case "hostname":
				settings.Hostname = val
			case "httpPort":
				if v, err := strconv.Atoi(val); err == nil {
					settings.HTTPPort = v
				}
			case "logLevel":
				settings.LogLevel = val
			case "autoUpdate":
				settings.AutoUpdate = val == "true"
			case "maxUpload":
				if v, err := strconv.ParseInt(val, 10, 64); err == nil {
					settings.MaxUpload = v
				}
			}
		}
	})
}

func Get() *Settings {
	load()
	return settings
}

func Update(newSettings *Settings) error {
	load()

	if newSettings.Hostname != "" {
		settings.Hostname = newSettings.Hostname
	}
	if newSettings.HTTPPort > 0 {
		settings.HTTPPort = newSettings.HTTPPort
	}
	if newSettings.LogLevel != "" {
		settings.LogLevel = newSettings.LogLevel
	}
	settings.AutoUpdate = newSettings.AutoUpdate
	if newSettings.MaxUpload > 0 {
		settings.MaxUpload = newSettings.MaxUpload
	}

	db := database.GetDB()

	pairs := map[string]string{
		"hostname":   settings.Hostname,
		"httpPort":   strconv.Itoa(settings.HTTPPort),
		"logLevel":   settings.LogLevel,
		"autoUpdate": strconv.FormatBool(settings.AutoUpdate),
		"maxUpload":  strconv.FormatInt(settings.MaxUpload, 10),
	}

	for key, val := range pairs {
		_, err := db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, val)
		if err != nil {
			return err
		}
	}

	return nil
}
