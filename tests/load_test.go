package main

import (
	"flag"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"
)

func main() {
	// Command line flags
	totalSessions := flag.Int("sessions", 100, "Total number of sessions to create")
	concurrency := flag.Int("concurrent", 10, "Number of concurrent sessions")
	maxUsers := flag.Int("users", 50, "Maximum number of users from database")
	flag.Parse()

	log.Println("========================================")
	log.Println("RADIUS Load Test")
	log.Println("========================================")

	// Verify radclient is installed
	if err := VerifyRadclientInstalled(); err != nil {
		log.Fatalf("Error: %v", err)
	}

	// Load configuration
	config := LoadConfig()
	log.Printf("RADIUS Server: %s", config.RadiusServer)
	log.Printf("Configuration:")
	log.Printf("  - Total Sessions: %d", *totalSessions)
	log.Printf("  - Concurrent: %d", *concurrency)

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

	log.Printf("  - Users: %d\n", len(users))

	log.Println("\n========================================")
	log.Println("Starting load test...")
	log.Println("========================================")

	startTime := time.Now()

	// Counters
	var successCount, failCount int64
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, *concurrency)

	// Create sessions
	for i := 0; i < *totalSessions; i++ {
		wg.Add(1)
		semaphore <- struct{}{} // Acquire semaphore

		go func(sessionNum int) {
			defer wg.Done()
			defer func() { <-semaphore }() // Release semaphore

			// Round-robin through users
			user := users[sessionNum%len(users)]

			// Authenticate first
			authResult, err := TestAuthentication(config, user.Username, user.Password)
			if err != nil || !authResult.Success {
				atomic.AddInt64(&failCount, 1)
				if sessionNum%10 == 0 {
					fmt.Printf("\rProgress: %d/%d sessions (%.0f%%)", sessionNum+1, *totalSessions, float64(sessionNum+1)/float64(*totalSessions)*100)
				}
				return
			}

			// Create accounting session
			_, err = CreateAccountingSession(config, user.Username, 20000+sessionNum)
			if err != nil {
				atomic.AddInt64(&failCount, 1)
			} else {
				atomic.AddInt64(&successCount, 1)
			}

			// Progress indicator
			if sessionNum%10 == 0 {
				fmt.Printf("\rProgress: %d/%d sessions (%.0f%%)", sessionNum+1, *totalSessions, float64(sessionNum+1)/float64(*totalSessions)*100)
			}
		}(i)

		// Small delay between launches to avoid overwhelming
		time.Sleep(50 * time.Millisecond)
	}

	// Wait for all sessions to complete
	wg.Wait()

	duration := time.Since(startTime)

	// Print summary
	fmt.Println("\n\n========================================")
	fmt.Println("Load Test Completed!")
	fmt.Println("========================================")
	fmt.Printf("Total Sessions:     %d\n", *totalSessions)
	fmt.Printf("✓ Successful:       %d\n", successCount)
	fmt.Printf("✗ Failed:           %d\n", failCount)
	fmt.Printf("Success Rate:       %.2f%%\n", float64(successCount)/float64(*totalSessions)*100)
	fmt.Printf("Duration:           %s\n", duration.Round(time.Millisecond))
	fmt.Printf("Sessions/sec:       %.2f\n", float64(*totalSessions)/duration.Seconds())
	fmt.Printf("Avg Session Time:   %s\n", (duration / time.Duration(*totalSessions)).Round(time.Millisecond))
	fmt.Println("========================================")
}
