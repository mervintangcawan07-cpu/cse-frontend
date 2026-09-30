// Relative Path: src/lib/cronAuth.ts
import crypto from "crypto";

export function isValidCronSecret(
  authHeader: string | null,
  configuredSecret?: string | null
): boolean {
  const secret = configuredSecret?.trim();
  if (!secret) return false;

  if (!authHeader || typeof authHeader !== "string") return false;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const token = match[1].trim();
  if (!token || token === "undefined" || token === "null") return false;

  // SHA-256 normalization eliminates buffer length timing leaks
  const tokenHash = crypto.createHash("sha256").update(token, "utf8").digest();
  const secretHash = crypto.createHash("sha256").update(secret, "utf8").digest();

  return crypto.timingSafeEqual(tokenHash, secretHash);
}