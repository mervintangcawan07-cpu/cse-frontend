// Relative Path: src/lib/auth/sudoMode.ts
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger/logger";
import { SudoTicket } from "@/types/auth";
import { SUDO_LIMITER } from "@/lib/ratelimit";

function getSudoSecret(): string {
  const secret = process.env.SUDO_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "Configuration Error: SUDO_SECRET must be configured with a dedicated secret distinct from JWT_SECRET."
    );
  }
  return secret.trim();
}

const SUDO_TTL_MS = 10 * 60 * 1000;
const MAX_SUDO_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const attemptTracker = new Map<string, { count: number; resetAt: number }>();

export async function checkSudoRateLimit(identifier: string): Promise<{
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSec?: number;
}> {
  const hashedIdentifier = crypto
    .createHash("sha256")
    .update(identifier)
    .digest("hex")
    .slice(0, 32);

  if (SUDO_LIMITER) {
    try {
      const result = await SUDO_LIMITER.limit(hashedIdentifier);
      if (!result.success) {
        const now = Date.now();
        const retryAfterSec = Math.max(1, Math.ceil((result.reset - now) / 1000));
        return { allowed: false, remainingAttempts: 0, retryAfterSec };
      }
      return { allowed: true, remainingAttempts: result.remaining };
    } catch (error) {
      logger.warn("[SUDO_RATELIMIT_FALLBACK] Redis error, using process memory:", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const now = Date.now();
  const record = attemptTracker.get(hashedIdentifier);

  if (!record || now > record.resetAt) {
    attemptTracker.set(hashedIdentifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, remainingAttempts: MAX_SUDO_ATTEMPTS - 1 };
  }

  if (record.count >= MAX_SUDO_ATTEMPTS) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSec };
  }

  record.count += 1;
  attemptTracker.set(hashedIdentifier, record);
  return { allowed: true, remainingAttempts: MAX_SUDO_ATTEMPTS - record.count };
}

export async function verifyAdminCredentials(
  userId: string,
  passwordInput: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, role: true },
  });

  if (!user || user.role !== "ADMIN" || !user.password) {
    return false;
  }

  return bcrypt.compare(passwordInput, user.password);
}

export function generateSudoTicket(
  userId: string,
  email: string = "",
  role: string = "ADMIN"
): string {
  const now = Date.now();
  const payload: SudoTicket = {
    userId,
    email,
    role,
    issuedAt: now,
    expiresAt: now + SUDO_TTL_MS,
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const secret = getSudoSecret();
  const serialized = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(serialized)
    .digest("base64url");

  return `${serialized}.${signature}`;
}

export function validateSudoTicket(rawToken: string): {
  valid: boolean;
  ticket?: SudoTicket;
  reason?: string;
} {
  if (!rawToken || typeof rawToken !== "string" || !rawToken.includes(".")) {
    return { valid: false, reason: "INVALID_FORMAT" };
  }

  const [serialized, signature] = rawToken.split(".");
  if (!serialized || !signature) {
    return { valid: false, reason: "INVALID_FORMAT" };
  }

  let expectedSignature: string;
  try {
    const secret = getSudoSecret();
    expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(serialized)
      .digest("base64url");
  } catch {
    return { valid: false, reason: "CONFIG_ERROR" };
  }

  // Constant-time length-safe comparison via SHA-256 digests
  const sigHash = crypto.createHash("sha256").update(signature).digest();
  const expectedHash = crypto.createHash("sha256").update(expectedSignature).digest();

  if (!crypto.timingSafeEqual(sigHash, expectedHash)) {
    return { valid: false, reason: "INVALID_SIGNATURE" };
  }

  try {
    const ticket: SudoTicket = JSON.parse(
      Buffer.from(serialized, "base64url").toString("utf-8")
    );

    if (Date.now() > ticket.expiresAt) {
      return { valid: false, reason: "SUDO_EXPIRED" };
    }

    return { valid: true, ticket };
  } catch {
    return { valid: false, reason: "PARSE_FAILURE" };
  }
}