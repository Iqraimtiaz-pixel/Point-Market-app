import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  Eye,
  Award,
  Zap,
  ArrowRight,
  ChevronRight,
  HelpCircle,
  TrendingUp,
  ShieldAlert,
  Check,
  Activity,
  Layers,
} from "lucide-react";

export function CommunityVerificationScreen({
  onContinue,
  onSkip,
  onBack,
  category = "Electronics",
  estimatedKp = 1250,
}) {
  const [activeTab, setActiveTab] = useState("how_it_works"); // "how_it_works" | "benefits"

  return (
    <div className="pm-ai-container" style={styles.container}>
      {/* ── Top App Header ── */}
      <div style={styles.header}>
        <div style={styles.headerTitleGroup}>
          <ShieldCheck size={22} color="#1E3A8A" />
          <span style={styles.headerTitle}>Community Verification</span>
        </div>
        <div style={styles.stepBadge}>
          <Sparkles size={11} color="#FF3B6B" style={{ marginRight: 4 }} />
          <span>Step 4 of 5</span>
        </div>
      </div>

      <div style={styles.contentScroll}>
        {/* ── 1. Animated Trust Hero Radar Card ── */}
        <div style={styles.heroCard}>
          <div style={styles.radarContainer}>
            <div style={styles.radarRingOuter} />
            <div style={styles.radarRingInner} />
            <div style={styles.radarCoreIcon}>
              <ShieldCheck size={42} color="#FF3B6B" />
            </div>
            <div style={styles.liveBadge}>
              <span style={styles.livePulseDot} />
              <span>LIVE RADAR</span>
            </div>
          </div>

          <h2 style={styles.heroTitle}>Community Verification</h2>
          <p style={styles.heroSubtitle}>
            Our trusted community helps verify your item's authenticity and fair market value.
          </p>

          <div style={styles.statusPill}>
            <Clock size={14} color="#D97706" style={{ marginRight: 6 }} />
            <span>Waiting for Community Review</span>
          </div>
        </div>

        {/* ── 2. Verification Progress Timeline ── */}
        <div style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <Activity size={16} color="#1E3A8A" />
            <span style={styles.sectionTitle}>Verification Sequence</span>
          </div>

          <div style={styles.timelineWrapper}>
            {/* Step 1: AI Completed */}
            <div style={styles.timelineStep}>
              <div style={styles.timelineNodeCompleted}>
                <Check size={14} color="#FFFFFF" />
              </div>
              <div style={styles.timelineContent}>
                <div style={styles.timelineStepTitleDone}>AI Analysis Completed</div>
                <div style={styles.timelineStepDesc}>Item specs & estimated price verified</div>
              </div>
            </div>
            <div style={styles.timelineConnectorDone} />

            {/* Step 2: Community Verification */}
            <div style={styles.timelineStep}>
              <div style={styles.timelineNodeActive}>
                <Clock size={14} color="#FFFFFF" />
              </div>
              <div style={styles.timelineContent}>
                <div style={styles.timelineStepTitleActive}>Community Verification</div>
                <div style={styles.timelineStepDesc}>Peer review by trusted Point Market traders</div>
              </div>
            </div>
            <div style={styles.timelineConnectorPending} />

            {/* Step 3: Ready to Publish */}
            <div style={styles.timelineStep}>
              <div style={styles.timelineNodeUpcoming}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>3</span>
              </div>
              <div style={styles.timelineContent}>
                <div style={styles.timelineStepTitleUpcoming}>Ready to Publish</div>
                <div style={styles.timelineStepDesc}>Instant marketplace index & boost</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Live Community Metrics Grid ── */}
        <div style={styles.metricsGrid}>
          <div style={styles.metricCard}>
            <div style={styles.metricIconWrap}>
              <Users size={18} color="#1E3A8A" />
            </div>
            <div style={styles.metricValue}>1,240+</div>
            <div style={styles.metricLabel}>Verified Members</div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricIconWrap}>
              <Clock size={18} color="#D97706" />
            </div>
            <div style={styles.metricValue}>~15 mins</div>
            <div style={styles.metricLabel}>Est. Review Time</div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricIconWrap}>
              <Award size={18} color="#16A34A" />
            </div>
            <div style={styles.metricValue}>70% → 98%</div>
            <div style={styles.metricLabel}>Trust Score</div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricIconWrap}>
              <Sparkles size={18} color="#FF3B6B" />
            </div>
            <div style={styles.metricValue}>96%</div>
            <div style={styles.metricLabel}>Community Confidence</div>
          </div>
        </div>

        {/* ── 4. Interactive Tabs: "How it Works" vs "Benefits" ── */}
        <div style={styles.tabHeader}>
          <button
            style={activeTab === "how_it_works" ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => setActiveTab("how_it_works")}
          >
            How it Works
          </button>
          <button
            style={activeTab === "benefits" ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => setActiveTab("benefits")}
          >
            Verification Benefits
          </button>
        </div>

        {activeTab === "how_it_works" ? (
          <div style={styles.horizontalCardList}>
            <div style={styles.howCard}>
              <div style={{ ...styles.howIconBox, background: "rgba(30, 58, 138, 0.08)" }}>
                <Users size={20} color="#1E3A8A" />
              </div>
              <div>
                <div style={styles.howTitle}>Real Users Review Your Listing</div>
                <div style={styles.howDesc}>Experienced traders in {category} check your photo clarity and product condition.</div>
              </div>
            </div>

            <div style={styles.howCard}>
              <div style={{ ...styles.howIconBox, background: "rgba(239, 68, 68, 0.08)" }}>
                <ShieldAlert size={20} color="#EF4444" />
              </div>
              <div>
                <div style={styles.howTitle}>Fake Listings Are Filtered</div>
                <div style={styles.howDesc}>Fraudulent or misleading posts get flagged before any user loses Karma Points.</div>
              </div>
            </div>

            <div style={styles.howCard}>
              <div style={{ ...styles.howIconBox, background: "rgba(22, 163, 74, 0.08)" }}>
                <Award size={20} color="#16A34A" />
              </div>
              <div>
                <div style={styles.howTitle}>Receive Verified Badge</div>
                <div style={styles.howDesc}>Authentic listings gain an official blue shield badge on the main feed.</div>
              </div>
            </div>

            <div style={styles.howCard}>
              <div style={{ ...styles.howIconBox, background: "rgba(255, 59, 107, 0.08)" }}>
                <TrendingUp size={20} color="#FF3B6B" />
              </div>
              <div>
                <div style={styles.howTitle}>Fair Market Value Adjustment</div>
                <div style={styles.howDesc}>Community consensus elevates your recommended KP up to +15%.</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={styles.benefitsGridContainer}>
            <div style={styles.benefitCard}>
              <Eye size={18} color="#16A34A" />
              <div style={styles.benefitTextGroup}>
                <span style={styles.benefitTitle}>More Buyer Trust</span>
                <span style={styles.benefitSub}>Buyers initiate offers 3x faster on verified listings.</span>
              </div>
            </div>

            <div style={styles.benefitCard}>
              <Zap size={18} color="#FF3B6B" />
              <div style={styles.benefitTextGroup}>
                <span style={styles.benefitTitle}>Higher Visibility</span>
                <span style={styles.benefitSub}>Boosted position in search filters & local category feeds.</span>
              </div>
            </div>

            <div style={styles.benefitCard}>
              <ShieldCheck size={18} color="#1E3A8A" />
              <div style={styles.benefitTextGroup}>
                <span style={styles.benefitTitle}>Verified Badge</span>
                <span style={styles.benefitSub}>Official Trust Badge displayed next to item title.</span>
              </div>
            </div>

            <div style={styles.benefitCard}>
              <Sparkles size={18} color="#D97706" />
              <div style={styles.benefitTextGroup}>
                <span style={styles.benefitTitle}>Better Karma Points</span>
                <span style={styles.benefitSub}>Unlock full KP range upon successful community approval.</span>
              </div>
            </div>

            <div style={styles.benefitCard}>
              <CheckCircle2 size={18} color="#16A34A" />
              <div style={styles.benefitTextGroup}>
                <span style={styles.benefitTitle}>Faster Selling</span>
                <span style={styles.benefitSub}>Average trade completion time drops under 24 hours.</span>
              </div>
            </div>
          </div>
        )}

        {/* ── 5. Action Buttons & Note ── */}
        <div style={styles.ctaFooterGroup}>
          <button style={styles.primaryBtn} onClick={onContinue}>
            <span>Continue to Publish</span>
            <ArrowRight size={18} />
          </button>

          <button style={styles.secondaryBtn} onClick={onSkip}>
            Skip for Now
          </button>

          <div style={styles.optionalNote}>
            <HelpCircle size={13} color="#64748B" style={{ marginRight: 4 }} />
            <span>Community Verification is optional but highly recommended.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Point Market Original Custom Styling System
────────────────────────────────────────────────────────── */
const styles = {
  container: {
    width: "100%",
    maxWidth: 420,
    height: "100vh",
    margin: "0 auto",
    backgroundColor: "#FFFFFF",
    color: "#1E293B",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
  },
  header: {
    height: 56,
    padding: "0 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #F1F5F9",
    zIndex: 10,
    backgroundColor: "#FFFFFF",
  },
  headerTitleGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "#1E3A8A",
    letterSpacing: 0.3,
  },
  stepBadge: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 20,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 600,
    color: "#1E3A8A",
    display: "flex",
    alignItems: "center",
  },
  contentScroll: {
    flex: 1,
    padding: "16px 20px 24px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  /* Hero Radar Card */
  heroCard: {
    background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
    border: "1px solid #E2E8F0",
    borderRadius: 24,
    padding: "24px 18px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    boxShadow: "0 10px 25px -5px rgba(30, 58, 138, 0.05)",
  },
  radarContainer: {
    position: "relative",
    width: 90,
    height: 90,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  radarRingOuter: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: "50%",
    border: "1.5px dashed rgba(255, 59, 107, 0.3)",
  },
  radarRingInner: {
    position: "absolute",
    width: 68,
    height: 68,
    borderRadius: "50%",
    background: "rgba(255, 59, 107, 0.06)",
    border: "1px solid rgba(255, 59, 107, 0.15)",
  },
  radarCoreIcon: {
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  liveBadge: {
    position: "absolute",
    bottom: -6,
    background: "#1E3A8A",
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 0.6,
    padding: "3px 8px",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    gap: 4,
    zIndex: 3,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#FF3B6B",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#1E3A8A",
    margin: "0 0 6px",
  },
  heroSubtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 1.45,
    margin: "0 0 14px",
    maxWidth: 300,
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    background: "rgba(217, 119, 6, 0.08)",
    border: "1px solid rgba(217, 119, 6, 0.2)",
    borderRadius: 20,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 700,
    color: "#D97706",
  },

  /* Timeline Section */
  sectionCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#1E3A8A",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  timelineWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    paddingLeft: 4,
  },
  timelineStep: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
  },
  timelineNodeCompleted: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#FF3B6B",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    zIndex: 2,
  },
  timelineNodeActive: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#D97706",
    border: "3px solid rgba(217, 119, 6, 0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    zIndex: 2,
  },
  timelineNodeUpcoming: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#F1F5F9",
    border: "1px solid #CBD5E1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    zIndex: 2,
  },
  timelineContent: {
    paddingBottom: 12,
  },
  timelineStepTitleDone: {
    fontSize: 13.5,
    fontWeight: 700,
    color: "#1E293B",
  },
  timelineStepTitleActive: {
    fontSize: 13.5,
    fontWeight: 800,
    color: "#D97706",
  },
  timelineStepTitleUpcoming: {
    fontSize: 13.5,
    fontWeight: 600,
    color: "#94A3B8",
  },
  timelineStepDesc: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
  timelineConnectorDone: {
    width: 2,
    height: 18,
    background: "#FF3B6B",
    marginLeft: 11,
    marginTop: -8,
    marginBottom: 4,
  },
  timelineConnectorPending: {
    width: 2,
    height: 18,
    background: "#E2E8F0",
    marginLeft: 11,
    marginTop: -8,
    marginBottom: 4,
  },

  /* Metrics Grid */
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  metricCard: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 16,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  metricIconWrap: {
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 800,
    color: "#1E3A8A",
  },
  metricLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: 600,
  },

  /* Tabs */
  tabHeader: {
    display: "flex",
    background: "#F1F5F9",
    borderRadius: 12,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    padding: "8px 0",
    border: "none",
    background: "transparent",
    color: "#64748B",
    fontSize: 12.5,
    fontWeight: 600,
    borderRadius: 10,
    cursor: "pointer",
  },
  tabBtnActive: {
    flex: 1,
    padding: "8px 0",
    border: "none",
    background: "#FFFFFF",
    color: "#1E3A8A",
    fontSize: 12.5,
    fontWeight: 800,
    borderRadius: 10,
    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
    cursor: "pointer",
  },

  /* How it works Cards */
  horizontalCardList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  howCard: {
    background: "#FFFFFF",
    border: "1px solid #F1F5F9",
    borderRadius: 16,
    padding: 12,
    display: "flex",
    gap: 12,
    alignItems: "center",
    boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
  },
  howIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  howTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#1E3A8A",
  },
  howDesc: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 1.35,
  },

  /* Benefits Grid */
  benefitsGridContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  benefitCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 14,
    padding: 12,
  },
  benefitTextGroup: {
    display: "flex",
    flexDirection: "column",
  },
  benefitTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#1E3A8A",
  },
  benefitSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },

  /* Footer CTAs */
  ctaFooterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: "auto",
    paddingTop: 8,
  },
  primaryBtn: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    background: "linear-gradient(90deg, #FF3B6B 0%, #FF5C8A 100%)",
    border: "none",
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(255, 59, 107, 0.25)",
  },
  secondaryBtn: {
    width: "100%",
    height: 44,
    borderRadius: 22,
    background: "#FFFFFF",
    border: "1.5px solid #1E3A8A",
    color: "#1E3A8A",
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  optionalNote: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
};
