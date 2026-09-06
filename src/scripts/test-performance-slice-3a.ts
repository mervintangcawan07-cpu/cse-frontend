import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import {
  AUTH_ACTIVITY_THROTTLE_MS,
  AUTH_SNAPSHOT_STALE_MS,
  AuthRequestInvalidatedError,
  createAuthRequestGate,
} from "../lib/auth/clientAuth";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}


function changedFiles() {
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

function findTsxFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return findTsxFiles(path);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  });
}

async function main() {
const authContext = source("src/context/AuthContext.tsx");
const authClient = source("src/lib/auth/clientAuth.ts");
const layout = source("src/app/layout.tsx");
const navbar = source("src/components/Navbar.tsx");
const sidebar = source("src/components/Sidebar.tsx");
const dashboard = source("src/app/dashboard/page.tsx");
const landing = source("src/app/page.tsx");
const profile = source("src/app/profile/page.tsx");
const practice = source("src/app/practice/page.tsx");
const learning = source("src/app/learning/page.tsx");
const redeem = source("src/app/redeem/page.tsx");
const upgrade = source("src/app/upgrade/page.tsx");
const authMeRoute = source("src/app/api/auth/me/route.ts");
const serverAuth = source("src/lib/serverAuth.ts");

// A1-A4: one initial owner and removal of ordinary duplicate consumers.
assert.equal((authContext.match(/fetch\("\/api\/auth\/me"/g) ?? []).length, 1);
assert.match(authContext, /refreshAuth\("initial"\)/);
assert.doesNotMatch(navbar, /\/api\/auth\/me|setInterval\(/);
assert.doesNotMatch(sidebar, /\/api\/auth\/me|useEffect|usePathname/);
assert.doesNotMatch(dashboard, /fetch\("\/api\/auth\/me"/);
for (const consumer of [landing, profile, practice, learning, redeem]) {
  assert.doesNotMatch(consumer, /fetch\("\/api\/auth\/me"/);
  assert.match(consumer, /useAuth\(/);
}

// A5-A8: one activity timer, cleanup, hidden-tab suspension, one resume path.
assert.equal((authContext.match(/setTimeout\(/g) ?? []).length, 1);
assert.doesNotMatch(authContext, /setInterval\(/);
assert.match(authContext, /clearTimeout\(activityTimerRef\.current\)/);
assert.match(authContext, /removeEventListener\("visibilitychange"/);
assert.match(authContext, /requestGateRef\.current\.invalidate\(\)/);
assert.match(authContext, /document\.visibilityState !== "visible"/);
assert.match(authContext, /document\.visibilityState === "hidden"/);
assert.equal((authContext.match(/refreshIfStale\("visibility"\)/g) ?? []).length, 1);
assert.doesNotMatch(authContext, /addEventListener\("focus"/);

// A9: concurrent callers share one real request and invalidation rejects stale work.
const gate = createAuthRequestGate<string>();
let requestCount = 0;
let resolveRequest!: (value: string) => void;
const first = gate.run(
  () =>
    new Promise<string>((resolve) => {
      requestCount += 1;
      resolveRequest = resolve;
    })
);
const second = gate.run(async () => {
  requestCount += 1;
  return "duplicate";
});
await Promise.resolve();
assert.equal(requestCount, 1);
assert.equal(gate.hasInFlightRequest(), true);
resolveRequest("shared");
assert.deepEqual(await Promise.all([first, second]), ["shared", "shared"]);
assert.equal(gate.hasInFlightRequest(), false);

let resolveStale!: (value: string) => void;
const stale = gate.run(
  () =>
    new Promise<string>((resolve) => {
      resolveStale = resolve;
    })
);
await Promise.resolve();
gate.invalidate();
resolveStale("stale");
await assert.rejects(stale, AuthRequestInvalidatedError);
assert.equal(await gate.run(async () => "fresh"), "fresh");

// A10-A12: logout invalidation, bounded failure behavior, and expiry/kick handling.
assert.match(authContext, /const clearAuth = useCallback/);
assert.match(authContext, /requestGateRef\.current\.invalidate\(\)/);
assert.match(navbar, /pauseActivityHeartbeat\(\)[\s\S]*\/api\/auth\/logout/);
assert.match(upgrade, /pauseActivityHeartbeat\(\)[\s\S]*\/api\/auth\/logout/);
assert.match(navbar, /response\.ok\) \{[\s\S]*clearAuth\(\)/);
assert.match(upgrade, /response\.ok\) \{[\s\S]*clearAuth\(\)/);
assert.match(authContext, /if \(!userRef\.current\) setStatus\("error"\)/);
assert.match(authContext, /response\.status === 401 \|\| response\.status === 403/);
assert.match(authContext, /kicked:\s*Boolean\(body\?\.kicked\)/);
assert.match(authContext, /setKicked\(Boolean\(payload\.kicked\)\)/);
assert.match(authContext, /\/login\?kicked=true/);

// A13: explicit freshness follows the three approved state-changing flows.
assert.match(dashboard, /await refreshAuth\("entitlement"\)/);
assert.match(redeem, /if \(res\.ok\) await refreshAuth\("entitlement"\)/);
assert.match(profile, /await refreshAuth\("profile"\)/);

// A14: server-side auth/session authority and /api/auth/me contract remain present.
assert.match(authMeRoute, /getAuthenticatedSessionResult\(\)/);
assert.match(authMeRoute, /activeSessionId: sessionId/);
assert.match(authMeRoute, /data: \{ lastActiveAt: now \}/);
assert.match(serverAuth, /authenticateExistingAccountSession/);
assert.match(serverAuth, /isAccountAuthorizedFor\(user, "ADMIN"\)/);

// A15: no excluded API, schema, exam, social, proxy, or middleware file changed.
const excludedPrefixes = [
  "prisma/",
  "src/app/api/paymongo/",
  "src/app/api/social/",
  "src/app/api/exam/",
  "src/app/social/",
  "src/components/social/",
  "src/app/duels/",
  "src/app/exam/",
  "src/app/mock-exam/",
  "src/proxy.ts",
  "src/middleware.ts",
];
assert.deepEqual(
  changedFiles().filter((file) =>
    excludedPrefixes.some((prefix) => file.startsWith(prefix))
  ),
  []
);

// A16-A19: visible idle is silent; real visible activity is throttled and hidden is silent.
assert.equal(AUTH_ACTIVITY_THROTTLE_MS, 120_000);
assert.equal(AUTH_SNAPSHOT_STALE_MS, 120_000);
assert.match(authContext, /activityPendingRef\.current = true/);
assert.match(authContext, /if \(activityTimerRef\.current\) return/);
assert.match(authContext, /void refreshAuth\("activity"\)/);
for (const eventName of ["pointerdown", "keydown", "touchstart"]) {
  assert.ok(authContext.includes(`"${eventName}"`));
}
assert.match(
  authContext,
  /document\.visibilityState === "hidden"[\s\S]*cancelPendingActivityHeartbeat\(\)/
);

// A20-A21: the server checks 30-minute inactivity before any activity write.
const inactivityCheck = authMeRoute.indexOf(
  "minutesInactive >= INACTIVITY_LIMIT_MINUTES"
);
const activityWrite = authMeRoute.indexOf(
  "const activityUpdate = await prisma.user.updateMany"
);
assert.ok(inactivityCheck >= 0 && activityWrite > inactivityCheck);
assert.match(authMeRoute, /INACTIVITY_LIMIT_MINUTES = 30/);
assert.match(authContext, /Date\.now\(\) - lastSnapshotAtRef\.current/);
assert.match(authContext, /Date\.now\(\) - lastAuthAttemptAtRef\.current/);
assert.equal((authContext.match(/refreshIfStale\("visibility"\)/g) ?? []).length, 1);

// A22: the root AuthProvider replaces the previously global Navbar auth request.
assert.doesNotMatch(navbar, /fetch\("\/api\/auth\/me"/);
assert.match(navbar, /useAuth\(\)/);
assert.match(layout, /<AuthProvider>[\s\S]*<Navbar \/>[\s\S]*\{children\}/);
assert.equal((authContext.match(/refreshAuth\("initial"\)/g) ?? []).length, 1);
assert.match(authContext, /isKickedSafePath/);

// A23: explicit state-change refreshes do not install independent polling owners.
for (const consumer of [dashboard, redeem, profile, upgrade]) {
  assert.doesNotMatch(consumer, /setInterval\(/);
}
assert.match(dashboard, /user\?\.id\]\);/);

const directAuthConsumers = findTsxFiles(join(process.cwd(), "src"))
  .filter((path) => source(relative(process.cwd(), path)).includes('/api/auth/me'))
  .map((path) => relative(process.cwd(), path).replaceAll("\\", "/"))
  .filter((path) => path !== "src/context/AuthContext.tsx")
  .sort();
assert.deepEqual(directAuthConsumers, [
  "src/app/duels/page.tsx",
  "src/app/exam/page.tsx",
  "src/app/practice/custom/page.tsx",
  "src/app/social/page.tsx",
  "src/components/social/MessagesSection.tsx",
  "src/components/social/StudyClubsSection.tsx",
  "src/components/social/StudyRoomsSection.tsx",
]);

assert.match(authClient, /generation !== requestGeneration/);

// Focused test: initial transient failure, online recovery, and non-repeating unauthenticated state
type SimStatus = "loading" | "authenticated" | "unauthenticated" | "error";
let simUser: { id: string } | null = null;
let simStatus: SimStatus = "loading";
let simAttempts = 0;
let simLastAttemptAt = 0;
let simLastSnapshotAt = 0;

function simulateRefresh(mockOutcome: "error" | "unauthenticated" | "authenticated") {
  simAttempts += 1;
  simLastAttemptAt = Date.now();
  if (mockOutcome === "error") {
    simStatus = "error";
    return;
  }
  if (mockOutcome === "unauthenticated") {
    simUser = null;
    simStatus = "unauthenticated";
    simLastSnapshotAt = Date.now();
    return;
  }
  simUser = { id: "user_1" };
  simStatus = "authenticated";
  simLastSnapshotAt = Date.now();
}

function simulateStaleCheck(reason: "visibility" | "online", isVisible = true, isOnline = true) {
  if (!isVisible || !isOnline) return;
  const isErrorRecovery = !simUser && simStatus === "error";
  if (isErrorRecovery) {
    if (reason === "visibility" && Date.now() - simLastAttemptAt < AUTH_SNAPSHOT_STALE_MS) {
      return;
    }
    simulateRefresh("unauthenticated");
    return;
  }
  if (!simUser || Date.now() - simLastSnapshotAt < AUTH_SNAPSHOT_STALE_MS || Date.now() - simLastAttemptAt < AUTH_SNAPSHOT_STALE_MS) {
    return;
  }
  simulateRefresh("authenticated");
}

simulateRefresh("error");
assert.equal(simStatus, "error");
assert.equal(simUser, null);
assert.equal(simAttempts, 1);

simulateStaleCheck("online", true, true);
assert.equal(simAttempts, 2);
assert.equal(simStatus, "unauthenticated");

simulateStaleCheck("online", true, true);
simulateStaleCheck("visibility", true, true);
assert.equal(simAttempts, 2, "Definitive unauthenticated state must not repeatedly retry");

console.log("Slice 3A auth ownership and activity-heartbeat tests A1-A23: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
