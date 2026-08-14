import { prisma } from "../src/lib/prisma";

// Simulation of /api/exam/start logic
const CSE_CATEGORY_QUOTAS: Record<string, number> = {
  "Verbal Ability": 50,
  "Numerical Reasoning": 45,
  "Analytical Reasoning": 45,
  "General Information": 30,
};

const ALL_CATEGORIES = Object.keys(CSE_CATEGORY_QUOTAS);

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function main() {
  console.log("===============================================================");
  console.log("🧪 TESTING MOCK EXAM POOL GENERATION (170-ITEM BLUEPRINT)");
  console.log("===============================================================\n");

  const allQuestions = await prisma.question.findMany({
    where: {
      deletedAt: null,
      category: { in: ALL_CATEGORIES, mode: "insensitive" },
      NOT: [
        { category: { equals: "Elimination Drill", mode: "insensitive" } },
        { subtopic: { contains: "Elimination Drill", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      category: true,
      subtopic: true,
      prompt: true,
      options: true,
      answerIndex: true,
      explanation: true,
      whyA: true,
      whyB: true,
      whyC: true,
      whyD: true,
      commonTrap: true,
      examTip: true,
    },
  });

  console.log(`Total candidate questions fetched: ${allQuestions.length}`);

  const categoryMap: Record<string, typeof allQuestions> = {};
  for (const q of allQuestions) {
    const catKey = q.category || "General Information";
    const matchedKey =
      ALL_CATEGORIES.find((c) => c.toLowerCase() === catKey.toLowerCase()) || catKey;

    if (!categoryMap[matchedKey]) {
      categoryMap[matchedKey] = [];
    }
    categoryMap[matchedKey].push(q);
  }

  let finalExamQuestions: any[] = [];

  for (const [catName, catQuota] of Object.entries(CSE_CATEGORY_QUOTAS)) {
    const catQuestions = categoryMap[catName] || [];
    console.log(`  • Processing ${catName}: Quota = ${catQuota} (Available = ${catQuestions.length})`);

    // Group by subtopic
    const subtopicMap: Record<string, typeof catQuestions> = {};
    for (const q of catQuestions) {
      const sub = q.subtopic?.trim() || "General";
      if (!subtopicMap[sub]) subtopicMap[sub] = [];
      subtopicMap[sub].push(q);
    }

    const subtopics = Object.keys(subtopicMap);
    const subtopicCount = subtopics.length || 1;
    const baseQuotaPerSubtopic = Math.floor(catQuota / subtopicCount);
    let remainder = catQuota % subtopicCount;

    let categoryPickedQuestions: any[] = [];
    const pickedIdsInCat = new Set<string>();

    for (const sub of subtopics) {
      const subQuota = baseQuotaPerSubtopic + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      if (subQuota <= 0) continue;

      const subPool = subtopicMap[sub] || [];
      const shuffled = shuffleArray(subPool);
      const picked = shuffled.slice(0, subQuota);

      picked.forEach((q) => {
        categoryPickedQuestions.push(q);
        pickedIdsInCat.add(q.id);
      });
    }

    if (categoryPickedQuestions.length < catQuota) {
      const catMissing = catQuota - categoryPickedQuestions.length;
      const unpickedInCat = catQuestions.filter((q) => !pickedIdsInCat.has(q.id));
      const fillers = shuffleArray(unpickedInCat).slice(0, catMissing);
      categoryPickedQuestions.push(...fillers);
    }

    const finalCatPicked = shuffleArray(categoryPickedQuestions).slice(0, catQuota);
    console.log(`    ↳ Picked ${finalCatPicked.length} items for ${catName} across ${subtopics.length} subtopics.`);
    finalExamQuestions.push(...finalCatPicked);
  }

  console.log(`\nTotal Mock Exam Items Generated: ${finalExamQuestions.length} / 170 items.`);

  if (finalExamQuestions.length === 170) {
    console.log("✅ PERFECT: Full 170-item Mock Exam Pool successfully assembled!");
  } else {
    console.log(`⚠️ Assembled ${finalExamQuestions.length} items.`);
  }

  // Verify sample item
  const sample = finalExamQuestions[0];
  console.log("\nSample Question Verification:");
  console.log(`  Category: ${sample.category}`);
  console.log(`  Subtopic: ${sample.subtopic}`);
  console.log(`  Prompt: ${sample.prompt.substring(0, 100)}...`);
  console.log(`  Options Count: ${sample.options.length}`);
  console.log(`  Correct Index: ${sample.answerIndex} (Option ${String.fromCharCode(65 + sample.answerIndex)})`);
  console.log(`  Has Explanation: ${Boolean(sample.explanation)}`);
  console.log(`  Has Distractor Rationales (whyA-whyD): ${Boolean(sample.whyA && sample.whyB)}`);
  console.log(`  Has Exam Tip: ${Boolean(sample.examTip)}`);

  console.log("\n===============================================================");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
