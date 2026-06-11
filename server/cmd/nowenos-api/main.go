package main

import (
	"log"

	"nowenos-server/internal/alerts"
	"nowenos-server/internal/appcenter"
	"nowenos-server/internal/proxy"
	"nowenos-server/internal/ws"
	"nowenos-server/internal/audit"
	"nowenos-server/internal/auth"
	"nowenos-server/internal/config"
	"nowenos-server/internal/database"
	"nowenos-server/internal/httpapi"
	"nowenos-server/internal/tlsconfig"
	"nowenos-server/internal/recyclebin"
	"nowenos-server/internal/shares"
)

func main() {
	cfg := config.Load()

	// Initialize database
	database.GetDB()
	defer database.Close()

	// Initialize default users
	auth.InitDB()
	auth.InitGroupsTable()
	alerts.InitTable()
	shares.InitTable()
	recyclebin.InitTable()
	audit.InitTable()
	appcenter.InitTable()
	proxy.InitTable()
	alerts.StartPeriodicCheck()
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

