package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

func main() {
	// Command line flags
	onlineUsers := flag.Int("online", 20, "Number of concurrent online users to simulate")
	updateInterval := flag.Int("interval", 60, "Interim-update interval in seconds")
	maxUsers := flag.Int("max-users", 100, "Maximum number of users to fetch from database")
	flag.Parse()

	log.Println("========================================")
	log.Println("Simulate Online Users")
	log.Println("========================================")

	// Verify radclient is installed
	if err := VerifyRadclientInstalled(); err != nil {
		log.Fatalf("Error: %v", err)
	}

	// Load configuration
	config := LoadConfig()
	log.Printf("RADIUS Server: %s:%s", config.RadiusServer, config.RadiusAcctPort)
	log.Printf("Simulating %d concurrent users", *onlineUsers)
	log.Printf("Interim-update every %d seconds", *updateInterval)

	// Connect to database
	db, err := ConnectDB(config)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	defer db.Close()

	// Fetch active users
	users, err := FetchActiveUsers(db, *maxUsers)
	if err != nil {
		log.Fatalf("Failed to fetch users: %v", err)
	}

	if len(users) == 0 {
		log.Fatal("No active users found in database")
	}

	// Limit to requested number of online users
	if len(users) > *onlineUsers {
		users = users[:*onlineUsers]
	}

	log.Printf("\n========================================")
	log.Printf("Starting %d online sessions...", len(users))
	log.Println("Press Ctrl+C to stop")
	log.Println("========================================\n")

	// Context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	var wg sync.WaitGroup

	// Start sessions for each user
	for i, user := range users {
		wg.Add(1)
		go func(userNum int, u RadiusUser) {
			defer wg.Done()
			keepUserOnline(ctx, config, u, userNum, *updateInterval)
		}(i, user)

		// Stagger session starts
		time.Sleep(500 * time.Millisecond)
	}

	// Wait for interrupt
	<-sigChan
	log.Println("\n\nReceived interrupt signal. Stopping all sessions...")
	cancel()

	// Wait for all goroutines to finish
	wg.Wait()

	log.Println("\n========================================")
	log.Println("All sessions stopped gracefully")
	log.Println("========================================")
}

func keepUserOnline(ctx context.Context, config *Config, user RadiusUser, userNum, updateInterval int) {
	session := &AccountingSession{
		Username:        user.Username,
		SessionID:       fmt.Sprintf("persistent-%d-%d", time.Now().Unix(), userNum),
		UniqueID:        fmt.Sprintf("%d", rand.Int63()),
		FramedIPAddress: fmt.Sprintf("10.30.%d.%d", userNum/256, userNum%256),
		StartTime:       time.Now(),
		BytesIn:         0,
		BytesOut:        0,
	}

	nasPort := 30000 + userNum

	// Send Start
	log.Printf("User %s: Starting session (IP: %s)", user.Username, session.FramedIPAddress)
	if err := SendAccountingStart(config, session, nasPort); err != nil {
		log.Printf("  ✗ Failed to send Acct-Start: %v", err)
		return
	}
	log.Printf("  ✓ User %s is now ONLINE", user.Username)

	// Send Interim-Updates periodically
	ticker := time.NewTicker(time.Duration(updateInterval) * time.Second)
	defer ticker.Stop()

	sessionTime := 0
	for {
		select {
		case <-ctx.Done():
			// Send Stop on shutdown
			log.Printf("User %s: Stopping session...", user.Username)
			session.Duration = sessionTime
			if err := SendAccountingStop(config, session, nasPort); err != nil {
				log.Printf("  ✗ Failed to send Acct-Stop: %v", err)
			} else {
				log.Printf("  ✓ User %s session stopped", user.Username)
			}
			return

		case <-ticker.C:
			sessionTime += updateInterval

			// Simulate data transfer (random realistic values)
			session.BytesIn += int64(rand.Intn(50000000))  // Up to 50MB per interval
			session.BytesOut += int64(rand.Intn(10000000)) // Up to 10MB per interval

			if err := SendAccountingInterimUpdate(config, session, nasPort, sessionTime); err != nil {
				log.Printf("  ⚠ User %s: Failed to send Interim-Update: %v", user.Username, err)
			} else {
				log.Printf("  ↻ User %s: Interim-Update sent (Time: %s, Down: %s, Up: %s)",
					user.Username,
					FormatDuration(sessionTime),
					FormatBytes(session.BytesIn),
					FormatBytes(session.BytesOut),
				)
			}
		}
	}
}
