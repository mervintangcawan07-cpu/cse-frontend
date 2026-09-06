# GovStudyX Performance Hardening — Slice 3A: Auth Traffic & Controlled Heartbeat

## 1. Starting Git State

- **Worktree**: `C:\Users\Administrator\govstudyx-performance`
- **Branch**: `performance/traffic-frontend`
- **Starting Commit**: `46581141cc9361d9d5341248f17e7a886e48edc9` (`perf: add bounded admin list pagination`)
- **Initial Working Tree**: Clean and up to date with `origin/performance/traffic-frontend`
- **Environment**: Windows, Windows PowerShell, VS Code, Node v24.19.0, npm 11.17.0, Next.js 16.3.2 (Turbopack), React 19.2.4, Prisma 7.9.1

## 2. Original `/api/auth/me` Consumers

A repository-wide discovery identified 15 client files directly calling `/api/auth/me`:
1. `src/components/Navbar.tsx` (called on mount, on route changes, on focus, and every 30s)
2. `src/components/Sidebar.tsx` (called on route changes even though Sidebar returns `null`)
3. `src/app/page.tsx` (landing page, called to redirect active sessions to dashboard)
4. `src/app/dashboard/page.tsx` (called to verify authentication before loading analytics)
5. `src/app/profile/page.tsx` (called on mount to load user name and display fields)
6. `src/app/practice/page.tsx` (called on mount to check subscription/pro status)
7. `src/app/learning/page.tsx` (called on mount to check subscription/pro status)
8. `src/app/redeem/page.tsx` (called on mount to populate session info)
9. `src/app/upgrade/page.tsx` (called during checkout / session management)
10. `src/app/duels/page.tsx` (duel matchmaking session check)
11. `src/app/exam/page.tsx` (in-exam active session verification)
12. `src/app/practice/custom/page.tsx` (custom drill action-time auth check)
13. `src/app/social/page.tsx` (social presence / user identity check)
14. `src/components/social/MessagesSection.tsx` (chat participant verification)
15. `src/components/social/StudyClubsSection.tsx` (club membership verification)
16. `src/components/social/StudyRoomsSection.tsx` (room participant verification)

## 3. Remaining Deferred Consumers

To minimize risk and maintain strict isolation for Slice 3A, seven direct `/api/auth/me` consumers in social/realtime and exam execution are intentionally deferred:
- `src/app/duels/page.tsx`
- `src/app/exam/page.tsx`
- `src/app/practice/custom/page.tsx`
- `src/app/social/page.tsx`
- `src/components/social/MessagesSection.tsx`
- `src/components/social/StudyClubsSection.tsx`
- `src/components/social/StudyRoomsSection.tsx`

These consumers relate to exam scoring/answer security and LiveKit/presence polling, which are scheduled for dedicated hardening in later slices.

## 4. `lastActiveAt` Security Semantics

`lastActiveAt` is a security-critical timestamp in the `User` table:
- **30-Minute Inactivity Auto-Logout**: If `(now - lastActiveAt) >= 30 minutes`, the server invalidates `activeSessionId`, clears `lastActiveAt`, deletes `cse_session`, and returns `{ user: null }`.
- **Social Presence**: Indicates whether a user is currently active/online (online threshold is ~3 minutes).
- **Concurrency & CAS**: The update `prisma.user.updateMany({ where: { id, activeSessionId, isBanned: false, deletedAt: null }, data: { lastActiveAt: now } })` ensures only the exact matching active session can bump activity.

## 5. Confirmation that Inactivity is Checked Before Activity Write

Inspection of `src/app/api/auth/me/route.ts` confirmed that the inactivity check strictly precedes any activity write:
1. Lines 38–56: `if (user.lastActiveAt) { const minutesInactive = (now.getTime() - new Date(user.lastActiveAt).getTime()) / (1000 * 60); if (minutesInactive >= INACTIVITY_LIMIT_MINUTES) { ... delete session and return user: null; } }`
2. Lines 74–82: Only after passing the inactivity guard does the server execute `prisma.user.updateMany({ ... data: { lastActiveAt: now } })`.

Because inactivity is evaluated prior to the activity update, eliminating unconditional client polling ensures an idle user will genuinely hit the 30-minute expiration limit.

## 6. Auth Owner Before / After

### Before
- **No Shared Client Owner**: Every component independently fetched `/api/auth/me`.
- **Navbar**: Maintained independent state, ran a 30s unconditional `setInterval`, refetched on `window.focus`, and refetched on every `pathname` route change.
- **Sidebar**: Fired an independent `/api/auth/me` fetch on every route change, despite rendering `null`.
- **Pages**: Dashboard, Landing, Profile, Practice, Learning, Redeem, and Upgrade each called `fetch("/api/auth/me")` independently during hydration.
- **Traffic Amplification**: A single user navigating to dashboard produced 3+ simultaneous `/api/auth/me` requests, each updating `lastActiveAt` in Postgres.

### After
- **Centralized Client Owner**: `AuthProvider` in `src/context/AuthContext.tsx` owns session state, request lifecycle, activity tracking, and invalidation.
- **Single Request Gate**: `createAuthRequestGate` coalesces concurrent calls into a single in-flight network request.
- **Subscriber Model**: Components consume `useAuth()` to read `user`, `status`, and `error`, eliminating redundant network calls.
- **Zero Route-Change Duplication**: Navigating between internal routes does not trigger additional `/api/auth/me` calls.

## 7. Public-Route Initialization Behavior

- Inspection of `HEAD:src/components/Navbar.tsx` revealed that pre-Slice-3A Navbar invoked `fetchMe()` on mount and on every `pathname` change without excluding public routes. The only route-specific condition was `isKickedSafePath` (`/login`, `/`, `/privacy`, `/terms`, `/refund`, `/cookies`), which governed whether a `kicked=true` response forced an immediate redirect to `/login?kicked=true`.
- In Slice 3A, `AuthProvider` is mounted at the root layout. It performs exactly one initial snapshot on app mount.
- On public routes (`/`, `/privacy`, `/terms`, etc.), this initial request populates user state for Navbar (e.g. displaying user initials and logout if logged in, or "Sign In" if anonymous) and enables Landing Page active-session redirection without redundant component-level fetches.
- Route navigation between public pages does not cause repeated auth queries.

## 8. Activity Heartbeat Design

The activity heartbeat is strictly activity-gated:
- Listens to genuine user input events: `pointerdown`, `keydown`, `touchstart` (registered with `{ passive: true }`).
- Maintains an `activityPendingRef` flag and an `activityTimerRef`.
- When user activity occurs:
  1. If user is unauthenticated, heartbeat is paused, document is hidden, or offline: ignore.
  2. Sets `activityPendingRef.current = true`.
  3. Schedules a timer for the remaining duration of the 2-minute throttle interval.
  4. When the timer expires, re-verifies that real activity occurred, tab is visible, and network is online before dispatching `refreshAuth("activity")`.

## 9. Two-Minute Throttle Semantics

- Throttle interval: `AUTH_ACTIVITY_THROTTLE_MS = 120_000` (2 minutes).
- **Semantics**: "At most one activity-driven heartbeat every two minutes", NOT "one automatic heartbeat every two minutes".
- High-frequency inputs (e.g. 100 keystrokes or mouse clicks within 30 seconds) collapse into exactly one scheduled heartbeat.
- Elapsed time since the last auth attempt (`lastAuthAttemptAtRef`) determines whether a delay is required: `delay = Math.max(0, AUTH_ACTIVITY_THROTTLE_MS - elapsed)`.

## 10. Visible-Idle Behavior

- If an authenticated user leaves a tab open and visible but walks away from the keyboard, **zero** activity events are generated.
- `activityPendingRef` remains `false` and no timeout is queued.
- The client issues **zero** `/api/auth/me` calls while visible and idle.
- After 30 minutes of inactivity, the server's inactivity guard (`minutesInactive >= 30`) safely expires the session on the user's next interaction.

## 11. Hidden-Tab Behavior

- When a tab transitions to `document.visibilityState === "hidden"`:
  - `cancelPendingActivityHeartbeat()` immediately clears any scheduled timer and resets `activityPendingRef = false`.
  - `recordActivity()` exits early if `document.visibilityState !== "visible"`.
- Hidden tabs produce **zero** activity heartbeats, preventing background tabs from keeping sessions alive or exhausting server resources.

## 12. Visibility Restore Behavior

- When the tab returns to `visible`:
  - `refreshIfStale("visibility")` checks whether the existing auth snapshot is stale (`Date.now() - lastSnapshotAt >= AUTH_SNAPSHOT_STALE_MS` and `Date.now() - lastAuthAttemptAt >= AUTH_SNAPSHOT_STALE_MS`).
  - If the user was active recently (snapshot < 2 minutes old), **no request** is made.
  - If stale (>= 2 minutes), exactly **one** freshness request is dispatched.
  - Rapidly switching tabs back and forth does not trigger multiple requests due to the stale threshold guard.

## 13. Online / Reconnect Behavior

- The `window.addEventListener("online")` listener invokes `refreshIfStale("online")`.
- If the session snapshot is stale (or if recovering from a transient error), it triggers a single freshness request.
- Offline states (`navigator.onLine === false`) suppress activity heartbeats and freshness checks.

## 14. Transient-Error Recovery

- If the initial auth snapshot fails due to transient network interruption, offline status, or temporary 500 error:
  - `statusRef.current` is set to `"error"`.
  - When the browser comes back online (`online` event), `refreshIfStale` detects `isErrorRecovery = !userRef.current && statusRef.current === "error"`.
  - It immediately dispatches exactly **one** controlled retry (`refreshAuth("online")`).
  - If the tab becomes visible after a transient error and `Date.now() - lastAuthAttemptAt >= AUTH_SNAPSHOT_STALE_MS`, it also dispatches one controlled retry.

## 15. Definitive Unauthenticated Behavior

- When `/api/auth/me` returns 401, 403, or 200 with `{ user: null }`, `applyUser(null)` transitions `statusRef.current` to `"unauthenticated"`.
- Because `statusRef.current !== "error"`, `isErrorRecovery` evaluates to `false`.
- `refreshIfStale` observes `!userRef.current` and immediately returns.
- Consequently, unauthenticated visitors experience **zero** background retry loops, zero periodic polling, and zero online/visibility retry storms.

## 16. Single-Flight Request Behavior

- Managed by `createAuthRequestGate<T>()`.
- If a request is already in-flight, subsequent calls to `run()` return the existing shared Promise.
- Upon resolution or rejection, the in-flight reference is cleared.
- Prevents parallel component mounts from launching concurrent HTTP requests.

## 17. Request Invalidation

- `createAuthRequestGate` maintains a monotonically increasing `generation` counter.
- Calling `invalidate()` increments `generation` and aborts the active `AbortController`.
- If an in-flight network response returns after invalidation, it detects `generation !== requestGeneration` and throws `AuthRequestInvalidatedError`.
- Prevents late-arriving responses from resurrecting auth state after logout.

## 18. Kicked-Session Behavior

- Preserves the `kicked` flag returned by `/api/auth/me` on session mismatch (concurrent logins):
  - Server returns `{ user: null, kicked: true, reason: "CONCURRENT_LOGIN" }`.
  - `AuthContext` safely extracts `body?.kicked` even on 401/403 responses.
  - When `kicked === true` and pathname is not in `isKickedSafePath`, the browser redirects to `/login?kicked=true`.
  - Kicked-safe paths (`/login`, `/`, `/privacy`, `/terms`, `/refund`, `/cookies`) suppress the redirect loop.

## 19. Login / Logout Behavior

### Login
- Login continues to perform full-window navigation (`window.location.href = ...`), ensuring cookies attach cleanly to document requests.

### Logout
- In `Navbar.tsx` and `UpgradePage`:
  1. `pauseActivityHeartbeat()` halts all activity listeners and cancels pending timers.
  2. `POST /api/auth/logout` is called.
  3. On success, `clearAuth()` is invoked, invalidating in-flight requests and clearing local user state.
  4. If logout fails, `resumeActivityHeartbeat()` restores normal behavior.
  5. The user is redirected to `/login`.

## 20. Entitlement Refresh Paths

Entitlement and profile changes trigger explicit snapshot refreshes without installing polling intervals:
- **Dashboard Payment Verification**: When `paymentStatus === "success"`, dashboard verifies payment via `/api/paymongo/verify` and then awaits `refreshAuth("entitlement")`.
- **Voucher Redemption**: `src/app/redeem/page.tsx` awaits `refreshAuth("entitlement")` upon successful voucher redemption.
- **Profile Updates**: `src/app/profile/page.tsx` awaits `refreshAuth("profile")` upon updating user profile name or credentials.

## 21. Multi-Tab Limitation

- Each browser tab maintains its own React state and activity listeners.
- Because `cse_session` cookie is shared across tabs, an activity heartbeat in Tab A updates `lastActiveAt` on the server for the user's active session.
- Tab B, if idle, does not issue heartbeats, but will benefit from the refreshed server session when it eventually becomes active or visible.
- Cross-tab `BroadcastChannel` synchronization is deferred to avoid complexity; the stale visibility restore (>= 2 minutes) provides sufficient freshness upon tab switching.

## 22. Server Authorization Preservation

Client-side `AuthContext` is strictly a presentation and traffic optimization tool, never an authorization authority:
- All protected API routes continue to enforce server-side authentication (`getAuthenticatedSessionResult`, `requireAdminAuth`, role checks, CAS checks).
- Server-side cookie validation, JWT verification, and proxy routing in `src/proxy.ts` remain unchanged.

## 23. Exact Modified Files

1. `src/lib/auth/clientAuth.ts` (new) — request gate, constants, invalidation error
2. `src/context/AuthContext.tsx` (new) — AuthProvider, useAuth hook, heartbeat, visibility/online handlers
3. `src/app/layout.tsx` — wrapped children in AuthProvider
4. `src/components/Navbar.tsx` — consumed useAuth, removed 30s interval & focus listener, integrated logout
5. `src/components/Sidebar.tsx` — removed redundant /api/auth/me fetch and pathname listener
6. `src/app/page.tsx` — replaced fetch with useAuth for active session redirect
7. `src/app/dashboard/page.tsx` — replaced fetch with useAuth, explicit entitlement refresh on payment
8. `src/app/profile/page.tsx` — replaced fetch with useAuth, explicit profile refresh
9. `src/app/practice/page.tsx` — replaced fetch with useAuth
10. `src/app/learning/page.tsx` — replaced fetch with useAuth
11. `src/app/redeem/page.tsx` — replaced fetch with useAuth, explicit entitlement refresh
12. `src/app/upgrade/page.tsx` — integrated pauseActivityHeartbeat & clearAuth on logout
13. `src/scripts/test-performance-slice-3a.ts` (new) — automated regression suite for Slice 3A (A1–A23)
14. `docs/performance/SLICE_3A_AUTH_TRAFFIC.md` (new) — comprehensive technical report

## 24. Tests

Automated test harness `src/scripts/test-performance-slice-3a.ts` verifies:
- **A1–A4**: Single initial auth owner; elimination of duplicate calls in Navbar, Sidebar, Dashboard, Landing, Profile, Practice, Learning, Redeem.
- **A5–A8**: Single activity timer, timer cleanup on unmount, hidden-tab suppression, single visibility resume path.
- **A9**: Single-flight request coalescing and generation-based invalidation.
- **A10–A12**: Logout cleanup and invalidation, error handling, kicked signal preservation and safe path redirection.
- **A13**: Explicit entitlement and profile refresh integration.
- **A14**: Server authorization and `/api/auth/me` contract preservation.
- **A15**: Strict exclusion of out-of-scope files (Prisma, paymongo, social, exam, proxy, middleware).
- **A16–A19**: Silent visible-idle, 2-minute activity throttle, passive event listeners, silent hidden tabs.
- **A20–A21**: Confirmation that server checks 30m inactivity before write; stale visibility check.
- **A22**: Public-route behavior and replacement of previously global Navbar request.
- **A23**: No independent polling owners in page consumers.
- **Focused Simulation**: Initial transient failure recovery via `online` event; zero retries on definitive 401/403 unauthenticated state.

Result: `PASS` (all assertions pass).

## 25. TypeScript Verification

Command: `npx tsc --noEmit`
Result: `0 errors` (PASS).

## 26. Production Build Verification

Command: `npm run build`
Result: `PASS` (exited with code 0; 212 pages optimized). Known Next.js dynamic-auth log messages for cookie evaluation in `/partner-portal` reproduced as expected without build failure.

## 27. Git Diff & Working Tree Check

Commands:
- `git diff --check`: Clean (0 whitespace/formatting issues)
- `git status --short`: Shows only the approved 10 modified and 4 untracked files
- Working tree remains strictly uncommitted in accordance with safety instructions.

## 28. Structural Traffic Reduction

- **Idle Visible Tabs**: Reduced from 120 requests/hour/tab to **0 requests/hour/tab**.
- **Active Visible Tabs**: Reduced from 120 requests/hour/tab to at most **30 requests/hour/tab** (75% reduction).
- **Hidden Tabs**: Reduced from 120 requests/hour/tab to **0 requests/hour/tab** (100% reduction).
- **Route Navigation**: Eliminated 1–2 redundant `/api/auth/me` requests per page transition.
- **Database Writes**: Proportionally eliminated ~75% to 100% of frequent `lastActiveAt` write queries to PostgreSQL.

## 29. Remaining Risks

- **Multi-Tab Clock Drift**: In rare cases where client system clock changes abruptly, throttle calculations rely on `Date.now()`. Bounded by `Math.max(0, ...)`.
- **Very Long Single-Page Active Sessions**: Users typing continuously for hours without navigating will issue a heartbeat every 2 minutes, keeping their session active as intended.

## 30. Deferred Slice 3B / 3C Work

- **Slice 3B**: Social & presence polling traffic optimization (counts, messages, rooms, and whiteboard).
- **Slice 3C**: Admin portal polling (health monitor, accounting panel queries, and debounced search).
