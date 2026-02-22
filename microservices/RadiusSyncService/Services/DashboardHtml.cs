namespace RadiusSyncService.Services;

/// <summary>
/// Provides the embedded dashboard HTML as a static resource.
/// Enterprise dark theme with real-time auto-refresh, authentication,
/// and comprehensive system monitoring.
/// </summary>
public static class DashboardHtml
{
    public static string GetLoginPage(string? error = null) => $@"<!DOCTYPE html>
<html lang=""en"">
<head>
<meta charset=""UTF-8"">
<meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
<title>OpenRadius Edge — Login</title>
<style>
{CommonStyles}
.login-wrapper {{ display: flex; align-items: center; justify-content: center; min-height: 100vh; }}
.login-card {{ background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 40px; width: 100%; max-width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }}
.login-card h1 {{ text-align: center; margin-bottom: 8px; font-size: 22px; color: var(--text); }}
.login-card .subtitle {{ text-align: center; color: var(--muted); font-size: 13px; margin-bottom: 32px; }}
.login-card .logo {{ text-align: center; margin-bottom: 24px; font-size: 32px; }}
.form-group {{ margin-bottom: 20px; }}
.form-group label {{ display: block; font-size: 13px; font-weight: 500; color: var(--muted); margin-bottom: 6px; }}
.form-group input {{ width: 100%; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 14px; outline: none; box-sizing: border-box; }}
.form-group input:focus {{ border-color: var(--accent); box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }}
.btn-login {{ width: 100%; padding: 12px; background: var(--accent); color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; }}
.btn-login:hover {{ background: #2563eb; }}
.error-msg {{ background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #f87171; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 20px; text-align: center; {(string.IsNullOrEmpty(error) ? "display:none;" : "")} }}
</style>
</head>
<body>
<div class=""login-wrapper"">
  <div class=""login-card"">
    <div class=""logo"">🔐</div>
    <h1>OpenRadius Edge</h1>
    <p class=""subtitle"">RadiusSyncService Dashboard</p>
    <div class=""error-msg"">{error ?? ""}</div>
    <form method=""POST"" action=""/dashboard/login"">
      <div class=""form-group"">
        <label for=""username"">Username</label>
        <input type=""text"" id=""username"" name=""username"" autocomplete=""username"" required autofocus>
      </div>
      <div class=""form-group"">
        <label for=""password"">Password</label>
        <input type=""password"" id=""password"" name=""password"" autocomplete=""current-password"" required>
      </div>
      <button type=""submit"" class=""btn-login"">Sign In</button>
    </form>
  </div>
</div>
</body>
</html>";

    public static string GetDashboardPage() => $@"<!DOCTYPE html>
<html lang=""en"">
<head>
<meta charset=""UTF-8"">
<meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
<title>OpenRadius Edge — Dashboard</title>
<style>
{CommonStyles}
{DashboardStyles}
</style>
</head>
<body>
<div class=""layout"">
  <!-- Sidebar -->
  <aside class=""sidebar"">
    <div class=""sidebar-header"">
      <div class=""brand"">
        <span class=""brand-icon"">◉</span>
        <div>
          <div class=""brand-name"">OpenRadius</div>
          <div class=""brand-sub"">Edge Runtime</div>
        </div>
      </div>
    </div>
    <nav class=""sidebar-nav"">
      <a href=""#"" class=""nav-item active"" data-section=""overview"">
        <span class=""nav-icon"">📊</span> Overview
      </a>
      <a href=""#"" class=""nav-item"" data-section=""containers"">
        <span class=""nav-icon"">🐳</span> Containers
      </a>
      <a href=""#"" class=""nav-item"" data-section=""images"">
        <span class=""nav-icon"">📦</span> Images
      </a>
      <a href=""#"" class=""nav-item"" data-section=""network"">
        <span class=""nav-icon"">🌐</span> Networks & Volumes
      </a>
      <a href=""#"" class=""nav-item"" data-section=""connector"">
        <span class=""nav-icon"">⚡</span> Connector
      </a>
      <a href=""#"" class=""nav-item"" data-section=""signalr"">
        <span class=""nav-icon"">📡</span> SignalR Connection
      </a>
      <a href=""#"" class=""nav-item"" data-section=""logs"">
        <span class=""nav-icon"">📋</span> Activity Log
      </a>
    </nav>
    <div class=""sidebar-footer"">
      <div class=""connection-badge"" id=""connBadge"">
        <span class=""dot dot-gray""></span>
        <span>Loading...</span>
      </div>
      <a href=""/dashboard/logout"" class=""nav-item logout-btn"">
        <span class=""nav-icon"">🚪</span> Sign Out
      </a>
    </div>
  </aside>

  <!-- Main Content -->
  <main class=""main"">
    <header class=""topbar"">
      <h1 id=""pageTitle"">Overview</h1>
      <div class=""topbar-actions"">
        <span class=""refresh-text"" id=""lastRefresh"">--</span>
        <button class=""btn btn-sm"" onclick=""refreshAll()"" title=""Refresh now"">↻ Refresh</button>
      </div>
    </header>

    <div class=""content"">
      <!-- ===== OVERVIEW SECTION ===== -->
      <section id=""sec-overview"" class=""section active"">
        <!-- KPI Cards -->
        <div class=""kpi-grid"">
          <div class=""kpi-card"">
            <div class=""kpi-label"">Uptime</div>
            <div class=""kpi-value"" id=""kpiUptime"">--</div>
          </div>
          <div class=""kpi-card"">
            <div class=""kpi-label"">SignalR</div>
            <div class=""kpi-value"" id=""kpiSignalR""><span class=""dot dot-gray""></span> --</div>
          </div>
          <div class=""kpi-card"">
            <div class=""kpi-label"">Containers</div>
            <div class=""kpi-value"" id=""kpiContainers"">--</div>
          </div>
          <div class=""kpi-card"">
            <div class=""kpi-label"">CPU Usage</div>
            <div class=""kpi-value"" id=""kpiCpu"">--%</div>
          </div>
          <div class=""kpi-card"">
            <div class=""kpi-label"">Memory</div>
            <div class=""kpi-value"" id=""kpiMemory"">--</div>
          </div>
          <div class=""kpi-card"">
            <div class=""kpi-label"">Images</div>
            <div class=""kpi-value"" id=""kpiImages"">--</div>
          </div>
        </div>

        <!-- Service Info -->
        <div class=""grid-2"">
          <div class=""card"">
            <div class=""card-header"">Service Identity</div>
            <div class=""card-body"">
              <table class=""info-table"">
                <tr><td class=""label"">Machine ID</td><td id=""infoMachineId"" class=""mono"">--</td></tr>
                <tr><td class=""label"">Machine Name</td><td id=""infoMachineName"">--</td></tr>
                <tr><td class=""label"">Platform</td><td id=""infoPlatform"">--</td></tr>
                <tr><td class=""label"">Version</td><td id=""infoVersion"">--</td></tr>
                <tr><td class=""label"">.NET Runtime</td><td id=""infoDotnet"">--</td></tr>
                <tr><td class=""label"">Process ID</td><td id=""infoProcessId"">--</td></tr>
                <tr><td class=""label"">Started At</td><td id=""infoStartedAt"">--</td></tr>
              </table>
            </div>
          </div>
          <div class=""card"">
            <div class=""card-header"">Docker Engine</div>
            <div class=""card-body"">
              <table class=""info-table"">
                <tr><td class=""label"">Docker Version</td><td id=""dockerVersion"">--</td></tr>
                <tr><td class=""label"">Server Version</td><td id=""dockerServerVersion"">--</td></tr>
                <tr><td class=""label"">OS / Arch</td><td id=""dockerOsArch"">--</td></tr>
                <tr><td class=""label"">Total Containers</td><td id=""dockerTotalContainers"">--</td></tr>
                <tr><td class=""label"">Running</td><td id=""dockerRunning"" class=""text-green"">--</td></tr>
                <tr><td class=""label"">Stopped</td><td id=""dockerStopped"" class=""text-muted"">--</td></tr>
                <tr><td class=""label"">Total CPUs</td><td id=""dockerCpus"">--</td></tr>
                <tr><td class=""label"">Total Memory</td><td id=""dockerMemTotal"">--</td></tr>
              </table>
            </div>
          </div>
        </div>

        <!-- Resource Gauges -->
        <div class=""card"">
          <div class=""card-header"">Resource Usage</div>
          <div class=""card-body"">
            <div class=""gauge-row"">
              <div class=""gauge-item"">
                <svg viewBox=""0 0 120 120"" class=""gauge-svg"">
                  <circle cx=""60"" cy=""60"" r=""50"" class=""gauge-bg""/>
                  <circle cx=""60"" cy=""60"" r=""50"" class=""gauge-fill"" id=""gaugeCpuRing"" style=""stroke-dashoffset:314""/>
                  <text x=""60"" y=""56"" class=""gauge-val"" id=""gaugeCpuVal"">0%</text>
                  <text x=""60"" y=""72"" class=""gauge-label"">CPU</text>
                </svg>
              </div>
              <div class=""gauge-item"">
                <svg viewBox=""0 0 120 120"" class=""gauge-svg"">
                  <circle cx=""60"" cy=""60"" r=""50"" class=""gauge-bg""/>
                  <circle cx=""60"" cy=""60"" r=""50"" class=""gauge-fill"" id=""gaugeMemRing"" style=""stroke-dashoffset:314""/>
                  <text x=""60"" y=""56"" class=""gauge-val"" id=""gaugeMemVal"">0%</text>
                  <text x=""60"" y=""72"" class=""gauge-label"">Memory</text>
                </svg>
              </div>
              <div class=""gauge-item"">
                <svg viewBox=""0 0 120 120"" class=""gauge-svg"">
                  <circle cx=""60"" cy=""60"" r=""50"" class=""gauge-bg""/>
                  <circle cx=""60"" cy=""60"" r=""50"" class=""gauge-fill"" id=""gaugeContRing"" style=""stroke-dashoffset:314""/>
                  <text x=""60"" y=""56"" class=""gauge-val"" id=""gaugeContVal"">0</text>
                  <text x=""60"" y=""72"" class=""gauge-label"">Containers</text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== CONTAINERS SECTION ===== -->
      <section id=""sec-containers"" class=""section"">
        <div class=""section-toolbar"">
          <h2>Docker Containers</h2>
          <div>
            <button class=""btn btn-sm"" onclick=""refreshDocker()"">↻ Refresh</button>
          </div>
        </div>
        <div class=""card"">
          <div class=""card-body p-0"">
            <table class=""data-table"">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Image</th>
                  <th>State</th>
                  <th>Status</th>
                  <th>CPU</th>
                  <th>Memory</th>
                  <th style=""width:140px"">Actions</th>
                </tr>
              </thead>
              <tbody id=""containersBody"">
                <tr><td colspan=""7"" class=""text-center text-muted"">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ===== IMAGES SECTION ===== -->
      <section id=""sec-images"" class=""section"">
        <div class=""section-toolbar"">
          <h2>Docker Images</h2>
          <button class=""btn btn-sm"" onclick=""refreshDocker()"">↻ Refresh</button>
        </div>
        <div class=""card"">
          <div class=""card-body p-0"">
            <table class=""data-table"">
              <thead>
                <tr><th>Repository</th><th>Tag</th><th>Size</th><th>Created</th></tr>
              </thead>
              <tbody id=""imagesBody"">
                <tr><td colspan=""4"" class=""text-center text-muted"">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ===== NETWORKS & VOLUMES SECTION ===== -->
      <section id=""sec-network"" class=""section"">
        <div class=""grid-2"">
          <div>
            <div class=""section-toolbar""><h2>Networks</h2></div>
            <div class=""card"">
              <div class=""card-body p-0"">
                <table class=""data-table"">
                  <thead><tr><th>Name</th><th>Driver</th><th>Scope</th></tr></thead>
                  <tbody id=""networksBody"">
                    <tr><td colspan=""3"" class=""text-center text-muted"">Loading...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div>
            <div class=""section-toolbar""><h2>Volumes</h2></div>
            <div class=""card"">
              <div class=""card-body p-0"">
                <table class=""data-table"">
                  <thead><tr><th>Name</th><th>Driver</th><th>Mountpoint</th></tr></thead>
                  <tbody id=""volumesBody"">
                    <tr><td colspan=""3"" class=""text-center text-muted"">Loading...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== CONNECTOR SECTION ===== -->
      <section id=""sec-connector"" class=""section"">
        <div class=""section-toolbar"">
          <h2>JDBC Sink Connector</h2>
          <div style=""display:flex;gap:8px"">
            <button class=""btn btn-sm"" onclick=""refreshConnector()"">↻ Refresh</button>
            <button class=""btn btn-sm btn-green"" id=""btnDeploy"" onclick=""connectorAction('deploy')"">🚀 Deploy</button>
          </div>
        </div>

        <!-- Connector Status Banner -->
        <div class=""kpi-grid"" style=""margin-bottom:20px"">
          <div class=""kpi-card"">
            <div class=""kpi-label"">Connector State</div>
            <div class=""kpi-value"" id=""kpiConnState""><span class=""dot dot-gray""></span> --</div>
          </div>
          <div class=""kpi-card"">
            <div class=""kpi-label"">Tasks</div>
            <div class=""kpi-value"" id=""kpiConnTasks"">--</div>
          </div>
          <div class=""kpi-card"">
            <div class=""kpi-label"">Topics</div>
            <div class=""kpi-value"" id=""kpiConnTopics"">--</div>
          </div>
          <div class=""kpi-card"">
            <div class=""kpi-label"">Connect API</div>
            <div class=""kpi-value"" id=""kpiConnApi""><span class=""dot dot-gray""></span> --</div>
          </div>
        </div>

        <div class=""grid-2"">
          <!-- Live Status -->
          <div class=""card"">
            <div class=""card-header"">Live Status</div>
            <div class=""card-body"">
              <table class=""info-table"">
                <tr><td class=""label"">Connector Name</td><td id=""connName"" class=""mono"">--</td></tr>
                <tr><td class=""label"">State</td><td id=""connState"">--</td></tr>
                <tr><td class=""label"">Type</td><td id=""connType"">--</td></tr>
                <tr><td class=""label"">Worker ID</td><td id=""connWorker"" class=""mono"">--</td></tr>
                <tr><td class=""label"">Connect URL</td><td id=""connUrl"" class=""mono text-sm"">--</td></tr>
                <tr><td class=""label"">Last Checked</td><td id=""connCheckedAt"">--</td></tr>
              </table>
              <div style=""margin-top:12px;display:flex;gap:8px"">
                <button class=""btn btn-sm btn-yellow"" onclick=""connectorAction('pause')"">⏸ Pause</button>
                <button class=""btn btn-sm btn-green"" onclick=""connectorAction('resume')"">▶ Resume</button>
                <button class=""btn btn-sm btn-red"" onclick=""connectorAction('restart')"">🔄 Restart</button>
              </div>
            </div>
          </div>

          <!-- Connector Config -->
          <div class=""card"">
            <div class=""card-header"">Configuration</div>
            <div class=""card-body"">
              <table class=""info-table"">
                <tr><td class=""label"">Connector Class</td><td id=""connClass"" class=""mono text-sm"">--</td></tr>
                <tr><td class=""label"">Tasks Max</td><td id=""connTasksMax"">--</td></tr>
                <tr><td class=""label"">Connection URL</td><td id=""connDbUrl"" class=""mono text-sm"">--</td></tr>
                <tr><td class=""label"">Insert Mode</td><td id=""connInsertMode"">--</td></tr>
                <tr><td class=""label"">Delete Enabled</td><td id=""connDeleteEnabled"">--</td></tr>
                <tr><td class=""label"">Primary Key</td><td id=""connPkMode"">--</td></tr>
                <tr><td class=""label"">PK Fields</td><td id=""connPkFields"" class=""mono"">--</td></tr>
                <tr><td class=""label"">Auto Create</td><td id=""connAutoCreate"">--</td></tr>
                <tr><td class=""label"">Auto Evolve</td><td id=""connAutoEvolve"">--</td></tr>
                <tr><td class=""label"">Schema Evolution</td><td id=""connSchemaEvo"">--</td></tr>
              </table>
            </div>
          </div>
        </div>

        <!-- Tasks Table -->
        <div class=""card"">
          <div class=""card-header"">Tasks</div>
          <div class=""card-body p-0"">
            <table class=""data-table"">
              <thead>
                <tr><th>Task ID</th><th>State</th><th>Worker ID</th><th>Error Trace</th><th style=""width:100px"">Actions</th></tr>
              </thead>
              <tbody id=""connTasksBody"">
                <tr><td colspan=""5"" class=""text-center text-muted"">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Topics -->
        <div class=""card"">
          <div class=""card-header"">Subscribed Topics</div>
          <div class=""card-body"">
            <div id=""connTopicsList"" class=""topic-list"">
              <span class=""text-muted text-sm"">Loading...</span>
            </div>
          </div>
        </div>

        <!-- Error Handling & Transform -->
        <div class=""grid-2"">
          <div class=""card"">
            <div class=""card-header"">Error Handling</div>
            <div class=""card-body"">
              <table class=""info-table"">
                <tr><td class=""label"">Error Tolerance</td><td id=""connErrTolerance"">--</td></tr>
                <tr><td class=""label"">Log Errors</td><td id=""connErrLog"">--</td></tr>
                <tr><td class=""label"">DLQ Topic</td><td id=""connDlqTopic"" class=""mono text-sm"">--</td></tr>
                <tr><td class=""label"">DLQ Headers</td><td id=""connDlqHeaders"">--</td></tr>
              </table>
            </div>
          </div>
          <div class=""card"">
            <div class=""card-header"">Transform (RegexRouter)</div>
            <div class=""card-body"">
              <table class=""info-table"">
                <tr><td class=""label"">Type</td><td id=""connTransformType"" class=""mono text-sm"">--</td></tr>
                <tr><td class=""label"">Regex</td><td id=""connTransformRegex"" class=""mono"">--</td></tr>
                <tr><td class=""label"">Replacement</td><td id=""connTransformRepl"" class=""mono"">--</td></tr>
              </table>
            </div>
          </div>
        </div>

        <!-- All Connectors on cluster -->
        <div class=""card"">
          <div class=""card-header"">All Connectors on Cluster</div>
          <div class=""card-body"">
            <div id=""allConnectorsList"" class=""text-muted text-sm"">Loading...</div>
          </div>
        </div>

        <!-- Raw Config (collapsible) -->
        <div class=""card"">
          <div class=""card-header"" style=""cursor:pointer;display:flex;justify-content:space-between;align-items:center"" onclick=""toggleRawConfig()"">
            <span>Raw Configuration</span>
            <span id=""rawConfigToggle"" style=""font-size:12px;color:var(--muted)"">▶ Show</span>
          </div>
          <div class=""card-body"" id=""rawConfigBody"" style=""display:none"">
            <pre id=""connRawConfig"" class=""mono text-sm"" style=""white-space:pre-wrap;word-break:break-all;color:var(--muted);max-height:400px;overflow-y:auto"">--</pre>
          </div>
        </div>
      </section>

      <!-- ===== SIGNALR SECTION ===== -->
      <section id=""sec-signalr"" class=""section"">
        <div class=""section-toolbar""><h2>SignalR Connection</h2></div>
        <div class=""grid-2"">
          <div class=""card"">
            <div class=""card-header"">Connection Details</div>
            <div class=""card-body"">
              <table class=""info-table"">
                <tr><td class=""label"">State</td><td id=""srState"">--</td></tr>
                <tr><td class=""label"">Registered</td><td id=""srRegistered"">--</td></tr>
                <tr><td class=""label"">Hub URL</td><td id=""srHubUrl"" class=""mono text-sm"">--</td></tr>
                <tr><td class=""label"">Connected At</td><td id=""srConnectedAt"">--</td></tr>
                <tr><td class=""label"">Last Heartbeat</td><td id=""srLastHeartbeat"">--</td></tr>
              </table>
            </div>
          </div>
          <div class=""card"">
            <div class=""card-header"">Connection History</div>
            <div class=""card-body"">
              <div id=""srHistory"" class=""log-feed"">
                <div class=""text-muted text-sm"">Collecting connection events...</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== ACTIVITY LOG SECTION ===== -->
      <section id=""sec-logs"" class=""section"">
        <div class=""section-toolbar"">
          <h2>Activity Log</h2>
          <button class=""btn btn-sm"" onclick=""clearLogs()"">Clear</button>
        </div>
        <div class=""card"">
          <div class=""card-body"">
            <div id=""activityLog"" class=""log-feed log-feed-tall"">
              <div class=""text-muted text-sm"">Listening for activity...</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</div>

<script>
{DashboardScript}
</script>
</body>
</html>";

    // =========================================================================
    // Common CSS (shared between login & dashboard)
    // =========================================================================
    private const string CommonStyles = @"
:root {
  --bg: #0f1117;
  --card: #161921;
  --border: #23272f;
  --text: #e4e4e7;
  --muted: #71717a;
  --accent: #3b82f6;
  --green: #22c55e;
  --yellow: #eab308;
  --red: #ef4444;
  --orange: #f97316;
  --purple: #a855f7;
  --sidebar-bg: #0c0e14;
  --sidebar-w: 240px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; min-height: 100vh; }
a { color: var(--accent); text-decoration: none; }
";

    // =========================================================================
    // Dashboard-specific CSS
    // =========================================================================
    private const string DashboardStyles = @"
/* Layout */
.layout { display: flex; min-height: 100vh; }
.sidebar { width: var(--sidebar-w); background: var(--sidebar-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; }
.main { margin-left: var(--sidebar-w); flex: 1; display: flex; flex-direction: column; }
.topbar { padding: 16px 28px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: var(--card); position: sticky; top: 0; z-index: 50; }
.topbar h1 { font-size: 18px; font-weight: 600; }
.topbar-actions { display: flex; align-items: center; gap: 12px; }
.refresh-text { font-size: 12px; color: var(--muted); }
.content { padding: 24px 28px; flex: 1; }

/* Sidebar */
.sidebar-header { padding: 20px 16px; border-bottom: 1px solid var(--border); }
.brand { display: flex; align-items: center; gap: 10px; }
.brand-icon { font-size: 28px; color: var(--accent); }
.brand-name { font-weight: 700; font-size: 15px; }
.brand-sub { font-size: 11px; color: var(--muted); }
.sidebar-nav { flex: 1; padding: 12px 8px; display: flex; flex-direction: column; gap: 2px; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; color: var(--muted); font-size: 13px; font-weight: 500; transition: all 0.15s; }
.nav-item:hover { background: rgba(255,255,255,0.04); color: var(--text); }
.nav-item.active { background: rgba(59,130,246,0.1); color: var(--accent); }
.nav-icon { font-size: 16px; width: 20px; text-align: center; }
.sidebar-footer { padding: 12px 8px; border-top: 1px solid var(--border); }
.logout-btn { color: var(--red) !important; margin-top: 4px; }
.logout-btn:hover { background: rgba(239,68,68,0.1) !important; }

/* Connection badge */
.connection-badge { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.03); font-size: 12px; color: var(--muted); }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.dot-green { background: var(--green); box-shadow: 0 0 6px var(--green); }
.dot-yellow { background: var(--yellow); box-shadow: 0 0 6px var(--yellow); }
.dot-red { background: var(--red); box-shadow: 0 0 6px var(--red); }
.dot-gray { background: #52525b; }

/* KPI Cards */
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
.kpi-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 18px 20px; }
.kpi-label { font-size: 12px; color: var(--muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
.kpi-value { font-size: 22px; font-weight: 700; display: flex; align-items: center; gap: 8px; }

/* Cards */
.card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 20px; overflow: hidden; }
.card-header { padding: 14px 20px; border-bottom: 1px solid var(--border); font-size: 14px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
.card-body { padding: 16px 20px; }
.card-body.p-0 { padding: 0; }

/* Grid */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@media (max-width: 1024px) { .grid-2 { grid-template-columns: 1fr; } }

/* Tables */
.info-table { width: 100%; }
.info-table td { padding: 8px 0; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.info-table tr:last-child td { border-bottom: none; }
.info-table .label { color: var(--muted); width: 140px; font-weight: 500; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th { padding: 10px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); font-weight: 600; background: rgba(0,0,0,0.2); border-bottom: 1px solid var(--border); white-space: nowrap; }
.data-table td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.03); vertical-align: middle; }
.data-table tr:hover td { background: rgba(255,255,255,0.02); }

/* Buttons */
.btn { padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); color: var(--text); font-size: 12px; cursor: pointer; font-weight: 500; transition: all 0.15s; display: inline-flex; align-items: center; gap: 4px; }
.btn:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.15); }
.btn-sm { padding: 4px 10px; font-size: 11px; }
.btn-green { border-color: rgba(34,197,94,0.3); color: var(--green); }
.btn-green:hover { background: rgba(34,197,94,0.1); }
.btn-red { border-color: rgba(239,68,68,0.3); color: var(--red); }
.btn-red:hover { background: rgba(239,68,68,0.1); }
.btn-yellow { border-color: rgba(234,179,8,0.3); color: var(--yellow); }
.btn-yellow:hover { background: rgba(234,179,8,0.1); }

/* Sections */
.section { display: none; }
.section.active { display: block; }
.section-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.section-toolbar h2 { font-size: 16px; font-weight: 600; }

/* Topic badges */
.topic-list { display: flex; flex-wrap: wrap; gap: 8px; }
.topic-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 8px; background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); font-size: 12px; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; color: var(--accent); }
.topic-badge .topic-icon { font-size: 14px; }

/* Connector state badges */
.badge-RUNNING, .badge-running { background: rgba(34,197,94,0.12); color: var(--green); }
.badge-PAUSED, .badge-paused { background: rgba(234,179,8,0.12); color: var(--yellow); }
.badge-FAILED, .badge-failed { background: rgba(239,68,68,0.12); color: var(--red); }
.badge-UNASSIGNED, .badge-unassigned { background: rgba(168,85,247,0.12); color: var(--purple); }
.badge-NOT_FOUND { background: rgba(113,113,122,0.12); color: var(--muted); }

/* Gauges */
.gauge-row { display: flex; justify-content: center; gap: 48px; padding: 16px 0; }
.gauge-item { width: 140px; text-align: center; }
.gauge-svg { width: 120px; height: 120px; }
.gauge-bg { fill: none; stroke: var(--border); stroke-width: 8; }
.gauge-fill { fill: none; stroke: var(--accent); stroke-width: 8; stroke-linecap: round; stroke-dasharray: 314; transition: stroke-dashoffset 0.6s ease; transform: rotate(-90deg); transform-origin: center; }
.gauge-val { fill: var(--text); font-size: 20px; font-weight: 700; text-anchor: middle; dominant-baseline: auto; }
.gauge-label { fill: var(--muted); font-size: 11px; text-anchor: middle; text-transform: uppercase; letter-spacing: 0.5px; }

/* Status badge */
.badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
.badge-running { background: rgba(34,197,94,0.12); color: var(--green); }
.badge-exited, .badge-stopped { background: rgba(239,68,68,0.12); color: var(--red); }
.badge-paused { background: rgba(234,179,8,0.12); color: var(--yellow); }
.badge-created, .badge-restarting { background: rgba(59,130,246,0.12); color: var(--accent); }
.badge-connected { background: rgba(34,197,94,0.12); color: var(--green); }
.badge-disconnected { background: rgba(239,68,68,0.12); color: var(--red); }

/* Resource bar */
.res-bar { width: 80px; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; display: inline-block; vertical-align: middle; margin-right: 6px; }
.res-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }

/* Log feed */
.log-feed { max-height: 280px; overflow-y: auto; font-size: 12px; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; }
.log-feed-tall { max-height: 500px; }
.log-entry { padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; gap: 10px; }
.log-entry:last-child { border-bottom: none; }
.log-time { color: var(--muted); white-space: nowrap; flex-shrink: 0; }
.log-msg { word-break: break-word; }
.log-info { color: var(--accent); }
.log-warn { color: var(--yellow); }
.log-error { color: var(--red); }
.log-ok { color: var(--green); }

/* Utility */
.mono { font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; font-size: 12px; }
.text-green { color: var(--green); }
.text-red { color: var(--red); }
.text-yellow { color: var(--yellow); }
.text-muted { color: var(--muted); }
.text-sm { font-size: 12px; }
.text-center { text-align: center; }
.truncate { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; vertical-align: middle; }
";

    // =========================================================================
    // Dashboard JavaScript
    // =========================================================================
    private const string DashboardScript = @"
let state = {
  service: null,
  docker: null,
  signalr: null,
  logs: [],
  srHistory: [],
  refreshInterval: null,
  currentSection: 'overview'
};

// Navigation
document.querySelectorAll('.nav-item[data-section]').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const section = item.dataset.section;
    state.currentSection = section;
    document.querySelectorAll('.nav-item[data-section]').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('sec-' + section).classList.add('active');
    document.getElementById('pageTitle').textContent = item.textContent.trim();
  });
});

// API calls
async function api(path) {
  try {
    const res = await fetch('/api/dashboard/' + path);
    if (res.status === 401) { window.location.href = '/dashboard/login'; return null; }
    return await res.json();
  } catch (e) { console.error('API error:', path, e); return null; }
}

async function apiPost(path, body) {
  try {
    const res = await fetch('/api/dashboard/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 401) { window.location.href = '/dashboard/login'; return null; }
    return await res.json();
  } catch (e) { console.error('API error:', path, e); return null; }
}

// Data refresh
async function refreshAll() {
  await Promise.all([refreshService(), refreshDocker(), refreshSignalR(), refreshConnector()]);
  document.getElementById('lastRefresh').textContent = 'Updated ' + new Date().toLocaleTimeString();
}

async function refreshService() {
  const data = await api('service');
  if (!data) return;
  state.service = data;
  renderServiceInfo(data);
}

async function refreshDocker() {
  const data = await api('docker');
  if (!data) return;
  state.docker = data;
  renderDocker(data);
}

async function refreshSignalR() {
  const data = await api('signalr');
  if (!data) return;
  state.signalr = data;
  renderSignalR(data);
}

// Render: Service Info
function renderServiceInfo(d) {
  setText('infoMachineId', truncateId(d.machineId));
  setText('infoMachineName', d.machineName);
  setText('infoPlatform', d.platform);
  setText('infoVersion', d.version);
  setText('infoDotnet', d.dotnetVersion);
  setText('infoProcessId', d.processId);
  setText('infoStartedAt', formatDate(d.startedAt));
  setText('kpiUptime', formatDuration(d.uptimeSeconds));
}

// Render: Docker
function renderDocker(d) {
  if (!d || !d.dockerRunning) {
    setText('kpiContainers', 'N/A');
    setText('kpiCpu', 'N/A');
    setText('kpiMemory', 'N/A');
    setText('kpiImages', 'N/A');
    return;
  }

  const info = d.dockerInfo || {};
  const running = info.containersRunning || 0;
  const total = info.containers || 0;
  const stopped = info.containersStopped || 0;

  setText('kpiContainers', running + ' / ' + total);
  setText('kpiCpu', d.totalCpuUsage ? d.totalCpuUsage.toFixed(1) + '%' : '0%');
  setText('kpiMemory', d.totalMemoryUsageFormatted || '--');
  setText('kpiImages', (d.images || []).length);

  // Docker engine info
  setText('dockerVersion', d.dockerVersion || '--');
  setText('dockerServerVersion', info.serverVersion || '--');
  setText('dockerOsArch', (info.operatingSystem || '--') + ' / ' + (info.architecture || '--'));
  setText('dockerTotalContainers', total);
  setText('dockerRunning', running);
  setText('dockerStopped', stopped);
  setText('dockerCpus', info.ncpu || '--');
  setText('dockerMemTotal', formatBytes(info.memoryTotal));

  // Gauges
  const cpuPct = Math.min(d.totalCpuUsage || 0, 100);
  const memPct = info.memoryTotal > 0 ? Math.min((d.totalMemoryUsage / info.memoryTotal) * 100, 100) : 0;
  const contPct = total > 0 ? (running / total) * 100 : 0;
  setGauge('gaugeCpuRing', 'gaugeCpuVal', cpuPct, cpuPct.toFixed(1) + '%');
  setGauge('gaugeMemRing', 'gaugeMemVal', memPct, memPct.toFixed(1) + '%');
  setGauge('gaugeContRing', 'gaugeContVal', contPct, running + '/' + total);

  // Containers table
  const allC = d.allContainers || [];
  const runC = d.runningContainers || [];
  const runMap = {};
  runC.forEach(c => { runMap[c.id] = c; });

  if (allC.length === 0) {
    document.getElementById('containersBody').innerHTML = '<tr><td colspan=""7"" class=""text-center text-muted"">No containers found</td></tr>';
  } else {
    document.getElementById('containersBody').innerHTML = allC.map(c => {
      const rc = runMap[c.id] || {};
      const st = (c.state || 'unknown').toLowerCase();
      const badgeClass = 'badge badge-' + st;
      const cpu = rc.cpuUsage != null ? rc.cpuUsage.toFixed(1) + '%' : '--';
      const mem = rc.memoryUsageFormatted || '--';
      const cpuBar = rc.cpuUsage != null ? resBar(rc.cpuUsage, getCpuColor(rc.cpuUsage)) : '--';
      const memBar = rc.memoryLimit > 0 ? resBar((rc.memoryUsage / rc.memoryLimit) * 100, getMemColor((rc.memoryUsage / rc.memoryLimit) * 100)) : '--';
      const name = (c.names || '').split(',')[0].trim();
      const isRunning = st === 'running';
      return `<tr>
        <td><strong>${esc(name)}</strong></td>
        <td class=""mono truncate"" title=""${esc(c.image)}"">${esc(c.image)}</td>
        <td><span class=""${badgeClass}"">${dot(st)} ${esc(c.state)}</span></td>
        <td class=""text-sm"">${esc(c.status)}</td>
        <td>${cpuBar}</td>
        <td>${memBar} <span class=""text-muted text-sm"">${esc(mem)}</span></td>
        <td>
          ${isRunning
            ? `<button class=""btn btn-sm btn-yellow"" onclick=""containerAction('stop','${c.id}')"">Stop</button>
               <button class=""btn btn-sm btn-red"" onclick=""containerAction('restart','${c.id}')"">Restart</button>`
            : `<button class=""btn btn-sm btn-green"" onclick=""containerAction('start','${c.id}')"">Start</button>
               <button class=""btn btn-sm btn-red"" onclick=""containerAction('remove','${c.id}')"">Remove</button>`}
        </td>
      </tr>`;
    }).join('');
  }

  // Images table
  const imgs = d.images || [];
  if (imgs.length === 0) {
    document.getElementById('imagesBody').innerHTML = '<tr><td colspan=""4"" class=""text-center text-muted"">No images found</td></tr>';
  } else {
    document.getElementById('imagesBody').innerHTML = imgs.map(i => `<tr>
      <td class=""mono"">${esc(i.repository)}</td>
      <td>${esc(i.tag)}</td>
      <td>${esc(i.size)}</td>
      <td class=""text-muted"">${esc(i.createdAt || i.createdSince || '--')}</td>
    </tr>`).join('');
  }

  // Networks
  const nets = d.networks || [];
  document.getElementById('networksBody').innerHTML = nets.length === 0
    ? '<tr><td colspan=""3"" class=""text-center text-muted"">No networks</td></tr>'
    : nets.map(n => `<tr><td>${esc(n.name)}</td><td class=""mono"">${esc(n.driver)}</td><td class=""text-muted"">${esc(n.scope)}</td></tr>`).join('');

  // Volumes
  const vols = d.volumes || [];
  document.getElementById('volumesBody').innerHTML = vols.length === 0
    ? '<tr><td colspan=""3"" class=""text-center text-muted"">No volumes</td></tr>'
    : vols.map(v => `<tr><td class=""mono"">${esc(v.name)}</td><td>${esc(v.driver)}</td><td class=""text-muted text-sm truncate"" title=""${esc(v.mountpoint)}"">${esc(v.mountpoint)}</td></tr>`).join('');
}

// Render: SignalR
function renderSignalR(d) {
  const connState = d.connectionState || 'Unknown';
  const isConnected = connState === 'Connected';
  const badgeClass = isConnected ? 'badge badge-connected' : 'badge badge-disconnected';

  setText('srState', '');
  document.getElementById('srState').innerHTML = `<span class=""${badgeClass}"">${dot(isConnected ? 'running' : 'exited')} ${connState}</span>`;
  setText('srRegistered', d.isRegistered ? 'Yes' : 'No');
  setText('srHubUrl', d.hubUrl || '--');
  setText('srConnectedAt', d.connectedAt ? formatDate(d.connectedAt) : '--');
  setText('srLastHeartbeat', d.lastHeartbeat ? formatDate(d.lastHeartbeat) : '--');

  // KPI
  document.getElementById('kpiSignalR').innerHTML = `<span class=""dot ${isConnected ? 'dot-green' : 'dot-red'}""></span> ${connState}`;

  // Connection badge in sidebar
  const badge = document.getElementById('connBadge');
  badge.innerHTML = `<span class=""dot ${isConnected ? 'dot-green' : 'dot-red'}""></span><span>${isConnected ? 'Connected' : connState}</span>`;

  // Add to history
  addSrHistory(connState, d.isRegistered);
}

function addSrHistory(state, registered) {
  const entry = { time: new Date(), state, registered };
  if (window._srHistory && window._srHistory.length > 0) {
    const last = window._srHistory[window._srHistory.length - 1];
    if (last.state === state && last.registered === registered) return;
  }
  if (!window._srHistory) window._srHistory = [];
  window._srHistory.push(entry);
  if (window._srHistory.length > 50) window._srHistory.shift();
  
  const el = document.getElementById('srHistory');
  el.innerHTML = window._srHistory.slice().reverse().map(e => {
    const cls = e.state === 'Connected' ? 'log-ok' : 'log-warn';
    return `<div class=""log-entry""><span class=""log-time"">${e.time.toLocaleTimeString()}</span><span class=""log-msg ${cls}"">${e.state}${e.registered ? ' (registered)' : ''}</span></div>`;
  }).join('');
}

// Container actions
async function containerAction(action, containerId) {
  addLog('info', `Sending ${action} to container ${containerId.substring(0,12)}...`);
  const result = await apiPost('container/' + action, { containerId });
  if (result) {
    addLog(result.success ? 'ok' : 'error', result.message || `${action} completed`);
  }
  setTimeout(refreshDocker, 2000);
}

// Activity log
function addLog(level, message) {
  const el = document.getElementById('activityLog');
  const time = new Date().toLocaleTimeString();
  const cls = 'log-' + level;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class=""log-time"">${time}</span><span class=""log-msg ${cls}"">${esc(message)}</span>`;
  
  // Remove placeholder
  const placeholder = el.querySelector('.text-muted');
  if (placeholder) placeholder.remove();
  
  el.insertBefore(entry, el.firstChild);
  
  // Keep max 200 entries
  while (el.children.length > 200) el.removeChild(el.lastChild);
}

function clearLogs() {
  document.getElementById('activityLog').innerHTML = '<div class=""text-muted text-sm"">Log cleared</div>';
}

// Helpers
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val ?? '--'; }
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function truncateId(id) { return id ? id.substring(0, 16) + '...' : '--'; }
function dot(state) { const s = (state || '').toLowerCase(); const cls = s === 'running' ? 'dot-green' : s === 'paused' ? 'dot-yellow' : s === 'exited' || s === 'stopped' ? 'dot-red' : 'dot-gray'; return `<span class=""dot ${cls}""></span>`; }

function formatDate(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString();
}

function formatDuration(sec) {
  if (sec == null || sec < 0) return '--';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

function formatBytes(b) {
  if (!b || b <= 0) return '--';
  const units = ['B','KB','MB','GB','TB'];
  let i = 0;
  let val = b;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return val.toFixed(1) + ' ' + units[i];
}

function setGauge(ringId, valId, pct, label) {
  const circumference = 314; // 2 * PI * 50
  const offset = circumference - (pct / 100) * circumference;
  const ring = document.getElementById(ringId);
  const val = document.getElementById(valId);
  if (ring) ring.style.strokeDashoffset = offset;
  if (val) val.textContent = label;
  // Change color based on value
  if (ring) {
    if (pct > 80) ring.style.stroke = 'var(--red)';
    else if (pct > 60) ring.style.stroke = 'var(--yellow)';
    else ring.style.stroke = 'var(--accent)';
  }
}

function resBar(pct, color) {
  const p = Math.min(Math.max(pct, 0), 100);
  return `<span class=""res-bar""><span class=""res-bar-fill"" style=""width:${p.toFixed(1)}%;background:${color}""></span></span>${p.toFixed(1)}%`;
}

function getCpuColor(pct) { return pct > 80 ? 'var(--red)' : pct > 50 ? 'var(--yellow)' : 'var(--green)'; }
function getMemColor(pct) { return pct > 85 ? 'var(--red)' : pct > 60 ? 'var(--yellow)' : 'var(--accent)'; }

// Initialize
(async function init() {
  addLog('info', 'Dashboard loaded — connecting to API...');
  await refreshAll();
  addLog('ok', 'Initial data loaded');
  
  // Auto-refresh every 15 seconds
  state.refreshInterval = setInterval(refreshAll, 15000);
})();
";
}
