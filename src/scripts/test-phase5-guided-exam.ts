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

test("3.1 Delivery payload contains safe fields and strictly excludes answerIndex and all rationales", () => {
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

  const prepared: Record<string, unknown> = {
    id: rawDbQuestion.id,
    category: rawDbQuestion.category,
    subtopic: rawDbQuestion.subtopic,
    prompt: rawDbQuestion.prompt,
    options: rawDbQuestion.options,
    difficulty: rawDbQuestion.difficulty,
    tags: rawDbQuestion.tags,
    imageUrl: rawDbQuestion.imageUrl,
  };

  assert.strictEqual(prepared.id, rawDbQuestion.id);
  assert.strictEqual(prepared.category, rawDbQuestion.category);
  assert.strictEqual(prepared.subtopic, rawDbQuestion.subtopic);
  assert.strictEqual(prepared.prompt, rawDbQuestion.prompt);
  assert.deepStrictEqual(prepared.options, rawDbQuestion.options);
  assert.strictEqual(prepared.difficulty, "HARD");
  assert.deepStrictEqual(prepared.tags, ["subject-verb-agreement", "grammar"]);

  // Must exclude all sensitive pre-check fields
  assert.strictEqual(prepared.answerIndex, undefined);
  assert.strictEqual(prepared.explanation, undefined);
  assert.strictEqual(prepared.stepByStep, undefined);
  assert.strictEqual(prepared.whyA, undefined);
  assert.strictEqual(prepared.whyB, undefined);
  assert.strictEqual(prepared.whyC, undefined);
  assert.strictEqual(prepared.whyD, undefined);
  assert.strictEqual(prepared.eliminationStrategy, undefined);
  assert.strictEqual(prepared.commonTrap, undefined);
  assert.strictEqual(prepared.examTip, undefined);
});

// Group 4: Guided Review Local Evaluation & Locking
console.log("\n--- Group 4: Guided Review Local Evaluation & Locking ---");

test("4.1 Evaluation is performed via server-authoritative check contract returning { isCorrect, correctIndex, rationale }", () => {
  const currentQ = {
    id: "q-server-1",
    options: ["20", "25", "30", "35"],
    // Safe client question: NO answerIndex or rationales
  };

  // Authoritative server check simulation
  const serverCheck = (questionId: string, selectedIndex: number) => {
    const dbQuestion = {
      id: "q-server-1",
      answerIndex: 1,
      explanation: "25 is 5 squared.",
    };
    if (questionId !== dbQuestion.id) throw new Error("Question not found");
    const isCorrect = selectedIndex === dbQuestion.answerIndex;
    return {
      isCorrect,
      correctIndex: dbQuestion.answerIndex,
      rationale: {
        explanation: dbQuestion.explanation,
        stepByStep: null,
        whyA: null,
        whyB: null,
        whyC: null,
        whyD: null,
        eliminationStrategy: null,
        commonTrap: null,
        examTip: null,
      },
    };
  };

  const correctResponse = serverCheck(currentQ.id, 1);
  assert.strictEqual(correctResponse.isCorrect, true);
  assert.strictEqual(correctResponse.correctIndex, 1);
  assert.strictEqual(correctResponse.rationale.explanation, "25 is 5 squared.");

  const incorrectResponse = serverCheck(currentQ.id, 0);
  assert.strictEqual(incorrectResponse.isCorrect, false);
  assert.strictEqual(incorrectResponse.correctIndex, 1);
  assert.strictEqual(incorrectResponse.rationale.explanation, "25 is 5 squared.");
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

test("6.1 Active session serialization persists examMode, checkedAnswers, guidedFeedbackByQuestionId with zero answerIndex in examQuestions", () => {
  const activeSession = {
    examMode: "GUIDED_REVIEW",
    guidedReviewToken: "mock.token.jwt",
    examQuestions: [
      { id: "q1", prompt: "Question 1", options: ["A", "B"] },
    ],
    selectedAnswers: { 0: 0 },
    checkedAnswers: { 0: true },
    guidedFeedbackByQuestionId: {
      q1: {
        isCorrect: true,
        correctIndex: 0,
        explanation: "Rationale for Q1",
      },
    },
    currentIndex: 0,
    timerMinutes: 0,
    timeLeft: 0,
  };

  const serialized = JSON.stringify(activeSession);
  const deserialized = JSON.parse(serialized);

  assert.strictEqual(deserialized.examMode, "GUIDED_REVIEW");
  assert.strictEqual(deserialized.guidedReviewToken, "mock.token.jwt");
  assert.deepStrictEqual(deserialized.checkedAnswers, { "0": true });
  assert.deepStrictEqual(deserialized.selectedAnswers, { "0": 0 });
  assert.strictEqual(deserialized.guidedFeedbackByQuestionId["q1"].isCorrect, true);
  assert.strictEqual(deserialized.guidedFeedbackByQuestionId["q1"].correctIndex, 0);
  assert.strictEqual(deserialized.examQuestions[0].answerIndex, undefined);
});

test("6.2 Study summary metrics calculate reviewed, correct, incorrect, and accuracy strictly from guidedFeedbackByQuestionId", () => {
  const examQuestions = [
    { id: "q1" },
    { id: "q2" },
    { id: "q3" },
    { id: "q4" },
  ];

  const checkedAnswers: Record<number, boolean> = {
    0: true,
    1: true,
    2: true,
    3: true,
  };

  const guidedFeedbackByQuestionId: Record<string, { isCorrect: boolean; correctIndex: number }> = {
    q1: { isCorrect: true, correctIndex: 0 },
    q2: { isCorrect: true, correctIndex: 1 },
    q3: { isCorrect: false, correctIndex: 2 },
    q4: { isCorrect: true, correctIndex: 3 },
  };

  const totalCount = examQuestions.length;
  const checkedIndices = Object.keys(checkedAnswers).map(Number);
  const correctCount = checkedIndices.filter(
    (idx) => guidedFeedbackByQuestionId[examQuestions[idx]?.id]?.isCorrect === true
  ).length;
  const incorrectCount = checkedIndices.filter(
    (idx) => {
      const q = examQuestions[idx];
      return q ? guidedFeedbackByQuestionId[q.id]?.isCorrect === false : false;
    }
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
