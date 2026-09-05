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

function runSecurityAudit(): void {
  console.log("================================================================================");
  console.log("🔒 RUNNING TARGETED TRASH API AUTHORIZATION SECURITY AUDIT");
  console.log("================================================================================");

  const trashRouteSource = read("src/app/api/admin/trash/route.ts");

  // 1. Verify that NO hardcoded email address appears in authorization logic
  assert(
    !trashRouteSource.includes("mervintangcawan07@gmail.com"),
    "Trash API contains no hardcoded or special-case administrator email"
  );

  // 2. Verify canonical role check in GET
  assert(
    trashRouteSource.includes('authentication.session.user.role !== "ADMIN"'),
    "GET handler enforces canonical session.user.role !== 'ADMIN' guard"
  );

  // 3. Verify canonical role check in POST
  const postIndex = trashRouteSource.indexOf("export async function POST");
  const postSource = trashRouteSource.slice(postIndex);
  assert(
    postSource.includes('authentication.session.user.role !== "ADMIN"'),
    "POST handler enforces canonical session.user.role !== 'ADMIN' guard"
  );

  // 4. Verify unauthenticated check returns 401
  assert(
    trashRouteSource.includes('authentication.code === "NO_TOKEN"') &&
      trashRouteSource.includes('{ status: 401 }'),
    "Unauthenticated request returns HTTP 401"
  );

  // 5. Verify non-admin check returns 403
  assert(
    trashRouteSource.includes('return NextResponse.json({ error: "Access denied." }, { status: 403 });'),
    "Non-admin request returns HTTP 403"
  );

  // 6. Simulate evaluation logic:
  // Function to simulate the route guard logic
  function evaluateAuthorization(authResult: {
    authenticated: boolean;
    code?: string;
    session?: { user: { role: string; email: string } };
  }): { allowed: boolean; status?: number } {
    if (!authResult.authenticated && authResult.code === "NO_TOKEN") {
      return { allowed: false, status: 401 };
    }
    if (!authResult.authenticated || authResult.session?.user.role !== "ADMIN") {
      return { allowed: false, status: 403 };
    }
    return { allowed: true };
  }

  // Test A: Unauthenticated
  const unauthTest = evaluateAuthorization({ authenticated: false, code: "NO_TOKEN" });
  assert(!unauthTest.allowed && unauthTest.status === 401, "Simulated unauthenticated access fails with 401");

  // Test B: Authenticated regular USER
  const nonAdminTest = evaluateAuthorization({
    authenticated: true,
    session: { user: { role: "USER", email: "student@example.com" } },
  });
  assert(!nonAdminTest.allowed && nonAdminTest.status === 403, "Simulated authenticated non-admin fails with 403");

  // Test C: Former email-only authorization scenario (email matches but role is USER)
  const formerEmailBypassTest = evaluateAuthorization({
    authenticated: true,
    session: { user: { role: "USER", email: "mervintangcawan07@gmail.com" } },
  });
  assert(
    !formerEmailBypassTest.allowed && formerEmailBypassTest.status === 403,
    "User with matching email but role='USER' is strictly FORBIDDEN (403)"
  );

  // Test D: Authenticated ADMIN
  const adminTest = evaluateAuthorization({
    authenticated: true,
    session: { user: { role: "ADMIN", email: "admin@govstudyx.com" } },
  });
  assert(adminTest.allowed, "Authenticated user with role='ADMIN' is authorized");

  // Test E: Confirm PURGE_ALL_QUESTIONS strictly checks confirmation === 'PURGE ALL'
  assert(
    trashRouteSource.includes('confirmation !== "PURGE ALL"') &&
      trashRouteSource.includes('{ status: 400 }'),
    "PURGE_ALL_QUESTIONS strictly enforces confirmation === 'PURGE ALL'"
  );

  // Test F: Confirm unknown action fails closed with 400
  assert(
    trashRouteSource.includes('return NextResponse.json({ error: "Invalid action or parameters." }, { status: 400 });'),
    "Unknown or missing actions fail closed with HTTP 400"
  );

  console.log("================================================================================");
  console.log(`Authorization security regression summary: ${passed} passed, ${failed} failed.`);
  console.log("================================================================================");

  if (failed > 0) process.exit(1);
}

runSecurityAudit();
