// ── Extracted from App.jsx: ADMIN_NAV, ADMIN_PASSCODE, AdminAuditLog, AdminBehavior, AdminDashboard, AdminGate, AdminGrowth, AdminListCard, AdminModeration, AdminOverview, AdminPerformance, AdminReports, AdminReviews, AdminStatCard ──
import ADMIN_CSS from "../styles/admin.css?raw";
import AUTH_CSS from "../styles/auth.css?raw";
import React, { useState } from "react";
import {
  User,
  Star,
  ChevronLeft,
  CheckCircle2,
  Wallet,
  Package,
  XCircle,
  ChevronRight,
  TrendingUp,
  Users,
  Handshake,
  Lock,
  Shield,
  AlertTriangle,
  ShieldAlert,
  BadgeCheck,
  UserPlus,
  UserCheck,
  Video,
  Tag,
  BarChart3,
  LineChart,
  Activity,
  Flag,
  Bug,
  Ban,
  Trash2,
  ClipboardList,
  Database,
  Server,
  Zap,
  ThumbsUp,
  ThumbsDown,
  Loader,
  KeyRound,
  LogOut as LogOutIcon
} from "lucide-react";
import { auth } from "../firebase";
import { FieldWrap } from "../components/FieldWrap";
import { MiniBarChart } from "../components/MiniBarChart";
import { MiniLineChart } from "../components/MiniLineChart";
import { useSharedStore } from "../hooks/useSharedStore";
import { buildTrendSeries, computePlatformAnalytics, mostActive } from "../utils/analyticsEngine";
import { FEED, USER_DIRECTORY } from "../utils/mockData";
import { resolveReport, suspendUser, unsuspendUser, removeListing } from "../utils/platformStore";

export const ADMIN_PASSCODE = "PM-ADMIN-2026"; // Change this before deployment — use environment variable in production


export function AdminGate({ onExit }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [authed, setAuthed] = useState(false);
  const [auditLog, setAuditLog] = useState([]);

  const logAction = (action) => {
    setAuditLog((prev) => [{ id: `log-${Date.now()}`, action, at: new Date().toISOString() }, ...prev]);
  };

  const submit = () => {
    if (passcode.trim() === ADMIN_PASSCODE) {
      setError("");
      setAuthed(true);
      logAction("Administrator authenticated");
    } else {
      setError("Incorrect administrator passcode");
    }
  };

  if (authed) {
    return <AdminDashboard onExit={onExit} auditLog={auditLog} logAction={logAction} />;
  }

  return (
    <div className="auth-root">
      <style>{AUTH_CSS}</style>
      <div className="auth-phone">
        <div className="screen-pad" style={{ paddingTop: 60 }}>
          <button type="button" className="back-btn-inline" onClick={onExit} style={{ marginBottom: 18 }}>
            <ChevronLeft size={20} style={{ pointerEvents: "none" }} />
          </button>

          <div className="admin-gate-icon"><KeyRound size={28} /></div>
          <h1 className="screen-h1">Administrator Access</h1>
          <p className="screen-sub">This area is restricted to Point Maker administrators. Enter your administrator passcode to continue.</p>

          <FieldWrap label="Administrator passcode" icon={<Lock size={15} />} error={error}>
            <input
              className="field-input"
              type="password"
              placeholder="Enter passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </FieldWrap>

          <div className="hint-row"><Shield size={13} /><span>All administrator actions are logged for security and audit purposes.</span></div>

          <button className="kt-btn primary" onClick={submit}>Access Dashboard <ChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}


export const ADMIN_NAV = [
  { key: "overview",    label: "Overview",    icon: BarChart3 },
  { key: "growth",      label: "Growth",      icon: LineChart },
  { key: "behavior",    label: "Behavior",    icon: Activity },
  { key: "reviews",     label: "Reviews",     icon: Star },
  { key: "reports",     label: "Reports",     icon: Flag },
  { key: "moderation",  label: "Moderation",  icon: ShieldAlert },
  { key: "performance", label: "Performance", icon: Server },
  { key: "audit",       label: "Audit Log",   icon: ClipboardList },
];


export function AdminDashboard({ onExit, auditLog, logAction }) {
  const store = useSharedStore();
  const [section, setSection] = useState("overview");

  const analytics = computePlatformAnalytics({
    users: USER_DIRECTORY,
    feed: FEED,
    transactions: store.transactions,
    reports: store.reports,
    reviews: store.reviews,
  });

  return (
    <div className="admin-root">
      <style>{ADMIN_CSS}</style>
      <div className="admin-shell">
        {/* ── Sidebar ── */}
        <div className="admin-sidebar">
          <div className="admin-brand">
            <div className="admin-brand-mark"><Shield size={18} /></div>
            <div>
              <div className="admin-brand-title">Point Maker</div>
              <div className="admin-brand-sub">Admin Console</div>
            </div>
          </div>
          <div className="admin-nav">
            {ADMIN_NAV.map(({ key, label, icon: Icon }) => (
              <div key={key} className={`admin-nav-item ${section === key ? "active" : ""}`} onClick={() => setSection(key)}>
                <Icon size={16} /> {label}
              </div>
            ))}
          </div>
          <button className="admin-exit-btn" onClick={() => { logAction("Administrator signed out"); onExit(); }}>
            <LogOutIcon size={15} /> Exit admin console
          </button>
        </div>

        {/* ── Main panel ── */}
        <div className="admin-main">
          {section === "overview"    && <AdminOverview analytics={analytics} />}
          {section === "growth"      && <AdminGrowth analytics={analytics} />}
          {section === "behavior"    && <AdminBehavior />}
          {section === "reviews"     && <AdminReviews analytics={analytics} reviews={store.reviews} />}
          {section === "reports"     && <AdminReports reports={store.reports} onResolve={(id, res) => { resolveReport(id, res); logAction(`Report ${id} marked ${res}`); }} />}
          {section === "moderation"  && <AdminModeration store={store} logAction={logAction} />}
          {section === "performance" && <AdminPerformance />}
          {section === "audit"       && <AdminAuditLog auditLog={auditLog} />}
        </div>
      </div>
    </div>
  );
}


export function AdminStatCard({ icon: Icon, label, value, sub, color = "#2563eb" }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-icon" style={{ background: `${color}14`, color }}><Icon size={17} /></div>
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-label">{label}</div>
      {sub && <div className="admin-stat-sub">{sub}</div>}
    </div>
  );
}


export function AdminOverview({ analytics }) {
  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>Platform Overview</h2>
        <p>Real-time statistics computed from live platform data.</p>
      </div>

      <div className="admin-stat-grid">
        <AdminStatCard icon={Users}        label="Registered Users"  value={analytics.totalUsers}      color="#2563eb" />
        <AdminStatCard icon={Activity}     label="Daily Active (DAU)" value={analytics.dau}            color="#16a34a" />
        <AdminStatCard icon={TrendingUp}   label="Weekly Active (WAU)" value={analytics.wau}           color="#16a34a" />
        <AdminStatCard icon={BarChart3}    label="Monthly Active (MAU)" value={analytics.mau}          color="#16a34a" />
        <AdminStatCard icon={UserPlus}     label="New Registrations" value={analytics.newRegistrations} sub="this week" color="#7c3aed" />
        <AdminStatCard icon={Package}      label="Products Uploaded" value={analytics.products}        color="#ea580c" />
        <AdminStatCard icon={Tag}          label="Services Uploaded" value={analytics.services}        color="#ea580c" />
        <AdminStatCard icon={Video}        label="Videos Uploaded"   value={analytics.videos}          color="#ea580c" />
        <AdminStatCard icon={Handshake}    label="Trades Completed"  value={analytics.totalTrades}     color="#D6001C" />
        <AdminStatCard icon={Wallet}       label="PM Points Circulating" value={analytics.pointsCirculating.toLocaleString()} color="#0f172a" />
        <AdminStatCard icon={BadgeCheck}   label="Verified Users"    value={analytics.totalVerified}   color="#16a34a" />
        <AdminStatCard icon={UserCheck}    label="Total Follows"     value={analytics.totalFollowers}  sub={`${analytics.totalFollowing} following actions`} color="#2563eb" />
      </div>
    </div>
  );
}


export function AdminGrowth({ analytics }) {
  const daily   = buildTrendSeries(analytics.totalUsers, 14, "growth-daily");
  const weekly  = buildTrendSeries(analytics.totalUsers, 8,  "growth-weekly");
  const monthly = buildTrendSeries(analytics.totalUsers, 6,  "growth-monthly");
  const retention = buildTrendSeries(Math.round(analytics.dau * 0.8), 10, "retention");
  const engagement = [analytics.dau, analytics.wau, analytics.mau];

  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>Growth Monitoring</h2>
        <p>Trend lines are computed from real current totals, projected backward for visualization.</p>
      </div>

      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Daily User Growth</span><b>{analytics.totalUsers} total</b></div>
        <MiniLineChart data={daily} color="#2563eb" />
      </div>
      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Weekly User Growth</span><b>{analytics.totalUsers} total</b></div>
        <MiniLineChart data={weekly} color="#16a34a" />
      </div>
      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Monthly User Growth</span><b>{analytics.totalUsers} total</b></div>
        <MiniLineChart data={monthly} color="#7c3aed" />
      </div>
      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>User Retention (last 10 sessions)</span></div>
        <MiniLineChart data={retention} color="#ea580c" />
      </div>
      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Engagement Trend — DAU / WAU / MAU</span></div>
        <MiniBarChart data={engagement} labels={["DAU", "WAU", "MAU"]} color="#D6001C" height={90} />
      </div>
      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Referral Growth</span></div>
        <div className="admin-disconnected"><Database size={15} /> Not connected — requires a referral tracking backend</div>
      </div>
    </div>
  );
}


export function AdminBehavior() {
  const topByKarma     = mostActive(USER_DIRECTORY, "karmaScore", 5);
  const topByFollowers = mostActive(USER_DIRECTORY, "followers", 5);
  const topByTrades    = mostActive(USER_DIRECTORY, "trades", 5);
  const topListings    = mostActive(FEED, "likes", 5);
  const categories = Object.entries(
    FEED.reduce((acc, f) => { acc[f.contentType || "other"] = (acc[f.contentType || "other"] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>User Behavior Analytics</h2>
        <p>Rankings derived from live user and listing data.</p>
      </div>

      <AdminListCard title="Most Active Users (by trades)" rows={topByTrades.map((u) => ({ left: `${u.avatar} ${u.name}`, right: `${u.trades} trades` }))} />
      <AdminListCard title="Most Followed Profiles" rows={topByFollowers.map((u) => ({ left: `${u.avatar} ${u.name}`, right: `${u.followers.toLocaleString()} followers` }))} />
      <AdminListCard title="Most Popular Profiles (by Karma Score)" rows={topByKarma.map((u) => ({ left: `${u.avatar} ${u.name}`, right: `⭐ ${u.karmaScore}` }))} />
      <AdminListCard title="Most Viewed Listings (by likes)" rows={topListings.map((f) => ({ left: f.title, right: `${f.likes} likes` }))} />
      <AdminListCard title="Most Traded Categories" rows={categories.map(([k, v]) => ({ left: k.charAt(0).toUpperCase() + k.slice(1) + "s", right: `${v} listings` }))} />
      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Most Searched Keywords</span></div>
        <div className="admin-disconnected"><Database size={15} /> Not connected — requires server-side search query logging</div>
      </div>
    </div>
  );
}


export function AdminListCard({ title, rows }) {
  return (
    <div className="admin-chart-card">
      <div className="admin-chart-head"><span>{title}</span></div>
      <div className="admin-list">
        {rows.map((r, i) => (
          <div key={i} className="admin-list-row">
            <span className="admin-list-rank">{i + 1}</span>
            <span className="admin-list-left">{r.left}</span>
            <span className="admin-list-right">{r.right}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


export function AdminReviews({ analytics, reviews }) {
  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>Ratings &amp; Reviews</h2>
        <p>Platform-wide feedback submitted by real users in this session.</p>
      </div>

      <div className="admin-stat-grid">
        <AdminStatCard icon={Star}       label="Average Rating"   value={analytics.avgRating.toFixed(1)} sub="out of 5.0" color="#eab308" />
        <AdminStatCard icon={ClipboardList} label="Total Ratings" value={analytics.totalRatings}    color="#2563eb" />
        <AdminStatCard icon={ThumbsUp}   label="Positive Reviews" value={analytics.positiveReviews} sub="4★ and above" color="#16a34a" />
        <AdminStatCard icon={ThumbsDown} label="Negative Reviews" value={analytics.negativeReviews} sub="2★ and below" color="#dc2626" />
      </div>

      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Recent Reviews</span></div>
        {reviews.length === 0 ? (
          <div className="admin-empty">No reviews submitted yet.</div>
        ) : (
          <div className="admin-list">
            {reviews.slice(0, 12).map((r) => (
              <div key={r.id} className="admin-review-row">
                <div className="avatar-sm">{r.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 12.5 }}>{r.reviewer}</span>
                    <span style={{ fontSize: 11, color: "#eab308" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7587", marginTop: 2 }}>{r.text || "(no comment left)"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


export function AdminReports({ reports, onResolve }) {
  const REPORT_LABELS = { bug: "Bug", scam: "Scam", fake: "Fake Listing", suggestion: "Suggestion", feedback: "Feedback" };
  const open = reports.filter((r) => r.status === "open");
  const resolved = reports.filter((r) => r.status !== "open");

  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>Bug Reports &amp; Feedback Center</h2>
        <p>All user-submitted reports appear here in real time.</p>
      </div>

      <div className="admin-stat-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <AdminStatCard icon={Flag}    label="Open Reports"     value={open.length}     color="#dc2626" />
        <AdminStatCard icon={CheckCircle2} label="Resolved Reports" value={resolved.length} color="#16a34a" />
      </div>

      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Open Reports</span></div>
        {open.length === 0 ? (
          <div className="admin-empty">No open reports. Nice and clean 🎉</div>
        ) : (
          <div className="admin-list">
            {open.map((r) => (
              <div key={r.id} className="admin-report-row">
                <span className="admin-report-tag">{REPORT_LABELS[r.type] || r.type}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>{r.subject}</div>
                  <div style={{ fontSize: 11.5, color: "#6b7587", marginTop: 2 }}>{r.details}</div>
                  <div style={{ fontSize: 10.5, color: "#9aa3af", marginTop: 4 }}>From {r.reporter} · {new Date(r.at).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button className="admin-mini-btn resolve" onClick={() => onResolve(r.id, "resolved")}>Resolve</button>
                  <button className="admin-mini-btn dismiss" onClick={() => onResolve(r.id, "dismissed")}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <div className="admin-chart-card">
          <div className="admin-chart-head"><span>Resolved / Dismissed</span></div>
          <div className="admin-list">
            {resolved.map((r) => (
              <div key={r.id} className="admin-list-row">
                <span className={`admin-status-pill ${r.status}`}>{r.status}</span>
                <span className="admin-list-left">{r.subject}</span>
                <span className="admin-list-right">{REPORT_LABELS[r.type]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


export function AdminModeration({ store, logAction }) {
  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>Content Moderation</h2>
        <p>Remove listings, suspend or ban users involved in flagged activity.</p>
      </div>

      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>All Listings</span></div>
        <div className="admin-list">
          {FEED.map((item) => {
            const removed = store.moderatedListingIds.has(item.id);
            return (
              <div key={item.id} className="admin-mod-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, textDecoration: removed ? "line-through" : "none", color: removed ? "#9aa3af" : "inherit" }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: "#6b7587" }}>{item.user} · {item.city} · {item.contentType}</div>
                </div>
                {removed ? (
                  <span className="admin-status-pill dismissed">Removed</span>
                ) : (
                  <button className="admin-mini-btn dismiss" onClick={() => { removeListing(item.id); logAction(`Removed listing "${item.title}"`); }}>
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>User Accounts</span></div>
        <div className="admin-list">
          {USER_DIRECTORY.map((u) => {
            const suspended = store.suspendedUsers.has(u.user);
            return (
              <div key={u.id} className="admin-mod-row">
                <div className="avatar-sm">{u.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>{u.name} <span style={{ color: "#6b7587", fontWeight: 400 }}>{u.user}</span></div>
                  <div style={{ fontSize: 11, color: "#6b7587" }}>{u.trades} trades · ⭐ {u.karmaScore}</div>
                </div>
                {suspended ? (
                  <button className="admin-mini-btn resolve" onClick={() => { unsuspendUser(u.user); logAction(`Reinstated user ${u.user}`); }}>
                    <UserCheck size={12} /> Reinstate
                  </button>
                ) : (
                  <button className="admin-mini-btn dismiss" onClick={() => { suspendUser(u.user); logAction(`Suspended user ${u.user}`); }}>
                    <Ban size={12} /> Suspend
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


export function AdminPerformance() {
  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>Performance Monitoring</h2>
        <p>This prototype has no live server, API, or hosting infrastructure to monitor yet.</p>
      </div>

      {[
        { icon: Server,   label: "App Performance" },
        { icon: Zap,      label: "API Response Times" },
        { icon: Database, label: "Server Health" },
        { icon: Activity, label: "Database Performance" },
        { icon: Bug,      label: "Error Logs" },
        { icon: AlertTriangle, label: "Crash Reports" },
        { icon: XCircle,  label: "Failed Requests" },
      ].map(({ icon: Icon, label }) => (
        <div key={label} className="admin-chart-card">
          <div className="admin-chart-head"><span>{label}</span></div>
          <div className="admin-disconnected"><Icon size={15} /> Not connected — requires a live backend / hosting environment</div>
        </div>
      ))}

      <div className="admin-section-head" style={{ marginTop: 8 }}>
        <h2 style={{ fontSize: 15 }}>Firebase Integration</h2>
        <p>Wire these up once a Firebase project is connected to the backend.</p>
      </div>
      {["Firebase Analytics", "Firebase Crashlytics", "Firebase Performance Monitoring", "Firebase Authentication Tracking", "Push Notification Analytics"].map((label) => (
        <div key={label} className="admin-chart-card">
          <div className="admin-chart-head"><span>{label}</span></div>
          <div className="admin-disconnected"><Loader size={15} /> Not connected — connect a Firebase project to enable</div>
        </div>
      ))}
    </div>
  );
}


export function AdminAuditLog({ auditLog }) {
  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>Administrator Audit Log</h2>
        <p>Every administrative action taken in this session is recorded here.</p>
      </div>
      <div className="admin-chart-card">
        {auditLog.length === 0 ? (
          <div className="admin-empty">No administrative actions yet.</div>
        ) : (
          <div className="admin-list">
            {auditLog.map((log) => (
              <div key={log.id} className="admin-list-row">
                <ClipboardList size={13} style={{ color: "#6b7587", flexShrink: 0 }} />
                <span className="admin-list-left">{log.action}</span>
                <span className="admin-list-right">{new Date(log.at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

