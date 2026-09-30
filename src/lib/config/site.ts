export const siteConfig = {
  name: "GovStudyX",
  legalName: "GovStudyX Online Educational Services",
  domain: "govstudyx.com",
  url: "https://govstudyx.com",
  tagline: "Independent Philippine Civil Service Examination Reviewer",
  description:
    "An independent online learning platform designed to help examinees prepare for the Philippine Civil Service Examination through realistic practice questions, mock exams, elimination drills, active recall flashcards, and collaborative study tools.",
  effectiveDate: "August 20, 2026",
  lastUpdated: "August 20, 2026",

  emails: {
    general: "govstudyx@gmail.com",
    support: "govstudyx@gmail.com",
    privacy: "govstudyx@gmail.com",
    billing: "govstudyx@gmail.com",
  },

  disclaimer: {
    short:
      "GovStudyX is an independent educational platform. We are not affiliated with, sponsored by, or endorsed by the Philippine Civil Service Commission (CSC) or any government agency.",
    full:
      "GovStudyX (govstudyx.com) is an independent online learning platform created for civil-service exam preparation. We are not the Civil Service Commission (CSC) and do not represent ourselves as an official government agency. References to the Civil Service Examination, CSC syllabus, or related government materials are provided solely for educational and test-preparation purposes.",
  },

  links: {
    privacy: "/privacy",
    terms: "/terms",
    refund: "/refund",
    cookies: "/cookies",
    about: "/about",
    contact: "/contact",
    support: "/support",
    dashboard: "/dashboard",
    practice: "/practice",
    learning: "/learning",
    social: "/social",
    pricing: "/pricing",
  },
} as const;

export type SiteConfig = typeof siteConfig;

function cleanUrlString(rawUrl: string): string {
  let cleaned = rawUrl
    .replaceAll("[", "")
    .replaceAll("]", "")
    .replaceAll("(", "")
    .replaceAll(")", "")
    .replaceAll('"', "")
    .replaceAll("'", "")
    .trim();

  while (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }

  return cleaned;
}

function ensureProtocol(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return url.startsWith("localhost") || url.startsWith("127.0.0.1")
    ? `http://${url}`
    : `https://${url}`;
}

/**
 * Resolves the canonical public site URL.
 * Priority:
 * 1. Vercel Production: Always use "https://govstudyx.com"
 * 2. Configured site URL (including Vercel Preview, development, and tests)
 * 3. Vercel Preview deployment URL
 * 4. Non-Vercel production: Default to "https://govstudyx.com"
 * 5. Local development: Default to "http://localhost:3000"
 */
export function getSiteUrl(): string {
  const vercelEnvironment =
    process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;

  if (vercelEnvironment === "production") {
    return siteConfig.url;
  }

  const configuredUrl =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

  if (configuredUrl) {
    const cleaned = cleanUrlString(configuredUrl);
    if (cleaned.length > 0) {
      return ensureProtocol(cleaned);
    }
  }

  if (vercelEnvironment === "preview") {
    const previewDomain =
      process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL;

    if (previewDomain) {
      const cleanedPreview = cleanUrlString(previewDomain);
      if (cleanedPreview.length > 0) {
        return ensureProtocol(cleanedPreview);
      }
    }
  }

  if (!vercelEnvironment && process.env.NODE_ENV === "production") {
    return siteConfig.url;
  }

  return "http://localhost:3000";
}