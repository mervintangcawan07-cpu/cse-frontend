# GovStudyX five-layer firewall security audit
Date: 2026-10-29
Baseline: main at 335eb3d137684ddf9d4d6f1314261d12788c8b8e
Mode: repository-source audit only; NOT a penetration test or Vercel/Neon settings attestation.

## L1: Edge WAF
Vercel provides platform protection but the current custom WAF rules, capacity, action mode and bypass list could not be verified. The Vercel connector returned 403 for project team access. Do not claim live rules have been installed. Implement initial policy manually in log-only mode after reviewing existing settings, then evaluate access logs. Exempt signed PayMongo webhook endpoints, cron triggers, health checks, PWA assets from interactive challenges (not from signature/authorization verification).

## L2: Next.js gateway
src/proxy.ts already verifies cse_session JWT and roles for admin requests, guards protected routes and partner portal, and handles feature flags/maintenance. next.config.ts emits HSTS, CSP, frame, content-type and permissions headers.
Fixed on branch: prefix checks now distinguish /admin from /administrator and /dashboard from /dashboards. Review CSP allowances ('unsafe-inline', broad https:/wss: origins) only after integration tests.

## L3: Abuse controls
src/lib/ratelimit.ts defines Redis-backed limits for auth, exam, AI, messaging and other routes. Its previous getClientIp prioritized cf-connecting-ip and x-real-ip unconditionally and contained an invalid forwarded-chain IP regex; updated to use Vercel-managed X-Forwarded-For only under Vercel, with validated IP syntax. Outside Vercel it uses a stable local identity to avoid trusting arbitrary supplied proxy headers. A differently hosted installation needs a verified trusted proxy/IP strategy.
Risk: checkRateLimit currently FAILS OPEN when Upstash configuration is missing or Redis fails. Do not switch to fail-closed without assessing availability, health checks and recovery. src/lib/accountLockout.ts uses a process-local Map; distributed, anti-denial-of-account lockout design is recommended.

## L4: Application
src/app/api/exam/submit/route.ts verifies user and exam attempt token and checks ownership. src/app/api/admin/notifications/route.ts applies server-side admin checks and origin restrictions. src/lib/payment/paymongoWebhookHandler.ts validates signatures/timestamps and production mode before processing payment events. src/app/api/admin/questions/import/route.ts checks admin role and a Content-Length ceiling but does not prove a strict measured-body cap. Review body limits, CSRF/origin handling, and route-by-route authorization before enforcing WAF challenges. Preserve application flows.

## L5: Database
prisma.config.ts uses DIRECT_URL or DATABASE_URL; src/lib/prisma.ts uses PrismaPg. Access control, least-privilege permissions, applied migrations, Neon IP/network rules and backup restoration have NOT been verified from source review; require separate read-only inspections. No migrations or schema changes approved.

## Validation / release gates
- Branch-only work; do not merge to main or activate WAF until verified.
- npx tsc --noEmit
- npx eslint src/proxy.ts src/lib/ratelimit.ts
- npx tsx src/scripts/audit-routes.ts
- npm run build (only in authorized test environment; can access service environment).
- Verify authenticated admin and partner routes, login abuse, exam start/submission, PayMongo webhooks, health checks, PWA and CRON flows before merging.
- Compare status codes before/after; check 403, 429 and 5xx trends after any release.
- No database migration or secrets modifications in this branch.
