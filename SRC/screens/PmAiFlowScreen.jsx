import React, { useState } from "react";
import { ChevronLeft, ArrowRight, X, Lightbulb, Sparkles, Target, ShieldCheck, Lock } from "lucide-react";
import { generateCategoryQuestions, QUESTION_TYPES } from "../utils/aiQuestionEngine";

export function PmAiFlowScreen({ category = "", onComplete, onBack }) {
  const [screenStage, setScreenStage] = useState("welcome"); // "welcome" | "conversation"
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentInput, setCurrentInput] = useState("");

  // Dynamically generated questions for any category
  const questions = generateCategoryQuestions(category);
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQuestionIndex];

  /* ── Handlers ── */
  const handleNextQuestion = () => {
    if (!currentInput && currentInput !== false) return;

    const updatedAnswers = {
      ...answers,
      [currentQuestion.key]: currentInput,
    };
    setAnswers(updatedAnswers);
    setCurrentInput("");

    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Completed all questions — pass structured answers object
      if (onComplete) {
        onComplete(updatedAnswers);
      }
    }
  };

  const handleOptionSelect = (optionValue) => {
    setCurrentInput(optionValue);
  };

  /* ── Input Renderer based on Question Type ── */
  const renderInputElement = () => {
    if (!currentQuestion) return null;

    switch (currentQuestion.type) {
      case QUESTION_TYPES.SELECT:
        return (
          <div style={styles.optionsGrid}>
            {currentQuestion.options?.map((opt, i) => (
              <button
                key={i}
                type="button"
                style={{
                  ...styles.optionChip,
                  border: currentInput === opt ? "2px solid #ff4b72" : "1px solid rgba(255,255,255,0.12)",
                  background: currentInput === opt ? "rgba(255, 75, 114, 0.15)" : "rgba(0, 0, 0, 0.25)",
                }}
                onClick={() => handleOptionSelect(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        );

      case QUESTION_TYPES.BOOLEAN:
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {["Yes", "No"].map((label) => {
              const val = label === "Yes";
              return (
                <button
                  key={label}
                  type="button"
                  style={{
                    ...styles.optionChip,
                    height: 44,
                    fontWeight: 700,
                    border: currentInput === val ? "2px solid #ff4b72" : "1px solid rgba(255,255,255,0.12)",
                    background: currentInput === val ? "rgba(255, 75, 114, 0.15)" : "rgba(0, 0, 0, 0.25)",
                  }}
                  onClick={() => handleOptionSelect(val)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        );

      case QUESTION_TYPES.NUMBER:
      case QUESTION_TYPES.CURRENCY:
        return (
          <div style={styles.inputFieldWrap}>
            <input
              type="number"
              style={styles.textInput}
              placeholder={currentQuestion.type === QUESTION_TYPES.CURRENCY ? "e.g. 5000" : "e.g. 2022"}
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNextQuestion()}
              autoFocus
            />
            {currentInput.length > 0 && (
              <button type="button" style={styles.clearBtn} onClick={() => setCurrentInput("")}>
                <X size={14} color="#94a3b8" />
              </button>
            )}
          </div>
        );

      case QUESTION_TYPES.TEXT:
      default:
        return (
          <div style={styles.inputFieldWrap}>
            <input
              type="text"
              style={styles.textInput}
              placeholder="Type your answer..."
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNextQuestion()}
              autoFocus
            />
            {currentInput.length > 0 && (
              <button type="button" style={styles.clearBtn} onClick={() => setCurrentInput("")}>
                <X size={14} color="#94a3b8" />
              </button>
            )}
          </div>
        );
    }
  };

  const isNextDisabled = currentInput === "" || currentInput === null || currentInput === undefined;

  return (
    <div className="pm-ai-container" style={styles.container}>
      {/* ── Top Header Bar ── */}
      <div style={styles.header}>
        <button style={styles.iconBtn} onClick={onBack}>
          <ChevronLeft size={22} color="#ffffff" />
        </button>
        <span style={styles.headerTitle}>PM AI</span>
        <div style={styles.stepBadge}>
          <Sparkles size={11} color="#ff6b8b" style={{ marginRight: 4 }} />
          <span>Step 2 of 5</span>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          SCREEN 1: PM AI Welcome Screen
      ────────────────────────────────────────────────────────── */}
      {screenStage === "welcome" && (
        <div style={styles.contentScroll}>
          {/* Robot Avatar Header */}
          <div style={styles.robotWrap}>
            <div style={styles.robotGlow} />
            <div style={styles.robotAvatar}>
              <span style={{ fontSize: 52 }}>🤖</span>
            </div>
          </div>

          {/* Title & Description */}
          <div style={styles.textGroup}>
            <h1 style={styles.welcomeTitle}>
              Hello! 👋<br />I'm <span style={{ color: "#ff4b72" }}>PM AI</span>
            </h1>
            <p style={styles.welcomeDesc}>
              I'll ask you a few questions about your item to analyze it and estimate its real market value.
            </p>
          </div>

          {/* Feature Cards (Updated text, same exact design) */}
          <div style={styles.cardsList}>
            <div style={styles.featureCard}>
              <div style={{ ...styles.cardIconBox, background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                <Target size={20} />
              </div>
              <div style={styles.cardText}>
                <div style={styles.cardTitle}>AI Valuation</div>
                <div style={styles.cardSub}>AI-powered evaluation</div>
              </div>
            </div>

            <div style={styles.featureCard}>
              <div style={{ ...styles.cardIconBox, background: "rgba(236, 72, 153, 0.15)", color: "#ec4899" }}>
                <ShieldCheck size={20} />
              </div>
              <div style={styles.cardText}>
                <div style={styles.cardTitle}>Community Verified</div>
                <div style={styles.cardSub}>Community verified</div>
              </div>
            </div>

            <div style={styles.featureCard}>
              <div style={{ ...styles.cardIconBox, background: "rgba(168, 85, 247, 0.15)", color: "#a855f7" }}>
                <Lock size={20} />
              </div>
              <div style={styles.cardText}>
                <div style={styles.cardTitle}>Secure Trading</div>
                <div style={styles.cardSub}>Get the best value</div>
              </div>
            </div>
          </div>

          {/* Action Button & Safety Text */}
          <div style={{ marginTop: "auto", paddingBottom: 16 }}>
            <button
              style={styles.primaryBtn}
              onClick={() => setScreenStage("conversation")}
            >
              <span>Let's Start Analysis</span>
              <ArrowRight size={18} />
            </button>
            <div style={styles.safeText}>
              🔒 Your data is safe with us
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          SCREEN 2: PM AI Conversation Screen
      ────────────────────────────────────────────────────────── */}
      {screenStage === "conversation" && (
        <div style={styles.contentScroll}>
          {/* Step Progress Visualizer */}
          <div style={styles.progressNav}>
            <div style={styles.progressStepDone}>✓</div>
            <div style={styles.progressLineDone} />
            <div style={styles.progressStepActive}>2</div>
            <div style={styles.progressLine} />
            <div style={styles.progressStep}>3</div>
            <div style={styles.progressLine} />
            <div style={styles.progressStep}>4</div>
            <div style={styles.progressLine} />
            <div style={styles.progressStep}>5</div>
          </div>
          <div style={styles.progressLabels}>
            <span style={{ opacity: 0.6 }}>Upload</span>
            <span style={{ fontWeight: 700, color: "#ffffff" }}>AI Questions</span>
            <span style={{ opacity: 0.6 }}>AI Value</span>
            <span style={{ opacity: 0.6 }}>Verify</span>
            <span style={{ opacity: 0.6 }}>Publish</span>
          </div>

          {/* AI Message Bubble */}
          <div style={styles.chatRow}>
            <div style={styles.chatAvatar}>🤖</div>
            <div style={styles.chatBubble}>
              <div style={styles.questionText}>{currentQuestion.label}</div>
              <div style={styles.questionHelp}>{currentQuestion.help}</div>
              <div style={styles.chatTime}>9:41 PM</div>
            </div>
          </div>

          {/* Dynamic User Input Card */}
          <div style={styles.inputCard}>
            <label style={styles.inputLabel}>Your Answer</label>

            {renderInputElement()}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button
                style={{
                  ...styles.nextBtn,
                  opacity: !isNextDisabled ? 1 : 0.4,
                  cursor: !isNextDisabled ? "pointer" : "not-allowed",
                }}
                disabled={isNextDisabled}
                onClick={handleNextQuestion}
              >
                <span>Next</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Question Progress Bar */}
          <div style={styles.progressCard}>
            <div style={styles.progressCardHeader}>
              <span>Question Progress</span>
              <span>
                {currentQuestionIndex + 1} of {totalQuestions}
              </span>
            </div>
            <div style={styles.barBg}>
              <div
                style={{
                  ...styles.barFill,
                  width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Explanation Banner */}
          <div style={styles.infoBanner}>
            <div style={styles.infoIcon}>
              <Lightbulb size={18} color="#f43f5e" />
            </div>
            <div>
              <div style={styles.infoTitle}>Why we ask these questions?</div>
              <div style={styles.infoDesc}>
                PM AI uses your answers to analyze your item and suggest the most accurate Karma Points.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Exact Visual Styling
────────────────────────────────────────────────────────── */
const styles = {
  container: {
    width: "100%",
    maxWidth: 420,
    height: "100vh",
    margin: "0 auto",
    backgroundColor: "#0d0a1a",
    color: "#ffffff",
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
    zIndex: 10,
  },
  iconBtn: {
    background: "none",
    border: "none",
    padding: 4,
    cursor: "pointer",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#ff4b72",
    letterSpacing: 0.5,
  },
  stepBadge: {
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 20,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
  },
  contentScroll: {
    flex: 1,
    padding: "0 20px 20px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
  },
  robotWrap: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    margin: "20px 0 16px",
  },
  robotGlow: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(168,85,247,0.4) 0%, rgba(13,10,26,0) 70%)",
  },
  robotAvatar: {
    width: 110,
    height: 110,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2e1065 0%, #3b0764 100%)",
    border: "2px solid rgba(192, 132, 252, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
  },
  textGroup: {
    textAlign: "center",
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: 800,
    lineHeight: 1.25,
    margin: "0 0 8px",
  },
  welcomeDesc: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 1.5,
    margin: 0,
    padding: "0 12px",
  },
  cardsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 20,
  },
  featureCard: {
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.07)",
    borderRadius: 16,
    padding: 12,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  cardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    display: "flex",
    flexDirection: "column",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 700,
  },
  cardSub: {
    fontSize: 12,
    color: "#64748b",
  },
  primaryBtn: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    background: "linear-gradient(90deg, #ff4b72 0%, #9333ea 100%)",
    border: "none",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(255, 75, 114, 0.3)",
  },
  safeText: {
    textAlign: "center",
    fontSize: 12,
    color: "#64748b",
    marginTop: 12,
  },
  progressNav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    padding: "0 8px",
  },
  progressStepDone: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#ff4b72",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
  },
  progressLineDone: {
    flex: 1,
    height: 2,
    background: "#ff4b72",
  },
  progressStepActive: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "#ff4b72",
    border: "3px solid rgba(255, 75, 114, 0.3)",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
  },
  progressLine: {
    flex: 1,
    height: 2,
    background: "rgba(255, 255, 255, 0.15)",
  },
  progressStep: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.1)",
    fontSize: 11,
    color: "#94a3b8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  progressLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 6,
    marginBottom: 20,
  },
  chatRow: {
    display: "flex",
    gap: 10,
    marginBottom: 16,
  },
  chatAvatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#2e1065",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    flexShrink: 0,
  },
  chatBubble: {
    flex: 1,
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "4px 18px 18px 18px",
    padding: "14px 16px",
  },
  questionText: {
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.4,
    marginBottom: 4,
  },
  questionHelp: {
    fontSize: 12,
    color: "#94a3b8",
  },
  chatTime: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 8,
    textAlign: "right",
  },
  inputCard: {
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    color: "#94a3b8",
    display: "block",
    marginBottom: 8,
  },
  inputFieldWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  textInput: {
    width: "100%",
    height: 44,
    background: "rgba(0, 0, 0, 0.25)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    padding: "0 36px 0 12px",
    color: "#ffffff",
    fontSize: 14,
    outline: "none",
  },
  clearBtn: {
    position: "absolute",
    right: 10,
    background: "none",
    border: "none",
    cursor: "pointer",
  },
  optionsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  optionChip: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 12,
    color: "#ffffff",
    fontSize: 13,
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  nextBtn: {
    height: 40,
    padding: "0 20px",
    borderRadius: 20,
    background: "linear-gradient(90deg, #ff4b72 0%, #9333ea 100%)",
    border: "none",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  progressCard: {
    background: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  progressCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 8,
  },
  barBg: {
    height: 6,
    background: "rgba(255, 255, 255, 0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    background: "linear-gradient(90deg, #ff4b72, #9333ea)",
    transition: "width 0.3s ease",
  },
  infoBanner: {
    background: "rgba(255, 255, 255, 0.03)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    padding: 12,
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "rgba(244, 63, 94, 0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 2,
  },
  infoDesc: {
    fontSize: 11,
    color: "#94a3b8",
    lineHeight: 1.4,
  },
};
