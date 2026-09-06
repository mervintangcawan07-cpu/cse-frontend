import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  activeEliminationQuestionWhere,
  activeFlashcardWhere,
  activeOrdinaryQuestionWhere,
  isEliminationQuestion,
  softDeletedEliminationQuestionWhere,
  softDeletedFlashcardWhere,
  softDeletedOrdinaryQuestionWhere,
} from "@/lib/contentEligibility";

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function changedFiles(): string[] {
  const tracked = execFileSync("git", ["diff", "--name-only"], {
    cwd: process.cwd(),
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);
  const untracked = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard"],
    { cwd: process.cwd(), encoding: "utf8" }
  )
    .split(/\r?\n/)
    .filter(Boolean);

  return [...new Set([...tracked, ...untracked])];
}

function matchesActiveOrdinary(question: {
  category: string;
  subtopic: string;
  deletedAt: Date | null;
}): boolean {
  return question.deletedAt === null && !isEliminationQuestion(question);
}

function matchesActiveElimination(question: {
  category: string;
  subtopic: string;
  deletedAt: Date | null;
}): boolean {
  return question.deletedAt === null && isEliminationQuestion(question);
}

async function runTests(): Promise<void> {
  console.log("▶ Running Slice 4.5 content-integrity tests...");

  const statsApi = source("src/app/api/admin/stats/route.ts");
  const questionApi = source("src/app/api/admin/questions/route.ts");
  const questionExportApi = source("src/app/api/admin/questions/export/route.ts");
  const adminEliminationApi = source("src/app/api/admin/elimination-drills/route.ts");
  const adminEliminationPage = source("src/app/admin/elimination-drills/page.tsx");
  const eliminationApi = source("src/app/api/drills/elimination/route.ts");
  const eliminationPage = source("src/app/drills/elimination/page.tsx");
  const drillsPage = source("src/app/drills/page.tsx");
  const flashcardApi = source("src/app/api/flashcards/route.ts");
  const flashcardStudyPage = source("src/app/flashcards/study/page.tsx");
  const recovery = source("src/lib/recovery/softDelete.ts");
  const auditScript = source("src/scripts/audit-question-storage.ts");

  assert.equal(
    isEliminationQuestion({ category: "Elimination Drill", subtopic: "General" }),
    true
  );
  assert.equal(
    isEliminationQuestion({ category: "elimination drill", subtopic: "General" }),
    true
  );
  assert.equal(
    isEliminationQuestion({ category: "Numerical", subtopic: "Speed (ELIMINATION DRILL)" }),
    true
  );
  assert.equal(
    isEliminationQuestion({ category: "Numerical", subtopic: "Percentages" }),
    false
  );

  assert.deepEqual(activeOrdinaryQuestionWhere(), {
    deletedAt: null,
    NOT: {
      OR: [
        { category: { equals: "Elimination Drill", mode: "insensitive" } },
        { subtopic: { contains: "Elimination Drill", mode: "insensitive" } },
      ],
    },
  });
  assert.deepEqual(activeEliminationQuestionWhere(), {
    deletedAt: null,
    OR: [
      { category: { equals: "Elimination Drill", mode: "insensitive" } },
      { subtopic: { contains: "Elimination Drill", mode: "insensitive" } },
    ],
  });
  assert.deepEqual(softDeletedOrdinaryQuestionWhere().deletedAt, { not: null });
  assert.deepEqual(softDeletedEliminationQuestionWhere().deletedAt, { not: null });
  assert.deepEqual(activeFlashcardWhere(), { deletedAt: null });
  assert.deepEqual(softDeletedFlashcardWhere(), { deletedAt: { not: null } });

  assert.match(statsApi, /question\.count\(\{\s*where:\s*activeOrdinaryQuestionWhere\(\)/);
  assert.match(questionApi, /activeOrdinaryQuestionWhere\(\)/);
  assert.match(questionExportApi, /activeOrdinaryQuestionWhere\(\)/);
  assert.doesNotMatch(questionExportApi, /const\s+whereClause:\s*any/);

  assert.match(adminEliminationApi, /where:\s*activeEliminationQuestionWhere\(\)/);
  assert.match(eliminationApi, /where:\s*activeEliminationQuestionWhere\(\)/);
  assert.doesNotMatch(adminEliminationApi, /isFallback|take:\s*50/);
  assert.doesNotMatch(eliminationApi, /take:\s*50/);
  assert.match(eliminationApi, /drills:\s*\[\],\s*loopReset:\s*false/);

  assert.doesNotMatch(eliminationPage, /SAMPLE_QUESTIONS|getOfflineDrillById/);
  assert.doesNotMatch(eliminationPage, /sessionStorage\.(getItem|setItem)/);
  assert.match(eliminationPage, /sessionStorage\.removeItem\(STORAGE_CURRENT_SESSION\)/);
  assert.match(eliminationPage, /questions\.length\s*===\s*0/);
  assert.match(eliminationPage, /Cached questions were not used/);
  assert.doesNotMatch(drillsPage, /saveDrillOffline|getOfflineDrillById|removeOfflineDrill/);

  assert.match(flashcardApi, /where:\s*activeFlashcardWhere\(\)/);
  assert.doesNotMatch(flashcardApi, /DEFAULT_SEED_CARDS|\.create\(|\.createMany\(/);
  assert.doesNotMatch(flashcardStudyPage, /id:\s*["']fb-|const\s+fallback\s*=/);
  assert.match(flashcardStudyPage, /No active flashcards are available/);
  assert.match(flashcardStudyPage, /currentCard\s*&&\s*\(isFlipped/);

  assert.doesNotMatch(adminEliminationPage, /isFallback|permanently delete ALL Elimination Drill/);
  assert.match(adminEliminationPage, /Move ALL active Elimination Drill questions to Trash/);
  assert.match(adminEliminationApi, /softDeleteRecord\("question"/);
  assert.match(recovery, /case\s+"question":[\s\S]*deletedAt:\s*null/);
  assert.match(recovery, /case\s+"flashcard":[\s\S]*deletedAt:\s*null/);
  assert.match(recovery, /question\.deleteMany\([\s\S]*deletedAt:\s*\{\s*not:\s*null\s*\}/);

  const deletedOrdinary = {
    category: "Numerical Reasoning",
    subtopic: "Percentages",
    deletedAt: new Date(),
  };
  assert.equal(matchesActiveOrdinary(deletedOrdinary), false);
  assert.equal(matchesActiveOrdinary({ ...deletedOrdinary, deletedAt: null }), true);

  const deletedElimination = {
    category: "Numerical Reasoning",
    subtopic: "Speed (Elimination Drill)",
    deletedAt: new Date(),
  };
  assert.equal(matchesActiveElimination(deletedElimination), false);
  assert.equal(matchesActiveElimination({ ...deletedElimination, deletedAt: null }), true);
  assert.equal(
    matchesActiveElimination({ ...deletedElimination, subtopic: "Speed", deletedAt: null }),
    false
  );

  const historicalAttempt = {
    questionSnapshot: deletedElimination,
    completedAt: new Date(),
  };
  assert.ok(historicalAttempt.completedAt);
  assert.equal(matchesActiveElimination(historicalAttempt.questionSnapshot), false);

  assert.doesNotMatch(
    auditScript,
    /\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i
  );
  assert.match(auditScript, /prisma\.question\.count/g);
  assert.match(auditScript, /prisma\.flashcard\.count/g);
  assert.doesNotMatch(auditScript, /DATABASE_URL|prompt:|options:|answerIndex:|explanation:/);

  const allowedFiles = new Set([
    "src/app/admin/elimination-drills/page.tsx",
    "src/app/api/admin/elimination-drills/route.ts",
    "src/app/api/admin/questions/export/route.ts",
    "src/app/api/admin/questions/route.ts",
    "src/app/api/admin/stats/route.ts",
    "src/app/api/drills/elimination/route.ts",
    "src/app/api/flashcards/route.ts",
    "src/app/drills/elimination/page.tsx",
    "src/app/drills/page.tsx",
    "src/app/flashcards/study/page.tsx",
    "src/lib/contentEligibility.ts",
    "src/scripts/audit-question-storage.ts",
    "src/scripts/test-performance-slice-4-5.ts",
  ]);

  for (const file of changedFiles()) {
    assert.ok(allowedFiles.has(file), `Unexpected Slice 4.5 file: ${file}`);
    assert.doesNotMatch(
      file,
      /(?:auth|paymongo|payment|accounting|referral|payout|entitlement|exam|social|realtime|health|worker)/i
    );
  }

  assert.equal(changedFiles().includes("prisma/schema.prisma"), false);
  assert.equal(changedFiles().includes("package.json"), false);
  assert.equal(changedFiles().includes("package-lock.json"), false);

  const changedSource = changedFiles()
    .filter(
      (file) =>
        (file.endsWith(".ts") || file.endsWith(".tsx")) &&
        file !== "src/scripts/test-performance-slice-4-5.ts"
    )
    .map(source)
    .join("\n");
  assert.doesNotMatch(changedSource, /["']use cache["']|unstable_cache|revalidateTag/);

  console.log("✅ Slice 4.5 content-integrity tests passed.");
}

runTests().catch((error) => {
  console.error("❌ Slice 4.5 content-integrity tests failed:", error);
  process.exit(1);
});
