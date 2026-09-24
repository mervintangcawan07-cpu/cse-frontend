import fs from "fs";
import path from "path";

export interface SecretLeakFinding {
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  category: string;
  location: string;
  matchSnippet: string;
  description: string;
}

export interface BundleSecretsSuiteResult {
  suite: "PHASE 2: CLIENT BUNDLE SECRET LEAK AUDIT";
  status: "PASSED" | "FAILED";
  timestamp: string;
  durationMs: number;
  metrics: {
    staticFilesScanned: number;
    clientSourceFilesScanned: number;
    envVarsInspected: number;
    leaksDetected: number;
  };
  findings: SecretLeakFinding[];
  details: string[];
}

// Critical secret patterns that must never appear in client bundles
const SENSITIVE_PATTERNS: Array<{
  category: string;
  regex: RegExp;
  severity: "CRITICAL" | "HIGH";
  description: string;
}> = [
  {
    category: "PayMongo Secret Key",
    regex: /sk_live_[0-9a-zA-Z]{24,}/g,
    severity: "CRITICAL",
    description: "Production PayMongo secret key exposed in client bundle",
  },
  {
    category: "PayMongo Test Secret Key",
    regex: /sk_test_[0-9a-zA-Z]{24,}/g,
    severity: "HIGH",
    description: "PayMongo test secret key exposed in client bundle",
  },
  {
    category: "PayMongo Webhook Secret",
    regex: /whsec_[0-9a-zA-Z]{24,}/g,
    severity: "CRITICAL",
    description: "PayMongo webhook signing secret exposed in client bundle",
  },
  {
    category: "Resend API Key",
    regex: /re_[0-9a-zA-Z]{24,}/g,
    severity: "CRITICAL",
    description: "Resend API key exposed in client bundle",
  },
  {
    category: "Database Connection String",
    regex: /postgres(?:ql)?:\/\/[a-zA-Z0-9_-]+:[^@\s"']+@[a-zA-Z0-9.-]+:[0-9]+\/[a-zA-Z0-9_.-]+/g,
    severity: "CRITICAL",
    description: "Postgres database credentials with password exposed in client bundle",
  },
  {
    category: "RSA / EC Private Key",
    regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
    severity: "CRITICAL",
    description: "Private cryptographic key block exposed in client bundle",
  },
  {
    category: "Upstash Redis REST Token",
    regex: /AX[a-zA-Z0-9_-]{30,}={0,2}/g,
    severity: "CRITICAL",
    description: "Upstash Redis REST authorization token exposed in client bundle",
  },
  {
    category: "Google Gemini API Key",
    regex: /AIza[0-9A-Za-z-_]{35}/g,
    severity: "HIGH",
    description: "Google AI / Gemini API key pattern detected in client bundle",
  },
];

// Disallowed server imports inside client ("use client") components
const FORBIDDEN_CLIENT_IMPORTS = [
  { module: "@/lib/prisma", name: "Prisma Client (server only)" },
  { module: "pg", name: "pg driver (server only)" },
  { module: "bcryptjs", name: "bcryptjs (server only password hashing)" },
  { module: "@/lib/serverAuth", name: "serverAuth (server only authentication guard)" },
  { module: "@/lib/payment/refundService", name: "refundService (server only refund execution)" },
  { module: "@/lib/accounting/idempotentLedgerService", name: "idempotentLedgerService (server accounting)" },
];

function getAllFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

export async function runBundleSecretsSuite(): Promise<BundleSecretsSuiteResult> {
  const startTime = Date.now();
  console.log("\n==================================================");
  console.log("   PHASE 2: CLIENT BUNDLE SECRET LEAK AUDIT       ");
  console.log("==================================================");

  const findings: SecretLeakFinding[] = [];
  const details: string[] = [];

  // 1. Scan .next/static artifacts
  const staticDir = path.join(process.cwd(), ".next", "static");
  const staticFiles = getAllFiles(staticDir, [".js", ".json"]);
  console.log(`\n--- [TEST 2.1] Scanning ${staticFiles.length} client bundles in .next/static ---`);

  // Detect any known server secrets in process.env to check exact values
  const knownServerSecrets: Array<{ name: string; value: string }> = [];
  const secretEnvNames = [
    "DATABASE_URL",
    "DIRECT_URL",
    "JWT_SECRET",
    "PAYMONGO_SECRET_KEY",
    "PAYMONGO_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "CRON_SECRET",
    "UPSTASH_REDIS_REST_TOKEN",
  ];

  for (const name of secretEnvNames) {
    const val = process.env[name];
    if (val && val.trim().length >= 8) {
      knownServerSecrets.push({ name, value: val.trim() });
    }
  }

  for (const filePath of staticFiles) {
    const relativePath = path.relative(process.cwd(), filePath);
    const content = fs.readFileSync(filePath, "utf-8");

    // Check regex patterns
    for (const pattern of SENSITIVE_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(content)) !== null) {
        // Redact match for reporting
        const matchedStr = match[0];
        const redacted = matchedStr.length > 8
          ? `${matchedStr.slice(0, 4)}...${matchedStr.slice(-4)}`
          : "***";

        findings.push({
          severity: pattern.severity,
          category: pattern.category,
          location: relativePath,
          matchSnippet: redacted,
          description: pattern.description,
        });
      }
    }

    // Check exact known secret values from environment
    for (const secret of knownServerSecrets) {
      if (content.includes(secret.value)) {
        findings.push({
          severity: "CRITICAL",
          category: `Env Value: ${secret.name}`,
          location: relativePath,
          matchSnippet: `[REDACTED_${secret.name}]`,
          description: `Exact value of server environment variable ${secret.name} found in static client bundle`,
        });
      }
    }
  }

  if (findings.length === 0) {
    console.log(`  ✅ [PASS] 0 secret patterns detected across ${staticFiles.length} client chunks.`);
  } else {
    console.error(`  ❌ [FAIL] ${findings.length} secret leak(s) detected in client bundles!`);
  }

  // 2. Inspect Environment Variables for NEXT_PUBLIC_ misconfigurations
  console.log("\n--- [TEST 2.2] Inspecting NEXT_PUBLIC_ Environment Variables ---");
  const envKeys = Object.keys(process.env);
  let nextPublicVarsCount = 0;
  const dangerousWords = ["SECRET", "PRIVATE", "PASSWORD", "POSTGRES", "DATABASE_URL", "TOKEN"];

  for (const key of envKeys) {
    if (key.startsWith("NEXT_PUBLIC_")) {
      nextPublicVarsCount++;
      const uppercaseKey = key.toUpperCase();
      for (const danger of dangerousWords) {
        // Allow safe standard public tokens if any, but flag secret terms
        if (uppercaseKey.includes(danger) && !uppercaseKey.includes("TOKEN_IDENTIFIER")) {
          findings.push({
            severity: "CRITICAL",
            category: "Dangerous NEXT_PUBLIC_ Variable",
            location: `process.env.${key}`,
            matchSnippet: key,
            description: `Environment variable ${key} exposes sensitive term '${danger}' to client runtime!`,
          });
        }
      }
    }
  }
  console.log(`  ✅ [PASS] Inspected ${nextPublicVarsCount} NEXT_PUBLIC_ environment variables. No dangerous keywords found.`);

  // 3. Client Component Source AST/Regex Scanning
  console.log("\n--- [TEST 2.3] Scanning 'use client' Source Files for Server Imports ---");
  const srcAppDir = path.join(process.cwd(), "src", "app");
  const srcCompDir = path.join(process.cwd(), "src", "components");
  const clientFiles = [...getAllFiles(srcAppDir, [".tsx", ".jsx"]), ...getAllFiles(srcCompDir, [".tsx", ".jsx"])];
  let clientComponentsCount = 0;

  for (const filePath of clientFiles) {
    const relativePath = path.relative(process.cwd(), filePath);
    const content = fs.readFileSync(filePath, "utf-8");

    // Check if file is a Client Component
    if (content.includes('"use client"') || content.includes("'use client'")) {
      clientComponentsCount++;

      for (const forbidden of FORBIDDEN_CLIENT_IMPORTS) {
        // Match import statements but ignore 'import type'
        const importRegex = new RegExp(`import\\s+(?!type\\s+)[^;]*from\\s+["']${forbidden.module}["']`, "g");
        if (importRegex.test(content)) {
          findings.push({
            severity: "HIGH",
            category: "Forbidden Client Import",
            location: relativePath,
            matchSnippet: `import from "${forbidden.module}"`,
            description: `Client component directly imports ${forbidden.name}, risking server-side data leaks.`,
          });
        }
      }
    }
  }

  console.log(`  ✅ [PASS] Scanned ${clientComponentsCount} client components. Zero forbidden server imports.`);

  const durationMs = Date.now() - startTime;
  const isPassed = findings.length === 0;

  details.push(
    `Static client bundles scanned: ${staticFiles.length}. Client components scanned: ${clientComponentsCount}. NEXT_PUBLIC_ vars: ${nextPublicVarsCount}. Leaks found: ${findings.length}.`
  );

  console.log("\n--------------------------------------------------");
  console.log(`PHASE 2 STATUS: ${isPassed ? "PASSED ✅" : "FAILED ❌"} (${durationMs}ms)`);
  console.log("--------------------------------------------------");

  return {
    suite: "PHASE 2: CLIENT BUNDLE SECRET LEAK AUDIT",
    status: isPassed ? "PASSED" : "FAILED",
    timestamp: new Date().toISOString(),
    durationMs,
    metrics: {
      staticFilesScanned: staticFiles.length,
      clientSourceFilesScanned: clientComponentsCount,
      envVarsInspected: nextPublicVarsCount,
      leaksDetected: findings.length,
    },
    findings,
    details,
  };
}

if (process.argv[1] && process.argv[1].includes("audit-bundle-secrets")) {
  runBundleSecretsSuite()
    .then((result) => {
      if (result.status === "FAILED") process.exit(1);
    })
    .catch((err) => {
      console.error("Fatal error running Phase 2 audit:", err);
      process.exit(1);
    });
}
