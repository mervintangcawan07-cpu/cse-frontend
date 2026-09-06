import { prisma } from "@/lib/prisma";
import {
  activeEliminationQuestionWhere,
  activeFlashcardWhere,
  activeOrdinaryQuestionWhere,
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
    flashcardTotal,
    flashcardActive,
    flashcardSoftDeleted,
  ] = await Promise.all([
    prisma.question.count(),
    prisma.question.count({ where: { deletedAt: null } }),
    prisma.question.count({ where: activeOrdinaryQuestionWhere() }),
    prisma.question.count({ where: activeEliminationQuestionWhere() }),
    prisma.question.count({ where: { deletedAt: { not: null } } }),
    prisma.question.count({ where: softDeletedOrdinaryQuestionWhere() }),
    prisma.question.count({ where: softDeletedEliminationQuestionWhere() }),
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
