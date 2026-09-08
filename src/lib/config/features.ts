// Relative Path: src/lib/config/features.ts

/**
 * Central pre-launch feature controls for Study Together and 1v1 Duels.
 *
 * These flags intentionally use NEXT_PUBLIC_* because the UI also needs
 * availability information. They are not secrets.
 *
 * Server-side routes and proxy checks independently evaluate the deployed
 * environment values, so modifying client-side JavaScript cannot enable a
 * feature while the deployed server flag remains OFF.
 *
 * Only the exact string "true" enables a feature.
 */

export function isStudyTogetherEnabled(envValue?: string): boolean {
  const value =
    envValue !== undefined
      ? envValue
      : process.env.NEXT_PUBLIC_STUDY_TOGETHER_ENABLED;

  return value === "true";
}

export function isDuelEnabled(envValue?: string): boolean {
  const value =
    envValue !== undefined
      ? envValue
      : process.env.NEXT_PUBLIC_DUEL_ENABLED;

  return value === "true";
}

/**
 * Client-facing UI availability flags.
 *
 * These control rendering/visibility only.
 * Server routes and proxy enforcement remain authoritative.
 */
export const STUDY_TOGETHER_ENABLED: boolean =
  process.env.NEXT_PUBLIC_STUDY_TOGETHER_ENABLED === "true";

export const DUEL_ENABLED: boolean =
  process.env.NEXT_PUBLIC_DUEL_ENABLED === "true";