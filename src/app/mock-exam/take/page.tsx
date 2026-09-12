"use client";

import { formatPromptHTML, cleanMathText } from "@/lib/formatPrompt";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import FlagQuestionButton from "@/components/exam/FlagQuestionButton";
import DatabaseLoadingIndicator from "@/components/common/DatabaseLoadingIndicator";
import ExamSubmissionLoader from "@/components/exam/ExamSubmissionLoader";
import QuestionResultBanner from "@/components/question/QuestionResultBanner";
import ExplanationPanel from "@/components/question/ExplanationPanel";
import { queueOfflineSubmission } from "@/lib/offline-storage";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useAuth } from "@/context/AuthContext";

interface Question {
  id: string;
  category: string;
  subtopic?: string;
  prompt: string;
  options: string[];
  imageUrl?: string;
  difficulty?: string;
  tags?: string[];
}

interface GuidedFeedback {
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  answerIndex: number;
  correctLetter: string;
  correctText: string;
  explanation?: string | null;
  stepByStep?: string | null;
  whyA?: string | null;
  whyB?: string | null;
  whyC?: string | null;
  whyD?: string | null;
  eliminationStrategy?: string | null;
  commonTrap?: string | null;
  examTip?: string | null;
}

const LOCAL_STORAGE_KEY = "cse_active_exam_session";

const DEFAULT_CATEGORIES = [
  "Verbal Ability",
  "Numerical Reasoning",
  "Analytical Reasoning",
  "General Information",
  "Clerical Ability",
];

function TakeExamPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isOnline } = useOfflineSync();
  const { user, status } = useAuth();

  const isPaid = Boolean(user?.isPaid || user?.role === "ADMIN");

  // Classify Custom Practice vs Standard Mock parameters
  const hasItemCount = searchParams.has("itemCount");
  const hasCategories = searchParams.has("categories");
  const hasPool = searchParams.has("pool");
  const hasMode = searchParams.has("mode");

  const hasAnyCustomParam =
    hasItemCount || hasCategories || hasPool || hasMode;

  const hasAllCustomParams =
    hasItemCount && hasCategories && hasPool && hasMode;

  const itemCountVal = (searchParams.get("itemCount") || "").trim();
  const categoriesVal = (searchParams.get("categories") || "").trim();
  const poolVal = (searchParams.get("pool") || "").trim();
  const modeVal = (searchParams.get("mode") || "").trim();

  const isCompleteNonEmptyCustom =
    hasAllCustomParams &&
    itemCountVal !== "" &&
    categoriesVal !== "" &&
    poolVal !== "" &&
    modeVal !== "";

  const isPartialOrEmptyCustom =
    hasAnyCustomParam && !isCompleteNonEmptyCustom;

  // Page-level Premium and Parameter Validation Guard
  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated" || !user) {
      router.replace("/login");
      return;
    }

    // Partial or empty custom config -> redirect to custom quiz builder
    if (isPartialOrEmptyCustom) {
      router.replace("/practice/custom");
      return;
    }

    // Authenticated free user attempting Standard Mock Exam -> redirect to upgrade
    if (!hasAnyCustomParam && !isPaid) {
      router.replace("/upgrade");
      return;
    }
  }, [status, user, isPaid, isPartialOrEmptyCustom, hasAnyCustomParam, router]);

  // Data States
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  // App State
  const [loading, setLoading] = useState(true);
  const [startingExam, setStartingExam] = useState(false);
  const [isSetupPhase, setIsSetupPhase] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [savedSessionData, setSavedSessionData] = useState<any | null>(null);
  const [offlineBanner, setOfflineBanner] = useState(false);

  // Mode & Guided Review States
  const [examMode, setExamMode] = useState<"SIMULATION" | "GUIDED_REVIEW">("SIMULATION");
  const [checkedAnswers, setCheckedAnswers] = useState<{ [key: number]: boolean }>({});
  const [guidedFinished, setGuidedFinished] = useState(false);
  const [guidedReviewToken, setGuidedReviewToken] = useState<string | null>(null);
  const [guidedFeedbackByQuestionId, setGuidedFeedbackByQuestionId] = useState<
    Record<string, GuidedFeedback>
  >({});
  const [checkingAnswer, setCheckingAnswer] = useState(false);

  // Configuration States
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [timerMinutes, setTimerMinutes] = useState(0); // 0 means untimed
  // Custom quiz metadata (from builder)
  const [isCustomQuiz, setIsCustomQuiz] = useState(false);
  const [customQuizLabel, setCustomQuizLabel] = useState("");
  const [timeLeft, setTimeLeft] = useState(0); // In seconds

  // Exam States
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg">("md");
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [attemptToken, setAttemptToken] = useState<string | null>(null);


  // Load saved font size preference
  useEffect(() => {
    const saved = localStorage.getItem("cse_exam_font_size");
    if (saved === "sm" || saved === "md" || saved === "lg") {
      setFontSize(saved);
    }
  }, []);

  const handleFontSizeChange = (size: "sm" | "md" | "lg") => {
    setFontSize(size);
    localStorage.setItem("cse_exam_font_size", size);
  };

  function handleSelectOption(optionIndex: number) {
    if (examMode === "GUIDED_REVIEW" && (checkedAnswers[currentIndex] || checkingAnswer)) {
      return; // Locked after checking or while check request is in-flight
    }
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionIndex,
    }));
  }

  const handleCheckAnswer = useCallback(async () => {
    if (examMode !== "GUIDED_REVIEW") return;
    if (checkingAnswer) return;

    const questionIndex = currentIndex;
    const currentQ = examQuestions[questionIndex];
    if (!currentQ) return;
    const questionId = currentQ.id;
    const selectedIdx = selectedAnswers[questionIndex];

    if (selectedIdx === undefined) return;
    if (checkedAnswers[questionIndex]) return;

    if (!guidedReviewToken || !guidedReviewToken.trim()) {
      alert("Missing or invalid review session credential. Please restart your Guided Review session.");
      return;
    }

    if (!isOnline) {
      alert("You are currently offline. Please reconnect to check your answer.");
      return;
    }

    setCheckingAnswer(true);

    try {
      const res = await fetch("/api/exam/guided-review/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guidedReviewToken: guidedReviewToken.trim(),
          questionId,
          selectedIndex: selectedIdx,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (
          data &&
          data.success === true &&
          data.questionId === questionId &&
          data.selectedIndex === selectedIdx &&
          typeof data.isCorrect === "boolean" &&
          Number.isInteger(data.answerIndex)
        ) {
          // Valid authoritative check response
          setGuidedFeedbackByQuestionId((prev) => ({
            ...prev,
            [questionId]: data as GuidedFeedback,
          }));
          setCheckedAnswers((prev) => ({
            ...prev,
            [questionIndex]: true,
          }));
        } else {
          console.error("[GUIDED_CHECK] Malformed success payload from server:", data);
          alert("Unexpected server response while checking answer. Selection has been preserved.");
        }
      } else {
        const errData = await res.json().catch(() => null);
        const errMsg = errData?.error || `Server returned error status ${res.status}.`;
        console.warn(`[GUIDED_CHECK] Server check error ${res.status}:`, errMsg);
        alert(errMsg);
      }
    } catch (err) {
      console.error("[GUIDED_CHECK] Network fetch failure:", err);
      alert("Network error checking answer. Please check your connection and try again.");
    } finally {
      setCheckingAnswer(false);
    }
  }, [
    examMode,
    checkingAnswer,
    currentIndex,
    examQuestions,
    selectedAnswers,
    checkedAnswers,
    guidedReviewToken,
    isOnline,
  ]);

  // Keyboard Shortcuts (A/B/C/D, 1/2/3/4, ArrowRight, ArrowLeft, F/B)
  useEffect(() => {
    if (isSetupPhase || isPauseModalOpen || submitting) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const key = e.key.toUpperCase();

      // Option selection
      if (key === "A" || key === "1") {
        e.preventDefault();
        handleSelectOption(0);
      } else if (key === "B" || key === "2") {
        e.preventDefault();
        handleSelectOption(1);
      } else if (key === "C" || key === "3") {
        e.preventDefault();
        handleSelectOption(2);
      } else if (key === "D" || key === "4") {
        e.preventDefault();
        handleSelectOption(3);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (examMode === "GUIDED_REVIEW" && !checkedAnswers[currentIndex]) {
          if (selectedAnswers[currentIndex] !== undefined && !checkingAnswer) {
            void handleCheckAnswer();
          }
        } else {
          setCurrentIndex((prev) => Math.min(examQuestions.length - 1, prev + 1));
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentIndex((prev) => Math.min(examQuestions.length - 1, prev + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (key === "F") {
        e.preventDefault();
        const currentQ = examQuestions[currentIndex];
        if (currentQ) toggleBookmark(currentQ.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSetupPhase, isPauseModalOpen, submitting, examQuestions, currentIndex, examMode, checkedAnswers, selectedAnswers, handleCheckAnswer, checkingAnswer]);

  // 1. Load Initial Categories, Bookmarks & Check for In-Progress Session
  useEffect(() => {
    async function initExam() {
      try {
        const bookmarkRes = await fetch("/api/bookmarks")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

        if (bookmarkRes?.bookmarks) {
          const ids = new Set<string>(
            bookmarkRes.bookmarks
              .filter((b: any) => b.targetType === "QUESTION" || !b.targetType)
              .map((b: any) => b.id)
          );
          setBookmarkedIds(ids);
        }

        // Check for active unfinished exam session in local storage
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.examQuestions && parsed.examQuestions.length > 0) {
              const mode = parsed.examMode === "GUIDED_REVIEW" ? "GUIDED_REVIEW" : "SIMULATION";

              if (mode === "GUIDED_REVIEW") {
                // Scan ALL TEN sensitive fields
                const hasLegacyAnswers = parsed.examQuestions.some(
                  (q: any) =>
                    q.answerIndex !== undefined ||
                    q.explanation !== undefined ||
                    q.stepByStep !== undefined ||
                    q.whyA !== undefined ||
                    q.whyB !== undefined ||
                    q.whyC !== undefined ||
                    q.whyD !== undefined ||
                    q.eliminationStrategy !== undefined ||
                    q.commonTrap !== undefined ||
                    q.examTip !== undefined
                );

                const lacksGuidedToken =
                  typeof parsed.guidedReviewToken !== "string" || !parsed.guidedReviewToken.trim();

                const hasAttemptToken =
                  typeof parsed.attemptToken === "string" && parsed.attemptToken.trim().length > 0;

                if (hasLegacyAnswers || lacksGuidedToken || hasAttemptToken) {
                  console.warn("[EXAM_SESSION] Discarding legacy/unsafe Guided Review saved session.");
                  localStorage.removeItem(LOCAL_STORAGE_KEY);
                  setSavedSessionData(null);
                } else {
                  setSavedSessionData(parsed);
                  setExamMode("GUIDED_REVIEW");
                  if (parsed.checkedAnswers) setCheckedAnswers(parsed.checkedAnswers);
                  if (parsed.guidedFeedbackByQuestionId) {
                    setGuidedFeedbackByQuestionId(parsed.guidedFeedbackByQuestionId);
                  }
                }
              } else {
                // SIMULATION
                if (typeof parsed.attemptToken === "string" && parsed.attemptToken.trim()) {
                  setSavedSessionData(parsed);
                  setExamMode("SIMULATION");
                  if (parsed.checkedAnswers) setCheckedAnswers(parsed.checkedAnswers);
                } else {
                  // Strict 1E3B: Discard legacy token-less session and require fresh start
                  console.warn("[EXAM_SESSION] Discarded legacy token-less saved exam session.");
                  localStorage.removeItem(LOCAL_STORAGE_KEY);
                  setSavedSessionData(null);
                }
              }
            }
          } catch (e) {
            console.error("Error parsing saved exam session:", e);
          }
        }
      } catch (err) {
        console.error("Failed to initialize exam session:", err);
      } finally {
        setLoading(false);
      }
    }
    initExam();
  }, []);

  // 2. Auto-Save Active Exam State to LocalStorage
  useEffect(() => {
    if (
      !isSetupPhase &&
      examQuestions.length > 0 &&
      !submitting &&
      !guidedFinished &&
      !offlineBanner
    ) {
      const questionsToPersist = examQuestions.map((q) => ({
        id: q.id,
        category: q.category,
        subtopic: q.subtopic,
        prompt: q.prompt,
        options: q.options,
        imageUrl: q.imageUrl || null,
        difficulty: q.difficulty,
        tags: q.tags,
      }));

      const activeSession = {
        examMode,
        examQuestions: questionsToPersist,
        selectedAnswers,
        checkedAnswers,
        currentIndex,
        timerMinutes,
        timeLeft,
        attemptToken: examMode === "GUIDED_REVIEW" ? null : attemptToken,
        guidedReviewToken: examMode === "GUIDED_REVIEW" ? guidedReviewToken : null,
        guidedFeedbackByQuestionId: examMode === "GUIDED_REVIEW" ? guidedFeedbackByQuestionId : {},
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(activeSession));
    }
  }, [
    isSetupPhase,
    examMode,
    examQuestions,
    selectedAnswers,
    checkedAnswers,
    currentIndex,
    timerMinutes,
    timeLeft,
    submitting,
    guidedFinished,
    attemptToken,
    guidedReviewToken,
    guidedFeedbackByQuestionId,
    offlineBanner,
  ]);

  // Toggle Bookmark Handler
  const toggleBookmark = async (questionId: string) => {
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: questionId, targetType: "QUESTION" }),
      });

      const data = await res.json();
      if (res.ok) {
        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          if (data.isBookmarked) {
            next.add(questionId);
          } else {
            next.delete(questionId);
          }
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to update bookmark:", err);
    }
  };

  // 3. Submit Exam & Clear Active Session
  const handleSubmitExam = useCallback(async () => {
    if (submitting) return;
    if (examMode === "GUIDED_REVIEW") return; // Safety guard: Guided Review NEVER submits to server
    setSubmitting(true);

    const totalItems = examQuestions.length;

    const formattedAnswers = examQuestions.map((q, idx) => {
      const selectedIdx = selectedAnswers[idx];
      return {
        questionId: q.id,
        selectedIndex: selectedIdx !== undefined ? selectedIdx : -1,
        selectedOption: selectedIdx !== undefined ? ["A", "B", "C", "D"][selectedIdx] : "",
      };
    });

    const submissionPayload = {
      totalItems,
      answers: formattedAnswers,
      ...(attemptToken ? { attemptToken } : {}),
    };

    // 🌐 Offline-Aware Submission: queue if offline, network error, or retryable HTTP status
    let shouldQueueForRetry = false;

    if (isOnline) {
      try {
        const res = await fetch("/api/exam/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submissionPayload),
        });

        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (
            data?.success === true &&
            typeof data?.result?.id === "string" &&
            data.result.id.trim().length > 0
          ) {
            // Confirmed successful server submission (initial or idempotent replay)
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            localStorage.removeItem("cse_latest_review");
            router.push(`/mock-exam/results?id=${encodeURIComponent(data.result.id.trim())}`);
            return;
          } else {
            // CORRECTION 2: HTTP 2xx but malformed success payload (missing success or result.id).
            // Do NOT queue as offline. Stop submission, retain active session, alert user.
            console.error("[EXAM_SUBMIT] Malformed 2xx response from server:", data);
            alert("Unexpected server response while submitting exam. Please check your Exam History before retrying.");
            setSubmitting(false);
            return;
          }
        } else {
          // CORRECTION 1: Server returned non-2xx status.
          const status = res.status;
          const isTerminal =
            status === 400 || status === 403 || status === 409 || status === 422;

          if (isTerminal) {
            // Terminal rejection: DO NOT queue, DO NOT clear session, DO NOT show offline banner
            const errData = await res.json().catch(() => null);
            const errMsg = errData?.error || `Exam submission rejected by server (HTTP ${status}).`;
            console.warn(`[EXAM_SUBMIT] Terminal rejection ${status}:`, errMsg);
            alert(errMsg);
            setSubmitting(false);
            return;
          } else {
            // Retryable error (401, 429, 5xx, etc.) -> may queue for offline sync
            console.warn(`[EXAM_SUBMIT] Server returned retryable status ${status}. Queueing for offline sync.`);
            shouldQueueForRetry = true;
          }
        }
      } catch (err) {
        // Network fetch failure -> queue for offline sync
        console.error("Network error submitting exam. Queueing for offline sync:", err);
        shouldQueueForRetry = true;
      }
    } else {
      // Device is already offline -> queue for offline sync
      shouldQueueForRetry = true;
    }

    if (shouldQueueForRetry) {
      let queuedSuccessfully = false;
      try {
        await queueOfflineSubmission(submissionPayload);
        queuedSuccessfully = true;
      } catch (queueErr) {
        console.error("Failed to queue offline submission:", queueErr);
        alert("Unable to save offline submission. Please keep this window open until connection is restored.");
        setSubmitting(false);
        return;
      }

      // ONLY after successful queue persistence:
      if (queuedSuccessfully) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem("cse_latest_review");
        setSubmitting(false);
        setOfflineBanner(true);
      }
    }
  }, [examQuestions, selectedAnswers, submitting, router, isOnline, examMode, attemptToken]);

  // Timer Logic
  useEffect(() => {
    if (!isSetupPhase && timerMinutes > 0 && !isPauseModalOpen && examMode !== "GUIDED_REVIEW") {
      if (timeLeft > 0) {
        const timerId = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
        return () => clearInterval(timerId);
      } else if (timeLeft === 0 && !submitting) {
        handleSubmitExam();
      }
    }
  }, [isSetupPhase, timerMinutes, timeLeft, submitting, handleSubmitExam, isPauseModalOpen, examMode]);

  // Resume Saved Session Handler
  function handleResumeSavedSession() {
    if (!savedSessionData) return;

    if (savedSessionData.examMode === "GUIDED_REVIEW") {
      if (
        typeof savedSessionData.guidedReviewToken !== "string" ||
        !savedSessionData.guidedReviewToken.trim()
      ) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        setSavedSessionData(null);
        return;
      }
      setExamQuestions(savedSessionData.examQuestions);
      setSelectedAnswers(savedSessionData.selectedAnswers || {});
      setCheckedAnswers(savedSessionData.checkedAnswers || {});
      setGuidedFeedbackByQuestionId(savedSessionData.guidedFeedbackByQuestionId || {});
      setExamMode("GUIDED_REVIEW");
      setCurrentIndex(savedSessionData.currentIndex || 0);
      setTimerMinutes(0);
      setTimeLeft(0);
      setGuidedReviewToken(savedSessionData.guidedReviewToken.trim());
      setAttemptToken(null);
      setGuidedFinished(false);
      setIsSetupPhase(false);
    } else {
      // SIMULATION
      if (
        typeof savedSessionData.attemptToken !== "string" ||
        !savedSessionData.attemptToken.trim()
      ) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        setSavedSessionData(null);
        return;
      }
      setExamQuestions(savedSessionData.examQuestions);
      setSelectedAnswers(savedSessionData.selectedAnswers || {});
      setCheckedAnswers(savedSessionData.checkedAnswers || {});
      setGuidedFeedbackByQuestionId({});
      setExamMode("SIMULATION");
      setCurrentIndex(savedSessionData.currentIndex || 0);
      setTimerMinutes(savedSessionData.timerMinutes || 0);
      setTimeLeft(savedSessionData.timeLeft || 0);
      setAttemptToken(savedSessionData.attemptToken.trim());
      setGuidedReviewToken(null);
      setGuidedFinished(false);
      setIsSetupPhase(false);
    }
  }

  // 4. Auto-start custom quiz if URL params are present
  useEffect(() => {
    const itemCount = searchParams.get("itemCount");
    const categories = searchParams.get("categories");
    const pool = searchParams.get("pool");
    const mode = searchParams.get("mode");

    if (
      itemCount?.trim() &&
      categories?.trim() &&
      pool?.trim() &&
      mode?.trim()
    ) {
      setIsCustomQuiz(true);
      const modeLabel = mode === "SELF_PACED" ? "Self-Paced" : "Timed";
      setCustomQuizLabel(`${itemCount}-item ${modeLabel} Quiz`);
      // Auto-launch
      void handleStartCustomExam(itemCount, categories, pool, mode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStartCustomExam(
    itemCount: string,
    categories: string,
    pool: string,
    mode: string
  ) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setSavedSessionData(null);
    setAttemptToken(null);
    setGuidedReviewToken(null);
    setGuidedFeedbackByQuestionId({});
    setCheckedAnswers({});
    setSelectedAnswers({});
    setStartingExam(true);

    const isTimed = mode === "TIMED";
    const count = parseInt(itemCount, 10) || 20;
    const mins = isTimed ? Math.ceil((count * 45) / 60) : 0;
    setTimerMinutes(mins);

    try {
      const params = new URLSearchParams({ itemCount, categories, pool, mode });
      const res = await fetch(`/api/exam/start?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.questions && data.questions.length > 0) {
        setExamQuestions(data.questions);
        setAttemptToken(
          typeof data.attemptToken === "string" ? data.attemptToken : null
        );
        setCurrentIndex(0);
        setSelectedAnswers({});
        setTimeLeft(mins * 60);
        setIsSetupPhase(false);
      } else {
        alert("Unable to generate custom quiz questions. Please try again.");
        router.push("/practice/custom");
      }
    } catch (err) {
      console.error("Error starting custom exam:", err);
      alert("Connection error starting exam.");
      router.push("/practice/custom");
    } finally {
      setStartingExam(false);
    }
  }

  // 5. Start New Smart Exam Session (Spaced Repetition Engine)
  async function handleStartExam() {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setSavedSessionData(null);
    setAttemptToken(null);
    setGuidedReviewToken(null);
    setGuidedFeedbackByQuestionId({});
    setCheckedAnswers({});
    setSelectedAnswers({});
    setStartingExam(true);

    const experience = examMode === "GUIDED_REVIEW" ? "GUIDED_REVIEW" : "SIMULATION";

    try {
      const res = await fetch(
        `/api/exam/start?category=${encodeURIComponent(selectedCategory)}&experience=${experience}`
      );

      if (res.status === 402) {
        router.push("/upgrade");
        return;
      }

      const data = await res.json();

      if (res.ok && Array.isArray(data.questions) && data.questions.length > 0) {
        if (examMode === "GUIDED_REVIEW") {
          if (typeof data.guidedReviewToken === "string" && data.guidedReviewToken.trim() && data.attemptToken === null) {
            setExamQuestions(data.questions);
            setGuidedReviewToken(data.guidedReviewToken.trim());
            setAttemptToken(null);
            setGuidedFeedbackByQuestionId({});
            setCheckedAnswers({});
            setSelectedAnswers({});
            setCurrentIndex(0);
            setTimerMinutes(0);
            setTimeLeft(0);
            setIsSetupPhase(false);
          } else {
            console.error("[GUIDED_REVIEW_START] Missing or invalid guided review token:", data);
            alert("Unable to start Guided Review: missing session credential.");
          }
        } else {
          // SIMULATION
          if (typeof data.attemptToken === "string" && data.attemptToken.trim() && data.guidedReviewToken === null) {
            setExamQuestions(data.questions);
            setAttemptToken(data.attemptToken.trim());
            setGuidedReviewToken(null);
            setGuidedFeedbackByQuestionId({});
            setCheckedAnswers({});
            setSelectedAnswers({});
            setCurrentIndex(0);
            const effectiveTimer = timerMinutes;
            setTimeLeft(effectiveTimer * 60);
            setIsSetupPhase(false);
          } else {
            console.error("[EXAM_START] Missing or invalid exam attempt token:", data);
            alert("Unable to start exam: missing exam attempt token.");
          }
        }
      } else {
        alert("Unable to generate exam questions. Please try again.");
      }
    } catch (err) {
      console.error("Error starting exam:", err);
      alert("Connection error starting exam.");
    } finally {
      setStartingExam(false);
    }
  }

  // Save for Later Handler
  function handleSaveAndExit() {
    const questionsToPersist = examQuestions.map((q) => ({
      id: q.id,
      category: q.category,
      subtopic: q.subtopic,
      prompt: q.prompt,
      options: q.options,
      imageUrl: q.imageUrl || null,
      difficulty: q.difficulty,
      tags: q.tags,
    }));

    const activeSession = {
      examMode,
      examQuestions: questionsToPersist,
      selectedAnswers,
      checkedAnswers,
      currentIndex,
      timerMinutes,
      timeLeft,
      attemptToken: examMode === "GUIDED_REVIEW" ? null : attemptToken,
      guidedReviewToken: examMode === "GUIDED_REVIEW" ? guidedReviewToken : null,
      guidedFeedbackByQuestionId: examMode === "GUIDED_REVIEW" ? guidedFeedbackByQuestionId : {},
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(activeSession));
    router.push("/dashboard");
  }

  // Discard & End Exam Handler
  function handleDiscardAndExit() {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setExamQuestions([]);
    setSelectedAnswers({});
    setCheckedAnswers({});
    setGuidedFeedbackByQuestionId({});
    setCurrentIndex(0);
    setSavedSessionData(null);
    setAttemptToken(null);
    setGuidedReviewToken(null);
    setIsSetupPhase(true);
    setIsPauseModalOpen(false);
    router.push("/dashboard");
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (status === "loading") {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
        <DatabaseLoadingIndicator
          title="Verifying access..."
          subtitle="Checking account subscription and permissions."
          skeletonCount={3}
        />
      </div>
    );
  }

  if (status === "unauthenticated" || !user) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
        <DatabaseLoadingIndicator
          title="Redirecting to login..."
          subtitle="Please sign in to access mock exams."
          skeletonCount={2}
        />
      </div>
    );
  }

  if (isPartialOrEmptyCustom) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
        <DatabaseLoadingIndicator
          title="Redirecting to custom quiz builder..."
          subtitle="Incomplete or invalid quiz configuration detected."
          skeletonCount={2}
        />
      </div>
    );
  }

  if (!hasAnyCustomParam && !isPaid) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
        <DatabaseLoadingIndicator
          title="Redirecting to upgrade..."
          subtitle="Standard Practice Mock Exams require an active Pro subscription."
          skeletonCount={2}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
        <DatabaseLoadingIndicator
          title="Assembling Civil Service Mock Exam Pool..."
          subtitle="Querying official question bank, subject categories, and active study sessions."
          skeletonCount={3}
        />
      </div>
    );
  }

  // PHASE 1: SETUP SCREEN
  if (isSetupPhase) {
    return (
      <div className="w-full max-w-2xl mx-auto py-6 sm:py-10 px-2 sm:px-4 space-y-4 sm:space-y-6">
        <div className="flex justify-between items-center">
          <Link
            href="/practice"
            className="text-xs font-extrabold text-blue-400 hover:text-blue-300 transition flex items-center gap-1.5"
          >
            ← Back to Practice & Prep Hub
          </Link>
        </div>

        {savedSessionData && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 border border-amber-500/30 p-6 rounded-3xl space-y-3 shadow-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                {savedSessionData.examMode === "GUIDED_REVIEW" ? "💡 Paused Guided Review" : "⏸️ Unfinished Exam Found"}
              </span>
            </div>
            <h2 className="text-base font-extrabold text-white">
              {savedSessionData.examMode === "GUIDED_REVIEW"
                ? "You have a saved Guided Review session in progress!"
                : "You have a saved exam session in progress!"}
            </h2>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Answered {Object.keys(savedSessionData.selectedAnswers || {}).length} of{" "}
              {savedSessionData.examQuestions?.length || 0} items.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleResumeSavedSession}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                {savedSessionData.examMode === "GUIDED_REVIEW" ? "Resume Guided Review 💡" : "Resume Saved Exam ⚡"}
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem(LOCAL_STORAGE_KEY);
                  setSavedSessionData(null);
                  setAttemptToken(null);
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
              >
                Discard & Start Fresh
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 relative overflow-hidden text-slate-900">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">⏱️</span>
              <h1 className="text-2xl font-black text-slate-900">Configure Mock Exam</h1>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">
              Customize your practice session with smart non-repeating question queue.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Exam Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExamMode("SIMULATION")}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                    examMode === "SIMULATION"
                      ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900">🎯 Simulation Mode</span>
                    {examMode === "SIMULATION" && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-600 text-white">Active</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Real exam conditions. Official score and analytics upon submission.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExamMode("GUIDED_REVIEW");
                    setTimerMinutes(0);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                    examMode === "GUIDED_REVIEW"
                      ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900">💡 Guided Review</span>
                    {examMode === "GUIDED_REVIEW" && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">Active</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Immediate step-by-step explanations and trap alerts per question. Untimed.
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Category
              </label>
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-blue-500 transition cursor-pointer appearance-none shadow-xs"
                >
                  <option value="All" className="bg-white text-slate-900 py-2">
                    All Categories (170 Items - Smart Repetition)
                  </option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="bg-white text-slate-900 py-2">
                      {cat}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs font-bold">
                  ▼
                </div>
              </div>
            </div>

            {examMode === "GUIDED_REVIEW" ? (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-900">Self-Paced Learning</span>
                  <p className="text-[11px] text-emerald-700">Guided Review is untimed so you can review explanations thoroughly.</p>
                </div>
                <span className="text-lg">⏳</span>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Time Limit
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Untimed", value: 0 },
                    { label: "15 Minutes", value: 15 },
                    { label: "30 Minutes", value: 30 },
                    { label: "3 Hours 10 Mins (Official)", value: 190 },
                  ].map((timer) => (
                    <button
                      key={timer.value}
                      type="button"
                      onClick={() => setTimerMinutes(timer.value)}
                      className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-center text-center ${
                        timerMinutes === timer.value
                          ? "border-blue-600 bg-blue-600 text-white font-black shadow-md shadow-blue-600/20"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:text-slate-900 hover:bg-slate-100 shadow-xs"
                      }`}
                    >
                      {timer.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleStartExam}
            disabled={startingExam}
            className={`w-full py-4 disabled:opacity-50 text-white font-black text-sm sm:text-base rounded-2xl transition shadow-lg cursor-pointer flex items-center justify-center gap-2 ${
              examMode === "GUIDED_REVIEW"
                ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30"
                : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/30"
            }`}
          >
            <span>{examMode === "GUIDED_REVIEW" ? "💡" : "🚀"}</span>
            <span>
              {startingExam
                ? "Assembling Smart Exam Pool..."
                : examMode === "GUIDED_REVIEW"
                ? "Start Guided Review"
                : "Start 170-Item Exam"}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // PHASE 1.5: OFFLINE SUBMISSION PENDING SCREEN
  if (offlineBanner) {
    return (
      <div className="w-full max-w-2xl mx-auto py-8 sm:py-12 px-4 space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 text-center">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-3xl flex items-center justify-center text-3xl mx-auto shadow-inner">
            📶
          </div>

          <div className="space-y-2">
            <span className="text-xs font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-full border border-amber-500/20">
              Offline Submission Queued
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Exam Saved Offline
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium max-w-md mx-auto leading-relaxed">
              Exam saved offline. Your submission is queued and will be graded securely when your device reconnects. Your score and detailed review will be available after synchronization.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-left space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
              <span>ℹ️</span>
              <span>Automatic Background Sync</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Once back online, our system will automatically process your answers, update your streaks, and add any missed questions to your Balik-Aral notebook.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href="/dashboard"
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition text-center shadow-md cursor-pointer"
            >
              Back to Dashboard
            </Link>
            <Link
              href="/mock-exam/history"
              className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition text-center cursor-pointer"
            >
              View Exam History
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // PHASE 2: ACTIVE EXAM SCREEN
  if (examQuestions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
        <p className="text-slate-600 dark:text-slate-300 font-semibold">No questions available for this category.</p>
        <button onClick={() => setIsSetupPhase(true)} className="text-blue-600 font-bold hover:underline cursor-pointer">
          Go back to Setup
        </button>
      </div>
    );
  }

  // PHASE 3: GUIDED REVIEW SUMMARY SCREEN (LOCAL ONLY — ZERO SERVER WRITES)
  if (guidedFinished) {
    const totalCount = examQuestions.length;
    const checkedIndices = Object.keys(checkedAnswers).map(Number);
    const correctCount = checkedIndices.filter((idx) => {
      const qId = examQuestions[idx]?.id;
      return qId && guidedFeedbackByQuestionId[qId]?.isCorrect === true;
    }).length;
    const incorrectCount = checkedIndices.filter((idx) => {
      const qId = examQuestions[idx]?.id;
      return qId && guidedFeedbackByQuestionId[qId]?.isCorrect === false;
    }).length;
    const accuracyPercent = checkedIndices.length > 0
      ? Math.round((correctCount / checkedIndices.length) * 100)
      : 0;

    return (
      <div className="w-full max-w-2xl mx-auto py-8 sm:py-12 px-4 space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 text-center">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center text-3xl mx-auto shadow-inner">
            🎓
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-500/20">
              Guided Review Complete
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Study Session Finished!
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium max-w-md mx-auto">
              You reviewed {totalCount} questions with in-depth step-by-step rationalizations, trap alerts, and elimination strategies.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reviewed</span>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</p>
            </div>
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 sm:p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Correct</span>
              <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">{correctCount}</p>
            </div>
            <div className="bg-rose-50/50 dark:bg-rose-950/20 p-3 sm:p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30">
              <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Incorrect</span>
              <p className="text-xl sm:text-2xl font-black text-rose-500 mt-1">{incorrectCount}</p>
            </div>
            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 sm:p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Accuracy</span>
              <p className="text-xl sm:text-2xl font-black text-blue-600 mt-1">{accuracyPercent}%</p>
            </div>
          </div>

          {/* Educational Disclaimer Banner */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-left space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
              <span>ℹ️</span>
              <span>Study Session Information</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Guided Review is strictly an educational study activity. It does not create an official Exam Result, does not modify your Balik-Aral mistake queue, and does not alter your Mock Exam readiness score.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                setGuidedFinished(false);
                setGuidedFeedbackByQuestionId({});
                setCheckedAnswers({});
                setSelectedAnswers({});
                setGuidedReviewToken(null);
                setAttemptToken(null);
                setIsSetupPhase(true);
              }}
              className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition cursor-pointer"
            >
              Start Another Session
            </button>
            <Link
              href="/dashboard"
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-sm text-center cursor-pointer"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = examQuestions[currentIndex];
  const isBookmarked = currentQ ? bookmarkedIds.has(currentQ.id) : false;
  const answeredCount = Object.keys(selectedAnswers).length;
  const progressPercent = Math.round((answeredCount / examQuestions.length) * 100);

  return (
    <div
      className={
        isFocusMode
          ? "fixed inset-0 z-50 bg-slate-950 p-3 sm:p-6 md:p-8 overflow-y-auto w-full flex flex-col justify-start max-w-5xl mx-auto space-y-4"
          : "w-full max-w-5xl mx-auto py-3 sm:py-6 px-2 sm:px-4 md:px-6 space-y-4 sm:space-y-6"
      }
    >
      {/* EXAM SUBMISSION & GRADING FULLSCREEN OVERLAY */}
      <ExamSubmissionLoader isSubmitting={submitting} totalQuestions={examQuestions.length || 170} />

      {/* OFFLINE SUBMISSION SAVED BANNER */}
      {offlineBanner && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-auto px-4">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl px-4 py-3 flex items-start gap-3 shadow-2xl">
            <span className="text-emerald-400 text-base mt-0.5">📶</span>
            <div>
              <p className="text-xs font-extrabold text-emerald-300">Saved offline!</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Your score will sync automatically once you are back online.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOfflineBanner(false)}
              className="ml-auto text-slate-500 hover:text-slate-300 transition text-xs font-bold cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-4 md:p-5 rounded-3xl shadow-lg shadow-blue-600/15 flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-extrabold uppercase px-3 py-1 bg-white/20 text-white rounded-full border border-white/30 backdrop-blur-md">
            {currentQ?.category || "General"}
          </span>
          {examMode === "GUIDED_REVIEW" && (
            <span className="text-xs font-extrabold uppercase px-2.5 py-1 bg-emerald-500/30 text-emerald-200 rounded-full border border-emerald-400/40 backdrop-blur-md flex items-center gap-1">
              <span>💡</span>
              <span>Guided Review</span>
            </span>
          )}
          <span className="text-xs font-bold text-blue-100 hidden sm:inline">
            Item {currentIndex + 1} of {examQuestions.length} ({answeredCount} answered)
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Focus Mode Toggle */}
          <button
            onClick={() => setIsFocusMode((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
              isFocusMode
                ? "bg-amber-400 text-slate-950 shadow-md"
                : "bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/20"
            }`}
            title="Toggle Distraction-Free Exam Mode"
          >
            <span>{isFocusMode ? "🧘 Exit Focus" : "🧘 Focus Mode"}</span>
          </button>

          {/* Font Size Stepper */}
          <div className="hidden sm:flex items-center bg-black/20 backdrop-blur-md rounded-xl p-0.5 border border-white/20 text-xs font-bold">
            <button
              onClick={() => handleFontSizeChange("sm")}
              className={`px-2 py-1 rounded-lg transition ${fontSize === "sm" ? "bg-white text-blue-900 shadow-xs" : "text-white/80 hover:text-white"}`}
              title="Small Text"
            >
              A-
            </button>
            <button
              onClick={() => handleFontSizeChange("md")}
              className={`px-2 py-1 rounded-lg transition ${fontSize === "md" ? "bg-white text-blue-900 shadow-xs" : "text-white/80 hover:text-white"}`}
              title="Normal Text"
            >
              A
            </button>
            <button
              onClick={() => handleFontSizeChange("lg")}
              className={`px-2 py-1 rounded-lg transition ${fontSize === "lg" ? "bg-white text-blue-900 shadow-xs" : "text-white/80 hover:text-white"}`}
              title="Large Text"
            >
              A+
            </button>
          </div>

          {timerMinutes > 0 && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-bold text-xs ${
                timeLeft <= 180
                  ? "border-rose-400 bg-rose-500 text-white animate-pulse"
                  : "border-white/30 bg-white/20 text-white backdrop-blur-md"
              }`}
            >
              <span>⏱</span>
              <span>{formatTime(timeLeft)}</span>
            </div>
          )}

          <button
            onClick={() => setIsPauseModalOpen(true)}
            className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span>⏸️</span>
            <span>Pause / Exit</span>
          </button>
        </div>
      </div>

      {/* VISUAL PROGRESS BAR */}
      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
        <div
          className="bg-blue-600 h-2 transition-all duration-300 ease-out rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* EXAM QUESTION CARD */}
      <div className="bg-white dark:bg-slate-900 shadow-xl shadow-blue-900/5 dark:shadow-none border border-slate-200/90 dark:border-slate-800 rounded-2xl border-t-4 border-t-blue-600 dark:border-t-indigo-500 p-6 space-y-5">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Question #{currentIndex + 1} • {currentQ?.category}
            </span>
            <span className="hidden md:inline-flex items-center text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
              ⌨️ Hotkeys: [A-D] Select, [→/Enter] Next, [←] Prev
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentQ && <FlagQuestionButton questionId={currentQ.id} compact />}
            <button
              onClick={() => currentQ && toggleBookmark(currentQ.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 cursor-pointer ${
                isBookmarked
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-600"
                  : "bg-slate-50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-100"
              }`}
            >
              <span>{isBookmarked ? "🔖 Bookmarked" : "🔖 Bookmark [F]"}</span>
            </button>
          </div>
        </div>

        {/* PROMPT RENDERING WITH HTML TABLE SUPPORT */}
        <div
          className={`font-bold text-slate-800 dark:text-slate-100 leading-relaxed overflow-x-auto ${
            fontSize === "sm" ? "text-base" : fontSize === "lg" ? "text-xl" : "text-lg"
          }`}
          dangerouslySetInnerHTML={{ __html: formatPromptHTML(currentQ?.prompt || "") }}
        />

        {/* CHART / GRAPH IMAGE DISPLAY */}
        {currentQ?.imageUrl && (
          <div className="my-4 flex justify-center bg-slate-50 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <img
              src={currentQ.imageUrl}
              alt="Question Diagram or Chart"
              loading="lazy"
              decoding="async"
              className="max-h-64 object-contain rounded-xl shadow-sm"
            />
          </div>
        )}

        <div className="space-y-3">
          {currentQ?.options.map((opt, idx) => {
            const isSelected = selectedAnswers[currentIndex] === idx;
            const letterLabel = ["A", "B", "C", "D"][idx] || String(idx + 1);
            const isGuided = examMode === "GUIDED_REVIEW";
            const isChecked = isGuided && !!checkedAnswers[currentIndex];
            const feedback = currentQ ? guidedFeedbackByQuestionId[currentQ.id] : undefined;
            const isCorrect = isGuided ? feedback?.answerIndex === idx : false;

            let optionStyle = isSelected
              ? "border-blue-600 bg-blue-50/50 text-blue-900 font-bold"
              : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 bg-slate-50/50";

            if (isChecked) {
              if (isCorrect) {
                optionStyle = "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 font-bold ring-1 ring-emerald-500/30 cursor-default";
              } else if (isSelected) {
                optionStyle = "border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 font-bold ring-1 ring-rose-500/30 cursor-default";
              } else {
                optionStyle = "border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 bg-slate-50/30 dark:bg-slate-900/30 opacity-60 cursor-default";
              }
            }

            return (
              <button
                key={idx}
                disabled={isChecked || checkingAnswer}
                onClick={() => handleSelectOption(idx)}
                className={`w-full text-left p-4 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                  fontSize === "sm" ? "text-xs sm:text-sm" : fontSize === "lg" ? "text-base sm:text-lg" : "text-sm"
                } ${optionStyle}`}
              >
                <div className="flex items-center gap-2">
                  <span className="hidden md:inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-xs font-bold">
                    {letterLabel}
                  </span>
                  <span>{cleanMathText(opt)}</span>
                </div>
                <div className="shrink-0">
                  {isChecked ? (
                    isCorrect ? (
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                        ✓
                      </span>
                    ) : isSelected ? (
                      <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                        ✕
                      </span>
                    ) : null
                  ) : (
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                      }`}
                    >
                      {isSelected && <span className="text-xs">✓</span>}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* GUIDED REVIEW CHECK ANSWER BUTTON & EDUCATIONAL EXPLANATIONS */}
        {examMode === "GUIDED_REVIEW" && (
          <div className="space-y-4 pt-1">
            {!checkedAnswers[currentIndex] ? (
              <button
                type="button"
                onClick={handleCheckAnswer}
                disabled={selectedAnswers[currentIndex] === undefined || checkingAnswer}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🔍</span>
                <span>
                  {checkingAnswer
                    ? "Checking Answer with Server..."
                    : selectedAnswers[currentIndex] === undefined
                    ? "Select an answer above to check"
                    : "Check Answer"}
                </span>
              </button>
            ) : (() => {
              const currentFeedback = currentQ ? guidedFeedbackByQuestionId[currentQ.id] : undefined;
              if (!currentFeedback) return null;

              return (
                <div className="space-y-4">
                  <QuestionResultBanner
                    isCorrect={currentFeedback.isCorrect}
                    correctLetter={currentFeedback.correctLetter}
                    correctText={currentFeedback.correctText}
                    isSkipped={selectedAnswers[currentIndex] === undefined}
                  />
                  <ExplanationPanel
                    explanation={currentFeedback.explanation || undefined}
                    stepByStep={currentFeedback.stepByStep}
                    whyA={currentFeedback.whyA}
                    whyB={currentFeedback.whyB}
                    whyC={currentFeedback.whyC}
                    whyD={currentFeedback.whyD}
                    eliminationStrategy={currentFeedback.eliminationStrategy}
                    commonTrap={currentFeedback.commonTrap}
                    examTip={currentFeedback.examTip}
                    options={currentQ?.options}
                    correctIndex={currentFeedback.answerIndex}
                  />
                </div>
              );
            })()}
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition disabled:opacity-40 cursor-pointer"
          >
            Previous
          </button>

          {examMode === "GUIDED_REVIEW" ? (
            currentIndex < examQuestions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex((prev) => Math.min(examQuestions.length - 1, prev + 1))}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <span>Next Question</span>
                <span>→</span>
              </button>
            ) : Object.keys(checkedAnswers).length === examQuestions.length ? (
              <button
                onClick={() => {
                  localStorage.removeItem(LOCAL_STORAGE_KEY);
                  setGuidedFinished(true);
                }}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <span>Finish Guided Review</span>
                <span>🏁</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  const firstUnchecked = examQuestions.findIndex((_, idx) => !checkedAnswers[idx]);
                  if (firstUnchecked !== -1) setCurrentIndex(firstUnchecked);
                }}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <span>Check Remaining Items ({Object.keys(checkedAnswers).length}/{examQuestions.length})</span>
                <span>→</span>
              </button>
            )
          ) : currentIndex < examQuestions.length - 1 ? (
            <button
              onClick={() => setCurrentIndex((prev) => Math.min(examQuestions.length - 1, prev + 1))}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition shadow-sm cursor-pointer"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmitExam}
              disabled={submitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Submitting..." : "Submit Exam"}
            </button>
          )}
        </div>
      </div>

      {/* PAUSE / EXIT MODAL OVERLAY */}
      {isPauseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 shadow-xl shadow-blue-900/5 dark:shadow-none border border-slate-200/90 dark:border-slate-800 rounded-2xl border-t-4 border-t-blue-600 dark:border-t-indigo-500 p-6 space-y-6 max-w-md w-full">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-2xl mx-auto">
                ⏸️
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Pause or Exit Exam?
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Your exam timer is currently paused. What would you like to do?
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleSaveAndExit}
                className="w-full p-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-2xl transition shadow-md flex items-center justify-between cursor-pointer"
              >
                <div className="text-left">
                  <p className="font-extrabold">💾 Save & Exit for Later</p>
                  <p className="text-[11px] text-blue-100 font-normal">
                    Save current answers & timer. Resume from Dashboard anytime.
                  </p>
                </div>
                <span>→</span>
              </button>

              <button
                onClick={handleDiscardAndExit}
                className="w-full p-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-sm rounded-2xl transition flex items-center justify-between cursor-pointer"
              >
                <div className="text-left">
                  <p className="font-extrabold">🛑 Discard & Exit</p>
                  <p className="text-[11px] text-rose-500 font-normal">
                    Clear progress and return to dashboard.
                  </p>
                </div>
                <span>→</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                onClick={() => setIsPauseModalOpen(false)}
                className="px-5 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-100 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                ← Resume Exam Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TakeExamPage() {
  return (
    <Suspense fallback={
      <div className="w-full py-20 text-center font-bold text-slate-400 animate-pulse">
        Preparing your exam...
      </div>
    }>
      <TakeExamPageInner />
    </Suspense>
  );
}
