package main

import (
	"bytes"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/brianvoe/gofakeit/v6"
)

type AuthResult struct {
	Username  string
	Success   bool
	Message   string
	Timestamp time.Time
}

type AccountingSession struct {
	Username        string
	SessionID       string
	UniqueID        string
	FramedIPAddress string
	StartTime       time.Time
	Duration        int
	BytesIn         int64
	BytesOut        int64
}

// TestAuthentication tests RADIUS authentication for a user
func TestAuthentication(config *Config, username, password string) (*AuthResult, error) {
	cmd := exec.Command(
		"radtest",
		username,
		password,
		config.RadiusServer,
		config.RadiusAuthPort,
		config.RadiusSecret,
	)

	output, err := cmd.CombinedOutput()
	outputStr := string(output)

	result := &AuthResult{
		Username:  username,
		Success:   strings.Contains(outputStr, "Access-Accept"),
		Message:   outputStr,
		Timestamp: time.Now(),
	}

	if err != nil && !result.Success {
		return result, fmt.Errorf("authentication failed: %w", err)
	}

	return result, nil
}

// SendAccountingStart sends an Accounting-Start packet
func SendAccountingStart(config *Config, session *AccountingSession, nasPort int) error {
	tempFile := fmt.Sprintf("/tmp/acct-start-%s.txt", session.SessionID)
	defer os.Remove(tempFile)

	content := fmt.Sprintf(`Acct-Status-Type = Start
User-Name = "%s"
NAS-IP-Address = %s
NAS-Port = %d
NAS-Port-Type = Ethernet
NAS-Port-Id = "%s"
Acct-Session-Id = "%s"
Acct-Unique-Session-Id = "%s"
Framed-IP-Address = %s
Acct-Authentic = RADIUS
Service-Type = Framed-User
Framed-Protocol = PPP
Event-Timestamp = %d
`,
		session.Username,
		config.NASIPAddress,
		nasPort,
		config.NASPortID,
		session.SessionID,
		session.UniqueID,
		session.FramedIPAddress,
		session.StartTime.Unix(),
	)

	if err := os.WriteFile(tempFile, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to write temp file: %w", err)
	}

	cmd := exec.Command(
		"radclient",
		"-f", tempFile,
		fmt.Sprintf("%s:%s", config.RadiusServer, config.RadiusAcctPort),
		"acct",
		config.RadiusSecret,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("radclient failed: %w\nOutput: %s", err, string(output))
	}

	return nil
}

// SendAccountingInterimUpdate sends an Accounting Interim-Update packet
func SendAccountingInterimUpdate(config *Config, session *AccountingSession, nasPort int, currentDuration int) error {
	tempFile := fmt.Sprintf("/tmp/acct-update-%s.txt", session.SessionID)
	defer os.Remove(tempFile)

	content := fmt.Sprintf(`Acct-Status-Type = Interim-Update
User-Name = "%s"
NAS-IP-Address = %s
NAS-Port = %d
NAS-Port-Id = "%s"
Acct-Session-Id = "%s"
Acct-Unique-Session-Id = "%s"
Framed-IP-Address = %s
Acct-Session-Time = %d
Acct-Input-Octets = %d
Acct-Output-Octets = %d
Acct-Input-Packets = %d
Acct-Output-Packets = %d
Event-Timestamp = %d
`,
		session.Username,
		config.NASIPAddress,
		nasPort,
		config.NASPortID,
		session.SessionID,
		session.UniqueID,
		session.FramedIPAddress,
		currentDuration,
		session.BytesIn/2,
		session.BytesOut/2,
		rand.Intn(10000),
		rand.Intn(8000),
		time.Now().Unix(),
	)

	if err := os.WriteFile(tempFile, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to write temp file: %w", err)
	}

	cmd := exec.Command(
		"radclient",
		"-f", tempFile,
		fmt.Sprintf("%s:%s", config.RadiusServer, config.RadiusAcctPort),
		"acct",
		config.RadiusSecret,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("radclient failed: %w\nOutput: %s", err, string(output))
	}

	return nil
}

// SendAccountingStop sends an Accounting-Stop packet
func SendAccountingStop(config *Config, session *AccountingSession, nasPort int) error {
	tempFile := fmt.Sprintf("/tmp/acct-stop-%s.txt", session.SessionID)
	defer os.Remove(tempFile)

	content := fmt.Sprintf(`Acct-Status-Type = Stop
User-Name = "%s"
NAS-IP-Address = %s
NAS-Port = %d
NAS-Port-Id = "%s"
Acct-Session-Id = "%s"
Acct-Unique-Session-Id = "%s"
Framed-IP-Address = %s
Acct-Session-Time = %d
Acct-Input-Octets = %d
Acct-Output-Octets = %d
Acct-Input-Packets = %d
Acct-Output-Packets = %d
Acct-Terminate-Cause = User-Request
Event-Timestamp = %d
`,
		session.Username,
		config.NASIPAddress,
		nasPort,
		config.NASPortID,
		session.SessionID,
		session.UniqueID,
		session.FramedIPAddress,
		session.Duration,
		session.BytesIn,
		session.BytesOut,
		rand.Intn(20000),
		rand.Intn(15000),
		time.Now().Unix(),
	)

	if err := os.WriteFile(tempFile, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to write temp file: %w", err)
	}

	cmd := exec.Command(
		"radclient",
		"-f", tempFile,
		fmt.Sprintf("%s:%s", config.RadiusServer, config.RadiusAcctPort),
		"acct",
		config.RadiusSecret,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("radclient failed: %w\nOutput: %s", err, string(output))
	}

	return nil
}

// GenerateRandomIP generates a random IP address
func GenerateRandomIP() string {
	return fmt.Sprintf("10.%d.%d.%d",
		rand.Intn(256),
		rand.Intn(256),
		rand.Intn(256),
	)
}

// FormatBytes formats bytes into human-readable format
func FormatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.2f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// FormatDuration formats duration in seconds to human-readable format
func FormatDuration(seconds int) string {
	duration := time.Duration(seconds) * time.Second
	hours := int(duration.Hours())
	minutes := int(duration.Minutes()) % 60
	secs := int(duration.Seconds()) % 60

	if hours > 0 {
		return fmt.Sprintf("%dh %dm %ds", hours, minutes, secs)
	} else if minutes > 0 {
		return fmt.Sprintf("%dm %ds", minutes, secs)
	}
	return fmt.Sprintf("%ds", secs)
}

// CreateAccountingSession creates a complete accounting session
func CreateAccountingSession(config *Config, username string, nasPort int) (*AccountingSession, error) {
	session := &AccountingSession{
		Username:        username,
		SessionID:       fmt.Sprintf("test-session-%d-%d", time.Now().Unix(), nasPort),
		UniqueID:        gofakeit.UUID(),
		FramedIPAddress: GenerateRandomIP(),
		StartTime:       time.Now(),
		Duration:        rand.Intn(3600) + 300,        // 5 minutes to 1 hour
		BytesIn:         int64(rand.Intn(1000000000)), // Up to 1GB
		BytesOut:        int64(rand.Intn(500000000)),  // Up to 500MB
	}

	log.Printf("  → Session ID: %s", session.SessionID)
	log.Printf("  → IP: %s", session.FramedIPAddress)

	// Send Start
	log.Printf("  → Sending Acct-Start...")
	if err := SendAccountingStart(config, session, nasPort); err != nil {
		return nil, fmt.Errorf("failed to send accounting start: %w", err)
	}

	// Wait a bit
	time.Sleep(500 * time.Millisecond)

	// Send Interim-Update
	log.Printf("  → Sending Interim-Update...")
	if err := SendAccountingInterimUpdate(config, session, nasPort, session.Duration/2); err != nil {
		return nil, fmt.Errorf("failed to send interim update: %w", err)
	}

	// Wait a bit more
	time.Sleep(500 * time.Millisecond)

	// Send Stop
	log.Printf("  → Sending Acct-Stop...")
	if err := SendAccountingStop(config, session, nasPort); err != nil {
		return nil, fmt.Errorf("failed to send accounting stop: %w", err)
	}

	log.Printf("  ✓ Session completed: Duration=%s, Download=%s, Upload=%s",
		FormatDuration(session.Duration),
		FormatBytes(session.BytesIn),
		FormatBytes(session.BytesOut),
	)

	return session, nil
}

// PrintAuthResults prints authentication test results
func PrintAuthResults(results []AuthResult) {
	var successCount, failCount int
	for _, result := range results {
		if result.Success {
			successCount++
		} else {
			failCount++
		}
	}

	fmt.Println("\n========================================")
	fmt.Println("Authentication Test Summary")
	fmt.Println("========================================")
	fmt.Printf("Total Tests:    %d\n", len(results))
	fmt.Printf("✓ Successful:   %d\n", successCount)
	fmt.Printf("✗ Failed:       %d\n", failCount)
	if len(results) > 0 {
		fmt.Printf("Success Rate:   %.2f%%\n", float64(successCount)/float64(len(results))*100)
	}
	fmt.Println("========================================")
}

// VerifyRadclientInstalled checks if radclient and radtest are installed
func VerifyRadclientInstalled() error {
	// Check radtest
	cmd := exec.Command("which", "radtest")
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("radtest not found. Please install freeradius-utils: brew install freeradius-server")
	}

	// Check radclient
	cmd = exec.Command("which", "radclient")
	out.Reset()
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("radclient not found. Please install freeradius-utils: brew install freeradius-server")
	}

	log.Println("✓ radtest and radclient are installed")
	return nil
}
