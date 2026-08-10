/**
 * Civil Service Exam (CSE) Category, Drill, and Study Together Event Types
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
  correctAnswer: number;
  explanation?: string;
  legalReference?: string;
}

export interface SubtopicGroup {
  subtopic: string;
  questions: Question[];
}

export interface DrillConfig {
  coreSubject: CoreSubject;
  difficulty: DifficultyLevel;
  itemCount: number;
  durationMinutes: number;
}

export interface LiveDrillParticipant {
  userId: string;
  name: string;
  avatarUrl?: string;
  answers: Record<number, number>;
  responseTimes: Record<number, number>;
  score: number;
  submittedAt?: string;
}

export interface LiveDrillSession {
  id: string;
  title: string;
  description?: string;
  config: DrillConfig;
  startTime: string;
  endTime: string;
  hostUserId: string;
  hostName: string;
  questions: Question[];
  participants: Record<string, LiveDrillParticipant>;
  status: "scheduled" | "live" | "completed";
}

export interface UserEventResult {
  score: number;
  totalItems: number;
  accuracyPercent: number;
  timeSpentSeconds: number;
  completedAt: string;
  answers: Record<number, number>;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl?: string;
  rank?: number;
  score: number;
  totalItems: number;
  accuracyPercent: number;
  timeSpentSeconds: number;
  submittedAt: string;
}

export interface StudyTogetherEvent {
  id: string;
  title: string;
  description: string;
  categories: CoreSubject[];
  difficulty: DifficultyLevel;
  itemCount: number;
  quizDurationMinutes: number;
  scheduledStartTime: string;
  activeDurationHours: number;
  hostName: string;
  hostUserId: string;
  participantsCount: number;
  isCompletedByCurrentUser?: boolean;
  currentUserResult?: UserEventResult;
}

export interface ErrorReviewItem {
  questionId: string;
  prompt: string;
  subtopic: string;
  totalAttempts: number;
  incorrectPercentage: number;
  optionDistribution: Record<number, number>;
  correctAnswerIndex: number;
  correctAnswerText: string;
  stepByStepSolution: string;
  legalReference?: string;
}

export interface EventNotification {
  id: string;
  eventId: string;
  eventTitle: string;
  scheduledStartTime: string;
  triggerType: "15min" | "5min" | "started";
  message: string;
  read: boolean;
  createdAt: string;
}
