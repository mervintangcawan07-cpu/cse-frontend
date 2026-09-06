# GovStudyX Performance Baseline Audit

Slice 1 only — 2026-09-06. No implementation.

## 1. Executive Summary
P0 **0**, P1 **5**, P2 **4**, INFO **1**. Top traffic issue: duplicated/polled `/api/auth/me` performs reads and normally a `lastActiveAt` write. Top frontend issue: the mostly-static 967-line landing page is one Client Component. Risk: moderate-high under concurrency. Live CWV/bundle bytes were not measured because no target/DevTools connector was available.

## 2. Git / Repository Baseline
Worktree `C:\Users\Administrator\govstudyx-performance`; branch `performance/traffic-frontend`; HEAD `5474530` (`merge: integrate phase 7 for preview`); initially clean/up to date. Next 16.3.2, React 19.2.4, TypeScript ^5, Prisma 7.9.1, Node v24.19.0, npm 11.17.0. Libraries inspected include LiveKit, Recharts, PapaParse, ExcelJS, idb-keyval, Serwist, Resend and Upstash.

## 3. Validation Baseline
`npm ci`: PASS (known pre-audit baseline; not rerun). `npx tsc --noEmit`: PASS. `npm run build`: PASS (212 page entries). Cookie/dynamic messages reproduced without failure.

## 4. Route Rendering Baseline
Public/client shells including `/`, `/dashboard`, `/social` are static; APIs, parameterized routes, admin tree and `/partner-portal` are dynamic. Static shells still use proxy/API authorization. Never force authenticated data static.

## 5. Traffic Request Inventory
Root Navbar calls auth; dashboard adds Sidebar/page auth, pricing, two analytics, daily, CSC and notifications; social adds auth/profile/counts/section APIs; mock exam calls questions/bookmarks then exam/start; accounting calls eight panel APIs.

## 6. Polling Inventory
Auth 30s (120/hour/tab); social counts 15s with six DB counts (1,440 counts/hour/tab); messages/chat 4s (900/hour); whiteboard 2.5s (1,440/hour); duel 1.5s while active; notifications 60s; admin health five APIs/5s (3,600 requests/hour/tab); maintenance 10s; offline IndexedDB 10s (no network). Timers clean up; visibility guards are inconsistent.

## 7. Request Amplification Findings
100 visible Navbar tabs imply about 12,000 auth HTTP calls and at least 24,000 DB operations/hour. 100 social-count tabs imply 24,000 requests/144,000 count queries. Estimates are capacity signals, not telemetry.

## 8. Pagination Audit
Unbounded/broad: admin questions, exam/mock history, bookmarks, flashcards, reviewer/reading, rooms/participants, accounting partners/applications/payouts. Messages use first ascending 100 without cursor. Ledger/referral/login-history paths have useful bounds.

## 9. Payload Reduction Findings
Questions/exam start, admin questions, exam history, bookmarks, rooms and accounting over-fetch. Exam start pre-sends answer/explanation fields for current client behavior: coordinate with security; never expose more answers.

## 10. Database / N+1 Findings
No pervasive read N+1 found. CSC sync has per-item work; daily attempts aggregate in memory. Tax writes are financial/order-sensitive and must not be parallelized casually. Index ideas require non-production EXPLAIN and separate migration approval.

## 11. API Consolidation Findings
Deduplicate dashboard auth/history; decouple accounting panels rather than create one giant API; event-refresh social counts; add narrow exam category metadata while keeping exam/start authoritative.

## 12. Cache Classification
Shared-safe: reviewer, reading metadata, drills, CSC, static marketing; possibly short-lived display pricing. User-scoped: profile/bookmarks/progress/history/notifications/analytics. Strict-live: auth, entitlement, payments, accounting, payouts, current exam writes.

## 13. Cache Invalidation Findings
Shared headers exist but mutation invalidation/tagging is inconsistent. Client cache always revalidates and lacks in-flight coalescing; CSC adds a timestamp; pricing is no-store. Add resource policies/tags only in Slice 4; checkout must use authoritative price.

## 14. Server/Client Component Inventory
171 source files contain `use client`; many validly need it. Large clients: accounting 1,990 lines; exam take 1,217; referrals 1,006; landing 967; partner dashboard 900; StudyRoomsSection 853. Lines are boundary evidence, not bytes.

## 15. Root Provider Findings
ThemeProvider can accept server children. Navbar globally owns auth/offline timers; Footer hydrates mainly for pathname; Sidebar returns null after auth. Preserve offline/auth behavior.

## 16. Dynamic Import Findings
Recharts chart is correctly dynamic. LiveKit stage is eagerly imported before room entry and is a measured Slice 6 lazy-load candidate. PapaParse is admin-scoped; ExcelJS server-side.

## 17. Image Findings
1024 brand PNG ~1.07MB; 512/app icons ~283KB each; favicon ~123KB. Next Image handles brand display; raw question images lack intrinsic dimensions. Measure/right-size and reserve aspect ratio without quality loss.

## 18. Bundle Findings
No analyzer exists. Measure landing, Navbar idb-keyval, LiveKit and optional admin modules before Slice 6. Do not add dependencies without approval.

## 19. Loading / Suspense / Streaming Findings
Zero `loading.tsx`, six error boundaries; Suspense mainly handles client search params. Add selective boundaries/streaming only after data ownership stabilizes.

## 20. Request Deduplication Findings
Auth and dashboard analytics duplicate reads; client cache/pollers lack coalescing/overlap cancellation. Write idempotency remains separate and unchanged.

## 21. Search/Debounce Findings
Admin referrals can rerun analytics/list/payouts/settings per raw search keypress. Split effects, debounce and cancel stale requests. Inspected user/classmate/club search is submit/local.

## 22. Question Bank Scalability Findings
Mock setup fetches up to 170 full questions mainly for categories, then start fetches again. Routes read broad pools; start parses all history JSON. Add metadata, explicit selects and bounded selection with golden correctness/distribution/scoring/concealment tests.

## 23. Authentication Build-Log Finding
Broad catches in `serverAuth.ts`/`partnerAuth.ts` log Next `DYNAMIC_SERVER_USAGE` from `cookies()` as auth errors. Build passes and routes remain dynamic. A separately approved auth-safe change may rethrow framework control flow per installed Next 16 docs while preserving real auth logs.

## 24. Admin Performance Findings
Health polling, broad accounting effects, unbounded partner commission aggregation, applications/payouts/questions/analytics are material. Use pagination/exact DB aggregates and on-demand exports with golden financial parity.

## 25. External Service Request Findings
Checkout/refund/CSC have controlled timeouts; PayMongo verify and Gemini are inconsistent. Payment changes require separate readiness approval and must preserve finalization/recovery/idempotency. CSC/daily batching is lower risk after fixtures.

## 26. P0 / P1 / P2 / INFO Summary
| ID | Sev | Category | Files/routes | Current evidence and impact | Recommendation | Risk / verification | Slice |
|---|---|---|---|---|---|---|---|
| PERF-001 | P1 | Auth traffic | Navbar, Sidebar, auth/me, dashboard | repeated reads+writes; 120/hour/tab | one owner/controlled heartbeat | high; multi-tab/auth tests | 3 |
| PERF-002 | P1 | Social polling | social counts/messages/rooms | 2.5–15s snapshots; DB writes/counts | cursor/delta/adaptive/realtime | high; multi-client/order/auth | 2–3 |
| PERF-003 | P1 | Admin traffic | health/accounting/referrals | five-API polling, eight-call effects, four calls/key | split/debounce/cancel/lazy | high; exact totals/races | 3 |
| PERF-004 | P1 | Question scale | questions/exam/start | broad pools/history/payload | metadata/select/bounds | high; scoring/concealment | 2 |
| PERF-005 | P1 | Frontend | landing/root/LiveKit | broad hydration/global timers/eager stage | server islands/scope/lazy | med-high; visual/offline/room | 5–6 |
| PERF-006 | P2 | Pagination | histories/content/admin | unbounded or fixed first pages | cursor/offset/summaries | medium; large-data boundaries | 2 |
| PERF-007 | P2 | Cache | cache/clientCache/CSC/pricing | busting/no coalescing/invalidation gap | policies/tags/dedupe | high; isolation/price | 4 |
| PERF-008 | P2 | Images | public icons/question images | large masters/missing dimensions | measure/right-size | low-med; bytes/CLS/visual | 6 |
| PERF-009 | P2 | Logs/loading/external | auth helpers/pages/integrations | misleading bailout logs; no loading; timeout gaps | scoped later fixes | high; auth/payment/slow tests | 4–6 |
| PERF-010 | INFO | Architecture | routes/config | correct dynamic auth; useful bounds/caches | preserve and measure | low except security boundaries | all |

+Each row supplies ID, severity, category, files/routes, current behavior/evidence and performance/traffic impact, root-cause direction, recommended fix/benefit, implementation/business risk, dependencies through slice assignment, and verification method. Detailed route evidence is in Sections 4–25.

## 27. Proposed Slice 2–6 Plan
Slice 2: payload/pagination (questions, histories, social, admin/accounting); high exam/financial risk; golden fixtures and large-data validation. Slice 3: polling/dedup/search; high auth/realtime risk; multi-tab/hidden/slow tests. Slice 4: cache/invalidation/API; high isolation/price risk; mutation and checkout-authority tests. Slice 5: server/client boundaries; validate JS/hydration, auth/offline, responsive/a11y. Slice 6: imports/images/bundle/loading; requires approved measurement tooling; validate chunks/CWV/CLS/room lifecycle/type/build.

## 28. Validation Results
Repository PASS; audit PASS; TypeScript PASS; build PASS; authenticated routes correctly dynamic with log finding. Live CWV and bundle composition NOT MEASURED. Production/DB/external tests NOT APPLICABLE. No environment values or production services accessed.

## 29. Files Inspected
Package/lock/config/schema/proxy; root/major layouts/pages; auth helpers/providers/global components; cache/offline/submit hooks; public/user/admin/partner/exam/social UI/APIs/services; public assets; installed Next 16 docs. Repository searches covered requests, timers, caches, Prisma queries, client boundaries, imports, Suspense/loading/errors and images.

## 30. Files Modified
`docs/performance/PERFORMANCE_BASELINE_AUDIT.md` only. No application code, auth, payments, accounting/referrals, exam logic, Prisma schema/migrations, dependencies, configuration, environment, production behavior, commit, push, merge, deployment, or Slice 2 work.