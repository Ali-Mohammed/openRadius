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
	maxUsers := flag.Int("users", 50, "Maximum number of users to test")
	verbose := flag.Bool("verbose", false, "Verbose output")
	concurrent := flag.Int("concurrent", 1, "Number of concurrent authentication requests (1=sequential, 10=10 parallel)")
	flag.Parse()

	log.Println("========================================")
	log.Println("RADIUS Authentication Test")
	log.Println("========================================")

	// Verify radclient is installed
	if err := VerifyRadclientInstalled(); err != nil {
		log.Fatalf("Error: %v", err)
	}

	// Load configuration
	config := LoadConfig()
	log.Printf("RADIUS Server: %s:%s", config.RadiusServer, config.RadiusAuthPort)
	log.Printf("Database: %s@%s:%s/%s", config.DBUser, config.DBHost, config.DBPort, config.DBName)
	if *concurrent > 1 {
		log.Printf("Concurrency: %d parallel authentications", *concurrent)
	}

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

	log.Printf("\n========================================")
	log.Printf("Testing %d users...", len(users))
	log.Println("========================================\n")

	startTime := time.Now()

	if *concurrent > 1 {
		// Concurrent authentication testing
		testConcurrent(config, users, *concurrent, *verbose)
	} else {
		// Sequential authentication testing
		testSequential(config, users, *verbose)
	}

	duration := time.Since(startTime)
	fmt.Printf("\nTotal Time: %s (%.2f auth/sec)\n", duration.Round(time.Millisecond), float64(len(users))/duration.Seconds())
}

func testSequential(config *Config, users []RadiusUser, verbose bool) {
	results := make([]AuthResult, 0, len(users))

	for i, user := range users {
		fmt.Printf("\n[%d/%d] Testing user: %s\n", i+1, len(users), user.Username)

		result, err := TestAuthentication(config, user.Username, user.Password)
		if err != nil && !result.Success {
			log.Printf("  ✗ FAILED: %v", err)
		} else if result.Success {
			log.Printf("  ✓ SUCCESS - User authenticated")

			// Print returned attributes if verbose
			if verbose {
				fmt.Printf("  Response:\n%s\n", result.Message)
			}
		} else {
			log.Printf("  ✗ FAILED - Authentication rejected")
		}

		results = append(results, *result)

		// Small delay to prevent overwhelming the server
		time.Sleep(200 * time.Millisecond)
	}

	// Print summary
	PrintAuthResults(results)
}

func testConcurrent(config *Config, users []RadiusUser, concurrency int, verbose bool) {
	var wg sync.WaitGroup
	var mu sync.Mutex
	semaphore := make(chan struct{}, concurrency)
	results := make([]AuthResult, 0, len(users))

	var successCount, failCount int64

	for i, user := range users {
		wg.Add(1)
		semaphore <- struct{}{} // Acquire semaphore

		go func(index int, u RadiusUser) {
			defer wg.Done()
			defer func() { <-semaphore }() // Release semaphore

			result, err := TestAuthentication(config, u.Username, u.Password)

			if result.Success {
				atomic.AddInt64(&successCount, 1)
				if !verbose {
					fmt.Printf("✓")
				} else {
					fmt.Printf("\n[%d/%d] ✓ %s - SUCCESS\n", index+1, len(users), u.Username)
				}
			} else {
				atomic.AddInt64(&failCount, 1)
				if !verbose {
					fmt.Printf("✗")
				} else {
					fmt.Printf("\n[%d/%d] ✗ %s - FAILED\n", index+1, len(users), u.Username)
					if err != nil {
						log.Printf("  Error: %v", err)
					}
				}
			}

			mu.Lock()
			results = append(results, *result)
			mu.Unlock()

			// Progress indicator every 50 tests (if not verbose)
			if !verbose && (index+1)%50 == 0 {
				current := atomic.LoadInt64(&successCount)
				currentFail := atomic.LoadInt64(&failCount)
				fmt.Printf(" [%d/%d | ✓ %d | ✗ %d]\n", index+1, len(users), current, currentFail)
			}
		}(i, user)

		// Small delay to stagger requests
		time.Sleep(20 * time.Millisecond)
	}

	// Wait for all authentications to complete
	wg.Wait()

	// Show final counts
	fmt.Printf("\n\n========================================\n")
	fmt.Printf("Live Results: ✓ %d Successful | ✗ %d Rejected\n", successCount, failCount)
	fmt.Printf("========================================\n\n")

	// Print detailed summary
	PrintAuthResults(results)
}
