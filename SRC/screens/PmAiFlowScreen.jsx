import React, { useState } from "react";
import {
  ChevronLeft,
  ArrowRight,
  X,
  Lightbulb,
  Sparkles,
  Target,
  ShieldCheck,
  Lock,
  CheckCircle2,
  HelpCircle,
  Clock,
  Award,
  TrendingUp,
  Users,
  Eye,
  Zap,
} from "lucide-react";
import { generateCategoryQuestions, QUESTION_TYPES } from "../utils/aiQuestionEngine";

export function PmAiFlowScreen({ category = "", onComplete, onBack }) {
  // Screen stages: "welcome" | "conversation" | "valuation_preview" | "community_verification" | "final_summary"
  const [screenStage, setScreenStage] = useState("welcome");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentInput, setCurrentInput] = useState("");

  const questions = generateCategoryQuestions(category);
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQuestionIndex];

  /* â”€â”€ Question Handlers â”€â”€ */
  const handleNextQuestion = () => {
    if (currentInput === "" || currentInput === null || currentInput === undefined) return;

    const updatedAnswers = {
      ...answers,
      [currentQuestion.key]: currentInput,
    };
    setAnswers(updatedAnswers);
    setCurrentInput("");

    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      setScreenStage("valuation_preview");
    }
  };

  const handleOptionSelect = (optionValue) => {
    setCurrentInput(optionValue);
  };

  const handleFinishFlow = () => {
    if (onComplete) {
      onComplete(answers);
    }
  };

  /* â”€â”€ Input Renderer â”€â”€ */
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
                  border: currentInput === opt ? "2px solid #ff4b72" : "1px solid rgba(255,255,255,0.15)",
                  background: currentInput === opt ? "rgba(255, 75, 114, 0.2)" : "rgba(255, 255, 255, 0.06)",
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
                    height: 46,
                    fontWeight: 700,
                    textAlign: "center",
                    border: currentInput === val ? "2px solid #ff4b72" : "1px solid rgba(255,255,255,0.15)",
                    background: currentInput === val ? "rgba(255, 75, 114, 0.2)" : "rgba(255, 255, 255, 0.06)",
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
              placeholder={currentQuestion.type === QUESTION_TYPES.CURRENCY ? "e.g. 18000" : "e.g. 2023"}
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNextQuestion()}
              autoFocus
            />
            {String(currentInput).length > 0 && (
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
            {String(currentInput).length > 0 && (
              <button type="button" style={styles.clearBtn} onClick={() => setCurrentInput("")}>
                <X size={14} color="#94a3b8" />
              </button>
            )}
          </div>
        );
    }
  };

  const isNextDisabled = currentInput === "" || currentInput === null || currentInput === undefined;

  // Header Back Button Handler
  const handleHeaderBack = () => {
    if (screenStage === "conversation") setScreenStage("welcome");
    else if (screenStage === "valuation_preview") setScreenStage("conversation");
    else if (screenStage === "community_verification") setScreenStage("valuation_preview");
    else if (screenStage === "final_summary") setScreenStage("community_verification");
    else onBack();
  };

  // Step Number Resolver
  const getStepNumber = () => {
    if (screenStage === "welcome" || screenStage === "conversation") return "2";
    if (screenStage === "valuation_preview") return "3";
    if (screenStage === "community_verification") return "4";
    return "5";
  };

  return (
    <div className="pm-ai-container" style={styles.container}>
      {/* â”€â”€ Top Header Bar â”€â”€ */}
      <div style={styles.header}>
        <button style={styles.iconBtn} onClick={handleHeaderBack}>
          <ChevronLeft size={22} color="#ffffff" />
        </button>
        <span style={styles.headerTitle}>PM AI</span>
        <div style={styles.stepBadge}>
          <Sparkles size={11} color="#ff6b8b" style={{ marginRight: 4 }} />
          <span>Step {getStepNumber()} of 5</span>
        </div>
      </div>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          STAGE 1: PM AI Welcome Screen
      â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {screenStage === "welcome" && (
        <div style={styles.contentScroll}>
          <div style={styles.robotWrap}>
            <div style={styles.robotGlow} />
            <div style={styles.robotAvatar}>
              <span style={{ fontSize: 52 }}>ðŸ¤–</span>
            </div>
          </div>

          <div style={styles.textGroup}>
            <h1 style={styles.welcomeTitle}>
              Hello! ðŸ‘‹<br />I'm <span style={{ color: "#ff4b72" }}>PM AI</span>
            </h1>
            <p style={styles.welcomeDesc}>
              I'll ask you a few questions about your item to analyze it and estimate its real market value.
            </p>
          </div>

          <div style={styles.cardsList}>
            <div style={styles.featureCard}>
              <div style={{ ...styles.cardIconBox, background: "rgba(239, 68, 68, 0.2)", color: "#ef4444" }}>
                <Target size={20} />
              </div>
              <div style={styles.cardText}>
                <div style={styles.cardTitle}>AI Valuation</div>
                <div style={styles.cardSub}>AI-powered evaluation</div>
              </div>
            </div>

            <div style={styles.featureCard}>
              <div style={{ ...styles.cardIconBox, background: "rgba(236, 72, 153, 0.2)", color: "#ec4899" }}>
                <ShieldCheck size={20} />
              </div>
              <div style={styles.cardText}>
                <div style={styles.cardTitle}>Community Verified</div>
                <div style={styles.cardSub}>Community verified</div>
              </div>
            </div>

            <div style={styles.featureCard}>
              <div style={{ ...styles.cardIconBox, background: "rgba(168, 85, 247, 0.2)", color: "#a855f7" }}>
                <Lock size={20} />
              </div>
              <div style={styles.cardText}>
                <div style={styles.cardTitle}>Secure Trading</div>
                <div style={styles.cardSub}>Get the best value</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "auto", paddingBottom: 16 }}>
            <button style={styles.primaryBtn} onClick={() => setScreenStage("conversation")}>
              <span>Let's Start Analysis</span>
              <ArrowRight size={18} />
            </button>
            <div style={styles.safeText}>ðŸ”’ Your data is safe with us</div>
          </div>
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          STAGE 2: PM AI Conversation Screen
      â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {screenStage === "conversation" && (
        <div style={styles.contentScroll}>
          <div style={styles.progressNav}>
            <div style={styles.progressStepDone}>âœ“</div>
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

          <div style={styles.chatRow}>
            <div style={styles.chatAvatar}>ðŸ¤–</div>
            <div style={styles.chatBubble}>
              <div style={styles.questionText}>{currentQuestion.label}</div>
              <div style={styles.questionHelp}>{currentQuestion.help}</div>
              <div style={styles.chatTime}>9:41 PM</div>
            </div>
          </div>

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

          <div style={styles.progressCard}>
            <div style={styles.progressCardHeader}>
              <span>Question Progress</span>
              <span>{currentQuestionIndex + 1} of {totalQuestions}</span>
            </div>
            <div style={styles.barBg}>
              <div style={{ ...styles.barFill, width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }} />
            </div>
          </div>

          <div style={styles.infoBanner}>
            <div style={styles.infoIcon}><Lightbulb size={18} color="#f43f5e" /></div>
            <div>
              <div style={styles.infoTitle}>Why we ask these questions?</div>
              <div style={styles.infoDesc}>
                PM AI uses your answers to analyze your item and suggest the most accurate Karma Points.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          STAGE 3: PM AI Estimated Value Preview Screen
      â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {screenStage === "valuation_preview" && (
        <div style={styles.contentScroll}>
          <div style={styles.progressNav}>
            <div style={styles.progressStepDone}>âœ“</div>
            <div style={styles.progressLineDone} />
            <div style={styles.progressStepDone}>âœ“</div>
            <div style={styles.progressLineDone} />
            <div style={styles.progressStepActive}>3</div>
            <div style={styles.progressLine} />
            <div style={styles.progressStep}>4</div>
            <div style={styles.progressLine} />
            <div style={styles.progressStep}>5</div>
          </div>
          <div style={styles.progressLabels}>
            <span style={{ opacity: 0.6 }}>Upload</span>
            <span style={{ opacity: 0.6 }}>AI Questions</span>
            <span style={{ fontWeight: 700, color: "#ffffff" }}>AI Value</span>
            <span style={{ opacity: 0.6 }}>Verify</span>
            <span style={{ opacity: 0.6 }}>Publish</span>
          </div>

          <div style={styles.valuationHero}>
            <div style={styles.heroBadge}>
              <Sparkles size={13} color="#ff4b72" />
              <span>AI Estimated Valuation</span>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "#93c5fd", textTransform: "uppercase", letterSpacing: 0.8 }}>
                Estimated Market Value
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#ffffff", marginTop: 4 }}>
                PKR 18,000 â€“ 22,000
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
              <div style={styles.heroStatCard}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Karma Points</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#ff4b72", marginTop: 2 }}>1,250 KP</div>
              </div>
              <div style={styles.heroStatCard}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Confidence Score</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#22c55e", marginTop: 2 }}>96%</div>
              </div>
            </div>
          </div>

          <div style={styles.factorsCard}>
            <div style={styles.factorsTitle}>Factors Considered:</div>
            <div style={styles.factorsGrid}>
              {["Brand", "Condition", "Age", "Original Price", "Demand"].map((factor, idx) => (
                <div key={idx} style={styles.factorChip}>
                  <CheckCircle2 size={14} color="#22c55e" />
                  <span>{factor}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.disclaimerBox}>
            <HelpCircle size={16} color="#38bdf8" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={styles.disclaimerText}>
              This is an AI estimated value. Final value may improve after <b>Community Verification</b>.
            </div>
          </div>

          <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", gap: 10 }}>
            <button style={styles.ghostBtn} onClick={() => setScreenStage("conversation")}>
              Back
            </button>
            <button
              style={{ ...styles.primaryBtn, flex: 2 }}
              onClick={() => setScreenStage("community_verification")}
            >
              <span>Continue</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          STAGE 4: Community Verification Screen
      â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {screenStage === "community_verification" && (
        <div style={styles.contentScroll}>
          <div style={styles.progressNav}>
            <div style={styles.progressStepDone}>âœ“</div>
            <div style={styles.progressLineDone} />
            <div style={styles.progressStepDone}>âœ“</div>
            <div style={styles.progressLineDone} />
            <div style={styles.progressStepDone}>âœ“</div>
            <div style={styles.progressLineDone} />
            <div style={styles.progressStepActive}>4</div>
            <div style={styles.progressLine} />
            <div style={styles.progressStep}>5</div>
          </div>
          <div style={styles.progressLabels}>
            <span style={{ opacity: 0.6 }}>Upload</span>
            <span style={{ opacity: 0.6 }}>AI Questions</span>
            <span style={{ opacity: 0.6 }}>AI Value</span>
            <span style={{ fontWeight: 700, color: "#ffffff" }}>Verify</span>
            <span style={{ opacity: 0.6 }}>Publish</span>
          </div>

          {/* Premium Overview Card */}
          <div style={styles.premiumCard}>
            <div style={styles.cardHeaderRow}>
              <div style={styles.cardHeaderIcon}>
                <Users size={20} color="#ff4b72" />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Community Verification</div>
            </div>
            <p style={styles.premiumCardDesc}>
              Our AI has estimated your item's value. Now trusted community members will verify your listing to improve accuracy and trust.
            </p>
          </div>

          {/* Progress Tracker Section */}
          <div style={styles.sectionCard}>
            <div style={styles.sectionTitle}>Verification Status</div>
            <div style={styles.trackerList}>
              <div style={styles.trackerItem}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CheckCircle2 size={18} color="#22c55e" />
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>AI Verification</span>
                </div>
                <span style={styles.statusBadgeCompleted}>âœ… Completed</span>
              </div>

              <div style={styles.trackerItem}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Clock size={18} color="#f59e0b" />
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>Community Verification</span>
                </div>
                <span style={styles.statusBadgePending}>â³ Pending</span>
              </div>

              <div style={styles.trackerItem}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Award size={18} color="#38bdf8" />
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>Trust Score</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8" }}>Starting from 70%</span>
              </div>
            </div>
          </div>

          {/* Benefits Card */}
          <div style={styles.sectionCard}>
            <div style={styles.sectionTitle}>Benefits of Community Verification</div>
            <div style={styles.benefitsGrid}>
              <div style={styles.benefitRow}>
                <Eye size={15} color="#22c55e" />
                <span>Better visibility</span>
              </div>
              <div style={styles.benefitRow}>
                <Award size={15} color="#22c55e" />
                <span>Higher Trust Score</span>
              </div>
              <div style={styles.benefitRow}>
                <Sparkles size={15} color="#22c55e" />
                <span>More accurate Karma Points</span>
              </div>
              <div style={styles.benefitRow}>
                <Zap size={15} color="#22c55e" />
                <span>Faster successful trades</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", gap: 10 }}>
            <button style={styles.ghostBtn} onClick={() => setScreenStage("valuation_preview")}>
              Back
            </button>
            <button
              style={{ ...styles.primaryBtn, flex: 2 }}
              onClick={() => setScreenStage("final_summary")}
            >
              <span>Continue</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          STAGE 5: Final AI Summary Screen
      â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {screenStage === "final_summary" && (
        <div style={styles.contentScroll}>
          <div style={styles.progressNav}>
            <div style={styles.progressStepDone}>âœ“</div>
            <div style={styles.progressLineDone} />
            <div style={styles.progressStepDone}>âœ“</div>
            <div style={styles.progressLineDone} />
            <div style={styles.progressStepDone}>âœ“</div>
            <div style={styles.progressLineDone} />
            <div style={styles.progressStepDone}>âœ“</div>
            <div style={styles.progressLineDone} />
            <div style={styles.progressStepActive}>5</div>
          </div>
          <div style={styles.progressLabels}>
            <span style={{ opacity: 0.6 }}>Upload</span>
            <span style={{ opacity: 0.6 }}>AI Questions</span>
            <span style={{ opacity: 0.6 }}>AI Value</span>
            <span style={{ opacity: 0.6 }}>Verify</span>
            <span style={{ fontWeight: 700, color: "#ffffff" }}>Publish</span>
          </div>

          <div style={styles.summaryTitleRow}>
            <Sparkles size={20} color="#ff4b72" />
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Final AI Summary</h2>
          </div>

          {/* Final Summary Hero Dashboard */}
          <div style={styles.summaryDashboard}>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Estimated Value</span>
              <span style={styles.summaryValBold}>PKR 18,000 â€“ 22,000</span>
            </div>

            <div style={styles.summaryDivider} />

            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Estimated Karma Points</span>
              <span style={{ ...styles.summaryValBold, color: "#ff4b72" }}>1,250 KP</span>
            </div>

            <div style={styles.summaryDivider} />

            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>AI Confidence</span>
              <span style={{ ...styles.summaryValBold, color: "#22c55e" }}>96%</span>
            </div>

            <div style={styles.summaryDivider} />

            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Current Trust Score</span>
              <span style={{ ...styles.summaryValBold, color: "#38bdf8" }}>70%</span>
            </div>

            <div style={styles.summaryDivider} />

            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Community Verification</span>
              <span style={styles.statusBadgePending}>Pending</span>
            </div>
          </div>

          <div style={styles.disclaimerBox}>
            <ShieldCheck size={16} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={styles.disclaimerText}>
              Your listing parameters have been recorded. Click below to view the verified details and finish posting.
            </div>
          </div>

          <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", gap: 10 }}>
            <button style={styles.ghostBtn} onClick={() => setScreenStage("community_verification")}>
              Back
            </button>
            <button
              style={{ ...styles.primaryBtn, flex: 2 }}
              onClick={handleFinishFlow}
            >
              <span>Confirm &amp; Proceed</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Point Market Royal Blue Official Design System
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const styles = {
  container: {
    width: "100%",
    maxWidth: 420,
    height: "100vh",
    margin: "0 auto",
    backgroundColor: "#102A72",
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
    background: "rgba(255, 255, 255, 0.12)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
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
    margin: "16px 0",
  },
  robotGlow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255,75,114,0.3) 0%, rgba(16,42,114,0) 70%)",
  },
  robotAvatar: {
    width: 105,
    height: 105,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)",
    border: "2px solid rgba(255, 75, 114, 0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
  },
  textGroup: {
    textAlign: "center",
    marginBottom: 18,
  },
  welcomeTitle: {
    fontSize: 25,
    fontWeight: 800,
    lineHeight: 1.25,
    margin: "0 0 8px",
  },
  welcomeDesc: {
    fontSize: 13,
    color: "#bfdbfe",
    lineHeight: 1.5,
    margin: 0,
    padding: "0 10px",
  },
  cardsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 20,
  },
  featureCard: {
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
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
    color: "#93c5fd",
  },
  primaryBtn: {
    width: "100%",
    height: 48,
    borderRadius: 24,
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
    boxShadow: "0 8px 20px rgba(255, 75, 114, 0.35)",
  },
  ghostBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    background: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  safeText: {
    textAlign: "center",
    fontSize: 12,
    color: "#93c5fd",
    marginTop: 10,
  },
  progressNav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    padding: "0 4px",
  },
  progressStepDone: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#ff4b72",
    fontSize: 11,
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
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#ff4b72",
    border: "3px solid rgba(255, 255, 255, 0.3)",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
  },
  progressLine: {
    flex: 1,
    height: 2,
    background: "rgba(255, 255, 255, 0.2)",
  },
  progressStep: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.15)",
    fontSize: 10,
    color: "#93c5fd",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  progressLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    color: "#93c5fd",
    marginTop: 6,
    marginBottom: 16,
  },
  chatRow: {
    display: "flex",
    gap: 10,
    marginBottom: 14,
  },
  chatAvatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#1e3a8a",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    flexShrink: 0,
  },
  chatBubble: {
    flex: 1,
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.14)",
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
    color: "#bfdbfe",
  },
  chatTime: {
    fontSize: 10,
    color: "#93c5fd",
    marginTop: 8,
    textAlign: "right",
  },
  inputCard: {
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    color: "#bfdbfe",
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
    background: "rgba(0, 0, 0, 0.2)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
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
    background: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  progressCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#bfdbfe",
    marginBottom: 8,
  },
  barBg: {
    height: 6,
    background: "rgba(255, 255, 255, 0.15)",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    background: "linear-gradient(90deg, #ff4b72, #9333ea)",
    transition: "width 0.3s ease",
  },
  infoBanner: {
    background: "rgba(255, 255, 255, 0.06)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
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
    background: "rgba(255, 75, 114, 0.2)",
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
    color: "#bfdbfe",
    lineHeight: 1.4,
  },
  valuationHero: {
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(255, 75, 114, 0.15)",
    border: "1px solid rgba(255, 75, 114, 0.3)",
    borderRadius: 20,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 700,
    color: "#ff4b72",
  },
  heroStatCard: {
    background: "rgba(0, 0, 0, 0.2)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: 14,
    padding: 12,
  },
  factorsCard: {
    background: "rgba(255, 255, 255, 0.06)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  factorsTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#bfdbfe",
    marginBottom: 10,
  },
  factorsGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  factorChip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: 16,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
  },
  disclaimerBox: {
    background: "rgba(56, 189, 248, 0.1)",
    border: "1px solid rgba(56, 189, 248, 0.25)",
    borderRadius: 14,
    padding: 12,
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  disclaimerText: {
    fontSize: 11.5,
    color: "#e0f2fe",
    lineHeight: 1.45,
  },
  /* Phase 3 Custom Styles */
  premiumCard: {
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  cardHeaderRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  cardHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    background: "rgba(255, 75, 114, 0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumCardDesc: {
    fontSize: 12.5,
    color: "#bfdbfe",
    lineHeight: 1.5,
    margin: 0,
  },
  sectionCard: {
    background: "rgba(255, 255, 255, 0.06)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: 10,
  },
  trackerList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  trackerItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(0, 0, 0, 0.2)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: "10px 12px",
  },
  statusBadgeCompleted: {
    background: "rgba(34, 197, 94, 0.15)",
    border: "1px solid rgba(34, 197, 94, 0.3)",
    color: "#22c55e",
    borderRadius: 12,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 700,
  },
  statusBadgePending: {
    background: "rgba(245, 158, 11, 0.15)",
    border: "1px solid rgba(245, 158, 11, 0.3)",
    color: "#f59e0b",
    borderRadius: 12,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 700,
  },
  benefitsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  benefitRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11.5,
    color: "#bfdbfe",
    background: "rgba(255, 255, 255, 0.04)",
    padding: "8px 10px",
    borderRadius: 10,
  },
  summaryTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  summaryDashboard: {
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
  },
  summaryLabel: {
    fontSize: 12.5,
    color: "#bfdbfe",
  },
  summaryValBold: {
    fontSize: 14,
    fontWeight: 800,
    color: "#ffffff",
  },
  summaryDivider: {
    height: 1,
    background: "rgba(255, 255, 255, 0.08)",
    margin: "4px 0",
  },
};
