import { Prisma, type Question } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger/logger";
import {
  activeEliminationQuestionWhere, activeOrdinaryQuestionWhere,
  assertQuestionBankMetadata, QuestionBankError, type QuestionBank,
} from "@/lib/contentEligibility";

type ScalarSelect = Partial<Record<Prisma.QuestionScalarFieldEnum, boolean>>;
type SelectedQuestion<S> = S extends ScalarSelect
  ? Pick<Question, { [K in keyof S]: S[K] extends true ? K : never }[keyof S] & keyof Question>
  : Question;
type QueryClient = Pick<Prisma.TransactionClient, "$queryRaw">;

// Identifiers must be generated Question scalar fields; request values are
// always parameters. Selection, pagination and counts stay in one DB query.
function column(name: string): Prisma.Sql {
  if (!Object.values(Prisma.QuestionScalarFieldEnum).includes(name as Prisma.QuestionScalarFieldEnum)) {
    throw new Error("Unsupported Question column");
  }
  return Prisma.raw(`"${name}"`);
}

export function andQuestionWhere(...conditions: Prisma.Sql[]): Prisma.Sql {
  return conditions.length ? Prisma.sql`(${Prisma.join(conditions, " AND ")})` : Prisma.sql`TRUE`;
}

export function orQuestionWhere(...conditions: Prisma.Sql[]): Prisma.Sql {
  return conditions.length ? Prisma.sql`(${Prisma.join(conditions, " OR ")})` : Prisma.sql`FALSE`;
}

export function questionIdsWhere(ids: string[]): Prisma.Sql {
  return ids.length ? Prisma.sql`"id" IN (${Prisma.join(ids)})` : Prisma.sql`FALSE`;
}

export function questionTextWhere(
  field: "category" | "subtopic" | "prompt", value: string,
  contains = false, insensitive = true,
): Prisma.Sql {
  const target = column(field);
  const pattern = contains ? `%${value}%` : value;
  return insensitive ? Prisma.sql`${target} ILIKE ${pattern}` : Prisma.sql`${target} = ${value}`;
}

export async function findBankQuestions<S extends ScalarSelect | undefined = undefined>(
  args: {
    where: Prisma.Sql; select?: S;
    orderBy?: Partial<Record<Prisma.QuestionScalarFieldEnum, "asc" | "desc">> | Array<Partial<Record<Prisma.QuestionScalarFieldEnum, "asc" | "desc">>>;
    skip?: number; take?: number;
  }, client: QueryClient = prisma,
): Promise<SelectedQuestion<S>[]> {
  const fields = args.select ? Object.entries(args.select).filter(([, enabled]) => enabled).map(([name]) => column(name)) : [];
  const selected = args.select ? Prisma.join(fields) : Prisma.raw("*");
  const orders = (Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy]).flatMap(order =>
    Object.entries(order || {}).map(([name, direction]) => {
      if (direction !== "asc" && direction !== "desc") throw new Error("Unsupported Question order");
      return Prisma.sql`${column(name)} ${direction === "asc" ? Prisma.raw("ASC") : Prisma.raw("DESC")}`;
    }));
  for (const amount of [args.take, args.skip]) {
    if (amount !== undefined && (!Number.isSafeInteger(amount) || amount < 0)) throw new QuestionBankError("Invalid question pagination.", 400);
  }
  return client.$queryRaw<SelectedQuestion<S>[]>(Prisma.sql`
    SELECT ${selected} FROM "Question" WHERE ${args.where}
    ${orders.length ? Prisma.sql`ORDER BY ${Prisma.join(orders)}` : Prisma.empty}
    ${args.take !== undefined ? Prisma.sql`LIMIT ${args.take}` : Prisma.empty}
    ${args.skip !== undefined ? Prisma.sql`OFFSET ${args.skip}` : Prisma.empty}
  `);
}

export async function countBankQuestions(where: Prisma.Sql, client: QueryClient = prisma): Promise<number> {
  const rows = await client.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*) AS count FROM "Question" WHERE ${where}`);
  return Number(rows[0].count);
}

export async function updateBankQuestion(bank: QuestionBank, id: string, data: Prisma.QuestionUncheckedUpdateInput): Promise<Question> {
  if (typeof id !== "string" || !id) throw new QuestionBankError("Question ID is required.", 400);
  const current = await prisma.question.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, category: true, subtopic: true, bankType: true, updatedAt: true },
  });
  if (!current) throw new QuestionBankError("Active question not found in this bank.", 404);
  if (current.bankType !== bank) {
    throw new QuestionBankError("Active question not found in this bank.", 404);
  }
  const category = data.category === undefined ? current.category : data.category;
  const subtopic = data.subtopic === undefined ? current.subtopic : data.subtopic;
  if (typeof category !== "string" || typeof subtopic !== "string") throw new QuestionBankError("Category and subtopic must be strings.", 400);
  assertQuestionBankMetadata({ category, subtopic, bankType: bank }, bank);
  try {
    // The exact classified metadata/version must still match at mutation time.
    // Explicitly claim/preserve bankType as server-owned bank ("ORDINARY" or "ELIMINATION").
    return await prisma.question.update({
      where: { ...current, deletedAt: null },
      data: {
        ...data,
        bankType: bank,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new QuestionBankError("Question changed or is no longer active. Refresh and try again.", 409);
    }
    throw error;
  }
}

export async function softDeleteBankQuestions(bank: QuestionBank, ids: string[] | undefined, deletedBy: string): Promise<number> {
  if (ids && (!ids.length || ids.some(id => typeof id !== "string" || !id))) throw new QuestionBankError("Valid question IDs are required.", 400);
  const uniqueIds = ids ? [...new Set(ids)] : undefined;
  const eligibility = bank === "ORDINARY" ? activeOrdinaryQuestionWhere() : activeEliminationQuestionWhere();
  const where = uniqueIds ? andQuestionWhere(eligibility, questionIdsWhere(uniqueIds)) : eligibility;
  const deletedCount = await prisma.$transaction(async tx => {
    if (uniqueIds) {
      const eligible = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "Question" WHERE ${where} FOR UPDATE`);
      if (eligible.length !== uniqueIds.length) throw new QuestionBankError("One or more active questions were not found in this bank. Nothing was deleted.", 404);
    }
    const now = new Date();
    return tx.$executeRaw(Prisma.sql`UPDATE "Question" SET "deletedAt" = ${now}, "deletedBy" = ${deletedBy}, "updatedAt" = ${now} WHERE ${where}`);
  });
  logger.warn("SOFT DELETE QUESTIONS IN BANK", {
    context: { entityType: "question", bank, ids: uniqueIds, deletedBy, deletedCount },
  });
  return deletedCount;
}
