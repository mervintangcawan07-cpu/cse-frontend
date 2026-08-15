import fs from "fs";
import path from "path";
import Papa from "papaparse";

const GENERATED_DIR = path.resolve(__dirname, "../cse-question-generator/generated_questions");

interface CleanQuestion {
  Question: string;
  "Option A": string;
  "Option B": string;
  "Option C": string;
  "Option D": string;
  "Correct Answer": string;
  Explanation: string;
  "Elimination A"?: string;
  "Elimination B"?: string;
  "Elimination C"?: string;
  "Elimination D"?: string;
  Category?: string;
  Tags?: string;
}

function isSpuriousFragment(prompt: string): boolean {
  const p = prompt.trim();
  if (p.length < 15) return true;
  if (/^(?:1\.|2\.|3\.|4\.|5\.|6\.|7\.|8\.|9\.|-|\*)\s*(?:Evaluate|Therefore|Thus|Option|Step|Conclude|Given)/i.test(p)) {
    // If it is just an explanation fragment
    if (/Evaluate incorrect alternatives/i.test(p) || /Conclude:/i.test(p) || /is a necessary.*assumption/i.test(p)) {
      return true;
    }
  }
  if (p.startsWith("Step-by-Step Solution") || p.startsWith("Common Trap:") || p.startsWith("Exam Tip:")) {
    return true;
  }
  return false;
}

async function sanitizeAllCsvs() {
  console.log("=================================================================");
  console.log("🧹 SANITIZING ALL CSV FILES IN GENERATED_QUESTIONS");
  console.log("=================================================================");

  const files = fs.readdirSync(GENERATED_DIR).filter(f => f.endsWith(".csv")).sort();
  console.log(`Found ${files.length} CSV files to process.`);

  let totalQuestionsKept = 0;
  let totalFragmentsRemoved = 0;
  let filesModified = 0;

  for (const file of files) {
    const filePath = path.join(GENERATED_DIR, file);
    const rawContent = fs.readFileSync(filePath, "utf-8");

    // Parse with Papa
    const parsed = Papa.parse(rawContent, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: h => h.trim(),
    });

    const validQuestions: CleanQuestion[] = [];
    let fragmentsInFile = 0;

    for (let i = 0; i < parsed.data.length; i++) {
      const row: any = parsed.data[i];
      const prompt = (row["Question"] || row["question"] || row["prompt"] || "").trim();
      const optA = (row["Option A"] || row["optionA"] || row["option_a"] || "").trim();
      const optB = (row["Option B"] || row["optionB"] || row["option_b"] || "").trim();
      const optC = (row["Option C"] || row["optionC"] || row["option_c"] || "").trim();
      const optD = (row["Option D"] || row["optionD"] || row["option_d"] || "").trim();
      const ans = (row["Correct Answer"] || row["correctAnswer"] || row["answerIndex"] || "").trim();
      const expl = (row["Explanation"] || row["explanation"] || "").trim();
      const whyA = (row["Elimination A"] || row["whyA"] || "").trim();
      const whyB = (row["Elimination B"] || row["whyB"] || "").trim();
      const whyC = (row["Elimination C"] || row["whyC"] || "").trim();
      const whyD = (row["Elimination D"] || row["whyD"] || "").trim();
      const cat = (row["Category"] || row["category"] || "").trim();
      const tags = (row["Tags"] || row["tags"] || "").trim();

      const options = [optA, optB, optC, optD].filter(Boolean);

      // Check if it's a spurious fragment or missing required options
      if (!prompt || options.length < 2 || isSpuriousFragment(prompt)) {
        fragmentsInFile++;
        continue;
      }

      validQuestions.push({
        Question: prompt,
        "Option A": optA,
        "Option B": optB,
        "Option C": optC,
        "Option D": optD,
        "Correct Answer": ans || "A",
        Explanation: expl,
        "Elimination A": whyA,
        "Elimination B": whyB,
        "Elimination C": whyC,
        "Elimination D": whyD,
        Category: cat,
        Tags: tags,
      });
    }

    totalQuestionsKept += validQuestions.length;
    totalFragmentsRemoved += fragmentsInFile;

    // Check if file needed cleaning
    if (fragmentsInFile > 0 || parsed.data.length !== validQuestions.length) {
      filesModified++;
      console.log(`🧼 Cleaned ${file}: Removed ${fragmentsInFile} fragment rows. Remaining valid questions: ${validQuestions.length}`);
      
      // Rewrite clean CSV
      const cleanCsv = Papa.unparse(validQuestions, {
        quotes: true,
        header: true,
      });
      fs.writeFileSync(filePath, cleanCsv, "utf-8");
    }
  }

  console.log(`\nSanitization Complete!`);
  console.log(`  Total Files Checked: ${files.length}`);
  console.log(`  Files Modified: ${filesModified}`);
  console.log(`  Spurious Fragments Removed: ${totalFragmentsRemoved}`);
  console.log(`  Total Valid Questions in Question Bank CSVs: ${totalQuestionsKept}`);
}

sanitizeAllCsvs().catch(console.error);
