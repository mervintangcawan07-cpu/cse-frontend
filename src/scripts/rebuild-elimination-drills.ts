// Relative Path: src/scripts/rebuild-elimination-drills.ts
import { prisma } from "../lib/prisma";

async function rebuildDrills() {
  console.log("🔍 Inspecting database for questions and drills...");

  // 1. Restore any soft-deleted questions
  const restoredQuestions = await prisma.question.updateMany({
    where: { deletedAt: { not: null } },
    data: { deletedAt: null, deletedBy: null },
  });
  if (restoredQuestions.count > 0) {
    console.log(`✅ Restored ${restoredQuestions.count} soft-deleted questions.`);
  }

  // 2. Restore any soft-deleted elimination drills
  const restoredDrills = await prisma.eliminationDrill.updateMany({
    where: { deletedAt: { not: null } },
    data: { deletedAt: null, deletedBy: null },
  });
  if (restoredDrills.count > 0) {
    console.log(`✅ Restored ${restoredDrills.count} soft-deleted Elimination Drills.`);
  }

  // 3. Fetch all active questions
  const activeQuestions = await prisma.question.findMany({
    where: { deletedAt: null },
  });

  console.log(`📊 Found ${activeQuestions.length} total active questions.`);

  if (activeQuestions.length === 0) {
    console.log("⚠️ No questions found in Question table. Please add questions via Admin or bulk upload.");
    return;
  }

  // 4. Fetch existing active drills
  const activeDrills = await prisma.eliminationDrill.findMany({
    where: { deletedAt: null },
  });

  // Group questions by category and repopulate/create drills
  const categories = Array.from(new Set(activeQuestions.map((q) => q.category)));

  for (const cat of categories) {
    const catQuestions = activeQuestions.filter((q) => q.category === cat);
    const existingDrill = activeDrills.find((d) => d.category === cat);

    if (!existingDrill) {
      await prisma.eliminationDrill.create({
        data: {
          title: `${cat} Speed Elimination Drill`,
          category: cat,
          description: `Fast-paced elimination drill covering ${cat}.`,
          timeLimitSec: 300,
          questionsJson: JSON.stringify(catQuestions),
        },
      });
      console.log(`🚀 Created new Elimination Drill for category: "${cat}" (${catQuestions.length} questions)`);
    } else {
      await prisma.eliminationDrill.update({
        where: { id: existingDrill.id },
        data: {
          questionsJson: JSON.stringify(catQuestions),
        },
      });
      console.log(`🔄 Re-populated questions for drill: "${existingDrill.title}" (${catQuestions.length} questions)`);
    }
  }

  // 5. Build/Update Master All-Subject Drill
  const masterDrill = activeDrills.find((d) => d.category === "All" || d.title.includes("Master"));
  if (!masterDrill) {
    await prisma.eliminationDrill.create({
      data: {
        title: "Master All-Subject Elimination Speed Drill",
        category: "All",
        description: "Comprehensive rapid elimination drill across all Civil Service Exam subjects.",
        timeLimitSec: 600,
        questionsJson: JSON.stringify(activeQuestions),
      },
    });
    console.log(`🚀 Created Master Elimination Drill with ${activeQuestions.length} total questions.`);
  } else {
    await prisma.eliminationDrill.update({
      where: { id: masterDrill.id },
      data: {
        questionsJson: JSON.stringify(activeQuestions),
      },
    });
    console.log(`🔄 Updated Master Elimination Drill with ${activeQuestions.length} total questions.`);
  }

  console.log("🎉 Elimination Drills and questions restored successfully!");
}

rebuildDrills()
  .catch((e) => console.error("❌ Recovery Error:", e))
  .finally(() => prisma.$disconnect());