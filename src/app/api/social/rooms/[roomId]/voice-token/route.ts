// Relative Path: src/app/api/social/rooms/[roomId]/voice-token/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
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
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rateResult = await checkRateLimit(
      VOICE_TOKEN_LIMITER,
      `voice-token:${authenticatedUser.id}`
    );
    if (!rateResult.success) {
      return createRateLimitResponse(
        rateResult,
        "Too many voice connection requests. Please wait a moment before reconnecting."
      );
    }

    const params = await context.params;
    const roomId = params.roomId;

    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
      select: { state: true },
    });

    if (!room || (room.state !== "ACTIVE" && room.state !== "SCHEDULED")) {
      return NextResponse.json(
        { error: "Study Room not found or no longer active" },
        { status: 404 }
      );
    }

    const participant = await prisma.studyRoomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: authenticatedUser.id,
        },
      },
      select: { id: true },
    });

    if (!participant) {
      return NextResponse.json({ error: "Access denied to room voice" }, { status: 403 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "LiveKit server credentials are not configured on the server." },
        { status: 500 }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: authenticatedUser.id,
      name: authenticatedUser.name || authenticatedUser.email || "Examinee",
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
