// Relative Path: src/app/api/social/rooms/[roomId]/voice-token/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { AccessToken } from "livekit-server-sdk";
import {
  VOICE_TOKEN_LIMITER,
  checkRateLimit,
  createRateLimitResponse,
} from "@/lib/ratelimit";

export async function GET(
  req: Request,
  context: { params: Promise<{ roomId: string }> | { roomId: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rateResult = await checkRateLimit(
      VOICE_TOKEN_LIMITER,
      `voice-token:${String(rawUserId)}`
    );
    if (!rateResult.success) {
      return createRateLimitResponse(
        rateResult,
        "Too many voice connection requests. Please wait a moment before reconnecting."
      );
    }

    const params = await context.params;
    const roomId = params.roomId;

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "LiveKit server credentials are not configured on the server." },
        { status: 500 }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: String(rawUserId),
      name: String(session.name || session.email || "Examinee"),
    });

    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await at.toJwt();

    return NextResponse.json({ success: true, token: jwt });
  } catch (error: any) {
    console.error("[VOICE_TOKEN_ERROR]", error);
    return NextResponse.json({ error: "Failed to generate voice token" }, { status: 500 });
  }
}
