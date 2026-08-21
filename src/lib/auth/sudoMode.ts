// Relative Path: src/lib/auth/sudoMode.ts

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger/logger";
import { SudoTicket } from "@/types/auth";

function getSudoSecret(): string {
  const secret = process.env.SUDO_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error("Critical Configuration Error: Required environment variable SUDO_SECRET or JWT_SECRET is not configured.");
  }
  return secret.trim();
}

const SUDO_TTL_MS = 10 * 60 * 1000;
const MAX_SUDO_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const attemptTracker = new Map<string, { count: number; resetAt: number }>();

export function checkSudoRateLimit(identifier: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSec?: number;
} {
  const now = Date.now();
  const record = attemptTracker.get(identifier);

  if (!record || now > record.resetAt) {
    attemptTracker.set(identifier, {
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
  attemptTracker.set(identifier, record);
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
    nonce: crypto.randomBytes(8).toString("hex"),
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

  if (signature.length !== expectedSignature.length) {
    return { valid: false, reason: "INVALID_SIGNATURE" };
  }

  try {
    const isSignatureValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isSignatureValid) {
      return { valid: false, reason: "INVALID_SIGNATURE" };
    }

    const ticket: SudoTicket = JSON.parse(
      Buffer.from(serialized, "base64url").toString("utf-8")
    );

    const now = Date.now();
    if (now > ticket.expiresAt) {
      return { valid: false, reason: "SUDO_EXPIRED" };
    }

    return { valid: true, ticket };
  } catch {
    return { valid: false, reason: "PARSE_FAILURE" };
  }
}
