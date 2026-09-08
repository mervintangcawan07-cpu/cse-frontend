// Relative Path: src/scripts/test-study-together-duel-gating.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { isStudyTogetherEnabled, isDuelEnabled, STUDY_TOGETHER_ENABLED, DUEL_ENABLED } from "../lib/config/features";
import { proxy } from "../proxy";

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function createMockRequest(path: string, method = "GET"): NextRequest {
  const url = `http://localhost:3000${path}`;
  return new NextRequest(url, { method });
}

async function runGatingTestSuite() {
  console.log("===================================================================");
  console.log("▶ RUNNING PRE-LAUNCH FEATURE GATING & ANTI-BYPASS VERIFICATION");
  console.log("===================================================================\n");

  // -------------------------------------------------------------------------
  // SECTION 1: DEFAULT CONFIGURATION & DEFAULTS TO FALSE
  // -------------------------------------------------------------------------
  console.log("Testing Section 1: Default configuration state...");
  assert.strictEqual(
    STUDY_TOGETHER_ENABLED,
    false,
    "STUDY_TOGETHER_ENABLED constant must default to false"
  );
  assert.strictEqual(
    DUEL_ENABLED,
    false,
    "DUEL_ENABLED constant must default to false"
  );

  // Without environment variables set, functions must return false
  delete process.env.STUDY_TOGETHER_ENABLED;
  delete process.env.NEXT_PUBLIC_STUDY_TOGETHER_ENABLED;
  delete process.env.DUEL_ENABLED;
  delete process.env.NEXT_PUBLIC_DUEL_ENABLED;

  assert.strictEqual(
    isStudyTogetherEnabled(),
    false,
    "isStudyTogetherEnabled() must default to false when env is absent"
  );
  assert.strictEqual(
    isDuelEnabled(),
    false,
    "isDuelEnabled() must default to false when env is absent"
  );
  console.log("✓ Section 1 Passed: Both features default strictly to OFF (false).\n");

  // -------------------------------------------------------------------------
  // SECTION 2: PROXY MIDDLEWARE GATING IN DEFAULT OFF STATE
  // -------------------------------------------------------------------------
  console.log("Testing Section 2: Server-authoritative proxy middleware in OFF state...");

  // 2.1 Social UI direct navigation redirects to /dashboard?notice=feature_unavailable
  const socialUIRoot = await proxy(createMockRequest("/social"));
  assert.strictEqual(socialUIRoot.status, 307, "/social should 307 redirect");
  assert.strictEqual(
    socialUIRoot.headers.get("location"),
    "http://localhost:3000/dashboard?notice=feature_unavailable",
    "/social must redirect to /dashboard?notice=feature_unavailable"
  );

  const socialUISub = await proxy(createMockRequest("/social/rooms/test-room"));
  assert.strictEqual(socialUISub.status, 307, "/social/* should 307 redirect");
  assert.strictEqual(
    socialUISub.headers.get("location"),
    "http://localhost:3000/dashboard?notice=feature_unavailable",
    "/social/* must redirect to /dashboard?notice=feature_unavailable"
  );

  // 2.2 Duel UI direct navigation redirects to /dashboard?notice=feature_unavailable
  const duelUIRoot = await proxy(createMockRequest("/duels"));
  assert.strictEqual(duelUIRoot.status, 307, "/duels should 307 redirect");
  assert.strictEqual(
    duelUIRoot.headers.get("location"),
    "http://localhost:3000/dashboard?notice=feature_unavailable",
    "/duels must redirect to /dashboard?notice=feature_unavailable"
  );

  const duelUISub = await proxy(createMockRequest("/duels?matchId=abc-123"));
  assert.strictEqual(duelUISub.status, 307, "/duels?matchId should 307 redirect");
  assert.strictEqual(
    duelUISub.headers.get("location"),
    "http://localhost:3000/dashboard?notice=feature_unavailable",
    "/duels?matchId must redirect to /dashboard?notice=feature_unavailable"
  );

  // 2.3 Social API routes return 503 Service Unavailable with no-store
  const socialApiRooms = await proxy(createMockRequest("/api/social/rooms"));
  assert.strictEqual(socialApiRooms.status, 503, "/api/social/rooms must return 503");
  assert.strictEqual(
    socialApiRooms.headers.get("cache-control"),
    "no-store",
    "503 responses must have Cache-Control: no-store"
  );
  const socialApiRoomsBody = await socialApiRooms.json();
  assert.strictEqual(socialApiRoomsBody.error, "Study Together is temporarily unavailable.");

  const socialApiSub = await proxy(createMockRequest("/api/social/rooms/room-123/chat"));
  assert.strictEqual(socialApiSub.status, 503, "/api/social/rooms/[id]/chat must return 503");

  const socialApiVoice = await proxy(createMockRequest("/api/social/rooms/room-123/voice-token"));
  assert.strictEqual(socialApiVoice.status, 503, "/api/social/rooms/[id]/voice-token must return 503");

  // 2.4 Duel API routes return 503 Service Unavailable with no-store
  const duelApiRoot = await proxy(createMockRequest("/api/duels/matchmake", "POST"));
  assert.strictEqual(duelApiRoot.status, 503, "/api/duels/matchmake must return 503");
  assert.strictEqual(
    duelApiRoot.headers.get("cache-control"),
    "no-store",
    "503 responses must have Cache-Control: no-store"
  );
  const duelApiBody = await duelApiRoot.json();
  assert.strictEqual(duelApiBody.error, "Duels are temporarily unavailable.");

  const duelApiChallenge = await proxy(createMockRequest("/api/duels/challenge", "POST"));
  assert.strictEqual(duelApiChallenge.status, 503, "/api/duels/challenge must return 503");

  const duelApiGet = await proxy(createMockRequest("/api/duels/match-123"));
  assert.strictEqual(duelApiGet.status, 503, "/api/duels/[id] must return 503");

  console.log("✓ Section 2 Passed: Proxy middleware blocks all UI and API endpoints with 503/307.\n");

  // -------------------------------------------------------------------------
  // SECTION 3: WAVE 1 REVERSIBILITY (STUDY TOGETHER ONLY)
  // -------------------------------------------------------------------------
  console.log("Testing Section 3: Wave 1 Reversibility (STUDY_TOGETHER_ENABLED=true, DUEL_ENABLED=false)...");
  process.env.STUDY_TOGETHER_ENABLED = "true";
  delete process.env.DUEL_ENABLED;

  assert.strictEqual(isStudyTogetherEnabled(), true, "Study Together must be enabled");
  assert.strictEqual(isDuelEnabled(), false, "Duels must remain disabled");

  // In Wave 1, Study Together feature gate allows traffic.
  // Unauthenticated UI requests will proceed past feature gate to protected route auth (redirecting to /login, NOT /dashboard?notice=feature_unavailable)
  const wave1SocialUI = await proxy(createMockRequest("/social"));
  assert.strictEqual(
    wave1SocialUI.headers.get("location"),
    "http://localhost:3000/login?redirect=%2Fsocial",
    "Wave 1: /social UI must pass feature gate and reach auth check"
  );

  const wave1SocialApi = await proxy(createMockRequest("/api/social/rooms"));
  assert.notStrictEqual(wave1SocialApi.status, 503, "Wave 1: /api/social/rooms must pass proxy");

  // But Duels must remain strictly blocked by feature gate
  const wave1DuelUI = await proxy(createMockRequest("/duels"));
  assert.strictEqual(
    wave1DuelUI.headers.get("location"),
    "http://localhost:3000/dashboard?notice=feature_unavailable",
    "Wave 1: /duels UI must still redirect to feature_unavailable"
  );
  const wave1DuelApi = await proxy(createMockRequest("/api/duels/matchmake", "POST"));
  assert.strictEqual(wave1DuelApi.status, 503, "Wave 1: /api/duels/matchmake must still be 503");

  console.log("✓ Section 3 Passed: Wave 1 correctly activates Study Together while keeping Duels locked.\n");

  // -------------------------------------------------------------------------
  // SECTION 4: WAVE 2 REVERSIBILITY (DUEL ONLY)
  // -------------------------------------------------------------------------
  console.log("Testing Section 4: Wave 2 Reversibility (STUDY_TOGETHER_ENABLED=false, DUEL_ENABLED=true)...");
  delete process.env.STUDY_TOGETHER_ENABLED;
  process.env.DUEL_ENABLED = "true";

  assert.strictEqual(isStudyTogetherEnabled(), false, "Study Together must be disabled");
  assert.strictEqual(isDuelEnabled(), true, "Duels must be enabled");

  // In Wave 2, Duel endpoints pass through feature gate to auth check
  const wave2DuelUI = await proxy(createMockRequest("/duels"));
  assert.strictEqual(
    wave2DuelUI.headers.get("location"),
    "http://localhost:3000/login?redirect=%2Fduels",
    "Wave 2: /duels UI must pass feature gate and reach auth check"
  );

  const wave2DuelApi = await proxy(createMockRequest("/api/duels/matchmake", "POST"));
  assert.notStrictEqual(wave2DuelApi.status, 503, "Wave 2: /api/duels/matchmake must pass proxy");

  // But Study Together must remain strictly blocked by feature gate
  const wave2SocialUI = await proxy(createMockRequest("/social"));
  assert.strictEqual(
    wave2SocialUI.headers.get("location"),
    "http://localhost:3000/dashboard?notice=feature_unavailable",
    "Wave 2: /social UI must still redirect to feature_unavailable"
  );
  const wave2SocialApi = await proxy(createMockRequest("/api/social/rooms"));
  assert.strictEqual(wave2SocialApi.status, 503, "Wave 2: /api/social/rooms must still be 503");

  console.log("✓ Section 4 Passed: Wave 2 correctly activates Duels while keeping Study Together locked.\n");

  // -------------------------------------------------------------------------
  // SECTION 5: FULL ACTIVATION (BOTH ENABLED)
  // -------------------------------------------------------------------------
  console.log("Testing Section 5: Full Launch Reversibility (Both enabled)...");
  process.env.STUDY_TOGETHER_ENABLED = "true";
  process.env.DUEL_ENABLED = "true";

  assert.strictEqual(isStudyTogetherEnabled(), true);
  assert.strictEqual(isDuelEnabled(), true);

  const fullSocialUI = await proxy(createMockRequest("/social"));
  assert.strictEqual(
    fullSocialUI.headers.get("location"),
    "http://localhost:3000/login?redirect=%2Fsocial"
  );
  const fullDuelUI = await proxy(createMockRequest("/duels"));
  assert.strictEqual(
    fullDuelUI.headers.get("location"),
    "http://localhost:3000/login?redirect=%2Fduels"
  );
  const fullSocialApi = await proxy(createMockRequest("/api/social/rooms"));
  assert.notStrictEqual(fullSocialApi.status, 503);
  const fullDuelApi = await proxy(createMockRequest("/api/duels/matchmake", "POST"));
  assert.notStrictEqual(fullDuelApi.status, 503);

  // Restore env to clean default OFF state
  delete process.env.STUDY_TOGETHER_ENABLED;
  delete process.env.DUEL_ENABLED;
  console.log("✓ Section 5 Passed: Full activation allows both features cleanly; env restored to OFF.\n");

  // -------------------------------------------------------------------------
  // SECTION 6: ROUTE HANDLER SOURCE CODE & ANTI-BYPASS DEFENSE-IN-DEPTH
  // -------------------------------------------------------------------------
  console.log("Testing Section 6: Route handler source code defense-in-depth...");

  const duelRouteFiles = [
    "src/app/api/duels/[id]/route.ts",
    "src/app/api/duels/challenge/respond/route.ts",
    "src/app/api/duels/challenge/route.ts",
    "src/app/api/duels/matchmake/route.ts",
  ];

  for (const file of duelRouteFiles) {
    const code = source(file);
    const hasGate =
      code.includes("isDuelEnabled()") ||
      code.includes("isDuelActive");
    assert.ok(hasGate, `${file} must contain isDuelEnabled or isDuelActive check`);
    assert.ok(
      code.includes("status: 503"),
      `${file} must return 503 status code when duel feature is disabled`
    );
  }

  const socialRouteFiles = [
    "src/app/api/social/rooms/route.ts",
    "src/app/api/social/rooms/join/route.ts",
    "src/app/api/social/rooms/[roomId]/route.ts",
    "src/app/api/social/rooms/[roomId]/voice-token/route.ts",
    "src/app/api/social/rooms/[roomId]/whiteboard/route.ts",
    "src/app/api/social/rooms/[roomId]/chat/route.ts",
    "src/app/api/social/rooms/[roomId]/invite/route.ts",
    "src/app/api/social/rooms/[roomId]/leave/route.ts",
    "src/app/api/social/rooms/[roomId]/participants/route.ts",
    "src/app/api/social/rooms/[roomId]/topic/route.ts",
  ];

  for (const file of socialRouteFiles) {
    const code = source(file);
    const hasGate =
      code.includes("isStudyTogetherEnabled()") ||
      code.includes("isStudyTogetherActive");
    assert.ok(hasGate, `${file} must contain isStudyTogetherEnabled or isStudyTogetherActive check`);
    assert.ok(
      code.includes("status: 503"),
      `${file} must return 503 status code when study together feature is disabled`
    );
  }
  console.log("✓ Section 6 Passed: All 14 API routes contain direct defense-in-depth 503 gating.\n");

  // -------------------------------------------------------------------------
  // SECTION 7: CLIENT UI GATING VERIFICATION
  // -------------------------------------------------------------------------
  console.log("Testing Section 7: Client UI entry point gating...");

  const navbarCode = source("src/components/Navbar.tsx");
  assert.ok(navbarCode.includes("STUDY_TOGETHER_ENABLED"), "Navbar must import STUDY_TOGETHER_ENABLED");
  assert.ok(navbarCode.includes("...(STUDY_TOGETHER_ENABLED"), "Navbar must conditionally add Study Together link");

  const footerCode = source("src/components/Footer.tsx");
  assert.ok(footerCode.includes("STUDY_TOGETHER_ENABLED"), "Footer must import STUDY_TOGETHER_ENABLED");
  assert.ok(footerCode.includes("{STUDY_TOGETHER_ENABLED && ("), "Footer must conditionally render Study Together link");

  const practiceCode = source("src/app/practice/page.tsx");
  assert.ok(practiceCode.includes("DUEL_ENABLED"), "Practice page must import DUEL_ENABLED");
  assert.ok(practiceCode.includes("!DUEL_ENABLED"), "Practice page must check !DUEL_ENABLED");
  assert.ok(practiceCode.includes("Coming Soon in Pre-Launch"), "Practice page must display Coming Soon state");

  const classmatesCode = source("src/components/social/ClassmatesSection.tsx");
  assert.ok(classmatesCode.includes("DUEL_ENABLED"), "ClassmatesSection must import DUEL_ENABLED");
  assert.ok(classmatesCode.includes("{DUEL_ENABLED && ("), "ClassmatesSection must gate Duel challenge button");

  const hubModuleCode = source("src/components/social/HubModuleCards.tsx");
  assert.ok(hubModuleCode.includes("DUEL_ENABLED"), "HubModuleCards must import DUEL_ENABLED");

  const socialPageCode = source("src/app/social/page.tsx");
  assert.ok(socialPageCode.includes("STUDY_TOGETHER_ENABLED"), "Social page must import STUDY_TOGETHER_ENABLED");
  assert.ok(socialPageCode.includes("!STUDY_TOGETHER_ENABLED"), "Social page must check !STUDY_TOGETHER_ENABLED");

  const duelPageCode = source("src/app/duels/page.tsx");
  assert.ok(duelPageCode.includes("DUEL_ENABLED"), "Duels page must import DUEL_ENABLED");
  assert.ok(duelPageCode.includes("!DUEL_ENABLED"), "Duels page must check !DUEL_ENABLED");

  console.log("✓ Section 7 Passed: Client UI entry points are fully gated and hidden/disabled.\n");

  console.log("===================================================================");
  console.log("ALL FEATURE GATING & ANTI-BYPASS TESTS PASSED SUCCESSFULLY! (7/7)");
  console.log("===================================================================");
}

runGatingTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
