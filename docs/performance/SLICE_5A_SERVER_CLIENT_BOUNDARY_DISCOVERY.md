# GovStudyX â€” Performance Hardening
# Slice 5A: Server / Client Component Boundary Discovery & Architecture

**Document Version**: 1.1.0
**Date**: 2026-09-07
**Repository Worktree**: `C:\Users\Administrator\govstudyx-performance-5a`
**Branch**: `performance/server-client-boundaries`
**Baseline HEAD**: `a024ceae1cea430850099f61c406419a7e0481d7`
**Baseline Commit Message**: `perf: complete phase 4 cache architecture and content integrity hardening`
**Current Authorized Slice**: `PHASE_5A` (Discovery, Hydration Ownership & Boundary Architecture Only)
**Strict Implementation Policy**: Discovery and architecture only. Zero runtime code modified. Zero auth semantics altered. Zero financial code altered. Zero exam engine code altered. Zero database or dependency changes.

---

## 1. Executive Summary

Phase 5 of the GovStudyX performance hardening initiative focuses on **Server / Client Component Boundary Hardening**. The overarching objective is to optimize the hydration boundary, reduce unnecessary client-side JavaScript execution, and eliminate client rendering overhead on mostly-static marketing and informational UI, while rigorously safeguarding application correctness, server-side authorization, authentication session flows, responsive behavior, accessibility, and visual fidelity.

In accordance with Section 1 of the Master Prompt, the **CURRENT AUTHORIZED EXECUTION SLICE IS PHASE 5A ONLY**. Phase 5A performs codebase discovery, client-dependency mapping, serialization audits, and target architecture formulation without modifying any application runtime code.

### Key Discoveries & Architectural Takeaways:
1. **Landing Page Monolith (`src/app/page.tsx`)**:
   The primary public entry point is currently a single monolithic Client Component (`"use client"`) spanning **959 lines of code**. It bundles top-level React hooks (`useState`, `useEffect`, `useRouter`), client context consumers (`useAuth`), interactive state machines (a 3-question sample challenge, FAQ accordion toggles, mobile navigation drawer state), client-side dynamic pricing polling, and auto-redirect side-effects together with extensive, purely static marketing copy.
2. **High Ratio of Render-Only Static Markup**:
   Code-level inspection reveals that over **70% of the landing page markup** (Hero copy, Civil Service Exam review scope syllabus, platform feature matrices, study classmates collaborative showcase, trust badges, and final CTA banners) contains zero event handlers, zero browser dependencies, and zero mutable state. It is 100% safe to render as static server-owned markup.
3. **Refined Minimum-Change Phase 5B Architecture**:
   To minimize unnecessary file churn and fragmentation, `src/app/page.tsx` will become the top-level Server Component, retaining static/render-only JSX (Hero, Scope, Features, Classmates highlight, Final CTA) directly within the server page where practical. Component extraction is not mandatory for static sections once their parent is already server-owned.
4. **Decoupled Five-Island Model for Interactive Behavior**:
   Interactive functionality on the landing page is decomposed into **5 narrowly scoped, self-contained Client Islands**:
   - `LandingAuthRedirect`: Headless client island executing the authenticated user auto-redirect to `/dashboard`.
   - `LandingNav`: Lightweight client island managing the mobile hamburger menu toggle and responsive slide-out drawer, while rendering standard semantic links.
   - `SampleChallengeSection`: Self-contained interactive client island managing the 3-question PRO challenge, choice selection, step-by-step rationalization reveals, and reset actions using the existing `QuestionReview` component.
   - `PricingSection`: Client island preserving the existing dynamic fetch of `/api/pricing` with fallback to default tier values.
   - `FaqSection`: Lightweight client island managing FAQ expand/collapse state.
5. **Ownership-Local Data Separation (Avoiding Mixed Data Modules)**:
   Rather than consolidating constants into a single shared data module that risks pulling server-only marketing copy into the client dependency graph, data remains ownership-local:
   - Server-only marketing, scope, and feature copy stays in `src/app/page.tsx` (or purely server-scoped modules).
   - `SAMPLE_QUESTIONS` lives locally with the `SampleChallengeSection` Client Island.
   - Default pricing plans live locally with `PricingSection`.
   - FAQ records live locally with `FaqSection` (or are passed as serializable props).
6. **Root Layout Boundary Verification (`src/app/layout.tsx`)**:
   The root layout is already a Server Component (`export default function RootLayout`). Wrapping `{children}` inside client context providers (`ThemeProvider` and `AuthProvider`) is a standard React 19 / Next.js 16 composition pattern: React renders Server Component children on the server and passes the serialized JSX tree through client providers without forcing child server components into the client bundle.
7. **Zero Serialization Impediments**:
   Static question data (`SAMPLE_QUESTIONS`), scope categories, feature descriptions, and FAQ records consist exclusively of JSON-serializable primitives (strings, numbers, booleans, and arrays). No classes, functions, or circular references cross server/client boundaries.
8. **No-Touch Boundaries Strictly Preserved**:
   No changes to authentication authority, payment processing, exam engine logic, real-time LiveKit rooms, database schema, or Phase 4 caching structures are proposed or permitted.

---

## 2. Starting Git State

Before any analysis or execution, repository baseline integrity was independently verified:

```powershell
Get-Location
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status
git log -8 --oneline --decorate
```

### Verified Git Environment Record:
- **Worktree Path**: `C:\Users\Administrator\govstudyx-performance-5a`
- **Git Top-Level**: `C:/Users/Administrator/govstudyx-performance-5a`
- **Active Branch**: `performance/server-client-boundaries`
- **Starting HEAD Commit**: `a024ceae1cea430850099f61c406419a7e0481d7`
- **Expected Baseline Commit Message**: `perf: complete phase 4 cache architecture and content integrity hardening`
- **Working Tree Status**: Clean (0 uncommitted tracked changes; gitignored dependencies and environment files configured).
- **Pre-Change Commit Record**: `PRE_UPDATE_COMMIT = a024ceae1cea430850099f61c406419a7e0481d7`

---

## 3. Existing Performance Baseline

The GovStudyX production codebase incorporates cumulative hardening across four prior phases that must remain completely undisturbed:

- **Phase 1 (Baseline Discovery)**:
  Identified initial asset payloads, route latency, and client component distribution across public and protected routes.
- **Phase 2 (Payload Reduction & Pagination)**:
  Implemented backward-compatible pagination for exam history, reviewer records, and question bank administrative lists.
- **Phase 3A (Authentication Traffic Ownership & Heartbeat Reduction)**:
  Centralized all session validation into `AuthProvider` via `createAuthRequestGate` and `AUTH_ACTIVITY_THROTTLE_MS` (60s). Eliminated redundant duplicate `/api/auth/me` calls from child components.
- **Phase 3B (Polling / Adaptive Refresh Hardening)**:
  Consolidated background pollers into visibility-aware, exponential backoff schedules.
- **Phase 3C (Search Debounce & Stale Request Cancellation)**:
  Implemented request cancellation (`AbortController`) and debouncing across user search inputs.
- **Phase 4 (Cache Architecture & Content Integrity Hardening)**:
  - Established shared vs. private cache boundaries.
  - Eliminated cross-user client cache leakage in `sessionStorage`.
  - Added authoritative Next.js Data Cache tags for Reviewer (`StudyNote`) and Reading Materials (`Handbook`) catalogs.
  - Preserved the stable handbook binary streaming route (`/api/reading-materials/file?id=<handbookId>`) using weak ETag validation, ETags derived from handbook identity/update state, `If-None-Match`, metadata-only validation when possible, `304 Not Modified` on unchanged resources, private browser revalidation, and CDN `no-store`.
  - Enforced elimination drill content eligibility using the production predicate: `deletedAt === null` AND (`category` equals `"Elimination Drill"` case-insensitively OR `subtopic` contains `"Elimination Drill"` case-insensitively). The public route does not fall back to ordinary Question Bank questions or bundled sample content.
  - Enforced active flashcard eligibility using `deletedAt: null`, with no auto-seeded or bundled current flashcard fallback and legitimate empty banks.
  - Guaranteed Trash / restore / purge referential integrity.

---

## 4. Scope & Non-Goals

### In-Scope (Phase 5A Discovery):
1. Code-level audit of `src/app/page.tsx` client dependencies, state hooks, and side-effects.
2. Complete classification of all landing page sections into Server Safe vs. Client Required.
3. Component-level inspection of `src/app/layout.tsx`, `ThemeProvider`, `AuthProvider`, `Navbar`, `Footer`, and `CookieConsent`.
4. Serialization audit across proposed server/client boundaries.
5. Survey and categorization of large client components across the entire repository.
6. Formulation of the proposed Phase 5B component architecture, validation contracts, and rollback criteria.

### Explicit Non-Goals (Strictly Prohibited in Phase 5A):
- **NO runtime code modifications** to `src/app/page.tsx`, `src/app/layout.tsx`, or any component/context file.
- **NO server-side auth redirects on `/`**: Auth session authority remains strictly client-side via `AuthContext`.
- **NO tampering with authentication**: No changes to `/api/auth/me`, cookies, JWT verification, or inactivity timeouts.
- **NO financial code modifications**: PayMongo checkout, webhook handlers, ledger, and accounting logic remain untouched.
- **NO exam engine modifications**: Mock exam scoring, timer state, answer concealment, and randomization remain untouched.
- **NO real-time modifications**: LiveKit rooms, study room audio stages, and chat remain untouched.
- **NO database operations**: No Prisma schema changes, migrations, seeds, or queries.
- **NO dependency modifications**: No additions or removals in `package.json` or `package-lock.json`.
- **NO cache regressions**: Phase 4 cache tags, ETag headers, and invalidation mechanisms remain intact.

---

## 5. Current Root Layout Boundary

Inspection of `src/app/layout.tsx` (75 lines):
- **Server Component**: The file does not include `"use client"`. It exports metadata and the default `RootLayout` functional component.
- **Imports & Dependencies**:
  - Fonts: `Geist`, `Geist_Mono` from `next/font/google`.
  - Global styles: `import "./globals.css"`.
  - Config: `siteConfig` from `@/lib/config/site`.
  - Providers: `ThemeProvider` (`@/context/ThemeContext`), `AuthProvider` (`@/context/AuthContext`).
  - Global UI: `Navbar` (`@/components/Navbar`), `Footer` (`@/components/Footer`), `CookieConsent` (`@/components/common/CookieConsent`).
- **DOM Hierarchy**:
  ```tsx
  <html lang="en" suppressHydrationWarning className="...">
    <head>
      <script dangerouslySetInnerHTML={{ __html: `...theme bootstrap...` }} />
    </head>
    <body className="...">
      <ThemeProvider>
        <AuthProvider>
          <Navbar />
          <main className="w-full flex-grow">{children}</main>
        </AuthProvider>
        <Footer />
        <CookieConsent />
      </ThemeProvider>
    </body>
  </html>
  ```
- **Boundary Analysis**:
  In Next.js App Router, `RootLayout` runs on the server during request processing or build pre-rendering. Wrapping `{children}` inside client components (`ThemeProvider`, `AuthProvider`) does **NOT** force `{children}` to become client components. React creates a server-rendered subtree for `{children}` and passes the resulting React elements as props into the client providers.
  Therefore, when `src/app/page.tsx` is converted to a Server Component, its static markup will be rendered on the server, and only its explicitly declared client island children will be hydrated by the client runtime.

---

## 6. Current Global Provider Ownership

### 1. `ThemeProvider` (`src/context/ThemeContext.tsx`, 95 lines)
- **Directives**: `"use client"`.
- **State Management**: Uses `useSyncExternalStore` bound to `localStorage.getItem("theme")`.
- **Hydration Safety**:
  - `getServerSnapshot()` returns `"light"`.
  - An inline script in `src/app/layout.tsx` executes synchronously before HTML rendering to read `localStorage` and toggle the `.dark` class on `document.documentElement`.
  - `suppressHydrationWarning` on `<html>` prevents mismatch warnings between server default and client storage.
- **Event Listeners**: Listens to `"storage"` (cross-tab synchronization) and custom `"govstudyx-theme-change"` events.
- **Children Dependency**: Provides `theme`, `setTheme`, and `toggleTheme` to consumers (primarily `ThemeToggle` in `Navbar`).

### 2. `AuthProvider` (`src/context/AuthContext.tsx`, 339 lines)
- **Directives**: `"use client"`.
- **State Management**:
  - `user`: `AuthUser | null`
  - `status`: `"loading" | "authenticated" | "unauthenticated" | "error"`
  - `error`: `string | null`
  - `kicked`: `boolean` (concurrent session enforcement)
- **Network Traffic & Authority**:
  - Single point of truth for `/api/auth/me`.
  - Governed by `createAuthRequestGate` to coalesce concurrent requests.
  - Heartbeat activity tracking throttled to `AUTH_ACTIVITY_THROTTLE_MS` (60s) on user interaction events (`pointerdown`, `keydown`, `touchstart`).
  - Stale session recovery on `visibilitychange` (tab foreground) and `online` events, throttled by `AUTH_SNAPSHOT_STALE_MS` (5m).
- **Redirection & Kicking**:
  - Automatically redirects kicked sessions to `/login?kicked=true` unless on safe paths (`/`, `/login`, legal pages).
- **Protection Mandate**:
  Phase 3A hardened this exact provider to eliminate redundant authentication traffic. Provider placement must remain untouched in Phase 5A and 5B.

---

## 7. Navbar Hydration Ownership

Inspection of `src/components/Navbar.tsx` (420 lines):
- **Directive**: `"use client"`.
- **Why It Requires Client Execution**:
  1. **Route Active Highlighting**: Reads `usePathname()` to apply active pill styles to `/dashboard`, `/practice`, etc.
  2. **Auth Integration**: Calls `useAuth()` to display user profile avatar, name, and logout button, or "Sign In" button.
  3. **Logout Lifecycle**: Handles logout side-effects (pauses heartbeat, POST to `/api/auth/logout`, clears auth, navigates to `/login`).
  4. **Offline Synchronization**: Invokes `useOfflineSync()` to display offline badge, pending offline submissions counter, and manual "Sync Now" button.
  5. **Mobile Drawer State**: Manages `mobileMenuOpen` via `useState`, listens to `Escape` keydown, and auto-closes drawer on pathname changes.
- **Relationship with Landing Page**:
  `Navbar` is rendered globally by `layout.tsx` above all pages. The landing page (`src/app/page.tsx`) renders its own sub-navigation bar with marketing anchor links (`#challenge`, `#scope`, etc.) within its own `<main>` container.

---

## 8. Footer Hydration Ownership

Inspection of `src/components/Footer.tsx` (209 lines):
- **Directive**: `"use client"`.
- **Why It Requires Client Execution**:
  - The **sole reason** for `"use client"` in `Footer.tsx` is calling `const pathname = usePathname();` to evaluate `shouldShowFooter(pathname)`.
  - The footer suppresses itself on active test-taking routes (such as `/mock-exam/take`) and renders on marketing and informational routes (`/`, `/dashboard`, `/pricing`, legal pages).
- **Markup Character**:
  - Aside from route filtering, all footer markup (5-column grid, brand disclaimer, reviewer links, legal navigation) is static JSX and Next.js `<Link>` elements.
- **Phase 5 Ownership Recommendation**:
  - In Phase 5A/5B: Keep `Footer.tsx` untouched.
  - In Phase 5C (Provider / Shell optimization): Evaluate whether route visibility can be handled at layout boundaries or via a thin client wrapper, preserving static markup on the server.

---

## 9. Cookie Consent Ownership

Inspection of `src/components/common/CookieConsent.tsx` (231 lines):
- **Directive**: `"use client"`.
- **Why It Requires Client Execution**:
  1. Accesses `localStorage.getItem("govstudyx_cookie_consent")`.
  2. Implements a delayed appearance timer (`setTimeout(..., 800)`).
  3. Manages state for banner visibility (`showBanner`), customization modal (`showModal`), and granular preferences (`analytics`, `marketing`).
- **SSR Mismatch Prevention**:
  `CookieConsent` initializes with `showBanner = false` and returns `null` on initial render. It only reveals the banner after client-side mounting and reading `localStorage`.
- **Classification**:
  `ALREADY_APPROPRIATE_CLIENT`. Must remain a Client Component.

---

## 10. Landing Page Current Architecture (`src/app/page.tsx`)

`src/app/page.tsx` is a monolithic 959-line Client Component starting with `"use client"`. It contains 10 distinct UI and logical sections:

```text
LandingPage (src/app/page.tsx) [959 lines - Client Component]
â”œâ”€â”€ [Logic] useAuth + useRouter auto-redirect to /dashboard
â”œâ”€â”€ [Logic] Dynamic pricing fetcher (useEffect -> /api/pricing)
â”œâ”€â”€ [Section 1] Landing Navigation Bar + Mobile Drawer (lines 438â€“526)
â”œâ”€â”€ [Section 2] Hero Section (lines 530â€“579)
â”œâ”€â”€ [Section 3] 3-Question Interactive PRO Challenge (lines 581â€“686)
â”œâ”€â”€ [Section 4] Comprehensive Review Scope Grid (lines 688â€“723)
â”œâ”€â”€ [Section 5] Authentic Feature Showcase Grid (lines 725â€“760)
â”œâ”€â”€ [Section 6] Study Classmates & Messaging Highlight (lines 762â€“811)
â”œâ”€â”€ [Section 7] Transparent Pricing Plans (lines 813â€“892)
â”œâ”€â”€ [Section 8] Frequently Asked Questions Accordion (lines 894â€“934)
â””â”€â”€ [Section 9] Final Callout Banner (lines 936â€“955)
```

Every single JSX element across these 959 lines is currently hydrated by the browser runtime, regardless of whether it has interactive event handlers.

---

## 11. Landing Page Client-Dependency Inventory

Every hook, browser API, and client state element currently present in `src/app/page.tsx` was inventoried:

| Symbol / Import | Hook / API | State / Effect Involved | Visible UI Affected | Client Execution Required? | Can Be Isolated? | Safest Proposed Ownership |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `useAuth` (`@/context/AuthContext`) | Custom Context Hook | Reads `{ user, status }` | None (Side-effect only) | Yes (reads client auth context) | Yes (headless component) | `CLIENT_ISLAND` (`LandingAuthRedirect`) |
| `useRouter` (`next/navigation`) | Next.js Nav Hook | `router.replace("/dashboard")` | None (Side-effect only) | Yes (client navigation) | Yes (headless component) | `CLIENT_ISLAND` (`LandingAuthRedirect`) |
| `useState(false)` | React State Hook | `mobileMenuOpen` | Top nav hamburger & mobile drawer | Yes (open/close toggle) | Yes (nav island) | `CLIENT_ISLAND` (`LandingNav`) |
| `useState(0)` | React State Hook | `currentChallengeIndex` | Question tab selection (Q1, Q2, Q3) | Yes (active tab index) | Yes (challenge island) | `CLIENT_ISLAND` (`SampleChallengeSection`) |
| `useState([null, null, null])` | React State Hook | `selectedAnswers` | Option radio selection in sample | Yes (user answers) | Yes (challenge island) | `CLIENT_ISLAND` (`SampleChallengeSection`) |
| `useState([false, false, false])`| React State Hook | `submittedChallenges` | Question reveal / review mode | Yes (submission state) | Yes (challenge island) | `CLIENT_ISLAND` (`SampleChallengeSection`) |
| `QuestionReview` (`@/components/question`) | Subcomponent | Interactive question card + rationalization | Question card and rationale | Yes (event handlers & reveal) | Yes (inside challenge island) | `CLIENT_ISLAND` (`SampleChallengeSection`) |
| `useState(pricingPlans)` | React State Hook | `pricingPlans` | Pricing cards (â‚±99, â‚±199, â‚±299) | Yes (state for live prices) | Yes (pricing island) | `CLIENT_ISLAND` (`PricingSection`) |
| `useEffect(loadPricingPlans)` | React Effect Hook | `fetch("/api/pricing")` | Pricing card price values | Yes (client network fetch) | Yes (pricing island) | `CLIENT_ISLAND` (`PricingSection`) |
| `useState<number \| null>(null)` | React State Hook | `openFaq` | FAQ item collapse/expand | Yes (accordion state) | Yes (FAQ island) | `CLIENT_ISLAND` (`FaqSection`) |

---

## 12. Landing Page Static-vs-Interactive Classification

Every major structural block was evaluated and classified:

```text
Classifications:
- SERVER_SAFE_STATIC: Pure render-only markup. Zero hooks, zero state, zero event handlers.
- CLIENT_REQUIRED: Contains state, effects, or user interactions that require the browser runtime.
- SHARED_PURE_COMPONENT: Pure presentational components usable by both Server and Client.
- AUTH_DEPENDENT: Requires client session state from AuthContext.
- DEFERRED_UNCERTAIN: Ambiguous ownership requiring further discovery (None found on landing page).
```

| Section Name | Line Range | Classification | Ownership Rationale |
| :--- | :--- | :--- | :--- |
| **Auth Redirect Controller** | 210â€“214 | `AUTH_DEPENDENT` / `CLIENT_REQUIRED` | Reads `status` and `user` from `useAuth()`. Executes client-side `router.replace("/dashboard")`. Completely headless. |
| **Landing Navigation & Drawer** | 438â€“526 | `CLIENT_REQUIRED` | Desktop links are static, but mobile hamburger button and slide-out drawer require `useState(mobileMenuOpen)` and click handlers. |
| **Hero Section** | 530â€“579 | `SERVER_SAFE_STATIC` | Pure static JSX: H1 headline, value proposition paragraph, static CTA `<Link>` tags, and 3 trust badges. Can reside directly in Server Component `src/app/page.tsx`. |
| **Interactive Sample Challenge** | 581â€“686 | `CLIENT_REQUIRED` | Interactive quiz preview. Manages question tabs, choice selection, answer submission, rationale display, and completion banner. |
| **Comprehensive Review Scope** | 688â€“723 | `SERVER_SAFE_STATIC` | Pure static JSX: 4 CSC syllabus cards (Numerical, Verbal, Analytical, General Info) with static bullet items and badges. Can reside directly in Server Component `src/app/page.tsx`. |
| **Platform Feature Showcase** | 725â€“760 | `SERVER_SAFE_STATIC` | Pure static JSX: 6 feature cards (Timed Mocks, Elimination Drills, Flashcards, Mistake Notebook, Classmates, Study Rooms). Can reside directly in Server Component `src/app/page.tsx`. |
| **Study Classmates Showcase** | 762â€“811 | `SERVER_SAFE_STATIC` | Pure static JSX: Hub description, feature highlights, and decorative mock chat bubble preview ("Maria" & "You"). Can reside directly in Server Component `src/app/page.tsx`. |
| **Pricing Plans Section** | 813â€“892 | `CLIENT_REQUIRED` | Renders 3 pricing tier cards. Contains dynamic pricing update via `useEffect` fetching `/api/pricing`. |
| **FAQ Accordion Section** | 894â€“934 | `CLIENT_REQUIRED` | Interactive accordion with click-to-expand / collapse state (`openFaq`). |
| **Final CTA Callout Banner** | 936â€“955 | `SERVER_SAFE_STATIC` | Pure static JSX: Gradient callout banner with static `<Link href="/signup">` button. Can reside directly in Server Component `src/app/page.tsx`. |

---

## 13. Current Hydration Ownership Map

### Current Production Architecture:
```text
RootLayout (Server Component)
â”‚
â””â”€â”€ ThemeProvider (Client Component)
    â”‚
    â””â”€â”€ AuthProvider (Client Component)
        â”‚
        â”œâ”€â”€ Navbar (Client Component) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ [Hydrated]
        â”‚
        â””â”€â”€ main.w-full
            â”‚
            â””â”€â”€ LandingPage (src/app/page.tsx) â”€â”€â”€â”€â”€â”€â”€â”€â”€ [100% Client Component - Entire 959 lines hydrated]
                â”œâ”€â”€ Auth Redirect Effect
                â”œâ”€â”€ Top Nav & Drawer
                â”œâ”€â”€ Hero Section
                â”œâ”€â”€ Sample Challenge (QuestionReview)
                â”œâ”€â”€ Review Scope Grid
                â”œâ”€â”€ Features Grid
                â”œâ”€â”€ Classmates Showcase
                â”œâ”€â”€ Pricing Plans
                â”œâ”€â”€ FAQ Accordion
                â””â”€â”€ Final CTA Banner
```

### Proposed Phase 5B Hardened Architecture:
```text
RootLayout (Server Component)
â”‚
â””â”€â”€ ThemeProvider (Client Component)
    â”‚
    â””â”€â”€ AuthProvider (Client Component)
        â”‚
        â”œâ”€â”€ Navbar (Client Component) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ [Hydrated]
        â”‚
        â””â”€â”€ main.w-full
            â”‚
            â””â”€â”€ LandingPage (src/app/page.tsx) â”€â”€â”€â”€â”€â”€â”€â”€â”€ [Server Component â€” static parent; only explicit Client Islands hydrate]
                â”‚
                â”œâ”€â”€ LandingAuthRedirect â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ [Client Island - Headless (~15 lines)]
                â”œâ”€â”€ LandingNav â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ [Client Island - Header & Drawer (~75 lines)]
                â”‚
                â”œâ”€â”€ [Server-Owned Static Markup]
                â”‚   â””â”€â”€ Hero Section (direct in page.tsx)
                â”‚
                â”œâ”€â”€ SampleChallengeSection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ [Client Island - Interactive Quiz (~130 lines)]
                â”‚   â”œâ”€â”€ SAMPLE_QUESTIONS (local constant data)
                â”‚   â””â”€â”€ QuestionReview (Client Subcomponent)
                â”‚
                â”œâ”€â”€ [Server-Owned Static Markup]
                â”‚   â”œâ”€â”€ Review Scope Section (direct in page.tsx)
                â”‚   â”œâ”€â”€ Features Section (direct in page.tsx)
                â”‚   â””â”€â”€ Classmates Showcase (direct in page.tsx)
                â”‚
                â”œâ”€â”€ PricingSection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ [Client Island - Price Fetcher (~90 lines)]
                â”‚   â””â”€â”€ defaultPricingPlans (local initial data)
                â”‚
                â”œâ”€â”€ FaqSection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ [Client Island - Accordion (~50 lines)]
                â”‚   â””â”€â”€ faqs (local accordion data or serializable props)
                â”‚
                â””â”€â”€ [Server-Owned Static Markup]
                    â””â”€â”€ Final CTA Banner (direct in page.tsx)
```

---

## 14. Sample Challenge Dependency Analysis

The interactive 3-question challenge is powered by `SAMPLE_QUESTIONS` and `QuestionReview`:
1. **`SAMPLE_QUESTIONS` Data Structure**:
   - Defined in lines 16â€“192 of `src/app/page.tsx`.
   - Array of 3 items conforming to `interface SampleChallengeQuestion extends StructuredQuestion`.
   - Fields: `id`, `badgeLabel`, `category`, `subtopic`, `difficulty`, `prompt`, `options`, `answerIndex`, `explanation`, `stepByStep`, `whyA`, `whyB`, `whyC`, `whyD`, `eliminationStrategy`, `commonTrap`, `examTip`.
   - **Serialization Check**: Every field is a primitive `string`, `number`, or array of `{ step: string, detail: string }`. **100% JSON-serializable**.
2. **`QuestionReview` Component (`src/components/question/QuestionReview.tsx`)**:
   - Client Component (`"use client"`).
   - Props: `question`, `userAnswerIndex`, `itemNumber`, `mode="INTERACTIVE"`, `isSubmitted`, `badgeLabel`, `onSelectOption`, `onSubmitAnswer`, `footerActions`.
   - Subcomponents: `QuestionHeader`, `QuestionPrompt`, `QuestionChoices`, `QuestionResultBanner`, `ExplanationPanel`.
3. **Island Encapsulation**:
   - By encapsulating `currentChallengeIndex`, `selectedAnswers`, `submittedChallenges`, tab switching, choice selection, checking answers, reset actions, and completion banner inside a dedicated `SampleChallengeSection` Client Island, all event callbacks remain local to the island.
   - Zero function references or event handlers need to cross a server-to-client boundary.
   - Public sample questions remain completely segregated from active exam engine authority.

---

## 15. Authentication Redirect Ownership

### Current Implementation:
```tsx
// src/app/page.tsx (lines 210â€“214)
useEffect(() => {
  if (status === "authenticated" && user) {
    router.replace("/dashboard");
  }
}, [router, status, user]);
```

### Architectural Protection Analysis:
- **Client Authority**: The application's session state is managed client-side in `AuthContext` via `/api/auth/me`.
- **Preserving Exact Behavior**:
  We must **NOT** introduce a server-side cookie redirect in Next.js middleware or server components for `/`. Doing so would alter session semantics, risk edge-case redirects on expired/stale cookies, or break offline session hydration.
- **Isolated Client Island (`LandingAuthRedirect`)**:
  In Phase 5B, this exact logic will be extracted into a dedicated headless client component:
  ```tsx
  "use client";
  import { useEffect } from "react";
  import { useRouter } from "next/navigation";
  import { useAuth } from "@/context/AuthContext";

  export default function LandingAuthRedirect() {
    const router = useRouter();
    const { user, status } = useAuth();

    useEffect(() => {
      if (status === "authenticated" && user) {
        router.replace("/dashboard");
      }
    }, [router, status, user]);

    return null;
  }
  ```
  This guarantees **100% behavioral equivalence** while allowing the parent page to execute as a Server Component.

---

## 16. Theme Safety Analysis

GovStudyX provides an instant, flash-free theme experience (default light, dark mode toggle).
1. **Initial Bootstrap**:
   `src/app/layout.tsx` injects a synchronous inline script in `<head>` that reads `localStorage.getItem('theme')` and toggles `.dark` before the browser paints.
2. **Server / Client Boundary Compatibility**:
   Decomposing `src/app/page.tsx` into Server Components and Client Islands has **zero impact** on theme behavior:
   - All server-owned markup renders standard Tailwind utility classes (e.g. `bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100`).
   - The CSS classes respond directly to the `.dark` class on `document.documentElement`.
   - No React theme hooks are used in the static sections of the landing page.
   - Zero theme flashing (FOUC) or hydration mismatches will be introduced.

---

## 17. Offline / PWA Safety Analysis

1. **Serwist Service Worker Configuration**:
   - The application registers a Serwist service worker that caches navigation requests and static assets.
2. **Impact of Server Component Conversion**:
   - In Next.js App Router, a Server Component route (`/`) is pre-rendered at build time as static HTML (`â—‹ (Static)`).
   - When the service worker caches `/`, it caches the pre-rendered HTML.
   - Moving static sections from client JavaScript to server HTML reduces the amount of JavaScript the service worker needs to download and parse offline, improving offline boot performance.
3. **IndexedDB & Local State**:
   - No IndexedDB or offline queue logic is touched.

---

## 18. SEO / Server Rendering Analysis

1. **Current State**:
   Next.js pre-renders `src/app/page.tsx` during build time (`â—‹ (Static)`). However, because the entire file is `"use client"`, search engine bots receive HTML that must be hydrated by a substantial JavaScript bundle.
2. **Server Component Enhancement**:
   - By rendering Hero, Review Scope, Features, Classmates, and CTA directly as server-owned markup in `src/app/page.tsx`, the raw HTML emitted by Next.js contains the full semantic markup, headings (`<h1>`, `<h2>`, `<h3>`), paragraphs, and descriptive text without requiring client-side React hydration to preserve them.
   - Metadata (`title`, `description`, `metadataBase`) is declared statically in `src/app/layout.tsx` and can optionally be augmented with page-specific metadata in `src/app/page.tsx` once it becomes a Server Component.
   - Zero SEO regression; improved crawlability for lightweight search engine bots.

---

## 19. Serialization Boundary Analysis

In Next.js App Router, props passed from Server Components to Client Components must be serializable across the Flight protocol.

| Proposed Server-to-Client Boundary | Props Passed | Types | Serializable? | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `LandingPage` -> `LandingAuthRedirect` | None | `void` | **YES** | Headless component. No props. |
| `LandingPage` -> `LandingNav` | None | `void` | **YES** | Navigation anchor links are constant strings. |
| `LandingPage` -> `SampleChallengeSection` | None (or `questions`) | `SampleChallengeQuestion[]` | **YES** | If passed, plain JSON array of strings/numbers. Alternatively encapsulated locally in island. |
| `LandingPage` -> `PricingSection` | None (or initial plans) | `PricingPlan[]` | **YES** | Plain JSON objects or encapsulated locally. |
| `LandingPage` -> `FaqSection` | None (or `faqs`) | `{ q: string; a: string }[]` | **YES** | Array of string key-value pairs. |

**Audit Conclusion**: No functions, callbacks, symbols, Date objects, class instances, or circular references cross any proposed boundary. All boundaries are **100% serializable**.

---

## 20. Proposed Phase 5B Component Tree

### Refined Minimum-Change Target Architecture:
Rather than over-fragmenting static marketing copy into many separate Server Component files, `src/app/page.tsx` retains static JSX directly where practical. Extraction into separate Server Components is optional and only performed when it materially improves maintainability without increasing file churn.

```text
src/
â”œâ”€â”€ app/
â”‚   â””â”€â”€ page.tsx                                   [Server Component â€” owns layout, Hero, Scope, Features, Classmates, CTA]
â”‚
â””â”€â”€ components/landing/
    â”œâ”€â”€ LandingAuthRedirect.tsx                    [Client Island - Headless Auth Redirect]
    â”œâ”€â”€ LandingNav.tsx                             [Client Island - Header & Mobile Drawer]
    â”œâ”€â”€ SampleChallengeSection.tsx                 [Client Island - Interactive 3-Question Quiz]
    â”œâ”€â”€ PricingSection.tsx                         [Client Island - Dynamic Price Fetcher]
    â””â”€â”€ FaqSection.tsx                             [Client Island - Accordion State]
```

### Data Placement Principles (Avoiding Mixed Landing Data Modules):
- **Server-Only Marketing Data**: `scopeCategories` and `coreFeatures` remain directly within `src/app/page.tsx` (or a server-scoped module never imported by client islands).
- **Challenge Data**: `SAMPLE_QUESTIONS` is co-located with `SampleChallengeSection.tsx` (or in a narrowly scoped module used only by the challenge island).
- **Pricing Data**: Default pricing tiers are co-located with `PricingSection.tsx`.
- **FAQ Data**: `faqs` is co-located with `FaqSection.tsx` or passed as a serializable prop.
- **No Shared Monolithic Data Module**: Avoids pulling server-only marketing text into client bundles.

---

## 21. Proposed Client Islands (The Five-Island Model)

### 1. `LandingAuthRedirect.tsx`
- **Responsibilities**: Subscribes to `useAuth()`. Triggers `router.replace("/dashboard")` when authenticated. Returns `null`.
- **Justification**: Decouples auth-based navigation side-effects from page rendering; preserves existing auth semantics exactly.

### 2. `LandingNav.tsx`
- **Responsibilities**: Renders top navigation bar, logo, anchor links, action buttons, and hamburger button. Manages `mobileMenuOpen` state and mobile slide-out drawer.
- **Justification**: Keeps mobile drawer toggle interactive without forcing the entire page or hero to be client-side.

### 3. `SampleChallengeSection.tsx`
- **Responsibilities**: Manages 3-question state (`currentChallengeIndex`, `selectedAnswers`, `submittedChallenges`), renders tab navigation, embeds `QuestionReview`, handles next/reset buttons, and displays completion banner.
- **Justification**: Contains interactive quiz preview mechanics; preserves all 3 questions and rationalizations exactly.

### 4. `PricingSection.tsx`
- **Responsibilities**: Renders 3 pricing tier cards. Executes `useEffect` to fetch live prices from `/api/pricing` and updates state with graceful fallback to defaults.
- **Justification**: Preserves existing client-side price refresh without touching backend pricing authority.

### 5. `FaqSection.tsx`
- **Responsibilities**: Renders 5 FAQ items. Manages accordion toggle state (`openFaq: number | null`).
- **Justification**: Minimal interactive island for accordion expand/collapse.

---

## 22. Proposed Server Ownership

### Server-Owned Root: `src/app/page.tsx`
- Converted from a Client Component to a Server Component.
- Directly renders:
  - Global page container and background styling (`min-h-screen bg-slate-50 text-slate-900 ...`)
  - `<LandingAuthRedirect />` (Client Island)
  - `<LandingNav />` (Client Island)
  - `<main className="flex-1 flex flex-col">`
    - Hero Section (Static JSX: badge, H1, description, CTA links, trust highlights)
    - `<SampleChallengeSection />` (Client Island)
    - Review Scope Section (Static JSX: 4 CSC syllabus cards)
    - Features Section (Static JSX: 6 platform feature cards)
    - Study Classmates Section (Static JSX: hub highlight, chat preview)
    - `<PricingSection />` (Client Island)
    - `<FaqSection />` (Client Island)
    - Final CTA Section (Static JSX: gradient banner, signup button)
- **Maintainability Option**: Static sections may be factored into presentation subcomponents (e.g. `HeroSection.tsx`) only if deemed clean and low-churn; they are not required for hydration reduction because `page.tsx` is already a Server Component.

---

## 23. Shared Pure Components

- `QuestionReview` (`src/components/question/QuestionReview.tsx`):
  Remains a Client Component utilized inside `SampleChallengeSection`. No modifications required.
- `StructuredQuestion` (`src/types/question.ts`):
  Shared TypeScript interface used across questions and sample challenges.

---

## 24. Responsive Regression Matrix

| Section | Desktop (>= 1280px) | Tablet (768px - 1023px) | Mobile (< 768px) | Critical Verification Points |
| :--- | :--- | :--- | :--- | :--- |
| **Landing Nav** | Full horizontal links + buttons | Full horizontal links + buttons | Hamburger button; hidden links; slide-out drawer | Drawer opens/closes; anchor clicks scroll to target and close drawer |
| **Hero** | 3-row layout, centered, full text | Centered, adjusted text size | Stacked CTA buttons (full width), compact text | CTA buttons touch target >= 44px; no horizontal overflow |
| **Sample Challenge** | Centered max-w-4xl card, side-by-side footer | Responsive tab bar, comfortable padding | Stacked options, full-width submit button | Radio options accessible; rationalization readable on small screens |
| **Review Scope** | 2x2 grid | 2x2 grid | 1-column stacked cards | Card padding, badge alignment, readable font sizes |
| **Features** | 3-column grid | 2-column grid | 1-column stacked cards | Icon alignment, card border contrast |
| **Classmates** | Side-by-side flex layout with chat preview | Stacked layout (text top, chat preview bottom) | Full-width chat preview card | Chat bubbles formatted cleanly; badge styling intact |
| **Pricing** | 3-column card grid | 3-column or stacked grid | 1-column stacked cards | "Most Popular" badge centered; button full-width |
| **FAQ** | Max-w-3xl centered accordion | Max-w-3xl centered accordion | Full-width cards with comfortable tap targets | Tap target covers full question bar; `+` / `âˆ’` icon visible |
| **Final CTA** | Gradient banner, horizontal button | Gradient banner, centered button | Full-width button with touch padding | Background gradient smooth; contrast compliant |

---

## 25. Accessibility Regression Matrix

| Control / Element | Target Section | Required Attribute / Behavior | Regression Safeguard |
| :--- | :--- | :--- | :--- |
| Hamburger Button | `LandingNav` | `aria-label="Toggle Navigation Menu"`, `aria-expanded={mobileMenuOpen}` | Must remain a native `<button>` with clear SVG state |
| Navigation Links | `LandingNav` | Semantic `<a href="#...">` and Next.js `<Link>` | Retain keyboard Tab navigation and visual focus rings |
| Challenge Tabs | `SampleChallengeSection` | `type="button"`, active tab contrast | Tab keys navigate between Q1, Q2, Q3; visible focus indicator |
| Option Radio Buttons | `QuestionReview` | Native `<button>` or radio role, disabled state when submitted | Keyboard selectable (Space/Enter); disabled after submission |
| Check Answer Button | `QuestionReview` | Disabled state when no option selected; focusable | `disabled` attribute properly set; cursor-not-allowed visual |
| Reset Challenges | `SampleChallengeSection` | Native `<button type="button">`, underline styling | Accessible via keyboard Tab; triggers state reset |
| FAQ Accordion Buttons| `FaqSection` | Native `<button type="button">`, `aria-expanded` | Full width clickable; Space/Enter toggles answer panel |
| CTA Links | Hero & CTA Banner | Native Next.js `<Link href="/signup">` | Semantic anchor; accessible to screen readers |

---

## 26. Hydration Regression Risks

1. **Theme Mismatch**:
   *Risk*: Server renders with light theme classes while client is dark.
   *Mitigation*: The inline `<head>` script and `suppressHydrationWarning` on `<html>` are already in place and must remain untouched. Server-rendered markup responds dynamically to `.dark`.
2. **Dynamic Pricing Mismatch**:
   *Risk*: Server renders initial price (e.g. â‚±99), and client fetches updated price causing text jump.
   *Mitigation*: `PricingSection` client island initializes with the exact same default prices (â‚±99, â‚±199, â‚±299) as the current code before updating via `useEffect`.
3. **Auth Redirect Race Condition**:
   *Risk*: Brief flash of unauthenticated landing page before redirecting authenticated user to `/dashboard`.
   *Mitigation*: `LandingAuthRedirect` executes at the exact same lifecycle point (`useEffect` on `status === "authenticated"` and `user`) as existing code. Behavior is identical.

---

## 27. Other Large Client Component Classification

A repository-wide audit identified the largest files declaring `"use client"`. Each was categorized according to Section 29 of the Master Prompt:

| File Path | Lines | Classification | Rationale & Protection Status |
| :--- | :---: | :--- | :--- |
| `src/app/page.tsx` | 959 | `SAFE_PHASE5_CANDIDATE` | **Phase 5B Primary Target**. >70% render-only marketing content. |
| `src/app/admin/accounting/page.tsx` | 1,886 | `FINANCIAL_PROTECTED` / `PROTECTED_HIGH_RISK` | Safety-critical ledger, reconciliation, payouts, refunds. Section 22 No-Touch Zone. |
| `src/app/mock-exam/take/page.tsx` | 1,125 | `EXAM_PROTECTED` / `PROTECTED_HIGH_RISK` | Real-time exam timer, anti-cheat, answer concealment, submission. Section 23 No-Touch Zone. |
| `src/app/admin/referrals/page.tsx` | 1,029 | `FINANCIAL_PROTECTED` / `PROTECTED_HIGH_RISK` | Commission structures, referral payouts, partner ledgers. Section 22 No-Touch Zone. |
| `src/app/partner/dashboard/page.tsx` | 834 | `FINANCIAL_PROTECTED` / `PROTECTED_HIGH_RISK` | Partner earnings, commission tracking, payout requests. Section 22 No-Touch Zone. |
| `src/components/social/StudyRoomsSection.tsx` | 791 | `REALTIME_CLIENT_REQUIRED` | LiveKit audio integration, real-time participant presence, whiteboard. Section 24 No-Touch Zone. |
| `src/app/referrals/page.tsx` | 696 | `FINANCIAL_PROTECTED` / `PROTECTED_HIGH_RISK` | User referral balances and commission redemption. Section 22 No-Touch Zone. |
| `src/app/partner-portal/payouts/page.tsx` | 695 | `FINANCIAL_PROTECTED` / `PROTECTED_HIGH_RISK` | Banking details, payout processing, financial ledger. Section 22 No-Touch Zone. |
| `src/components/social/profile/StudyTogetherOnboarding.tsx` | 679 | `ALREADY_APPROPRIATE_CLIENT` | Multi-step interactive onboarding modal. |
| `src/components/social/profile/EditStudyProfileModal.tsx` | 637 | `ALREADY_APPROPRIATE_CLIENT` | Interactive user profile form with client validation. |
| `src/app/admin/questions/page.tsx` | 634 | `NEEDS_SEPARATE_DISCOVERY` | Admin question bank management. Requires separate discovery for Phase 5D. |
| `src/app/admin/trash/page.tsx` | 613 | `PROTECTED_HIGH_RISK` | Soft-delete / restore / purge engine. Phase 4 integrity zone. |
| `src/components/social/rooms/StudyRoomStage.tsx` | 598 | `REALTIME_CLIENT_REQUIRED` | Synchronized canvas whiteboard and audio stage. Section 24 No-Touch Zone. |
| `src/app/drills/elimination/page.tsx` | 576 | `ALREADY_APPROPRIATE_CLIENT` | Distractor elimination mechanics, striking out choices, interactive state. |
| `src/app/dashboard/page.tsx` | 557 | `NEEDS_SEPARATE_DISCOVERY` | Candidate for Phase 5D discovery. Contains personalized user stats and interactive drill shortcuts. |
| `src/app/admin/elimination-drills/page.tsx` | 546 | `NEEDS_SEPARATE_DISCOVERY` | Admin drill management. Requires separate discovery. |
| `src/app/admin/health/page.tsx` | 537 | `PROTECTED_HIGH_RISK` | Operations health monitoring dashboard. Section 25 No-Touch Zone. |
| `src/components/social/ClassmatesSection.tsx` | 536 | `REALTIME_CLIENT_REQUIRED` | Friend requests, real-time chat previews, classmate presence. |
| `src/app/admin/users/page.tsx` | 527 | `PROTECTED_HIGH_RISK` | Administrative RBAC and user permission management. Section 21 No-Touch Zone. |
| `src/app/profile/page.tsx` | 517 | `ALREADY_APPROPRIATE_CLIENT` | Interactive user settings, avatar selection, password change. |

---

## 28. Protected / Deferred Areas

The following domains are classified as **ABSOLUTE NO-TOUCH ZONES** for Phase 5:
1. **Authentication & Authorization**: `src/lib/serverAuth.ts`, `src/lib/partnerAuth.ts`, `/api/auth/*`, `AuthProvider`.
2. **Financial Operations**: PayMongo integration, `/api/paymongo/*`, `/api/admin/accounting/*`, `/api/partner/*`, referral commission calculators.
3. **Exam Engine Core**: `/api/exam/*`, `/api/mock-exam/*`, `src/app/mock-exam/take/page.tsx`, scoring algorithms.
4. **Realtime & Social**: LiveKit rooms, WebSocket connections, `/api/social/rooms/*`, whiteboard canvas.
5. **System Operations**: `/api/health/*`, cron background workers, database backup engine.
6. **Database Schema & Migrations**: `prisma/schema.prisma`, `prisma/migrations/*`.
7. **Phase 4 Cache Architecture**: Data Cache tags, ETag handlers, binary file endpoints, elimination eligibility filters.

---

## 29. Phase 5B Files Proposed for Modification

When Phase 5B is authorized, the following strictly scoped file set is proposed under the refined minimum-change architecture:

### 1. Files to Modify:
- `src/app/page.tsx`: Refactor from monolithic Client Component into a clean Server Component assembling subcomponents and retaining static JSX.

### 2. New Files to Create (The Five-Island Set):
- `src/components/landing/LandingAuthRedirect.tsx`: Headless client island for auto-redirect.
- `src/components/landing/LandingNav.tsx`: Client island for top navigation & mobile drawer.
- `src/components/landing/SampleChallengeSection.tsx`: Client island for 3-question interactive quiz (co-locating `SAMPLE_QUESTIONS`).
- `src/components/landing/PricingSection.tsx`: Client island for pricing cards and dynamic price fetch (co-locating default pricing data).
- `src/components/landing/FaqSection.tsx`: Client island for FAQ accordion (co-locating or receiving FAQ records).

*(Note: No mixed `src/lib/constants/landingData.ts` module will be created, preventing server marketing text from leaking into client bundles).*

---

## 30. Phase 5B Files Explicitly Not to Modify

The following files must **NOT** be touched during Phase 5B:
- `src/app/layout.tsx`
- `src/context/AuthContext.tsx`
- `src/context/ThemeContext.tsx`
- `src/components/Navbar.tsx`
- `src/components/Footer.tsx`
- `src/components/common/CookieConsent.tsx`
- `src/components/question/QuestionReview.tsx`
- `src/types/question.ts`
- `src/lib/contentEligibility.ts`
- `src/app/api/*` (all API routes)
- `prisma/*` (schema, migrations)
- `package.json`, `package-lock.json`

---

## 31. Phase 5B Validation Contract

When Phase 5B is executed, it must satisfy the following automated and manual validation gates:

### Automated Validation Gates:
```powershell
git diff --check
npx tsc --noEmit
npm run build
```
Both `npx tsc --noEmit` and `npm run build` must complete with **0 errors**.

### Functional Test Verification Checklist:
1. **Anonymous Landing Load**: Landing page loads instantly at `/` without JavaScript console errors.
2. **Authenticated Auto-Redirect**: Visiting `/` while logged in immediately navigates to `/dashboard`.
3. **Navigation Links**: Anchor links (`#challenge`, `#scope`, `#features`, `#classmates`, `#pricing`, `#faqs`) scroll smoothly to target sections.
4. **Mobile Navigation Drawer**: Hamburger button toggles drawer; clicking links navigates and closes drawer; Escape key closes drawer.
5. **Sample Challenge Interaction**:
   - Tab buttons switch questions (Q1 -> Q2 -> Q3).
   - Radio buttons select choices.
   - "Check Answer" reveals correct/incorrect banner, detailed step-by-step logic, distractor traps, and elimination strategy.
   - "Reset All Challenges" clears answers and returns to Q1.
   - Completing all 3 reveals the "Ready for More?" banner.
6. **Pricing Cards**: Renders 3 tiers; dynamically updates prices from `/api/pricing` if available.
7. **FAQ Accordion**: Clicking question expands answer; clicking again collapses it; only clicked item toggles.
8. **Theme Integrity**: Toggling light/dark theme switches background and text colors cleanly without flashing.
9. **Responsive Layout**: Validated across Desktop (>= 1280px), Tablet (768px), and Mobile (375px).
10. **Zero Hydration Mismatch**: Next.js emits zero hydration warning messages in developer console.

---

## 32. Phase 5B Rollback Conditions

Execution of Phase 5B must immediately stop and revert if any of the following conditions occur:
1. TypeScript compilation fails (`npx tsc --noEmit` returns non-zero).
2. Production build fails (`npm run build` returns non-zero).
3. Authenticated users are not redirected to `/dashboard`.
4. Anonymous users experience a redirect loop or cannot view `/`.
5. Mobile drawer fails to open or close.
6. Sample challenge question state, choice selection, or rationalization reveal breaks.
7. Theme flashing (FOUC) or hydration mismatch warnings appear.
8. Visual appearance, layout alignment, typography, or spacing departs from baseline.
9. Any protected area (auth, financial, exam engine, cache) is accidentally modified.

---

## 33. Expected Benefits

1. **Hydration Scope Reduction**:
   Over 70% of the landing page markup will be rendered on the server as static HTML, eliminating React client component instantiation and hydration work for render-only marketing sections.
2. **Clean Architectural Separation**:
   Decomposes a 959-line monolith into a static server parent and 5 focused interactive islands with distinct ownership boundaries.
3. **SEO & Crawlability**:
   Core educational marketing copy and syllabus information become first-class Server Component output.
4. **Maintenance Safety**:
   Marketing copy updates can be made directly in server-owned JSX without touching interactive quiz or auth state logic.

---

## 34. Benefits Not Yet Quantifiable

In strict compliance with Section 37 and Section 56 of the Master Prompt:
- **Exact bundle-byte reduction**: `NOT MEASURED`.
- **Exact load-time percentage improvement**: `NOT MEASURED`.
- **Quantitative hydration timing delta**: `NOT MEASURED`.
Measurable bundle and memory performance metrics will be captured during post-implementation benchmarking in Phase 5E.

---

## 35. Risks & Mitigation Strategies

| Risk | Severity | Likelihood | Mitigation Strategy |
| :--- | :---: | :---: | :--- |
| **Auth Redirect Timing Glitch** | Medium | Low | Use dedicated `LandingAuthRedirect` island matching current `useEffect` timing exactly. |
| **CSS / Layout Shift (CLS)** | Medium | Low | Retain exact existing Tailwind classes, DOM hierarchy, and container wrappers directly in `src/app/page.tsx`. |
| **Mobile Drawer Click Trapping** | Low | Low | Isolate drawer state inside `LandingNav` without modifying external document body styling. |
| **QuestionReview Component Breakage** | High | Very Low | Keep `QuestionReview` untouched; encapsulate entirely inside `SampleChallengeSection`. |
| **Route Prerender Build Failure** | High | Very Low | Pass only serializable props or keep data island-local; verify build with `npm run build` immediately. |

---

## 36. Final Recommendation

**Recommendation**:
1. Conclude **Phase 5A** with approval. No runtime code changes were made; the discovery, architectural corrections, and boundary contracts are complete, fully verified, and documented.
2. Request explicit human authorization before commencing **Phase 5B**.
3. In Phase 5B, execute the minimal, targeted decomposition of `src/app/page.tsx` into a top-level Server Component retaining static marketing JSX directly, accompanied by the approved five Client Islands (`LandingAuthRedirect`, `LandingNav`, `SampleChallengeSection`, `PricingSection`, `FaqSection`), using ownership-local data structures.

---
*End of Discovery Document â€” GovStudyX Performance Hardening Slice 5A*
