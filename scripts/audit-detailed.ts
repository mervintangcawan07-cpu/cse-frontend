import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { prisma } from "../src/lib/prisma";

function cleanStr(s: any): string {
  if (!s) return "";
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}

function stripPunctuation(s: string): string {
  return s.replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function getChoiceString(q: any): string {
  if (Array.isArray(q.options) && q.options.length > 0) {
    return q.options.map((o: any) => cleanStr(o)).join(" | ");
  }
  return [q.optionA, q.optionB, q.optionC, q.optionD]
    .filter(Boolean)
    .map((o: any) => cleanStr(o))
    .join(" | ");
}

async function runDetailedInspection() {
  console.log("===============================================================");
  console.log("🔍 DETAILED REPETITION & SIMILARITY AUDIT");
  console.log("===============================================================\n");

  // 1. Fetch all DB questions
  const dbQuestions = await prisma.question.findMany({});
  console.log(`Total questions in database (including soft-deleted): ${dbQuestions.length}`);
  const activeQuestions = dbQuestions.filter(q => q.deletedAt === null);
  console.log(`Active questions: ${activeQuestions.length}`);

  // Test Exact / Normalized Matches
  const exactPromptGroups = new Map<string, typeof dbQuestions>();
  const normalizedPromptGroups = new Map<string, typeof dbQuestions>();
  const promptPlusChoicesGroups = new Map<string, typeof dbQuestions>();

  for (const q of activeQuestions) {
    const rawP = cleanStr(q.prompt);
    const normP = stripPunctuation(rawP);
    const choices = getChoiceString(q);
    const fullKey = `${normP}:::${choices}:::${q.answerIndex}`;

    if (!exactPromptGroups.has(rawP)) exactPromptGroups.set(rawP, []);
    exactPromptGroups.get(rawP)!.push(q);

    if (!normalizedPromptGroups.has(normP)) normalizedPromptGroups.set(normP, []);
    normalizedPromptGroups.get(normP)!.push(q);

    if (!promptPlusChoicesGroups.has(fullKey)) promptPlusChoicesGroups.set(fullKey, []);
    promptPlusChoicesGroups.get(fullKey)!.push(q);
  }

  console.log("\n--- DB RESULTS ---");
  let fullMatches = 0;
  for (const [key, group] of promptPlusChoicesGroups.entries()) {
    if (group.length > 1) {
      fullMatches++;
      console.log(`[DB Exact Dupe #${fullMatches}] Count: ${group.length}`);
      console.log(`Prompt: "${group[0].prompt?.substring(0, 100)}"`);
      console.log(`IDs: ${group.map(g => g.id).join(", ")}`);
    }
  }
  console.log(`DB exact full duplicate groups found: ${fullMatches}`);

  let normMatches = 0;
  for (const [normP, group] of normalizedPromptGroups.entries()) {
    if (group.length > 1) {
      normMatches++;
      console.log(`[DB Normalized Prompt Match #${normMatches}] Count: ${group.length}`);
      console.log(`Prompt: "${group[0].prompt?.substring(0, 100)}"`);
      group.forEach(g => {
        console.log(`  ID: ${g.id} | Cat: ${g.category} | Sub: ${g.subtopic} | Choices: ${getChoiceString(g)} | Ans: ${g.answerIndex}`);
      });
    }
  }
  console.log(`DB normalized prompt match groups found: ${normMatches}`);

  // 2. CSV Files Inspection
  console.log("\n--- CSV FILES INSPECTION ---");
  const GENERATED_DIR = path.resolve(__dirname, "../cse-question-generator/generated_questions");
  const files = fs.readdirSync(GENERATED_DIR).filter(f => f.endsWith(".csv"));
  console.log(`Total CSV files: ${files.length}`);

  interface CsvItem {
    file: string;
    rowIdx: number;
    rawPrompt: string;
    cleanPrompt: string;
    normPrompt: string;
    choicesStr: string;
    normChoicesStr: string;
    answer: string;
    rawRow: any;
  }

  const allCsvItems: CsvItem[] = [];
  const csvExactFullMap = new Map<string, CsvItem[]>();
  const csvNormFullMap = new Map<string, CsvItem[]>();
  const csvNormPromptMap = new Map<string, CsvItem[]>();

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
      if (!rawPrompt) return;

      const optA = (row["Option A"] || row["optionA"] || row["option_a"] || "").trim();
      const optB = (row["Option B"] || row["optionB"] || row["option_b"] || "").trim();
      const optC = (row["Option C"] || row["optionC"] || row["option_c"] || "").trim();
      const optD = (row["Option D"] || row["optionD"] || row["option_d"] || "").trim();
      const ans = (row["Correct Answer"] || row["correctAnswer"] || row["answerIndex"] || "").trim();

      const cleanP = cleanStr(rawPrompt);
      const normP = stripPunctuation(cleanP);
      const choicesStr = [optA, optB, optC, optD].map(o => cleanStr(o)).join(" | ");
      const normChoicesStr = [optA, optB, optC, optD].map(o => stripPunctuation(cleanStr(o))).join(" | ");
      const fullKey = `${cleanP}:::${choicesStr}:::${cleanStr(ans)}`;
      const normFullKey = `${normP}:::${normChoicesStr}:::${cleanStr(ans)}`;

      const item: CsvItem = {
        file,
        rowIdx: idx,
        rawPrompt,
        cleanPrompt: cleanP,
        normPrompt: normP,
        choicesStr,
        normChoicesStr,
        answer: ans,
        rawRow: row,
      };

      allCsvItems.push(item);

      if (!csvExactFullMap.has(fullKey)) csvExactFullMap.set(fullKey, []);
      csvExactFullMap.get(fullKey)!.push(item);

      if (!csvNormFullMap.has(normFullKey)) csvNormFullMap.set(normFullKey, []);
      csvNormFullMap.get(normFullKey)!.push(item);

      if (!csvNormPromptMap.has(normP)) csvNormPromptMap.set(normP, []);
      csvNormPromptMap.get(normP)!.push(item);
    });
  }

  console.log(`Total valid CSV rows parsed: ${allCsvItems.length}`);

  let csvExactDuplicatesCount = 0;
  console.log("\nExact duplicate questions across CSV files:");
  for (const [key, group] of csvNormFullMap.entries()) {
    if (group.length > 1) {
      csvExactDuplicatesCount += (group.length - 1);
      console.log(`\n[CSV Dupe Group (${group.length} occurrences)]`);
      console.log(`Prompt: "${group[0].rawPrompt.substring(0, 100)}"`);
      console.log(`Choices: ${group[0].choicesStr}`);
      console.log(`Answer: ${group[0].answer}`);
      group.forEach(g => {
        console.log(`  - File: ${g.file} (row ${g.rowIdx + 1})`);
      });
    }
  }
  console.log(`\nTotal redundant exact duplicates across CSV files: ${csvExactDuplicatesCount}`);

  // Inspect Verbal duplicate batches specifically
  const vaFiles = files.filter(f => f.startsWith("batch_VA_"));
  console.log(`\nFound ${vaFiles.length} batch_VA_* files. Checking overlap with batch_001-024...`);
  for (const vaFile of vaFiles) {
    const num = vaFile.match(/^batch_VA_(\d+)/)?.[1];
    if (num) {
      const matchBatch = files.find(f => f.startsWith(`batch_${num}_`));
      if (matchBatch) {
        console.log(`  Matching pair: ${vaFile} <-> ${matchBatch}`);
      }
    }
  }
}

runDetailedInspection()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
