import { Prisma } from "@prisma/client";

export type QuestionBank = "ORDINARY" | "ELIMINATION";
export type QuestionClassification = { category: string; subtopic: string };
const ELIMINATION_LABEL = "Elimination Drill";
// ECMAScript String.trim whitespace, including NBSP and BOM, without rewriting rows.
const CATEGORY_WHITESPACE = "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";

export function isEliminationQuestion(question: QuestionClassification): boolean {
  return question.category.trim().toLowerCase() === ELIMINATION_LABEL.toLowerCase() ||
    question.subtopic.toLowerCase().includes(ELIMINATION_LABEL.toLowerCase());
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
  if (questionBankOf(question) !== bank) {
    throw new QuestionBankError(bank === "ORDINARY"
      ? "Elimination Drill content must be uploaded or edited through the Elimination Drill bank."
      : "An Elimination Drill question must retain its Elimination category or subtopic marker.");
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

export function eliminationImportMetadata(category?: string, subtopic?: string, tags?: string): QuestionClassification {
  const result = {
    category: category?.trim() || ELIMINATION_LABEL,
    subtopic: (subtopic || tags || "Speed Drill").trim(),
  };
  if (!result.subtopic.toLowerCase().includes(ELIMINATION_LABEL.toLowerCase())) {
    result.subtopic += ` (${ELIMINATION_LABEL})`;
  }
  return result;
}

// Prisma scalar filters cannot trim stored category whitespace. These SQL
// predicates keep database selection/counts and the JavaScript rule identical.
export function eliminationQuestionClassificationWhere(): Prisma.Sql {
  const label = ELIMINATION_LABEL.toLowerCase();
  // The marker is ASCII. Explicit folding avoids database-locale differences
  // (for example U+0130 must not collapse into ASCII i and acquire ownership).
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  return Prisma.sql`(translate(btrim("category", ${CATEGORY_WHITESPACE}), ${upper}, ${lower}) = ${label} OR strpos(translate("subtopic", ${upper}, ${lower}), ${label}) > 0)`;
}

export function activeOrdinaryQuestionWhere(): Prisma.Sql {
  return Prisma.sql`("deletedAt" IS NULL AND NOT ${eliminationQuestionClassificationWhere()})`;
}

export function activeEliminationQuestionWhere(): Prisma.Sql {
  return Prisma.sql`("deletedAt" IS NULL AND ${eliminationQuestionClassificationWhere()})`;
}

export function softDeletedOrdinaryQuestionWhere(): Prisma.Sql {
  return Prisma.sql`("deletedAt" IS NOT NULL AND NOT ${eliminationQuestionClassificationWhere()})`;
}

export function softDeletedEliminationQuestionWhere(): Prisma.Sql {
  return Prisma.sql`("deletedAt" IS NOT NULL AND ${eliminationQuestionClassificationWhere()})`;
}

export function activeFlashcardWhere(): Prisma.FlashcardWhereInput {
  return { deletedAt: null };
}

export function softDeletedFlashcardWhere(): Prisma.FlashcardWhereInput {
  return { deletedAt: { not: null } };
}
