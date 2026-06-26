package main

import (
	"log"
	"time"

	"nowenos-server/internal/alerts"
	"nowenos-server/internal/audit"
	"nowenos-server/internal/dockerstats"
	"nowenos-server/internal/statsstore"
	"nowenos-server/internal/ws"
	"nowenos-server/internal/config"
	"nowenos-server/internal/database"
	"nowenos-server/internal/httpapi"
	"nowenos-server/internal/tlsconfig"
	"nowenos-server/internal/backup"
	"nowenos-server/internal/cronmanager"
	"nowenos-server/internal/taskqueue"
)

func main() {
	cfg := config.Load()

	// Initialize database
	database.GetDB()
	defer database.Close()

	// Apply pending migrations before module InitTable calls
	database.AutoMigrate()

	// Ensure security audit schema is ready (safety net for the v2 migration)
	audit.InitSecurityAuditSchema()

	// Initialize default users
	backup.InitBackupDir()
	cronmanager.StartScheduler()
	alerts.StartPeriodicCheck()
	taskqueue.StartWorker()
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			statsstore.Cleanup(7)
		}
	}()

	// Set up the docker stats broadcaster to use the WS hub
	dockerstats.SetBroadcaster(func(msgType string, data interface{}) {
		ws.BroadcastMessage(msgType, data)
	})
	dockerstats.StartCollector()
	ws.StartBroadcast()

	r := httpapi.New()

	tlsCfg := tlsconfig.Load()
	log.Printf("starting NoWenOS API on :%s", cfg.Port)
	if tlsCfg.Enabled {
		log.Printf("TLS enabled with cert=%s", tlsCfg.CertFile)
		if err := r.RunTLS(":"+cfg.Port, tlsCfg.CertFile, tlsCfg.KeyFile); err != nil {
			log.Fatal(err)
		}
	} else {
		if err := r.Run(":" + cfg.Port); err != nil {
			log.Fatal(err)
		}
	}
}

