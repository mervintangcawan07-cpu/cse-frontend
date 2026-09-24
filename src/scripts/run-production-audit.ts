import fs from "fs";
import path from "path";
import { runRaceConditionSuite } from "./audit-race-conditions";
import { runBundleSecretsSuite } from "./audit-bundle-secrets";
import { runConnectionPoolSuite } from "./audit-connection-pool";
import { runSecurityHeadersSuite } from "./audit-security-headers";

export interface ConsolidatedAuditReport {
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
    branch: string;
    nodeEnv: string;
  };
  summary: {
    status: "PASSED" | "FAILED";
    totalPhases: number;
    passedPhases: number;
    failedPhases: number;
    durationMs: number;
  };
  phases: {
    phase1_concurrency_and_race_conditions: any;
    phase2_client_bundle_secret_leak_audit: any;
    phase3_connection_pool_stability: any;
    phase4_security_headers_and_cookie_protections: any;
  };
}

async function main() {
  const masterStart = Date.now();
  console.log("================================================================================");
  console.log("🚀 GOVSTUDYX MASTER PRODUCTION READINESS & RESILIENCE AUDIT");
  console.log("================================================================================");
  console.log(`Execution started at: ${new Date().toISOString()}`);

  let phase1Result: any;
  let phase2Result: any;
  let phase3Result: any;
  let phase4Result: any;

  try {
    phase1Result = await runRaceConditionSuite();
  } catch (err: any) {
    console.error("❌ Phase 1 encountered unhandled exception:", err);
    phase1Result = { status: "FAILED", error: err?.message || String(err) };
  }

  try {
    phase2Result = await runBundleSecretsSuite();
  } catch (err: any) {
    console.error("❌ Phase 2 encountered unhandled exception:", err);
    phase2Result = { status: "FAILED", error: err?.message || String(err) };
  }

  try {
    phase3Result = await runConnectionPoolSuite();
  } catch (err: any) {
    console.error("❌ Phase 3 encountered unhandled exception:", err);
    phase3Result = { status: "FAILED", error: err?.message || String(err) };
  }

  try {
    phase4Result = await runSecurityHeadersSuite();
  } catch (err: any) {
    console.error("❌ Phase 4 encountered unhandled exception:", err);
    phase4Result = { status: "FAILED", error: err?.message || String(err) };
  }

  const phaseStatuses = [
    phase1Result.status === "PASSED",
    phase2Result.status === "PASSED",
    phase3Result.status === "PASSED",
    phase4Result.status === "PASSED",
  ];

  const passedCount = phaseStatuses.filter(Boolean).length;
  const failedCount = phaseStatuses.length - passedCount;
  const totalDurationMs = Date.now() - masterStart;
  const masterStatus = failedCount === 0 ? "PASSED" : "FAILED";

  const report: ConsolidatedAuditReport = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      branch: "audit/production-readiness-resilience",
      nodeEnv: process.env.NODE_ENV || "development",
    },
    summary: {
      status: masterStatus,
      totalPhases: 4,
      passedPhases: passedCount,
      failedPhases: failedCount,
      durationMs: totalDurationMs,
    },
    phases: {
      phase1_concurrency_and_race_conditions: phase1Result,
      phase2_client_bundle_secret_leak_audit: phase2Result,
      phase3_connection_pool_stability: phase3Result,
      phase4_security_headers_and_cookie_protections: phase4Result,
    },
  };

  const reportPath = path.join(process.cwd(), "production_readiness_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

  console.log("\n================================================================================");
  console.log("📊 AUDIT CONSOLIDATED SUMMARY REPORT");
  console.log("================================================================================");
  console.log(`Phase 1: Concurrency & Financial Race Conditions  : ${phase1Result.status === "PASSED" ? "✅ PASSED" : "❌ FAILED"}`);
  console.log(`Phase 2: Client Bundle Secret Leak Audit          : ${phase2Result.status === "PASSED" ? "✅ PASSED" : "❌ FAILED"}`);
  console.log(`Phase 3: Connection Pool Stability Under Load     : ${phase3Result.status === "PASSED" ? "✅ PASSED" : "❌ FAILED"}`);
  console.log(`Phase 4: HTTP Security Headers & Cookie Policies  : ${phase4Result.status === "PASSED" ? "✅ PASSED" : "❌ FAILED"}`);
  console.log("--------------------------------------------------------------------------------");
  console.log(`OVERALL AUDIT OUTCOME : ${masterStatus === "PASSED" ? "✅ ALL PHASES PASSED" : "❌ AUDIT FAILED"}`);
  console.log(`Total Execution Time  : ${totalDurationMs}ms`);
  console.log(`Audit Artifact Saved  : ${reportPath}`);
  console.log("================================================================================\n");

  if (masterStatus === "FAILED") {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal failure running master audit orchestrator:", err);
  process.exit(1);
});
