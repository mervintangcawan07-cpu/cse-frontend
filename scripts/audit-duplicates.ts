import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { prisma } from "../src/lib/prisma";

function normalizeText(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function normalizeStrict(str: string | null | undefined): string {
  if (!str) return "";
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

// Compute Levenshtein distance for fuzzy matching
function similarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;

  // quick check
  if (longer.includes(shorter) && shorter.length / longer.length > 0.85) {
    return shorter.length / longer.length;
  }

  // fast ngram similarity for speed
  const n = 3;
  if (longer.length < n || shorter.length < n) {
    return s1 === s2 ? 1 : 0;
  }
  const getGrams = (s: string) => {
    const grams = new Map<string, number>();
    for (let i = 0; i <= s.length - n; i++) {
      const g = s.substring(i, i + n);
      grams.set(g, (grams.get(g) || 0) + 1);
    }
    return grams;
  };
  const g1 = getGrams(s1);
  const g2 = getGrams(s2);
  let intersection = 0;
  for (const [gram, count] of g1.entries()) {
    if (g2.has(gram)) {
      intersection += Math.min(count, g2.get(gram)!);
    }
  }
  return (2.0 * intersection) / (s1.length - n + 1 + s2.length - n + 1);
}

async function runDeepAudit() {
  console.log("=================================================================");
  console.log("🔍 DEEP AUDIT: DATABASE QUESTIONS");
  console.log("=================================================================");

  const allDbQuestions = await prisma.question.findMany({
    where: { deletedAt: null },
  });

  console.log(`Loaded ${allDbQuestions.length} active questions from DB.`);

  // Check 1: Exact / normalized prompt duplicates
  const normPromptGroups = new Map<string, typeof allDbQuestions>();
  const malformedQuestions: typeof allDbQuestions = [];

  for (const q of allDbQuestions) {
    const norm = normalizeText(q.prompt);
    if (!normPromptGroups.has(norm)) {
      normPromptGroups.set(norm, []);
    }
    normPromptGroups.get(norm)!.push(q);

    // Check for obvious malformed/garbage prompts
    const promptTrim = (q.prompt || "").trim();
    if (
      promptTrim.length < 15 ||
      /^(?:1\.|2\.|3\.|4\.|5\.|6\.|7\.|8\.|9\.|-|\*)\s*(?:Evaluate|Therefore|Thus|Option|Step)/i.test(promptTrim) ||
      promptTrim.startsWith("Step-by-Step") ||
      promptTrim.startsWith("Exam Tip:") ||
      promptTrim.startsWith("Common Trap:")
    ) {
      malformedQuestions.push(q);
    }
  }

  console.log(`\n1. Checking normalized prompt duplicates in DB:`);
  let dupeGroupsCount = 0;
  let dupeQuestionsCount = 0;

  for (const [norm, group] of normPromptGroups.entries()) {
    if (group.length > 1) {
      dupeGroupsCount++;
      dupeQuestionsCount += (group.length - 1);
      console.log(`\n[Dupe Group #${dupeGroupsCount}] Prompt: "${group[0].prompt?.substring(0, 90)}..."`);
      console.log(`  Count: ${group.length}`);
      group.forEach((item, i) => {
        console.log(`  (${i + 1}) ID: ${item.id} | Cat: ${item.category} | Sub: ${item.subtopic} | Ans: ${item.answerIndex} | Opts: ${JSON.stringify(item.options || [item.optionA, item.optionB, item.optionC, item.optionD])}`);
      });
    }
  }

  if (dupeGroupsCount === 0) {
    console.log("  No exact or normalized prompt duplicates found in DB.");
  } else {
    console.log(`\n  Found ${dupeGroupsCount} duplicate groups with ${dupeQuestionsCount} redundant questions in DB.`);
  }

  console.log(`\n2. Checking malformed / fragment questions in DB:`);
  console.log(`  Found ${malformedQuestions.length} suspicious/malformed questions in DB.`);
  for (const mq of malformedQuestions) {
    console.log(`  ID: ${mq.id} | Prompt: "${mq.prompt?.substring(0, 80)}" | Cat: ${mq.category}`);
  }

  // Check 3: Check across batches in CSV files
  console.log("\n=================================================================");
  console.log("🔍 DEEP AUDIT: CSV FILES IN cse-question-generator");
  console.log("=================================================================");

  const GENERATED_DIR = path.resolve(__dirname, "../cse-question-generator/generated_questions");
  const files = fs.readdirSync(GENERATED_DIR).filter(f => f.endsWith(".csv"));
  console.log(`Auditing ${files.length} CSV files...`);

  interface CSVRowAudit {
    file: string;
    rowIdx: number;
    rawPrompt: string;
    normPrompt: string;
    options: string[];
    normOptions: string;
    correctAnswer: string;
    fullKey: string;
    row: any;
  }

  const allCsvRows: CSVRowAudit[] = [];
  const csvNormPromptMap = new Map<string, CSVRowAudit[]>();
  const csvExactFullMap = new Map<string, CSVRowAudit[]>();
  const malformedCsvRows: CSVRowAudit[] = [];

  for (const file of files) {
    const filePath = path.join(GENERATED_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: h => h.trim(),
    });

    parsed.data.forEach((row: any, idx) => {
      const rawPrompt = (row["Question"] || row["question"] || row["prompt"] || "").trim();
      const optA = (row["Option A"] || row["optionA"] || row["option_a"] || "").trim();
      const optB = (row["Option B"] || row["optionB"] || row["option_b"] || "").trim();
      const optC = (row["Option C"] || row["optionC"] || row["option_c"] || "").trim();
      const optD = (row["Option D"] || row["optionD"] || row["option_d"] || "").trim();
      const ans = (row["Correct Answer"] || row["correctAnswer"] || row["answerIndex"] || "").trim();

      if (!rawPrompt) return;

      const normP = normalizeText(rawPrompt);
      const opts = [optA, optB, optC, optD];
      const normOpts = opts.map(o => normalizeText(o)).join("||");
      const fullKey = `${normP}:::${normOpts}:::${ans.toLowerCase()}`;

      const rec: CSVRowAudit = {
        file,
        rowIdx: idx,
        rawPrompt,
        normPrompt: normP,
        options: opts,
        normOptions: normOpts,
        correctAnswer: ans,
        fullKey,
        row,
      };

      allCsvRows.push(rec);

      if (!csvNormPromptMap.has(normP)) csvNormPromptMap.set(normP, []);
      csvNormPromptMap.get(normP)!.push(rec);

      if (!csvExactFullMap.has(fullKey)) csvExactFullMap.set(fullKey, []);
      csvExactFullMap.get(fullKey)!.push(rec);

      if (
        rawPrompt.length < 15 ||
        /^(?:1\.|2\.|3\.|4\.|5\.|6\.|7\.|8\.|9\.|-|\*)\s*(?:Evaluate|Therefore|Thus|Option|Step)/i.test(rawPrompt) ||
        rawPrompt.startsWith("Step-by-Step") ||
        rawPrompt.startsWith("Exam Tip:") ||
        rawPrompt.startsWith("Common Trap:") ||
        opts.filter(Boolean).length < 2
      ) {
        malformedCsvRows.push(rec);
      }
    });
  }

  console.log(`Parsed ${allCsvRows.length} total rows from all CSV files.`);

  let csvExactDupesCount = 0;
  console.log("\n--- CSV EXACT REPEATS (Identical Prompt + Choices + Answer across CSVs) ---");
  for (const [key, group] of csvExactFullMap.entries()) {
    if (group.length > 1) {
      csvExactDupesCount += (group.length - 1);
      console.log(`\n[Dupe (${group.length}x)] Prompt: "${group[0].rawPrompt.substring(0, 80)}..."`);
      group.forEach((g, i) => {
        console.log(`  File: ${g.file} (row ${g.rowIdx + 1})`);
      });
    }
  }
  console.log(`\nTotal redundant questions across CSV files: ${csvExactDupesCount}`);

  console.log(`\n--- MALFORMED CSV ROWS (Explanation fragments parsed as questions) ---`);
  console.log(`Found ${malformedCsvRows.length} malformed CSV rows.`);
  const malformedFiles = new Set(malformedCsvRows.map(r => r.file));
  console.log(`Files containing malformed rows (${malformedFiles.size} files):`, Array.from(malformedFiles));

  // Check 4: Similar questions (fuzzy comparison)
  console.log("\n=================================================================");
  console.log("🔍 FUZZY SIMILARITY CHECK (Questions with > 90% wording similarity)");
  console.log("=================================================================");

  // Compare within same category in DB
  const catMap = new Map<string, typeof allDbQuestions>();
  for (const q of allDbQuestions) {
    if (!catMap.has(q.category)) catMap.set(q.category, []);
    catMap.get(q.category)!.push(q);
  }

  let fuzzySimilarCount = 0;
  for (const [cat, qList] of catMap.entries()) {
    console.log(`Checking category "${cat}" (${qList.length} questions)...`);
    for (let i = 0; i < qList.length; i++) {
      for (let j = i + 1; j < qList.length; j++) {
        const q1 = qList[i];
        const q2 = qList[j];
        const n1 = normalizeText(q1.prompt);
        const n2 = normalizeText(q2.prompt);
        if (n1.length < 20 || n2.length < 20) continue;
        if (Math.abs(n1.length - n2.length) > Math.min(n1.length, n2.length) * 0.25) continue;

        const sim = similarity(n1, n2);
        if (sim >= 0.90 && n1 !== n2) {
          fuzzySimilarCount++;
          console.log(`\n[Similar Pair #${fuzzySimilarCount}] (Sim: ${(sim * 100).toFixed(1)}%) | Cat: ${cat}`);
          console.log(`  Q1 (ID: ${q1.id}, Sub: ${q1.subtopic}): "${q1.prompt.substring(0, 100)}..."`);
          console.log(`     Opts: ${JSON.stringify(q1.options)} | Ans: ${q1.answerIndex}`);
          console.log(`  Q2 (ID: ${q2.id}, Sub: ${q2.subtopic}): "${q2.prompt.substring(0, 100)}..."`);
          console.log(`     Opts: ${JSON.stringify(q2.options)} | Ans: ${q2.answerIndex}`);
        }
      }
    }
  }

  console.log(`\nTotal highly similar (>90%) question pairs in DB: ${fuzzySimilarCount}`);
}

runDeepAudit()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
