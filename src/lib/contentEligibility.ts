import type { Prisma } from "@prisma/client";

type QuestionClassification = {
  category: string;
  subtopic: string;
};

export function isEliminationQuestion(
  question: QuestionClassification
): boolean {
  return (
    question.category.trim().toLowerCase() === "elimination drill" ||
    question.subtopic.toLowerCase().includes("elimination drill")
  );
}

export function eliminationQuestionClassificationWhere(): Prisma.QuestionWhereInput {
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

export function activeOrdinaryQuestionWhere(): Prisma.QuestionWhereInput {
  return {
    deletedAt: null,
    NOT: eliminationQuestionClassificationWhere(),
  };
}

export function activeEliminationQuestionWhere(): Prisma.QuestionWhereInput {
  return {
    deletedAt: null,
    ...eliminationQuestionClassificationWhere(),
  };
}

export function softDeletedOrdinaryQuestionWhere(): Prisma.QuestionWhereInput {
  return {
    deletedAt: { not: null },
    NOT: eliminationQuestionClassificationWhere(),
  };
}

export function softDeletedEliminationQuestionWhere(): Prisma.QuestionWhereInput {
  return {
    deletedAt: { not: null },
    ...eliminationQuestionClassificationWhere(),
  };
}

export function activeFlashcardWhere(): Prisma.FlashcardWhereInput {
  return { deletedAt: null };
}

export function softDeletedFlashcardWhere(): Prisma.FlashcardWhereInput {
  return { deletedAt: { not: null } };
}
