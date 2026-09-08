# Feature Reactivation & Operations Guide: Study Together & 1v1 Duels

**Document Version:** 1.0  
**Status:** Pre-Launch Gate Active (Default: Disabled)  
**Applicable Branch:** `feature/disable-study-together-duel`

---

## 1. Architectural Overview

To ensure zero launch-day surprises, GovStudyX implements a multi-layered, server-authoritative feature gating architecture for **Study Together (Social Study Hub)** and **1v1 Duels (Live Arena)**.

### Layered Defense-in-Depth

```
User Request
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Next.js Proxy Middleware (src/proxy.ts)           │
│ - UI direct hits (/social, /duels) ➔ 307 to /dashboard     │
│ - API hits (/api/social/rooms/*, /api/duels/*) ➔ 503 JSON   │
│ - Cache-Control: no-store on all gated 503 responses        │
└──────────────────────────┬──────────────────────────────────┘
                           │ (Allowed if flag is true)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: API Route Handlers (14 Individual Endpoints)       │
│ - Defense-in-depth isStudyTogetherEnabled() / isDuelEnabled()│
│ - Immediately returns 503 prior to any DB query or mutation │
│ - Blocks LiveKit voice token minting and matchmaking pools  │
└──────────────────────────┬──────────────────────────────────┘
                           │ (Allowed if flag is true)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Client UI & Navigation Components                  │
│ - Desktop/Mobile Navbar conditionally omits link            │
│ - Footer conditionally omits link                           │
│ - Practice page renders disabled "Coming Soon" badge/card   │
│ - ClassmatesSection hides "⚔️ Duel" challenge action         │
│ - Controlled pre-launch banner fallback on direct loads     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Environment Variables & Independent Flags

Both features are controlled independently. When the environment variables are absent, empty, or set to anything other than `"true"`, the features strictly default to **OFF (`false`)**.

| Environment Variable | Scope | Description | Default |
|---|---|---|---|
| `NEXT_PUBLIC_STUDY_TOGETHER_ENABLED` | Deployment / Server + Client UI | Controls Study Together pre-launch availability; server/proxy/API enforcement remains authoritative | `false` |
| `NEXT_PUBLIC_DUEL_ENABLED` | Deployment / Server + Client UI | Controls Duel pre-launch availability; server/proxy/API enforcement remains authoritative | `false` |

Central configuration module: [`src/lib/config/features.ts`](../../src/lib/config/features.ts)

---

## 3. Activation Procedures

### Wave 1: Activating Study Together Only
To activate the Study Together Hub while keeping 1v1 Duels completely disabled:

1. In `.env` (or production hosting dashboard e.g., Vercel, Railway, AWS):
   ```bash
   NEXT_PUBLIC_STUDY_TOGETHER_ENABLED="true"
   # Leave NEXT_PUBLIC_DUEL_ENABLED unset or "false"
   ```
2. Restart or redeploy the application.
3. Verify:
   - Study Together appears in Navbar and Footer.
   - `/social` loads the Study Together Hub.
   - Audio rooms, chat, and whiteboard endpoints accept connections.
   - 1v1 Duels remain locked: Practice page shows "Coming Soon", direct `/duels` redirects to `/dashboard`, `/api/duels/*` returns 503.

### Wave 2: Activating 1v1 Duels Only
To activate 1v1 Duels while keeping Study Together completely disabled:

1. In `.env`:
   ```bash
   # Leave NEXT_PUBLIC_STUDY_TOGETHER_ENABLED unset or "false"
   NEXT_PUBLIC_DUEL_ENABLED="true"
   ```
2. Restart or redeploy the application.
3. Verify:
   - Practice page displays active "Enter Battle Arena ⚔️" button.
   - `/duels` loads matchmaking arena.
   - `/api/duels/matchmake` and `/api/duels/challenge` accept requests.
   - Study Together remains locked: `/social` redirects to `/dashboard`, `/api/social/rooms/*` returns 503.

### Wave 3: Full Public Launch (Both Enabled)
To enable both features simultaneously:

1. In `.env`:
   ```bash
   NEXT_PUBLIC_STUDY_TOGETHER_ENABLED="true"
   NEXT_PUBLIC_DUEL_ENABLED="true"
   ```
2. Restart or redeploy the application.
3. Both features operate with full capabilities.

---

## 4. Smoke-Test & Verification Checklist

Before and after flipping feature flags, execute the automated gating test suite:

```powershell
npx tsx src/scripts/test-study-together-duel-gating.ts
```

### Manual Verification Matrix

| Area | Test Action | Expected Result when Flag = `false` |
|---|---|---|
| **Navbar** | View header navigation on desktop & mobile | "Study Together 👥" is absent |
| **Footer** | View footer "Reviewer Suite" column | "Study Together Hub 👥" is absent |
| **Direct URL** | Navigate directly to `http://localhost:3000/social` | Redirects to `/dashboard?notice=feature_unavailable` |
| **Direct URL** | Navigate directly to `http://localhost:3000/duels` | Redirects to `/dashboard?notice=feature_unavailable` |
| **Practice Hub** | Open `http://localhost:3000/practice` | Card 4 displays disabled "⏳ Coming Soon in Pre-Launch" |
| **Classmates** | Open classmates list | "⚔️ Duel" button is not rendered |
| **Rooms API** | `GET /api/social/rooms` | HTTP 503: `{"error":"Study Together is temporarily unavailable."}` |
| **LiveKit Token** | `GET /api/social/rooms/{id}/voice-token` | HTTP 503: `{"error":"Study Together is temporarily unavailable."}` |
| **Matchmake API**| `POST /api/duels/matchmake` | HTTP 503: `{"error":"Duels are temporarily unavailable."}` |
| **Challenge API**| `POST /api/duels/challenge` | HTTP 503: `{"error":"Duels are temporarily unavailable."}` |

---

## 5. Instant Emergency Rollback Instructions

If any performance bottleneck, LiveKit connection surge, or game-state synchronization anomaly occurs in production, an instant lockdown can be enacted immediately:

1. **Remove or reset the variables:**
   ```bash
   NEXT_PUBLIC_STUDY_TOGETHER_ENABLED="false"
   NEXT_PUBLIC_DUEL_ENABLED="false"
   ```
2. **Redeploy / restart server process.**
3. **Confirm immediate enforcement:**
   - Middleware blocks incoming traffic in under 1 millisecond.
   - All open WebSocket/LiveKit token requests return 503.
   - Existing database records (`StudyRoom`, `DuelMatch`) remain safely stored with zero data loss.

---

## 6. Zero-Impact & Safety Guarantees

- **No Schema Changes:** The Prisma schema (`prisma/schema.prisma`) is completely untouched.
- **No Data Deletion:** Pre-existing study rooms, matches, messages, and player records remain intact.
- **Question Bank Isolation:** Question bank isolation tests pass 63/63 (`npx tsx src/scripts/test-question-bank-isolation.ts`). Elimination Drills and standard exams are completely decoupled from Duel/Social gating.
- **Authentication & RBAC:** Session cookies, JWT verification, and administrative routing remain intact and untouched.
