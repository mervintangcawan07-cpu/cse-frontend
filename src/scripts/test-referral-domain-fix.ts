// Relative Path: src/scripts/test-referral-domain-fix.ts

const { getSiteUrl } = await import(
  new URL("../lib/config/site.ts", import.meta.url).href
);

const managedEnvironmentKeys = [
  "VERCEL_ENV",
  "VERCEL_URL",
  "SITE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NODE_ENV",
] as const;

type ManagedEnvironmentKey = (typeof managedEnvironmentKeys)[number];
type TestEnvironment = Partial<Record<ManagedEnvironmentKey, string>>;

const originalEnvironment = new Map<ManagedEnvironmentKey, string | undefined>(
  managedEnvironmentKeys.map((key) => [key, process.env[key]])
);

let passed = 0;
let failed = 0;

function clearManagedEnvironment() {
  for (const key of managedEnvironmentKeys) {
    Reflect.deleteProperty(process.env, key);
  }
}

function restoreOriginalEnvironment() {
  clearManagedEnvironment();

  for (const [key, value] of originalEnvironment) {
    if (value !== undefined) {
      Reflect.set(process.env, key, value);
    }
  }
}

function assertEqual(actual: string, expected: string, description: string) {
  if (actual === expected) {
    console.log(`✅ [PASS] ${description}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${description}`);
    failed++;
  }
}

function runCase(
  description: string,
  environment: TestEnvironment,
  expectedUrl: string
) {
  clearManagedEnvironment();

  try {
    for (const [key, value] of Object.entries(environment)) {
      Reflect.set(process.env, key, value);
    }

    assertEqual(getSiteUrl(), expectedUrl, description);
  } finally {
    clearManagedEnvironment();
  }
}

console.log("============================================================");
console.log("GOVSTUDYX REFERRAL DOMAIN RESOLUTION TEST");
console.log("============================================================");

try {
  runCase(
    "Vercel Production ignores the retired configured domain",
    {
      VERCEL_ENV: "production",
      NODE_ENV: "production",
      SITE_URL: "https://cseonlinereview.vercel.app",
      NEXT_PUBLIC_SITE_URL: "https://cseonlinereview.vercel.app",
      NEXT_PUBLIC_APP_URL: "https://cseonlinereview.vercel.app",
    },
    "https://govstudyx.com"
  );

  runCase(
    "Vercel Production ignores an alternate configured domain",
    {
      VERCEL_ENV: "production",
      NODE_ENV: "production",
      SITE_URL: "https://alternate.example.test",
    },
    "https://govstudyx.com"
  );

  runCase(
    "Vercel Preview preserves its configured URL",
    {
      VERCEL_ENV: "preview",
      NODE_ENV: "production",
      SITE_URL: "https://configured-preview.vercel.app/",
      VERCEL_URL: "generated-preview.vercel.app",
    },
    "https://configured-preview.vercel.app"
  );

  runCase(
    "Vercel Preview uses its generated URL when no URL is configured",
    {
      VERCEL_ENV: "preview",
      NODE_ENV: "production",
      VERCEL_URL: "generated-preview.vercel.app/",
    },
    "https://generated-preview.vercel.app"
  );

  runCase(
    "Local development preserves its configured URL",
    {
      NODE_ENV: "development",
      SITE_URL: "http://localhost:4100/",
    },
    "http://localhost:4100"
  );

  runCase(
    "Tests preserve their configured URL",
    {
      NODE_ENV: "test",
      NEXT_PUBLIC_SITE_URL: "https://test-site.example.test/",
    },
    "https://test-site.example.test"
  );

  runCase(
    "Non-Vercel production retains the canonical fallback",
    {
      NODE_ENV: "production",
    },
    "https://govstudyx.com"
  );

  runCase(
    "Configured application URLs retain trailing-slash normalization",
    {
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "https://configured-app.example.test///",
    },
    "https://configured-app.example.test"
  );
} finally {
  restoreOriginalEnvironment();
}

console.log("============================================================");
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("============================================================");

if (failed > 0) {
  process.exitCode = 1;
}
