import type { Prisma, QuestionBankType } from "@prisma/client";

export type QuestionClassification = {
  bankType?: QuestionBankType | string | null;
  category?: string | null;
  subtopic?: string | null;
};

// ---------------------------------------------------------------------------
// LEGACY STRING CLASSIFIER — used only when bankType IS NULL.
// Explicit bankType ALWAYS takes precedence.
// ---------------------------------------------------------------------------

export function isEliminationQuestion(
  question: QuestionClassification
): boolean {
  // Precedence 1: Explicit bankType wins unconditionally
  if (question.bankType === "ELIMINATION") return true;
  if (question.bankType === "ORDINARY") return false;

  // Precedence 2: Legacy fallback when bankType IS NULL / undefined
  const cat = question.category?.trim().toLowerCase() || "";
  const sub = question.subtopic?.toLowerCase() || "";
  return cat === "elimination drill" || sub.includes("elimination drill");
}

export function isOrdinaryQuestion(
  question: QuestionClassification
): boolean {
  // Precedence 1: Explicit bankType wins unconditionally
  if (question.bankType === "ORDINARY") return true;
  if (question.bankType === "ELIMINATION") return false;

  // Precedence 2: Legacy fallback when bankType IS NULL / undefined
  const cat = question.category?.trim().toLowerCase() || "";
  const sub = question.subtopic?.toLowerCase() || "";
  return cat !== "elimination drill" && !sub.includes("elimination drill");
}

/** @deprecated - migration / backfill use only. Runtime ownership uses bankType with legacy fallback. */
export function legacyEliminationClassificationWhere(): Prisma.QuestionWhereInput {
  return {
    OR: [
      {
        category: {
          equals: "Elimination Drill",
          mode: "insensitive",
        },
      },
      {
        subtopic: {
          contains: "Elimination Drill",
          mode: "insensitive",
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// TRANSITIONAL BANK PREDICATES
// Precedence: Explicit bankType first. If bankType IS NULL, fall back to legacy strings.
// ---------------------------------------------------------------------------

export function transitionalOrdinaryBankWhere(): Prisma.QuestionWhereInput {
  return {
    OR: [
      { bankType: "ORDINARY" },
      {
        bankType: null,
        NOT: [
          { category: { equals: "Elimination Drill", mode: "insensitive" } },
          { subtopic: { contains: "Elimination Drill", mode: "insensitive" } },
        ],
      },
    ],
  };
}

export function transitionalEliminationBankWhere(): Prisma.QuestionWhereInput {
  return {
    OR: [
      { bankType: "ELIMINATION" },
      {
        bankType: null,
        OR: [
          { category: { equals: "Elimination Drill", mode: "insensitive" } },
          { subtopic: { contains: "Elimination Drill", mode: "insensitive" } },
        ],
      },
    ],
  };
}

// Aliases for callers expecting ordinaryBankWhere / eliminationBankWhere
export const ordinaryBankWhere = transitionalOrdinaryBankWhere;
export const eliminationBankWhere = transitionalEliminationBankWhere;

// ---------------------------------------------------------------------------
// ACTIVE QUESTION HELPERS — authoritative runtime ownership (transitional).
// ---------------------------------------------------------------------------

export function activeOrdinaryQuestionWhere(): Prisma.QuestionWhereInput {
  return {
    deletedAt: null,
    ...transitionalOrdinaryBankWhere(),
  };
}

export function activeEliminationQuestionWhere(): Prisma.QuestionWhereInput {
  return {
    deletedAt: null,
    ...transitionalEliminationBankWhere(),
  };
}

export function softDeletedOrdinaryQuestionWhere(): Prisma.QuestionWhereInput {
  return {
    deletedAt: { not: null },
    ...transitionalOrdinaryBankWhere(),
  };
}

export function softDeletedEliminationQuestionWhere(): Prisma.QuestionWhereInput {
  return {
    deletedAt: { not: null },
    ...transitionalEliminationBankWhere(),
  };
}

// ---------------------------------------------------------------------------
// FLASHCARD HELPERS — unchanged, Flashcard model is physically separate.
// ---------------------------------------------------------------------------

export function activeFlashcardWhere(): Prisma.FlashcardWhereInput {
  return { deletedAt: null };
}

export function softDeletedFlashcardWhere(): Prisma.FlashcardWhereInput {
  return { deletedAt: { not: null } };
}
