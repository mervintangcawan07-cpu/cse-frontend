import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { prisma } from "../src/lib/prisma";

async function inspectEverything() {
  console.log("=================================================================");
  console.log("🔍 COMPREHENSIVE QUESTION BANK INSPECTION");
  console.log("=================================================================");

  // 1. Inspect DB
  const allDb = await prisma.question.findMany({});
  console.log(`\n[DATABASE] Total rows in Question table: ${allDb.length}`);
  
  const activeDb = allDb.filter(q => q.deletedAt === null);
  const deletedDb = allDb.filter(q => q.deletedAt !== null);
  console.log(`  - Active: ${activeDb.length}`);
  console.log(`  - Deleted (soft-deleted): ${deletedDb.length}`);

  // Check categories
  const catBreakdown: Record<string, number> = {};
  for (const q of activeDb) {
    catBreakdown[q.category] = (catBreakdown[q.category] || 0) + 1;
  }
  console.log("\nActive Database Category Breakdown:");
  for (const [c, cnt] of Object.entries(catBreakdown)) {
    console.log(`  ${c}: ${cnt}`);
  }

  // Check all pairs in DB with same prompt (case-insensitive, whitespace stripped)
  const promptMap = new Map<string, typeof activeDb>();
  for (const q of activeDb) {
    const key = q.prompt.trim().toLowerCase().replace(/\s+/g, " ");
    if (!promptMap.has(key)) promptMap.set(key, []);
    promptMap.get(key)!.push(q);
  }

  let dbExactDupes = 0;
  for (const [p, group] of promptMap.entries()) {
    if (group.length > 1) {
      dbExactDupes++;
      console.log(`\nDB Exact Prompt Match (${group.length}x):`);
      console.log(`Prompt: "${p.substring(0, 100)}"`);
      group.forEach(g => console.log(`  ID: ${g.id} | Cat: ${g.category} | Sub: ${g.subtopic}`));
    }
  }
  console.log(`\nTotal DB exact prompt duplicate groups: ${dbExactDupes}`);

  // Check CSVs in cse-question-generator
  const csvDir = path.resolve(__dirname, "../cse-question-generator/generated_questions");
  const csvFiles = fs.readdirSync(csvDir).filter(f => f.endsWith(".csv"));
  console.log(`\n[CSV DIRECTORY] Total CSV files: ${csvFiles.length}`);

  // Check file duplicates (e.g. batch_007_Verbal vs batch_VA_001)
  const filePromptSets = new Map<string, string[]>();
  for (const file of csvFiles) {
    const content = fs.readFileSync(path.join(csvDir, file), "utf-8");
    const parsed = Papa.parse(content, { header: true, skipEmptyLines: "greedy" });
    const prompts = parsed.data
      .map((r: any) => (r["Question"] || r["question"] || r["prompt"] || "").trim().toLowerCase())
      .filter(p => p.length > 0);
    filePromptSets.set(file, prompts);
  }

  console.log("\nChecking for identical / duplicate CSV files:");
  const checkedPairs = new Set<string>();
  for (const f1 of csvFiles) {
    const p1 = filePromptSets.get(f1) || [];
    for (const f2 of csvFiles) {
      if (f1 >= f2) continue;
      const pairKey = `${f1}:::${f2}`;
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      const p2 = filePromptSets.get(f2) || [];
      if (p1.length > 0 && p2.length > 0) {
        const overlap = p1.filter(p => p2.includes(p));
        if (overlap.length === p1.length && p1.length === p2.length) {
          console.log(`\n⚠️ 100% IDENTICAL FILES DETECTED:`);
          console.log(`  File 1: ${f1}`);
          console.log(`  File 2: ${f2}`);
          console.log(`  Questions count: ${p1.length}`);
        } else if (overlap.length > 0) {
          console.log(`\n⚠️ PARTIAL OVERLAP DETECTED (${overlap.length} common questions):`);
          console.log(`  File 1: ${f1} (${p1.length} qs)`);
          console.log(`  File 2: ${f2} (${p2.length} qs)`);
        }
      }
    }
  }

  // Check other CSV files in root
  const rootFiles = ["numerical_reasoning_data_interpretation_25_updated.csv"];
  for (const rf of rootFiles) {
    const rPath = path.resolve(__dirname, `../${rf}`);
    if (fs.existsSync(rPath)) {
      const content = fs.readFileSync(rPath, "utf-8");
      const parsed = Papa.parse(content, { header: true, skipEmptyLines: "greedy" });
      console.log(`\n[ROOT FILE] ${rf}: parsed ${parsed.data.length} rows.`);
    }
  }
}

inspectEverything()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
