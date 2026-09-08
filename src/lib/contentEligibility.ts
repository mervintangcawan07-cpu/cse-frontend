import { Prisma, QuestionBankType } from "@prisma/client";

export type QuestionBank = "ORDINARY" | "ELIMINATION";
export type QuestionClassification = {
  category?: string | null;
  subtopic?: string | null;
  bankType?: QuestionBankType | string | null;
};
const ELIMINATION_LABEL = "Elimination Drill";
// ECMAScript String.trim whitespace, including NBSP and BOM, without rewriting rows.
const CATEGORY_WHITESPACE = "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";

export function isEliminationQuestion(question: QuestionClassification): boolean {
  if (question.bankType === "ELIMINATION") {
    return true;
  }
  if (question.bankType === "ORDINARY") {
    return false;
  }
  // Legacy fallback when bankType is null or undefined:
  const cat = typeof question.category === "string" ? question.category.trim().toLowerCase() : "";
  const sub = typeof question.subtopic === "string" ? question.subtopic.toLowerCase() : "";
  return cat === ELIMINATION_LABEL.toLowerCase() || sub.includes(ELIMINATION_LABEL.toLowerCase());
}

export function questionBankOf(question: QuestionClassification): QuestionBank {
  return isEliminationQuestion(question) ? "ELIMINATION" : "ORDINARY";
}

export class QuestionBankError extends Error {
  constructor(message: string, public readonly status = 422,
    public readonly rows?: Array<{ row: number; message: string }>) {
    super(message);
    this.name = "QuestionBankError";
  }
}

export function questionBankErrorResponse(error: unknown): Response | null {
  return error instanceof QuestionBankError
    ? Response.json({ error: error.message, ...(error.rows && { errors: error.rows, rejectedCount: error.rows.length }) }, { status: error.status })
    : null;
}

export function assertQuestionBankMetadata(question: QuestionClassification, bank: QuestionBank): void {
  if (typeof question.category !== "string" || typeof question.subtopic !== "string") {
    throw new QuestionBankError("Category and subtopic must be strings.", 400);
  }
  if (bank === "ORDINARY") {
    if (question.bankType === "ELIMINATION") {
      throw new QuestionBankError(
        "Elimination Drill content must be uploaded or edited through the Elimination Drill bank."
      );
    }
    // Phase A compatibility hardening: ordinary content must not have Elimination Drill markers in category or subtopic
    if (isEliminationQuestion({ category: question.category, subtopic: question.subtopic, bankType: null })) {
      throw new QuestionBankError(
        "Elimination Drill content must be uploaded or edited through the Elimination Drill bank."
      );
    }
  } else {
    if (question.bankType === "ORDINARY") {
      throw new QuestionBankError(
        "An Elimination Drill question must retain its Elimination category or subtopic marker."
      );
    }
    // Compatibility hardening: Elimination content must retain its Elimination category or subtopic marker
    if (!isEliminationQuestion({ category: question.category, subtopic: question.subtopic, bankType: null })) {
      throw new QuestionBankError(
        "An Elimination Drill question must retain its Elimination category or subtopic marker."
      );
    }
  }
}

export function assertOrdinaryQuestionBatch(questions: QuestionClassification[]): void {
  const errors: Array<{ row: number; message: string }> = [];
  questions.forEach((question, index) => {
    try { assertQuestionBankMetadata(question, "ORDINARY"); }
    catch (error) {
      if (!(error instanceof QuestionBankError)) throw error;
      errors.push({ row: index + 1, message: error.message });
    }
  });
  if (errors.length) throw new QuestionBankError(
    "Import rejected. Use the Elimination Drill bank for Elimination content; no questions were inserted.", 422, errors);
}

export function eliminationImportMetadata(category?: string, subtopic?: string, tags?: string): { category: string; subtopic: string; bankType: "ELIMINATION" } {
  let sub = (subtopic || tags || "Speed Drill").trim();
  if (!sub.toLowerCase().includes(ELIMINATION_LABEL.toLowerCase())) {
    sub += ` (${ELIMINATION_LABEL})`;
  }
  return {
    category: category?.trim() || ELIMINATION_LABEL,
    subtopic: sub,
    bankType: "ELIMINATION",
  };
}

// Legacy SQL classification predicate for category/subtopic metadata
export function eliminationQuestionClassificationWhere(): Prisma.Sql {
  const label = ELIMINATION_LABEL.toLowerCase();
  // The marker is ASCII. Explicit folding avoids database-locale differences
  // (for example U+0130 must not collapse into ASCII i and acquire ownership).
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  return Prisma.sql`(translate(btrim("category", ${CATEGORY_WHITESPACE}), ${upper}, ${lower}) = ${label} OR strpos(translate("subtopic", ${upper}, ${lower}), ${label}) > 0)`;
}

// Canonical transitional SQL predicates: explicit bankType wins; NULL falls back to legacy
export function ordinaryQuestionWhere(): Prisma.Sql {
  return Prisma.sql`("bankType" = 'ORDINARY' OR ("bankType" IS NULL AND NOT ${eliminationQuestionClassificationWhere()}))`;
}

export function eliminationQuestionWhere(): Prisma.Sql {
  return Prisma.sql`("bankType" = 'ELIMINATION' OR ("bankType" IS NULL AND ${eliminationQuestionClassificationWhere()}))`;
}

export function activeOrdinaryQuestionWhere(): Prisma.Sql {
  return Prisma.sql`("deletedAt" IS NULL AND ${ordinaryQuestionWhere()})`;
}

export function activeEliminationQuestionWhere(): Prisma.Sql {
  return Prisma.sql`("deletedAt" IS NULL AND ${eliminationQuestionWhere()})`;
}

export function softDeletedOrdinaryQuestionWhere(): Prisma.Sql {
  return Prisma.sql`("deletedAt" IS NOT NULL AND ${ordinaryQuestionWhere()})`;
}

export function softDeletedEliminationQuestionWhere(): Prisma.Sql {
  return Prisma.sql`("deletedAt" IS NOT NULL AND ${eliminationQuestionWhere()})`;
}

// Canonical transitional Prisma ORM filters:
export function ordinaryQuestionPrismaWhere(): Prisma.QuestionWhereInput {
  return {
    OR: [
      { bankType: "ORDINARY" },
      {
        bankType: null,
        NOT: {
          OR: [
            { category: { equals: ELIMINATION_LABEL, mode: "insensitive" } },
            { subtopic: { contains: ELIMINATION_LABEL, mode: "insensitive" } },
          ],
        },
      },
    ],
  };
}

export function eliminationQuestionPrismaWhere(): Prisma.QuestionWhereInput {
  return {
    OR: [
      { bankType: "ELIMINATION" },
      {
        bankType: null,
        OR: [
          { category: { equals: ELIMINATION_LABEL, mode: "insensitive" } },
          { subtopic: { contains: ELIMINATION_LABEL, mode: "insensitive" } },
        ],
      },
    ],
  };
}

export function activeOrdinaryQuestionPrismaWhere(): Prisma.QuestionWhereInput {
  return {
    deletedAt: null,
    ...ordinaryQuestionPrismaWhere(),
  };
}

export function activeEliminationQuestionPrismaWhere(): Prisma.QuestionWhereInput {
  return {
    deletedAt: null,
    ...eliminationQuestionPrismaWhere(),
  };
}

export function softDeletedOrdinaryQuestionPrismaWhere(): Prisma.QuestionWhereInput {
  return {
    deletedAt: { not: null },
    ...ordinaryQuestionPrismaWhere(),
  };
}

export function softDeletedEliminationQuestionPrismaWhere(): Prisma.QuestionWhereInput {
  return {
    deletedAt: { not: null },
    ...eliminationQuestionPrismaWhere(),
  };
}

export function activeFlashcardWhere(): Prisma.FlashcardWhereInput {
  return { deletedAt: null };
}

export function softDeletedFlashcardWhere(): Prisma.FlashcardWhereInput {
  return { deletedAt: { not: null } };
}
