import { countBankQuestions } from "@/lib/questionBank";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  activeEliminationQuestionWhere,
  activeFlashcardWhere,
  activeOrdinaryQuestionWhere,
  eliminationQuestionClassificationWhere,
  softDeletedEliminationQuestionWhere,
  softDeletedFlashcardWhere,
  softDeletedOrdinaryQuestionWhere,
} from "@/lib/contentEligibility";

async function runStorageAudit(): Promise<void> {
  const [
    questionTotal,
    questionActiveTotal,
    questionActiveOrdinary,
    questionActiveElimination,
    questionSoftDeletedTotal,
    questionSoftDeletedOrdinary,
    questionSoftDeletedElimination,
    explicitOrdinary,
    explicitElimination,
    totalNull,
    legacyNullOrdinary,
    legacyNullElimination,
    flashcardTotal,
    flashcardActive,
    flashcardSoftDeleted,
  ] = await Promise.all([
    prisma.question.count(),
    prisma.question.count({ where: { deletedAt: null } }),
    countBankQuestions(activeOrdinaryQuestionWhere()),
    countBankQuestions(activeEliminationQuestionWhere()),
    prisma.question.count({ where: { deletedAt: { not: null } } }),
    countBankQuestions(softDeletedOrdinaryQuestionWhere()),
    countBankQuestions(softDeletedEliminationQuestionWhere()),
    countBankQuestions(Prisma.sql`"bankType" = 'ORDINARY'`),
    countBankQuestions(Prisma.sql`"bankType" = 'ELIMINATION'`),
    countBankQuestions(Prisma.sql`"bankType" IS NULL`),
    countBankQuestions(Prisma.sql`"bankType" IS NULL AND NOT ${eliminationQuestionClassificationWhere()}`),
    countBankQuestions(Prisma.sql`"bankType" IS NULL AND ${eliminationQuestionClassificationWhere()}`),
    prisma.flashcard.count(),
    prisma.flashcard.count({ where: activeFlashcardWhere() }),
    prisma.flashcard.count({ where: softDeletedFlashcardWhere() }),
  ]);

  console.log(
    JSON.stringify(
      {
        question: {
          total: questionTotal,
          activeTotal: questionActiveTotal,
          activeOrdinary: questionActiveOrdinary,
          activeElimination: questionActiveElimination,
          softDeletedTotal: questionSoftDeletedTotal,
          softDeletedOrdinary: questionSoftDeletedOrdinary,
          softDeletedElimination: questionSoftDeletedElimination,
          transitional: {
            explicitOrdinary,
            explicitElimination,
            totalNull,
            legacyNullOrdinary,
            legacyNullElimination,
          },
        },
        flashcard: {
          total: flashcardTotal,
          active: flashcardActive,
          softDeleted: flashcardSoftDeleted,
        },
      },
      null,
      2
    )
  );
}

runStorageAudit()
  .catch(() => {
    console.error("Question storage audit failed without modifying data.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
