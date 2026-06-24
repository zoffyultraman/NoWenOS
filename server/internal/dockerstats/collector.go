package dockerstats

import (
	"encoding/json"
	"log"
	"time"
)

// Broadcaster is a function type that broadcasts a message to all connected clients.
// This is set by the ws package to avoid circular imports.
type Broadcaster func(msgType string, data interface{})

var broadcast Broadcaster

// SetBroadcaster sets the function used to broadcast WebSocket messages.
func SetBroadcaster(b Broadcaster) {
	broadcast = b
}

// StartCollector launches a goroutine that records Docker container stats every 10 seconds.
func StartCollector() {
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			if err := RecordStats(); err != nil {
				log.Printf("docker stats collector: %v", err)
				continue
			}

			// Broadcast real-time stats via WebSocket if broadcaster is set
			if broadcast != nil {
				stats, err := GetContainerStats()
				if err != nil {
					continue
				}
				broadcast("docker-stats", stats)
			}
		}
	}()

	// Cleanup old records daily
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			Cleanup(7)
		}
	}()
}

// BroadcastDockerStats can be used by the ws package to include docker stats in broadcasts.
func BroadcastDockerStats() {
	stats, err := GetContainerStats()
	if err != nil {
		return
	}
	data, _ := json.Marshal(map[string]interface{}{
		"type": "docker-stats",
		"data": stats,
	})
	_ = data // The ws hub will handle actual broadcasting
}
