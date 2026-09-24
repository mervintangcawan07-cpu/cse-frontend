import fs from "fs";
import path from "path";

interface RouteAudit {
  route: string;
  methods: string[];
  authMechanisms: string[];
  hasRateLimit: boolean;
  hasFindManyWithoutTake: boolean;
  unboundedFindManyDetails: string[];
  catchesErrorString: boolean;
  leaksErrorMessage: boolean;
  usesTransaction: boolean;
  hasInputValidation: boolean;
}

const apiDir = path.resolve(process.cwd(), "src/app/api");

function scanDirectory(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      scanDirectory(fullPath, fileList);
    } else if (item.name === "route.ts" || item.name === "route.js") {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function countChar(str: string, target: string): number {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === target) count++;
  }
  return count;
}

const routeFiles = scanDirectory(apiDir);
const results: RouteAudit[] = [];

for (const filePath of routeFiles) {
  const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const methods: string[] = [];
  const httpVerbs = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
  for (const verb of httpVerbs) {
    if (new RegExp("export\\s+async\\s+function\\s+" + verb + "\\b").test(content)) {
      methods.push(verb);
    }
  }

  const authPatterns = [
    "requireAdminAuth",
    "requireProAuth",
    "requirePartnerAuth",
    "requireAuthUser",
    "requireSudo",
    "getAuthenticatedUser",
    "getAuthenticatedSessionResult",
    "verifyPartnerJWT",
    "getAuthenticatedPartner",
    "verifyJWT",
    "isValidCronSecret",
    "CRON_SECRET",
  ];
  const authMechanisms = authPatterns.filter((pattern) => content.includes(pattern));

  const hasRateLimit =
    content.includes("checkRateLimit") ||
    content.includes("LIMITER") ||
    content.includes("GENERAL_API_LIMITER") ||
    content.includes("AUTH_LIMITER") ||
    content.includes("AI_LIMITER");

  const usesTransaction = content.includes("$transaction");
  const hasInputValidation =
    content.includes("safeParse") ||
    content.includes("zod") ||
    content.includes(".validate") ||
    content.includes("validateBoundedPaginationQuery") ||
    content.includes("validateQuestionPayload");

  const unboundedFindManyDetails: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(".findMany(")) {
      const startLine = i + 1;
      let depth = countChar(line, "(") - countChar(line, ")");
      let snippet = line;
      let j = i + 1;

      while (depth > 0 && j < lines.length && j < i + 30) {
        snippet += "\n" + lines[j];
        depth += countChar(lines[j], "(") - countChar(lines[j], ")");
        j++;
      }

      if (!/\btake\s*:/.test(snippet)) {
        unboundedFindManyDetails.push("line " + startLine);
      }
    }
  }

  const leaksErrorMessage =
    content.includes("error: error.message") ||
    content.includes("error: err.message") ||
    content.includes("error: e.message") ||
    content.includes("message: error.message") ||
    content.includes("message: err.message") ||
    content.includes("message: e.message") ||
    content.includes("error: error.toString()") ||
    content.includes("error: err.toString()") ||
    content.includes("error: e.toString()") ||
    content.includes("error: msg");

  results.push({
    route: relPath,
    methods,
    authMechanisms,
    hasRateLimit,
    hasFindManyWithoutTake: unboundedFindManyDetails.length > 0,
    unboundedFindManyDetails,
    catchesErrorString: content.includes("catch (") || content.includes("catch("),
    leaksErrorMessage,
    usesTransaction,
    hasInputValidation,
  });
}

const summary = {
  totalRoutes: results.length,
  routesWithoutAuth: results
    .filter((r) => r.authMechanisms.length === 0)
    .map((r) => ({ route: r.route, methods: r.methods })),
  routesWithoutRateLimit: results
    .filter((r) => !r.hasRateLimit)
    .map((r) => ({ route: r.route, methods: r.methods, auth: r.authMechanisms })),
  routesLeakingErrorMessages: results
    .filter((r) => r.leaksErrorMessage)
    .map((r) => ({ route: r.route, methods: r.methods })),
  routesWithUnboundedFindMany: results
    .filter((r) => r.hasFindManyWithoutTake)
    .map((r) => ({ route: r.route, details: r.unboundedFindManyDetails })),
};

const outputPath = path.resolve(process.cwd(), "audit_summary.json");
fs.writeFileSync(outputPath, JSON.stringify({ summary, details: results }, null, 2), "utf-8");

console.log("\n==================================================");
console.log("             ROUTE AUDIT COMPLETE                 ");
console.log("==================================================");
console.log("Total Routes Scanned:                   " + summary.totalRoutes);
console.log("Routes Without Apparent Auth:           " + summary.routesWithoutAuth.length);
console.log("Routes Without Rate Limiting:           " + summary.routesWithoutRateLimit.length);
console.log("Routes Potentially Leaking error.message: " + summary.routesLeakingErrorMessages.length);
console.log("Routes with Unbounded findMany:         " + summary.routesWithUnboundedFindMany.length);
console.log("--------------------------------------------------");

if (summary.routesLeakingErrorMessages.length > 0) {
  console.log("\n=== ROUTES POTENTIALLY LEAKING ERROR MESSAGES ===");
  summary.routesLeakingErrorMessages.forEach((r) => {
    console.log(" - " + r.route + " [" + r.methods.join(", ") + "]");
  });
}

if (summary.routesWithUnboundedFindMany.length > 0) {
  console.log("\n=== UNBOUNDED FINDMANY SAMPLES ===");
  summary.routesWithUnboundedFindMany.forEach((r) => {
    console.log(" - " + r.route + " (" + r.details.join(", ") + ")");
  });
}

if (summary.routesWithoutAuth.length > 0) {
  console.log("\n=== UNPROTECTED / PUBLIC ROUTES ===");
  summary.routesWithoutAuth.forEach((r) => {
    console.log(" - " + r.route + " [" + r.methods.join(", ") + "]");
  });
}

console.log("\nDetailed artifact written to: " + outputPath + "\n");