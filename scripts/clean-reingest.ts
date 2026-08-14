import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { prisma } from "../src/lib/prisma";

const GENERATED_DIR = path.resolve(__dirname, "../cse-question-generator/generated_questions");

function normalizeCategory(filename: string): string {
  const f = filename.toLowerCase();
  if (f.includes("verbal_ability")) return "Verbal Ability";
  if (f.includes("numerical_ability") || f.includes("numerical_reasoning")) return "Numerical Reasoning";
  if (f.includes("analytical_ability") || f.includes("analytical_reasoning")) return "Analytical Reasoning";
  if (f.includes("general_information")) return "General Information";
  return "General Information";
}

function extractSubtopic(filename: string): string {
  const baseName = path.basename(filename, ".csv");
  const parts = baseName.replace(/^batch_\d+_/, "").split("-");
  
  if (parts.length >= 2) {
    const component = parts[1].replace(/_/g, " ").trim();
    const sub = parts.length >= 3 ? parts[2].replace(/_/g, " ").trim() : "";
    if (sub && sub !== component && !component.includes(sub)) {
      return `${component} - ${sub}`;
    }
    return component;
  }
  return "General";
}

function parseAnswerIndex(raw: any, options: string[]): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  const str = String(raw).trim().toUpperCase();
  if (str === "A" || str.startsWith("A.") || str.startsWith("A)")) return 0;
  if (str === "B" || str.startsWith("B.") || str.startsWith("B)")) return 1;
  if (str === "C" || str.startsWith("C.") || str.startsWith("C)")) return 2;
  if (str === "D" || str.startsWith("D.") || str.startsWith("D)")) return 3;
  const num = parseInt(str, 10);
  if (!isNaN(num)) {
    if (num >= 1 && num <= 4) return num - 1;
    return num;
  }
  const matchIdx = options.findIndex((opt) => opt.toLowerCase() === String(raw).trim().toLowerCase());
  if (matchIdx !== -1) return matchIdx;
  return 0;
}

function extractStepByStep(explanation: string | null): string | null {
  if (!explanation) return null;
  const match = explanation.match(/(?:Step-by-Step Solution|Step-by-step Solution|Solution:?)([\s\S]*?)(?:Common Trap:|Exam Tip:|$)/i);
  return match ? match[1].trim() : null;
}

function extractCommonTrap(explanation: string | null): string | null {
  if (!explanation) return null;
  const match = explanation.match(/Common Trap:([\s\S]*?)(?:Exam Tip:|$)/i);
  return match ? match[1].trim() : null;
}

function extractExamTip(explanation: string | null): string | null {
  if (!explanation) return null;
  const match = explanation.match(/Exam Tip:([\s\S]*?)$/i);
  return match ? match[1].trim() : null;
}

async function main() {
  console.log("===============================================================");
  console.log("🚀 PRECISE RE-INGESTION & CLEANUP: 181 CSV FILES");
  console.log("===============================================================\n");

  const files = fs
    .readdirSync(GENERATED_DIR)
    .filter((f) => f.startsWith("batch_") && f.endsWith(".csv"))
    .sort((a, b) => {
      const numA = parseInt(a.match(/^batch_(\d+)/)?.[1] || "0", 10);
      const numB = parseInt(b.match(/^batch_(\d+)/)?.[1] || "0", 10);
      return numA - numB;
    });

  console.log(`Found ${files.length} CSV files.\n`);

  const allQuestionsToInsert: any[] = [];
  const categoryStats: Record<string, number> = {};

  for (const file of files) {
    const filePath = path.join(GENERATED_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");

    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    });

    const category = normalizeCategory(file);
    const subtopic = extractSubtopic(file);
    const batchNum = file.match(/^batch_(\d+)/)?.[1] || "000";

    let validRowsInFile = 0;

    for (let rowIdx = 0; rowIdx < parsed.data.length; rowIdx++) {
      const row: any = parsed.data[rowIdx];
      const prompt = (row["Question"] || row["question"] || row["prompt"] || "").trim();
      const optA = (row["Option A"] || row["optionA"] || row["option_a"] || "").trim();
      const optB = (row["Option B"] || row["optionB"] || row["option_b"] || "").trim();
      const optC = (row["Option C"] || row["optionC"] || row["option_c"] || "").trim();
      const optD = (row["Option D"] || row["optionD"] || row["option_d"] || "").trim();

      const options = [optA, optB, optC, optD].filter(Boolean);

      if (!prompt || options.length < 2) {
        continue;
      }

      const answerIndex = parseAnswerIndex(row["Correct Answer"] || row["correctAnswer"] || row["answerIndex"], options);
      const explanation = (row["Explanation"] || row["explanation"] || "").trim() || null;
      const whyA = (row["Elimination A"] || row["whyA"] || "").trim() || null;
      const whyB = (row["Elimination B"] || row["whyB"] || "").trim() || null;
      const whyC = (row["Elimination C"] || row["whyC"] || "").trim() || null;
      const whyD = (row["Elimination D"] || row["whyD"] || "").trim() || null;

      const rawTags = (row["Tags"] || row["tags"] || "").trim();
      const tagsList = rawTags
        ? rawTags.split("|").map((t: string) => t.trim()).filter(Boolean)
        : [];

      if (!tagsList.includes(`Batch ${batchNum}`)) {
        tagsList.push(`Batch ${batchNum}`);
      }

      const stepByStep = extractStepByStep(explanation);
      const commonTrap = extractCommonTrap(explanation);
      const examTip = extractExamTip(explanation);

      allQuestionsToInsert.push({
        category: category,
        subtopic: subtopic,
        prompt: prompt,
        options: options,
        optionA: optA || (options[0] ?? null),
        optionB: optB || (options[1] ?? null),
        optionC: optC || (options[2] ?? null),
        optionD: optD || (options[3] ?? null),
        answerIndex: Math.max(0, Math.min(answerIndex, options.length - 1)),
        explanation: explanation,
        stepByStep: stepByStep,
        whyA: whyA,
        whyB: whyB,
        whyC: whyC,
        whyD: whyD,
        eliminationStrategy: whyA && whyB ? `Analyze all choices carefully. Avoid common traps.` : null,
        commonTrap: commonTrap,
        examTip: examTip,
        difficulty: "HARD",
        tags: tagsList,
        skillTested: subtopic,
      });

      categoryStats[category] = (categoryStats[category] || 0) + 1;
      validRowsInFile++;
    }

    if (validRowsInFile !== 10) {
      console.log(`ℹ️ ${file}: parsed ${validRowsInFile} questions.`);
    }
  }

  console.log(`\nTotal Valid Questions Prepared: ${allQuestionsToInsert.length}`);
  console.log("Category Breakdown:");
  for (const [cat, count] of Object.entries(categoryStats)) {
    console.log(`  • ${cat}: ${count} questions`);
  }

  console.log("\nClearing old batches and inserting fresh validated question bank...");

  // Delete all existing questions to ensure clean state
  await prisma.question.deleteMany({});

  const CHUNK_SIZE = 100;
  let inserted = 0;
  for (let i = 0; i < allQuestionsToInsert.length; i += CHUNK_SIZE) {
    const chunk = allQuestionsToInsert.slice(i, i + CHUNK_SIZE);
    const res = await prisma.question.createMany({ data: chunk });
    inserted += res.count;
  }

  console.log(`\nSuccessfully inserted ${inserted} structured questions into PostgreSQL database!`);

  // Final Audit
  const dbCounts = await prisma.question.groupBy({
    by: ["category"],
    where: { deletedAt: null },
    _count: { id: true },
  });

  console.log("\n===============================================================");
  console.log("📊 FINAL VERIFIED DATABASE AUDIT");
  console.log("===============================================================");
  for (const g of dbCounts) {
    console.log(`  • ${g.category}: ${g._count.id} questions`);
  }

  const distinctSubtopics = await prisma.question.groupBy({
    by: ["subtopic"],
    where: { deletedAt: null },
    _count: { id: true },
  });
  console.log(`\nTotal Subtopics Covered: ${distinctSubtopics.length}`);

  const grandTotal = await prisma.question.count({ where: { deletedAt: null } });
  console.log(`GRAND TOTAL ACTIVE QUESTIONS: ${grandTotal}`);
  console.log("===============================================================\n");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
