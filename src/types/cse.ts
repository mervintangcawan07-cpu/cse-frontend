/**
 * Civil Service Exam (CSE) Category & Live Speed Drill Type Definitions
 */

export type CoreSubject =
  | "Numerical Reasoning"
  | "Verbal Ability"
  | "Analytical Reasoning"
  | "General Information & PH Constitution"
  | "Clerical Ability";

export type DifficultyLevel = "Basic Fundamentals" | "Intermediate Drill" | "Hard/Speed Test";

export interface Question {
  id: string;
  category: CoreSubject;
  subtopic: string;
  prompt: string;
  options: string[];
  correctAnswer: number; // 0-indexed option index
  explanation?: string;
  legalReference?: string; // e.g., "RA 6713 Sec. 4" or "1987 PH Constitution Art. III"
}

export interface SubtopicGroup {
  subtopic: string;
  questions: Question[];
}

export interface DrillConfig {
  coreSubject: CoreSubject;
  difficulty: DifficultyLevel;
  itemCount: number; // e.g., 10, 20, 30, 50
  durationMinutes: number; // e.g., 10, 15, 30
}

export interface LiveDrillParticipant {
  userId: string;
  name: string;
  avatarUrl?: string;
  answers: Record<number, number>; // questionIndex -> selectedOption
  responseTimes: Record<number, number>; // questionIndex -> time taken in seconds
  score: number;
  submittedAt?: string;
}

export interface LiveDrillSession {
  id: string;
  title: string;
  description?: string;
  config: DrillConfig;
  startTime: string; // ISO String
  endTime: string; // ISO String
  hostUserId: string;
  hostName: string;
  questions: Question[];
  participants: Record<string, LiveDrillParticipant>;
  status: "scheduled" | "live" | "completed";
}

export interface ErrorReviewItem {
  questionId: string;
  prompt: string;
  subtopic: string;
  totalAttempts: number;
  incorrectPercentage: number;
  optionDistribution: Record<number, number>; // percentage per option
  correctAnswerIndex: number;
  correctAnswerText: string;
  stepByStepSolution: string;
  legalReference?: string;
}

export interface EventNotification {
  id: string;
  eventId: string;
  eventTitle: string;
  startTime: string;
  triggerType: "15min" | "5min" | "started";
  message: string;
  read: boolean;
  createdAt: string;
}
