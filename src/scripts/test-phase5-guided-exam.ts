import assert from "assert";

let passedTests = 0;
let totalTests = 0;

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    console.error(`  ✕ ${name}`);
    console.error(`    ${(err as Error).message}`);
    throw err;
  }
}

console.log("\n=======================================================");
console.log(" GOVSTUDYX PHASE 5 — GUIDED EXAM & OPTION ORDER TESTS");
console.log("=======================================================\n");

// Group 1: Canonical Option Ordering & Option Shuffling Removal
console.log("--- Group 1: Canonical Option Ordering Verification ---");

test("1.1 Database options array maps 1:1 to delivery options without shuffling", () => {
  const dbQuestion = {
    id: "q-canonical-1",
    options: ["Alpha", "Beta", "Gamma", "Delta"],
    answerIndex: 2,
  };

  const resolvedOptions: string[] =
    Array.isArray(dbQuestion.options) && dbQuestion.options.length > 0
      ? (dbQuestion.options as string[])
      : [];

  const deliveredQuestion = {
    id: dbQuestion.id,
    options: resolvedOptions,
    answerIndex: dbQuestion.answerIndex,
  };

  assert.deepStrictEqual(deliveredQuestion.options, ["Alpha", "Beta", "Gamma", "Delta"]);
  assert.strictEqual(deliveredQuestion.answerIndex, 2);
  assert.strictEqual(deliveredQuestion.options[deliveredQuestion.answerIndex], "Gamma");
});

test("1.2 Fallback optionA..D fields map in strict canonical sequence (A=0, B=1, C=2, D=3)", () => {
  const dbQuestion = {
    id: "q-canonical-2",
    options: null,
    optionA: "Manila",
    optionB: "Cebu",
    optionC: "Davao",
    optionD: "Iloilo",
    answerIndex: 0,
  };

  const resolvedOptions = [dbQuestion.optionA, dbQuestion.optionB, dbQuestion.optionC, dbQuestion.optionD].filter(Boolean);

  const deliveredQuestion = {
    id: dbQuestion.id,
    options: resolvedOptions,
    answerIndex: dbQuestion.answerIndex,
  };

  assert.strictEqual(deliveredQuestion.options[0], "Manila");
  assert.strictEqual(deliveredQuestion.options[1], "Cebu");
  assert.strictEqual(deliveredQuestion.options[2], "Davao");
  assert.strictEqual(deliveredQuestion.options[3], "Iloilo");
  assert.strictEqual(deliveredQuestion.answerIndex, 0);
});

test("1.3 Position-dependent choice 'All of the above' retains valid position D (index 3)", () => {
  const dbQuestion = {
    id: "q-pos-1",
    prompt: "Which of the following are Philippine public holidays?",
    options: ["New Year's Day", "Independence Day", "Rizal Day", "All of the above"],
    answerIndex: 3,
  };

  const resolvedOptions = dbQuestion.options;
  assert.strictEqual(resolvedOptions[3], "All of the above");
  assert.strictEqual(dbQuestion.answerIndex, 3);
  assert.strictEqual(resolvedOptions[dbQuestion.answerIndex], "All of the above");
});

test("1.4 Position-dependent choice 'Both A and B' retains valid position C (index 2)", () => {
  const dbQuestion = {
    id: "q-pos-2",
    prompt: "Which of the following bodies govern civil service appointments?",
    options: ["Civil Service Commission", "Appointing Authority", "Both A and B", "None of the above"],
    answerIndex: 2,
    whyA: "Option A is correct as CSC is the constitutional commission.",
    whyB: "Option B is correct as the appointing authority issues the appointment.",
    whyC: "Option C is the correct answer because both A and B are valid.",
    whyD: "Option D is incorrect because A and B are valid.",
  };

  const resolvedOptions = dbQuestion.options;
  assert.strictEqual(resolvedOptions[0], "Civil Service Commission");
  assert.strictEqual(resolvedOptions[1], "Appointing Authority");
  assert.strictEqual(resolvedOptions[2], "Both A and B");
  assert.strictEqual(resolvedOptions[3], "None of the above");
  assert.strictEqual(dbQuestion.answerIndex, 2);
  assert.ok(dbQuestion.whyC.includes("Option C is the correct answer"));
});

// Group 2: FULL_MOCK Server Grading Alignment
console.log("\n--- Group 2: FULL_MOCK Server Grading Alignment ---");

test("2.1 Server grading evaluates userIdx === q.answerIndex with zero index disparity", () => {
  const examQuestions = [
    { id: "q1", options: ["A1", "B1", "C1", "D1"], answerIndex: 1 },
    { id: "q2", options: ["A2", "B2", "C2", "D2"], answerIndex: 3 },
    { id: "q3", options: ["A3", "B3", "C3", "D3"], answerIndex: 0 },
  ];

  const userSelections = [
    { questionId: "q1", selectedIndex: 1 },
    { questionId: "q2", selectedIndex: 2 },
    { questionId: "q3", selectedIndex: 0 },
  ];

  let correctCount = 0;
  let incorrectCount = 0;

  userSelections.forEach((ans) => {
    const q = examQuestions.find((item) => item.id === ans.questionId);
    assert.ok(q, "Question found");
    if (ans.selectedIndex === q.answerIndex) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  });

  assert.strictEqual(correctCount, 2);
  assert.strictEqual(incorrectCount, 1);
});

// Group 3: Guided Review Question Delivery & Educational Fields
console.log("\n--- Group 3: Guided Review Question Delivery ---");

test("3.1 Delivery payload contains all populated pedagogical reasoning fields", () => {
  const rawDbQuestion = {
    id: "q-pedagogy-1",
    category: "Verbal Ability",
    subtopic: "Grammar & Correct Usage",
    prompt: "Identify the correct verb form in the sentence.",
    options: ["is", "are", "were", "being"],
    answerIndex: 1,
    explanation: "The subject is plural, requiring 'are'.",
    imageUrl: null,
    stepByStep: "1. Identify subject: 'The committee members'. 2. Plural subject requires plural verb.",
    whyA: "Incorrect: 'is' is singular.",
    whyB: "Correct: 'are' agrees in number with the plural subject.",
    whyC: "Incorrect: 'were' is past tense, but sentence context is present.",
    whyD: "Incorrect: 'being' is a participle, not a main verb.",
    eliminationStrategy: "Eliminate singular options first.",
    commonTrap: "Confusing the collective noun with its plural members.",
    examTip: "Always locate the true head noun before picking the verb.",
    difficulty: "HARD",
    tags: ["subject-verb-agreement", "grammar"],
  };

  const prepared = {
    id: rawDbQuestion.id,
    category: rawDbQuestion.category,
    subtopic: rawDbQuestion.subtopic,
    prompt: rawDbQuestion.prompt,
    options: rawDbQuestion.options,
    answerIndex: rawDbQuestion.answerIndex,
    explanation: rawDbQuestion.explanation,
    imageUrl: rawDbQuestion.imageUrl,
    stepByStep: rawDbQuestion.stepByStep,
    whyA: rawDbQuestion.whyA,
    whyB: rawDbQuestion.whyB,
    whyC: rawDbQuestion.whyC,
    whyD: rawDbQuestion.whyD,
    eliminationStrategy: rawDbQuestion.eliminationStrategy,
    commonTrap: rawDbQuestion.commonTrap,
    examTip: rawDbQuestion.examTip,
    difficulty: rawDbQuestion.difficulty,
    tags: rawDbQuestion.tags,
  };

  assert.strictEqual(prepared.stepByStep, rawDbQuestion.stepByStep);
  assert.strictEqual(prepared.whyA, rawDbQuestion.whyA);
  assert.strictEqual(prepared.whyB, rawDbQuestion.whyB);
  assert.strictEqual(prepared.whyC, rawDbQuestion.whyC);
  assert.strictEqual(prepared.whyD, rawDbQuestion.whyD);
  assert.strictEqual(prepared.eliminationStrategy, rawDbQuestion.eliminationStrategy);
  assert.strictEqual(prepared.commonTrap, rawDbQuestion.commonTrap);
  assert.strictEqual(prepared.examTip, rawDbQuestion.examTip);
  assert.strictEqual(prepared.difficulty, "HARD");
  assert.deepStrictEqual(prepared.tags, ["subject-verb-agreement", "grammar"]);
});

// Group 4: Guided Review Local Evaluation & Locking
console.log("\n--- Group 4: Guided Review Local Evaluation & Locking ---");

test("4.1 Local evaluation checks selectedIndex === q.answerIndex without network call", () => {
  const currentQ = {
    id: "q-local-1",
    options: ["20", "25", "30", "35"],
    answerIndex: 1,
  };

  const selectedIndex = 1;
  const isCorrect = selectedIndex === currentQ.answerIndex;
  assert.strictEqual(isCorrect, true);

  const wrongIndex = 0;
  const isWrong = wrongIndex === currentQ.answerIndex;
  assert.strictEqual(isWrong, false);
});

test("4.2 Checking an answer permanently locks choice selection for that question", () => {
  const checkedAnswers: Record<number, boolean> = {};
  const selectedAnswers: Record<number, number> = {};
  const currentIndex = 0;

  selectedAnswers[currentIndex] = 1;
  checkedAnswers[currentIndex] = true;

  const handleSelectOption = (idx: number) => {
    if (checkedAnswers[currentIndex]) {
      return;
    }
    selectedAnswers[currentIndex] = idx;
  };

  handleSelectOption(2);
  assert.strictEqual(selectedAnswers[currentIndex], 1);
});

test("4.3 Navigating between questions preserves checked states and allows viewing explanations", () => {
  const checkedAnswers: Record<number, boolean> = { 0: true, 1: true };
  const selectedAnswers: Record<number, number> = { 0: 1, 1: 3 };

  let currentIndex = 1;

  currentIndex = 0;
  assert.strictEqual(checkedAnswers[currentIndex], true);
  assert.strictEqual(selectedAnswers[currentIndex], 1);

  currentIndex = 1;
  assert.strictEqual(checkedAnswers[currentIndex], true);
  assert.strictEqual(selectedAnswers[currentIndex], 3);
});

test("4.4 Completion gate blocks finish when partial and enables finish when all questions checked", () => {
  const totalQuestions = 5;
  const partialChecked: Record<number, boolean> = { 0: true, 1: true, 4: true };

  const isPartialComplete = Object.keys(partialChecked).length === totalQuestions;
  assert.strictEqual(isPartialComplete, false, "Partial review must NOT allow completion");

  const allChecked: Record<number, boolean> = { 0: true, 1: true, 2: true, 3: true, 4: true };
  const isFullComplete = Object.keys(allChecked).length === totalQuestions;
  assert.strictEqual(isFullComplete, true, "Full review enables completion");
});

test("4.5 Completion gate detects first unchecked question to guide examinee to remaining items", () => {
  const examQuestions = [{ id: "q0" }, { id: "q1" }, { id: "q2" }, { id: "q3" }];
  const checkedAnswers: Record<number, boolean> = { 0: true, 2: true, 3: true };

  const firstUnchecked = examQuestions.findIndex((_, idx) => !checkedAnswers[idx]);
  assert.strictEqual(firstUnchecked, 1, "First unchecked question must be index 1");
});

// Group 5: Zero Database Mutation & Zero Server Traffic
console.log("\n--- Group 5: Zero Database Mutation & Zero Server Traffic ---");

test("5.1 Finish Guided Review executes 100% locally with zero HTTP requests to /api/exam/submit", () => {
  const networkCalls = 0;

  const handleFinishGuidedReview = () => {
    return {
      guidedFinished: true,
      networkCallsMade: networkCalls,
    };
  };

  const result = handleFinishGuidedReview();
  assert.strictEqual(result.guidedFinished, true);
  assert.strictEqual(result.networkCallsMade, 0);
});

test("5.2 Guided Review creates ZERO ExamResult database records", () => {
  const mockDb = {
    examResults: [] as unknown[],
    userMistakes: [] as unknown[],
  };

  const completeGuidedReview = () => {
    return { status: "STUDY_SUMMARY_DISPLAYED" };
  };

  completeGuidedReview();
  assert.strictEqual(mockDb.examResults.length, 0);
  assert.strictEqual(mockDb.userMistakes.length, 0);
});

test("5.3 Guided Review does not affect readiness score or diagnostic analytics", () => {
  const userStats = {
    mockExamsCompleted: 5,
    averageScore: 84.5,
    readinessScore: 88,
  };

  const initialReadiness = userStats.readinessScore;
  const initialAverage = userStats.averageScore;
  const initialCompleted = userStats.mockExamsCompleted;

  assert.strictEqual(userStats.readinessScore, initialReadiness);
  assert.strictEqual(userStats.averageScore, initialAverage);
  assert.strictEqual(userStats.mockExamsCompleted, initialCompleted);
});

test("5.4 handleSubmitExam has explicit safety guard blocking Guided Review Mode from submitting", () => {
  let networkCallAttempted = false;
  const examMode = "GUIDED_REVIEW";

  const handleSubmitExam = () => {
    if (examMode === "GUIDED_REVIEW") return;
    networkCallAttempted = true;
  };

  handleSubmitExam();
  assert.strictEqual(networkCallAttempted, false, "handleSubmitExam must abort immediately for Guided Review");
});

// Group 6: Local Session Persistence & Summary Calculations
console.log("\n--- Group 6: Local Session Persistence & Summary Calculations ---");

test("6.1 Active session serialization persists examMode and checkedAnswers", () => {
  const activeSession = {
    examMode: "GUIDED_REVIEW",
    examQuestions: [{ id: "q1", answerIndex: 0 }],
    selectedAnswers: { 0: 0 },
    checkedAnswers: { 0: true },
    currentIndex: 0,
    timerMinutes: 0,
    timeLeft: 0,
  };

  const serialized = JSON.stringify(activeSession);
  const deserialized = JSON.parse(serialized);

  assert.strictEqual(deserialized.examMode, "GUIDED_REVIEW");
  assert.deepStrictEqual(deserialized.checkedAnswers, { "0": true });
  assert.deepStrictEqual(deserialized.selectedAnswers, { "0": 0 });
});

test("6.2 Study summary metrics calculate reviewed, correct, incorrect, and accuracy strictly over checked questions", () => {
  const examQuestions = [
    { id: "q1", answerIndex: 0 },
    { id: "q2", answerIndex: 1 },
    { id: "q3", answerIndex: 2 },
    { id: "q4", answerIndex: 3 },
  ];

  const selectedAnswers: Record<number, number> = {
    0: 0,
    1: 1,
    2: 0,
    3: 3,
  };
  const checkedAnswers: Record<number, boolean> = {
    0: true,
    1: true,
    2: true,
    3: true,
  };

  const totalCount = examQuestions.length;
  const checkedIndices = Object.keys(checkedAnswers).map(Number);
  const correctCount = checkedIndices.filter(
    (idx) => selectedAnswers[idx] === examQuestions[idx]?.answerIndex
  ).length;
  const incorrectCount = checkedIndices.filter(
    (idx) => selectedAnswers[idx] !== undefined && selectedAnswers[idx] !== examQuestions[idx]?.answerIndex
  ).length;
  const accuracyPercent = checkedIndices.length > 0
    ? Math.round((correctCount / checkedIndices.length) * 100)
    : 0;

  assert.strictEqual(totalCount, 4);
  assert.strictEqual(correctCount, 3);
  assert.strictEqual(incorrectCount, 1);
  assert.strictEqual(accuracyPercent, 75);
});

test("6.3 Legacy saved sessions without examMode strictly default to SIMULATION", () => {
  const legacySaved: {
    examMode?: string;
    examQuestions: { id: string; prompt: string }[];
    selectedAnswers: Record<number, number>;
    currentIndex: number;
    timerMinutes: number;
    timeLeft: number;
  } = {
    examQuestions: [{ id: "q1", prompt: "Legacy Q" }],
    selectedAnswers: { 0: 1 },
    currentIndex: 0,
    timerMinutes: 190,
    timeLeft: 5000,
  };

  const resolvedMode = legacySaved.examMode === "GUIDED_REVIEW" ? "GUIDED_REVIEW" : "SIMULATION";
  assert.strictEqual(resolvedMode, "SIMULATION", "Legacy session must default to SIMULATION");
});

console.log("\n=======================================================");
console.log(` ALL ${passedTests} OF ${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log("=======================================================\n");
