const fs = require("fs");
const path = require("path");

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
let schema = fs.readFileSync(schemaPath, "utf8");

const modelsToUpdate = ["EliminationDrill", "Question", "Flashcard", "ReadingPassage", "SystemSetting"];

modelsToUpdate.forEach((modelName) => {
  const modelRegex = new RegExp(`(model\\s+${modelName}\\s*{[\\s\\S]*?)(})`, "g");
  
  if (modelRegex.test(schema)) {
    schema = schema.replace(modelRegex, (match, p1, p2) => {
      if (p1.includes("deletedAt")) return match; // Already updated
      return `${p1}  deletedAt  DateTime?\n  deletedBy  String?\n\n  @@index([deletedAt])\n${p2}`;
    });
    console.log(`✅ Added soft delete fields to model: ${modelName}`);
  } else {
    console.log(`ℹ️ Model ${modelName} not found in schema or already updated.`);
  }
});

fs.writeFileSync(schemaPath, schema, "utf8");
console.log("🚀 Schema updated successfully.");
