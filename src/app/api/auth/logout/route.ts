import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getPresentedSessionId,
  isValidIdentifier,
} from "@/lib/accountLifecycle";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out successfully" }, { status: 200 });

  // Cookie expiration is unconditional, including when token parsing or the
  // best-effort matching-session database update fails.
  response.cookies.set("cse_session", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });
  response.cookies.set("cse_sudo_token", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (token) {
      const payload = await verifyJWT(token);
      const sessionId = payload ? getPresentedSessionId(payload) : null;

      if (payload && isValidIdentifier(payload.userId) && sessionId) {
        await prisma.user.updateMany({
          where: {
            id: payload.userId,
            activeSessionId: sessionId,
          },
          data: {
            activeSessionId: null,
            lastActiveAt: null,
          },
        });
      }
    }

    return response;
  } catch (error) {
    console.error("[AUTH_LOGOUT_ERROR]", error);
    return response;
  }
}
