// Relative Path: src/lib/duels/sanitize.ts
import type { DuelMatch } from "@prisma/client";

export interface SanitizedDuelQuestion {
  id: string;
  category: string;
  prompt: string;
  options: string[];
}

export interface SanitizedDuelMatch extends Omit<DuelMatch, "questions"> {
  questions: SanitizedDuelQuestion[];
}

/**
 * Strips answerIndex, explanation, and distractor rationales from duel match questions.
 * Players NEVER receive answer keys in match objects, including in FINISHED matches.
 */
export function sanitizeDuelMatchForPlayer<T extends Partial<DuelMatch> & { questions?: unknown }>(
  match: T | null | undefined
): (Omit<T, "questions"> & { questions: SanitizedDuelQuestion[] }) | null {
  if (!match) return null;

  const rawQuestions = Array.isArray(match.questions) ? (match.questions as any[]) : [];
  const sanitizedQuestions: SanitizedDuelQuestion[] = rawQuestions.map((q) => {
    const rawOptions = Array.isArray(q.options)
      ? q.options.filter((opt: unknown): opt is string => typeof opt === "string")
      : [];

    return {
      id: typeof q.id === "string" ? q.id : "",
      category: typeof q.category === "string" ? q.category : "General",
      prompt: typeof q.prompt === "string" ? q.prompt : "",
      options: rawOptions,
    };
  });

  return {
    ...match,
    questions: sanitizedQuestions,
  };
}

