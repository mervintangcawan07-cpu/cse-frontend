import { CoreSubject, Question, ErrorReviewItem, LiveDrillParticipant } from "@/types/cse";

/**
 * Balanced Subtopic Randomization Engine
 * Evenly selects questions across all subtopics under a selected Core Subject.
 */
export function selectBalancedDrillQuestions(
  allQuestions: Question[],
  subject: CoreSubject,
  targetCount: number
): Question[] {
  // 1. Filter questions matching the Core Subject
  const subjectQuestions = allQuestions.filter((q) => q.category === subject);
  if (subjectQuestions.length === 0) return [];

  // 2. Group available questions by subtopic
  const subtopicMap: Record<string, Question[]> = {};
  subjectQuestions.forEach((q) => {
    if (!subtopicMap[q.subtopic]) subtopicMap[q.subtopic] = [];
    subtopicMap[q.subtopic].push(q);
  });

  const subtopics = Object.keys(subtopicMap);
  if (subtopics.length === 0) return [];

  // 3. Calculate base questions per subtopic and remainder
  const numSubtopics = subtopics.length;
  const basePerSubtopic = Math.floor(targetCount / numSubtopics);
  let remainder = targetCount % numSubtopics;

  // Shuffle subtopics to distribute remainder fairly
  const shuffledSubtopics = [...subtopics].sort(() => Math.random() - 0.5);

  const selectedQuestions: Question[] = [];

  for (const subtopic of shuffledSubtopics) {
    const quota = basePerSubtopic + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;

    // Shuffle questions within subtopic
    const pool = [...subtopicMap[subtopic]].sort(() => Math.random() - 0.5);
    const chosen = pool.slice(0, quota);
    selectedQuestions.push(...chosen);
  }

  // 4. Shuffle the final question array so subtopics are mixed uniformly
  return selectedQuestions.sort(() => Math.random() - 0.5);
}

/**
 * Score & Speed Leaderboard Calculator
 * Calculates score taking speed and accuracy into account.
 */
export function calculateLiveDrillScore(
  participant: LiveDrillParticipant,
  questions: Question[],
  totalTimeSeconds: number
): number {
  let correctCount = 0;
  let totalSpeedBonus = 0;

  questions.forEach((q, idx) => {
    const selectedOption = participant.answers[idx];
    if (selectedOption === q.correctAnswer) {
      correctCount++;
      const timeSpent = participant.responseTimes[idx] || 0;
      // Bonus points for fast correct answers (max 50 bonus points per question)
      const speedFactor = Math.max(0, 30 - timeSpent);
      totalSpeedBonus += Math.floor(speedFactor * 1.5);
    }
  });

  const baseScore = correctCount * 100;
  return baseScore + totalSpeedBonus;
}

/**
 * Mock Generator for Group Error Review Analytics
 */
export function generateGroupErrorAnalytics(questions: Question[]): ErrorReviewItem[] {
  return questions.map((q) => ({
    questionId: q.id,
    prompt: q.prompt,
    subtopic: q.subtopic,
    totalAttempts: 142,
    incorrectPercentage: Math.floor(Math.random() * 35) + 45, // 45% - 80% incorrect
    optionDistribution: {
      0: 12,
      1: 68, // Common trap option
      2: 15,
      3: 5,
    },
    correctAnswerIndex: q.correctAnswer,
    correctAnswerText: q.options[q.correctAnswer] || "Option A",
    stepByStepSolution:
      q.explanation ||
      "Analyze the core condition step-by-step. Eliminate choices that violate civil service standards.",
    legalReference: q.legalReference || "RA 6713 - Code of Conduct and Ethical Standards",
  }));
}
