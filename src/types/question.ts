// Relative Path: src/types/question.ts

export interface StepSolutionItem {
  step: string;
  detail: string;
}

export interface OptionAnalysisItem {
  option: string;
  text: string;
  isCorrect?: boolean;
}

export interface StructuredQuestion {
  id?: string;
  category: string;
  subtopic?: string;
  prompt: string;
  options: string[];
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  answerIndex: number;
  explanation?: string | null;
  imageUrl?: string | null;

  // Premium Reasoning & Pedagogical Fields
  stepByStep?: string | StepSolutionItem[] | null;
  whyA?: string | null;
  whyB?: string | null;
  whyC?: string | null;
  whyD?: string | null;
  eliminationStrategy?: string | null;
  commonTrap?: string | null;
  examTip?: string | null;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "VERY_HARD" | string | null;
  tags?: string[] | string | null;
  skillTested?: string | null;
}

export type QuestionReviewMode = "INTERACTIVE" | "REVIEW" | "PREVIEW";
