# GovStudyX — Performance Hardening
# Slice 5D: Selected Large Client Component Optimization — Discovery & Target Selection

**Document Version**: 1.1.0 (Human Target Selection Correction Pass)
**Date**: 2026-09-07
**Repository Worktree**: `C:\Users\Administrator\govstudyx-performance-5a`
**Branch**: `performance/server-client-boundaries`
**Baseline HEAD**: `11567830e7fb2145607dbdb1fc51458fbf22aeee`
**Baseline Commit Message**: `perf: optimize global shell and provider boundaries`
**Current Authorized Slice**: `PHASE_5D` (Discovery & Target Selection ONLY — No Implementation)
**Implementation Status**: DISCOVERY COMPLETE — Human Target Selection Approved — Awaiting Implementation Authorization

---

## 1. Executive Summary

Phase 5D executes the **Client Component Optimization Discovery and Target Selection Audit** for GovStudyX. Following the successful completion of Phase 5A (Discovery), Phase 5B (Landing Page Decomposition), and Phase 5C (Global Shell / Provider Scope Optimization), this audit evaluates the remaining Client Component surface across `src/app` and `src/components`.

The governing directive for Phase 5D is:
> **Find the best next large Client Component optimization opportunity by balancing Performance Opportunity against Regression Risk — not merely by picking the largest file.**

An automated regex scan across `src/app` and `src/components` identified **171 Client Components** declaring `"use client"`. Deep source inspection was conducted on the top 15 largest candidates, including all mandatory seed targets: Admin Accounting, Mock Exam Take, Admin Referrals, Partner Dashboard, and Study Rooms.

### Key Audit & Human Decision Findings:
1. **High-Risk Overrides**: The largest components in the codebase—`Admin Accounting` (1,990 lines), `Mock Exam Take` (1,217 lines), `Admin Referrals` (1,090 lines), `Partner Dashboard` (900 lines), and `StudyRoomsSection` (853 lines)—all manage safety-critical, authoritative domains (financial ledgers, payout approvals, active exam timers, offline synchronization, or LiveKit realtime room state). They receive mandatory **HIGH-RISK OVERRIDES** and are explicitly deferred.
2. **Duplicate Auth Observation**: In `src/components/social/StudyRoomsSection.tsx`, lines 42–50 independently issue an uncoordinated `fetch("/api/auth/me")` on mount to retrieve `currentUserId` instead of consuming `useAuth()` from `AuthContext`. This observation is formally recorded; per discovery rules, it is not modified in this slice.
3. **Human Target Selection Override — Primary Target**: Following independent human architectural review of the locked source, **`src/app/admin/page.tsx`** (Admin Control Dashboard Hub — 474 lines, 27.3 KB) is approved as the **PRIMARY IMPLEMENTATION TARGET**.
   - **Why Selected**: Approximately 85% of the page consists of static administrative navigation cards across 3 operational hubs. It has ZERO mutations, zero form inputs, zero payment authority, zero exam logic, zero realtime logic, zero storage, and zero page-level auth or router hooks.
   - **Crucial Architectural Safety Factor**: Server-side authentication and `ADMIN` role enforcement are **ALREADY SERVER-OWNED** in `src/app/admin/layout.tsx`. Converting `admin/page.tsx` to a Server Component requires zero auth migration or redesign.
   - **Opportunity Score**: 60.0 / 100
   - **Risk Score**: 2.0 / 100
   - **Target Value**: +58.0
   - **Confidence**: HIGH
4. **Secondary Target (Backup)**: **`src/app/profile/page.tsx`** (User Account & Preferences — 558 lines, 25.5 KB) is reclassified as the **SECONDARY / BACKUP TARGET**. While offering substantial static copy (~55%), human architectural review determined that its numeric risk score understates the behavioral coupling of `useAuth()`, unauthenticated client redirection to `/login`, auth-driven display-name initialization, and `refreshAuth("profile")`. It requires dedicated auth-boundary design before implementation.
   - **Opportunity Score**: 74.3 / 100
   - **Risk Score (Heuristic)**: 12.0 / 100
   - **Target Value**: +62.3
   - **Confidence**: HIGH for opportunity, MEDIUM for immediate boundary implementation.
5. **Absolute Discovery Confinement**: Zero runtime source files were modified, zero components were extracted, zero Client Component boundaries were altered, and no commits or pushes were performed.

---

## 2. Starting Git State

Before discovery began, repository integrity was verified:

```powershell
Set-Location "C:\Users\Administrator\govstudyx-performance-5a"
Get-Location
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status
git log -5 --oneline --decorate
```

### Verified Git Record:
- **Worktree**: `C:\Users\Administrator\govstudyx-performance-5a`
- **Git Root**: `C:/Users/Administrator/govstudyx-performance-5a`
- **Branch**: `performance/server-client-boundaries`
- **Starting HEAD**: `11567830e7fb2145607dbdb1fc51458fbf22aeee`
- **Commit Subject**: `perf: optimize global shell and provider boundaries`
- **Working Tree**: Clean (0 modified, 0 staged, 0 untracked).

---

## 3. Locked Phase 5C Checkpoint

The starting baseline incorporates all verified Phase 5 milestones:
- `1dde2b0`: `docs: complete phase 5 server client boundary discovery` (Phase 5A)
- `5245c99`: `docs: correct phase 5 flashcard eligibility baseline` (Phase 5A correction)
- `366238b`: `perf: decompose landing page server client boundaries` (Phase 5B)
- `1156783`: `perf: optimize global shell and provider boundaries` (Phase 5C)

The global shell architecture locked at `1156783` is:
```text
RootLayout [Server]
└── <body>
    ├── <ThemeProvider>                      [Client]
    │   └── <AuthProvider>                   [Client]
    │       ├── <Navbar />                   [Client]
    │       └── <main>{children}</main>
    ├── <FooterVisibility>                   [Client]
    │   └── <Footer />                       [Server]
    └── <CookieConsent />                    [Client]
```

---

## 4. Phase 5D Discovery Scope

Phase 5D is strictly limited to:
- Scanning the repository for all Client Component modules.
- Collecting structural metrics (lines, bytes, hooks, browser APIs, endpoints).
- Deeply inspecting the top 15 candidate components.
- Classifying opportunities across performance benefits versus regression risks.
- Ranking candidates and identifying clear extraction seams.
- Formulating a primary and secondary target proposal based on human review.
- Stopping for human review before any implementation is authorized.

---

## 5. Methodology

The audit methodology followed five rigorous phases:
1. **Automated Surface Inventory**: PowerShell script iterating over all `.tsx` files in `src/app` and `src/components`, checking for `"use client"` within the first 10 lines of the module.
2. **Structural Metric Collection**: In-memory regex parsing for hook occurrences (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`), router hooks (`useRouter`, `usePathname`, `useSearchParams`), auth hooks (`useAuth`, `/api/auth/me`), storage APIs (`localStorage`, `sessionStorage`), timers (`setInterval`, `setTimeout`), and API endpoint strings.
3. **Deep Source Inspection**: Manual full-file read-only review of the top 15 largest candidates to evaluate actual semantic behavior, state coupling, and component seams beyond heuristic regex counts.
4. **Scoring & Risk Weighting**: Applying standardized 7-dimension Performance Opportunity (0–35 scaled to 100) and 10-dimension Regression Risk (0–50 scaled to 100) models, with mandatory overrides for financial, exam, and realtime authority.
5. **Human Architecture Override**: Reordering finalists to select `src/app/admin/page.tsx` as Primary based on externalized server authentication in `AdminLayout` and zero mutation/form risk.

---

## 6. Client Component Inventory Method

The inventory scan was executed via PowerShell across `src/app` and `src/components`:
- Filter: `*.tsx`
- Inclusion criteria: Top 10 lines of module contain `/["']use client["']/`
- Literal path handling: `-LiteralPath` used to safely navigate Next.js dynamic route brackets (e.g. `[code]`, `[id]`)
- Total `.tsx` files evaluated: 250+
- Total Client Components identified: **171**
- Total `page.tsx` route files: **84** (67 Client pages, 17 Server pages)

---

## 7. Complete Large-Client Candidate Table

| Rank | Path | Bytes | LOC | Primary Client Reason | useState | useEffect | Fetch Count | Timers | Browser APIs | Auth Dep | Fin Dep | Exam Dep | Realtime | Static JSX | Isolation | Opp (100) | Risk (100) | Target Value | Confidence | Disposition |
| :---: | :--- | :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| 1 | `src/app/admin/accounting/page.tsx` | 99,452 | 1,990 | 11 tabs, payout modals, ledger | 42 | 1 | 15 | 0 | Yes | No | **CRITICAL** | None | None | Moderate | Complex | 65.7 | **52.0** | +13.7 | HIGH | DEFER — HIGH REGRESSION RISK |
| 2 | `src/app/mock-exam/take/page.tsx` | 53,949 | 1,217 | Active exam timer, offline sync | 22 | 6 | 6 | 2 | Yes | No | None | **CRITICAL** | None | Low | High-Coupled | 57.1 | **64.0** | -6.9 | HIGH | DEFER — HIGH REGRESSION RISK |
| 3 | `src/app/admin/referrals/page.tsx` | 50,071 | 1,090 | Referral payouts, search debounce | 28 | 4 | 7 | 1 | Yes | No | **HIGH** | None | None | Moderate | Complex | 62.9 | **46.0** | +16.9 | HIGH | DEFER — HIGH REGRESSION RISK |
| 4 | `src/app/partner/dashboard/page.tsx` | 44,717 | 900 | Partner payout modal, idempotency | 19 | 1 | 4 | 0 | Yes | No | **HIGH** | None | None | Moderate | Complex | 65.7 | **48.0** | +17.7 | HIGH | DEFER — HIGH REGRESSION RISK |
| 5 | `src/components/social/StudyRoomsSection.tsx` | 37,326 | 853 | LiveKit stage, room chat, polling | 21 | 3 | 12 | 1 | Yes | **DUP ME** | None | None | **HIGH** | Low | High-Coupled | 68.6 | **50.0** | +18.6 | HIGH | DEFER — HIGH REGRESSION RISK |
| 6 | `src/app/referrals/page.tsx` | 34,964 | 737 | User payout modal, idempotency | 15 | 1 | 2 | 1 | Yes | No | **HIGH** | None | None | Moderate | Moderate | 57.1 | **44.0** | +13.1 | HIGH | DEFER — HIGH REGRESSION RISK |
| 7 | `src/app/partner-portal/payouts/page.tsx` | 34,358 | 754 | Payout request form, methods | 25 | 1 | 6 | 0 | Yes | No | **HIGH** | None | None | Moderate | Complex | 57.1 | **46.0** | +11.1 | HIGH | DEFER — HIGH REGRESSION RISK |
| 8 | `src/app/admin/questions/page.tsx` | 31,122 | 685 | Bulk upload, edit modal, sudo | 19 | 1 | 2 | 0 | Yes | Sudo | None | **HIGH** | None | Low | Moderate | 60.0 | **42.0** | +18.0 | HIGH | DEFER — HIGH REGRESSION RISK |
| 9 | `src/app/admin/trash/page.tsx` | 27,226 | 655 | Phase 4 content trash, purge | 10 | 1 | 7 | 0 | Yes | No | None | **HIGH** | None | Low | Moderate | 54.3 | **44.0** | +10.3 | HIGH | DEFER — HIGH REGRESSION RISK |
| 10 | `src/app/dashboard/page.tsx` | 27,223 | 613 | PayMongo verify, score chart | 10 | 2 | 6 | 0 | Yes | Yes | **HIGH** | Low | None | Moderate | Complex | 71.4 | **46.0** | +25.4 | HIGH | PROMISING — NEEDS MORE DISCOVERY |
| 11 | `src/app/admin/page.tsx` | 27,281 | 474 | 3 operational hubs, 16 nav cards | 2 | 1 | 2 | 0 | No | No | None | None | None | **VERY HIGH** | **Clean Seam** | 60.0 | **2.0** | **+58.0** | HIGH | **RECOMMENDED PRIMARY TARGET (HUMAN APPROVED)** |
| 12 | `src/app/profile/page.tsx` | 25,551 | 558 | Account form, FAQs, About, Terms | 9 | 1 | 1 | 0 | No | Yes | None | None | None | **HIGH** | Moderate | 74.3 | **12.0** | **+62.3** | HIGH | **RECOMMENDED SECONDARY / BACKUP TARGET (AUTH DESIGN REQUIRED)** |
| 13 | `src/app/admin/health/page.tsx` | 25,420 | 593 | Live polling telemetry (15s/5s) | 10 | 2 | 5 | 2 | Yes | No | None | None | None | Low | Moderate | 51.4 | **38.0** | +13.4 | HIGH | DEFER — HIGH POLLING / TELEMETRY |
| 14 | `src/app/partner-portal/dashboard/page.tsx` | 25,269 | 509 | Partner overview, media kit | 7 | 1 | 1 | 0 | Yes | Session | Low | None | None | Moderate | Moderate | 48.6 | **30.0** | +18.6 | MEDIUM | PROMISING — NEEDS MORE DISCOVERY |
| 15 | `src/app/admin/backups/page.tsx` | 21,398 | 486 | Database backup restore vault | 9 | 1 | 6 | 0 | Yes | No | None | None | None | Low | Complex | 48.6 | **48.0** | +0.6 | HIGH | DEFER — HIGH REGRESSION RISK |

---

## 8. Top 15 Client Components by Current Source Size

1. `src/app/admin/accounting/page.tsx`: 99,452 bytes (1,990 LOC)
2. `src/app/mock-exam/take/page.tsx`: 53,949 bytes (1,217 LOC)
3. `src/app/admin/referrals/page.tsx`: 50,071 bytes (1,090 LOC)
4. `src/app/partner/dashboard/page.tsx`: 44,717 bytes (900 LOC)
5. `src/components/social/StudyRoomsSection.tsx`: 37,326 bytes (853 LOC)
6. `src/app/referrals/page.tsx`: 34,964 bytes (737 LOC)
7. `src/app/partner-portal/payouts/page.tsx`: 34,358 bytes (754 LOC)
8. `src/app/admin/questions/page.tsx`: 31,122 bytes (685 LOC)
9. `src/app/admin/trash/page.tsx`: 27,226 bytes (655 LOC)
10. `src/app/admin/page.tsx`: 27,281 bytes (474 LOC)
11. `src/app/dashboard/page.tsx`: 27,223 bytes (613 LOC)
12. `src/app/profile/page.tsx`: 25,551 bytes (558 LOC)
13. `src/app/admin/health/page.tsx`: 25,420 bytes (593 LOC)
14. `src/app/partner-portal/dashboard/page.tsx`: 25,269 bytes (509 LOC)
15. `src/app/admin/backups/page.tsx`: 21,398 bytes (486 LOC)

---

## 9. Hook & Browser API Density

- **Highest Hook Density**: `Admin Accounting` (42 `useState`, 7 `useCallback`), `Admin Referrals` (28 `useState`, 4 `useCallback`), `Partner Payouts` (25 `useState`).
- **Highest Timer Density**: `Admin Health` (2 `setInterval` timers for telemetry at 15s and 5s), `Mock Exam Take` (countdown timer and auto-save timers), `StudyRoomsSection` (4-second polling timer).
- **Lowest Hook Density in Large Components**: `src/app/admin/page.tsx` (only 2 `useState`, 1 `useEffect`), `src/app/profile/page.tsx` (9 `useState`, 1 `useEffect`).

---

## 10. API Ownership Matrix

| Candidate | Endpoint Families Called | Method | Polling / Frequency |
| :--- | :--- | :---: | :--- |
| `admin/accounting` | `/api/admin/accounting/*` (overview, ledger, drilldown, partners, payouts, taxes, deductions, settings, statements) | GET, POST, PUT, PATCH | None (on-demand / tab switch) |
| `mock-exam/take` | `/api/questions`, `/api/bookmarks`, `/api/exam/start`, `/api/exam/submit` | GET, POST | Offline sync queue; local tick |
| `admin/referrals` | `/api/admin/referrals/*` (analytics, list, payouts, settings) | GET, POST, PATCH | Search debounced (300ms) |
| `partner/dashboard`| `/api/partner/portal/overview`, `/api/partner/portal/transactions`, `/api/partner/portal/payout` | GET, POST | On-demand fetch |
| `StudyRoomsSection`| `/api/auth/me`, `/api/social/rooms`, `/api/social/rooms/[id]/chat`, `/api/social/rooms/join`, `/api/social/rooms/[id]/leave` | GET, POST, DELETE | Active room chat polled every 4,000ms |
| `referrals` | `/api/referral/me`, `/api/referral/payout` | GET, POST | On-demand fetch |
| `dashboard` | `/api/user/analytics/detailed`, `/api/analytics/dashboard`, `/api/pricing`, `/api/paymongo/verify`, `/api/paymongo/checkout` | GET, POST | On mount / query param check |
| `admin/page.tsx` | `/api/admin/stats`, `/api/admin/backups` | GET | On mount (Promise.all) |
| `profile/page.tsx` | `/api/user/profile` | PUT | On form submit only |

---

## 11. Mutation Density Matrix

- **CRITICAL**: `Admin Accounting` (approves payouts, executes refunds, configures deductions/taxes), `Mock Exam Take` (submits exams, grades items).
- **HIGH**: `Admin Referrals` (approves referral rewards), `Partner Dashboard` (submits financial payouts), `Referrals` (submits examinee payouts), `Admin Backups` (initiates DB restore), `Admin Trash` (permanent purge).
- **MEDIUM**: `StudyRoomsSection` (creates rooms, leaves rooms, deletes rooms, sends chat messages), `Dashboard` (launches PayMongo checkout).
- **LOW**: `Profile` (1 single profile update mutation: display name and optional password change).
- **NONE**: `Admin Overview` (`src/app/admin/page.tsx` has zero mutations).

---

## 12. Static JSX Opportunity Assessment

- **VERY HIGH (>80% Static)**: `src/app/admin/page.tsx` (~85% of lines are static administrative navigation cards, titles, and descriptions across 3 category hubs).
- **HIGH (50%–70% Static)**: `src/app/profile/page.tsx` (~55% of lines are static FAQs, customer service banners, About GovStudyX overview, legal policy links, and official disclaimers).
- **MODERATE (30%–50% Static)**: `src/app/admin/accounting/page.tsx`, `src/app/referrals/page.tsx`, `src/app/dashboard/page.tsx`.
- **LOW (<30% Static)**: `src/app/mock-exam/take/page.tsx`, `src/components/social/StudyRoomsSection.tsx`, `src/app/admin/health/page.tsx`.

---

## 13. Server-Conversion Eligibility

Can the page shell become a React Server Component?
- `src/app/admin/page.tsx`: **YES (High Eligibility)**. The page has no URL search parameters, no auth context hooks, and no client-side navigation hooks. The 16 navigation cards can render directly as server JSX.
- `src/app/profile/page.tsx`: **PARTIAL (Requires Auth Design)**. The page shell could theoretically render server-side layout, but client-side `useAuth()`, redirect on unauthenticated, and `refreshAuth("profile")` coupling require careful design before execution.
- `src/app/dashboard/page.tsx`: **NO (Blocked by Payment & Auth)**. Blocked by searchParams payment verification (`?payment=success`), `useAuth()` reactive banner, and interactive widget loading.
- `src/app/mock-exam/take/page.tsx`: **NO (Blocked by Exam Engine)**. Inherently a client-driven SPA state machine managing timer ticks, local storage, and keyboard events.

---

## 14. Client-Island Extraction Eligibility

- **`src/app/admin/page.tsx` Natural Islands**:
  1. `AdminTelemetryStats.tsx` (Client Island — telemetry badge and 4 metric counter cards)
  2. Server-Renderable: Complete 16-card operational hub grid.
- **`src/app/profile/page.tsx` Natural Islands**:
  1. `AccountSettingsForm.tsx` (Client Island — display name, password fields, submit handler)
  2. `ProfileTabNav.tsx` (Client Island — tab switcher buttons)
  3. `ProfileFaqAccordion.tsx` (Client Island — expand/collapse toggle)
  4. Server-Renderable: `AboutPlatformSection.tsx`, `TermsPrivacySection.tsx`.

---

## 15. Lazy-Load Eligibility

Candidates with heavy secondary tabs suitable for future lazy-loading:
- `src/app/profile/page.tsx`: The `Achievements` tab imports `BadgeDisplay.tsx`. The `Faqs`, `About`, and `Terms` tabs are only rendered when clicked.
- `src/app/admin/accounting/page.tsx`: 11 distinct tabs (Ledger, Drilldown, Partners, Payouts, Taxes, Deductions, Settings). Could benefit from `next/dynamic` in a future slice, but deferred due to financial risk.

---

## 16. Heavy Import Assessment

- `src/app/admin/page.tsx`: Imports 18 distinct icons from `lucide-react`. Tree-shakeable, but currently bundled into the client component.
- `src/app/dashboard/page.tsx`: Imports `ScoreAnalyticsChart` via `next/dynamic(..., { ssr: false })` (Recharts).
- `src/components/social/StudyRoomsSection.tsx`: Imports `StudyRoomStage`, which imports LiveKit client libraries.
- `src/app/profile/page.tsx`: Standard Lucide icons, `BadgeDisplay`, zero heavy canvas/chart libraries.

---

## 17. Route Exposure Classification

- **GLOBAL**: `src/components/Footer.tsx`, `src/components/Navbar.tsx` (Closed in Phase 5C).
- **HIGH-FREQUENCY USER ROUTE**:
  - `src/app/dashboard/page.tsx` (Examinee Home)
  - `src/app/profile/page.tsx` (Examinee Account & Settings)
  - `src/app/mock-exam/take/page.tsx` (Active Exam Session)
- **MEDIUM-FREQUENCY USER ROUTE**: `src/app/referrals/page.tsx`, `src/app/social/page.tsx`.
- **ADMIN-ONLY**: `src/app/admin/page.tsx`, `src/app/admin/accounting/page.tsx`, `src/app/admin/referrals/page.tsx`, `src/app/admin/health/page.tsx`.
- **PARTNER-ONLY**: `src/app/partner-portal/dashboard/page.tsx`, `src/app/partner/dashboard/page.tsx`.

---

## 18. Authentication Risk Assessment

- **High Auth Risk**: `src/components/social/StudyRoomsSection.tsx` directly calls `/api/auth/me` on mount outside `AuthContext`.
- **Standard Auth Consumption with Coupling**: `src/app/profile/page.tsx` consumes `useAuth()`. If `unauthenticated`, redirects to `/login`. On profile save, invokes `refreshAuth("profile")`.
- **Zero Auth Dependency at Page Level**: `src/app/admin/page.tsx` has zero client auth hooks. It relies entirely on server-side admin authentication and `ADMIN` role enforcement already implemented in `src/app/admin/layout.tsx`.

---

## 19. Financial Risk Assessment

- **CRITICAL FINANCIAL RISK**: `src/app/admin/accounting/page.tsx` (General ledger, adjustments, tax withholding, partner payout approval).
- **HIGH FINANCIAL RISK**: `src/app/referrals/page.tsx`, `src/app/partner/dashboard/page.tsx`, `src/app/partner-portal/payouts/page.tsx` (Idempotency client keys, GCash/Maya/Bank payout requests).
- **ZERO FINANCIAL RISK**: `src/app/profile/page.tsx`, `src/app/admin/page.tsx`.

---

## 20. Exam Risk Assessment

- **CRITICAL EXAM RISK**: `src/app/mock-exam/take/page.tsx` (Countdown timer, question answer keys, offline sync queue, scoring accuracy).
- **HIGH EXAM RISK**: `src/app/drills/elimination/page.tsx`, `src/app/admin/questions/page.tsx`.
- **ZERO EXAM RISK**: `src/app/profile/page.tsx`, `src/app/admin/page.tsx`.

---

## 21. Realtime & Social Risk Assessment

- **HIGH REALTIME RISK**: `src/components/social/StudyRoomsSection.tsx` (LiveKit WebRTC, chat polling every 4s, presence subscriptions).
- **ZERO REALTIME RISK**: `src/app/profile/page.tsx`, `src/app/admin/page.tsx`.

---

## 22. Browser Storage & Offline Risk

- `Mock Exam Take`: Uses `localStorage` key `cse_active_exam_session` and offline sync indexed queue. High risk of attempt loss if interrupted.
- `Profile`: Uses zero `localStorage` or `sessionStorage` in the page itself.
- `Admin Overview`: Uses zero storage.

---

## 23. Remount & State-Loss Risk

If component boundaries are reorganized:
- `Mock Exam Take`: High risk—remounting resets timer state or causes question re-randomization.
- `StudyRoomsSection`: High risk—remounting disconnects LiveKit room or interrupts chat stream.
- `Profile`: Moderate risk—tab state and unauthenticated redirect timing require care.
- `Admin Overview`: Zero risk—stateless presentation cards and independent telemetry mount.

---

## 24. Serialization Risk

For any proposed Server/Client boundary:
- `Admin Overview`: Props crossing boundary are plain telemetry numbers or zero props (telemetry island fetches internally). 100% JSON-serializable.
- `Profile`: Props crossing boundary are plain strings (`userName`, `userEmail`, `paidUntil`, `isPaid`). 100% JSON-serializable.

---

## 25. Opportunity Scoring Method

Scored 0–5 across 7 criteria:
- **A**: Client surface size (bytes / LOC)
- **B**: Static JSX proportion
- **C**: Isolation quality (cleanliness of extraction seams)
- **D**: Initial-route exposure (user frequency)
- **E**: Heavy import opportunity
- **F**: Client-only code concentration
- **G**: Lazy-load opportunity

$$\text{Opportunity Score} = \frac{\sum (A..G)}{35} \times 100$$

---

## 26. Regression Risk Scoring Method

Scored 0–5 across 10 criteria:
- **A**: Auth/session authority
- **B**: Financial/payment authority
- **C**: Exam/grading authority
- **D**: Realtime/social authority
- **E**: Mutation density
- **F**: Polling/timers/background state
- **G**: Browser-storage/offline dependency
- **H**: Navigation/redirect ownership
- **I**: Cross-component state coupling
- **J**: API contract sensitivity

$$\text{Risk Score} = \frac{\sum (A..J)}{50} \times 100$$

$$\text{Target Value} = \text{Opportunity Score} - \text{Risk Score}$$

---

## 27. Ranked Candidate Scorecard

### Ranked View A: Largest by Raw Source Bytes
1. `src/app/admin/accounting/page.tsx`: 99,452 bytes
2. `src/app/mock-exam/take/page.tsx`: 53,949 bytes
3. `src/app/admin/referrals/page.tsx`: 50,071 bytes
4. `src/app/partner/dashboard/page.tsx`: 44,717 bytes
5. `src/components/social/StudyRoomsSection.tsx`: 37,326 bytes
6. `src/app/referrals/page.tsx`: 34,964 bytes
7. `src/app/partner-portal/payouts/page.tsx`: 34,358 bytes
8. `src/app/admin/questions/page.tsx`: 31,122 bytes
9. `src/app/admin/page.tsx`: 27,281 bytes
10. `src/app/admin/trash/page.tsx`: 27,226 bytes
11. `src/app/dashboard/page.tsx`: 27,223 bytes
12. `src/app/profile/page.tsx`: 25,551 bytes

### Ranked View B: Highest Performance Opportunity Score
1. `src/app/profile/page.tsx`: **74.3 / 100**
2. `src/app/dashboard/page.tsx`: **71.4 / 100**
3. `src/components/social/StudyRoomsSection.tsx`: **68.6 / 100**
4. `src/app/admin/accounting/page.tsx`: **65.7 / 100**
5. `src/app/partner/dashboard/page.tsx`: **65.7 / 100**
6. `src/app/admin/referrals/page.tsx`: **62.9 / 100**
7. `src/app/admin/page.tsx`: **60.0 / 100**
8. `src/app/admin/questions/page.tsx`: **60.0 / 100**
9. `src/app/mock-exam/take/page.tsx`: **57.1 / 100**
10. `src/app/referrals/page.tsx`: **57.1 / 100**

### Ranked View C: Calculated Opportunity-to-Risk Target Value (Raw Mathematical Score)
1. `src/app/profile/page.tsx`: Target Value = **+62.3** (Opp: 74.3, Risk: 12.0)
2. `src/app/admin/page.tsx`: Target Value = **+58.0** (Opp: 60.0, Risk: 2.0)
3. `src/app/dashboard/page.tsx`: Target Value = **+25.4** (Opp: 71.4, Risk: 46.0)
4. `src/components/social/StudyRoomsSection.tsx`: Target Value = **+18.6** (Opp: 68.6, Risk: 50.0)
5. `src/app/partner-portal/dashboard/page.tsx`: Target Value = **+18.6** (Opp: 48.6, Risk: 30.0)
6. `src/app/admin/questions/page.tsx`: Target Value = **+18.0** (Opp: 60.0, Risk: 42.0)
7. `src/app/partner/dashboard/page.tsx`: Target Value = **+17.7** (Opp: 65.7, Risk: 48.0)
8. `src/app/admin/referrals/page.tsx`: Target Value = **+16.9** (Opp: 62.9, Risk: 46.0)
9. `src/app/admin/accounting/page.tsx`: Target Value = **+13.7** (Opp: 65.7, Risk: 52.0)
10. `src/app/referrals/page.tsx`: Target Value = **+13.1** (Opp: 57.1, Risk: 44.0)
11. `src/app/mock-exam/take/page.tsx`: Target Value = **-6.9** (Opp: 57.1, Risk: 64.0)

### Ranked View D: Human-Approved Implementation Order
1. **`src/app/admin/page.tsx`** — **PRIMARY IMPLEMENTATION TARGET**
   *Reason*: Safest clean boundary; server-side admin authorization is already externalized in `AdminLayout`; ~85% static navigation JSX; zero mutations; zero form/payment/exam/realtime coupling.
2. **`src/app/profile/page.tsx`** — **SECONDARY / BACKUP TARGET**
   *Reason*: Strong theoretical opportunity (+62.3 raw), but human architecture review notes that the numeric score understates `AuthContext`, redirect, and `refreshAuth("profile")` coupling. Requires dedicated auth-boundary design before implementation.
3. **All Other High-Risk Targets** — **DEFERRED**
   *Reason*: Critical authority over general ledger, exam timers, offline queue, or LiveKit WebRTC state.

---

## 28. Admin Accounting Assessment

- **Path**: `src/app/admin/accounting/page.tsx`
- **Current Size**: 99,452 bytes, 1,990 LOC
- **Hook Density**: 42 `useState`, 7 `useCallback`, 1 `useEffect`
- **API Families**: 12 distinct `/api/admin/accounting/*` endpoints
- **Financial Authority**: Critical. Modifies ledger balances, executes adjustments, approves partner payouts, configures tax rates and deduction formulas.
- **Audit Conclusion**: DEFER. Refactoring accounting boundaries poses an unacceptable risk of transactional regressions or payout errors.

---

## 29. Mock Exam Take Assessment

- **Path**: `src/app/mock-exam/take/page.tsx`
- **Current Size**: 53,949 bytes, 1,217 LOC
- **Exam Authority**: Critical. Manages active exam timer countdown, offline answer queueing, focus mode anti-cheat, question bookmarking, and test submission.
- **Audit Conclusion**: DEFER. Exam correctness and data preservation take absolute priority over hydration optimization.

---

## 30. Referrals Assessment

- **Path**: `src/app/referrals/page.tsx` (User) & `src/app/admin/referrals/page.tsx` (Admin)
- **Current Size**: 34,964 bytes (737 LOC) & 50,071 bytes (1,090 LOC)
- **Financial Authority**: High. User referrals page owns the GCash/bank payout request form with client-side idempotency keys. Admin referrals page approves payouts.
- **Audit Conclusion**: DEFER. Payout handling is safety-critical.

---

## 31. Partner Dashboard Assessment

- **Path**: `src/app/partner/dashboard/page.tsx` & `src/app/partner-portal/dashboard/page.tsx`
- **Current Size**: 44,717 bytes (900 LOC) & 25,269 bytes (509 LOC)
- **Authority**: High financial payout authority and custom cookie session authentication (`cse_partner_session`).
- **Audit Conclusion**: DEFER.

---

## 32. StudyRoomsSection Assessment

- **Path**: `src/components/social/StudyRoomsSection.tsx`
- **Current Size**: 37,326 bytes, 853 LOC
- **Realtime Authority**: Manages LiveKit rooms, room stage rendering, active room joining/leaving, room deletion, and chat polling every 4,000ms.
- **Duplicate Auth Observation**: Lines 42–50 independently fetch `/api/auth/me` to obtain `currentUserId` instead of using `useAuth()`.
- **Audit Conclusion**: DEFER. Realtime WebRTC and polling complexity creates high regression risk.

---

## 33. Additional Safer Candidates & Admin Assessment

Source inspection of `src/app/admin/page.tsx` confirmed:
- `src/app/admin/page.tsx` currently declares `"use client"` solely because it:
  - uses `useState` for stats
  - uses `useState` for loading
  - uses one `useEffect` on mount
  - GETs `/api/admin/stats`
  - GETs `/api/admin/backups`
  - renders four numeric metrics and the platform-status indicator
- The remainder of the page is overwhelmingly static:
  - Executive command center banner and title
  - Descriptive copy
  - 3 major administrative section headings
  - 16 operational hub navigation `<Link>` cards
  - Lucide presentation icons
- The page has:
  - ZERO mutations
  - ZERO form submissions
  - ZERO payment ownership
  - ZERO exam ownership
  - ZERO realtime ownership
  - ZERO browser storage
  - ZERO auth-context hooks
  - ZERO client router hooks

Furthermore, `src/app/admin/layout.tsx` is **ALREADY a Server Component** and independently enforces admin access via:
```tsx
const user = await getAuthenticatedUser();
if (!user) redirect("/login");
if (user.role !== "ADMIN") redirect("/dashboard");
```
Therefore, converting `src/app/admin/page.tsx` to a Server Component does NOT require moving, reproducing, or changing authentication authority.

---

## 34. Top Five Boundary Sketches

### 1. `src/app/admin/page.tsx` (Approved Primary Boundary):
```text
AdminLayout [Server]
│
│  Existing responsibilities:
│  - authenticate user
│  - require ADMIN role
│  - redirect unauthorized users
│  - provide SudoProvider
│
└── AdminDashboardHub [Server]
    │
    ├── StaticHeader / command-center title [Server]
    │
    ├── AdminTelemetryStats [Client Island]
    │   ├── GET /api/admin/stats
    │   ├── GET /api/admin/backups
    │   ├── loading state
    │   ├── platform-status indicator
    │   └── four metric cards
    │
    └── Operational Hub Grid [Server]
        ├── System / security links
        ├── recovery links
        ├── academic-management links
        ├── student-service links
        └── remaining static navigation cards
```

### 2. `src/app/profile/page.tsx` (Secondary / Backup Boundary):
```text
ProfilePage [Client / Server Hybrid — Requires Auth Design]
├── <ProfileHeader />
└── <ProfileTabsContainer>
    ├── <AccountSettingsForm />
    ├── <SubscriptionTab />
    ├── <BadgeDisplay />
    ├── <FaqSection />
    ├── <AboutPlatformSection />
    └── <TermsPrivacySection />
```

### 3. `src/app/dashboard/page.tsx` (Deferred Concept):
```text
DashboardPage [Client Component - Retained for Payment Callback Safety]
├── <ResumeExamBanner />
├── <CSCCountdownWidget />
├── <CSCDailyQuestionWidget />
└── <ScoreAnalyticsChart /> (dynamic ssr:false)
```

### 4. `src/app/mock-exam/results/page.tsx` (Deferred Concept):
```text
ExamResultsPage [Client Component]
├── <DiagnosticScoreCard />
└── <QuestionReview mode="REVIEW" />
```

### 5. `src/app/admin/accounting/page.tsx` (Deferred Concept):
```text
AdminAccountingPage [Client Shell]
└── Dynamic Tab Imports (next/dynamic)
```

---

## 35. Primary Target Recommendation

```text
PRIMARY TARGET — HUMAN APPROVED FOR NEXT IMPLEMENTATION PROMPT

Path:
src/app/admin/page.tsx

Current ownership:
Client Component ("use client")

Why currently client:
Two telemetry state values and one mount effect fetching:
- /api/admin/stats
- /api/admin/backups

Why selected:
- Approximately 85% static presentation and navigation markup
- ZERO mutations
- No page-level auth hook
- No router hook
- No browser storage
- No payment authority
- No exam authority
- No realtime authority
- Server AdminLayout already owns authentication and ADMIN authorization
- Extremely clean telemetry island boundary seam
- Simple rollback

Proposed future boundary:
Admin page becomes Server Component.
AdminTelemetryStats remains Client Component.

Requests remain client-owned:
- /api/admin/stats
- /api/admin/backups

Opportunity Score:
60 / 100

Risk Score:
2 / 100

Target Value:
+58

Confidence:
HIGH

Human architecture decision:
PRIMARY

Exact bundle saving:
NOT MEASURED

Implementation authorized in this discovery correction:
NO
```

---

## 36. Secondary Target Recommendation

```text
SECONDARY TARGET — BACKUP ONLY

Path:
src/app/profile/page.tsx

Opportunity Score:
74.3 / 100

Risk Score:
12.0 / 100 heuristic

Confidence:
HIGH for opportunity,
MEDIUM for immediate boundary implementation

Human architecture note:
HUMAN ARCHITECTURE RISK ADJUSTMENT:
The numeric score understates AuthContext, unauthenticated redirect to /login,
and refreshAuth("profile") coupling.
Requires additional AuthContext / redirect / refreshAuth boundary design before implementation.

Implementation:
NOT AUTHORIZED
```

---

## 37. Explicit Deferred Targets

1. **`src/app/admin/accounting/page.tsx`**: DEFERRED due to critical financial authority, general ledger integrity, and 12 sensitive API endpoints.
2. **`src/app/mock-exam/take/page.tsx`**: DEFERRED due to critical exam engine authority, countdown timer correctness, and offline sync dependencies.
3. **`src/app/admin/referrals/page.tsx`**: DEFERRED due to financial payout approval authority.
4. **`src/app/partner/dashboard/page.tsx` & `partner-portal/payouts`**: DEFERRED due to financial payout requests and idempotency keys.
5. **`src/components/social/StudyRoomsSection.tsx`**: DEFERRED due to LiveKit WebRTC realtime state, chat polling, and duplicate `/api/auth/me` calls.
6. **`src/app/dashboard/page.tsx`**: DEFERRED pending dedicated decoupling of the PayMongo `?payment=success` verification flow.
7. **`src/app/admin/trash/page.tsx`**: DEFERRED due to Phase 4 content integrity protections (soft-delete, restore, purge).
8. **`src/app/admin/questions/page.tsx`**: DEFERRED due to question bank mutation and sudo security context.

---

## 38. Proposed Phase 5D Implementation Scope (Hypothetical)

Proposed files for the future Phase 5D implementation:
```text
MODIFY:
src/app/admin/page.tsx

CREATE:
src/components/admin/AdminTelemetryStats.tsx
docs/performance/SLICE_5D_ADMIN_HUB_SERVER_CLIENT_DECOMPOSITION.md
```

### Telemetry Island Behavior Lock:
Future `AdminTelemetryStats.tsx` must preserve the exact existing behavior:
- Client Component (`"use client"`)
- `initial loading = true`
- On mount:
  ```ts
  Promise.all([
    fetch("/api/admin/stats"),
    fetch("/api/admin/backups")
  ])
  ```
- Stats response behavior unchanged
- Backups response behavior unchanged
- Fallback values unchanged:
  - `totalUsers -> 0`
  - `paidUsers -> 0`
  - `totalQuestions -> 0`
  - `systemHealth -> "HEALTHY"`
  - `backupCount -> 0`
- Console error semantics preserved
- Finally: `loading = false`
- Presentation parity strictly preserved for Platform Status, Total Examinees, PRO Members, Question Bank Items, Active Vault Backups, "Checking...", status text, and all Tailwind classes/icons.

### API Ownership Retention:
For maximum semantic parity, the future implementation will initially **KEEP** these two requests client-owned inside `AdminTelemetryStats`:
- `/api/admin/stats`
- `/api/admin/backups`

Do NOT propose server-fetching these endpoints in the first Phase 5D implementation.
*Reason*: The goal is Client Component boundary narrowing, not data-fetch architecture redesign. This keeps request timing, loading behavior, API authorization behavior, and error handling unchanged.

### Admin Layout Protection:
Future implementation must **NOT** modify `src/app/admin/layout.tsx`. The existing server authentication and `ADMIN` role enforcement is already correct and protected.

---

## 39. Proposed Primary No-Touch Zone

Future Admin Hub implementation must protect:
- `src/app/admin/layout.tsx`
- `src/context/AuthContext.tsx`
- `src/context/ThemeContext.tsx`
- `src/context/SudoContext.tsx`
- `src/app/api/**`
- `src/app/admin/accounting/**`
- `src/app/admin/referrals/**`
- `src/app/admin/questions/**`
- `src/app/admin/trash/**`
- `src/app/admin/backups/**`
- `src/app/admin/health/**`
- `src/app/admin/pricing/**`
- `src/app/admin/system/**`
- `src/app/profile/page.tsx`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/components/Navbar.tsx`
- `src/components/Footer.tsx`
- `src/components/FooterVisibility.tsx`
- `src/components/common/CookieConsent.tsx`
- `src/components/landing/**`
- `src/lib/contentEligibility.ts`
- `src/components/question/QuestionReview.tsx`
- `prisma/**`
- `package.json`
- `package-lock.json`

---

## 40. Proposed Primary Validation Matrix

Future validation checks for Admin Hub implementation:
1. Admin route still redirects unauthenticated users to `/login`.
2. Non-admin user still redirects to `/dashboard`.
3. Admin user can access `/admin`.
4. `SudoProvider` behavior remains unchanged.
5. All operational navigation cards remain present.
6. All href destinations remain identical.
7. All copy remains identical.
8. All Lucide icons remain visually identical.
9. Platform Status retains loading and final state.
10. Total Examinees retains current behavior.
11. PRO Members retains current behavior.
12. Question Bank Items retains current behavior.
13. Active Vault Backups retains current behavior.
14. Exactly one `/api/admin/stats` request on initial telemetry mount.
15. Exactly one `/api/admin/backups` request on initial telemetry mount.
16. No new auth request.
17. No new polling.
18. No new timers.
19. No hydration warnings.
20. Responsive design parity.
21. Dark-mode parity.
22. `npx tsc --noEmit` PASS.
23. `npm run build` PASS.
24. Exact file-scope PASS.
25. `git diff --check` PASS.

---

## 41. Rollback Conditions

If a future implementation deviates from expected behavior:
```powershell
git checkout -- src/app/admin/page.tsx
Remove-Item -Force src/components/admin/AdminTelemetryStats.tsx
Remove-Item -Force docs/performance/SLICE_5D_ADMIN_HUB_SERVER_CLIENT_DECOMPOSITION.md
```

---

## 42. Exact Performance Metrics Status

In accordance with Section 71 of the Master Prompt:
- **Exact bundle-byte reduction**: `NOT MEASURED`
- **Exact load-time delta**: `NOT MEASURED`
- **Exact hydration-time delta**: `NOT MEASURED`

*Note: Formal benchmarking will be captured in Phase 5E.*

---

## 43. Risks & Unknowns

1. Ensuring static `<Link>` components and Lucide icons in `src/app/admin/page.tsx` render identically without hydration mismatches.
2. Preserving exact loading animation pulses on telemetry badges while data resolves.

---

## 44. Human Decision Required

The human reviewer has made the decision:
- **Approved Primary Target**: `src/app/admin/page.tsx` (Admin Control Dashboard Hub)
- **Approved Secondary / Backup Target**: `src/app/profile/page.tsx` (User Account & Preferences)

---

## 45. Final Recommendation

```text
PHASE 5D DISCOVERY:
COMPLETE

HUMAN-APPROVED PRIMARY TARGET:
src/app/admin/page.tsx

SECONDARY / BACKUP:
src/app/profile/page.tsx

RUNTIME IMPLEMENTATION:
NOT STARTED

NEXT STEP:
Checkpoint the corrected discovery document,
then prepare a separate Phase 5D Admin Hub implementation prompt.
```

---
*End of Discovery Document — GovStudyX Performance Hardening Slice 5D*
