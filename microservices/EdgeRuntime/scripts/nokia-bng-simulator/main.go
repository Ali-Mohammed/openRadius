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

// ---------------------------------------------------------------------------
// Nokia 7750 SR BNG Simulator — High-Performance Go Edition
// ---------------------------------------------------------------------------
// Simulates a real Nokia 7750 SR deployment with:
//   - 6 BNG chassis (core + aggregation + edge)
//   - Burst connect on startup (fills sessions fast)
//   - Parallel RADIUS auth + accounting (goroutine pool)
//   - Multiple connects per cycle
//   - Realistic ISP bandwidth profiles
//   - Nokia-style NAS-Port-Id (slot/mda/port:vlan)
//   - Proper gigaword wrapping for >4 GB sessions
//   - Graceful shutdown with Acct-Stop for all sessions
// ---------------------------------------------------------------------------

// BNG represents a Nokia 7750 SR chassis
type BNG struct {
	Name   string
	IP     net.IP
	MAC    string
	Slots  int // available line cards
	Region string
}

// TrafficProfile defines bandwidth characteristics per interim interval
type TrafficProfile struct {
	Name  string
	DLMin int64 // bytes per 60s base interval (scaled at runtime)
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
	Password   string
	SessionID  string
	BNG        *BNG
	NASPort    uint32
	NASPortID  string // Nokia format: slot/mda/port:vlan
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
	AuthOK   int64
	Rejects  int64
	Starts   int64
	Interims int64
	Stops    int64
	Errors   int64
	Cycles   int64
	TotalDL  int64
	TotalUL  int64
	PktsSent int64
}

// Simulator is the main engine
type Simulator struct {
	radiusAuthAddr string
	radiusAcctAddr string
	radiusSecret   []byte
	pgConnStr      string
	maxSubs        int
	cycleDuration  time.Duration
	interimSecs    int
	connectsPerCyc int
	disconnectPct  int
	burstSize      int
	headless       bool

	subscribers []Subscriber
	sessions    map[string]*Session
	mu          sync.Mutex
	stats       Stats
	startTime   time.Time
	rng         *rand.Rand
}

// Nokia 7750 SR chassis — realistic multi-site deployment
var bngs = []BNG{
	{Name: "BNG-CORE-01", IP: net.ParseIP("10.10.10.1"), MAC: "00:25:BA:C0:01:01", Slots: 10, Region: "dc-central"},
	{Name: "BNG-CORE-02", IP: net.ParseIP("10.10.10.2"), MAC: "00:25:BA:C0:02:01", Slots: 10, Region: "dc-central"},
	{Name: "BNG-AGGR-01", IP: net.ParseIP("10.10.20.1"), MAC: "00:25:BA:A0:01:01", Slots: 6, Region: "pop-north"},
	{Name: "BNG-AGGR-02", IP: net.ParseIP("10.10.20.2"), MAC: "00:25:BA:A0:02:01", Slots: 6, Region: "pop-south"},
	{Name: "BNG-EDGE-01", IP: net.ParseIP("10.10.30.1"), MAC: "00:25:BA:E0:01:01", Slots: 4, Region: "pop-east"},
	{Name: "BNG-EDGE-02", IP: net.ParseIP("10.10.30.2"), MAC: "00:25:BA:E0:02:01", Slots: 4, Region: "pop-west"},
}

// Realistic ISP bandwidth profiles (bytes per 60-second base interval).
// Scaled automatically at runtime to the configured interim interval.
var profiles = []TrafficProfile{
	// 10 Mbps residential — typical browsing
	{Name: "res-10m", DLMin: 5_000_000, DLMax: 75_000_000, ULMin: 500_000, ULMax: 7_500_000},
	// 50 Mbps residential — streaming
	{Name: "res-50m", DLMin: 25_000_000, DLMax: 375_000_000, ULMin: 2_500_000, ULMax: 37_500_000},
	// 100 Mbps premium — heavy use
	{Name: "res-100m", DLMin: 50_000_000, DLMax: 750_000_000, ULMin: 5_000_000, ULMax: 75_000_000},
	// 250 Mbps fiber
	{Name: "fiber-250m", DLMin: 125_000_000, DLMax: 1_875_000_000, ULMin: 12_500_000, ULMax: 187_500_000},
	// 500 Mbps business
	{Name: "biz-500m", DLMin: 250_000_000, DLMax: 3_750_000_000, ULMin: 50_000_000, ULMax: 750_000_000},
	// 1 Gbps enterprise fiber
	{Name: "ent-1g", DLMin: 500_000_000, DLMax: 7_500_000_000, ULMin: 100_000_000, ULMax: 1_500_000_000},
	// IPTV multicast — high DL, minimal UL
	{Name: "iptv", DLMin: 300_000_000, DLMax: 2_000_000_000, ULMin: 1_000_000, ULMax: 10_000_000},
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
	cycleMs := envInt("CYCLE_MS", 500)
	return &Simulator{
		radiusAuthAddr: envOr("RADIUS_HOST", "freeradius") + ":" + envOr("RADIUS_AUTH_PORT", "1812"),
		radiusAcctAddr: envOr("RADIUS_HOST", "freeradius") + ":" + envOr("RADIUS_ACCT_PORT", "1813"),
		radiusSecret:   []byte(envOr("RADIUS_SECRET", "testing123")),
		pgConnStr:      envOr("PG_CONN", "postgres://postgres:changeme_in_production@postgres:5432/edge_db?sslmode=disable"),
		maxSubs:        envInt("MAX_SUBSCRIBERS", 40),
		cycleDuration:  time.Duration(cycleMs) * time.Millisecond,
		interimSecs:    envInt("INTERIM_INTERVAL", 60),
		connectsPerCyc: envInt("CONNECTS_PER_CYCLE", 5),
		disconnectPct:  envInt("DISCONNECT_CHANCE", 5),
		burstSize:      envInt("BURST_SIZE", 20),
		headless:       envOr("HEADLESS", "false") == "true",
		sessions:       make(map[string]*Session),
		rng:            rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// ---------------------------------------------------------------------------
// Data Loading
// ---------------------------------------------------------------------------

func (s *Simulator) loadSubscribers() error {
	fmt.Println("[init] Loading subscribers from PostgreSQL...")
	db, err := sql.Open("postgres", s.pgConnStr)
	if err != nil {
		return fmt.Errorf("pg connect: %w", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := db.QueryContext(ctx,
		`SELECT "Username", "Password" FROM "RadiusUsers"
		 WHERE "Enabled"=true AND "IsDeleted"=false AND "Password" IS NOT NULL
		 ORDER BY random() LIMIT $1`, s.maxSubs)
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
	fmt.Printf("[init] Loaded %d subscribers from CDC pool\n", len(s.subscribers))
	return nil
}

// ---------------------------------------------------------------------------
// ID / Address Generators
// ---------------------------------------------------------------------------

func (s *Simulator) genSessionID() string {
	return fmt.Sprintf("%04X%04X%04X%04X",
		s.rng.Intn(0xFFFF), s.rng.Intn(0xFFFF),
		s.rng.Intn(0xFFFF), s.rng.Intn(0xFFFF))
}

func (s *Simulator) genMAC() string {
	return fmt.Sprintf("%02X:%02X:%02X:%02X:%02X:%02X",
		0x00, 0x0C, s.rng.Intn(256),
		s.rng.Intn(256), s.rng.Intn(256), s.rng.Intn(256))
}

func (s *Simulator) genFramedIP() net.IP {
	if s.rng.Intn(2) == 0 {
		return net.IPv4(10, byte(s.rng.Intn(254)+1), byte(s.rng.Intn(254)+1), byte(s.rng.Intn(254)+1))
	}
	return net.IPv4(100, byte(64+s.rng.Intn(64)), byte(s.rng.Intn(254)+1), byte(s.rng.Intn(254)+1))
}

func (s *Simulator) genNASPortID(bng *BNG) (uint32, string) {
	slot := s.rng.Intn(bng.Slots) + 1
	mda := s.rng.Intn(2) + 1
	port := s.rng.Intn(48) + 1
	vlan := s.rng.Intn(4094) + 1
	subvlan := s.rng.Intn(100) + 1
	portNum := uint32(slot*10000 + mda*1000 + port*10 + vlan%10)
	portID := fmt.Sprintf("%d/%d/%d:%d.%d", slot, mda, port, vlan, subvlan)
	return portNum, portID
}

// ---------------------------------------------------------------------------
// RADIUS Protocol
// ---------------------------------------------------------------------------

func (s *Simulator) sendAuth(username, password string) error {
	pkt := radius.New(radius.CodeAccessRequest, s.radiusSecret)
	rfc2865.UserName_SetString(pkt, username)
	rfc2865.UserPassword_SetString(pkt, password)
	rfc2865.NASIPAddress_Set(pkt, bngs[0].IP)
	rfc2865.ServiceType_Set(pkt, rfc2865.ServiceType_Value_FramedUser)
	rfc2865.FramedProtocol_Set(pkt, rfc2865.FramedProtocol_Value_PPP)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	atomic.AddInt64(&s.stats.PktsSent, 1)
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

	// Scale traffic by actual interim interval ratio (base profiles are for 60s)
	scale := float64(s.interimSecs) / 60.0
	dlRange := int64(float64(sess.Profile.DLMax-sess.Profile.DLMin) * scale)
	ulRange := int64(float64(sess.Profile.ULMax-sess.Profile.ULMin) * scale)
	dlBase := int64(float64(sess.Profile.DLMin) * scale)
	ulBase := int64(float64(sess.Profile.ULMin) * scale)

	if dlRange <= 0 {
		dlRange = 1
	}
	if ulRange <= 0 {
		ulRange = 1
	}

	dlDelta := s.rng.Int63n(dlRange) + dlBase
	ulDelta := s.rng.Int63n(ulRange) + ulBase

	sess.TotalDL += dlDelta
	sess.TotalUL += ulDelta
	sess.AcctTime += uint32(s.interimSecs)

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
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	atomic.AddInt64(&s.stats.PktsSent, 1)
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

// ---------------------------------------------------------------------------
// Session Lifecycle
// ---------------------------------------------------------------------------

func (s *Simulator) doConnect(sub *Subscriber) {
	if err := s.sendAuth(sub.Username, sub.Password); err != nil {
		atomic.AddInt64(&s.stats.Rejects, 1)
		s.logEvent("REJECT", fmt.Sprintf("%-20s %v", sub.Username, err))
		return
	}
	atomic.AddInt64(&s.stats.AuthOK, 1)

	bng := &bngs[s.rng.Intn(len(bngs))]
	prof := &profiles[s.rng.Intn(len(profiles))]
	nasPort, nasPortID := s.genNASPortID(bng)
	sess := &Session{
		Username:  sub.Username,
		Password:  sub.Password,
		SessionID: s.genSessionID(),
		BNG:       bng,
		NASPort:   nasPort,
		NASPortID: nasPortID,
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
	s.logEvent("START", fmt.Sprintf("%-20s sid=%-16s nas=%-14s ip=%-16s port=%-14s prof=%s",
		sub.Username, sess.SessionID, bng.Name, sess.FramedIP, sess.NASPortID, prof.Name))
}

func (s *Simulator) doInterim(sess *Session) {
	if err := s.sendAcctInterim(sess); err != nil {
		s.logEvent("ERROR", fmt.Sprintf("Interim fail: %s - %v", sess.Username, err))
		return
	}

	atomic.AddInt64(&s.stats.Interims, 1)
	atomic.AddInt64(&s.stats.TotalDL, sess.TotalDL)
	atomic.AddInt64(&s.stats.TotalUL, sess.TotalUL)
	s.logEvent("INTERIM", fmt.Sprintf("%-20s t=%5ds dl=%-12s ul=%-12s prof=%s",
		sess.Username, sess.AcctTime, fmtBytes(sess.TotalDL), fmtBytes(sess.TotalUL), sess.Profile.Name))
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
	s.logEvent("STOP", fmt.Sprintf("%-20s cause=%-16s t=%5ds dl=%-12s ul=%s",
		sess.Username, cause, sess.AcctTime, fmtBytes(sess.TotalDL), fmtBytes(sess.TotalUL)))
}

// ---------------------------------------------------------------------------
// Burst Connect — fill sessions rapidly at startup
// ---------------------------------------------------------------------------

func (s *Simulator) burstConnect() {
	target := s.burstSize
	if target > len(s.subscribers) {
		target = len(s.subscribers)
	}
	if target == 0 {
		return
	}

	s.logEvent("BURST", fmt.Sprintf("Connecting %d subscribers in parallel...", target))

	perm := s.rng.Perm(len(s.subscribers))

	var wg sync.WaitGroup
	sem := make(chan struct{}, 10) // concurrency limiter

	connected := int64(0)
	for i := 0; i < target && i < len(perm); i++ {
		sub := &s.subscribers[perm[i]]
		s.mu.Lock()
		_, active := s.sessions[sub.Username]
		s.mu.Unlock()
		if active {
			continue
		}

		wg.Add(1)
		sem <- struct{}{}
		go func(sub *Subscriber) {
			defer wg.Done()
			defer func() { <-sem }()

			s.doConnect(sub)
			s.mu.Lock()
			_, ok := s.sessions[sub.Username]
			s.mu.Unlock()
			if ok {
				atomic.AddInt64(&connected, 1)
			}
		}(sub)
	}
	wg.Wait()

	s.logEvent("BURST", fmt.Sprintf("Burst complete: %d sessions established", atomic.LoadInt64(&connected)))
}

// ---------------------------------------------------------------------------
// Main Cycle
// ---------------------------------------------------------------------------

func (s *Simulator) runCycle() {
	atomic.AddInt64(&s.stats.Cycles, 1)

	s.mu.Lock()
	activeCount := len(s.sessions)
	s.mu.Unlock()

	// Phase 1: New connections (multiple per cycle, in parallel)
	if activeCount < s.maxSubs {
		toConnect := s.connectsPerCyc
		available := s.maxSubs - activeCount
		if toConnect > available {
			toConnect = available
		}

		var wg sync.WaitGroup
		for attempt := 0; attempt < toConnect; attempt++ {
			sub := &s.subscribers[s.rng.Intn(len(s.subscribers))]
			s.mu.Lock()
			_, active := s.sessions[sub.Username]
			s.mu.Unlock()
			if active {
				continue
			}
			wg.Add(1)
			go func(sub *Subscriber) {
				defer wg.Done()
				s.doConnect(sub)
			}(sub)
		}
		wg.Wait()
	}

	// Phase 2: Interim updates (all in parallel)
	s.mu.Lock()
	cycleMs := int(s.cycleDuration.Milliseconds())
	if cycleMs < 1 {
		cycleMs = 1
	}
	interimMs := s.interimSecs * 1000
	cyclesPerInterim := interimMs / cycleMs
	if cyclesPerInterim < 1 {
		cyclesPerInterim = 1
	}

	var interimDue []*Session
	for _, sess := range s.sessions {
		sess.CycleCount++
		if sess.CycleCount%cyclesPerInterim == 0 && sess.CycleCount > 0 {
			interimDue = append(interimDue, sess)
		}
	}
	s.mu.Unlock()

	if len(interimDue) > 0 {
		var wg sync.WaitGroup
		for _, sess := range interimDue {
			wg.Add(1)
			go func(ss *Session) {
				defer wg.Done()
				s.doInterim(ss)
			}(sess)
		}
		wg.Wait()
	}

	// Phase 3: Random disconnections (parallel)
	s.mu.Lock()
	var toDisconnect []*Session
	for _, sess := range s.sessions {
		if sess.AcctTime >= uint32(s.interimSecs) && s.rng.Intn(100) < s.disconnectPct {
			toDisconnect = append(toDisconnect, sess)
		}
	}
	s.mu.Unlock()

	if len(toDisconnect) > 0 {
		var wg sync.WaitGroup
		for _, sess := range toDisconnect {
			wg.Add(1)
			go func(ss *Session) {
				defer wg.Done()
				s.doDisconnect(ss)
			}(sess)
		}
		wg.Wait()
	}
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

func (s *Simulator) drawDashboard() {
	s.mu.Lock()
	defer s.mu.Unlock()

	runtime := time.Since(s.startTime)
	active := len(s.sessions)
	secs := runtime.Seconds()
	if secs < 1 {
		secs = 1
	}
	pps := float64(atomic.LoadInt64(&s.stats.PktsSent)) / secs

	fmt.Print("\033[2J\033[H")
	fmt.Println("\033[1;36m╔═══════════════════════════════════════════════════════════════════════════════════╗\033[0m")
	fmt.Println("\033[1;36m║           Nokia 7750 SR BNG Simulator — EdgeRuntime (Go High-Perf)              ║\033[0m")
	fmt.Println("\033[1;36m╠═══════════════════════════════════════════════════════════════════════════════════╣\033[0m")
	fmt.Printf("  BNG: \033[1m%d\033[0m | Pool: \033[1m%d\033[0m | Cycle: \033[1m%s\033[0m | Interim: \033[1m%ds\033[0m | PPS: \033[1;33m%.1f\033[0m\n",
		len(bngs), len(s.subscribers), s.cycleDuration, s.interimSecs, pps)
	fmt.Printf("  Runtime: \033[1m%s\033[0m | Cycle: \033[1m%d\033[0m | Active: \033[1;32m%d\033[0m\n",
		fmtDuration(runtime), atomic.LoadInt64(&s.stats.Cycles), active)
	fmt.Println("\033[1;36m╠═══════════════════════════════════════════════════════════════════════════════════╣\033[0m")
	fmt.Printf("  \033[32mAuth OK:\033[0m %-5d | \033[35mReject:\033[0m %-5d | \033[32mStart:\033[0m %-5d | \033[33mInterim:\033[0m %-5d | \033[31mStop:\033[0m %-5d | \033[31mErr:\033[0m %d\n",
		atomic.LoadInt64(&s.stats.AuthOK), atomic.LoadInt64(&s.stats.Rejects),
		atomic.LoadInt64(&s.stats.Starts), atomic.LoadInt64(&s.stats.Interims),
		atomic.LoadInt64(&s.stats.Stops), atomic.LoadInt64(&s.stats.Errors))
	fmt.Printf("  Total DL: %-14s | Total UL: %-14s | Pkts: %d\n",
		fmtBytes(atomic.LoadInt64(&s.stats.TotalDL)), fmtBytes(atomic.LoadInt64(&s.stats.TotalUL)),
		atomic.LoadInt64(&s.stats.PktsSent))
	fmt.Println("\033[1;36m╠═══════════════════════════════════════════════════════════════════════════════════╣\033[0m")

	fmt.Printf("  \033[1m%-18s %-16s %-14s %-14s %7s %10s %10s %s\033[0m\n",
		"Username", "Framed-IP", "NAS", "Port-ID", "Time", "Download", "Upload", "Profile")
	fmt.Println("  ────────────────── ──────────────── ────────────── ────────────── ─────── ────────── ────────── ──────────")

	printed := 0
	for _, sess := range s.sessions {
		if printed >= 25 {
			fmt.Printf("  \033[2m... and %d more sessions\033[0m\n", active-printed)
			break
		}
		fmt.Printf("  \033[32m●\033[0m %-16s %-16s %-14s %-14s %7s %10s %10s %s\n",
			truncStr(sess.Username, 16), sess.FramedIP, truncStr(sess.BNG.Name, 14),
			truncStr(sess.NASPortID, 14),
			fmtDuration(time.Duration(sess.AcctTime)*time.Second),
			fmtBytes(sess.TotalDL), fmtBytes(sess.TotalUL), sess.Profile.Name)
		printed++
	}
	if active == 0 {
		fmt.Println("  (waiting for subscribers...)")
	}

	fmt.Println("\033[1;36m╠═══════════════════════════════════════════════════════════════════════════════════╣\033[0m")
	fmt.Print("  NAS Distribution: ")
	for i := range bngs {
		count := 0
		for _, sess := range s.sessions {
			if sess.BNG.Name == bngs[i].Name {
				count++
			}
		}
		if count > 0 {
			fmt.Printf("\033[1m%s\033[0m=%d  ", bngs[i].Name, count)
		}
	}
	fmt.Println()
	fmt.Println("\033[1;36m╚═══════════════════════════════════════════════════════════════════════════════════╝\033[0m")
	fmt.Println("  \033[2mCtrl+C for graceful shutdown (sends Acct-Stop for all)\033[0m")
}

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------

func (s *Simulator) shutdown() {
	fmt.Println("\n\033[33m[shutdown] Sending Acct-Stop for all active sessions...\033[0m")
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

	runtime := time.Since(s.startTime)
	secs := runtime.Seconds()
	if secs < 1 {
		secs = 1
	}

	fmt.Println()
	fmt.Println("╔═══════════════════════════════════════════════╗")
	fmt.Println("║   Nokia BNG Simulator — Final Report          ║")
	fmt.Println("╠═══════════════════════════════════════════════╣")
	fmt.Printf("  Runtime:      %s\n", fmtDuration(runtime))
	fmt.Printf("  Cycles:       %d\n", atomic.LoadInt64(&s.stats.Cycles))
	fmt.Printf("  Auth OK:      %d\n", atomic.LoadInt64(&s.stats.AuthOK))
	fmt.Printf("  Auth Reject:  %d\n", atomic.LoadInt64(&s.stats.Rejects))
	fmt.Printf("  Starts:       %d\n", atomic.LoadInt64(&s.stats.Starts))
	fmt.Printf("  Interims:     %d\n", atomic.LoadInt64(&s.stats.Interims))
	fmt.Printf("  Stops:        %d\n", atomic.LoadInt64(&s.stats.Stops))
	fmt.Printf("  Errors:       %d\n", atomic.LoadInt64(&s.stats.Errors))
	fmt.Printf("  Total DL:     %s\n", fmtBytes(atomic.LoadInt64(&s.stats.TotalDL)))
	fmt.Printf("  Total UL:     %s\n", fmtBytes(atomic.LoadInt64(&s.stats.TotalUL)))
	fmt.Printf("  Packets:      %d (%.1f pps)\n", atomic.LoadInt64(&s.stats.PktsSent), float64(atomic.LoadInt64(&s.stats.PktsSent))/secs)
	fmt.Println("╚═══════════════════════════════════════════════╝")
}

func (s *Simulator) logEvent(level, msg string) {
	if s.headless {
		fmt.Printf("[%s] [%-7s] %s\n", time.Now().Format("15:04:05.000"), level, msg)
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func fmtBytes(b int64) string {
	switch {
	case b >= 1<<40:
		return fmt.Sprintf("%.2f TB", float64(b)/float64(1<<40))
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

func truncStr(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max-1] + "~"
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

func main() {
	fmt.Println("\033[1;36m╔═══════════════════════════════════════════════════════╗\033[0m")
	fmt.Println("\033[1;36m║  Nokia 7750 SR BNG Simulator — High-Performance Go   ║\033[0m")
	fmt.Println("\033[1;36m╚═══════════════════════════════════════════════════════╝\033[0m")
	fmt.Println()

	for _, arg := range os.Args[1:] {
		switch strings.ToLower(arg) {
		case "--turbo":
			os.Setenv("CYCLE_MS", "200")
			os.Setenv("INTERIM_INTERVAL", "30")
			os.Setenv("MAX_SUBSCRIBERS", "40")
			os.Setenv("CONNECTS_PER_CYCLE", "8")
			os.Setenv("BURST_SIZE", "30")
			os.Setenv("DISCONNECT_CHANCE", "3")
		case "--fast":
			os.Setenv("CYCLE_MS", "500")
			os.Setenv("INTERIM_INTERVAL", "60")
			os.Setenv("MAX_SUBSCRIBERS", "40")
			os.Setenv("CONNECTS_PER_CYCLE", "5")
			os.Setenv("BURST_SIZE", "20")
			os.Setenv("DISCONNECT_CHANCE", "4")
		case "--gentle":
			os.Setenv("CYCLE_MS", "5000")
			os.Setenv("INTERIM_INTERVAL", "300")
			os.Setenv("MAX_SUBSCRIBERS", "10")
			os.Setenv("CONNECTS_PER_CYCLE", "1")
			os.Setenv("BURST_SIZE", "5")
			os.Setenv("DISCONNECT_CHANCE", "2")
		case "--headless":
			os.Setenv("HEADLESS", "true")
		case "--help":
			fmt.Println("Usage: nokia-bng-simulator [--turbo|--fast|--gentle] [--headless]")
			fmt.Println()
			fmt.Println("Presets:")
			fmt.Println("  --turbo    200ms cycle, 30s interim, 40 subs, burst 30, 8 conn/cyc")
			fmt.Println("  --fast     500ms cycle, 60s interim, 40 subs, burst 20, 5 conn/cyc")
			fmt.Println("  --gentle   5s cycle, 300s interim, 10 subs, burst 5, 1 conn/cyc")
			fmt.Println("  --headless Log-only mode, no TUI dashboard")
			fmt.Println()
			fmt.Println("Environment variables:")
			fmt.Println("  RADIUS_HOST          FreeRADIUS host     (default: freeradius)")
			fmt.Println("  RADIUS_SECRET        Shared secret       (default: testing123)")
			fmt.Println("  PG_CONN              PostgreSQL DSN")
			fmt.Println("  MAX_SUBSCRIBERS      Subscriber pool     (default: 40)")
			fmt.Println("  CYCLE_MS             Cycle in ms         (default: 500)")
			fmt.Println("  INTERIM_INTERVAL     Interim secs        (default: 60)")
			fmt.Println("  CONNECTS_PER_CYCLE   Connects per cycle  (default: 5)")
			fmt.Println("  BURST_SIZE           Initial burst       (default: 20)")
			fmt.Println("  DISCONNECT_CHANCE    Disconnect % chance (default: 5)")
			fmt.Println("  HEADLESS             true for log mode   (default: false)")
			os.Exit(0)
		}
	}

	sim := NewSimulator()
	sim.startTime = time.Now()

	fmt.Printf("  Auth:        %s\n", sim.radiusAuthAddr)
	fmt.Printf("  Acct:        %s\n", sim.radiusAcctAddr)
	fmt.Printf("  BNG Nodes:   %d\n", len(bngs))
	fmt.Printf("  Cycle:       %s\n", sim.cycleDuration)
	fmt.Printf("  Interim:     %ds\n", sim.interimSecs)
	fmt.Printf("  Max Subs:    %d\n", sim.maxSubs)
	fmt.Printf("  Burst:       %d\n", sim.burstSize)
	fmt.Printf("  Conn/Cycle:  %d\n", sim.connectsPerCyc)
	fmt.Println()

	if err := sim.loadSubscribers(); err != nil {
		fmt.Printf("[warn] DB error: %v — using generated subs\n", err)
		for i := 1; i <= sim.maxSubs; i++ {
			sim.subscribers = append(sim.subscribers, Subscriber{
				Username: fmt.Sprintf("sim_user_%03d", i),
				Password: "simpass",
			})
		}
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Burst connect phase
	sim.burstConnect()

	fmt.Println("\n[run] Simulator running — cycling...")

	ticker := time.NewTicker(sim.cycleDuration)
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
