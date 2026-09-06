# Slice 3B — Low-Risk Polling & Adaptive Refresh Reduction

## 1. Scope
Slice 3B identifies and safely reduces unnecessary recurring HTTP polling traffic caused by aggressive fixed intervals, unrestricted background tab polling, and overlapping requests, while preserving user freshness and correctness across non-transactional surfaces.

The implementation focuses strictly on four low-risk / informational surfaces:
1. Notification badge counter (`src/components/NotificationBell.tsx`)
2. Admin system diagnostics (`src/app/admin/health/page.tsx`)
3. Platform maintenance status (`src/app/maintenance/page.tsx`)
4. Social Hub aggregate badge counts (`src/app/social/page.tsx`)

Strict exclusions: Authentication (`AuthContext.tsx`, `clientAuth.ts`, `/api/auth/me`), exams, payments/finance, realtime chat/messages, study room chat, whiteboard sync, live duels, and search debouncing are strictly untouched.

---

## 2. Starting Git State
- **Repository Worktree**: `C:\Users\Administrator\govstudyx-performance`
- **Branch**: `performance/traffic-frontend`
- **Starting Commit**: `92ea691cced8a8ae8e7606548bf0529a32efaec8` (`perf: centralize auth requests and activity heartbeat`)
- **Working Tree State**: Clean before implementation.

---

## 3. Repository Polling Inventory

| Component / Page | Feature | Endpoint(s) | Current Interval | Requests / Cycle | Approx Req / Hr / Tab | Runs When Hidden? | In-Flight Guard? | Cleanup Exists? | Freshness Need | Classification | Action in Slice 3B |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `src/app/admin/health/page.tsx` | System Diagnostics | 4 read-only diagnostics (`/api/health/liveness`, `/api/health/readiness`, `/api/admin/db-storage`, `/api/cron/health-monitor`) + 1 operational worker (`/api/cron/background-worker`) | 5s | 5 | 3,600 req/hr (1,440+ DB queries/hr) | Yes | No | Yes | Low / Operational | CLASS A (diagnostics) / Operational (worker) | **MODIFIED** (15s visible + hidden suspension for read-only diagnostics; operational worker left unchanged at 5s) |
| `src/components/NotificationBell.tsx` | Unread Notification Badge | `GET /api/notifications` | 60s | 1 (2 DB queries: `findMany` + `count`) | 60 req/hr (120 DB queries/hr) | Yes | No | Yes | Low / Informational | CLASS A — SAFE | **MODIFIED** (60s visible + hidden suspension + in-flight guard) |
| `src/app/maintenance/page.tsx` | System Maintenance Status | `GET /api/maintenance/status` | 10s | 1 (2 DB queries) | 360 req/hr (720 DB queries/hr) | Yes | No | Yes | Low / Status polling | CLASS A — SAFE | **MODIFIED** (20s visible + hidden suspension + in-flight guard) |
| `src/app/social/page.tsx` | Social Hub Tab Counts | `GET /api/social/counts` | 15s | 1 (6 DB queries in parallel) | 240 req/hr visible (1,440 DB queries/hr); ~0 req/hr hidden | Partial (15s timer ticks, skips fetch if hidden, lacks restore refresh) | No | Yes | Low / Informational badges | CLASS B — REVIEW | **MODIFIED** (Exact 30s visible + timer suspension when hidden + in-flight guard) |
| `src/components/social/MessagesSection.tsx` | Direct Messages Chat | `GET /api/social/messages/${activeConvId}` | 4s | 1 | 900 req/hr | Yes | No | Yes | High / Message order | CLASS C — DEFER | Deferred to Slice 2C / Realtime Social |
| `src/components/social/StudyRoomsSection.tsx` | Room Chat & Pinned Msg | `GET /api/social/rooms/${activeRoom.id}` | 4s | 1 | 900 req/hr | Checks `!document.hidden` | No | Yes | High / Room chat | CLASS C — DEFER | Deferred to Realtime Social |
| `src/components/social/rooms/StudyRoomStage.tsx` | Study Room Whiteboard | Whiteboard state sync | 2.5s | 1 | 1,440 req/hr | Whiteboard tab only | No | Yes | Critical / Canvas sync | CLASS C — DEFER | Deferred to Realtime Social |
| `src/app/duels/page.tsx` | Live Competitive Duels | `GET /api/duels/${match.id}` | 1.5s | 1 | 2,400 req/hr | Yes | No | Yes | Critical / Match timing | CLASS C — DEFER | Deferred to Realtime Social |
| `src/hooks/useOfflineSync.ts` | Offline Queue Count | IndexedDB read (local) | 10s | 0 network requests | 0 req/hr | N/A | Yes | Yes | Local | INFORMATIONAL | Do not modify |
| Countdown Clocks (`PostExamDashboard`, `CSCCountdownWidget`, etc.) | Local UI Countdown Clocks | Local state (`prev - 1`) | 1s | 0 network requests | 0 req/hr | N/A | N/A | Yes | Local UI | EXCLUDED | Do not touch |

---

## 4. Pollers Modified
1. `src/components/NotificationBell.tsx` (`GET /api/notifications`):
   - Changed from unconditional 60s polling loop to visibility-aware, offline-safe, in-flight guarded polling at 60s while visible.
   - Polling is cleared when tab is hidden (approved informational/read-only pollers produce zero recurring polling requests while hidden).
   - Visibility restore executes at most one refresh if data is stale (> 60s).

2. `src/app/admin/health/page.tsx` (Read-only diagnostics):
   - Separated 4 confirmed read-only diagnostic endpoints (`/api/health/liveness`, `/api/health/readiness`, `/api/admin/db-storage`, `/api/cron/health-monitor`) from the operational background worker (`/api/cron/background-worker`).
   - Relaxed read-only diagnostic polling from 5s to 15s while visible.
   - Guarded all 4 read-only diagnostics under a single in-flight batch ref (`readOnlyInFlightRef`).
   - Paused completely when hidden (0 background requests for read-only diagnostics).
   - Updated UI badge from `Live (5s)` to `Live (15s)`.
   - `/api/cron/background-worker` remains intentionally unchanged at its original 5-second operational interval and therefore continues at approximately 720 requests/hour/tab, including while the page is hidden, preserving pre-Slice-3B behavior.

3. `src/app/maintenance/page.tsx` (`GET /api/maintenance/status`):
   - Relaxed polling from 10s to 20s while visible.
   - Added in-flight guard (`inFlightRef`).
   - Paused completely when hidden (0 background requests).
   - Visibility restore checks status immediately if stale (> 20s) and restarts timer.
   - Manual `🔄 Refresh System Status` preserved.

4. `src/app/social/page.tsx` (`GET /api/social/counts`):
   - Relaxed visible polling from 15s to exact 30s while visible.
   - Added in-flight guard (`countsInFlightRef`).
   - 0 → 0 hidden HTTP requests; timer wakeups/background scheduling eliminated and restore freshness improved.
   - Visibility restore checks counts immediately if stale (> 30s) and restarts 30s timer.

---

## 5. Pollers Deferred
The following pollers were discovered and explicitly deferred to protect realtime correctness:
- **Direct Messaging (`src/components/social/MessagesSection.tsx`)**: 4-second chat message polling deferred to Slice 2C (Realtime Social).
- **Study Room Chat (`src/components/social/StudyRoomsSection.tsx`)**: 4-second chat polling deferred to Realtime Social.
- **Study Room Whiteboard (`src/components/social/rooms/StudyRoomStage.tsx`)**: 2.5-second collaborative canvas synchronization deferred to Realtime Social.
- **Duels Match State (`src/app/duels/page.tsx`)**: 1.5-second competitive question timer and player sync deferred to Realtime Social.

---

## 6. Request Rates Before (Structural / Theoretical Estimates)
*Note: All rates are structural/theoretical request-rate estimates calculated per open browser tab, not production telemetry.*

- **Admin Health Total**: 5 requests / 5s = 60 req/min = **3,600 req/hr/tab**
  - Read-only diagnostics (4 endpoints): 4 × 12 cycles/min × 60 min = **2,880 req/hr/tab**
  - Operational background worker (1 endpoint): 1 × 12 cycles/min × 60 min = **720 req/hr/tab**
- **Notification Bell**: 1 request / 60s = 1 req/min = **60 req/hr/tab** (ran continuously including when hidden)
- **Maintenance Page**: 1 request / 10s = 6 req/min = **360 req/hr/tab** (ran continuously including when hidden)
- **Social Aggregate Counts**:
  - Visible: 1 request / 15s = 4 req/min = **240 req/hr/tab** (and 1,440 DB count queries/hr)
  - Hidden: Pre-Slice-3B implementation checked `!document.hidden` inside its 15s callback, yielding **~0 HTTP req/hr** while hidden (though the 15-second timer continued firing in the background without deterministic restore refresh).

**Combined Before Totals**:
- **Visible Total**: 3,600 + 60 + 360 + 240 = **4,260 requests/hour/tab**
- **Hidden Total**: 2,880 (read-only diagnostics) + 720 (operational worker) + 60 (notifications) + 360 (maintenance) + 0 (social counts HTTP) = **4,020 requests/hour/tab**

---

## 7. Request Rates After (Structural / Theoretical Estimates)

### Visible Tab State
- **Admin Health Total**: **1,680 req/hr/tab**
  - Read-only diagnostics (4 endpoints): 4 × 4 cycles/min × 60 min = **960 req/hr/visible tab**
  - Operational background worker (1 endpoint): 1 × 12 cycles/min × 60 min = **720 req/hr/tab** (unchanged)
- **Notification Bell**: 1 request / 60s = **60 req/hr/tab**
- **Maintenance Page**: 1 request / 20s = 3 req/min = **180 req/hr/tab**
- **Social Aggregate Counts**: 1 request / 30s = 2 req/min = **120 req/hr/tab** (and 720 DB count queries/hr)

**Combined After Visible Total**:
1,680 + 60 + 180 + 120 = **2,040 requests/hour/tab**
**Overall Visible Reduction**: 4,260 → 2,040 = **approximately 52.1% reduction**

### Hidden Tab State
- **Approved Informational / Read-Only Pollers**: **0 req/hr**
  - Admin Health Read-Only Diagnostics: 0 req/hr
  - Notification Bell: 0 req/hr
  - Maintenance Page: 0 req/hr
  - Social Counts: 0 req/hr (0 → 0 hidden HTTP requests; timer wakeups/background scheduling eliminated and restore freshness improved)
- **Operational Background Worker** (`/api/cron/background-worker`): **720 req/hr/tab** (remains intentionally unchanged at its 5-second operational interval, continuing including while hidden to preserve existing background execution behavior).

**Combined After Hidden Total**: **720 requests/hour/tab**
**Overall Hidden Reduction**: 4,020 → 720 = **approximately 82.1% reduction**

---

## 8. Visibility Behavior
All four modified components implement strict visibility management via `document.addEventListener("visibilitychange")`:
- **Hidden Tab**: When `document.hidden === true`, recurring timers are cleared (`clearInterval(timerRef.current)` and `timerRef.current = null`). Approved informational/read-only pollers produce zero recurring polling requests while hidden.
- **Visibility Restoration**: When `document.hidden === false`:
  - Staleness is evaluated: `Date.now() - lastFetchTimeRef.current >= INTERVAL_MS`.
  - If stale: exactly **one** immediate fetch is dispatched.
  - The recurring timer is reset so the next scheduled poll occurs one full interval later.
  - Simultaneous `restore refresh + interval tick` bursts are strictly prevented.
  - If not stale (e.g. user briefly toggled away for 2 seconds), no fetch is dispatched; the schedule continues normally.

---

## 9. Offline / Online Behavior
All modified components attach `online` and `offline` event listeners:
- **Offline Event**: When device goes offline, polling intervals are cleared. Fetch calls check `navigator.onLine` and abort before dispatching network requests, preventing browser console network failure errors.
- **Online Event**:
  - If tab is **hidden**: zero refresh requests are dispatched (`!document.hidden` guard).
  - If tab is **visible**: staleness is evaluated. If stale, exactly one refresh is dispatched and timer is reset.
- **Online + Visibility Race**: If a device reconnects while the tab becomes visible, the first event marks `inFlightRef.current = true` and updates `lastFetchTimeRef.current`. The second event is collapsed by the in-flight and staleness guards into at most one refresh.

---

## 10. In-Flight Request Protection
Every modified poller implements in-flight deduplication via a component-local ref:
- `NotificationBell`: `inFlightRef.current`
- `MaintenancePage`: `inFlightRef.current`
- `SocialDashboardPage`: `countsInFlightRef.current`
- `AdminHealthPage`: `readOnlyInFlightRef.current` guards the entire 4-endpoint `Promise.all` batch as a single atomic in-flight operation. A second diagnostic batch cannot start while any endpoint of the current batch is resolving.

---

## 11. Timer Cleanup
All `useEffect` blocks return comprehensive cleanup functions:
- Active `setInterval` handles are cleared (`clearInterval(timerRef.current); timerRef.current = null`).
- `visibilitychange`, `online`, and `offline` listeners are explicitly removed.
- Prevents memory leaks and duplicate timer accumulation upon unmount.

---

## 12. Navigation Behavior
When navigating across routes (e.g., leaving `/admin/health` to `/admin`, or leaving `/social` to `/dashboard`):
- React unmount lifecycle triggers timer destruction and listener removal.
- Returning to the route reinstantiates a single fresh timer and performs the initial mount fetch.
- Verified in `src/scripts/test-performance-slice-3b.ts` (Criterion B18).

---

## 13. Admin Health Findings & Architectural Debt
Inspection of the five diagnostic endpoints revealed:
- `/api/health/liveness`: Pure observational probe (Node process memory, uptime). Read-only.
- `/api/health/readiness`: Pure observational probe (DB connection ping `SELECT 1`, env check). Read-only.
- `/api/admin/db-storage`: Pure observational probe (PostgreSQL database size calculation `SELECT pg_database_size(...)`). Read-only.
- `/api/cron/health-monitor`: Evaluates in-memory failure queues and DB ping latency. Does not mutate database or dispatch external alerts. Read-only.
- `/api/cron/background-worker`: **Identified as an operational worker performing database cleanup work!**
  - Specifically, it executes `cleanExpiredSessionsAndTokens()` which performs database mutations (`prisma.user.updateMany` invalidating expired password reset tokens and verification tokens).
  - Per Refinement 1, this operational request behavior was left unchanged at its original 5000ms loop without visibility gating, ensuring background processing was not disrupted in Slice 3B.
  - **Architectural Technical Debt Note**: Operational background processing should eventually be reviewed for server-side scheduling/ownership (e.g., dedicated cron service, worker queue) rather than relying on browser-page polling from `/admin/health`. This is recorded as deferred technical debt and was not redesigned in Slice 3B.

---

## 14. Notification Findings
`src/components/NotificationBell.tsx` previously polled `/api/notifications` every 60 seconds unconditionally. Each request runs 2 database queries (`prisma.notification.findMany` with `take: 60` and `prisma.notification.count`). Adding hidden-tab suspension completely eliminates 120 database operations per hour per idle/background tab.

---

## 15. Social Count Findings
`src/app/api/social/counts` executes 6 parallel database counts per call (`notification.count`, `classmateRelation.count`, `directMessage.count`, `studyRoom.count`, `studyEvent.count`, `studyClub.count`).

Pre-Slice-3B implementation already checked `document.hidden` inside its 15-second timer callback and skipped the network fetch while hidden, producing approximately 0 HTTP requests/hr when hidden. However, the 15-second interval timer continued firing in the background, and there was no deterministic stale refresh upon visibility restore.

Slice 3B achieves:
- **Visible Polling**: Relaxed from 15s to exact 30s:
  - Visible HTTP requests: 240/hr → **120/hr** (50.0% reduction).
  - Visible DB count operations: 1,440/hr → **720/hr** (50.0% reduction).
- **Hidden Tab State**: The timer itself is completely suspended while hidden (eliminating unnecessary 15-second timer wakeups and background scheduling) while HTTP traffic remains 0/hr (0 → 0 hidden HTTP requests).
- **Visibility Restore**: When the tab becomes visible again, deterministic staleness evaluation triggers at most one refresh if > 30s, cleanly restoring freshness.

---

## 16. Message / Chat Findings
`src/components/social/MessagesSection.tsx` polls active chat messages every 4 seconds. Classified as Class C (Defer). Modifying chat polling risks message delivery latency and ordering bugs. Deferred to Slice 2C / Realtime Social.

---

## 17. Whiteboard Findings
`src/components/social/rooms/StudyRoomStage.tsx` polls whiteboard state every 2.5 seconds when on the whiteboard tab. Classified as Class C (Defer). Deferred to Realtime Social.

---

## 18. Duel Findings
`src/app/duels/page.tsx` polls active duel matches every 1.5 seconds. Classified as Class C (Defer). Modifying duel timing risks synchronization issues during competitive 10-second question rounds. Deferred to Realtime Social.

---

## 19. Endpoint Contracts
Zero backend API routes were modified. All contracts, JSON schemas, headers, query parameters, and status codes for `/api/notifications`, `/api/health/*`, `/api/cron/*`, `/api/admin/db-storage`, `/api/maintenance/status`, and `/api/social/counts` remain 100% identical.

---

## 20. Security / Authorization Preservation
- Server-side role authorization (`ADMIN` checks in `src/app/api/admin/*`, `getAuthenticatedUser()` in `/api/social/counts` and `/api/notifications`) remains intact.
- Regression test suites `test-security-suite.ts` (26/26 tests passed) and `test-trash-auth-security.ts` (11/11 tests passed) confirmed 0 security regressions.

---

## 21. Files Modified
Client components only:
1. `src/components/NotificationBell.tsx`
2. `src/app/admin/health/page.tsx`
3. `src/app/maintenance/page.tsx`
4. `src/app/social/page.tsx`

Plus test suite and documentation:
- `src/scripts/test-performance-slice-3b.ts` (Created)
- `docs/performance/SLICE_3B_POLLING_ADAPTIVE_REFRESH.md` (Created)

---

## 22. Focused Tests
`src/scripts/test-performance-slice-3b.ts` validated all 24 criteria:
- **B1**: Initial load fetch on mount (PASSED)
- **B2**: Single active timer tracked via ref (PASSED)
- **B3**: Timer and listener cleanup on unmount (PASSED)
- **B4 & B5**: Hidden tab suspension & 0 background requests for approved pollers (PASSED)
- **B6 & B7**: Stale visibility restore refresh & polling resumption (PASSED)
- **B8**: In-flight overlap protection (PASSED)
- **B9 & B10**: Offline suppression & online restore (PASSED)
- **B11**: Manual refresh buttons operational (PASSED)
- **B12**: Existing UI state and filters preserved (PASSED)
- **B13**: No API route files modified (PASSED)
- **B14**: Auth files untouched (PASSED)
- **B15**: Exam files untouched (PASSED)
- **B16**: Payment/financial files untouched (PASSED)
- **B17**: Realtime social files untouched (PASSED)
- **B18**: Timer accumulation prevented across mount/unmount (PASSED)
- **B19**: Health endpoint side-effect classification (PASSED)
- **B20**: Online while hidden produces zero refresh requests (PASSED)
- **B21**: Online + visibility race produces at most one refresh (PASSED)
- **B22**: Health diagnostic batch overlap prevented (PASSED)
- **B23**: Social exact 30-second interval (PASSED)
- **B24**: Restore timer reset waits full interval (PASSED)

---

## 23. Regression Tests
- `npx tsx src/scripts/test-performance-slice-3b.ts`: **24 / 24 PASSED**
- `npx tsx src/scripts/test-performance-slice-2a.ts`: **PASS** (Pagination schemas & query contracts)
- `npx tsx src/scripts/test-security-suite.ts`: **26 / 26 PASSED**
- `npx tsx src/scripts/test-trash-auth-security.ts`: **11 / 11 PASSED**
- `test-performance-slice-3a.ts`:
  - Auth ownership, stale thresholds, activity throttle, heartbeat cancellation, and consumers: **PASS** (A1–A14, A16–A23).
  - Note on A15: Slice 3A's working-tree diff check flagged `src/app/social/page.tsx` because Slice 3B modifies `src/app/social/page.tsx` for social badge polling reduction. Evaluated against Slice 3A's commit diff (`git diff --name-only 4658114 92ea691`), Slice 3A touched 0 excluded files. Per Rule 38 ("Do not change unrelated tests to manufacture PASS"), `test-performance-slice-3a.ts` was preserved unchanged.

---

## 24. TypeScript
- Command: `npx tsc --noEmit`
- Result: **0 errors** (Clean exit code 0).

---

## 25. Production Build
- Command: `npm run build` (`prisma generate && next build`)
- Result: **Clean build** (All 212 pages generated, exit code 0).

---

## 26. Git Diff
- `git diff --check`: 0 errors.
- `git diff --stat`:
  - `src/app/admin/health/page.tsx`: +117 / -17
  - `src/app/maintenance/page.tsx`: +76 / -8
  - `src/app/social/page.tsx`: +79 / -14
  - `src/components/NotificationBell.tsx`: +73 / -4
  - Total: 4 files changed, 345 insertions, 43 deletions.

---

## 27. Structural Traffic Reduction Summary
- **Admin Health Read-Only Diagnostics (4 endpoints)**:
  - Before: 4 endpoints × 12 cycles/min × 60 min = 2,880 req/hr/tab
  - After visible: 4 endpoints × 4 cycles/min × 60 min = 960 req/hr/visible tab
  - **Visible reduction: 2,880 → 960 = 66.7% reduction**
  - **Hidden reduction: 2,880 → 0 = 100% reduction**
- **Admin Health Total (including unchanged operational worker)**:
  - Before total: 3,600 req/hr/tab
  - After visible: 960 + 720 = 1,680 req/hr/tab (**53.3% total reduction**)
  - After hidden: 0 + 720 = 720 req/hr/tab (**80.0% total reduction**)
- **Notification Bell**:
  - Visible: 60 req/hr
  - Hidden: 0 req/hr (**100% reduction when hidden**)
- **Maintenance Page**:
  - Before: 360 req/hr
  - After visible: 180 req/hr (**50.0% reduction visible**)
  - After hidden: 0 req/hr (**100% reduction when hidden**)
- **Social Badge Counts**:
  - Before visible: 240 req/hr (1,440 DB counts/hr)
  - After visible: 120 req/hr (720 DB counts/hr; **50.0% reduction visible**)
  - Hidden: 0 → 0 hidden HTTP requests (eliminates recurring 15s timer wakeups/background scheduling; adds deterministic restore freshness)
- **Combined Slice 3B Total**:
  - Before visible: 4,260 req/hr/tab
  - After visible: 2,040 req/hr/tab (**approximately 52.1% overall visible reduction**)
  - Before hidden: 4,020 req/hr/tab (Admin Health 3,600 + Notifications 60 + Maintenance 360 + Social 0)
  - After hidden: 720 req/hr/tab (operational worker only)
  - **Combined hidden HTTP reduction: 4,020 → 720 = approximately 82.1% reduction**

---

## 28. Multi-Tab Limitation
Polling is controlled per browser tab. If a user opens multiple visible tabs side-by-side, each tab maintains its own controlled timer. Inactive/background tabs immediately suspend polling for all approved informational/read-only pollers.

---

## 29. Remaining Risks
- **Admin diagnostic observation delay**: Diagnostic anomalies can take up to 15s to appear automatically instead of 5s. Admin has instant manual `⚡ Refresh Now` button and `Live (15s)` indicator.
- **Social badge delay**: Badges update within 30s instead of 15s. Badges are aggregate indicators; clicking any tab fetches fresh data immediately.
- **Maintenance lifting delay**: Maintenance status changes within 20s instead of 10s. Manual `🔄 Refresh System Status` is available.

---

## 30. Deferred Slice 3C / Slice 4 / Social Realtime Work
- **Slice 3C**: Search debounce, abort controllers on keypress inputs, and search race condition protection.
- **Slice 4**: Server response caching, shared resource caching, cache tags, and revalidation.
- **Realtime Social**: Messages polling, study room chat polling, whiteboard sync, and duels live match state.
- **Operational Worker Architecture**: Decoupling `/api/cron/background-worker` from admin health browser page polling to dedicated server-side cron scheduling.
