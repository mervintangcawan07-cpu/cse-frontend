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

async function deduplicateAndPurge() {
  console.log("=================================================================");
  console.log("🗑️ PURGING & DEDUPLICATING POSTGRESQL QUESTION BANK");
  console.log("=================================================================");

  // 1. Permanently remove all soft-deleted questions
  const softDeletedResult = await prisma.question.deleteMany({
    where: {
      NOT: { deletedAt: null },
    },
  });
  console.log(`\n1. Purged ${softDeletedResult.count} soft-deleted questions from database permanently.`);

  // 2. Fetch all remaining questions
  const allQuestions = await prisma.question.findMany({
    orderBy: { createdAt: "asc" },
  });
  console.log(`2. Total remaining questions in database: ${allQuestions.length}`);

  // 3. Check for exact full duplicates (normalized prompt + normalized choices + answerIndex)
  const seenMap = new Map<string, string>(); // key -> canonical question ID
  const duplicateIdsToDelete: string[] = [];

  for (const q of allQuestions) {
    const normP = stripPunctuation(cleanStr(q.prompt));
    const choices = getChoiceString(q);
    const key = `${normP}:::${choices}:::${q.answerIndex}`;

    if (seenMap.has(key)) {
      duplicateIdsToDelete.push(q.id);
      console.log(`  Found duplicate question: ID ${q.id} (matches canonical ID ${seenMap.get(key)})`);
    } else {
      seenMap.set(key, q.id);
    }
  }

  if (duplicateIdsToDelete.length > 0) {
    console.log(`\nDeleting ${duplicateIdsToDelete.length} duplicate questions...`);
    const deleteRes = await prisma.question.deleteMany({
      where: {
        id: { in: duplicateIdsToDelete },
      },
    });
    console.log(`Permanently deleted ${deleteRes.count} duplicate questions.`);
  } else {
    console.log("\nZero duplicate questions found in database. All active questions are unique!");
  }

  // 4. Final Database Audit
  const finalCount = await prisma.question.count();
  const catBreakdown = await prisma.question.groupBy({
    by: ["category"],
    _count: { id: true },
  });

  console.log("\n=================================================================");
  console.log("📊 FINAL VERIFIED DATABASE AUDIT");
  console.log("=================================================================");
  console.log(`Grand Total Questions in Database: ${finalCount}`);
  for (const g of catBreakdown) {
    console.log(`  • ${g.category}: ${g._count.id} questions`);
  }
  console.log("=================================================================\n");
}

deduplicateAndPurge()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
