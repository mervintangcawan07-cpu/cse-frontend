export interface QuestionItem {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string | null;
}

/**
 * 🎲 Fisher-Yates Generic Array Shuffler (Shuffles Question Order)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 🔀 Choice Randomizer
 * Scrambles the 4 option positions while updating the `answerIndex`
 * so the correct answer text remains accurately linked.
 */
export function shuffleQuestionOptions(question: QuestionItem): QuestionItem {
  const indexedOptions = question.options.map((opt, index) => ({
    text: opt,
    isCorrect: index === question.answerIndex,
  }));

  const shuffledOptionsData = shuffleArray(indexedOptions);

  const shuffledOptions = shuffledOptionsData.map((item) => item.text);
  const newAnswerIndex = shuffledOptionsData.findIndex((item) => item.isCorrect);

  return {
    ...question,
    options: shuffledOptions,
    answerIndex: newAnswerIndex,
  };
}

/**
 * 🧠 Shuffles both Question Order AND Option Placements for Mock Exams
 */
export function prepareShuffledExam(questions: QuestionItem[]): QuestionItem[] {
  const shuffledQuestions = shuffleArray(questions);
  return shuffledQuestions.map(shuffleQuestionOptions);
}

/**
 * ⚡ Fast Keyword Regex for Reading Comprehension
 */
export const KEYWORD_REGEX =
  /\b(However|Therefore|NOT|EXCEPT|Although|In contrast|Furthermore|Consequently|Unless|Except|In spite of|Never|Always)\b/g;