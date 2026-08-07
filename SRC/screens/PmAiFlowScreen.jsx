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
  Users,
  Eye,
  Zap,
  Bot,
  Check,
} from "lucide-react";
import { generateCategoryQuestions, QUESTION_TYPES } from "../utils/aiQuestionEngine";
import { CommunityVerificationScreen } from "../components/CommunityVerificationScreen";
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
                  border: currentInput === opt ? "2px solid #FF3B6B" : "1px solid #E2E8F0",
                  background: currentInput === opt ? "rgba(255, 59, 107, 0.08)" : "#F8FAFC",
                  color: currentInput === opt ? "#FF3B6B" : "#1E293B",
                  fontWeight: currentInput === opt ? "700" : "500",
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
                    border: currentInput === val ? "2px solid #FF3B6B" : "1px solid #E2E8F0",
                    background: currentInput === val ? "rgba(255, 59, 107, 0.08)" : "#F8FAFC",
                    color: currentInput === val ? "#FF3B6B" : "#1E293B",
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
                <X size={16} color="#64748B" />
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
                <X size={16} color="#64748B" />
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

  const getStepIndex = () => {
    if (screenStage === "welcome" || screenStage === "conversation") return 2;
    if (screenStage === "valuation_preview") return 3;
    if (screenStage === "community_verification") return 4;
    return 5;
  };

  const currentStep = getStepIndex();

  return (
    <div className="pm-ai-container" style={styles.container}>
      {/* â”€â”€ Top Header Bar â”€â”€ */}
      <div style={styles.header}>
        <button style={styles.iconBtn} onClick={handleHeaderBack}>
          <ChevronLeft size={22} color="#1E3A8A" />
        </button>
        <span style={styles.headerTitle}>PM AI</span>
        <div style={styles.stepBadge}>
          <Sparkles size={11} color="#FF3B6B" style={{ marginRight: 4 }} />
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
              <Bot size={48} color="#FF3B6B" />
            </div>
          </div>

          <div style={styles.textGroup}>
            <h1 style={styles.welcomeTitle}>
              Hello! <span role="img" aria-label="wave">👋</span><br />
              I'm <span style={{ color: "#FF3B6B" }}>PM AI</span>
            </h1>
            <p style={styles.welcomeDesc}>
              I'll ask you a few questions about your item to analyze it and estimate its real market value.
            </p>
          </div>

          <div style={styles.cardsList}>
            <div style={styles.featureCard}>
              <div style={{ ...styles.cardIconBox, background: "rgba(255, 59, 107, 0.1)", color: "#FF3B6B" }}>
                <Target size={20} />
              </div>
              <div style={styles.cardText}>
                <div style={styles.cardTitle}>AI Valuation</div>
                <div style={styles.cardSub}>AI-powered evaluation</div>
              </div>
            </div>

            <div style={styles.featureCard}>
              <div style={{ ...styles.cardIconBox, background: "rgba(30, 58, 138, 0.1)", color: "#1E3A8A" }}>
                <ShieldCheck size={20} />
              </div>
              <div style={styles.cardText}>
                <div style={styles.cardTitle}>Community Verified</div>
                <div style={styles.cardSub}>Community verified</div>
              </div>
            </div>

            <div style={styles.featureCard}>
              <div style={{ ...styles.cardIconBox, background: "rgba(255, 59, 107, 0.1)", color: "#FF3B6B" }}>
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
            <div style={styles.safeText}>Your data is safe with us</div>
          </div>
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          STAGE 2: PM AI Conversation Screen
      â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {screenStage === "conversation" && (
        <div style={styles.contentScroll}>
          {/* Step Navigator */}
          <div style={styles.progressNav}>
            {[1, 2, 3, 4, 5].map((step) => {
              const isDone = step < currentStep;
              const isActive = step === currentStep;
              return (
                <React.Fragment key={step}>
                  <div
                    style={
                      isDone
                        ? styles.progressStepDone
                        : isActive
                        ? styles.progressStepActive
                        : styles.progressStep
                    }
                  >
                    {isDone ? <Check size={12} color="#FFFFFF" /> : step}
                  </div>
                  {step < 5 && (
                    <div style={isDone ? styles.progressLineDone : styles.progressLine} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div style={styles.progressLabels}>
            <span style={{ color: "#64748B" }}>Upload</span>
            <span style={{ fontWeight: 700, color: "#1E3A8A" }}>AI Questions</span>
            <span style={{ color: "#64748B" }}>AI Value</span>
            <span style={{ color: "#64748B" }}>Verify</span>
            <span style={{ color: "#64748B" }}>Publish</span>
          </div>

          <div style={styles.chatRow}>
            <div style={styles.chatAvatar}>
              <Bot size={20} color="#1E3A8A" />
            </div>
            <div style={styles.chatBubble}>
              <div style={styles.questionText}>{currentQuestion.label}</div>
              <div style={styles.questionHelp}>{currentQuestion.help}</div>
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
            <div style={styles.infoIcon}><Lightbulb size={18} color="#FF3B6B" /></div>
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
            {[1, 2, 3, 4, 5].map((step) => {
              const isDone = step < currentStep;
              const isActive = step === currentStep;
              return (
                <React.Fragment key={step}>
                  <div
                    style={
                      isDone
                        ? styles.progressStepDone
                        : isActive
                        ? styles.progressStepActive
                        : styles.progressStep
                    }
                  >
                    {isDone ? <Check size={12} color="#FFFFFF" /> : step}
                  </div>
                  {step < 5 && (
                    <div style={isDone ? styles.progressLineDone : styles.progressLine} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div style={styles.progressLabels}>
            <span style={{ color: "#64748B" }}>Upload</span>
            <span style={{ color: "#64748B" }}>AI Questions</span>
            <span style={{ fontWeight: 700, color: "#1E3A8A" }}>AI Value</span>
            <span style={{ color: "#64748B" }}>Verify</span>
            <span style={{ color: "#64748B" }}>Publish</span>
          </div>

          <div style={styles.valuationHero}>
            <div style={styles.heroBadge}>
              <Sparkles size={13} color="#FF3B6B" />
              <span>AI Estimated Valuation</span>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>
                Estimated Market Value
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#1E3A8A", marginTop: 4 }}>
                PKR 18,000 â€“ 22,000
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
              <div style={styles.heroStatCard}>
                <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Karma Points</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#FF3B6B", marginTop: 2 }}>1,250 KP</div>
              </div>
              <div style={styles.heroStatCard}>
                <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Confidence Score</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#16A34A", marginTop: 2 }}>96%</div>
              </div>
            </div>
          </div>

          <div style={styles.factorsCard}>
            <div style={styles.factorsTitle}>Factors Considered:</div>
            <div style={styles.factorsGrid}>
              {["Brand", "Condition", "Age", "Original Price", "Demand"].map((factor, idx) => (
                <div key={idx} style={styles.factorChip}>
                  <CheckCircle2 size={14} color="#16A34A" />
                  <span>{factor}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.disclaimerBox}>
            <HelpCircle size={16} color="#1E3A8A" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={styles.disclaimerText}>
              This is an AI estimated value. Final value may improve after <b>Community Verification</b>.
            </div>
          </div>

          <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", gap: 10 }}>
            <button style={styles.secondaryBtn} onClick={() => setScreenStage("conversation")}>Back</button>
            <button style={{ ...styles.primaryBtn, flex: 2 }} onClick={() => setScreenStage("community_verification")}>
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
  <CommunityVerificationScreen
    category={category}
    onContinue={() => setScreenStage("final_summary")}
    onSkip={() => setScreenStage("final_summary")}
    onBack={() => setScreenStage("valuation_preview")}
  />
)}
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          STAGE 5: Final AI Summary Screen
      â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {screenStage === "final_summary" && (
        <div style={styles.contentScroll}>
          <div style={styles.progressNav}>
            {[1, 2, 3, 4, 5].map((step) => {
              const isDone = step < currentStep;
              const isActive = step === currentStep;
              return (
                <React.Fragment key={step}>
                  <div
                    style={
                      isDone
                        ? styles.progressStepDone
                        : isActive
                        ? styles.progressStepActive
                        : styles.progressStep
                    }
                  >
                    {isDone ? <Check size={12} color="#FFFFFF" /> : step}
                  </div>
                  {step < 5 && (
                    <div style={isDone ? styles.progressLineDone : styles.progressLine} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div style={styles.progressLabels}>
            <span style={{ color: "#64748B" }}>Upload</span>
            <span style={{ color: "#64748B" }}>AI Questions</span>
            <span style={{ color: "#64748B" }}>AI Value</span>
            <span style={{ color: "#64748B" }}>Verify</span>
            <span style={{ fontWeight: 700, color: "#1E3A8A" }}>Publish</span>
          </div>

          <div style={styles.summaryTitleRow}>
            <Sparkles size={20} color="#FF3B6B" />
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#1E3A8A" }}>Final AI Summary</h2>
          </div>

          <div style={styles.summaryDashboard}>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Estimated Value</span>
              <span style={styles.summaryValBold}>PKR 18,000 â€“ 22,000</span>
            </div>

            <div style={styles.summaryDivider} />

            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Estimated Karma Points</span>
              <span style={{ ...styles.summaryValBold, color: "#FF3B6B" }}>1,250 KP</span>
            </div>

            <div style={styles.summaryDivider} />

            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>AI Confidence</span>
              <span style={{ ...styles.summaryValBold, color: "#16A34A" }}>96%</span>
            </div>

            <div style={styles.summaryDivider} />

            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Current Trust Score</span>
              <span style={{ ...styles.summaryValBold, color: "#1E3A8A" }}>70%</span>
            </div>

            <div style={styles.summaryDivider} />

            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Community Verification</span>
              <span style={styles.statusBadgePending}>Pending</span>
            </div>
          </div>

          <div style={styles.disclaimerBox}>
            <ShieldCheck size={16} color="#16A34A" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={styles.disclaimerText}>
              Your listing parameters have been recorded. Click below to view the verified details and finish posting.
            </div>
          </div>

          <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", gap: 10 }}>
            <button style={styles.secondaryBtn} onClick={() => setScreenStage("community_verification")}>Back</button>
            <button style={{ ...styles.primaryBtn, flex: 2 }} onClick={handleFinishFlow}>
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
   Point Market White & Royal Blue Theme Styles
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
  },
  iconBtn: { background: "none", border: "none", padding: 4, cursor: "pointer" },
  headerTitle: { fontSize: 18, fontWeight: 800, color: "#1E3A8A", letterSpacing: 0.5 },
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
    padding: "16px 20px 20px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
  },
  robotWrap: { position: "relative", display: "flex", justifyContent: "center", margin: "16px 0" },
  robotGlow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255, 59, 107, 0.15) 0%, rgba(255, 255, 255, 0) 70%)",
  },
  robotAvatar: {
    width: 100,
    height: 100,
    borderRadius: "50%",
    background: "#F8FAFC",
    border: "2px solid rgba(255, 59, 107, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 20px rgba(0, 0, 0, 0.05)",
  },
  textGroup: { textAlign: "center", marginBottom: 18 },
  welcomeTitle: { fontSize: 25, fontWeight: 800, lineHeight: 1.25, margin: "0 0 8px", color: "#1E3A8A" },
  welcomeDesc: { fontSize: 13, color: "#64748B", lineHeight: 1.5, margin: 0, padding: "0 10px" },
  cardsList: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 },
  featureCard: {
    background: "#FFFFFF",
    border: "1px solid #F1F5F9",
    borderRadius: 16,
    padding: 12,
    display: "flex",
    alignItems: "center",
    gap: 12,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
  },
  cardIconBox: { width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" },
  cardText: { display: "flex", flexDirection: "column" },
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#1E3A8A" },
  cardSub: { fontSize: 12, color: "#64748B" },
  primaryBtn: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    background: "linear-gradient(90deg, #FF3B6B 0%, #D92B54 100%)",
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
    flex: 1,
    height: 48,
    borderRadius: 24,
    background: "#FFFFFF",
    border: "1.5px solid #1E3A8A",
    color: "#1E3A8A",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  safeText: { textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 10 },
  progressNav: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, padding: "0 4px" },
  progressStepDone: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#FF3B6B",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    color: "#FFFFFF",
  },
  progressLineDone: { flex: 1, height: 2, background: "#FF3B6B" },
  progressStepActive: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#FF3B6B",
    border: "3px solid rgba(255, 59, 107, 0.2)",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    color: "#FFFFFF",
  },
  progressLine: { flex: 1, height: 2, background: "#E2E8F0" },
  progressStep: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#F1F5F9",
    fontSize: 10,
    color: "#94A3B8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  progressLabels: { display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748B", marginTop: 6, marginBottom: 16 },
  chatRow: { display: "flex", gap: 10, marginBottom: 14 },
  chatAvatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "rgba(30, 58, 138, 0.08)",
    border: "1px solid rgba(30, 58, 138, 0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chatBubble: {
    flex: 1,
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: "4px 18px 18px 18px",
    padding: "14px 16px",
  },
  questionText: { fontSize: 15, fontWeight: 700, lineHeight: 1.4, marginBottom: 4, color: "#1E3A8A" },
  questionHelp: { fontSize: 12, color: "#64748B" },
  inputCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
  },
  inputLabel: { fontSize: 12, color: "#64748B", display: "block", marginBottom: 8, fontWeight: 600 },
  inputFieldWrap: { position: "relative", display: "flex", alignItems: "center" },
  textInput: {
    width: "100%",
    height: 44,
    background: "#F8FAFC",
    border: "1px solid #CBD5E1",
    borderRadius: 12,
    padding: "0 36px 0 12px",
    color: "#1E293B",
    fontSize: 14,
    outline: "none",
  },
  clearBtn: { position: "absolute", right: 10, background: "none", border: "none", cursor: "pointer" },
  optionsGrid: { display: "flex", flexDirection: "column", gap: 8 },
  optionChip: { width: "100%", padding: "10px 14px", borderRadius: 12, fontSize: 13, textAlign: "left", cursor: "pointer" },
  nextBtn: {
    height: 40,
    padding: "0 20px",
    borderRadius: 20,
    background: "linear-gradient(90deg, #FF3B6B 0%, #D92B54 100%)",
    border: "none",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  progressCard: { background: "#F8FAFC", borderRadius: 16, padding: 14, marginBottom: 14, border: "1px solid #E2E8F0" },
  progressCardHeader: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748B", marginBottom: 8, fontWeight: 600 },
  barBg: { height: 6, background: "#E2E8F0", borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", background: "linear-gradient(90deg, #FF3B6B, #1E3A8A)", transition: "width 0.3s ease" },
  infoBanner: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 16,
    padding: 12,
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },
  infoIcon: { width: 32, height: 32, borderRadius: "50%", background: "rgba(255, 59, 107, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  infoTitle: { fontSize: 13, fontWeight: 700, marginBottom: 2, color: "#1E3A8A" },
  infoDesc: { fontSize: 11, color: "#64748B", lineHeight: 1.4 },
  valuationHero: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 20, padding: 18, marginBottom: 14, boxShadow: "0 4px 12px rgba(0,0,0,0.03)" },
  heroBadge: { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255, 59, 107, 0.1)", border: "1px solid rgba(255, 59, 107, 0.2)", borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#FF3B6B" },
  heroStatCard: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 14, padding: 12 },
  factorsCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 18, padding: 14, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" },
  factorsTitle: { fontSize: 12, fontWeight: 700, color: "#1E3A8A", marginBottom: 10 },
  factorsGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  factorChip: { display: "flex", alignItems: "center", gap: 6, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 16, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#1E293B" },
  disclaimerBox: { background: "rgba(30, 58, 138, 0.04)", border: "1px solid rgba(30, 58, 138, 0.12)", borderRadius: 14, padding: 12, display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  disclaimerText: { fontSize: 11.5, color: "#475569", lineHeight: 1.45 },
  premiumCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 20, padding: 16, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" },
  cardHeaderRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  cardHeaderIcon: { width: 36, height: 36, borderRadius: 12, background: "rgba(255, 59, 107, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" },
  premiumCardDesc: { fontSize: 12.5, color: "#64748B", lineHeight: 1.5, margin: 0 },
  sectionCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 18, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "#1E3A8A", marginBottom: 10 },
  trackerList: { display: "flex", flexDirection: "column", gap: 10 },
  trackerItem: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "10px 12px" },
  statusBadgeCompleted: { background: "rgba(22, 163, 74, 0.1)", border: "1px solid rgba(22, 163, 74, 0.2)", color: "#16A34A", borderRadius: 12, padding: "4px 10px", fontSize: 11, fontWeight: 700 },
  statusBadgePending: { background: "rgba(217, 119, 6, 0.1)", border: "1px solid rgba(217, 119, 6, 0.2)", color: "#D97706", borderRadius: 12, padding: "4px 10px", fontSize: 11, fontWeight: 700 },
  benefitsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  benefitRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#475569", background: "#F8FAFC", padding: "8px 10px", borderRadius: 10, border: "1px solid #F1F5F9" },
  summaryTitleRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 14 },
  summaryDashboard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 20, padding: 16, marginBottom: 14, boxShadow: "0 4px 12px rgba(0,0,0,0.03)" },
  summaryRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" },
  summaryLabel: { fontSize: 12.5, color: "#64748B" },
  summaryValBold: { fontSize: 14, fontWeight: 800, color: "#1E3A8A" },
  summaryDivider: { height: 1, background: "#F1F5F9", margin: "4px 0" },
};
