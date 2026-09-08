// Relative Path: src/lib/config/features.ts

/**
 * Evaluates whether Study Together / Social Study is enabled.
 * Authoritative evaluation happens server-side via environment configuration.
 * Strictly requires exact "true". Any missing, empty, or falsy value yields false.
 */
export function isStudyTogetherEnabled(envValue?: string): boolean {
  const val =
    envValue !== undefined
      ? envValue
      : process.env.STUDY_TOGETHER_ENABLED ||
        process.env.NEXT_PUBLIC_STUDY_TOGETHER_ENABLED;
  return val === "true";
}

/**
 * Evaluates whether 1v1 Duels Arena is enabled.
 * Authoritative evaluation happens server-side via environment configuration.
 * Strictly requires exact "true". Any missing, empty, or falsy value yields false.
 */
export function isDuelEnabled(envValue?: string): boolean {
  const val =
    envValue !== undefined
      ? envValue
      : process.env.DUEL_ENABLED || process.env.NEXT_PUBLIC_DUEL_ENABLED;
  return val === "true";
}

/**
 * Client-facing feature availability flags.
 * Used exclusively for UI rendering decisions (e.g. hiding navigation links).
 * NEVER use these client constants as a server authorization boundary.
 */
export const STUDY_TOGETHER_ENABLED: boolean = isStudyTogetherEnabled();
export const DUEL_ENABLED: boolean = isDuelEnabled();

