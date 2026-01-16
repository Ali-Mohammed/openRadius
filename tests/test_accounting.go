package main

import (
	"flag"
	"fmt"
	"log"
	"time"
)

func main() {
	// Command line flags
	maxUsers := flag.Int("users", 20, "Maximum number of users to create sessions for")
	flag.Parse()

	log.Println("========================================")
	log.Println("RADIUS Accounting Test")
	log.Println("========================================")

	// Verify radclient is installed
	if err := VerifyRadclientInstalled(); err != nil {
		log.Fatalf("Error: %v", err)
	}

	// Load configuration
	config := LoadConfig()
	log.Printf("RADIUS Server: %s:%s", config.RadiusServer, config.RadiusAcctPort)
	log.Printf("NAS IP: %s", config.NASIPAddress)

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
	log.Printf("Creating accounting sessions for %d users...", len(users))
	log.Println("========================================\n")

	// Create accounting sessions for each user
	successCount := 0
	failCount := 0
	sessions := make([]*AccountingSession, 0)

	for i, user := range users {
		fmt.Printf("\n[%d/%d] Creating session for: %s\n", i+1, len(users), user.Username)

		session, err := CreateAccountingSession(config, user.Username, 10000+i)
		if err != nil {
			log.Printf("  ✗ FAILED: %v", err)
			failCount++
			continue
		}

		sessions = append(sessions, session)
		successCount++

		// Small delay between sessions
		time.Sleep(300 * time.Millisecond)
	}

	// Print summary
	fmt.Println("\n========================================")
	fmt.Println("Accounting Test Summary")
	fmt.Println("========================================")
	fmt.Printf("Total Sessions:     %d\n", len(users))
	fmt.Printf("✓ Successful:       %d\n", successCount)
	fmt.Printf("✗ Failed:           %d\n", failCount)
	if len(users) > 0 {
		fmt.Printf("Success Rate:       %.2f%%\n", float64(successCount)/float64(len(users))*100)
	}
	fmt.Println("========================================")

	// Calculate total data transferred
	if len(sessions) > 0 {
		var totalBytesIn, totalBytesOut int64
		var totalDuration int
		for _, session := range sessions {
			totalBytesIn += session.BytesIn
			totalBytesOut += session.BytesOut
			totalDuration += session.Duration
		}

		fmt.Println("\nData Transfer Summary")
		fmt.Println("========================================")
		fmt.Printf("Total Download:     %s\n", FormatBytes(totalBytesIn))
		fmt.Printf("Total Upload:       %s\n", FormatBytes(totalBytesOut))
		fmt.Printf("Total Data:         %s\n", FormatBytes(totalBytesIn+totalBytesOut))
		fmt.Printf("Total Session Time: %s\n", FormatDuration(totalDuration))
		fmt.Println("========================================")
	}
}
