# Proposed Vercel WAF configuration — NOT ACTIVE
Owner action required: Vercel project access for team mervintangcawan07-2882s-projects.

## Stage 0: inventory
In Vercel Project > Firewall, identify current rules, exemptions, bot policies, plan limits and existing rate limit behavior. Record current configuration for rollback. Avoid wildcard enforcement on all /api paths.

## Stage 1: observe in Log mode
1. Authentication POST routes: /api/auth/login, /api/auth/signup, /api/auth/register, /api/auth/forgot-password, /api/auth/reset-password and partner auth. Watch for anomalous velocity; shared Wi-Fi and mobile NAT mean thresholds need representative traffic.
2. Suspicious paths: /.env, /.git/config, /wp-admin and similarly irrelevant probe paths. After monitoring, selectively deny clearly invalid paths.
3. Admin scans: /admin and /api/admin, including nested routes. Review logs before rate limits/challenges, and preserve authenticated admin functionality.

## Stage 2: carefully enforce
Confirm tests for login, signup, password recovery, partner portal, exam submission and admin console. Prefer rate limiting narrowly scoped to auth endpoints over indiscriminate JS challenges. Use Vercel firewall analytics to monitor 403/429 trends and rollback any rule causing legitimate errors.

## Do NOT browser-challenge these machine/critical flows
- POST /api/paymongo/webhook and /api/webhooks/paymongo: provider callbacks require signature verification in the app.
- /api/cron/*: bearer-secret scheduled jobs.
- /api/health/liveness and /api/health/readiness: monitors.
- /_next/*, /sw.js and PWA assets.
- Exam submit/start, AI explain, messages without separate load/usability assessment.

The exceptions above concern **interactive bot challenges**, not bypass of authorization, signature validation or appropriate throttles.

No active WAF rules or database settings were changed by this branch.
References: https://vercel.com/docs/vercel-firewall and https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules
