package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"math"
	"math/rand"
	"os"
	"os/signal"
	"sort"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	_ "github.com/lib/pq"
	"layeh.com/radius"
	"layeh.com/radius/rfc2865"
)

// ═══════════════════════════════════════════════════════════════════════════
//  Nokia 7750 SR BNG — Realistic RADIUS Auth Load Test
// ═══════════════════════════════════════════════════════════════════════════
//
//  Simulates real-world Nokia BNG authentication patterns:
//
//  Phase 1: STEADY STATE — Normal PPPoE churn
//     Random users re-authenticate at a realistic rate (~2-5% per minute)
//     Simulates lease expiry, modem reboots, line flaps
//
//  Phase 2: RAMP UP — Gradual morning peak
//     Auth rate increases linearly over 60s, simulating subscribers
//     coming online during morning peak (06:00-09:00)
//
//  Phase 3: POWER OUTAGE RECOVERY — Mass reconnect storm
//     City-wide power restored after outage. All CPEs reboot and
//     send PPPoE PADI simultaneously. BNG queues auth requests
//     with 30-60s stagger as modems boot at different speeds
//
//  Phase 4: SUSTAINED PEAK — Max throughput test
//     Continuous auth at peak rate for 60s to find sustained capacity
//
// ═══════════════════════════════════════════════════════════════════════════

type User struct {
	Username string
	Password string
}

type Result struct {
	Latency time.Duration
	Success bool
	Reject  bool
	Error   bool
}

type Config struct {
	RadiusHost   string
	RadiusPort   int
	RadiusSecret string
	PgDSN        string
	Timeout      time.Duration
	ScaleUsers   int
	Verbose      bool

	// Phase durations
	SteadyDuration time.Duration
	RampDuration   time.Duration
	OutageDuration time.Duration
	PeakDuration   time.Duration

	// Rates
	SteadyRPS   int // auth/sec during steady state
	PeakRPS     int // target auth/sec at peak
	OutageBatch int // users per second during outage recovery
}

// ─── Live metrics (lock-free) ───────────────────────────────────────────────

type LiveStats struct {
	Sent   atomic.Int64
	Accept atomic.Int64
	Reject atomic.Int64
	Error  atomic.Int64
	LatSum atomic.Int64 // microseconds
	LatMax atomic.Int64

	// Per-second sliding window
	mu         sync.Mutex
	secResults []Result
}

func (ls *LiveStats) Record(r Result) {
	ls.Sent.Add(1)
	lat := r.Latency.Microseconds()
	ls.LatSum.Add(lat)

	if r.Error {
		ls.Error.Add(1)
	} else if r.Success {
		ls.Accept.Add(1)
	} else {
		ls.Reject.Add(1)
	}

	// Update max atomically
	for {
		cur := ls.LatMax.Load()
		if lat <= cur || ls.LatMax.CompareAndSwap(cur, lat) {
			break
		}
	}

	ls.mu.Lock()
	ls.secResults = append(ls.secResults, r)
	ls.mu.Unlock()
}

func (ls *LiveStats) Snapshot() (total, accept, reject, errors int64, avgMs, maxMs float64) {
	total = ls.Sent.Load()
	accept = ls.Accept.Load()
	reject = ls.Reject.Load()
	errors = ls.Error.Load()
	if total > 0 {
		avgMs = float64(ls.LatSum.Load()) / float64(total) / 1000.0
	}
	maxMs = float64(ls.LatMax.Load()) / 1000.0
	return
}

func (ls *LiveStats) Percentiles() (p50, p95, p99 time.Duration) {
	ls.mu.Lock()
	results := make([]Result, len(ls.secResults))
	copy(results, ls.secResults)
	ls.mu.Unlock()

	if len(results) == 0 {
		return
	}

	lats := make([]time.Duration, len(results))
	for i, r := range results {
		lats[i] = r.Latency
	}
	sort.Slice(lats, func(i, j int) bool { return lats[i] < lats[j] })

	p50 = pctile(lats, 50)
	p95 = pctile(lats, 95)
	p99 = pctile(lats, 99)
	return
}

func pctile(sorted []time.Duration, pct float64) time.Duration {
	if len(sorted) == 0 {
		return 0
	}
	idx := int(math.Ceil(pct/100*float64(len(sorted)))) - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	return sorted[idx]
}

// ─── Load users from PostgreSQL ─────────────────────────────────────────────

func loadUsers(dsn string) ([]User, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("db open: %w", err)
	}
	defer db.Close()

	rows, err := db.Query(`
		SELECT "Username", "Password"
		FROM "RadiusUsers"
		WHERE "Enabled" = true
		  AND "IsDeleted" = false
		  AND "Password" IS NOT NULL
		ORDER BY "Id"
	`)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.Username, &u.Password); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// ─── Inject synthetic users ─────────────────────────────────────────────────

func injectSyntheticUsers(dsn string, count int) error {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("db open: %w", err)
	}
	defer db.Close()

	fmt.Printf("  Injecting %d synthetic users...\n", count)
	start := time.Now()

	// Insert in batches for speed
	batchSize := 50000
	for offset := 0; offset < count; offset += batchSize {
		batch := batchSize
		if offset+batch > count {
			batch = count - offset
		}
		_, err = db.Exec(`
			INSERT INTO "RadiusUsers" (
				"Id", "Uuid", "ExternalId", "Username", "Password",
				"Enabled", "IsDeleted", "SimultaneousSessions", "Balance",
				"LoanBalance", "PinTries", "RemainingDays", "OnlineStatus",
				"UsedTraffic", "AvailableTraffic", "DebtDays", "ProfileId",
				"CreatedAt", "UpdatedAt"
			)
			SELECT
				900000 + $2 + g,
				gen_random_uuid(),
				900000 + $2 + g,
				'lt_' || ($2 + g),
				'pw_' || ($2 + g),
				true, false, 1, 100.00, 0.00,
				0, 0, 0, 0, 0, 0, 4,
				NOW(), NOW()
			FROM generate_series(1, $1) g
			ON CONFLICT DO NOTHING
		`, batch, offset)
		if err != nil {
			return fmt.Errorf("insert batch at %d: %w", offset, err)
		}
	}

	// Custom attributes for half
	_, err = db.Exec(`
		INSERT INTO "RadiusCustomAttributes" (
			"Id", "Uuid", "AttributeName", "AttributeValue", "LinkType",
			"RadiusUserId", "RadiusProfileId", "Enabled", "IsDeleted",
			"CreatedAt", "UpdatedAt"
		)
		SELECT
			900000 + g,
			gen_random_uuid(),
			CASE g % 2 WHEN 0 THEN 'Alc-SLA-Prof-Str' ELSE 'Alc-Subsc-Prof-Str' END,
			CASE g % 2 WHEN 0 THEN 'SLA-LT-' || (g % 20) ELSE 'Sub-LT' END,
			'user',
			900000 + g,
			NULL,
			true, false,
			NOW(), NOW()
		FROM generate_series(1, $1) g
		ON CONFLICT DO NOTHING
	`, count)
	if err != nil {
		return fmt.Errorf("insert attrs: %w", err)
	}

	_, _ = db.Exec(`ANALYZE "RadiusUsers"; ANALYZE "RadiusCustomAttributes"`)
	fmt.Printf("  Injected %d users + attrs in %v\n", count, time.Since(start).Round(time.Millisecond))
	return nil
}

func cleanupSyntheticUsers(dsn string) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return
	}
	defer db.Close()
	fmt.Print("  Cleaning up synthetic users...")
	db.Exec(`DELETE FROM "RadiusCustomAttributes" WHERE "Id" >= 900000`)
	db.Exec(`DELETE FROM "RadiusUsers" WHERE "Id" >= 900000`)
	db.Exec(`ANALYZE "RadiusUsers"; ANALYZE "RadiusCustomAttributes"`)
	fmt.Println(" done")
}

// ─── RADIUS auth request ────────────────────────────────────────────────────

func doAuth(ctx context.Context, addr string, secret []byte, user User) Result {
	pkt := radius.New(radius.CodeAccessRequest, secret)
	rfc2865.UserName_SetString(pkt, user.Username)
	rfc2865.UserPassword_SetString(pkt, user.Password)

	start := time.Now()
	resp, err := radius.Exchange(ctx, pkt, addr)
	lat := time.Since(start)

	if err != nil {
		return Result{Latency: lat, Error: true}
	}
	return Result{
		Latency: lat,
		Success: resp.Code == radius.CodeAccessAccept,
		Reject:  resp.Code == radius.CodeAccessReject,
	}
}

// ─── Rate-limited sender ────────────────────────────────────────────────────
// Sends auth requests at a given rate (req/sec), picking random users.
// Returns when ctx is cancelled or duration expires.

func rateLimitedSend(ctx context.Context, cfg Config, users []User, stats *LiveStats,
	rps int, duration time.Duration, concurrency int) {

	if rps <= 0 || duration <= 0 {
		return
	}

	addr := fmt.Sprintf("%s:%d", cfg.RadiusHost, cfg.RadiusPort)
	secret := []byte(cfg.RadiusSecret)
	sem := make(chan struct{}, concurrency)
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	interval := time.Second / time.Duration(rps)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	deadline := time.After(duration)
	var wg sync.WaitGroup

	for {
		select {
		case <-ctx.Done():
			wg.Wait()
			return
		case <-deadline:
			wg.Wait()
			return
		case <-ticker.C:
			user := users[rng.Intn(len(users))]
			sem <- struct{}{}
			wg.Add(1)
			go func(u User) {
				defer wg.Done()
				defer func() { <-sem }()
				reqCtx, cancel := context.WithTimeout(ctx, cfg.Timeout)
				defer cancel()
				r := doAuth(reqCtx, addr, secret, u)
				stats.Record(r)
			}(user)
		}
	}
}

// ─── Ramp sender: linearly increase RPS over duration ───────────────────────

func rampSend(ctx context.Context, cfg Config, users []User, stats *LiveStats,
	startRPS, endRPS int, duration time.Duration, concurrency int) {

	addr := fmt.Sprintf("%s:%d", cfg.RadiusHost, cfg.RadiusPort)
	secret := []byte(cfg.RadiusSecret)
	sem := make(chan struct{}, concurrency)
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	start := time.Now()
	var wg sync.WaitGroup

	for {
		elapsed := time.Since(start)
		if elapsed >= duration {
			break
		}

		select {
		case <-ctx.Done():
			wg.Wait()
			return
		default:
		}

		// Linear interpolation of current RPS
		progress := float64(elapsed) / float64(duration)
		currentRPS := float64(startRPS) + progress*float64(endRPS-startRPS)
		if currentRPS < 1 {
			currentRPS = 1
		}

		interval := time.Second / time.Duration(currentRPS)
		time.Sleep(interval)

		user := users[rng.Intn(len(users))]
		sem <- struct{}{}
		wg.Add(1)
		go func(u User) {
			defer wg.Done()
			defer func() { <-sem }()
			reqCtx, cancel := context.WithTimeout(ctx, cfg.Timeout)
			defer cancel()
			r := doAuth(reqCtx, addr, secret, u)
			stats.Record(r)
		}(user)
	}

	wg.Wait()
}

// ─── Power outage burst: staggered mass reconnect ───────────────────────────
// Simulates all CPEs rebooting after power restore.
// Modems boot in ~30-120s with jitter, so auth requests arrive in waves.

func outageBurst(ctx context.Context, cfg Config, users []User, stats *LiveStats,
	duration time.Duration, concurrency int) {

	addr := fmt.Sprintf("%s:%d", cfg.RadiusHost, cfg.RadiusPort)
	secret := []byte(cfg.RadiusSecret)
	sem := make(chan struct{}, concurrency)
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	// Assign each user a "boot time" — when their CPE sends PADI after power restore
	// Distribution: 20% fast boot (5-15s), 50% normal (15-45s), 30% slow (45-90s)
	type scheduledAuth struct {
		user  User
		delay time.Duration
	}

	schedule := make([]scheduledAuth, len(users))
	for i, u := range users {
		var delaySec float64
		roll := rng.Float64()
		switch {
		case roll < 0.20: // Fast CPE (Mikrotik, Ubiquiti)
			delaySec = 5 + rng.Float64()*10
		case roll < 0.70: // Normal CPE (TP-Link, D-Link, Huawei HG)
			delaySec = 15 + rng.Float64()*30
		default: // Slow CPE (old ZTE, some Nokia ONTs)
			delaySec = 45 + rng.Float64()*45
		}
		schedule[i] = scheduledAuth{user: u, delay: time.Duration(delaySec * float64(time.Second))}
	}

	// Sort by boot delay
	sort.Slice(schedule, func(i, j int) bool {
		return schedule[i].delay < schedule[j].delay
	})

	// Scale delays to fit within duration
	maxDelay := schedule[len(schedule)-1].delay
	if maxDelay > duration {
		scale := float64(duration) / float64(maxDelay)
		for i := range schedule {
			schedule[i].delay = time.Duration(float64(schedule[i].delay) * scale)
		}
	}

	start := time.Now()
	var wg sync.WaitGroup
	idx := 0

	for idx < len(schedule) {
		select {
		case <-ctx.Done():
			wg.Wait()
			return
		default:
		}

		elapsed := time.Since(start)
		if elapsed >= duration {
			break
		}

		// Fire all users whose boot time has arrived
		for idx < len(schedule) && schedule[idx].delay <= elapsed {
			user := schedule[idx].user
			sem <- struct{}{}
			wg.Add(1)
			go func(u User) {
				defer wg.Done()
				defer func() { <-sem }()
				reqCtx, cancel := context.WithTimeout(ctx, cfg.Timeout)
				defer cancel()
				r := doAuth(reqCtx, addr, secret, u)
				stats.Record(r)
			}(user)
			idx++
		}

		// Sleep briefly before checking again
		time.Sleep(5 * time.Millisecond)
	}

	wg.Wait()
}

// ─── Live progress ticker ───────────────────────────────────────────────────

func startProgressTicker(ctx context.Context, stats *LiveStats, phase string) {
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()
		start := time.Now()
		var lastSent int64

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				total, accept, reject, errors, avgMs, maxMs := stats.Snapshot()
				elapsed := time.Since(start).Round(time.Second)
				delta := total - lastSent
				lastSent = total
				instantRPS := float64(delta) / 2.0

				errPct := 0.0
				if total > 0 {
					errPct = float64(errors) / float64(total) * 100
				}

				fmt.Printf("  [%s +%s] %d sent (%.0f/s) │ ✓%d ✗%d ⚠%d (%.1f%%) │ avg=%.1fms max=%.1fms\n",
					phase, elapsed, total, instantRPS,
					accept, reject, errors, errPct,
					avgMs, maxMs)
			}
		}
	}()
}

// ─── Pretty helpers ─────────────────────────────────────────────────────────

func fmtDur(d time.Duration) string {
	if d < time.Millisecond {
		return fmt.Sprintf("%.0fµs", float64(d.Microseconds()))
	}
	if d < time.Second {
		return fmt.Sprintf("%.1fms", float64(d.Microseconds())/1000)
	}
	return fmt.Sprintf("%.2fs", d.Seconds())
}

func printPhaseResult(name string, stats *LiveStats, dur time.Duration) {
	total, accept, reject, errors, avgMs, maxMs := stats.Snapshot()
	p50, p95, p99 := stats.Percentiles()

	rps := 0.0
	if dur.Seconds() > 0 {
		rps = float64(total) / dur.Seconds()
	}

	errPct := 0.0
	if total > 0 {
		errPct = float64(errors) / float64(total) * 100
	}

	fmt.Println()
	fmt.Printf("┌─ %s ─────────────────────────────────────────────────────\n", name)
	fmt.Printf("│  Duration:   %s\n", dur.Round(time.Millisecond))
	fmt.Printf("│  Requests:   %d total  │  ✓ %d accept  │  ✗ %d reject  │  ⚠ %d error (%.1f%%)\n",
		total, accept, reject, errors, errPct)
	fmt.Printf("│  Latency:    avg=%.1fms  max=%.1fms\n", avgMs, maxMs)
	fmt.Printf("│  Percentile: p50=%s  p95=%s  p99=%s\n", fmtDur(p50), fmtDur(p95), fmtDur(p99))
	fmt.Printf("│  Throughput: %.1f req/sec\n", rps)
	fmt.Printf("└──────────────────────────────────────────────────────────────────\n")
}

// ─── Phase summary for final report ─────────────────────────────────────────

type PhaseSummary struct {
	Name     string
	Duration time.Duration
	Total    int64
	Accept   int64
	Reject   int64
	Errors   int64
	AvgMs    float64
	MaxMs    float64
	P50      time.Duration
	P95      time.Duration
	P99      time.Duration
	RPS      float64
}

func capturePhase(name string, stats *LiveStats, dur time.Duration) PhaseSummary {
	total, accept, reject, errors, avgMs, maxMs := stats.Snapshot()
	p50, p95, p99 := stats.Percentiles()
	rps := 0.0
	if dur.Seconds() > 0 {
		rps = float64(total) / dur.Seconds()
	}
	return PhaseSummary{
		Name: name, Duration: dur,
		Total: total, Accept: accept, Reject: reject, Errors: errors,
		AvgMs: avgMs, MaxMs: maxMs,
		P50: p50, P95: p95, P99: p99, RPS: rps,
	}
}

func printFinalReport(phases []PhaseSummary, userCount int) {
	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════════════════════════╗")
	fmt.Println("║          NOKIA 7750 SR BNG — REALISTIC LOAD TEST REPORT                 ║")
	fmt.Println("╚══════════════════════════════════════════════════════════════════════════╝")
	fmt.Println()
	fmt.Printf("  Subscriber base: %d users\n\n", userCount)

	var grandTotal, grandAccept, grandReject, grandErrors int64
	var grandDur time.Duration

	fmt.Printf("  %-22s %8s %8s %6s %8s %8s %8s %8s\n",
		"PHASE", "REQS", "RPS", "ERR%", "AVG", "P50", "P95", "P99")
	fmt.Printf("  %s\n", "─────────────────────────────────────────────────────────────────────────")

	for _, p := range phases {
		errPct := 0.0
		if p.Total > 0 {
			errPct = float64(p.Errors) / float64(p.Total) * 100
		}
		fmt.Printf("  %-22s %8d %8.0f %5.1f%% %8s %8s %8s %8s\n",
			p.Name, p.Total, p.RPS, errPct,
			fmtDur(time.Duration(p.AvgMs*1000)*time.Microsecond),
			fmtDur(p.P50), fmtDur(p.P95), fmtDur(p.P99))

		grandTotal += p.Total
		grandAccept += p.Accept
		grandReject += p.Reject
		grandErrors += p.Errors
		grandDur += p.Duration
	}

	fmt.Printf("  %s\n", "─────────────────────────────────────────────────────────────────────────")

	grandRPS := 0.0
	if grandDur.Seconds() > 0 {
		grandRPS = float64(grandTotal) / grandDur.Seconds()
	}
	grandErrPct := 0.0
	if grandTotal > 0 {
		grandErrPct = float64(grandErrors) / float64(grandTotal) * 100
	}

	fmt.Printf("  %-22s %8d %8.0f %5.1f%%\n", "TOTAL", grandTotal, grandRPS, grandErrPct)
	fmt.Println()
	fmt.Printf("  ✓ Accept:  %d  │  ✗ Reject:  %d  │  ⚠ Error:  %d\n", grandAccept, grandReject, grandErrors)
	fmt.Printf("  Total time: %s\n", grandDur.Round(time.Second))
	fmt.Println()

	// ── Verdict ─────────────────────────────────────────────────────
	// Check outage phase specifically (most demanding)
	var outagePhase *PhaseSummary
	var peakPhase *PhaseSummary
	for i := range phases {
		if phases[i].Name == "POWER OUTAGE" {
			outagePhase = &phases[i]
		}
		if phases[i].Name == "SUSTAINED PEAK" {
			peakPhase = &phases[i]
		}
	}

	fmt.Println("  ┌─ VERDICT ─────────────────────────────────────────────────────")

	if grandErrPct > 10 {
		fmt.Println("  │  ❌ FAIL — Error rate >10%. FreeRADIUS cannot handle this scale.")
		fmt.Println("  │  Recommendations:")
		fmt.Println("  │    • Increase thread pool in radiusd.conf (thread pool { })")
		fmt.Println("  │    • Increase PostgreSQL max_connections")
		fmt.Println("  │    • Consider FreeRADIUS connection pooling (num=32+)")
	} else if grandErrPct > 2 {
		fmt.Println("  │  ⚠️  DEGRADED — Some timeouts under heavy load.")
		if outagePhase != nil {
			outageErr := 0.0
			if outagePhase.Total > 0 {
				outageErr = float64(outagePhase.Errors) / float64(outagePhase.Total) * 100
			}
			fmt.Printf("  │  Outage recovery: %.1f%% error rate\n", outageErr)
		}
		fmt.Println("  │  May need tuning for power-outage scenarios.")
	} else {
		fmt.Println("  │  🚀 EXCELLENT — Handles all realistic BNG scenarios.")
		if peakPhase != nil {
			fmt.Printf("  │  Sustained peak: %.0f req/sec with <2%% errors\n", peakPhase.RPS)
		}
		if outagePhase != nil {
			fmt.Printf("  │  Power outage recovery: %d/%d users re-authed in %s\n",
				outagePhase.Accept, outagePhase.Total, outagePhase.Duration.Round(time.Second))
		}
	}

	// ISP capacity estimate
	if peakPhase != nil && peakPhase.RPS > 0 {
		recoveryTime := float64(userCount) / peakPhase.RPS
		fmt.Printf("  │\n")
		fmt.Printf("  │  📊 Capacity estimate:\n")
		fmt.Printf("  │     Sustained: %.0f auth/sec\n", peakPhase.RPS)
		fmt.Printf("  │     Full %dk user re-auth: ~%.0fs (%.1f min)\n",
			userCount/1000, recoveryTime, recoveryTime/60)

		subsPerBNG := 16000                                             // typical Nokia 7750 SR
		bngsSupported := int(peakPhase.RPS * 120 / float64(subsPerBNG)) // 2-min recovery window
		if bngsSupported < 1 {
			bngsSupported = 1
		}
		fmt.Printf("  │     BNG chassis supported: ~%d (at %dk subs each, 2-min recovery)\n",
			bngsSupported, subsPerBNG/1000)
	}

	fmt.Println("  └────────────────────────────────────────────────────────────────")
	fmt.Println()
}

// ─── Main ───────────────────────────────────────────────────────────────────

func main() {
	cfg := Config{}

	flag.StringVar(&cfg.RadiusHost, "host", envOr("RADIUS_HOST", "freeradius"), "RADIUS server host")
	flag.IntVar(&cfg.RadiusPort, "port", envOrInt("RADIUS_PORT", 1812), "RADIUS server port")
	flag.StringVar(&cfg.RadiusSecret, "secret", envOr("RADIUS_SECRET", "testing123"), "RADIUS shared secret")
	flag.StringVar(&cfg.PgDSN, "dsn", envOr("PG_DSN",
		"host=postgres port=5432 user=postgres password=changeme_in_production dbname=edge_db sslmode=disable"),
		"PostgreSQL DSN")
	flag.DurationVar(&cfg.Timeout, "timeout", 5*time.Second, "Per-request timeout")
	flag.IntVar(&cfg.ScaleUsers, "scale", envOrInt("SCALE", 0), "Inject N synthetic users (0=disabled)")
	flag.BoolVar(&cfg.Verbose, "verbose", false, "Verbose output")

	// Phase config
	flag.DurationVar(&cfg.SteadyDuration, "steady-dur", 30*time.Second, "Steady state duration")
	flag.DurationVar(&cfg.RampDuration, "ramp-dur", 30*time.Second, "Ramp-up duration")
	flag.DurationVar(&cfg.OutageDuration, "outage-dur", 90*time.Second, "Outage recovery duration")
	flag.DurationVar(&cfg.PeakDuration, "peak-dur", 30*time.Second, "Sustained peak duration")
	flag.IntVar(&cfg.SteadyRPS, "steady-rps", 50, "Steady state auth/sec")
	flag.IntVar(&cfg.PeakRPS, "peak-rps", 1000, "Peak auth/sec target")

	// Presets
	quick := flag.Bool("quick", false, "Quick test (15s phases, 100K users)")
	full := flag.Bool("full", false, "Full realistic test (longer phases, 100K users)")

	flag.Parse()

	if *quick {
		cfg.SteadyDuration = 10 * time.Second
		cfg.RampDuration = 15 * time.Second
		cfg.OutageDuration = 30 * time.Second
		cfg.PeakDuration = 15 * time.Second
		cfg.SteadyRPS = 100
		cfg.PeakRPS = 800
		if cfg.ScaleUsers == 0 {
			cfg.ScaleUsers = 100000
		}
	}
	if *full {
		cfg.SteadyDuration = 60 * time.Second
		cfg.RampDuration = 60 * time.Second
		cfg.OutageDuration = 120 * time.Second
		cfg.PeakDuration = 60 * time.Second
		cfg.SteadyRPS = 50
		cfg.PeakRPS = 1200
		if cfg.ScaleUsers == 0 {
			cfg.ScaleUsers = 100000
		}
	}

	// ── Header ──────────────────────────────────────────────────────
	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════════════════════════╗")
	fmt.Println("║       Nokia 7750 SR BNG — Realistic RADIUS Auth Load Test               ║")
	fmt.Println("║       FreeRADIUS ← PostgreSQL (EdgeRuntime)                             ║")
	fmt.Println("╚══════════════════════════════════════════════════════════════════════════╝")
	fmt.Println()

	// Graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		fmt.Println("\n  ⚠ Interrupted — finishing current phase...")
		cancel()
	}()

	// ── Inject users ────────────────────────────────────────────────
	if cfg.ScaleUsers > 0 {
		if err := injectSyntheticUsers(cfg.PgDSN, cfg.ScaleUsers); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to inject users: %v\n", err)
			os.Exit(1)
		}
		defer cleanupSyntheticUsers(cfg.PgDSN)
	}

	// ── Load users ──────────────────────────────────────────────────
	fmt.Print("  Loading users from PostgreSQL... ")
	users, err := loadUsers(cfg.PgDSN)
	if err != nil {
		fmt.Fprintf(os.Stderr, "\nFailed to load users: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("%d users loaded\n", len(users))

	if len(users) == 0 {
		fmt.Println("  No users found. Exiting.")
		os.Exit(0)
	}

	// Shuffle users so we don't always hit same indexes
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	rng.Shuffle(len(users), func(i, j int) { users[i], users[j] = users[j], users[i] })

	fmt.Printf("  Target: %s:%d\n", cfg.RadiusHost, cfg.RadiusPort)
	fmt.Printf("  Phases: steady=%s  ramp=%s  outage=%s  peak=%s\n",
		cfg.SteadyDuration, cfg.RampDuration, cfg.OutageDuration, cfg.PeakDuration)
	fmt.Printf("  Rates:  steady=%d/s  peak=%d/s\n", cfg.SteadyRPS, cfg.PeakRPS)

	// ── Warmup ──────────────────────────────────────────────────────
	fmt.Print("\n  Warmup: ")
	addr := fmt.Sprintf("%s:%d", cfg.RadiusHost, cfg.RadiusPort)
	secret := []byte(cfg.RadiusSecret)
	for i := 0; i < 10 && i < len(users); i++ {
		reqCtx, c := context.WithTimeout(ctx, cfg.Timeout)
		doAuth(reqCtx, addr, secret, users[i])
		c()
		fmt.Print(".")
	}
	fmt.Println(" done\n")

	var phases []PhaseSummary

	// ═══════════════════════════════════════════════════════════════════
	//  Phase 1: STEADY STATE — Normal ISP churn
	// ═══════════════════════════════════════════════════════════════════
	if ctx.Err() == nil {
		fmt.Println("━━━ Phase 1: STEADY STATE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		fmt.Printf("  Simulating normal PPPoE churn: %d auth/sec for %s\n", cfg.SteadyRPS, cfg.SteadyDuration)
		fmt.Println("  (Lease expiry, modem reboots, line flaps)")

		s1 := &LiveStats{}
		pCtx, pCancel := context.WithCancel(ctx)
		startProgressTicker(pCtx, s1, "STEADY")

		start := time.Now()
		rateLimitedSend(ctx, cfg, users, s1, cfg.SteadyRPS, cfg.SteadyDuration, 100)
		dur := time.Since(start)

		pCancel()
		printPhaseResult("STEADY STATE", s1, dur)
		phases = append(phases, capturePhase("STEADY STATE", s1, dur))
	}

	// ═══════════════════════════════════════════════════════════════════
	//  Phase 2: RAMP UP — Morning peak
	// ═══════════════════════════════════════════════════════════════════
	if ctx.Err() == nil {
		fmt.Println("\n━━━ Phase 2: RAMP UP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		fmt.Printf("  Morning peak ramp: %d → %d auth/sec over %s\n",
			cfg.SteadyRPS, cfg.PeakRPS, cfg.RampDuration)
		fmt.Println("  (06:00-08:00 — subscribers come online)")

		s2 := &LiveStats{}
		pCtx, pCancel := context.WithCancel(ctx)
		startProgressTicker(pCtx, s2, "RAMP  ")

		start := time.Now()
		rampSend(ctx, cfg, users, s2, cfg.SteadyRPS, cfg.PeakRPS, cfg.RampDuration, 300)
		dur := time.Since(start)

		pCancel()
		printPhaseResult("RAMP UP", s2, dur)
		phases = append(phases, capturePhase("RAMP UP", s2, dur))
	}

	// ═══════════════════════════════════════════════════════════════════
	//  Phase 3: POWER OUTAGE RECOVERY — Mass reconnect
	// ═══════════════════════════════════════════════════════════════════
	if ctx.Err() == nil {
		fmt.Println("\n━━━ Phase 3: POWER OUTAGE RECOVERY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		fmt.Printf("  Power restored! %d CPEs rebooting over %s\n", len(users), cfg.OutageDuration)
		fmt.Println("  (20%% fast boot 5-15s, 50%% normal 15-45s, 30%% slow 45-90s)")

		s3 := &LiveStats{}
		pCtx, pCancel := context.WithCancel(ctx)
		startProgressTicker(pCtx, s3, "OUTAGE")

		start := time.Now()
		outageBurst(ctx, cfg, users, s3, cfg.OutageDuration, 500)
		dur := time.Since(start)

		pCancel()
		printPhaseResult("POWER OUTAGE", s3, dur)
		phases = append(phases, capturePhase("POWER OUTAGE", s3, dur))
	}

	// ═══════════════════════════════════════════════════════════════════
	//  Phase 4: SUSTAINED PEAK — Max throughput
	// ═══════════════════════════════════════════════════════════════════
	if ctx.Err() == nil {
		fmt.Println("\n━━━ Phase 4: SUSTAINED PEAK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		fmt.Printf("  Continuous %d auth/sec for %s\n", cfg.PeakRPS, cfg.PeakDuration)
		fmt.Println("  (Finding sustained throughput ceiling)")

		s4 := &LiveStats{}
		pCtx, pCancel := context.WithCancel(ctx)
		startProgressTicker(pCtx, s4, "PEAK  ")

		start := time.Now()
		rateLimitedSend(ctx, cfg, users, s4, cfg.PeakRPS, cfg.PeakDuration, 500)
		dur := time.Since(start)

		pCancel()
		printPhaseResult("SUSTAINED PEAK", s4, dur)
		phases = append(phases, capturePhase("SUSTAINED PEAK", s4, dur))
	}

	// ═══════════════════════════════════════════════════════════════════
	//  Final Report
	// ═══════════════════════════════════════════════════════════════════
	if len(phases) > 0 {
		printFinalReport(phases, len(users))
	}
}

// ─── Env helpers ────────────────────────────────────────────────────────────

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envOrInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	var n int
	fmt.Sscanf(v, "%d", &n)
	if n > 0 {
		return n
	}
	return fallback
}
