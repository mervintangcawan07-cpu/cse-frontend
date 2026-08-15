// Relative Path: src/lib/csvParser.ts
import Papa from "papaparse";
import { StructuredQuestion } from "@/types/question";
import { cleanMathText } from "@/lib/sanitizeMath";

export interface RawQuestionItem extends StructuredQuestion {}

export interface ValidationErrorItem {
  row: number;
  prompt?: string;
  field?: string;
  message: string;
}

export interface ParseValidationResult {
  validQuestions: StructuredQuestion[];
  errors: ValidationErrorItem[];
  warnings: ValidationErrorItem[];
  totalRows: number;
}

/**
 * 🔍 Helper to extract field values case-insensitively across multiple possible header aliases
 */
export function getCSVFieldValue(item: Record<string, any>, possibleKeys: string[]): string {
  const itemKeys = Object.keys(item);
  for (const targetKey of possibleKeys) {
    const matchedKey = itemKeys.find(
      (k) => k.trim().toLowerCase() === targetKey.toLowerCase()
    );
    if (matchedKey && item[matchedKey] !== undefined && item[matchedKey] !== null) {
      const val = String(item[matchedKey]).trim();
      if (val !== "") return val;
    }
  }
  return "";
}

/**
 * 📄 Parses raw CSV text into structured question objects with full schema and alias mapping.
 */
export function parseCSVToQuestions(csvText: string): StructuredQuestion[] {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (!parsed.data || parsed.data.length === 0) return [];

  return parsed.data
    .map((item: any) => {
      const category = getCSVFieldValue(item, ["category", "subject"]) || "General";
      const subtopic = getCSVFieldValue(item, ["subtopic", "sub_topic", "subTopic", "topic"]) || "General";
      const rawPrompt = getCSVFieldValue(item, ["prompt", "question", "Question", "Prompt"]);
      const prompt = cleanMathText(rawPrompt);
      const rawExplanation = getCSVFieldValue(item, ["explanation", "solution", "Explanation", "Solution"]) || null;
      const explanation = rawExplanation ? cleanMathText(rawExplanation) : null;
      const imageUrl = getCSVFieldValue(item, ["imageUrl", "image_url", "image", "ImageUrl"]) || null;

      const rawOptA = getCSVFieldValue(item, ["optionA", "option_a", "choiceA", "Option A", "Choice A", "a"]);
      const rawOptB = getCSVFieldValue(item, ["optionB", "option_b", "choiceB", "Option B", "Choice B", "b"]);
      const rawOptC = getCSVFieldValue(item, ["optionC", "option_c", "choiceC", "Option C", "Choice C", "c"]);
      const rawOptD = getCSVFieldValue(item, ["optionD", "option_d", "choiceD", "Option D", "Choice D", "d"]);

      const optA = rawOptA ? cleanMathText(rawOptA) : "";
      const optB = rawOptB ? cleanMathText(rawOptB) : "";
      const optC = rawOptC ? cleanMathText(rawOptC) : "";
      const optD = rawOptD ? cleanMathText(rawOptD) : "";

      let options: string[] = [];
      if (Array.isArray(item.options) && item.options.length > 0) {
        options = item.options.map((o: any) => cleanMathText(String(o).trim()));
      } else {
        options = [optA, optB, optC, optD].filter(Boolean);
      }

      // Parse answer index / letter (Supports "A", "B", "C", "D" or "0", "1", "2", "3" or "1", "2", "3", "4")
      let answerIndex = 0;
      const rawAns = getCSVFieldValue(item, [
        "answerIndex",
        "correctAnswer",
        "answer_index",
        "correct_answer",
        "Correct Answer",
        "Answer",
        "answer",
      ]);

      if (rawAns) {
        const upper = rawAns.toUpperCase();
        if (upper === "A" || upper.startsWith("A.") || upper.startsWith("A -") || upper.startsWith("A)")) answerIndex = 0;
        else if (upper === "B" || upper.startsWith("B.") || upper.startsWith("B -") || upper.startsWith("B)")) answerIndex = 1;
        else if (upper === "C" || upper.startsWith("C.") || upper.startsWith("C -") || upper.startsWith("C)")) answerIndex = 2;
        else if (upper === "D" || upper.startsWith("D.") || upper.startsWith("D -") || upper.startsWith("D)")) answerIndex = 3;
        else {
          const parsedNum = parseInt(rawAns, 10);
          if (!isNaN(parsedNum)) {
            // If user provided 1-based index (1..4) without 0, or standard 0-based index
            if (parsedNum >= 1 && parsedNum <= 4 && options.length <= 4 && rawAns.trim() === String(parsedNum)) {
              // Could be 0-based or 1-based. If > 0, check against options length
              answerIndex = parsedNum > 3 ? parsedNum - 1 : parsedNum;
            } else {
              answerIndex = parsedNum;
            }
          } else {
            // Check if exact text matches an option
            const matchingIdx = options.findIndex((opt) => opt.toLowerCase() === rawAns.toLowerCase() || cleanMathText(opt).toLowerCase() === cleanMathText(rawAns).toLowerCase());
            if (matchingIdx !== -1) answerIndex = matchingIdx;
          }
        }
      }

      // Extended Educational Reasoning Fields
      const rawStepByStep = getCSVFieldValue(item, [
        "stepByStep",
        "step_by_step",
        "Step-by-Step Solution",
        "Step by Step Solution",
        "step_solution",
        "solution_steps",
      ]) || null;
      const stepByStep = rawStepByStep ? cleanMathText(rawStepByStep) : null;

      const rawWhyA = getCSVFieldValue(item, ["whyA", "why_a", "Why A Is Wrong/Right", "Why A is Right/Wrong", "Why A", "why_option_a"]) || null;
      const rawWhyB = getCSVFieldValue(item, ["whyB", "why_b", "Why B Is Wrong/Right", "Why B is Right/Wrong", "Why B", "why_option_b"]) || null;
      const rawWhyC = getCSVFieldValue(item, ["whyC", "why_c", "Why C Is Wrong/Right", "Why C is Right/Wrong", "Why C", "why_option_c"]) || null;
      const rawWhyD = getCSVFieldValue(item, ["whyD", "why_d", "Why D Is Wrong/Right", "Why D is Right/Wrong", "Why D", "why_option_d"]) || null;

      const whyA = rawWhyA ? cleanMathText(rawWhyA) : null;
      const whyB = rawWhyB ? cleanMathText(rawWhyB) : null;
      const whyC = rawWhyC ? cleanMathText(rawWhyC) : null;
      const whyD = rawWhyD ? cleanMathText(rawWhyD) : null;

      const rawEliminationStrategy = getCSVFieldValue(item, [
        "eliminationStrategy",
        "elimination_strategy",
        "Elimination Strategy",
        "Strategy",
      ]) || null;
      const eliminationStrategy = rawEliminationStrategy ? cleanMathText(rawEliminationStrategy) : null;

      const rawCommonTrap = getCSVFieldValue(item, [
        "commonTrap",
        "common_trap",
        "Common Trap",
        "Trap",
      ]) || null;
      const commonTrap = rawCommonTrap ? cleanMathText(rawCommonTrap) : null;

      const rawExamTip = getCSVFieldValue(item, [
        "examTip",
        "exam_tip",
        "Exam Day Tip",
        "Exam Tip",
        "tip",
      ]) || null;
      const examTip = rawExamTip ? cleanMathText(rawExamTip) : null;

      const difficulty = getCSVFieldValue(item, ["difficulty", "Difficulty", "level"]) || "MEDIUM";

      const rawTags = getCSVFieldValue(item, ["tags", "Tags"]);
      const tags = rawTags ? rawTags.split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : [];

      const skillTested = getCSVFieldValue(item, ["skillTested", "skill_tested", "Skill Tested", "Skill"]) || null;

      return {
        category,
        subtopic,
        prompt,
        options,
        optionA: optA || (options[0] ?? null),
        optionB: optB || (options[1] ?? null),
        optionC: optC || (options[2] ?? null),
        optionD: optD || (options[3] ?? null),
        answerIndex: Math.max(0, Math.min(answerIndex, Math.max(0, options.length - 1))),
        explanation,
        imageUrl,
        stepByStep,
        whyA,
        whyB,
        whyC,
        whyD,
        eliminationStrategy,
        commonTrap,
        examTip,
        difficulty: ["EASY", "MEDIUM", "HARD", "VERY_HARD"].includes(difficulty.toUpperCase())
          ? difficulty.toUpperCase()
          : "MEDIUM",
        tags,
        skillTested,
      };
    })
    .filter((q) => q.prompt && q.category && q.options.length >= 2);
}

/**
 * 🛡️ Full validation engine with detailed error and warning reporting
 */
export function validateParsedQuestions(rawParsed: any[]): ParseValidationResult {
  const validQuestions: StructuredQuestion[] = [];
  const errors: ValidationErrorItem[] = [];
  const warnings: ValidationErrorItem[] = [];

  const seenPrompts = new Set<string>();

  rawParsed.forEach((item, index) => {
    const rowNum = index + 1;
    const prompt = getCSVFieldValue(item, ["prompt", "question", "Question", "Prompt"]);
    const category = getCSVFieldValue(item, ["category", "subject", "Category", "Subject"]);

    const optA = getCSVFieldValue(item, ["optionA", "option_a", "choiceA", "Option A", "Choice A", "a"]);
    const optB = getCSVFieldValue(item, ["optionB", "option_b", "choiceB", "Option B", "Choice B", "b"]);
    const optC = getCSVFieldValue(item, ["optionC", "option_c", "choiceC", "Option C", "Choice C", "c"]);
    const optD = getCSVFieldValue(item, ["optionD", "option_d", "choiceD", "Option D", "Choice D", "d"]);

    const options = [optA, optB, optC, optD].filter(Boolean);

    if (!prompt) {
      errors.push({ row: rowNum, field: "Question", message: "Question prompt cannot be blank." });
      return;
    }

    if (!category) {
      warnings.push({ row: rowNum, prompt, field: "Category", message: "Category missing, defaulting to 'General Information'." });
    }

    if (options.length < 2) {
      errors.push({ row: rowNum, prompt, field: "Options", message: `Question must have at least 2 non-empty options (found ${options.length}).` });
      return;
    }

    if (options.length < 4) {
      warnings.push({ row: rowNum, prompt, field: "Options", message: `Standard CSE questions have 4 options (found ${options.length}).` });
    }

    // Check duplicate prompt within this batch
    const normalizedPrompt = prompt.toLowerCase().trim();
    if (seenPrompts.has(normalizedPrompt)) {
      warnings.push({ row: rowNum, prompt, field: "Duplicate", message: "Duplicate question prompt detected in this file." });
    }
    seenPrompts.add(normalizedPrompt);

    // Parse question fields
    const parsedList = parseCSVToQuestions(Papa.unparse([item]));
    if (parsedList.length > 0) {
      validQuestions.push(parsedList[0]);
    }
  });

  return {
    validQuestions,
    errors,
    warnings,
    totalRows: rawParsed.length,
  };
}

/**
 * 📥 Generates a downloadable sample CSV template for Admins with rich reasoning examples
 */
export function downloadCSVTemplate() {
  const headers = [
    "Category",
    "Subtopic",
    "Question",
    "Option A",
    "Option B",
    "Option C",
    "Option D",
    "Correct Answer",
    "Explanation",
    "Step-by-Step Solution",
    "Why A Is Wrong/Right",
    "Why B Is Wrong/Right",
    "Why C Is Wrong/Right",
    "Why D Is Wrong/Right",
    "Elimination Strategy",
    "Common Trap",
    "Exam Day Tip",
    "Difficulty",
    "Tags",
  ];

  const sample1 = [
    "Numerical Reasoning",
    "Work & Rate",
    "A government printing office uses three automated machines: Alpha, Beta, and Gamma. Working together at their constant standard rates, they can print a batch of 18,000 examination booklets in 6 hours. Machine Alpha works twice as fast as Machine Gamma, while Machine Beta works 1.5 times as fast as Machine Gamma. If Machine Beta breaks down after all three machines have worked together for 2 hours, how many additional hours will it take Machines Alpha and Gamma working together to finish the remaining booklets?",
    "4 hours",
    "6 hours",
    "8 hours",
    "9 hours",
    "B",
    "After 2 hours, 6,000 booklets are printed, leaving 12,000 booklets. Without Machine Beta (1,000 booklets/hr), Machines Alpha and Gamma produce 2,000 booklets/hr together. 12,000 / 2,000 = 6 hours.",
    "Step 1: Total combined rate = 18,000 / 6 = 3,000 booklets/hr.|Step 2: Let Gamma rate = g. Alpha = 2g, Beta = 1.5g. Combined: 4.5g = 3,000 => g = 666.67/hr, Alpha = 1,333.33/hr, Beta = 1,000/hr.|Step 3: Work done in first 2 hours = 2 * 3,000 = 6,000 booklets.|Step 4: Remaining booklets = 18,000 - 6,000 = 12,000 booklets.|Step 5: Combined rate of Alpha + Gamma = 1,333.33 + 666.67 = 2,000 booklets/hr.|Step 6: Time needed = 12,000 / 2,000 = 6 hours.",
    "Incorrect. Assumes all 3 machines continued operating (12,000 / 3,000 = 4 hrs).",
    "Correct! Accurately accounts for 2 hours joint production and the adjusted speed of Alpha + Gamma.",
    "Incorrect. Total elapsed time from the start (2 hrs + 6 hrs = 8 hrs), but question asks for additional hours.",
    "Incorrect. Time Alpha and Gamma would take from scratch for all 18,000 booklets.",
    "Beta contributes 1,000/hr (1/3 of total). Remaining two work at 2,000/hr. 12,000 / 2,000 must be an integer (6). Eliminate 4 immediately.",
    "Confusing 'additional hours to finish' with 'total hours elapsed from start'.",
    "When rates are given as relative multiples, set the slowest unit as variable x to avoid fractions.",
    "HARD",
    "word problems;work and rate;algebra",
  ];

  const sample2 = [
    "Verbal Ability",
    "Analogy",
    "OBDURATE : PERSUASION :: ________ : ________",
    "impervious : penetration",
    "gullible : deception",
    "penitent : forgiveness",
    "meticulous : perfection",
    "A",
    "Someone who is obdurate resists persuasion; something that is impervious resists penetration.",
    "Step 1: Obdurate means stubbornly resistant to persuasion.|Step 2: Bridge: X describes a state of complete immunity/resistance to Y.|Step 3: Impervious means completely resistant to penetration.|Step 4: Gullible is vulnerable to deception (inverted relationship).",
    "Correct! Exact parallel: [Adjective] describes something that cannot be affected or breached by [Noun].",
    "Incorrect. Inverted trap: A gullible person is vulnerable to deception, not resistant.",
    "Incorrect. Penitent seeks forgiveness (action and sought result).",
    "Incorrect. Meticulous aims for perfection.",
    "Eliminate C and D as they describe pursuit rather than resistance. Between A and B, identify polarity: obdurate is resistant (immune), gullible is vulnerable.",
    "Picking B because words share thematic human behavior associations without checking polarity.",
    "Construct an explicit bridge sentence containing both words and substitute each option.",
    "HARD",
    "vocabulary;analogy;semantic relationship",
  ];

  const csvContent = Papa.unparse({
    fields: headers,
    data: [sample1, sample2],
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "cse_premium_question_template_full.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 📥 Generates a standard lightweight downloadable CSV template (Core Question + Options + Answer)
 */
export function downloadStandardCSVTemplate() {
  const headers = [
    "Category",
    "Subtopic",
    "Question",
    "Option A",
    "Option B",
    "Option C",
    "Option D",
    "Correct Answer",
    "Explanation",
    "Difficulty",
    "Tags",
  ];

  const sample1 = [
    "Numerical Ability",
    "Word Problems",
    "If 6 administrative assistants can type 72 reports in 4 hours, how many reports can 9 administrative assistants type in 6 hours at the same rate?",
    "162",
    "144",
    "108",
    "126",
    "A",
    "Rate per assistant per hour = 72 / (6 * 4) = 72 / 24 = 3 reports/hour. For 9 assistants in 6 hours: 9 * 6 * 3 = 162 reports.",
    "MEDIUM",
    "Work Rate;Word Problems;Ratio and Proportion",
  ];

  const sample2 = [
    "General Information",
    "RA 6713 Code of Conduct",
    "Under Republic Act No. 6713, public officials and employees shall respond to letters, telegrams, or other means of communications sent by the public within how many working days from receipt?",
    "15 working days",
    "30 working days",
    "7 working days",
    "5 working days",
    "A",
    "Section 5(a) of R.A. 6713 mandates that all public officials and employees shall, within fifteen (15) working days from receipt thereof, respond to letters, telegrams or other means of communications sent by the public.",
    "EASY",
    "RA 6713;Code of Conduct;Civil Service Ethics",
  ];

  const csvContent = Papa.unparse({
    fields: headers,
    data: [sample1, sample2],
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "cse_question_template_standard.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 📤 Converts structured question objects into CSV format for export / re-import
 */
export function generateQuestionsCSV(questions: StructuredQuestion[]): string {
  const letters = ["A", "B", "C", "D"];

  const rows = questions.map((q) => {
    let stepByStepStr = "";
    if (Array.isArray(q.stepByStep)) {
      stepByStepStr = q.stepByStep.map((s) => `${s.step}: ${s.detail}`).join("|");
    } else if (q.stepByStep) {
      stepByStepStr = String(q.stepByStep);
    }

    const tagsStr = Array.isArray(q.tags) ? q.tags.join(";") : String(q.tags || "");

    return {
      Category: q.category || "General",
      Subtopic: q.subtopic || "General",
      Question: q.prompt || "",
      "Option A": q.options?.[0] || q.optionA || "",
      "Option B": q.options?.[1] || q.optionB || "",
      "Option C": q.options?.[2] || q.optionC || "",
      "Option D": q.options?.[3] || q.optionD || "",
      "Correct Answer": letters[q.answerIndex] || "A",
      Explanation: q.explanation || "",
      "Step-by-Step Solution": stepByStepStr,
      "Why A Is Wrong/Right": q.whyA || "",
      "Why B Is Wrong/Right": q.whyB || "",
      "Why C Is Wrong/Right": q.whyC || "",
      "Why D Is Wrong/Right": q.whyD || "",
      "Elimination Strategy": q.eliminationStrategy || "",
      "Common Trap": q.commonTrap || "",
      "Exam Day Tip": q.examTip || "",
      Difficulty: q.difficulty || "MEDIUM",
      Tags: tagsStr,
    };
  });

  return Papa.unparse(rows);
}