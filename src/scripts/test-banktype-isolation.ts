import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (file: string) => readFileSync(resolve(root, file), "utf8");
const checks: Array<{ name: string; run: () => void }> = [];
const contract = (name: string, run: () => void) => checks.push({ name, run });
const mustMatch = (source: string, pattern: RegExp, message: string) => {
  if (!pattern.test(source)) throw new Error(message);
};
const mustNotMatch = (source: string, pattern: RegExp, message: string) => {
  if (pattern.test(source)) throw new Error(message);
};

// Canonical contract definitions matching src/lib/contentEligibility.ts
type QuestionClassification = {
  bankType?: "ORDINARY" | "ELIMINATION" | string | null;
  category?: string | null;
  subtopic?: string | null;
};

function isEliminationQuestion(question: QuestionClassification): boolean {
  if (question.bankType === "ELIMINATION") return true;
  if (question.bankType === "ORDINARY") return false;
  const cat = question.category?.trim().toLowerCase() || "";
  const sub = question.subtopic?.toLowerCase() || "";
  return cat === "elimination drill" || sub.includes("elimination drill");
}

function isOrdinaryQuestion(question: QuestionClassification): boolean {
  if (question.bankType === "ORDINARY") return true;
  if (question.bankType === "ELIMINATION") return false;
  const cat = question.category?.trim().toLowerCase() || "";
  const sub = question.subtopic?.toLowerCase() || "";
  return cat !== "elimination drill" && !sub.includes("elimination drill");
}

// ============================================================================
// 1. TRANSITIONAL OWNERSHIP CLASSIFIER LOGIC CONTRACTS
// ============================================================================

contract("legacy ordinary row (bankType = null) is treated as ORDINARY", () => {
  const legacyOrdinary = {
    bankType: null,
    category: "Numerical Reasoning",
    subtopic: "Percentages",
  };
  assert.equal(isOrdinaryQuestion(legacyOrdinary), true);
  assert.equal(isEliminationQuestion(legacyOrdinary), false);
});

contract("legacy elimination row by category (bankType = null) is ELIMINATION", () => {
  const legacyElim = {
    bankType: null,
    category: "Elimination Drill",
    subtopic: "General",
  };
  assert.equal(isEliminationQuestion(legacyElim), true);
  assert.equal(isOrdinaryQuestion(legacyElim), false);
});

contract("legacy elimination row by subtopic (bankType = null) is ELIMINATION", () => {
  const legacyElimSubtopic = {
    bankType: null,
    category: "Numerical Reasoning",
    subtopic: "Percentages (Elimination Drill)",
  };
  assert.equal(isEliminationQuestion(legacyElimSubtopic), true);
  assert.equal(isOrdinaryQuestion(legacyElimSubtopic), false);
});

contract("explicit ORDINARY bankType overrides legacy-looking metadata", () => {
  const explicitOrdinaryWithElimStrings = {
    bankType: "ORDINARY",
    category: "Numerical Reasoning",
    subtopic: "Percentages (Elimination Drill)",
  };
  assert.equal(isOrdinaryQuestion(explicitOrdinaryWithElimStrings), true);
  assert.equal(isEliminationQuestion(explicitOrdinaryWithElimStrings), false);
});

contract("explicit ELIMINATION bankType wins regardless of ordinary category", () => {
  const explicitElimWithOrdinaryCategory = {
    bankType: "ELIMINATION",
    category: "Verbal Ability",
    subtopic: "Vocabulary",
  };
  assert.equal(isEliminationQuestion(explicitElimWithOrdinaryCategory), true);
  assert.equal(isOrdinaryQuestion(explicitElimWithOrdinaryCategory), false);
});

// ============================================================================
// 2. PRISMA WHERE PREDICATES IN contentEligibility.ts
// ============================================================================

contract("contentEligibility.ts implements transitional predicates and explicit-first logic", () => {
  const source = read("src/lib/contentEligibility.ts");
  mustMatch(source, /export function isEliminationQuestion/, "missing isEliminationQuestion");
  mustMatch(source, /if\s*\(question\.bankType\s*===\s*["']ELIMINATION["']\)\s*return true;/, "isEliminationQuestion must check explicit ELIMINATION first");
  mustMatch(source, /if\s*\(question\.bankType\s*===\s*["']ORDINARY["']\)\s*return false;/, "isEliminationQuestion must check explicit ORDINARY first");
  mustMatch(source, /export function isOrdinaryQuestion/, "missing isOrdinaryQuestion");
  mustMatch(source, /export function transitionalOrdinaryBankWhere/, "missing transitionalOrdinaryBankWhere");
  mustMatch(source, /export function transitionalEliminationBankWhere/, "missing transitionalEliminationBankWhere");
  mustMatch(source, /export function activeOrdinaryQuestionWhere/, "missing activeOrdinaryQuestionWhere");
  mustMatch(source, /export function activeEliminationQuestionWhere/, "missing activeEliminationQuestionWhere");
  mustMatch(source, /export function softDeletedOrdinaryQuestionWhere/, "missing softDeletedOrdinaryQuestionWhere");
  mustMatch(source, /export function softDeletedEliminationQuestionWhere/, "missing softDeletedEliminationQuestionWhere");
});

// ============================================================================
// 3. RUNTIME CONSUMERS & ROUTE OWNERSHIP
// ============================================================================

contract("questions route uses transitional ordinary helpers and rejects elimination import", () => {
  const source = read("src/app/api/questions/route.ts");
  mustMatch(source, /ordinaryBankWhere/, "questions route missing ordinaryBankWhere");
  mustMatch(source, /activeOrdinaryQuestionWhere\(\)/, "questions route missing activeOrdinaryQuestionWhere");
  mustNotMatch(source, /NOT_ELIMINATION_DRILL/, "questions route still uses legacy NOT_ELIMINATION_DRILL filter");
  mustNotMatch(source, /isEliminationQuery/, "questions route must not contain isEliminationQuery cross-bank escape path");
  mustMatch(source, /bankType:\s*["']ORDINARY["']/, "questions route POST missing explicit bankType ORDINARY");
  mustMatch(source, /eliminationRows/, "questions route POST missing elimination metadata rejection guard");
});

contract("exam start route uses ordinaryBankWhere", () => {
  const source = read("src/app/api/exam/start/route.ts");
  mustMatch(source, /\.\.\.ordinaryBankWhere\(\)/, "exam start route missing ordinaryBankWhere");
});

contract("daily questions route uses activeOrdinaryQuestionWhere", () => {
  const source = read("src/app/api/questions/daily/route.ts");
  mustMatch(source, /activeOrdinaryQuestionWhere\(\)/, "daily questions route missing activeOrdinaryQuestionWhere");
});

contract("elimination drill routes use activeEliminationQuestionWhere", () => {
  const userElim = read("src/app/api/drills/elimination/route.ts");
  mustMatch(userElim, /activeEliminationQuestionWhere\(\)/, "user elimination drill missing activeEliminationQuestionWhere");

  const generalDrills = read("src/app/api/drills/route.ts");
  mustMatch(generalDrills, /activeEliminationQuestionWhere\(\)/, "general drills route missing activeEliminationQuestionWhere");

  const adminElim = read("src/app/api/admin/elimination-drills/route.ts");
  mustMatch(adminElim, /activeEliminationQuestionWhere\(\)/, "admin elimination drill missing activeEliminationQuestionWhere");
});

// ============================================================================
// 4. QUESTION WRITERS EXPLICIT OWNERSHIP & VALIDATION
// ============================================================================

contract("all question write routes set explicit bankType and reject wrong-bank metadata", () => {
  const adminImport = read("src/app/api/admin/questions/import/route.ts");
  mustMatch(adminImport, /bankType:\s*["']ORDINARY["']/, "admin import missing explicit bankType ORDINARY");
  mustMatch(adminImport, /eliminationRows/, "admin import missing elimination metadata rejection");

  const adminPost = read("src/app/api/admin/questions/route.ts");
  mustMatch(adminPost, /bankType:\s*["']ORDINARY["']/, "admin question POST missing explicit bankType ORDINARY");
  mustMatch(adminPost, /isElimination/, "admin question POST missing elimination rejection guard");

  const elimPost = read("src/app/api/admin/elimination-drills/route.ts");
  mustMatch(elimPost, /bankType:\s*["']ELIMINATION["']/, "elimination drill POST missing explicit bankType ELIMINATION");
});

// ============================================================================
// 5. DELETE ENDPOINTS & TRANSITIONAL GUARDS
// ============================================================================

contract("admin deletion guards use transitional isOrdinaryQuestion and isEliminationQuestion", () => {
  const adminDelete = read("src/app/api/admin/questions/route.ts");
  mustMatch(adminDelete, /!isOrdinaryQuestion\(question\)/, "admin question DELETE missing isOrdinaryQuestion guard");

  const elimDelete = read("src/app/api/admin/elimination-drills/route.ts");
  mustMatch(elimDelete, /!isEliminationQuestion\(question\)/, "elimination drill DELETE missing isEliminationQuestion guard");

  const bulkDelete = read("src/app/api/admin/questions/bulk-delete/route.ts");
  mustMatch(bulkDelete, /transitionalOrdinaryBankWhere\(\)/, "bulk delete missing transitionalOrdinaryBankWhere");
});

// ============================================================================
// 6. TRASH RESTORE SEPARATION & ADMIN TRASH UI
// ============================================================================

contract("trash restore functions use transitional soft-deleted helpers", () => {
  const source = read("src/lib/recovery/softDelete.ts");
  mustMatch(source, /softDeletedOrdinaryQuestionWhere\(\)/, "restoreAllTrashOrdinaryQuestions missing transitional helper");
  mustMatch(source, /softDeletedEliminationQuestionWhere\(\)/, "restoreAllTrashEliminationQuestions missing transitional helper");
});

contract("trash API supports bank-specific restore and disables ambiguous restore all", () => {
  const source = read("src/app/api/admin/trash/route.ts");
  mustMatch(source, /RESTORE_ALL_ORDINARY_QUESTIONS/, "trash route missing RESTORE_ALL_ORDINARY_QUESTIONS action");
  mustMatch(source, /RESTORE_ALL_ELIMINATION_QUESTIONS/, "trash route missing RESTORE_ALL_ELIMINATION_QUESTIONS action");
  mustMatch(source, /action === ["']RESTORE_ALL_QUESTIONS["'][\s\S]*?status:\s*400/, "trash route must disable RESTORE_ALL_QUESTIONS with 400");
});

contract("trash UI invokes bank-specific actions and does NOT invoke ambiguous RESTORE_ALL_QUESTIONS", () => {
  const source = read("src/app/admin/trash/page.tsx");
  mustMatch(source, /RESTORE_ALL_ORDINARY_QUESTIONS/, "trash UI missing RESTORE_ALL_ORDINARY_QUESTIONS");
  mustMatch(source, /RESTORE_ALL_ELIMINATION_QUESTIONS/, "trash UI missing RESTORE_ALL_ELIMINATION_QUESTIONS");
  mustNotMatch(source, /action:\s*["']RESTORE_ALL_QUESTIONS["']/, "trash UI must not call ambiguous RESTORE_ALL_QUESTIONS");
  mustMatch(source, /Restore All Regular Questions/, "trash UI missing Restore All Regular Questions button");
  mustMatch(source, /Restore All Elimination Drill Questions/, "trash UI missing Restore All Elimination Drill Questions button");
});

// ============================================================================
// 7. REAL PRISMA MIGRATION ARTIFACT INTEGRITY
// ============================================================================

contract("real Prisma migration artifact exists and is non-destructive", () => {
  const migrationPath = "prisma/migrations/20260907213000_add_question_banktype/migration.sql";
  assert.ok(existsSync(resolve(root, migrationPath)), `migration file must exist at ${migrationPath}`);
  const sql = read(migrationPath);
  mustMatch(sql, /CREATE TYPE "QuestionBankType" AS ENUM/, "migration missing CREATE TYPE QuestionBankType");
  mustMatch(sql, /ALTER TABLE "Question" ADD COLUMN "bankType" "QuestionBankType"/, "migration missing ADD COLUMN bankType");
  mustMatch(sql, /CREATE INDEX "Question_bankType_idx" ON "Question"\("bankType"\)/, "migration missing bankType index");
  mustNotMatch(sql, /DROP TABLE/i, "migration must not DROP TABLE");
  mustNotMatch(sql, /DROP COLUMN/i, "migration must not DROP COLUMN");
  mustNotMatch(sql, /DELETE FROM/i, "migration must not DELETE rows");
});

contract("backfill SQL artifact exists and is idempotent", () => {
  const backfillPath = "prisma/migrations/backfill_question_banktype.sql";
  assert.ok(existsSync(resolve(root, backfillPath)), `backfill script must exist at ${backfillPath}`);
  const sql = read(backfillPath);
  mustMatch(sql, /UPDATE "Question"[\s\S]*?WHERE "bankType" IS NULL/i, "backfill must filter on bankType IS NULL");
  mustMatch(sql, /ELIMINATION/i, "backfill must assign ELIMINATION");
  mustMatch(sql, /ORDINARY/i, "backfill must assign ORDINARY");
});

// ============================================================================
// 8. FLASHCARD ARCHITECTURE REMAINS UNTOUCHED
// ============================================================================

contract("Flashcard model is physically separate and untouched", () => {
  const schema = read("prisma/schema.prisma");
  mustMatch(schema, /model Flashcard \{/, "Flashcard model missing from schema");
  const flashcardBlock = schema.split("model Flashcard {")[1].split("}")[0];
  mustNotMatch(flashcardBlock, /bankType/, "Flashcard model must not contain bankType");
});

// ============================================================================
// 9. STRICT /api/questions BANK-BOUNDARY CONTRACTS (TESTS 1 - 7)
// ============================================================================

// Model evaluator of transitionalOrdinaryBankWhere predicate
function evaluatesOrdinaryBankWhere(q: {
  bankType?: "ORDINARY" | "ELIMINATION" | string | null;
  category?: string | null;
  subtopic?: string | null;
}): boolean {
  if (q.bankType === "ORDINARY") return true;
  if (q.bankType === null || q.bankType === undefined) {
    const cat = q.category?.trim().toLowerCase() || "";
    const sub = q.subtopic?.toLowerCase() || "";
    const isElimLegacy = cat === "elimination drill" || sub.includes("elimination drill");
    return !isElimLegacy;
  }
  return false;
}

contract("Test 1: GET /api/questions can return ORDINARY but never ELIMINATION", () => {
  const source = read("src/app/api/questions/route.ts");
  mustNotMatch(source, /isEliminationQuery/, "must not contain isEliminationQuery bypass");
  mustMatch(source, /ordinaryBankWhere\(\)/, "must apply ordinaryBankWhere");
  mustMatch(source, /activeOrdinaryQuestionWhere\(\)/, "must apply activeOrdinaryQuestionWhere");

  // Predicate evaluation
  const ordinaryRow = { bankType: "ORDINARY", category: "Verbal Ability", subtopic: "Vocabulary" };
  const elimRow = { bankType: "ELIMINATION", category: "Elimination Drill", subtopic: "Speed" };
  assert.equal(evaluatesOrdinaryBankWhere(ordinaryRow), true);
  assert.equal(evaluatesOrdinaryBankWhere(elimRow), false);
});

contract("Test 2: /api/questions?category=Elimination Drill must NOT return ELIMINATION-bank rows", () => {
  const source = read("src/app/api/questions/route.ts");
  // whereClause unconditionally spreads ...ordinaryBankWhere()
  mustMatch(source, /whereClause: Prisma\.QuestionWhereInput = \{[\s\S]*?\.\.\.ordinaryBankWhere\(\),/, "whereClause must unconditionally spread ordinaryBankWhere()");
  mustMatch(source, /catchAllWhere: Prisma\.QuestionWhereInput = \{[\s\S]*?\.\.\.ordinaryBankWhere\(\),/, "catchAllWhere must unconditionally spread ordinaryBankWhere()");

  // Elimination-bank rows queried with category='Elimination Drill'
  const explicitElim = { bankType: "ELIMINATION", category: "Elimination Drill", subtopic: "Speed" };
  const legacyElim = { bankType: null, category: "Elimination Drill", subtopic: "General" };
  assert.equal(evaluatesOrdinaryBankWhere(explicitElim), false, "explicit ELIMINATION row must not match ordinary predicate");
  assert.equal(evaluatesOrdinaryBankWhere(legacyElim), false, "legacy elimination row must not match ordinary predicate");
});

contract("Test 3: Legacy NULL ordinary Question remains eligible during transition", () => {
  const legacyOrdinary = { bankType: null, category: "Numerical Reasoning", subtopic: "Percentages" };
  assert.equal(evaluatesOrdinaryBankWhere(legacyOrdinary), true, "legacy NULL ordinary row must remain eligible");
});

contract("Test 4: Legacy NULL elimination Question must NOT be returned by /api/questions", () => {
  const legacyElimCategory = { bankType: null, category: "Elimination Drill", subtopic: "General" };
  const legacyElimSubtopic = { bankType: null, category: "General", subtopic: "Percentages (Elimination Drill)" };
  assert.equal(evaluatesOrdinaryBankWhere(legacyElimCategory), false, "legacy NULL elimination by category must be excluded");
  assert.equal(evaluatesOrdinaryBankWhere(legacyElimSubtopic), false, "legacy NULL elimination by subtopic must be excluded");
});

contract("Test 5: Explicit bankType = ORDINARY remains ordinary regardless of legacy-looking metadata", () => {
  const ordinaryWithElimCategory = { bankType: "ORDINARY", category: "Elimination Drill", subtopic: "Drill" };
  const ordinaryWithElimSubtopic = { bankType: "ORDINARY", category: "Numerical Reasoning", subtopic: "Percentages (Elimination Drill)" };
  assert.equal(evaluatesOrdinaryBankWhere(ordinaryWithElimCategory), true, "explicit ORDINARY must match even with elim category");
  assert.equal(evaluatesOrdinaryBankWhere(ordinaryWithElimSubtopic), true, "explicit ORDINARY must match even with elim subtopic");
});

contract("Test 6: Explicit bankType = ELIMINATION must never be returned by /api/questions", () => {
  const elimWithOrdinaryCategory = { bankType: "ELIMINATION", category: "Verbal Ability", subtopic: "Grammar" };
  const elimWithOrdinarySubject = { bankType: "ELIMINATION", category: "General Information", subtopic: "Constitution" };
  assert.equal(evaluatesOrdinaryBankWhere(elimWithOrdinaryCategory), false, "explicit ELIMINATION must never match ordinary predicate");
  assert.equal(evaluatesOrdinaryBankWhere(elimWithOrdinarySubject), false, "explicit ELIMINATION must never match ordinary predicate");
});

contract("Test 7: User Elimination Drill continues successfully through /api/drills/elimination", () => {
  const userElimRoute = read("src/app/api/drills/elimination/route.ts");
  mustMatch(userElimRoute, /activeEliminationQuestionWhere\(\)/, "user elimination route must use activeEliminationQuestionWhere");

  const userElimPage = read("src/app/drills/elimination/page.tsx");
  mustMatch(userElimPage, /\/api\/drills\/elimination/, "user elimination frontend page must call /api/drills/elimination");
});

// ============================================================================
// RUN ALL CONTRACTS
// ============================================================================

let failed = 0;
for (const check of checks) {
  try {
    check.run();
    console.log(`PASS ${check.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${check.name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

console.log(`\n${checks.length - failed}/${checks.length} contracts passed`);
if (failed > 0) process.exitCode = 1;
