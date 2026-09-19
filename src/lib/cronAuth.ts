// Relative Path: src/lib/cronAuth.ts
import crypto from "crypto";

/**
 * Validates an incoming Authorization Bearer header against the configured cron secret.
 * Strictly fails closed on missing, empty, whitespace-only secrets or malformed headers.
 * Uses constant-time comparison (crypto.timingSafeEqual) to prevent timing attacks.
 */
export function isValidCronSecret(
  authHeader: string | null,
  configuredSecret?: string | null
): boolean {
  const secret = configuredSecret?.trim();
  if (!secret) {
    return false;
  }

  if (!authHeader || typeof authHeader !== "string") {
    return false;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return false;
  }

  const token = match[1].trim();
  if (!token || token === "undefined" || token === "null") {
    return false;
  }

  const tokenBuf = Buffer.from(token, "utf8");
  const secretBuf = Buffer.from(secret, "utf8");

  if (tokenBuf.length !== secretBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuf, secretBuf);
}

