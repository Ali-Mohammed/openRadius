package main

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"
	"net"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	_ "github.com/lib/pq"
	"layeh.com/radius"
	"layeh.com/radius/rfc2865"
	"layeh.com/radius/rfc2866"
	"layeh.com/radius/rfc2869"
)

// BNG represents a Nokia 7750 SR chassis
type BNG struct {
	Name string
	IP   net.IP
	MAC  string
}

// TrafficProfile defines bandwidth characteristics
type TrafficProfile struct {
	Name  string
	DLMin int64
	DLMax int64
	ULMin int64
	ULMax int64
}

// Subscriber from RadiusUsers CDC table
type Subscriber struct {
	Username string
	Password string
}

// Session tracks an active PPPoE/IPoE session
type Session struct {
	Username   string
	SessionID  string
	BNG        *BNG
	NASPort    uint32
	FramedIP   net.IP
	MAC        string
	Profile    *TrafficProfile
	StartTime  time.Time
	AcctTime   uint32
	TotalDL    int64
	TotalUL    int64
	CycleCount int
}

// Stats holds atomic counters
type Stats struct {
	Starts   int64
	Interims int64
	Stops    int64
	Errors   int64
	Cycles   int64
	TotalDL  int64
	TotalUL  int64
}

// Simulator is the main engine
type Simulator struct {
	radiusAuthAddr string
	radiusAcctAddr string
	radiusSecret   []byte
	pgConnStr      string
	maxSubs        int
	cycleInterval  time.Duration
	interimSecs    int
	connectPct     int
	disconnectPct  int
	headless       bool

	subscribers []Subscriber
	sessions    map[string]*Session
	mu          sync.Mutex
	stats       Stats
	startTime   time.Time
	rng         *rand.Rand
}

var bngs = []BNG{
	{Name: "BNG-CORE-01", IP: net.ParseIP("10.10.10.1"), MAC: "AA:BB:CC:01:00:01"},
	{Name: "BNG-CORE-02", IP: net.ParseIP("10.10.20.1"), MAC: "AA:BB:CC:02:00:01"},
	{Name: "BNG-AGGR-01", IP: net.ParseIP("10.10.30.1"), MAC: "AA:BB:CC:03:00:01"},
}

var profiles = []TrafficProfile{
	{Name: "residential-basic", DLMin: 100000, DLMax: 5000000, ULMin: 10000, ULMax: 500000},
	{Name: "residential-premium", DLMin: 500000, DLMax: 20000000, ULMin: 50000, ULMax: 5000000},
	{Name: "business-fiber", DLMin: 1000000, DLMax: 50000000, ULMin: 200000, ULMax: 10000000},
	{Name: "gaming-ultra", DLMin: 2000000, DLMax: 100000000, ULMin: 500000, ULMax: 20000000},
	{Name: "iptv-multicast", DLMin: 5000000, DLMax: 200000000, ULMin: 100000, ULMax: 2000000},
}

var terminateCauses = []rfc2866.AcctTerminateCause{
	rfc2866.AcctTerminateCause_Value_UserRequest,
	rfc2866.AcctTerminateCause_Value_LostCarrier,
	rfc2866.AcctTerminateCause_Value_IdleTimeout,
	rfc2866.AcctTerminateCause_Value_SessionTimeout,
	rfc2866.AcctTerminateCause_Value_PortError,
	rfc2866.AcctTerminateCause_Value_AdminReset,
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func NewSimulator() *Simulator {
	return &Simulator{
		radiusAuthAddr: envOr("RADIUS_HOST", "freeradius") + ":" + envOr("RADIUS_AUTH_PORT", "1812"),
		radiusAcctAddr: envOr("RADIUS_HOST", "freeradius") + ":" + envOr("RADIUS_ACCT_PORT", "1813"),
		radiusSecret:   []byte(envOr("RADIUS_SECRET", "testing123")),
		pgConnStr:      envOr("PG_CONN", "postgres://postgres:changeme_in_production@postgres:5432/edge_db?sslmode=disable"),
		maxSubs:        envInt("MAX_SUBSCRIBERS", 20),
		cycleInterval:  time.Duration(envInt("CYCLE_INTERVAL", 5)) * time.Second,
		interimSecs:    envInt("INTERIM_INTERVAL", 300),
		connectPct:     envInt("CONNECT_CHANCE", 15),
		disconnectPct:  envInt("DISCONNECT_CHANCE", 3),
		headless:       envOr("HEADLESS", "false") == "true",
		sessions:       make(map[string]*Session),
		rng:            rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

func (s *Simulator) loadSubscribers() error {
	fmt.Println("Loading subscribers from PostgreSQL...")
	db, err := sql.Open("postgres", s.pgConnStr)
	if err != nil {
		return fmt.Errorf("pg connect: %w", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := db.QueryContext(ctx,
		`SELECT "Username", "Password" FROM "RadiusUsers" WHERE "Enabled"=true AND "IsDeleted"=false AND "Password" IS NOT NULL ORDER BY random() LIMIT $1`, s.maxSubs)
	if err != nil {
		return fmt.Errorf("pg query: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var sub Subscriber
		if err := rows.Scan(&sub.Username, &sub.Password); err != nil {
			continue
		}
		s.subscribers = append(s.subscribers, sub)
	}
	if len(s.subscribers) == 0 {
		return fmt.Errorf("no subscribers found")
	}
	fmt.Printf("Loaded %d subscribers\n", len(s.subscribers))
	return nil
}

func (s *Simulator) genSessionID() string {
	return fmt.Sprintf("%04X%04X%04X%04X",
		s.rng.Intn(0xFFFF), s.rng.Intn(0xFFFF),
		s.rng.Intn(0xFFFF), s.rng.Intn(0xFFFF))
}

func (s *Simulator) genMAC() string {
	return fmt.Sprintf("%02X:%02X:%02X:%02X:%02X:%02X",
		s.rng.Intn(256), s.rng.Intn(256), s.rng.Intn(256),
		s.rng.Intn(256), s.rng.Intn(256), s.rng.Intn(256))
}

func (s *Simulator) genFramedIP() net.IP {
	return net.IPv4(172, 16, byte(s.rng.Intn(254)+1), byte(s.rng.Intn(254)+1))
}

func (s *Simulator) sendAuth(username, password string) error {
	pkt := radius.New(radius.CodeAccessRequest, s.radiusSecret)
	rfc2865.UserName_SetString(pkt, username)
	rfc2865.UserPassword_SetString(pkt, password)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := radius.Exchange(ctx, pkt, s.radiusAuthAddr)
	if err != nil {
		return fmt.Errorf("auth exchange: %w", err)
	}
	if resp.Code != radius.CodeAccessAccept {
		return fmt.Errorf("rejected (code=%d)", resp.Code)
	}
	return nil
}

func (s *Simulator) sendAcctStart(sess *Session) error {
	pkt := radius.New(radius.CodeAccountingRequest, s.radiusSecret)
	rfc2866.AcctStatusType_Set(pkt, rfc2866.AcctStatusType_Value_Start)
	rfc2866.AcctSessionID_SetString(pkt, sess.SessionID)
	rfc2865.UserName_SetString(pkt, sess.Username)
	rfc2865.NASIPAddress_Set(pkt, sess.BNG.IP)
	rfc2865.FramedIPAddress_Set(pkt, sess.FramedIP)
	rfc2865.NASPort_Set(pkt, rfc2865.NASPort(sess.NASPort))
	rfc2865.NASPortType_Set(pkt, rfc2865.NASPortType_Value_Ethernet)
	rfc2865.CalledStationID_SetString(pkt, sess.BNG.MAC)
	rfc2865.CallingStationID_SetString(pkt, sess.MAC)
	rfc2865.ServiceType_Set(pkt, rfc2865.ServiceType_Value_FramedUser)
	rfc2865.FramedProtocol_Set(pkt, rfc2865.FramedProtocol_Value_PPP)
	rfc2869.AcctInterimInterval_Set(pkt, rfc2869.AcctInterimInterval(s.interimSecs))
	rfc2865.NASIdentifier_SetString(pkt, sess.BNG.Name)
	rfc2866.AcctAuthentic_Set(pkt, rfc2866.AcctAuthentic_Value_RADIUS)
	return s.exchangeAcct(pkt)
}

func (s *Simulator) sendAcctInterim(sess *Session) error {
	pkt := radius.New(radius.CodeAccountingRequest, s.radiusSecret)
	const giga uint64 = 4294967296
	dlGiga := uint32(uint64(sess.TotalDL) / giga)
	dlOctets := uint32(uint64(sess.TotalDL) % giga)
	ulGiga := uint32(uint64(sess.TotalUL) / giga)
	ulOctets := uint32(uint64(sess.TotalUL) % giga)

	rfc2866.AcctStatusType_Set(pkt, rfc2866.AcctStatusType_Value_InterimUpdate)
	rfc2866.AcctSessionID_SetString(pkt, sess.SessionID)
	rfc2865.UserName_SetString(pkt, sess.Username)
	rfc2865.NASIPAddress_Set(pkt, sess.BNG.IP)
	rfc2865.FramedIPAddress_Set(pkt, sess.FramedIP)
	rfc2865.NASPort_Set(pkt, rfc2865.NASPort(sess.NASPort))
	rfc2865.NASPortType_Set(pkt, rfc2865.NASPortType_Value_Ethernet)
	rfc2865.CalledStationID_SetString(pkt, sess.BNG.MAC)
	rfc2865.CallingStationID_SetString(pkt, sess.MAC)
	rfc2865.ServiceType_Set(pkt, rfc2865.ServiceType_Value_FramedUser)
	rfc2865.FramedProtocol_Set(pkt, rfc2865.FramedProtocol_Value_PPP)
	rfc2869.AcctInterimInterval_Set(pkt, rfc2869.AcctInterimInterval(s.interimSecs))
	rfc2865.NASIdentifier_SetString(pkt, sess.BNG.Name)
	rfc2866.AcctSessionTime_Set(pkt, rfc2866.AcctSessionTime(sess.AcctTime))
	rfc2866.AcctInputOctets_Set(pkt, rfc2866.AcctInputOctets(dlOctets))
	rfc2866.AcctOutputOctets_Set(pkt, rfc2866.AcctOutputOctets(ulOctets))
	rfc2869.AcctInputGigawords_Set(pkt, rfc2869.AcctInputGigawords(dlGiga))
	rfc2869.AcctOutputGigawords_Set(pkt, rfc2869.AcctOutputGigawords(ulGiga))
	rfc2866.AcctAuthentic_Set(pkt, rfc2866.AcctAuthentic_Value_RADIUS)
	return s.exchangeAcct(pkt)
}

func (s *Simulator) sendAcctStop(sess *Session, cause rfc2866.AcctTerminateCause) error {
	pkt := radius.New(radius.CodeAccountingRequest, s.radiusSecret)
	const giga uint64 = 4294967296
	dlGiga := uint32(uint64(sess.TotalDL) / giga)
	dlOctets := uint32(uint64(sess.TotalDL) % giga)
	ulGiga := uint32(uint64(sess.TotalUL) / giga)
	ulOctets := uint32(uint64(sess.TotalUL) % giga)

	rfc2866.AcctStatusType_Set(pkt, rfc2866.AcctStatusType_Value_Stop)
	rfc2866.AcctSessionID_SetString(pkt, sess.SessionID)
	rfc2865.UserName_SetString(pkt, sess.Username)
	rfc2865.NASIPAddress_Set(pkt, sess.BNG.IP)
	rfc2865.FramedIPAddress_Set(pkt, sess.FramedIP)
	rfc2865.NASPort_Set(pkt, rfc2865.NASPort(sess.NASPort))
	rfc2866.AcctTerminateCause_Set(pkt, cause)
	rfc2866.AcctSessionTime_Set(pkt, rfc2866.AcctSessionTime(sess.AcctTime))
	rfc2866.AcctInputOctets_Set(pkt, rfc2866.AcctInputOctets(dlOctets))
	rfc2866.AcctOutputOctets_Set(pkt, rfc2866.AcctOutputOctets(ulOctets))
	rfc2869.AcctInputGigawords_Set(pkt, rfc2869.AcctInputGigawords(dlGiga))
	rfc2869.AcctOutputGigawords_Set(pkt, rfc2869.AcctOutputGigawords(ulGiga))
	rfc2866.AcctAuthentic_Set(pkt, rfc2866.AcctAuthentic_Value_RADIUS)
	return s.exchangeAcct(pkt)
}

func (s *Simulator) exchangeAcct(pkt *radius.Packet) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	resp, err := radius.Exchange(ctx, pkt, s.radiusAcctAddr)
	if err != nil {
		atomic.AddInt64(&s.stats.Errors, 1)
		return fmt.Errorf("acct exchange: %w", err)
	}
	if resp.Code != radius.CodeAccountingResponse {
		atomic.AddInt64(&s.stats.Errors, 1)
		return fmt.Errorf("unexpected code=%d", resp.Code)
	}
	return nil
}

func (s *Simulator) doConnect(sub *Subscriber) {
	if err := s.sendAuth(sub.Username, sub.Password); err != nil {
		s.logEvent("WARN", fmt.Sprintf("Auth reject: %s - %v", sub.Username, err))
		return
	}

	bng := &bngs[s.rng.Intn(len(bngs))]
	prof := &profiles[s.rng.Intn(len(profiles))]
	sess := &Session{
		Username:  sub.Username,
		SessionID: s.genSessionID(),
		BNG:       bng,
		NASPort:   uint32(s.rng.Intn(65536)),
		FramedIP:  s.genFramedIP(),
		MAC:       s.genMAC(),
		Profile:   prof,
		StartTime: time.Now(),
	}

	if err := s.sendAcctStart(sess); err != nil {
		s.logEvent("ERROR", fmt.Sprintf("Start fail: %s - %v", sub.Username, err))
		return
	}

	s.mu.Lock()
	s.sessions[sub.Username] = sess
	s.mu.Unlock()

	atomic.AddInt64(&s.stats.Starts, 1)
	s.logEvent("START", fmt.Sprintf("%s sid=%s nas=%s ip=%s prof=%s",
		sub.Username, sess.SessionID, bng.Name, sess.FramedIP, prof.Name))
}

func (s *Simulator) doInterim(sess *Session) {
	dlRange := sess.Profile.DLMax - sess.Profile.DLMin
	ulRange := sess.Profile.ULMax - sess.Profile.ULMin
	dlDelta := s.rng.Int63n(dlRange) + sess.Profile.DLMin
	ulDelta := s.rng.Int63n(ulRange) + sess.Profile.ULMin

	sess.TotalDL += dlDelta
	sess.TotalUL += ulDelta
	sess.AcctTime += uint32(s.interimSecs)

	if err := s.sendAcctInterim(sess); err != nil {
		s.logEvent("ERROR", fmt.Sprintf("Interim fail: %s - %v", sess.Username, err))
		return
	}

	atomic.AddInt64(&s.stats.Interims, 1)
	atomic.AddInt64(&s.stats.TotalDL, dlDelta)
	atomic.AddInt64(&s.stats.TotalUL, ulDelta)
	s.logEvent("INTERIM", fmt.Sprintf("%s t=%ds dl=%s ul=%s",
		sess.Username, sess.AcctTime, fmtBytes(sess.TotalDL), fmtBytes(sess.TotalUL)))
}

func (s *Simulator) doDisconnect(sess *Session) {
	cause := terminateCauses[s.rng.Intn(len(terminateCauses))]
	if err := s.sendAcctStop(sess, cause); err != nil {
		s.logEvent("ERROR", fmt.Sprintf("Stop fail: %s - %v", sess.Username, err))
		return
	}

	s.mu.Lock()
	delete(s.sessions, sess.Username)
	s.mu.Unlock()

	atomic.AddInt64(&s.stats.Stops, 1)
	s.logEvent("STOP", fmt.Sprintf("%s cause=%s t=%ds dl=%s ul=%s",
		sess.Username, cause, sess.AcctTime, fmtBytes(sess.TotalDL), fmtBytes(sess.TotalUL)))
}

func (s *Simulator) runCycle() {
	atomic.AddInt64(&s.stats.Cycles, 1)

	s.mu.Lock()
	activeCount := len(s.sessions)
	s.mu.Unlock()

	// Phase 1: New connections
	if activeCount < s.maxSubs && s.rng.Intn(100) < s.connectPct {
		for attempt := 0; attempt < 5; attempt++ {
			sub := &s.subscribers[s.rng.Intn(len(s.subscribers))]
			s.mu.Lock()
			_, active := s.sessions[sub.Username]
			s.mu.Unlock()
			if !active {
				s.doConnect(sub)
				break
			}
		}
	}

	// Phase 2: Interim updates
	s.mu.Lock()
	var interimDue []*Session
	cyclesPerInterim := s.interimSecs / int(s.cycleInterval.Seconds())
	if cyclesPerInterim < 1 {
		cyclesPerInterim = 1
	}
	for _, sess := range s.sessions {
		sess.CycleCount++
		if sess.CycleCount%cyclesPerInterim == 0 && sess.CycleCount > 0 {
			interimDue = append(interimDue, sess)
		}
	}
	s.mu.Unlock()

	var wg sync.WaitGroup
	for _, sess := range interimDue {
		wg.Add(1)
		go func(ss *Session) {
			defer wg.Done()
			s.doInterim(ss)
		}(sess)
	}
	wg.Wait()

	// Phase 3: Random disconnections
	s.mu.Lock()
	var toDisconnect []*Session
	for _, sess := range s.sessions {
		if sess.AcctTime >= uint32(s.interimSecs*2) && s.rng.Intn(100) < s.disconnectPct {
			toDisconnect = append(toDisconnect, sess)
		}
	}
	s.mu.Unlock()

	for _, sess := range toDisconnect {
		s.doDisconnect(sess)
	}
}

func (s *Simulator) drawDashboard() {
	s.mu.Lock()
	defer s.mu.Unlock()

	runtime := time.Since(s.startTime)
	active := len(s.sessions)

	fmt.Print("\033[2J\033[H")
	fmt.Println("\033[1;36m+=========================================================================+\033[0m")
	fmt.Println("\033[1;36m|           Nokia 7750 SR BNG Simulator - EdgeRuntime (Go)                |\033[0m")
	fmt.Println("\033[1;36m+=========================================================================+\033[0m")
	fmt.Printf("  BNG: \033[1m%d\033[0m | Pool: \033[1m%d\033[0m | Cycle: \033[1m%s\033[0m | Interim: \033[1m%ds\033[0m\n",
		len(bngs), len(s.subscribers), s.cycleInterval, s.interimSecs)
	fmt.Printf("  Runtime: \033[1m%s\033[0m | Cycle: \033[1m%d\033[0m | Active: \033[1;32m%d\033[0m\n",
		fmtDuration(runtime), atomic.LoadInt64(&s.stats.Cycles), active)
	fmt.Println("\033[1;36m+-------------------------------------------------------------------------+\033[0m")
	fmt.Printf("  \033[32mStart:\033[0m %-6d | \033[33mInterim:\033[0m %-6d | \033[31mStop:\033[0m %-6d | \033[31mErr:\033[0m %-4d\n",
		atomic.LoadInt64(&s.stats.Starts), atomic.LoadInt64(&s.stats.Interims),
		atomic.LoadInt64(&s.stats.Stops), atomic.LoadInt64(&s.stats.Errors))
	fmt.Printf("  DL: %-14s | UL: %-14s\n",
		fmtBytes(atomic.LoadInt64(&s.stats.TotalDL)), fmtBytes(atomic.LoadInt64(&s.stats.TotalUL)))
	fmt.Println("\033[1;36m+-------------------------------------------------------------------------+\033[0m")

	fmt.Printf("  \033[1m%-16s %-16s %-14s %9s %10s %10s\033[0m\n",
		"Username", "Framed-IP", "NAS", "Time", "Download", "Upload")
	fmt.Println("  ---------------- ---------------- -------------- --------- ---------- ----------")

	printed := 0
	for _, sess := range s.sessions {
		if printed >= 20 {
			fmt.Printf("  ... and %d more\n", active-printed)
			break
		}
		fmt.Printf("  \033[32m*\033[0m %-14s %-16s %-14s %9s %10s %10s\n",
			sess.Username, sess.FramedIP, sess.BNG.Name,
			fmtDuration(time.Duration(sess.AcctTime)*time.Second),
			fmtBytes(sess.TotalDL), fmtBytes(sess.TotalUL))
		printed++
	}
	if active == 0 {
		fmt.Println("  (waiting for subscribers...)")
	}

	fmt.Println("\033[1;36m+-------------------------------------------------------------------------+\033[0m")
	fmt.Print("  NAS: ")
	for i := range bngs {
		count := 0
		for _, sess := range s.sessions {
			if sess.BNG.Name == bngs[i].Name {
				count++
			}
		}
		fmt.Printf("%s=%d  ", bngs[i].Name, count)
	}
	fmt.Println()
	fmt.Println("\033[1;36m+=========================================================================+\033[0m")
	fmt.Println("  \033[2mCtrl+C to stop\033[0m")
}

func (s *Simulator) shutdown() {
	fmt.Println("\n\033[33mShutting down - sending Stop for all sessions...\033[0m")
	s.mu.Lock()
	toStop := make([]*Session, 0, len(s.sessions))
	for _, sess := range s.sessions {
		toStop = append(toStop, sess)
	}
	s.mu.Unlock()

	var wg sync.WaitGroup
	for _, sess := range toStop {
		wg.Add(1)
		go func(ss *Session) {
			defer wg.Done()
			s.doDisconnect(ss)
		}(sess)
	}
	wg.Wait()

	fmt.Println()
	fmt.Println("=======================================")
	fmt.Println("  Nokia BNG Simulator - Final Report")
	fmt.Println("=======================================")
	fmt.Printf("  Runtime:   %s\n", fmtDuration(time.Since(s.startTime)))
	fmt.Printf("  Cycles:    %d\n", atomic.LoadInt64(&s.stats.Cycles))
	fmt.Printf("  Starts:    %d\n", atomic.LoadInt64(&s.stats.Starts))
	fmt.Printf("  Interims:  %d\n", atomic.LoadInt64(&s.stats.Interims))
	fmt.Printf("  Stops:     %d\n", atomic.LoadInt64(&s.stats.Stops))
	fmt.Printf("  Errors:    %d\n", atomic.LoadInt64(&s.stats.Errors))
	fmt.Printf("  Total DL:  %s\n", fmtBytes(atomic.LoadInt64(&s.stats.TotalDL)))
	fmt.Printf("  Total UL:  %s\n", fmtBytes(atomic.LoadInt64(&s.stats.TotalUL)))
	fmt.Println("=======================================")
}

func (s *Simulator) logEvent(level, msg string) {
	if s.headless {
		fmt.Printf("[%s] [%s] %s\n", time.Now().Format("15:04:05"), level, msg)
	}
}

func fmtBytes(b int64) string {
	switch {
	case b >= 1<<30:
		return fmt.Sprintf("%.1f GB", float64(b)/float64(1<<30))
	case b >= 1<<20:
		return fmt.Sprintf("%.1f MB", float64(b)/float64(1<<20))
	case b >= 1<<10:
		return fmt.Sprintf("%.1f KB", float64(b)/float64(1<<10))
	default:
		return fmt.Sprintf("%d B", b)
	}
}

func fmtDuration(d time.Duration) string {
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	sec := int(d.Seconds()) % 60
	return fmt.Sprintf("%02d:%02d:%02d", h, m, sec)
}

func main() {
	fmt.Println("\033[1;36mNokia 7750 SR BNG Simulator - Go Edition\033[0m")
	fmt.Println()

	for _, arg := range os.Args[1:] {
		switch strings.ToLower(arg) {
		case "--fast":
			os.Setenv("CYCLE_INTERVAL", "1")
			os.Setenv("INTERIM_INTERVAL", "30")
			os.Setenv("MAX_SUBSCRIBERS", "50")
			os.Setenv("CONNECT_CHANCE", "30")
			os.Setenv("DISCONNECT_CHANCE", "2")
		case "--gentle":
			os.Setenv("CYCLE_INTERVAL", "10")
			os.Setenv("INTERIM_INTERVAL", "300")
			os.Setenv("MAX_SUBSCRIBERS", "10")
			os.Setenv("CONNECT_CHANCE", "10")
			os.Setenv("DISCONNECT_CHANCE", "2")
		case "--headless":
			os.Setenv("HEADLESS", "true")
		case "--help":
			fmt.Println("Usage: nokia-bng-simulator [--fast|--gentle] [--headless]")
			fmt.Println("  --fast      1s cycle, 30s interim, 50 subs")
			fmt.Println("  --gentle    10s cycle, 300s interim, 10 subs")
			fmt.Println("  --headless  Log-only, no TUI")
			fmt.Println()
			fmt.Println("Env: RADIUS_HOST, RADIUS_SECRET, PG_CONN, MAX_SUBSCRIBERS,")
			fmt.Println("     CYCLE_INTERVAL, INTERIM_INTERVAL, CONNECT_CHANCE")
			os.Exit(0)
		}
	}

	sim := NewSimulator()
	sim.startTime = time.Now()

	fmt.Printf("  Auth:    %s\n", sim.radiusAuthAddr)
	fmt.Printf("  Acct:    %s\n", sim.radiusAcctAddr)
	fmt.Printf("  Cycle:   %s  Interim: %ds  Max: %d\n", sim.cycleInterval, sim.interimSecs, sim.maxSubs)
	fmt.Println()

	if err := sim.loadSubscribers(); err != nil {
		fmt.Printf("DB error: %v - using generated subs\n", err)
		for i := 1; i <= sim.maxSubs; i++ {
			sim.subscribers = append(sim.subscribers, Subscriber{
				Username: fmt.Sprintf("sim_user_%03d", i),
				Password: "simpass",
			})
		}
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	fmt.Println("\nSimulator running...")

	ticker := time.NewTicker(sim.cycleInterval)
	defer ticker.Stop()

	for {
		select {
		case <-sigCh:
			ticker.Stop()
			sim.shutdown()
			return
		case <-ticker.C:
			sim.runCycle()
			if !sim.headless {
				sim.drawDashboard()
			}
		}
	}
}
