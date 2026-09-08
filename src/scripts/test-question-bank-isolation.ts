/* eslint-disable @typescript-eslint/no-explicit-any */
// Behavioral isolation tests: real route/helper code, real SQL predicates, no app
// Prisma client, environment loading, filesystem database, or network access.
// SQLite supplies an ephemeral relational engine; only PostgreSQL btrim/strpos/translate,
// ILIKE and FOR UPDATE syntax are adapted. PostgreSQL concurrency is not simulated.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { Prisma } from "@prisma/client";

const nativeRequire = createRequire(import.meta.url);
// Node 24 provides SQLite; the repository still uses older Node type declarations.
const { DatabaseSync } = nativeRequire("node:sqlite");
const db = new DatabaseSync(":memory:");
const fields = Object.values(Prisma.QuestionScalarFieldEnum);
db.exec('CREATE TABLE "Question" (' + fields.map(k => '"' + k + '" ' + (k === "answerIndex" ? "INTEGER" : "TEXT") + (k === "id" ? " PRIMARY KEY" : "")).join(",") + ")");
db.function("btrim", (value: any, chars: any) => {
  const allowed = new Set(String(chars));
  const text = [...String(value)];
  while (text.length && allowed.has(text[0])) text.shift();
  while (text.length && allowed.has(text[text.length - 1])) text.pop();
  return text.join("");
});
db.function("translate", (value: any, from: any, to: any) => {
  const source = [...String(from)], target = [...String(to)];
  return [...String(value)].map(char => {
    const index = source.indexOf(char);
    return index < 0 ? char : target[index] || "";
  }).join("");
});
db.function("strpos", (text: any, needle: any) => String(text).indexOf(String(needle)) + 1);

const logs: Array<{ kind: string; args: any }> = [];
let tables: Record<string, any[]> = {};
let sequence = 0;
let role: string | null = "ADMIN";
let updateRace: (() => void) | undefined;
const user = () => role ? { id: "u1", role, name: "Test", email: "test@example.invalid" } : null;
const binding = (value: any): any => value instanceof Date ? value.toISOString() : Array.isArray(value) ? JSON.stringify(value) : value;
function decode(row: any): any {
  if (!row) return null;
  const result = { ...row };
  for (const key of ["options", "tags"]) if (typeof result[key] === "string") result[key] = JSON.parse(result[key]);
  for (const key of ["createdAt", "updatedAt", "deletedAt"]) if (result[key]) result[key] = new Date(result[key]);
  return result;
}
function rows(model: string): any[] {
  return model === "question" ? db.prepare('SELECT * FROM "Question"').all().map(decode) : tables[model] ||= [];
}
function storeRow(model: string, row: any) {
  if (model === "question") {
    const keys = fields.filter(k => row[k] !== undefined);
    db.prepare('INSERT OR REPLACE INTO "Question" (' + keys.map(k => '"' + k + '"').join(",") + ") VALUES (" + keys.map(() => "?").join(",") + ")").run(...keys.map(k => binding(row[k])));
  } else {
    const list = rows(model), index = list.findIndex(r => r.id === row.id);
    if (index < 0) list.push(row); else list[index] = row;
  }
}
function matches(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (value === undefined) return true;
    if (key === "OR") return value.some((v: any) => matches(row, v));
    if (key === "AND") return (Array.isArray(value) ? value : [value]).every((v: any) => matches(row, v));
    if (key === "NOT") return !matches(row, value);
    if (key.includes("_") && !(key in row)) return matches(row, value);
    if (key === "question") return matches(rows("question").find(q => q.id === row.questionId), value);
    const actual = row?.[key];
    if (value instanceof Date) return actual?.getTime() === value.getTime();
    if (value && typeof value === "object") {
      if ("in" in value && !value.in.includes(actual)) return false;
      if ("not" in value && actual === value.not) return false;
      if ("lt" in value && !(actual < value.lt)) return false;
      if ("equals" in value && String(actual).toLowerCase() !== value.equals.toLowerCase()) return false;
      if ("contains" in value && !String(actual).toLowerCase().includes(value.contains.toLowerCase())) return false;
      return true;
    }
    return actual === value;
  });
}
function project(row: any, args: any): any {
  if (!row) return null;
  const related = args.include?.question || args.select?.question;
  const expanded = related ? { ...row, question: project(rows("question").find(q => q.id === row.questionId), related) } : row;
  return args.select ? Object.fromEntries(Object.entries(args.select).filter(([, v]) => v).map(([k]) => [k, expanded[k]])) : { ...expanded };
}
function delegate(model: string): any {
  return {
    findMany: async (args: any = {}) => rows(model).filter(r => matches(r, args.where)).map(r => project(r, args)),
    findFirst: async (args: any = {}) => project(rows(model).find(r => matches(r, args.where)), args),
    findUnique: async (args: any = {}) => project(rows(model).find(r => matches(r, args.where)), args),
    count: async (args: any = {}) => rows(model).filter(r => matches(r, args.where)).length,
    create: async (args: any) => {
      logs.push({ kind: model + ".create", args });
      const row = { id: "new-" + ++sequence, createdAt: new Date(), updatedAt: new Date(), deletedAt: null, deletedBy: null, ...args.data };
      storeRow(model, row); return row;
    },
    createMany: async (args: any) => {
      logs.push({ kind: model + ".createMany", args });
      for (const data of args.data) await prisma[model].create({ data });
      return { count: args.data.length };
    },
    update: async (args: any) => {
      logs.push({ kind: model + ".update", args });
      if (model === "question" && updateRace) { const race = updateRace; updateRace = undefined; race(); }
      const row = rows(model).find(r => matches(r, args.where));
      if (!row) throw new Prisma.PrismaClientKnownRequestError("Changed", { code: "P2025", clientVersion: "test" });
      const next = { ...row, ...Object.fromEntries(Object.entries(args.data).filter(([, v]) => v !== undefined)) };
      storeRow(model, next); return next;
    },
    updateMany: async (args: any) => {
      const targets = rows(model).filter(r => matches(r, args.where));
      for (const row of targets) await prisma[model].update({ where: { id: row.id }, data: args.data });
      return { count: targets.length };
    },
    upsert: async (args: any) => rows(model).some(r => matches(r, args.where))
      ? prisma[model].update({ where: args.where, data: args.update }) : prisma[model].create({ data: args.create }),
    deleteMany: async (args: any = {}) => {
      logs.push({ kind: model + ".deleteMany", args });
      const targets = rows(model).filter(r => matches(r, args.where));
      if (model === "question") for (const row of targets) db.prepare('DELETE FROM "Question" WHERE id = ?').run(row.id);
      else tables[model] = rows(model).filter(r => !targets.includes(r));
      return { count: targets.length };
    },
  };
}
function sql(statement: Prisma.Sql, mutate = false): any {
  logs.push({ kind: mutate ? "execute" : "query", args: statement });
  const adapted = statement.sql.replace(/\bILIKE\b/g, "LIKE").replace(/\s+FOR UPDATE\b/g, "");
  const query = db.prepare(adapted);
  const values = statement.values.map(binding);
  return mutate ? Number(query.run(...values).changes) : query.all(...values).map(decode);
}
const prisma: any = {
  $queryRaw: async (statement: Prisma.Sql) => sql(statement),
  $executeRaw: async (statement: Prisma.Sql) => sql(statement, true),
  $transaction: async (operation: any) => {
    if (Array.isArray(operation)) return Promise.all(operation);
    const saved = structuredClone(tables);
    db.exec("BEGIN");
    try { const result = await operation(prisma); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); tables = saved; throw error; }
  },
};
for (const model of ["question", "user", "userMistake", "dailyQuestionAttempt", "examResult", "examDraft", "activityLog", "duelMatch", "bookmark", "studyNote", "studyRoom", "flashcard", "systemSetting"]) prisma[model] = delegate(model);
const quiet = { log() {}, info() {}, warn() {}, error(...args: any[]) { logs.push({ kind: "error", args }); } };
const mocks: Record<string, any> = {
  "@/lib/prisma": { prisma },
  "@/lib/serverAuth": {
    getAuthenticatedUser: async () => user(),
    requireAdminAuth: async () => ({ user: user(), errorResponse: role === "ADMIN" ? null : Response.json({ error: "Forbidden" }, { status: 403 }) }),
    getAuthenticatedSessionResult: async () => role ? { authenticated: true, session: { user: user() } } : { authenticated: false, code: "NO_TOKEN" },
  },
  "@/middleware/requireSudo": { requireSudo: (handler: any) => handler },
  "@/lib/ratelimit": { checkRateLimit: async () => ({ success: true }) },
  "@/lib/streakEngine": { recordUserActivityStreak: async () => ({ currentStreak: 1 }) },
  "@/lib/badges": { evaluateAndAwardBadges: async () => [] },
  "@/lib/notifications": { createNotification: async () => undefined },
  "@/lib/config/features": {
    isStudyTogetherEnabled: () => true,
    isDuelEnabled: () => true,
    STUDY_TOGETHER_ENABLED: true,
    DUEL_ENABLED: true,
  },
  "@/lib/logger/logger": { logger: quiet },
  "@/lib/cache": { CACHE_PROFILES: { PUBLIC: {} }, cachedJsonResponse: (data: any) => Response.json(data) },
  "next/server": { NextResponse: Response, NextRequest: Request },
  "next/cache": { revalidatePath() {} },
};
const allowedFiles = new Set([
  "src/lib/contentEligibility.ts", "src/lib/questionBank.ts", "src/lib/csvParser.ts",
  "src/lib/sanitizeMath.ts", "src/lib/recovery/softDelete.ts",
]);
const modules = new Map<string, any>();
function load(relative: string): any {
  if (modules.has(relative)) return modules.get(relative);
  assert.ok(allowedFiles.has(relative) || /^src\/app\/api\/.*\/route\.ts$/.test(relative), "Unexpected application dependency: " + relative);
  const compiled = ts.transpileModule(readFileSync(join(process.cwd(), relative), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loadedModule = { exports: {} }; modules.set(relative, loadedModule.exports);
  runInNewContext(compiled, {
    module: loadedModule, exports: loadedModule.exports, Date, Response, Request, URL, Set, Map, Error,
    console: quiet, process: { env: {} }, Buffer,
    require(name: string) {
      if (name in mocks) return mocks[name];
      if (name === "@prisma/client") return { Prisma };
      if (name === "papaparse") return nativeRequire(name);
      if (name.startsWith("@/")) return load("src/" + name.slice(2) + ".ts");
      throw new Error("Forbidden test dependency: " + name);
    },
  }, { filename: relative });
  return loadedModule.exports;
}
const eligibility = load("src/lib/contentEligibility.ts");
const bank = load("src/lib/questionBank.ts");
const recovery = load("src/lib/recovery/softDelete.ts");
const route = (path: string) => load("src/app/api/" + path + "/route.ts");
const ordinaryIds = ["o1", "o2", "o3", "o4", "o5", "o6"];
const eliminationIds = ["e1", "e2", "e3"];
const deletedIds = ["do", "de"];
function fixture(id: string, category = "Numerical Reasoning", subtopic = "Percentages", deletedAt: Date | null = null): any {
  return { ...Object.fromEntries(fields.map(k => [k, null])), id, category, subtopic, prompt: "Question " + id,
    options: ["Correct", "Wrong", "C", "D"], optionA: "Correct", optionB: "Wrong", optionC: "C", optionD: "D",
    answerIndex: 0, tags: [], explanation: "Explanation", difficulty: "MEDIUM",
    createdAt: new Date("2026-01-01Z"), updatedAt: new Date("2026-01-01Z"), deletedAt };
}
function reset() {
  db.exec('DELETE FROM "Question"'); tables = {}; logs.length = 0; role = "ADMIN"; updateRace = undefined;
  ordinaryIds.forEach(id => storeRow("question", { ...fixture(id), bankType: "ORDINARY" }));
  storeRow("question", { ...fixture("e1", " \tELIMINATION DRILL\u00a0", "General"), bankType: "ELIMINATION" });
  storeRow("question", { ...fixture("e2", "Numerical Reasoning", "Speed (eLiMiNaTiOn DrIlL)"), bankType: "ELIMINATION" });
  storeRow("question", { ...fixture("e3", "\ufeffElimination Drill\u3000"), bankType: "ELIMINATION" });
  storeRow("question", { ...fixture("do", "Numerical Reasoning", "Percentages", new Date()), bankType: "ORDINARY" });
  storeRow("question", { ...fixture("de", "General", "Elimination Drill", new Date()), bankType: "ELIMINATION" });
  tables.user = [{ id: "target", role: "USER" }];
  tables.studyRoom = [{ id: "room", hostId: "u1", isPublic: false, participants: [] }];
}
async function invoke(path: string, method: string, data?: any, query = "", id = "") {
  const request = new Request("http://test.invalid/api/" + path + query, {
    method, ...(data !== undefined ? { headers: { "content-type": "application/json" }, body: JSON.stringify(data) } : {}),
  });
  const response: Response = await route(path)[method](request, { params: Promise.resolve({ id, roomId: "room" }) });
  const body = await response.json();
  if (response.status >= 500) assert.fail("Unexpected server error: " + JSON.stringify(logs.filter(l => l.kind === "error").map(l => l.args.map((a: any) => String(a)))));
  return { status: response.status, body };
}
const payload = { category: "Numerical Reasoning", subtopic: "Percentages", prompt: "New question", options: ["Yes", "No"], optionA: "Yes", optionB: "No", answerIndex: 0 };
function only(ids: string[], allowed: string[]) { assert.ok(ids.every(id => allowed.includes(id)), "Unexpected pool: " + ids.join(",")); }
function noQuestionWrites() { assert.equal(logs.filter(l => /question\.(create|update|delete)|execute/.test(l.kind)).length, 0); }
let passed = 0, failed = 0;
async function test(name: string, fn: () => any) {
  reset();
  try { await fn(); passed++; console.log("PASS " + name); }
  catch (error) { failed++; console.error("FAIL " + name, error); }
}

async function main() {
  await test("SQL and JavaScript agree across category whitespace, case, markers and active/deleted states", async () => {
    db.exec('DELETE FROM "Question"');
    const whitespace = [" ", "\t", "\n", "\r", "\v", "\f", "\u00a0", "\u1680", "\u2000", "\u2001", "\u2002", "\u2003", "\u2004", "\u2005", "\u2006", "\u2007", "\u2008", "\u2009", "\u200a", "\u2028", "\u2029", "\u202f", "\u205f", "\u3000", "\ufeff"];
    const cases: Array<[string, string, boolean]> = [["Ordinary", "Elimination strategy", false], ["Elimination Drills", "", false], ["Elimination\u200b Drill", "", false], ["Ordinary", "pre ELIMINATION DRILL post", true], ["El\u0130mination Drill", "", false], ["General", "EL\u0130MINATION DRILL", false]];
    whitespace.forEach(w => cases.push([w + "eLiMiNaTiOn DrIlL" + w, "", true]));
    for (const [index, [category, subtopic, expected]] of cases.entries()) {
      assert.equal(eligibility.isEliminationQuestion({ category, subtopic }), expected);
      for (const deleted of [false, true]) storeRow("question", { ...fixture(String(index) + "-" + deleted, category, subtopic, deleted ? new Date() : null), bankType: expected ? "ELIMINATION" : "ORDINARY" });
    }
    for (const [name, isE, deleted] of [["activeOrdinaryQuestionWhere", false, false], ["activeEliminationQuestionWhere", true, false], ["softDeletedOrdinaryQuestionWhere", false, true], ["softDeletedEliminationQuestionWhere", true, true]] as const) {
      const actual = await bank.findBankQuestions({ where: eligibility[name]() });
      const expected = cases.flatMap((c, index) => c[2] === isE ? [String(index) + "-" + deleted] : []);
      assert.deepEqual(actual.map((q: any) => q.id).sort(), expected.sort());
    }
    assert.equal(eligibility.isEliminationQuestion({ category: "General", subtopic: "General", eliminationStrategy: "Elimination Drill" }), false);
  });
  await test("SQL filters bind hostile request values and preserve selection, count and pagination", async () => {
    const where = bank.andQuestionWhere(eligibility.activeOrdinaryQuestionWhere(), bank.questionTextWhere("category", "x' OR TRUE --"));
    assert.equal((await bank.findBankQuestions({ where })).length, 0);
    assert.equal(await bank.countBankQuestions(eligibility.activeOrdinaryQuestionWhere()), 6);
    const selected = await bank.findBankQuestions({ where: eligibility.activeOrdinaryQuestionWhere(), select: { id: true }, orderBy: { id: "asc" }, skip: 1, take: 2 });
    assert.deepEqual(selected, [{ id: "o2" }, { id: "o3" }]);
    await assert.rejects(bank.findBankQuestions({ where, orderBy: { 'id"; DROP TABLE "Question': "asc" } }));
  });
  await test("ordinary single create succeeds without classifying strategy as ownership", async () => {
    const result = await invoke("admin/questions", "POST", { ...payload, eliminationStrategy: "Elimination Drill" });
    assert.equal(result.status, 200); assert.equal(rows("question").length, 12);
  });
  for (const metadata of [{ category: "Elimination Drill" }, { subtopic: "pre Elimination Drill post" }, { category: "eLiMiNaTiOn DrIlL" }, { category: "\ufeff \tElimination Drill\u00a0" }]) {
    await test("ordinary create rejects " + JSON.stringify(metadata), async () => {
      assert.equal((await invoke("admin/questions", "POST", { ...payload, ...metadata })).status, 422); noQuestionWrites();
    });
  }
  for (const path of ["admin/questions/import", "questions"]) {
    await test(path + " accepts ordinary CSV aliases", async () => {
      const result = await invoke(path, "POST", { csvText: "subject,sub_topic,question,option_a,option_b,answerIndex\nNumerical Reasoning,Percentages,CSV question,Yes,No,0" });
      assert.equal(result.status, 200); assert.equal(rows("question").length, 12);
    });
    for (const shape of ["array", "questions", "csvText"]) await test(path + " rejects entire mixed " + shape + " batch", async () => {
      const mixed = [{ ...payload }, { ...payload, prompt: "Bad row", subtopic: "Speed (ELIMINATION DRILL)" }];
      const data = shape === "array" ? mixed : shape === "questions" ? { questions: mixed } : { csvText: nativeRequire("papaparse").unparse(mixed) };
      const result = await invoke(path, "POST", data);
      assert.equal(result.status, 422); assert.equal(result.body.errors[0].row, 2); noQuestionWrites(); assert.equal(rows("question").length, 11);
    });
  }
  await test("Elimination import supplies ownership and preserves custom categories", async () => {
    const result = await invoke("admin/elimination-drills", "POST", { questions: [{ ...payload, category: undefined, subtopic: undefined }, { ...payload, category: "Custom", subtopic: "Speed" }] });
    assert.equal(result.status, 200);
    const added = rows("question").filter(q => q.id.startsWith("new-"));
    assert.equal(added.length, 2); assert.ok(added.every(eligibility.isEliminationQuestion)); assert.equal(added[1].category, "Custom");
  });
  for (const path of ["admin/questions", "questions/[id]"]) {
    await test(path + " PUT rejects wrong bank, inactive target and metadata transfer", async () => {
      for (const id of ["e1", "do"]) assert.equal((await invoke(path, "PUT", { ...payload, id }, "", id)).status, 404);
      assert.equal((await invoke(path, "PUT", { ...payload, id: "o1", category: "Elimination Drill" }, "", "o1")).status, 422);
      noQuestionWrites();
      assert.equal((await invoke(path, "PUT", { ...payload, id: "o1" }, "", "o1")).status, 200);
    });
  }
  await test("Elimination PUT rejects ordinary/inactive IDs and removing ownership", async () => {
    for (const id of ["o1", "de"]) assert.equal((await invoke("admin/elimination-drills", "PUT", { id, prompt: "Changed" })).status, 404);
    assert.equal((await invoke("admin/elimination-drills", "PUT", { id: "e2", subtopic: "General" })).status, 422);
    noQuestionWrites();
    assert.equal((await invoke("admin/elimination-drills", "PUT", { id: "e2", prompt: "Changed" })).status, 200);
  });
  await test("mutation predicate rejects a metadata/version race", async () => {
    updateRace = () => storeRow("question", { ...rows("question").find(q => q.id === "o1"), category: "Elimination Drill" });
    await assert.rejects(bank.updateBankQuestion("ORDINARY", "o1", { prompt: "Unsafe update" }), (error: any) => error.status === 409);
    assert.equal(rows("question").find(q => q.id === "o1").prompt, "Question o1");
    const where = logs.find(l => l.kind === "question.update")!.args.where;
    assert.equal(where.deletedAt, null); assert.ok(where.updatedAt instanceof Date); assert.equal(where.category, "Numerical Reasoning");
  });
  for (const path of ["admin/questions", "admin/questions/[id]", "admin/questions/bulk-delete", "questions/[id]"]) {
    await test(path + " DELETE rejects wrong bank and only soft-deletes eligible rows", async () => {
      const one = path.includes("[id]");
      assert.equal((await invoke(path, "DELETE", one ? undefined : { ids: ["e1"] }, "", "e1")).status, 404);
      noQuestionWrites();
      assert.equal((await invoke(path, "DELETE", one ? undefined : { ids: ["o1"] }, "", "o1")).status, 200);
      assert.ok(rows("question").find(q => q.id === "o1").deletedAt);
      assert.equal(rows("question").length, 11);
      assert.ok(logs.some(l => l.kind === "query" && l.args.sql.includes("FOR UPDATE")));
    });
  }
  for (const path of ["admin/questions", "admin/questions/bulk-delete", "admin/elimination-drills"]) await test(path + " mixed-bank selected delete changes zero rows", async () => {
    assert.equal((await invoke(path, "DELETE", { ids: ["o1", "e1"] })).status, 404);
    noQuestionWrites(); assert.equal(rows("question").filter(q => q.deletedAt !== null).length, 2);
  });
  await test("Elimination selected/delete-all cannot delete ordinary content", async () => {
    assert.equal((await invoke("admin/elimination-drills", "DELETE", { ids: ["o1"] })).status, 404);
    assert.equal((await invoke("admin/elimination-drills", "DELETE", { ids: ["e1"] })).status, 200);
    const result = await invoke("admin/elimination-drills", "DELETE", undefined, "?all=true");
    assert.equal(result.status, 200); assert.equal(result.body.deletedCount, 2);
    assert.ok(rows("question").filter(q => ordinaryIds.includes(q.id)).every(q => q.deletedAt === null));
  });
  for (const query of ["", "?category=Numerical%20Reasoning", "?category=Numerical%20Reasoning&subtopic=Missing", "?category=Elimination%20Drill", "?subtopic=Speed%20(ELIMINATION%20DRILL)"]) await test("practice ordinary containment " + query, async () => {
    const result = await invoke("questions", "GET", undefined, query);
    assert.equal(result.status, 200); only(result.body.questions.map((q: any) => q.id), ordinaryIds);
    if (/elimination/i.test(query)) assert.equal(result.body.questions.length, 0); else assert.ok(result.body.questions.length);
  });
  await test("practice mastered history cannot bring wrong-bank IDs into fallback/top-up", async () => {
    tables.examResult = [{ userId: "u1", detailsJson: JSON.stringify([...ordinaryIds, ...eliminationIds, ...deletedIds].map(id => ({ id, selectedIndex: 0, answerIndex: 0 }))) }];
    const result = await invoke("questions", "GET");
    assert.equal(result.status, 200); only(result.body.questions.map((q: any) => q.id), ordinaryIds);
  });
  await test("Daily count/selection use the same predicate and POST validates the issued candidate", async () => {
    const issued = await invoke("questions/daily", "GET");
    assert.equal(issued.status, 200); only([issued.body.question.id], ordinaryIds);
    assert.equal(issued.body.question.answerIndex, null); assert.equal(issued.body.question.explanation, null);
    const queries = logs.filter(l => l.kind === "query");
    assert.equal(queries.length, 2); assert.deepEqual(queries[0].args.values, queries[1].args.values.slice(0, -2));
    for (const id of ["e1", "do", ordinaryIds.find(id => id !== issued.body.question.id)!]) {
      assert.equal((await invoke("questions/daily", "POST", { questionId: id, selectedIndex: 1 })).status, 422);
      assert.equal(rows("dailyQuestionAttempt").length, 0);
    }
    assert.equal((await invoke("questions/daily", "POST", { questionId: issued.body.question.id, selectedIndex: 1 })).status, 200);
    assert.equal(rows("dailyQuestionAttempt").length, 1); assert.equal(rows("userMistake").length, 1);
    assert.equal((await invoke("questions/daily", "POST", { questionId: issued.body.question.id, selectedIndex: 0 })).status, 400);
    const completed = await invoke("questions/daily", "GET"); assert.equal(completed.body.hasAnswered, true); assert.equal(completed.body.question.answerIndex, 0);
  });
  for (const query of ["", "?itemCount=20&mode=SELF_PACED", "?itemCount=20&pool=UNATTEMPTED", "?itemCount=20&pool=MISTAKES_ONLY"]) await test("exam standard/custom/guided/top-up " + query, async () => {
    tables.examResult = [{ userId: "u1", detailsJson: JSON.stringify([{ id: "o1", selectedIndex: 0, answerIndex: 0 }]) }];
    tables.userMistake = ["o2", "e2", "do"].map(questionId => ({ id: questionId, userId: "u1", questionId, isMastered: false }));
    const result = await invoke("exam/start", "GET", undefined, query);
    assert.equal(result.status, 200); assert.ok(result.body.questions.length); only(result.body.questions.map((q: any) => q.id), ordinaryIds);
    if (query.includes("MISTAKES_ONLY")) only(result.body.questions.map((q: any) => q.id), ["o2"]);
  });
  await test("exam submit rejects E/deleted/missing before persistence and grades ordinary answers", async () => {
    for (const id of ["e1", "do", "missing"]) {
      assert.equal((await invoke("exam/submit", "POST", { answers: [{ questionId: "o1", selectedIndex: 0 }, { questionId: id, selectedIndex: 0 }], totalItems: 2 })).status, 422);
      assert.equal(rows("examResult").length, 0); assert.equal(rows("userMistake").length, 0);
    }
    assert.equal((await invoke("exam/submit", "POST", { answers: [{ questionId: "o1", selectedIndex: 0 }], totalItems: 1 })).status, 200);
    assert.equal(rows("examResult").length, 1);
  });
  for (const path of ["duels/challenge", "duels/matchmake"]) await test(path + " new snapshot includes five ordinary questions only", async () => {
    const result = await invoke(path, "POST", path.endsWith("challenge") ? { targetUserId: "target" } : undefined);
    assert.equal(result.status, 200); assert.equal(result.body.match.questions.length, 5);
    only(result.body.match.questions.map((q: any) => q.id), ordinaryIds);
  });
  await test("existing duel snapshot is preserved when joining", async () => {
    tables.duelMatch = [{ id: "old", status: "WAITING", player1Id: "other", questions: [{ id: "e1", prompt: "Historical snapshot" }] }];
    const result = await invoke("duels/matchmake", "POST"); assert.equal(result.status, 200);
    assert.equal(result.body.match.questions[0].prompt, "Historical snapshot"); assert.equal(logs.filter(l => l.kind === "query").length, 0);
  });
  await test("bookmarks filter Question hydration and preserve other targets/history", async () => {
    tables.bookmark = ["o1", "e1", "do"].map(targetId => ({ id: targetId, userId: "u1", targetId, targetType: "QUESTION" }));
    tables.bookmark.push({ id: "note", userId: "u1", targetId: "note", targetType: "STUDY_NOTE" });
    tables.studyNote = [{ id: "note", title: "Study note" }];
    const result = await invoke("bookmarks", "GET");
    assert.equal(result.status, 200); assert.deepEqual(result.body.bookmarks.map((q: any) => q.id).sort(), ["note", "o1"]);
    assert.equal(rows("bookmark").length, 4);
  });
  await test("Balik-Aral hydration/summary/evaluation filter E/deleted without deleting history", async () => {
    tables.userMistake = ["o1", "e1", "do"].map(questionId => ({ id: questionId, userId: "u1", questionId, isMastered: false, incorrectCount: 2, correctCount: 0 }));
    const result = await invoke("user/mistakes", "GET");
    assert.equal(result.status, 200); assert.equal(result.body.stats.totalRecorded, 1); assert.deepEqual(result.body.mistakes.map((m: any) => m.questionId), ["o1"]);
    assert.equal(result.body.mistakes[0].incorrectCount, 2); assert.ok(!("deletedAt" in result.body.mistakes[0].question));
    for (const id of ["e1", "do"]) assert.equal((await invoke("user/mistakes", "POST", { questionId: id, selectedIndex: 0 })).status, 404);
    assert.equal(rows("userMistake").length, 3);
  });
  await test("Study Room search/count and host selection enforce ordinary ownership", async () => {
    const result = await invoke("social/rooms/[roomId]/topic", "GET");
    assert.equal(result.status, 200); assert.equal(result.body.pagination.totalCount, 6);
    only(result.body.questions.map((q: any) => q.id), ordinaryIds);
    for (const id of ["e1", "do"]) assert.equal((await invoke("social/rooms/[roomId]/topic", "POST", { topicType: "QUESTION", questionId: id })).status, 404);
    assert.equal((await invoke("social/rooms/[roomId]/topic", "POST", { topicType: "QUESTION", questionId: "o1" })).status, 200);
    tables.studyRoom[0].hostId = "other";
    assert.equal((await invoke("social/rooms/[roomId]/topic", "POST", { topicType: "QUESTION", questionId: "o1" })).status, 403);
  });
  for (const path of ["drills", "drills/elimination"]) await test(path + " selects E only and empty bank has no ordinary fallback", async () => {
    const result = await invoke(path, "GET"); assert.equal(result.status, 200);
    const content = result.body.drills || result.body.questions;
    assert.ok(content.length); only(content.map((q: any) => q.id), eliminationIds);
    db.prepare('DELETE FROM "Question" WHERE id IN (?,?,?)').run(...eliminationIds);
    const empty = await invoke(path, "GET"); assert.equal(empty.status, 200); assert.equal((empty.body.drills || empty.body.questions).length, 0);
  });
  await test("Elimination seen rotation resets only within its bank", async () => {
    const result = await invoke("drills/elimination", "GET", undefined, "?seenIds=" + eliminationIds.join(","));
    assert.equal(result.status, 200); assert.equal(result.body.loopReset, true); only(result.body.drills.map((q: any) => q.id), eliminationIds);
  });
  for (const [action, target, untouched] of [["RESTORE_ALL_ORDINARY_QUESTIONS", "do", "de"], ["RESTORE_ALL_ELIMINATION_QUESTIONS", "de", "do"]]) await test(action + " is isolated and zero-match succeeds", async () => {
    const result = await invoke("admin/trash", "POST", { action }); assert.equal(result.status, 200); assert.equal(result.body.restoredCount, 1);
    assert.equal(rows("question").find(q => q.id === target).deletedAt, null); assert.ok(rows("question").find(q => q.id === untouched).deletedAt);
    assert.equal((await invoke("admin/trash", "POST", { action })).body.restoredCount, 0);
  });
  await test("ambiguous restore-all fails closed in API and helper", async () => {
    assert.equal((await invoke("admin/trash", "POST", { action: "RESTORE_ALL_QUESTIONS" })).status, 400);
    await assert.rejects(recovery.restoreAllTrashQuestions(), (e: any) => e.status === 400); noQuestionWrites();
  });
  await test("structured Trash classification and selected mixed-bank restore remain correct", async () => {
    const trash = await invoke("admin/trash", "GET"); assert.equal(trash.status, 200);
    assert.equal(trash.body.items.find((q: any) => q.id === "de").questionBank, "ELIMINATION");
    assert.equal(trash.body.items.find((q: any) => q.id === "do").questionBank, "ORDINARY");
    const result = await invoke("admin/trash", "POST", { action: "RESTORE_SELECTED", items: ["do", "de"].map(entityId => ({ entityType: "question", entityId })) });
    assert.equal(result.status, 200); assert.equal(result.body.processedCount, 2);
  });
  await test("purge selected preserves active Questions and users, purges both deleted banks and cleans bookmarks", async () => {
    tables.bookmark = ["o1", "do", "de"].map(targetId => ({ id: targetId, targetType: "QUESTION", targetId }));
    const result = await invoke("admin/trash", "POST", { action: "PURGE_SELECTED", items: ["o1", "do", "de"].map(entityId => ({ entityType: "question", entityId })).concat([{ entityType: "user", entityId: "target" }]) });
    assert.equal(result.status, 200); assert.equal(result.body.processedCount, 2); assert.equal(result.body.skippedCount, 2);
    assert.deepEqual(rows("bookmark").map(b => b.targetId), ["o1"]); assert.equal(rows("user").length, 1);
  });
  await test("purge-all retains original both-bank scope and confirmation", async () => {
    assert.equal((await invoke("admin/trash", "POST", { action: "PURGE_ALL_QUESTIONS" })).status, 400);
    const result = await invoke("admin/trash", "POST", { action: "PURGE_ALL_QUESTIONS", confirmation: "PURGE ALL" });
    assert.equal(result.status, 200); assert.equal(result.body.purgedCount, 2); assert.equal(rows("question").length, 9);
  });
  await test("Flashcard CRUD/read/soft-delete/restore/purge remain separate", async () => {
    const before = JSON.stringify(rows("question"));
    const created = await invoke("admin/flashcards", "POST", { front: "Front", back: "Back", category: "Elimination Drill" });
    assert.equal(created.status, 200); const id = created.body.flashcard.id;
    assert.equal((await invoke("admin/flashcards", "PUT", { id, front: "Edited" })).status, 200);
    assert.equal((await invoke("flashcards", "GET")).body.flashcards.length, 1);
    assert.equal((await invoke("admin/flashcards", "DELETE", undefined, "?id=" + id)).status, 200);
    assert.equal((await invoke("flashcards", "GET")).body.flashcards.length, 0);
    await recovery.restoreRecord("flashcard", id); assert.equal(rows("flashcard")[0].deletedAt, null);
    await recovery.softDeleteRecord("flashcard", id);
    const purged = await recovery.permanentlyDeleteSelectedRecords([{ entityType: "flashcard", entityId: id }]);
    assert.equal(purged.processedCount, 1); assert.equal(rows("flashcard").length, 0); assert.equal(JSON.stringify(rows("question")), before);
  });
  await test("admin and user authentication still reject unauthorized calls before SQL/writes", async () => {
    role = null;
    for (const path of ["admin/questions", "admin/questions/import", "admin/elimination-drills", "questions", "questions/daily", "exam/submit", "user/mistakes", "admin/trash"]) {
      const result = await invoke(path, "POST", payload); assert.ok([401, 403].includes(result.status), path);
    }
    noQuestionWrites(); assert.equal(logs.filter(l => l.kind === "query").length, 0);
    role = "USER"; assert.equal((await invoke("admin/questions", "POST", payload)).status, 403);
  });

  // -------------------------------------------------------------
  // PHASE B2 — EXPLICIT BANK OWNERSHIP TESTS
  // -------------------------------------------------------------

  await test("Phase B2: 4 fundamental states in JS classifier and questionBankOf", async () => {
    // State 1: ORDINARY + ordinary metadata
    assert.equal(eligibility.isEliminationQuestion({ bankType: "ORDINARY", category: "Math", subtopic: "Algebra" }), false);
    assert.equal(eligibility.questionBankOf({ bankType: "ORDINARY", category: "Math", subtopic: "Algebra" }), "ORDINARY");

    // State 2: ORDINARY + elimination-like metadata (explicit ownership beats metadata!)
    assert.equal(eligibility.isEliminationQuestion({ bankType: "ORDINARY", category: "Elimination Drill", subtopic: "Speed" }), false);
    assert.equal(eligibility.questionBankOf({ bankType: "ORDINARY", category: "Elimination Drill", subtopic: "Speed" }), "ORDINARY");

    // State 3: ELIMINATION + ordinary-like metadata (explicit ownership beats metadata!)
    assert.equal(eligibility.isEliminationQuestion({ bankType: "ELIMINATION", category: "Math", subtopic: "Algebra" }), true);
    assert.equal(eligibility.questionBankOf({ bankType: "ELIMINATION", category: "Math", subtopic: "Algebra" }), "ELIMINATION");

    // State 4a: NULL + ordinary metadata (legacy fallback)
    assert.equal(eligibility.isEliminationQuestion({ bankType: null, category: "Math", subtopic: "Algebra" }), false);
    assert.equal(eligibility.questionBankOf({ bankType: null, category: "Math", subtopic: "Algebra" }), "ORDINARY");

    // State 4b: NULL + elimination metadata (legacy fallback)
    assert.equal(eligibility.isEliminationQuestion({ bankType: null, category: "Elimination Drill", subtopic: "Speed" }), true);
    assert.equal(eligibility.questionBankOf({ bankType: null, category: "Elimination Drill", subtopic: "Speed" }), "ELIMINATION");
  });

  await test("Phase B4C: SQL helpers require explicit bankType and exclude legacy NULL rows", async () => {
    db.exec('DELETE FROM "Question"');
    // Store 5 representative rows:
    storeRow("question", { ...fixture("s1", "Math", "Algebra"), bankType: "ORDINARY" });
    storeRow("question", { ...fixture("s2", "Elimination Drill", "Speed"), bankType: "ORDINARY" });
    storeRow("question", { ...fixture("s3", "Math", "Algebra"), bankType: "ELIMINATION" });
    storeRow("question", { ...fixture("s4", "Math", "Algebra"), bankType: null });
    storeRow("question", { ...fixture("s5", "Elimination Drill", "Speed"), bankType: null });

    // Test activeOrdinaryQuestionWhere: s1, s2 (explicit ORDINARY) and s4 (legacy ordinary NULL)
    const ordinaryRows = await bank.findBankQuestions({ where: eligibility.activeOrdinaryQuestionWhere() });
    assert.deepEqual(ordinaryRows.map((r: any) => r.id).sort(), ["s1", "s2"].sort());

    // Test activeEliminationQuestionWhere: s3 (explicit ELIMINATION) and s5 (legacy elimination NULL)
    const eliminationRows = await bank.findBankQuestions({ where: eligibility.activeEliminationQuestionWhere() });
    assert.deepEqual(eliminationRows.map((r: any) => r.id).sort(), ["s3"].sort());

    // Test softDeletedOrdinaryQuestionWhere and softDeletedEliminationQuestionWhere
    db.exec('DELETE FROM "Question"');
    storeRow("question", { ...fixture("ds1", "Math", "Algebra", new Date()), bankType: "ORDINARY" });
    storeRow("question", { ...fixture("ds2", "Elimination Drill", "Speed", new Date()), bankType: "ORDINARY" });
    storeRow("question", { ...fixture("ds3", "Math", "Algebra", new Date()), bankType: "ELIMINATION" });
    storeRow("question", { ...fixture("ds4", "Math", "Algebra", new Date()), bankType: null });
    storeRow("question", { ...fixture("ds5", "Elimination Drill", "Speed", new Date()), bankType: null });

    const deletedOrdinaryRows = await bank.findBankQuestions({ where: eligibility.softDeletedOrdinaryQuestionWhere() });
    assert.deepEqual(deletedOrdinaryRows.map((r: any) => r.id).sort(), ["ds1", "ds2"].sort());

    const deletedEliminationRows = await bank.findBankQuestions({ where: eligibility.softDeletedEliminationQuestionWhere() });
    assert.deepEqual(deletedEliminationRows.map((r: any) => r.id).sort(), ["ds3"].sort());
  });

  for (const [path, expectedBank] of [
    ["admin/questions", "ORDINARY"],
    ["admin/questions/import", "ORDINARY"],
    ["questions", "ORDINARY"],
    ["admin/elimination-drills", "ELIMINATION"],
  ] as const) {
    for (const clientBankType of [undefined, null, "INVALID_BANK_TYPE", "ORDINARY", "ELIMINATION"]) {
      await test("Phase B4B: " + path + " stores " + expectedBank + " with client bankType " + String(clientBankType), async () => {
        const before = rows("question");
        const existingIds = new Set(before.map(q => q.id));
        const question = {
          ...payload,
          ...(clientBankType !== undefined && { bankType: clientBankType }),
        };
        const data = path === "admin/questions" ? question
          : path === "admin/questions/import" ? [question] : { questions: [question] };
        const result = await invoke(path, "POST", data);
        assert.equal(result.status, 200);
        const added = rows("question").filter(q => !existingIds.has(q.id));
        assert.equal(added.length, 1);
        assert.equal(added[0].bankType, expectedBank);
        assert.equal(added[0].prompt, payload.prompt);
        assert.deepEqual(rows("question").filter(q => existingIds.has(q.id)), before);
      });
    }
  }

  await test("Phase B4D: Updates reject rows without explicit bankType ownership", async () => {
    // Defensive regression:
    // production Question.bankType is non-nullable, but if malformed/legacy
    // data is ever encountered, mutation must fail closed rather than infer
    // ownership from category/subtopic metadata.
    storeRow("question", { ...fixture("o1"), bankType: null });
    storeRow("question", {
      ...fixture("e1", " \tELIMINATION DRILL\u00a0", "General"),
      bankType: null,
    });

    const beforeO1 = rows("question").find((r: any) => r.id === "o1");
    assert.equal(beforeO1.bankType, null);

    const resUpdateO1 = await invoke("admin/questions", "PUT", {
      id: "o1",
      category: "Numerical Reasoning",
      subtopic: "Percentages",
      prompt: "Updated o1 prompt",
      options: ["Correct", "Wrong", "C", "D"],
      answerIndex: 0,
      bankType: "ELIMINATION",
    });

    assert.equal(resUpdateO1.status, 404);

    const afterO1 = rows("question").find((r: any) => r.id === "o1");
    assert.equal(afterO1.bankType, null);
    assert.notEqual(afterO1.prompt, "Updated o1 prompt");

    const beforeE1 = rows("question").find((r: any) => r.id === "e1");
    assert.equal(beforeE1.bankType, null);

    const resUpdateE1 = await invoke("admin/elimination-drills", "PUT", {
      id: "e1",
      prompt: "Updated e1 prompt",
      bankType: "ORDINARY",
    });

    assert.equal(resUpdateE1.status, 404);

    const afterE1 = rows("question").find((r: any) => r.id === "e1");
    assert.equal(afterE1.bankType, null);
    assert.notEqual(afterE1.prompt, "Updated e1 prompt");
  });
  await test("Phase B4C: Trash classification uses explicit bankType on persisted rows", async () => {
    db.exec('DELETE FROM "Question"');
    // Store soft-deleted questions with various combinations
    storeRow("question", { ...fixture("t1", "Math", "Algebra", new Date()), bankType: "ORDINARY" });
    storeRow("question", { ...fixture("t2", "Elimination Drill", "Speed", new Date()), bankType: "ORDINARY" });
    storeRow("question", { ...fixture("t3", "Math", "Algebra", new Date()), bankType: "ELIMINATION" });
    storeRow("question", { ...fixture("t4", "Math", "Algebra", new Date()), bankType: "ORDINARY" });
    storeRow("question", { ...fixture("t5", "Elimination Drill", "Speed", new Date()), bankType: "ELIMINATION" });

    const trash = await recovery.getTrashBinItems();
    const map = new Map(trash.map((i: any) => [i.id, i.questionBank]));

    assert.equal(map.get("t1"), "ORDINARY");
    assert.equal(map.get("t2"), "ORDINARY"); // Explicit bankType beats metadata!
    assert.equal(map.get("t3"), "ELIMINATION"); // Explicit bankType beats metadata!
    assert.equal(map.get("t4"), "ORDINARY"); // Legacy NULL fallback
    assert.equal(map.get("t5"), "ELIMINATION"); // Legacy NULL fallback
  });

  await test("Phase B4C: RESTORE_ALL restores explicit rows for targeted bank only", async () => {
    db.exec('DELETE FROM "Question"');
    storeRow("question", { ...fixture("r1", "Math", "Algebra", new Date()), bankType: "ORDINARY" });
    storeRow("question", { ...fixture("r2", "Elimination Drill", "Speed", new Date()), bankType: "ORDINARY" });
    storeRow("question", { ...fixture("r3", "Math", "Algebra", new Date()), bankType: "ELIMINATION" });
    storeRow("question", { ...fixture("r4", "Math", "Algebra", new Date()), bankType: "ORDINARY" });
    storeRow("question", { ...fixture("r5", "Elimination Drill", "Speed", new Date()), bankType: "ELIMINATION" });

    // Restore all ordinary questions: r1, r2, r4 should be restored; r3, r5 should remain deleted
    const resOrd = await invoke("admin/trash", "POST", { action: "RESTORE_ALL_ORDINARY_QUESTIONS" });
    assert.equal(resOrd.status, 200);
    assert.equal(resOrd.body.restoredCount, 3);

    const afterOrd = rows("question");
    assert.equal(afterOrd.find((r: any) => r.id === "r1").deletedAt, null);
    assert.equal(afterOrd.find((r: any) => r.id === "r2").deletedAt, null);
    assert.notEqual(afterOrd.find((r: any) => r.id === "r3").deletedAt, null);
    assert.equal(afterOrd.find((r: any) => r.id === "r4").deletedAt, null);
    assert.notEqual(afterOrd.find((r: any) => r.id === "r5").deletedAt, null);

    // Restore all elimination questions: r3, r5 should be restored
    const resElim = await invoke("admin/trash", "POST", { action: "RESTORE_ALL_ELIMINATION_QUESTIONS" });
    assert.equal(resElim.status, 200);
    assert.equal(resElim.body.restoredCount, 2);

    const afterElim = rows("question");
    assert.equal(afterElim.find((r: any) => r.id === "r3").deletedAt, null);
    assert.equal(afterElim.find((r: any) => r.id === "r5").deletedAt, null);
  });
  db.close();
  console.log("QUESTION BANK ISOLATION: " + passed + " passed, " + failed + " failed.");
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
