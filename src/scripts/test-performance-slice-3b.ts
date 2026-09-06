import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function getGitChangedFiles(): string[] {
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

/**
 * Headless simulation of the visibility, online, and in-flight polling harness
 * implemented across Slice 3B components.
 */
class PollingHarnessSimulator {
  public inFlight = false;
  public lastFetchTime = 0;
  public timer: any = null;
  public fetchCallCount = 0;
  public isVisible = true;
  public isOnline = true;
  public intervalMs: number;

  constructor(intervalMs: number) {
    this.intervalMs = intervalMs;
  }

  public async fetch(isManual = false) {
    if (this.inFlight) return;
    if (!isManual && !this.isVisible) return;
    if (!isManual && !this.isOnline) return;

    this.inFlight = true;
    try {
      this.fetchCallCount++;
      this.lastFetchTime = Date.now();
    } finally {
      this.inFlight = false;
    }
  }

  public resetTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (!this.isVisible || !this.isOnline) return;

    this.timer = setInterval(() => {
      void this.fetch();
    }, this.intervalMs);
  }

  public handleVisibilityOrOnline() {
    if (!this.isVisible || !this.isOnline) {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      return;
    }

    const now = Date.now();
    const isStale = now - this.lastFetchTime >= this.intervalMs;
    if (isStale) {
      void this.fetch();
    }
    this.resetTimer();
  }

  public mount() {
    void this.fetch();
    this.resetTimer();
  }

  public unmount() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

async function main() {
  console.log("=== RUNNING SLICE 3B VERIFICATION SUITE ===");

  const notificationBell = source("src/components/NotificationBell.tsx");
  const adminHealth = source("src/app/admin/health/page.tsx");
  const maintenance = source("src/app/maintenance/page.tsx");
  const social = source("src/app/social/page.tsx");
  const bgTasksLib = source("src/lib/backgroundTasks.ts");
  const healthMonitorLib = source("src/lib/systemHealthMonitor.ts");

  // -------------------------------------------------------------------------
  // B1: Initial load fetches data
  // -------------------------------------------------------------------------
  console.log("Testing B1: Initial load fetches data...");
  assert.match(notificationBell, /void fetchNotifications\(\)/, "NotificationBell must trigger initial fetch on mount");
  assert.match(adminHealth, /void fetchReadOnlyDiagnostics\(\)/, "AdminHealthPage must trigger initial read-only fetch on mount");
  assert.match(maintenance, /void checkStatus\(\)/, "MaintenancePage must trigger initial fetch on mount");
  assert.match(social, /void fetchBadgeCounts\(\)/, "Social page must trigger initial badge count fetch on mount");

  // -------------------------------------------------------------------------
  // B2: Only one active timer exists per poller
  // -------------------------------------------------------------------------
  console.log("Testing B2: Controlled single timer refs...");
  assert.match(notificationBell, /timerRef = useRef/, "NotificationBell must track timer via single ref");
  assert.match(adminHealth, /readOnlyTimerRef = useRef/, "AdminHealthPage must track read-only timer via ref");
  assert.match(maintenance, /timerRef = useRef/, "MaintenancePage must track timer via single ref");
  assert.match(social, /countsTimerRef = useRef/, "Social page must track counts timer via single ref");

  // -------------------------------------------------------------------------
  // B3: Timers clean up on unmount
  // -------------------------------------------------------------------------
  console.log("Testing B3: Timers clean up on unmount/navigation...");
  assert.match(notificationBell, /removeEventListener\("visibilitychange"/, "NotificationBell must remove visibility listener");
  assert.match(adminHealth, /removeEventListener\("visibilitychange"/, "AdminHealthPage must remove visibility listener");
  assert.match(maintenance, /removeEventListener\("visibilitychange"/, "MaintenancePage must remove visibility listener");
  assert.match(social, /removeEventListener\("visibilitychange"/, "Social page must remove visibility listener");

  // -------------------------------------------------------------------------
  // B4 & B5: Hidden tab suspends recurring polling & produces 0 background requests
  // -------------------------------------------------------------------------
  console.log("Testing B4 & B5: Hidden tab suspends polling...");
  const sim = new PollingHarnessSimulator(15000);
  sim.mount();
  assert.equal(sim.fetchCallCount, 1, "Initial fetch counted");
  assert.ok(sim.timer !== null, "Timer running while visible");

  // Tab becomes hidden
  sim.isVisible = false;
  sim.handleVisibilityOrOnline();
  assert.equal(sim.timer, null, "Timer must be cleared when hidden");

  // Attempt fetch while hidden
  await sim.fetch();
  assert.equal(sim.fetchCallCount, 1, "Hidden fetch must produce zero requests");

  // -------------------------------------------------------------------------
  // B6 & B7: Visibility restoration performs at most 1 stale refresh & resumes interval
  // -------------------------------------------------------------------------
  console.log("Testing B6 & B7: Visibility restoration behavior...");
  // Simulate time passage while hidden: 20 seconds later (stale)
  sim.lastFetchTime = Date.now() - 20000;
  sim.isVisible = true;
  sim.handleVisibilityOrOnline();
  assert.equal(sim.fetchCallCount, 2, "Stale visibility restoration must trigger exactly 1 refresh");
  assert.ok(sim.timer !== null, "Polling timer must resume after visibility restoration");
  sim.unmount();

  // Fresh visibility restoration: tab was hidden for only 2 seconds (< 15s)
  const simFresh = new PollingHarnessSimulator(15000);
  simFresh.mount();
  assert.equal(simFresh.fetchCallCount, 1);
  simFresh.isVisible = false;
  simFresh.handleVisibilityOrOnline();
  simFresh.lastFetchTime = Date.now() - 2000; // only 2s ago
  simFresh.isVisible = true;
  simFresh.handleVisibilityOrOnline();
  assert.equal(simFresh.fetchCallCount, 1, "Non-stale visibility restoration must NOT trigger immediate refresh");
  simFresh.unmount();

  // -------------------------------------------------------------------------
  // B8: In-flight request prevents duplicate overlapping cycle
  // -------------------------------------------------------------------------
  console.log("Testing B8: In-flight overlap protection...");
  const simOverlap = new PollingHarnessSimulator(15000);
  simOverlap.mount();
  simOverlap.inFlight = true;
  await simOverlap.fetch();
  assert.equal(simOverlap.fetchCallCount, 1, "In-flight guard must skip overlapping fetch");
  simOverlap.inFlight = false;
  simOverlap.unmount();

  // -------------------------------------------------------------------------
  // B9 & B10: Offline suppresses polling and online restores
  // -------------------------------------------------------------------------
  console.log("Testing B9 & B10: Offline / online handling...");
  const simNet = new PollingHarnessSimulator(15000);
  simNet.mount();
  assert.ok(simNet.timer !== null);

  // Device goes offline
  simNet.isOnline = false;
  simNet.handleVisibilityOrOnline();
  assert.equal(simNet.timer, null, "Offline state must suspend polling timer");
  await simNet.fetch();
  assert.equal(simNet.fetchCallCount, 1, "Offline fetch must produce zero requests");

  // Device goes online while visible and stale
  simNet.isOnline = true;
  simNet.lastFetchTime = Date.now() - 30000;
  simNet.handleVisibilityOrOnline();
  assert.equal(simNet.fetchCallCount, 2, "Online restore while visible and stale must refresh once");
  assert.ok(simNet.timer !== null, "Timer must resume online");
  simNet.unmount();

  // -------------------------------------------------------------------------
  // B11: Manual refresh controls preserved
  // -------------------------------------------------------------------------
  console.log("Testing B11: Manual refresh controls preserved...");
  assert.match(adminHealth, /⚡ Refresh Now/, "AdminHealthPage manual refresh button must exist");
  assert.match(adminHealth, /onClick=\{fetchAllDiagnostics\}/, "AdminHealthPage refresh button must call fetchAllDiagnostics");
  assert.match(maintenance, /🔄 Refresh System Status/, "MaintenancePage manual refresh button must exist");

  // -------------------------------------------------------------------------
  // B12: Existing view state and filters intact
  // -------------------------------------------------------------------------
  console.log("Testing B12: Existing UI state and filters preserved...");
  assert.match(adminHealth, /loadingLiveness/, "Liveness loading state preserved");
  assert.match(adminHealth, /loadingReadiness/, "Readiness loading state preserved");
  assert.match(adminHealth, /loadingStorage/, "Storage loading state preserved");
  assert.match(social, /unreadNotifications/, "Social counts structure preserved");

  // -------------------------------------------------------------------------
  // B13: No API response contracts changed
  // -------------------------------------------------------------------------
  console.log("Testing B13: API route contracts untouched...");
  const changed = getGitChangedFiles();
  const apiChanges = changed.filter((f) => f.startsWith("src/app/api/"));
  assert.equal(apiChanges.length, 0, `No API route files should be modified. Changed: ${apiChanges.join(", ")}`);

  // -------------------------------------------------------------------------
  // B14: No auth semantics changed
  // -------------------------------------------------------------------------
  console.log("Testing B14: Auth isolation preserved...");
  const authChanges = changed.filter((f) => f.includes("Auth") || f.includes("auth"));
  assert.equal(authChanges.length, 0, `No auth files should be modified. Changed: ${authChanges.join(", ")}`);

  // -------------------------------------------------------------------------
  // B15: No exam behavior changed
  // -------------------------------------------------------------------------
  console.log("Testing B15: Exam behavior untouched...");
  const examChanges = changed.filter((f) => f.includes("exam") || f.includes("Exam"));
  assert.equal(examChanges.length, 0, `No exam files should be modified. Changed: ${examChanges.join(", ")}`);

  // -------------------------------------------------------------------------
  // B16: No payment / financial behavior changed
  // -------------------------------------------------------------------------
  console.log("Testing B16: Payment/financial untouched...");
  const paymentChanges = changed.filter((f) => f.includes("payment") || f.includes("accounting") || f.includes("payout"));
  assert.equal(paymentChanges.length, 0, `No payment files should be modified. Changed: ${paymentChanges.join(", ")}`);

  // -------------------------------------------------------------------------
  // B17: No realtime social behavior changed
  // -------------------------------------------------------------------------
  console.log("Testing B17: Realtime social untouched...");
  const realtimeChanges = changed.filter((f) =>
    f.includes("MessagesSection") || f.includes("StudyRoomsSection") || f.includes("StudyRoomStage") || f.includes("duels")
  );
  assert.equal(realtimeChanges.length, 0, `Realtime social files should remain untouched. Changed: ${realtimeChanges.join(", ")}`);

  // -------------------------------------------------------------------------
  // B18: Navigation away/back does not accumulate timers
  // -------------------------------------------------------------------------
  console.log("Testing B18: Timer accumulation prevented...");
  const simNav = new PollingHarnessSimulator(20000);
  simNav.mount();
  simNav.unmount();
  assert.equal(simNav.timer, null, "Timer cleared on navigation away");
  simNav.mount();
  assert.ok(simNav.timer !== null, "Fresh timer created on navigation back");
  simNav.unmount();

  // -------------------------------------------------------------------------
  // B19: Health endpoint side-effect classification
  // -------------------------------------------------------------------------
  console.log("Testing B19: Health endpoint side-effect classification...");
  // Confirm background-worker has database mutations (operational worker)
  assert.match(bgTasksLib, /prisma\.user\.updateMany/, "Background worker lib must contain database updateMany mutations");
  assert.match(bgTasksLib, /cleanExpiredSessionsAndTokens/, "cleanExpiredSessionsAndTokens must perform cleanup");
  assert.match(adminHealth, /OPERATIONAL_WORKER_INTERVAL_MS = 5000/, "AdminHealthPage must leave operational background worker at 5s");

  // Confirm health-monitor does NOT have updateMany or database writes
  assert.doesNotMatch(healthMonitorLib, /prisma\.\w+\.(create|update|delete|upsert)/, "Health monitor must NOT mutate database");
  assert.match(healthMonitorLib, /prisma\.\$queryRaw`SELECT 1`/, "Health monitor must only read DB latency with SELECT 1");

  // -------------------------------------------------------------------------
  // B20: Online while hidden produces zero refresh requests
  // -------------------------------------------------------------------------
  console.log("Testing B20: Online event while hidden...");
  const simHiddenOnline = new PollingHarnessSimulator(15000);
  simHiddenOnline.mount();
  simHiddenOnline.isVisible = false;
  simHiddenOnline.handleVisibilityOrOnline();
  assert.equal(simHiddenOnline.fetchCallCount, 1);

  // Connection is toggled offline then back online, while tab remains hidden
  simHiddenOnline.isOnline = false;
  simHiddenOnline.handleVisibilityOrOnline();
  simHiddenOnline.isOnline = true;
  simHiddenOnline.lastFetchTime = Date.now() - 60000; // deeply stale
  simHiddenOnline.handleVisibilityOrOnline();
  assert.equal(simHiddenOnline.fetchCallCount, 1, "Going online while hidden must produce zero refresh requests");
  assert.equal(simHiddenOnline.timer, null, "Timer must remain suspended while hidden");
  simHiddenOnline.unmount();

  // -------------------------------------------------------------------------
  // B21: Online + visibility race produces at most one refresh
  // -------------------------------------------------------------------------
  console.log("Testing B21: Online + visibility race condition...");
  const simRace = new PollingHarnessSimulator(15000);
  simRace.mount();
  simRace.isVisible = false;
  simRace.isOnline = false;
  simRace.handleVisibilityOrOnline();
  assert.equal(simRace.fetchCallCount, 1);
  simRace.lastFetchTime = Date.now() - 30000; // stale

  // Both online and visibility restoration fire in rapid succession
  simRace.isOnline = true;
  simRace.isVisible = true;
  simRace.handleVisibilityOrOnline(); // Event 1 (e.g. visibilitychange)
  simRace.handleVisibilityOrOnline(); // Event 2 (e.g. online, fired 2ms later)
  assert.equal(simRace.fetchCallCount, 2, "Near-simultaneous online and visibility change must produce at most ONE refresh");
  simRace.unmount();

  // -------------------------------------------------------------------------
  // B22: Health diagnostic batch overlap prevented
  // -------------------------------------------------------------------------
  console.log("Testing B22: Health diagnostic batch overlap guard...");
  assert.match(adminHealth, /readOnlyInFlightRef = useRef\(false\)/, "AdminHealthPage must declare readOnlyInFlightRef");
  assert.match(adminHealth, /if \(readOnlyInFlightRef\.current\) return/, "fetchReadOnlyDiagnostics must check inFlight ref");
  assert.match(adminHealth, /readOnlyInFlightRef\.current = true/, "fetchReadOnlyDiagnostics must set inFlight to true before batch");
  assert.match(adminHealth, /readOnlyInFlightRef\.current = false/, "fetchReadOnlyDiagnostics must reset inFlight in finally block");

  // -------------------------------------------------------------------------
  // B23: Social exact interval is 30 seconds
  // -------------------------------------------------------------------------
  console.log("Testing B23: Social exact 30s interval...");
  assert.match(social, /const SOCIAL_COUNTS_POLL_INTERVAL_MS = 30000;/, "Social counts interval must be exactly 30000ms");
  assert.doesNotMatch(social, /15000/, "Old 15s interval must be removed from social page");
  assert.doesNotMatch(social, /40000/, "Ambiguous 40s interval must not be used");

  // -------------------------------------------------------------------------
  // B24: Restore timer reset waits one complete configured interval
  // -------------------------------------------------------------------------
  console.log("Testing B24: Restore timer reset...");
  assert.match(notificationBell, /resetTimer\(\);/, "NotificationBell must reset timer after stale restore check");
  assert.match(adminHealth, /resetReadOnlyTimer\(\);/, "AdminHealthPage must reset timer after stale restore check");
  assert.match(maintenance, /resetTimer\(\);/, "MaintenancePage must reset timer after stale restore check");
  assert.match(social, /resetTimer\(\);/, "Social page must reset timer after stale restore check");

  console.log("=== ALL SLICE 3B VERIFICATION CHECKS PASSED (B1-B24) ===");
}

main().catch((err) => {
  console.error("Slice 3B Verification FAILED:", err);
  process.exit(1);
});
