import fs from "node:fs";
import path from "node:path";

let totalGroups = 0;
let passedGroups = 0;
let failedGroups = 0;
let totalChecks = 0;

function check(condition: boolean, message: string): void {
  totalChecks += 1;

  if (!condition) {
    throw new Error(message);
  }
}

async function group(
  name: string,
  work: () => void | Promise<void>
): Promise<void> {
  totalGroups += 1;

  try {
    await work();
    passedGroups += 1;
    console.log(`PASS GROUP ${totalGroups}: ${name}`);
  } catch (error: unknown) {
    failedGroups += 1;

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      `FAIL GROUP ${totalGroups}: ${name} — ${message}`
    );
  }
}

function read(relativePath: string): string {
  return fs.readFileSync(
    path.resolve(process.cwd(), relativePath),
    "utf8"
  );
}

function listFiles(root: string): string[] {
  const result: string[] = [];

  if (!fs.existsSync(root)) {
    return result;
  }

  for (const entry of fs.readdirSync(root, {
    withFileTypes: true,
  })) {
    const full = path.join(root, entry.name);

    if (entry.isDirectory()) {
      result.push(...listFiles(full));
    } else {
      result.push(full);
    }
  }

  return result;
}

function productionTypeScriptFiles(): string[] {
  return [
    ...listFiles(
      path.resolve(process.cwd(), "src/app")
    ),
    ...listFiles(
      path.resolve(process.cwd(), "src/lib")
    ),
  ].filter(
    (file) =>
      file.endsWith(".ts") ||
      file.endsWith(".tsx")
  );
}

const LEGACY_IMPORT =
  "@/lib/accounting/reconciliationService";

const DURABLE_CLASS =
  "IdempotentReconciliationService";

const DURABLE_MODULE =
  "idempotentReconciliationService";

async function runSuite(): Promise<void> {
  console.log(
    "============================================================"
  );
  console.log(
    "GovStudyX Slice 7A — Legacy Reconciliation Isolation"
  );
  console.log(
    "============================================================"
  );

  const legacyPath =
    "src/lib/accounting/reconciliationService.ts";

  const durablePath =
    path.resolve(
      process.cwd(),
      "src/lib/accounting/idempotentReconciliationService.ts"
    );

  const paymentPath =
    "src/lib/payment/paymentFinalizationService.ts";

  const refundPath =
    "src/lib/payment/refundService.ts";

  const adminPath =
    "src/app/api/admin/accounting/reconciliation/route.ts";

  await group(
    "legacy reconciliation implementation remains intact",
    () => {
      const source = read(legacyPath);

      check(
        source.includes(
          "export class ReconciliationService"
        ),
        "legacy reconciliation class must remain present"
      );

      check(
        source.includes(
          "reconciliationRecord.upsert"
        ),
        "legacy service must retain historical writer for now"
      );

      check(
        source.includes(
          'sourceType: "INTERNAL_TRANSACTION"'
        ),
        "legacy source identity must remain unchanged"
      );

      check(
        !source.includes(
          "finalizationEffectId:"
        ),
        "Slice 7A must not retrofit durable identity into legacy writer"
      );
    }
  );

  await group(
    "zero production imports of legacy reconciliation service",
    () => {
      const consumers =
        productionTypeScriptFiles()
          .filter(
            (file) =>
              path.resolve(file) !==
              path.resolve(
                process.cwd(),
                legacyPath
              )
          )
          .filter((file) =>
            fs
              .readFileSync(file, "utf8")
              .includes(LEGACY_IMPORT)
          );

      check(
        consumers.length === 0,
        `unexpected legacy production consumers: ${consumers.join(
          ", "
        )}`
      );
    }
  );

  await group(
    "payment finalization no longer invokes legacy reconciliation",
    () => {
      const source = read(paymentPath);

      check(
        !source.includes(LEGACY_IMPORT),
        "payment finalization retains legacy import"
      );

      check(
        !source.includes(
          "ReconciliationService.reconcileTransaction"
        ),
        "payment finalization retains legacy reconciliation call"
      );

      check(
        !source.includes(DURABLE_CLASS),
        "payment finalization must not cut over to durable reconciliation in Slice 7A"
      );

      check(
        !source.includes(DURABLE_MODULE),
        "payment finalization must not import durable reconciliation module"
      );
    }
  );

  await group(
    "refund processing no longer invokes legacy reconciliation",
    () => {
      const source = read(refundPath);

      check(
        !source.includes(LEGACY_IMPORT),
        "refund service retains legacy import"
      );

      check(
        !source.includes(
          "ReconciliationService.reconcileTransaction"
        ),
        "refund service retains legacy reconciliation call"
      );

      check(
        !source.includes(DURABLE_CLASS),
        "refund service must not cut over to durable reconciliation"
      );

      check(
        !source.includes(DURABLE_MODULE),
        "refund service must not import durable reconciliation module"
      );
    }
  );

  await group(
    "admin reconciliation GET remains read-only while POST fails closed",
    () => {
      const source = read(adminPath);

      check(
        source.includes(
          "export async function GET"
        ),
        "admin reconciliation GET must remain available"
      );

      check(
        source.includes(
          "reconciliationRecord.findMany"
        ),
        "admin GET must retain historical record reads"
      );

      check(
        source.includes(
          "reconciliationRecord.count"
        ),
        "admin GET must retain status counts"
      );

      check(
        source.includes(
          "export async function POST"
        ),
        "admin POST must remain explicit"
      );

      check(
        source.includes(
          "LEGACY_RECONCILIATION_WRITE_DISABLED"
        ),
        "admin POST must return the closed Slice 7A error code"
      );

      check(
        source.includes(
          "{ status: 409 }"
        ),
        "admin POST must fail closed with HTTP 409"
      );

      check(
        !source.includes(
          "runBatchReconciliation"
        ),
        "admin POST must not run legacy batch reconciliation"
      );

      check(
        !source.includes(LEGACY_IMPORT),
        "admin route retains legacy import"
      );

      check(
        !source.includes(
          "reconciliationRecord.create("
        ) &&
          !source.includes(
            "reconciliationRecord.update("
          ) &&
          !source.includes(
            "reconciliationRecord.upsert("
          ) &&
          !source.includes(
            "reconciliationRecord.delete("
          ),
        "admin route must not mutate reconciliation records"
      );
    }
  );

  await group(
    "durable reconciliation remains dormant across production",
    () => {
      const consumers =
        productionTypeScriptFiles()
          .filter(
            (file) =>
              path.resolve(file) !== durablePath &&
          path.resolve(file) !==
            path.resolve(
              process.cwd(),
              "src/lib/payment/paymentFinalizationCoordinator.ts"
            )
          )
          .filter((file) => {
            const source =
              fs.readFileSync(file, "utf8");

            return (
              source.includes(DURABLE_CLASS) ||
              source.includes(DURABLE_MODULE)
            );
          });

      check(
        consumers.length === 0,
        `durable reconciliation unexpectedly cut over to production: ${consumers.join(
          ", "
        )}`
      );
    }
  );

  console.log(
    "============================================================"
  );

  console.log(
    `Slice 7A isolation summary: ${passedGroups}/${totalGroups} groups passed; ${totalChecks} checks executed; ${failedGroups} groups failed.`
  );

  if (failedGroups > 0) {
    process.exit(1);
  }
}

runSuite().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  console.error(
    "Unhandled Slice 7A test failure:",
    message
  );

  process.exit(1);
});
