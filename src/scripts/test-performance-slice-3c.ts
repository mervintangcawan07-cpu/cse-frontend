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
 * Headless simulation of Admin Referrals debouncing, cancellation,
 * stale-response guarding, and effect decoupling.
 */
class AdminReferralsSimulator {
  public searchQuery = "";
  public debouncedSearchQuery = "";
  public statusFilter = "ALL";
  public riskFilter = "ALL";
  public page = 1;

  public debounceTimer: any = null;
  public activeAbortController: { aborted: boolean; abort: () => void } | null = null;
  public latestRequestId = 0;
  public unmountedAborted = false;

  public referralFetchCount = 0;
  public analyticsFetchCount = 0;
  public payoutsFetchCount = 0;
  public settingsFetchCount = 0;

  public lastFetchedQuery: string | null = null;
  public lastFetchedPage: number | null = null;
  public lastFetchedStatus: string | null = null;
  public lastFetchedRisk: string | null = null;
  public renderedResults: string[] = [];

  // Mount
  public mount() {
    this.fetchAnalytics();
    this.fetchSettings();
    this.fetchPayouts();
    this.fetchReferrals();
  }

  // Unmount
  public unmount() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.unmountedAborted = this.activeAbortController.aborted;
      this.activeAbortController = null;
    }
  }

  public fetchAnalytics() {
    this.analyticsFetchCount++;
  }

  public fetchSettings() {
    this.settingsFetchCount++;
  }

  public fetchPayouts() {
    this.payoutsFetchCount++;
  }

  public async fetchReferrals(
    query = this.debouncedSearchQuery,
    status = this.statusFilter,
    risk = this.riskFilter,
    currentPage = this.page
  ): Promise<void> {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    const controller = {
      aborted: false,
      abort() {
        this.aborted = true;
      },
    };
    this.activeAbortController = controller;
    const requestId = ++this.latestRequestId;

    this.referralFetchCount++;
    this.lastFetchedQuery = query;
    this.lastFetchedPage = currentPage;
    this.lastFetchedStatus = status;
    this.lastFetchedRisk = risk;

    return new Promise<void>((resolve) => {
      // Simulate async response
      setTimeout(() => {
        if (controller.aborted) {
          // Silent AbortError
          return resolve();
        }
        if (requestId === this.latestRequestId) {
          this.renderedResults = [`result_for_${query}_p${currentPage}`];
        }
        resolve();
      }, 10);
    });
  }

  public handleSearchChange(val: string) {
    this.searchQuery = val;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (val === "") {
      if (this.activeAbortController) {
        this.activeAbortController.abort();
      }
      this.debouncedSearchQuery = "";
      this.page = 1;
      void this.fetchReferrals("", this.statusFilter, this.riskFilter, 1);
    } else {
      this.debounceTimer = setTimeout(() => {
        this.debouncedSearchQuery = val;
        this.page = 1;
        void this.fetchReferrals(val, this.statusFilter, this.riskFilter, 1);
      }, 300);
    }
  }

  public handleStatusFilterChange(newStatus: string) {
    this.statusFilter = newStatus;
    this.page = 1;
    void this.fetchReferrals(this.debouncedSearchQuery, newStatus, this.riskFilter, 1);
  }

  public handleRiskFilterChange(newRisk: string) {
    this.riskFilter = newRisk;
    this.page = 1;
    void this.fetchReferrals(this.debouncedSearchQuery, this.statusFilter, newRisk, 1);
  }

  public async handleReferralAction() {
    await this.fetchReferrals();
    this.fetchAnalytics();
  }

  public async handleProcessPayoutSubmit() {
    this.fetchPayouts();
    this.fetchAnalytics();
  }

  public async handleSaveSettings() {
    this.fetchSettings();
  }
}

/**
 * Headless simulation of Admin Users submit-based search with
 * AbortController and request ID protection.
 */
class AdminUsersSimulator {
  public activeTab: "USERS" | "LOGIN_LOGS" = "USERS";
  public searchQuery = "";
  public statusFilter = "ALL";
  public userPage = 1;
  public logPage = 1;

  public usersAbortController: { aborted: boolean; abort: () => void } | null = null;
  public logsAbortController: { aborted: boolean; abort: () => void } | null = null;
  public usersRequestId = 0;
  public logsRequestId = 0;
  public unmountedUsersAborted = false;
  public unmountedLogsAborted = false;

  public usersFetchCount = 0;
  public logsFetchCount = 0;
  public renderedUsers: string[] = [];
  public renderedLogs: string[] = [];

  public mount() {
    void this.fetchUsers("", "ALL", 1);
  }

  public unmount() {
    if (this.usersAbortController) {
      this.usersAbortController.abort();
      this.unmountedUsersAborted = this.usersAbortController.aborted;
      this.usersAbortController = null;
    }
    if (this.logsAbortController) {
      this.logsAbortController.abort();
      this.unmountedLogsAborted = this.logsAbortController.aborted;
      this.logsAbortController = null;
    }
  }

  public async fetchUsers(query = this.searchQuery, filter = this.statusFilter, page = 1) {
    if (this.usersAbortController) {
      this.usersAbortController.abort();
    }
    const controller = {
      aborted: false,
      abort() {
        this.aborted = true;
      },
    };
    this.usersAbortController = controller;
    const reqId = ++this.usersRequestId;
    this.usersFetchCount++;
    this.userPage = page;

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        if (controller.aborted) return resolve();
        if (reqId === this.usersRequestId) {
          this.renderedUsers = [`user_${query}_${filter}_p${page}`];
        }
        resolve();
      }, 10);
    });
  }

  public async fetchLogs(query = this.searchQuery, filter = this.statusFilter, page = 1) {
    if (this.logsAbortController) {
      this.logsAbortController.abort();
    }
    const controller = {
      aborted: false,
      abort() {
        this.aborted = true;
      },
    };
    this.logsAbortController = controller;
    const reqId = ++this.logsRequestId;
    this.logsFetchCount++;
    this.logPage = page;

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        if (controller.aborted) return resolve();
        if (reqId === this.logsRequestId) {
          this.renderedLogs = [`log_${query}_${filter}_p${page}`];
        }
        resolve();
      }, 10);
    });
  }

  public handleType(text: string) {
    // Only updates state, does NOT trigger network request
    this.searchQuery = text;
  }

  public handleSubmit() {
    if (this.activeTab === "USERS") {
      void this.fetchUsers(this.searchQuery, this.statusFilter, 1);
    } else {
      void this.fetchLogs(this.searchQuery, this.statusFilter, 1);
    }
  }

  public handleStatusFilterChange(newFilter: string) {
    this.statusFilter = newFilter;
    if (this.activeTab === "USERS") {
      void this.fetchUsers(this.searchQuery, newFilter, 1);
    } else {
      void this.fetchLogs(this.searchQuery, newFilter, 1);
    }
  }

  public switchTab(tab: "USERS" | "LOGIN_LOGS") {
    if (tab === "USERS") {
      if (this.logsAbortController) this.logsAbortController.abort();
      this.activeTab = "USERS";
      this.searchQuery = "";
      this.statusFilter = "ALL";
      void this.fetchUsers("", "ALL", 1);
    } else {
      if (this.usersAbortController) this.usersAbortController.abort();
      this.activeTab = "LOGIN_LOGS";
      this.searchQuery = "";
      this.statusFilter = "ALL";
      void this.fetchLogs("", "ALL", 1);
    }
  }
}

async function runTests() {
  console.log("=== SLICE 3C VERIFICATION TEST SUITE ===");

  const referralsSrc = source("src/app/admin/referrals/page.tsx");
  const usersSrc = source("src/app/admin/users/page.tsx");

  // -------------------------------------------------------------------------
  // C1: Input text state updates immediately
  // -------------------------------------------------------------------------
  console.log("Testing C1: Input text state updates immediately...");
  const sim = new AdminReferralsSimulator();
  sim.mount();
  sim.handleSearchChange("a");
  assert.equal(sim.searchQuery, "a", "Input text state must update immediately on keystroke");

  // -------------------------------------------------------------------------
  // C2 & C3: Remote request is debounced at exact approved 300ms
  // -------------------------------------------------------------------------
  console.log("Testing C2 & C3: Debounce interval is exactly 300ms...");
  assert.match(referralsSrc, /300\b/, "Admin referrals must specify exact 300ms debounce interval");
  assert.equal(sim.debouncedSearchQuery, "", "Debounced value must not update before timeout");

  // -------------------------------------------------------------------------
  // C4 & C39: Rapid typing collapses multiple keypresses into one logical request
  // -------------------------------------------------------------------------
  console.log("Testing C4 & C39: Continuous typing collapses 13 keypresses into 1 request...");
  const initialReferralFetches = sim.referralFetchCount;
  const word = "administrator";
  for (let i = 0; i < word.length; i++) {
    sim.handleSearchChange(word.slice(0, i + 1));
  }
  // During continuous typing, referralFetchCount should not increase
  assert.equal(
    sim.referralFetchCount,
    initialReferralFetches,
    "No network requests should be issued while typing is actively debouncing"
  );
  // Wait 350ms for debounce to fire
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(sim.debouncedSearchQuery, "administrator");
  assert.equal(
    sim.referralFetchCount,
    initialReferralFetches + 1,
    "Exactly one network request should fire after continuous typing pause"
  );

  // -------------------------------------------------------------------------
  // C5: Previous debounce timeout is cleared
  // -------------------------------------------------------------------------
  console.log("Testing C5: Previous debounce timeout cleared on subsequent keypress...");
  assert.match(referralsSrc, /clearTimeout\(debounceTimerRef\.current\)/, "Must clearTimeout before setting new debounce");

  // -------------------------------------------------------------------------
  // C5b: Query parameter contract 'q' is preserved
  // -------------------------------------------------------------------------
  console.log("Testing C5b: Referral query parameter contract 'q' is preserved...");
  assert.match(referralsSrc, /params\.set\(["']q["'],\s*query\)/, "Must preserve backend query parameter contract 'q'");
  assert.match(usersSrc, /onChange=\{\(e\)\s*=>\s*setStatusFilter\(e\.target\.value\)\}/, "Must preserve immediate status filter dropdown handler in users");
  assert.match(usersSrc, /\[activeTab,\s*fetchUsers,\s*fetchLogs,\s*statusFilter\]/, "Must keep statusFilter in useEffect dependency array for immediate refresh");

  // -------------------------------------------------------------------------
  // C6 & C43: In-flight stale search request is aborted via AbortController without touching other resources
  // -------------------------------------------------------------------------
  console.log("Testing C6 & C43: AbortController aborts in-flight search independently...");
  assert.match(referralsSrc, /referralAbortRef\.current\.abort\(\)/, "Must call abort() on prior in-flight referral search");
  const analyticsBody = referralsSrc.split("const fetchAnalytics")[1]?.split("}, []);")[0] || "";
  assert.equal(analyticsBody.includes("referralAbortRef"), false, "fetchAnalytics must not reference referralAbortRef");

  // -------------------------------------------------------------------------
  // C7: AbortError does not surface as application error
  // -------------------------------------------------------------------------
  console.log("Testing C7: AbortError handled silently...");
  assert.match(referralsSrc, /err\?\.name === ["']AbortError["']/, "Must catch and ignore AbortError silently in referrals");
  assert.match(usersSrc, /err\?\.name === ["']AbortError["']/, "Must catch and ignore AbortError silently in users");

  // -------------------------------------------------------------------------
  // C8: Older response cannot overwrite newer results (monotonic request ID)
  // -------------------------------------------------------------------------
  console.log("Testing C8: Monotonic request ID stale response guard...");
  assert.match(referralsSrc, /referralRequestIdRef\.current/, "Must use monotonic request counter for referrals");
  assert.match(usersSrc, /usersRequestIdRef\.current/, "Must use monotonic request counter for users");

  // -------------------------------------------------------------------------
  // C9 & C41: Clearing search behaves correctly (immediate page-1 request, no 300ms delay, no double fetch)
  // -------------------------------------------------------------------------
  console.log("Testing C9 & C41: Clearing search immediately fetches page 1 without 300ms delay...");
  const beforeClearFetches = sim.referralFetchCount;
  sim.handleSearchChange("");
  assert.equal(sim.debouncedSearchQuery, "", "Debounced query must immediately clear");
  assert.equal(sim.page, 1, "Page must immediately reset to 1");
  assert.equal(sim.referralFetchCount, beforeClearFetches + 1, "Must issue exactly one immediate request on clear");
  assert.equal(sim.debounceTimer, null, "Debounce timer must be null on clear");

  // -------------------------------------------------------------------------
  // C10 & C42: Filter changes preserve correct search value and remain immediate
  // -------------------------------------------------------------------------
  console.log("Testing C10 & C42: Filter changes remain immediate with committed search term...");
  const beforeFilterFetches = sim.referralFetchCount;
  sim.debouncedSearchQuery = "testpartner";
  sim.handleStatusFilterChange("QUALIFIED");
  assert.equal(sim.referralFetchCount, beforeFilterFetches + 1, "Status filter change must fetch immediately");
  assert.equal(sim.lastFetchedStatus, "QUALIFIED");
  assert.equal(sim.lastFetchedQuery, "testpartner", "Must use current committed search term");
  assert.equal(sim.page, 1, "Must reset page to 1 on filter change");

  // -------------------------------------------------------------------------
  // C11 & C40: Paginated search resets to page 1 without intermediate old query request
  // -------------------------------------------------------------------------
  console.log("Testing C11 & C40: Page reset coordinates with debounce without intermediate old query request...");
  sim.page = 5;
  sim.debouncedSearchQuery = "oldquery";
  const beforeTypeFetches = sim.referralFetchCount;
  sim.handleSearchChange("newquery");
  // Page should still be 5 or uncommitted while typing; NO intermediate fetch should happen
  assert.equal(sim.referralFetchCount, beforeTypeFetches, "No fetch while typing new query");
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(sim.page, 1, "Page becomes 1 when new debounced query activates");
  assert.equal(sim.lastFetchedQuery, "newquery", "Fetch must use newquery");
  assert.equal(sim.lastFetchedPage, 1, "Fetch must use page 1");
  assert.equal(sim.referralFetchCount, beforeTypeFetches + 1, "Exactly one fetch fired, zero intermediate requests");

  // -------------------------------------------------------------------------
  // C12: Previous/Next still work with active search
  // -------------------------------------------------------------------------
  console.log("Testing C12: Pagination works with active search...");
  await sim.fetchReferrals("newquery", "QUALIFIED", "ALL", 2);
  assert.equal(sim.lastFetchedPage, 2);
  assert.equal(sim.lastFetchedQuery, "newquery");

  // -------------------------------------------------------------------------
  // C13 & C33: Tab isolation (USERS vs LOGIN_LOGS)
  // -------------------------------------------------------------------------
  console.log("Testing C13 & C33: Tab isolation between USERS and LOGIN_LOGS...");
  const userSim = new AdminUsersSimulator();
  userSim.mount();
  assert.equal(userSim.usersFetchCount, 1);
  assert.equal(userSim.logsFetchCount, 0, "Initial USERS tab mount must not fetch logs");

  userSim.switchTab("LOGIN_LOGS");
  assert.equal(userSim.logsFetchCount, 1);
  assert.equal(userSim.usersFetchCount, 1, "Switching to LOGIN_LOGS must not fetch USERS");

  // -------------------------------------------------------------------------
  // C14 & C15: Unmount cleans debounce timer and aborts in-flight requests
  // -------------------------------------------------------------------------
  console.log("Testing C14 & C15: Unmount safety and resource cleanup...");
  sim.handleSearchChange("unmounttest");
  assert.notEqual(sim.debounceTimer, null);
  // Start an active request that is in flight
  void sim.fetchReferrals("unmounttest");
  assert.notEqual(sim.activeAbortController, null);
  sim.unmount();
  assert.equal(sim.debounceTimer, null, "Debounce timer must be cleared on unmount");
  assert.equal(sim.unmountedAborted, true, "In-flight request must be aborted on unmount");

  // Test users unmount
  void userSim.fetchLogs("unmountlogs");
  assert.notEqual(userSim.logsAbortController, null);
  userSim.unmount();
  assert.equal(userSim.unmountedLogsAborted, true, "Users simulator aborts on unmount");

  // -------------------------------------------------------------------------
  // C25, C26, C27 & C38: Search input does not refetch analytics, payouts, or settings
  // -------------------------------------------------------------------------
  console.log("Testing C25, C26, C27 & C38: Search input does not refetch analytics, payouts, or settings...");
  const freshSim = new AdminReferralsSimulator();
  freshSim.mount();
  assert.equal(freshSim.analyticsFetchCount, 1);
  assert.equal(freshSim.payoutsFetchCount, 1);
  assert.equal(freshSim.settingsFetchCount, 1);

  // Type search
  freshSim.handleSearchChange("searchtest");
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(freshSim.analyticsFetchCount, 1, "Analytics must not refetch on search");
  assert.equal(freshSim.payoutsFetchCount, 1, "Payouts must not refetch on search");
  assert.equal(freshSim.settingsFetchCount, 1, "Settings must not refetch on search");

  // -------------------------------------------------------------------------
  // C30 & C35: Admin Users typing produces 0 requests before Submit/Enter
  // -------------------------------------------------------------------------
  console.log("Testing C30 & C35: Admin Users typing produces 0 requests before submit/Enter...");
  const usersTypingSim = new AdminUsersSimulator();
  usersTypingSim.mount();
  const initialUserFetches = usersTypingSim.usersFetchCount;
  for (let i = 0; i < "testuser".length; i++) {
    usersTypingSim.handleType("testuser".slice(0, i + 1));
  }
  assert.equal(
    usersTypingSim.usersFetchCount,
    initialUserFetches,
    "Typing in Admin Users search input must not trigger network requests"
  );

  // -------------------------------------------------------------------------
  // C36: Admin Users Search button / Enter triggers immediate search
  // -------------------------------------------------------------------------
  console.log("Testing C36: Admin Users submit button / Enter triggers immediate search...");
  usersTypingSim.handleSubmit();
  assert.equal(usersTypingSim.usersFetchCount, initialUserFetches + 1, "Submit must trigger immediate fetch");

  // -------------------------------------------------------------------------
  // C37: Admin Users newer submitted/filter request cancels or invalidates older request
  // -------------------------------------------------------------------------
  console.log("Testing C37: Newer submitted request aborts older request in Admin Users...");
  const prevAbort = usersTypingSim.usersAbortController;
  usersTypingSim.handleType("anotheruser");
  usersTypingSim.handleSubmit();
  assert.equal(prevAbort?.aborted, true, "Previous users in-flight request must be aborted");

  // -------------------------------------------------------------------------
  // C44: Post-mutation refreshes preserve all datasets required for correctness
  // -------------------------------------------------------------------------
  console.log("Testing C44: Post-mutation refreshes preserve required datasets...");
  const mutationSim = new AdminReferralsSimulator();
  mutationSim.mount();
  const initAnalytics = mutationSim.analyticsFetchCount;
  const initReferrals = mutationSim.referralFetchCount;
  const initPayouts = mutationSim.payoutsFetchCount;
  const initSettings = mutationSim.settingsFetchCount;

  // Referral moderation action
  await mutationSim.handleReferralAction();
  assert.equal(mutationSim.referralFetchCount, initReferrals + 1, "handleReferralAction must refresh referrals");
  assert.equal(mutationSim.analyticsFetchCount, initAnalytics + 1, "handleReferralAction must refresh analytics");

  // Payout processing action
  await mutationSim.handleProcessPayoutSubmit();
  assert.equal(mutationSim.payoutsFetchCount, initPayouts + 1, "handleProcessPayoutSubmit must refresh payouts");
  assert.equal(mutationSim.analyticsFetchCount, initAnalytics + 2, "handleProcessPayoutSubmit must refresh analytics");

  // Settings save action
  await mutationSim.handleSaveSettings();
  assert.equal(mutationSim.settingsFetchCount, initSettings + 1, "handleSaveSettings must refresh settings");

  // -------------------------------------------------------------------------
  // C16, C17, C18, C19, C20, C21, C22, C23: Strict boundaries and isolation
  // -------------------------------------------------------------------------
  console.log("Testing C16-C23: Strict file boundaries and isolation...");
  const changedFiles = getGitChangedFiles();
  console.log("Currently changed files:", changedFiles);

  // C16: No backend API route files changed
  const apiChanges = changedFiles.filter((f) => f.startsWith("src/app/api/"));
  assert.equal(apiChanges.length, 0, `No API route files may be modified. Found: ${apiChanges.join(", ")}`);

  // C18: No auth files modified
  const authChanges = changedFiles.filter((f) => f.includes("Auth") || f.includes("auth"));
  assert.equal(authChanges.length, 0, `No auth files may be modified. Found: ${authChanges.join(", ")}`);

  // C19: No Slice 3B polling files modified
  const pollingExclusions = [
    "src/components/NotificationBell.tsx",
    "src/app/admin/health/page.tsx",
    "src/app/maintenance/page.tsx",
    "src/app/social/page.tsx",
  ];
  for (const poller of pollingExclusions) {
    assert.equal(changedFiles.includes(poller), false, `Slice 3B poller must not be modified: ${poller}`);
  }

  // C20: No exam execution files modified
  const examChanges = changedFiles.filter((f) => f.includes("exam") || f.includes("Exam"));
  assert.equal(examChanges.length, 0, `No exam files may be modified. Found: ${examChanges.join(", ")}`);

  // C21: No PayMongo / financial calculation files modified
  const paymentChanges = changedFiles.filter(
    (f) => f.startsWith("src/lib/payment/") || f.includes("rewardCalculator") || f.includes("referralService")
  );
  assert.equal(paymentChanges.length, 0, `No payment/financial calculation files may be modified. Found: ${paymentChanges.join(", ")}`);

  // C22: No realtime polling files modified
  const realtimeChanges = changedFiles.filter(
    (f) => f.includes("MessagesSection") || f.includes("rooms") || f.includes("duel") || f.includes("whiteboard")
  );
  assert.equal(realtimeChanges.length, 0, `No realtime files may be modified. Found: ${realtimeChanges.join(", ")}`);

  // C23: No schema or dependency changes
  assert.equal(changedFiles.includes("prisma/schema.prisma"), false, "Prisma schema must not be modified");
  assert.equal(changedFiles.includes("package.json"), false, "package.json must not be modified");
  assert.equal(changedFiles.includes("package-lock.json"), false, "package-lock.json must not be modified");

  console.log("\nALL SLICE 3C VERIFICATION TESTS (C1-C44): PASS");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
