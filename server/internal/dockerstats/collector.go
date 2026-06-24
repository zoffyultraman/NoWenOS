package dockerstats

import (
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
			stats, err := RecordStats()
			if err != nil {
				log.Printf("docker stats collector: %v", err)
				continue
			}

			// Broadcast real-time stats via WebSocket if broadcaster is set
			if broadcast != nil && len(stats) > 0 {
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
