import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string): void {
  if (condition) {
    console.log(`PASS: ${description}`);
    passed++;
  } else {
    console.error(`FAIL: ${description}`);
    failed++;
  }
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function runtimeSourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== "scripts") {
        files.push(...runtimeSourceFiles(absolutePath));
      }
      continue;
    }

    if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function functionSection(source: string, start: string, end?: string): string {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) return "";

  const endIndex = end ? source.indexOf(end, startIndex + start.length) : -1;
  return source.slice(startIndex, endIndex >= 0 ? endIndex : undefined);
}

function run(): void {
  const sourceRoot = path.join(process.cwd(), "src");
  const productionFiles = runtimeSourceFiles(sourceRoot);
  const userDeleteCall = /\b[A-Za-z_$][\w$]*\s*\.\s*user\s*\.\s*delete(?:Many)?\s*\(/;
  const rawUserDelete = /\bDELETE\s+FROM\s+(?:(?:"?public"?)\.)?"?User"?\b/i;
  const deleteOffenders = productionFiles.filter((file) => {
    const source = fs.readFileSync(file, "utf8");
    return userDeleteCall.test(source) || rawUserDelete.test(source);
  });

  assert(
    deleteOffenders.length === 0,
    "production application/runtime source contains no physical User delete call"
  );

  const recoverySource = read("src/lib/recovery/softDelete.ts");
  const softDeleteSection = functionSection(
    recoverySource,
    "export async function softDeleteRecord",
    "export async function restoreRecord"
  );
  const restoreSection = functionSection(
    recoverySource,
    "export async function restoreRecord",
    "export async function getTrashBinItems"
  );
  const trashPurgeSection = functionSection(
    recoverySource,
    "export async function purgeExpiredRecords"
  );

  assert(
    softDeleteSection.includes("prisma.user.update"),
    "User soft-delete mutation remains available"
  );
  assert(
    restoreSection.includes("prisma.user.update"),
    "User restore mutation remains available"
  );
  assert(
    trashPurgeSection.includes('entityType: "user"') &&
      trashPurgeSection.includes("totalPurged: 0") &&
      trashPurgeSection.includes("disabled: true"),
    "trash purge reports User hard purge as disabled with a zero count"
  );
  assert(
    trashPurgeSection.includes("prisma.question.deleteMany") &&
      trashPurgeSection.includes("prisma.flashcard.deleteMany") &&
      trashPurgeSection.includes("prisma.systemSetting.deleteMany"),
    "trash purge preserves question, flashcard, and system-setting cleanup"
  );

  const recoveryJobSource = read("src/jobs/purgeExpiredRecords.ts");
  assert(
    !recoveryJobSource.includes('from "@/lib/prisma"') &&
      !recoveryJobSource.includes("prisma.user.findMany") &&
      recoveryJobSource.includes("totalPurged: 0") &&
      recoveryJobSource.includes("disabled: true"),
    "recovery purge returns disabled before any Prisma query or User mutation"
  );

  const trashRouteSource = read("src/app/api/admin/trash/route.ts");
  assert(
    trashRouteSource.includes("userHardPurgeDisabled:") &&
      trashRouteSource.includes("Physical User purge is disabled"),
    "trash API explicitly reports partial cleanup with User hard purge disabled"
  );

  const recoveryRouteSource = read("src/app/api/admin/recovery/route.ts");
  assert(
    recoveryRouteSource.includes("success: false") &&
      recoveryRouteSource.includes("userHardPurgeDisabled:") &&
      recoveryRouteSource.includes("{ status: 501 }"),
    "recovery API returns an explicit not-supported response without false purge success"
  );

  console.log(`Containment regression summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

run();
