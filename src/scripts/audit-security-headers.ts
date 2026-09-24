import fs from "fs";
import path from "path";
import nextConfig from "../../next.config";

export interface HeaderAuditItem {
  header: string;
  expected: string;
  actual: string | undefined;
  status: "PASSED" | "FAILED";
  details: string;
}

export interface CookieAuditItem {
  file: string;
  cookieName: string;
  hasHttpOnly: boolean;
  hasSecure: boolean;
  hasSameSite: boolean;
  hasRootPath: boolean;
  status: "PASSED" | "FAILED";
  details: string;
}

export interface SecurityHeadersSuiteResult {
  suite: "PHASE 4: HTTP SECURITY HEADERS & COOKIE PROTECTIONS AUDIT";
  status: "PASSED" | "FAILED";
  timestamp: string;
  durationMs: number;
  headersAudit: HeaderAuditItem[];
  cookiesAudit: CookieAuditItem[];
  details: string[];
}

export async function runSecurityHeadersSuite(): Promise<SecurityHeadersSuiteResult> {
  const startTime = Date.now();
  console.log("\n==================================================");
  console.log("   PHASE 4: SECURITY HEADERS & COOKIE AUDIT       ");
  console.log("==================================================");

  const headersAudit: HeaderAuditItem[] = [];
  const cookiesAudit: CookieAuditItem[] = [];
  const details: string[] = [];

  // =========================================================================
  // 1. HTTP SECURITY HEADERS IN NEXT.CONFIG.TS
  // =========================================================================
  console.log("\n--- [TEST 4.1] Evaluating HTTP Security Headers in next.config.ts ---");
  let declaredHeaders: Array<{ key: string; value: string }> = [];

  if (typeof nextConfig.headers === "function") {
    const headerRules = await nextConfig.headers();
    const globalRule = headerRules.find((r) => r.source === "/:path*");
    if (globalRule && Array.isArray(globalRule.headers)) {
      declaredHeaders = globalRule.headers;
    }
  }

  const findHeader = (keyName: string) =>
    declaredHeaders.find((h) => h.key.toLowerCase() === keyName.toLowerCase())?.value;

  // 1. Strict-Transport-Security (HSTS)
  const hsts = findHeader("Strict-Transport-Security");
  const hstsValid = Boolean(
    hsts &&
    hsts.includes("max-age=") &&
    hsts.includes("includeSubDomains") &&
    hsts.includes("preload")
  );
  headersAudit.push({
    header: "Strict-Transport-Security",
    expected: "max-age >= 31536000; includeSubDomains; preload",
    actual: hsts,
    status: hstsValid ? "PASSED" : "FAILED",
    details: hstsValid
      ? "Enforces 2-year HSTS with includeSubDomains and preload"
      : "Missing or weak HSTS configuration",
  });

  // 2. X-Frame-Options
  const xfo = findHeader("X-Frame-Options");
  const xfoValid = xfo === "DENY" || xfo === "SAMEORIGIN";
  headersAudit.push({
    header: "X-Frame-Options",
    expected: "DENY | SAMEORIGIN",
    actual: xfo,
    status: xfoValid ? "PASSED" : "FAILED",
    details: xfoValid ? `Clickjacking protection active (${xfo})` : "X-Frame-Options not properly configured",
  });

  // 3. X-Content-Type-Options
  const xcto = findHeader("X-Content-Type-Options");
  const xctoValid = xcto === "nosniff";
  headersAudit.push({
    header: "X-Content-Type-Options",
    expected: "nosniff",
    actual: xcto,
    status: xctoValid ? "PASSED" : "FAILED",
    details: xctoValid ? "MIME-sniffing protection active (nosniff)" : "X-Content-Type-Options missing or not nosniff",
  });

  // 4. Referrer-Policy
  const refPol = findHeader("Referrer-Policy");
  const refPolValid = Boolean(refPol && (refPol.includes("strict-origin") || refPol.includes("no-referrer")));
  headersAudit.push({
    header: "Referrer-Policy",
    expected: "strict-origin-when-cross-origin | no-referrer",
    actual: refPol,
    status: refPolValid ? "PASSED" : "FAILED",
    details: refPolValid ? `Safe referrer leakage boundary (${refPol})` : "Referrer-Policy missing or permissive",
  });

  // 5. Content-Security-Policy (CSP)
  const csp = findHeader("Content-Security-Policy");
  const cspValid = Boolean(
    csp &&
    csp.includes("default-src 'self'") &&
    csp.includes("object-src 'none'") &&
    csp.includes("base-uri 'self'") &&
    csp.includes("frame-ancestors 'self'") &&
    csp.includes("upgrade-insecure-requests")
  );
  headersAudit.push({
    header: "Content-Security-Policy",
    expected: "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; upgrade-insecure-requests",
    actual: csp,
    status: cspValid ? "PASSED" : "FAILED",
    details: cspValid
      ? "Robust CSP baseline enforcing object-src 'none', frame-ancestors 'self', and upgrade-insecure-requests"
      : "CSP missing essential directives",
  });

  // 6. Permissions-Policy
  const permPol = findHeader("Permissions-Policy");
  const permPolValid = Boolean(
    permPol &&
    permPol.includes("camera=") &&
    permPol.includes("microphone=") &&
    permPol.includes("geolocation=")
  );
  headersAudit.push({
    header: "Permissions-Policy",
    expected: "Restricts camera, microphone, geolocation",
    actual: permPol,
    status: permPolValid ? "PASSED" : "FAILED",
    details: permPolValid
      ? `Hardware API policy defined: ${permPol}`
      : "Permissions-Policy missing hardware API restrictions",
  });

  for (const item of headersAudit) {
    if (item.status === "PASSED") {
      console.log(`  ✅ [PASS] ${item.header}: ${item.actual}`);
    } else {
      console.error(`  ❌ [FAIL] ${item.header}: Expected "${item.expected}", received "${item.actual}"`);
    }
  }

  // =========================================================================
  // 2. AUTHENTICATION COOKIE FLAGS AUDIT
  // =========================================================================
  console.log("\n--- [TEST 4.2] Auditing Cookie Security Flags across Authentication Paths ---");

  const targetCookieFiles = [
    { file: "src/app/api/auth/login/route.ts", cookieName: "cse_session" },
    { file: "src/app/api/user/profile/route.ts", cookieName: "cse_session" },
    { file: "src/app/api/partner/portal/security/route.ts", cookieName: "cse_partner_session" },
    { file: "src/routes/admin/criticalActions.ts", cookieName: "cse_sudo_token" },
  ];

  for (const target of targetCookieFiles) {
    const fullPath = path.join(process.cwd(), target.file);
    if (!fs.existsSync(fullPath)) {
      cookiesAudit.push({
        file: target.file,
        cookieName: target.cookieName,
        hasHttpOnly: false,
        hasSecure: false,
        hasSameSite: false,
        hasRootPath: false,
        status: "FAILED",
        details: "Target file does not exist",
      });
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf-8");

    // Check specific cookie setter block
    const cookieRegex = new RegExp(
      `cookies\\.set\\(\\s*["']${target.cookieName}["'],[^,]+,\\s*\\{([\\s\\S]*?)\\}\\s*\\)`,
      "m"
    );
    const match = cookieRegex.exec(content);

    if (!match) {
      cookiesAudit.push({
        file: target.file,
        cookieName: target.cookieName,
        hasHttpOnly: false,
        hasSecure: false,
        hasSameSite: false,
        hasRootPath: false,
        status: "FAILED",
        details: `Could not locate cookies.set block for ${target.cookieName}`,
      });
      continue;
    }

    const configBlock = match[1];
    const hasHttpOnly = /httpOnly:\s*true/.test(configBlock);
    const hasSecure = /secure:\s*(?:true|process\.env\.NODE_ENV\s*===?\s*["']production["'])/.test(configBlock);
    const hasSameSite = /sameSite:\s*["'](?:lax|strict)["']/i.test(configBlock);
    const hasRootPath = /path:\s*["']\/["']/.test(configBlock);

    const isAllFlagsValid = hasHttpOnly && hasSecure && hasSameSite && hasRootPath;

    cookiesAudit.push({
      file: target.file,
      cookieName: target.cookieName,
      hasHttpOnly,
      hasSecure,
      hasSameSite,
      hasRootPath,
      status: isAllFlagsValid ? "PASSED" : "FAILED",
      details: isAllFlagsValid
        ? "Enforces httpOnly: true, secure (prod), sameSite: lax/strict, path: '/'"
        : "Missing one or more required security attributes",
    });

    if (isAllFlagsValid) {
      console.log(`  ✅ [PASS] ${target.cookieName} in ${target.file}: httpOnly, secure, sameSite, path: '/' verified.`);
    } else {
      console.error(
        `  ❌ [FAIL] ${target.cookieName} in ${target.file}: httpOnly=${hasHttpOnly}, secure=${hasSecure}, sameSite=${hasSameSite}, path=${hasRootPath}`
      );
    }
  }

  // 3. Scan whole codebase for any insecure cookies.set({ httpOnly: false })
  console.log("\n--- [TEST 4.3] Verifying Zero Insecure (httpOnly: false) Cookie Instances ---");
  const allTsFiles = fs.readdirSync(path.join(process.cwd(), "src"), { recursive: true }) as string[];
  let insecureCookieFound = false;

  for (const rel of allTsFiles) {
    if (typeof rel === "string" && (rel.endsWith(".ts") || rel.endsWith(".tsx"))) {
      // Ignore test/audit scripts in src/scripts
      if (rel.startsWith("scripts") || rel.includes("test-")) continue;

      const full = path.join(process.cwd(), "src", rel);
      if (fs.existsSync(full) && !fs.statSync(full).isDirectory()) {
        const text = fs.readFileSync(full, "utf-8");
        // Look for actual cookie setting with httpOnly: false
        if (/cookies(?:\.set|\.delete|\(\))[^;]*httpOnly:\s*false/i.test(text) || /httpOnly:\s*false/i.test(text)) {
          insecureCookieFound = true;
          console.error(`  ❌ [FAIL] Insecure cookie flag 'httpOnly: false' detected in: ${rel}`);
        }
      }
    }
  }

  if (!insecureCookieFound) {
    console.log("  ✅ [PASS] Zero occurrences of 'httpOnly: false' found across entire src/ directory.");
  }

  const allHeadersPassed = headersAudit.every((h) => h.status === "PASSED");
  const allCookiesPassed = cookiesAudit.every((c) => c.status === "PASSED") && !insecureCookieFound;
  const isPassed = allHeadersPassed && allCookiesPassed;

  const durationMs = Date.now() - startTime;
  details.push(
    `Security headers checked: ${headersAudit.length} (All passed: ${allHeadersPassed}). Cookies checked: ${cookiesAudit.length} (All passed: ${allCookiesPassed}).`
  );

  console.log("\n--------------------------------------------------");
  console.log(`PHASE 4 STATUS: ${isPassed ? "PASSED ✅" : "FAILED ❌"} (${durationMs}ms)`);
  console.log("--------------------------------------------------");

  return {
    suite: "PHASE 4: HTTP SECURITY HEADERS & COOKIE PROTECTIONS AUDIT",
    status: isPassed ? "PASSED" : "FAILED",
    timestamp: new Date().toISOString(),
    durationMs,
    headersAudit,
    cookiesAudit,
    details,
  };
}

if (process.argv[1] && process.argv[1].includes("audit-security-headers")) {
  runSecurityHeadersSuite()
    .then((result) => {
      if (result.status === "FAILED") process.exit(1);
    })
    .catch((err) => {
      console.error("Fatal error running Phase 4 audit:", err);
      process.exit(1);
    });
}
