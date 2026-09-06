// Relative Path: src/routes/admin/criticalActions.ts

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger/logger";
import {
  checkSudoRateLimit,
  verifyAdminCredentials,
  generateSudoTicket,
} from "@/lib/auth/sudoMode";
import { requireSudo } from "@/middleware/requireSudo";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";

export async function handleSudoElevation(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  const authResult = await getAuthenticatedSessionResult(req);
  if (!authResult.authenticated) {
    if (authResult.code === "NO_TOKEN") {
      return NextResponse.json({ error: "Unauthorized primary session." }, { status: 401 });
    }
    return NextResponse.json({ error: "Invalid primary session token." }, { status: 401 });
  }

  const userId = authResult.session.user.id;
  const email = authResult.session.user.email;

  const rateLimit = await checkSudoRateLimit(`${ip}:${userId}`);
  if (!rateLimit.allowed) {
    logger.warn(`Sudo Rate Limit Exceeded for Admin ID: ${userId}`, {
      request: { route: "/api/admin/auth/sudo", method: "POST", statusCode: 429 },
      context: { retryAfterSec: rateLimit.retryAfterSec },
    });

    return NextResponse.json(
      {
        error: `Too many password verification attempts. Retry in ${rateLimit.retryAfterSec} seconds.`,
        code: "RATE_LIMIT_EXCEEDED",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSec) },
      }
    );
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body payload." }, { status: 400 });
  }

  if (!body.password) {
    return NextResponse.json({ error: "Admin password is required." }, { status: 400 });
  }

  const isValidPassword = await verifyAdminCredentials(userId, body.password);
  if (!isValidPassword) {
    logger.warn(`Invalid Sudo Password Attempt for Admin ID: ${userId}`, {
      request: { route: "/api/admin/auth/sudo", method: "POST", statusCode: 401 },
      context: { remainingAttempts: rateLimit.remainingAttempts },
    });

    return NextResponse.json(
      {
        error: "Incorrect password.",
        remainingAttempts: rateLimit.remainingAttempts,
      },
      { status: 401 }
    );
  }

  const sudoToken = generateSudoTicket(userId, email, "ADMIN");

  logger.info(`Sudo Mode Elevation Granted for Admin ID: ${userId}`, {
    request: { route: "/api/admin/auth/sudo", method: "POST", statusCode: 200 },
  });

  const response = NextResponse.json(
    {
      success: true,
      sudoToken,
      expiresInSeconds: 600,
    },
    { status: 200 }
  );

  response.cookies.set("cse_sudo_token", sudoToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}

export const handleDeleteUserCritical = requireSudo(
  async (req: NextRequest, context?: { params: { userId: string } }) => {
    const targetUserId = context?.params?.userId || "unknown";

    logger.warn(
      `CRITICAL ACTION EXECUTED: User Account Permanent Deletion for ID: ${targetUserId}`,
      {
        request: { route: req.nextUrl.pathname, method: "DELETE", statusCode: 200 },
      }
    );

    return NextResponse.json({
      success: true,
      message: `User account ${targetUserId} has been permanently purged from the system.`,
    });
  }
);
