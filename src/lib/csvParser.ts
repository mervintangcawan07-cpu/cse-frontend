export interface RawQuestionItem {
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string | null;
}

/**
 * 📄 Parses raw CSV text into structured question objects.
 * Expected CSV Headers:
 * category, prompt, optionA, optionB, optionC, optionD, answerIndex, explanation
 */
export function parseCSVToQuestions(csvText: string): RawQuestionItem[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Skip header line (index 0)
  const questions: RawQuestionItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Regex splits by comma while respecting quoted strings
    const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(",");
    const cleanRow = row.map((cell) => cell.replace(/^"|"$/g, "").trim());

    if (cleanRow.length >= 7) {
      const [category, prompt, optA, optB, optC, optD, answerIdxStr, explanation] = cleanRow;

      const answerIndex = parseInt(answerIdxStr, 10);

      if (!isNaN(answerIndex) && category && prompt) {
        const options = [optA, optB, optC, optD].filter(Boolean);

        questions.push({
          category,
          prompt,
          options,
          answerIndex,
          explanation: explanation || null,
        });
      }
    }
  }

  return questions;
}

/**
 * 📥 Generates a downloadable sample CSV template for Admins
 */
export function downloadCSVTemplate() {
  const headers = "category,prompt,optionA,optionB,optionC,optionD,answerIndex,explanation\n";
  const sampleRow1 = `"Numerical Reasoning","What is 15% of 300?","A. 45","B. 3,000","C. -15","D. 90",0,"15% of 300 is 0.15 * 300 = 45."\n`;
  const sampleRow2 = `"General Information","What is R.A. 6713?","A. Civil Service Act","B. Code of Conduct","C. Anti-Graft Act","D. Election Code",1,"R.A. 6713 is the Code of Conduct and Ethical Standards."\n`;

  const blob = new Blob([headers + sampleRow1 + sampleRow2], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "cse_question_import_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}