import { CoreSubject, Question, LeaderboardEntry } from "../types/cse";

export const SAMPLE_QUESTION_BANK: Question[] = [
  {
    id: "q-num-1",
    category: "Numerical Reasoning",
    subtopic: "Word Problems",
    prompt: "A disaster response van leaves the central office at 7:00 AM and arrives at a flooded municipality 210 kilometers away at 10:30 AM. What was the average speed of the van in kilometers per hour?",
    options: ["55 km/h", "60 km/h", "65 km/h", "70 km/h"],
    correctAnswer: 1,
    explanation: "Time elapsed = 3.5 hours. Speed = Distance / Time = 210 / 3.5 = 60 km/h."
  },
  {
    id: "q-num-2",
    category: "Numerical Reasoning",
    subtopic: "Data Interpretation",
    prompt: "A municipal budget allocates 35% to Social Services, 25% to Infrastructure, 20% to Health, and ?4,000,000 to Environment. What is the total municipal budget?",
    options: ["?15,000,000", "?18,000,000", "?20,000,000", "?25,000,000"],
    correctAnswer: 2,
    explanation: "Remaining percentage for Environment = 100% - (35% + 25% + 20%) = 20%. Total Budget = ?4,000,000 / 0.20 = ?20,000,000."
  },
  {
    id: "q-verb-1",
    category: "Verbal Ability",
    subtopic: "Grammar Errors",
    prompt: 'Which part of the following sentence contains a grammatical error: "(A) The regional director (B) along with several field officers (C) are planning to inspect (D) the disaster relief centers tomorrow."?',
    options: ["A", "B", "C", "D"],
    correctAnswer: 2,
    explanation: "Subject is 'regional director' (singular). Verb should be 'is planning', not 'are planning'."
  },
  {
    id: "q-gen-1",
    category: "General Information & PH Constitution",
    subtopic: "RA 6713",
    prompt: "Under RA 6713 (Code of Conduct and Ethical Standards for Public Officials and Employees), within how many days must public officials respond to letters and requests sent by the public?",
    options: ["5 working days", "10 working days", "15 working days", "30 working days"],
    correctAnswer: 2,
    explanation: "Section 5(a) of RA 6713 mandates that public officials respond to requests within 15 working days from receipt.",
    legalReference: "RA 6713, Section 5(a)"
  }
];

/**
 * Even Subtopic Randomization Engine
 * Fetches random questions evenly divided across all subtopics matching host categories.
 */
export function getBalancedEventQuestions(
  categories: CoreSubject[],
  targetCount: number,
  bank: Question[] = SAMPLE_QUESTION_BANK
): Question[] {
  const filtered = bank.filter((q) => categories.includes(q.category));
  if (filtered.length === 0) return bank.slice(0, targetCount);

  // Group by subtopic
  const subtopicMap: Record<string, Question[]> = {};
  filtered.forEach((q) => {
    if (!subtopicMap[q.subtopic]) subtopicMap[q.subtopic] = [];
    subtopicMap[q.subtopic].push(q);
  });

  const subtopics = Object.keys(subtopicMap);
  const basePerSubtopic = Math.floor(targetCount / subtopics.length);
  let remainder = targetCount % subtopics.length;

  const result: Question[] = [];
  subtopics.sort(() => Math.random() - 0.5).forEach((subtopic) => {
    const quota = basePerSubtopic + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;

    const pool = [...subtopicMap[subtopic]].sort(() => Math.random() - 0.5);
    result.push(...pool.slice(0, quota));
  });

  return result.sort(() => Math.random() - 0.5);
}

/**
 * Ranks participants by Score (descending), then Completion Speed (ascending tie-breaker).
 */
export function sortLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.timeSpentSeconds - b.timeSpentSeconds;
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
