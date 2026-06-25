package database

import "database/sql"

func init() {
	Register(Migration{
		Version:     1,
		Description: "Initial schema setup",
		Up: func(db *sql.DB) error {
			queries := []string{
				// ── Core tables ──
				`CREATE TABLE IF NOT EXISTS users (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					username TEXT UNIQUE NOT NULL,
					password TEXT NOT NULL,
					role TEXT NOT NULL DEFAULT 'user',
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,
				`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
				`CREATE TABLE IF NOT EXISTS settings (
					key TEXT PRIMARY KEY,
					value TEXT NOT NULL
				)`,
				`CREATE TABLE IF NOT EXISTS user_2fa (
					user_id TEXT PRIMARY KEY,
					secret TEXT NOT NULL,
					enabled INTEGER NOT NULL DEFAULT 0,
					backup_codes TEXT NOT NULL DEFAULT '[]',
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,
				`CREATE TABLE IF NOT EXISTS groups (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT UNIQUE NOT NULL,
					comment TEXT DEFAULT ''
				)`,
				`CREATE TABLE IF NOT EXISTS user_groups (
					username TEXT NOT NULL,
					group_id INTEGER NOT NULL,
					PRIMARY KEY (username, group_id),
					FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
				)`,
				`CREATE TABLE IF NOT EXISTS audit_log (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
					username TEXT DEFAULT '',
					action TEXT NOT NULL,
					resource TEXT DEFAULT '',
					resource_id TEXT DEFAULT '',
					details TEXT DEFAULT '',
					ip TEXT DEFAULT '',
					status TEXT DEFAULT 'ok',
					duration INTEGER DEFAULT 0
				)`,

				// ── Network / Proxy / VPN / Firewall ──
				`CREATE TABLE IF NOT EXISTS proxy_rules (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					domain TEXT NOT NULL,
					target TEXT NOT NULL,
					protocol TEXT NOT NULL DEFAULT 'http',
					enabled INTEGER NOT NULL DEFAULT 1,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,
				`CREATE UNIQUE INDEX IF NOT EXISTS idx_proxy_rules_domain ON proxy_rules(domain)`,
				`CREATE TABLE IF NOT EXISTS vpn_configs (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL,
					type TEXT NOT NULL CHECK(type IN ('wireguard', 'openvpn')),
					config TEXT NOT NULL,
					enabled INTEGER NOT NULL DEFAULT 1,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,
				`CREATE TABLE IF NOT EXISTS firewall_rules (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL DEFAULT '',
					chain TEXT NOT NULL DEFAULT 'INPUT',
					protocol TEXT NOT NULL DEFAULT 'tcp',
					source TEXT NOT NULL DEFAULT '',
					destination TEXT NOT NULL DEFAULT '',
					port TEXT NOT NULL DEFAULT '',
					action TEXT NOT NULL DEFAULT 'ACCEPT',
					enabled INTEGER NOT NULL DEFAULT 1,
					position INTEGER NOT NULL DEFAULT 0,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,

				// ── Shares / File sharing ──
				`CREATE TABLE IF NOT EXISTS shares (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT UNIQUE NOT NULL,
					path TEXT NOT NULL,
					protocol TEXT NOT NULL DEFAULT 'smb',
					enabled INTEGER NOT NULL DEFAULT 1,
					read_only INTEGER NOT NULL DEFAULT 0,
					guest INTEGER NOT NULL DEFAULT 0,
					comment TEXT DEFAULT '',
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,
				`CREATE TABLE IF NOT EXISTS file_shares (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					file_path TEXT NOT NULL,
					file_name TEXT NOT NULL,
					token TEXT UNIQUE NOT NULL,
					expires_at DATETIME,
					max_downloads INTEGER NOT NULL DEFAULT 0,
					download_count INTEGER NOT NULL DEFAULT 0,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,
				`CREATE INDEX IF NOT EXISTS idx_file_shares_token ON file_shares(token)`,

				// ── Recycle bin ──
				`CREATE TABLE IF NOT EXISTS recycle_bin (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					original_path TEXT NOT NULL,
					trash_path TEXT NOT NULL,
					name TEXT NOT NULL,
					is_dir INTEGER NOT NULL DEFAULT 0,
					size INTEGER NOT NULL DEFAULT 0,
					deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					deleted_by TEXT DEFAULT ''
				)`,

				// ── Certificates ──
				`CREATE TABLE IF NOT EXISTS certificates (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					domain TEXT NOT NULL,
					type TEXT NOT NULL DEFAULT 'selfsigned',
					cert_path TEXT NOT NULL,
					key_path TEXT NOT NULL,
					expires_at DATETIME,
					auto_renew INTEGER NOT NULL DEFAULT 0,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,

				// ── DDNS ──
				`CREATE TABLE IF NOT EXISTS ddns_configs (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					provider TEXT NOT NULL,
					domain TEXT NOT NULL,
					username TEXT NOT NULL DEFAULT '',
					password TEXT NOT NULL DEFAULT '',
					ip TEXT NOT NULL DEFAULT '',
					updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					enabled INTEGER NOT NULL DEFAULT 1
				)`,
				`CREATE TABLE IF NOT EXISTS ddns_update_log (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					config_id INTEGER NOT NULL,
					old_ip TEXT NOT NULL DEFAULT '',
					new_ip TEXT NOT NULL DEFAULT '',
					status TEXT NOT NULL DEFAULT 'success',
					message TEXT NOT NULL DEFAULT '',
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY (config_id) REFERENCES ddns_configs(id) ON DELETE CASCADE
				)`,

				// ── Logrotate ──
				`CREATE TABLE IF NOT EXISTS logrotate_configs (
					id          INTEGER PRIMARY KEY AUTOINCREMENT,
					name        TEXT NOT NULL UNIQUE,
					log_paths   TEXT NOT NULL,
					frequency   TEXT NOT NULL DEFAULT 'daily',
					rotate_count INTEGER NOT NULL DEFAULT 7,
					max_size    TEXT NOT NULL DEFAULT '100M',
					compress    INTEGER NOT NULL DEFAULT 1,
					create_mode TEXT NOT NULL DEFAULT '0644',
					post_rotate TEXT NOT NULL DEFAULT '',
					enabled     INTEGER NOT NULL DEFAULT 1,
					created_at  TEXT NOT NULL,
					updated_at  TEXT NOT NULL
				)`,

				// ── Cron / Scheduled tasks ──
				`CREATE TABLE IF NOT EXISTS scheduled_tasks (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL,
					command TEXT NOT NULL,
					schedule TEXT NOT NULL,
					enabled INTEGER NOT NULL DEFAULT 1,
					last_run TEXT DEFAULT '',
					next_run TEXT DEFAULT '',
					last_status TEXT DEFAULT 'never',
					output TEXT DEFAULT '',
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,

				// ── Docker stats ──
				`CREATE TABLE IF NOT EXISTS docker_stats_history (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					container_id TEXT NOT NULL,
					name TEXT,
					cpu_percent REAL,
					memory_usage INTEGER,
					memory_limit INTEGER,
					memory_percent REAL,
					net_rx INTEGER,
					net_tx INTEGER,
					block_read INTEGER,
					block_write INTEGER,
					pids INTEGER,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,
				`CREATE INDEX IF NOT EXISTS idx_docker_stats_container_id ON docker_stats_history(container_id)`,
				`CREATE INDEX IF NOT EXISTS idx_docker_stats_created_at ON docker_stats_history(created_at)`,

				// ── System stats ──
				`CREATE TABLE IF NOT EXISTS stats_history (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					cpu REAL,
					memory REAL,
					disk REAL,
					rx_bytes INTEGER,
					tx_bytes INTEGER,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,

				// ── Alerts ──
				`CREATE TABLE IF NOT EXISTS alert_rules (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL,
					metric TEXT NOT NULL,
					operator TEXT NOT NULL DEFAULT 'gt',
					threshold REAL NOT NULL,
					enabled INTEGER NOT NULL DEFAULT 1,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,
				`CREATE TABLE IF NOT EXISTS notification_channels (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL,
					type TEXT NOT NULL,
					config TEXT DEFAULT '{}',
					enabled INTEGER NOT NULL DEFAULT 1,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,
				`CREATE TABLE IF NOT EXISTS rule_channels (
					rule_id INTEGER NOT NULL,
					channel_id INTEGER NOT NULL,
					PRIMARY KEY (rule_id, channel_id),
					FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
					FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
				)`,
				`CREATE TABLE IF NOT EXISTS alert_events (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					rule_id INTEGER NOT NULL,
					rule_name TEXT NOT NULL,
					metric TEXT NOT NULL,
					value REAL NOT NULL,
					threshold REAL NOT NULL,
					message TEXT NOT NULL,
					level TEXT NOT NULL DEFAULT 'warning',
					seen INTEGER NOT NULL DEFAULT 0,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
				)`,

				// ── App Center ──
				`CREATE TABLE IF NOT EXISTS installed_apps (
					id TEXT PRIMARY KEY,
					name TEXT,
					version TEXT,
					installed_at DATETIME
				)`,
			}
			for _, q := range queries {
				if _, err := db.Exec(q); err != nil {
					return err
				}
			}
			return nil
		},
	})
}
