import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("===============================================================");
  console.log("🔍 AUDITING QUESTION BANK IN POSTGRESQL");
  console.log("===============================================================\n");

  const validCategories = [
    "Verbal Ability",
    "Numerical Reasoning",
    "Analytical Reasoning",
    "General Information",
    "Clerical Ability",
  ];

  const irregulars = await prisma.question.findMany({
    where: {
      deletedAt: null,
      NOT: {
        category: { in: validCategories },
      },
    },
  });

  console.log(`Found ${irregulars.length} records with irregular category names.\n`);

  for (const q of irregulars) {
    console.log(`ID: ${q.id}`);
    console.log(`  Raw Category: "${q.category}"`);
    console.log(`  Subtopic: "${q.subtopic}"`);
    console.log(`  Prompt (start): "${q.prompt?.substring(0, 70)}..."`);
    console.log(`  Tags:`, q.tags);
    console.log("----------------------------------------------------------------");
  }

  // Also check total counts by category
  const allCounts = await prisma.question.groupBy({
    by: ["category"],
    where: { deletedAt: null },
    _count: { id: true },
  });

  console.log("\nSummary of Active Questions by Category in Database:");
  for (const g of allCounts) {
    console.log(`  • "${g.category}": ${g._count.id} questions`);
  }

  const total = await prisma.question.count({ where: { deletedAt: null } });
  console.log(`\nTotal Active Questions in Database: ${total}\n`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
