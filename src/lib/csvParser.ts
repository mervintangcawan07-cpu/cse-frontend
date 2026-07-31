import Papa from "papaparse";

export interface RawQuestionItem {
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string | null;
  imageUrl?: string | null;
}

/**
 * 📄 Parses raw CSV text into structured question objects using PapaParse.
 * Expected CSV Headers:
 * category, prompt, imageUrl, optionA, optionB, optionC, optionD, answerIndex, explanation
 */
export function parseCSVToQuestions(csvText: string): RawQuestionItem[] {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (!parsed.data || parsed.data.length === 0) return [];

  return parsed.data
    .map((item: any) => {
      // 1. Extract and sanitize core fields
      const category = String(item.category || item.subject || "").trim();
      const prompt = String(item.prompt || item.question || "").trim();
      const explanation = item.explanation ? String(item.explanation).trim() : null;
      const imageUrl = (item.imageUrl || item.image_url || item.image || "").trim() || null;

      // 2. Extract options array cleanly
      let options: string[] = [];
      if (Array.isArray(item.options)) {
        options = item.options.map((o: any) => String(o).trim());
      } else {
        options = [
          item.optionA || item.option_a || "",
          item.optionB || item.option_b || "",
          item.optionC || item.option_c || "",
          item.optionD || item.option_d || "",
        ]
          .map((o) => String(o).trim())
          .filter(Boolean);
      }

      // 3. Extract correct answer index
      let answerIndex = 0;
      if (typeof item.answerIndex === "number") {
        answerIndex = item.answerIndex;
      } else if (typeof item.answerIndex === "string") {
        answerIndex = parseInt(item.answerIndex, 10) || 0;
      } else if (typeof item.correctAnswer === "number") {
        answerIndex = item.correctAnswer;
      }

      return {
        category,
        prompt,
        options,
        answerIndex,
        explanation,
        imageUrl,
      };
    })
    .filter((q) => q.prompt && q.category && q.options.length >= 2);
}

/**
 * 📥 Generates a downloadable sample CSV template for Admins
 */
export function downloadCSVTemplate() {
  const headers = "category,prompt,imageUrl,optionA,optionB,optionC,optionD,answerIndex,explanation\n";
  
  // Sample 1: Standard Question
  const sampleRow1 = `"Numerical Reasoning","What is 15% of 300?","","45","3,000","-15","90",0,"15% of 300 is 0.15 * 300 = 45."\n`;
  
  // Sample 2: Data Interpretation with HTML Table
  const sampleRow2 = `"Numerical Reasoning","Refer to the data table: <table border='1'><tr><th>Year</th><th>Sales</th></tr><tr><td>2022</td><td>$50,000</td></tr></table> What was the sales value in 2022?","","$50,000","$60,000","$40,000","$30,000",0,"Table displays $50,000 for 2022."\n`;
  
  // Sample 3: Question with Chart Image
  const sampleRow3 = `"Numerical Reasoning","Based on the chart shown, which month had the highest revenue?","/charts/chart1.png","January","March","July","October",2,"July peaked at $80k on the graph."\n`;

  const csvContent = headers + sampleRow1 + sampleRow2 + sampleRow3;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "cse_question_import_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}