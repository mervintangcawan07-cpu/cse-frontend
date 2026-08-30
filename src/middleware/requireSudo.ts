// Relative Path: src/middleware/requireSudo.ts

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger/logger";
import { validateSudoTicket } from "@/lib/auth/sudoMode";
import { SudoErrorResponse } from "@/types/auth";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";

type SudoProtectedHandler = (
  req: NextRequest,
  context?: any
) => Promise<NextResponse> | NextResponse;

export function requireSudo(handler: SudoProtectedHandler) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    const route = req.nextUrl?.pathname || "/api/admin";
    const method = req.method;

    const sudoHeader = req.headers.get("x-sudo-token");
    const sudoCookie = req.cookies.get("cse_sudo_token")?.value;
    const token = sudoHeader || sudoCookie;

    if (!token) {
      logger.warn(`Sudo Elevation Required: Blocked [${method}] ${route}`, {
        request: { route, method, statusCode: 403 },
        context: { reason: "MISSING_SUDO_TOKEN" },
      });

      const payload: SudoErrorResponse = {
        error: "Critical action requires password re-authentication (Sudo Mode).",
        code: "SUDO_REQUIRED",
      };

      const res = NextResponse.json(payload, { status: 403 });
      res.headers.set("X-Sudo-Required", "true");
      return res;
    }

    const verification = validateSudoTicket(token);

    if (!verification.valid || !verification.ticket) {
      const code =
        verification.reason === "SUDO_EXPIRED" ? "SUDO_EXPIRED" : "INVALID_SUDO_TOKEN";

      logger.warn(`Sudo Re-Authentication Denied: [${method}] ${route}`, {
        request: { route, method, statusCode: 403 },
        context: { reason: verification.reason },
      });

      const payload: SudoErrorResponse = {
        error:
          verification.reason === "SUDO_EXPIRED"
            ? "Your elevated Sudo session has expired. Please re-enter your password."
            : "Invalid Sudo elevation ticket.",
        code,
      };

      const res = NextResponse.json(payload, { status: 403 });
      res.headers.set("X-Sudo-Required", "true");
      return res;
    }

    const authResult = await getAuthenticatedSessionResult(req);
    if (
      !authResult.authenticated ||
      authResult.session.user.role !== "ADMIN" ||
      authResult.session.user.id !== verification.ticket.userId
    ) {
      logger.warn(`Sudo Elevation Denied: Primary Session Mismatch or Inactive [${method}] ${route}`, {
        request: { route, method, statusCode: 403 },
        context: {
          ticketUserId: verification.ticket.userId,
          authCode: !authResult.authenticated ? authResult.code : "ROLE_OR_IDENTITY_MISMATCH",
        },
      });

      const payload: SudoErrorResponse = {
        error: "Critical action requires password re-authentication (Sudo Mode).",
        code: "SUDO_REQUIRED",
      };

      const res = NextResponse.json(payload, { status: 403 });
      res.headers.set("X-Sudo-Required", "true");
      return res;
    }

    logger.info(`Sudo Mode Authorized: Executing [${method}] ${route}`, {
      user: { hashedUserId: verification.ticket.userId, role: verification.ticket.role },
      request: { route, method },
    });

    return handler(req, context);
  };
}