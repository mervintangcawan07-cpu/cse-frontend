// Relative Path: src/app/api/social/rooms/[roomId]/whiteboard/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface DrawPoint {
  x: number;
  y: number;
}

export interface DrawDelta {
  points: DrawPoint[];
  color: string;
  width: number;
  isEraser?: boolean;
}

interface RoomWhiteboardState {
  strokes: DrawDelta[];
  clearTimestamp: number;
  version: number;
  lastUpdated: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __roomWhiteboardStore: Map<string, RoomWhiteboardState> | undefined;
}

if (!globalThis.__roomWhiteboardStore) {
  globalThis.__roomWhiteboardStore = new Map<string, RoomWhiteboardState>();
}

const whiteboardStore = globalThis.__roomWhiteboardStore;

function getOrCreateRoomState(roomId: string): RoomWhiteboardState {
  let state = whiteboardStore.get(roomId);
  if (!state) {
    state = {
      strokes: [],
      clearTimestamp: 0,
      version: 0,
      lastUpdated: Date.now(),
    };
    whiteboardStore.set(roomId, state);
  }
  return state;
}

// Clean up stale room whiteboards older than 24 hours
function cleanStaleWhiteboards() {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  for (const [roomId, state] of whiteboardStore.entries()) {
    if (now - state.lastUpdated > ONE_DAY) {
      whiteboardStore.delete(roomId);
    }
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> | { roomId: string } }
) {
  try {
    const resolvedParams = await params;
    const roomId = String(resolvedParams.roomId);

    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    // Verify user is in room or room is valid
    const participant = await prisma.studyRoomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!participant) {
      // Check if user is host or room is public
      const room = await prisma.studyRoom.findUnique({
        where: { id: roomId },
        select: { id: true, hostId: true },
      });
      if (!room) {
        return NextResponse.json({ error: "Room not found" }, { status: 404 });
      }
    }

    const { searchParams } = new URL(request.url);
    const sinceVersion = parseInt(searchParams.get("sinceVersion") || "0", 10);
    const clientClearTime = parseInt(searchParams.get("clearTime") || "0", 10);

    const state = getOrCreateRoomState(roomId);

    // If room was cleared on server after client's clear time
    const needsFullReset = state.clearTimestamp > clientClearTime;

    if (needsFullReset || sinceVersion <= 0 || sinceVersion > state.version) {
      return NextResponse.json({
        success: true,
        fullSync: true,
        version: state.version,
        clearTimestamp: state.clearTimestamp,
        strokes: state.strokes,
      });
    }

    // Delta sync: send strokes from sinceVersion to current version
    const newStrokes = state.strokes.slice(sinceVersion);

    return NextResponse.json({
      success: true,
      fullSync: false,
      version: state.version,
      clearTimestamp: state.clearTimestamp,
      strokes: newStrokes,
    });
  } catch (error: any) {
    console.error("[WHITEBOARD_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch whiteboard state" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> | { roomId: string } }
) {
  try {
    const resolvedParams = await params;
    const roomId = String(resolvedParams.roomId);

    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    const participant = await prisma.studyRoomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (participant && !participant.canDraw && participant.role === "MEMBER") {
      return NextResponse.json({ error: "Drawing disabled for this user" }, { status: 403 });
    }

    const body = await request.json();
    const state = getOrCreateRoomState(roomId);

    if (body.delta) {
      state.strokes.push(body.delta);
      state.version += 1;
      state.lastUpdated = Date.now();
    } else if (Array.isArray(body.deltas)) {
      state.strokes.push(...body.deltas);
      state.version += body.deltas.length;
      state.lastUpdated = Date.now();
    }

    // Cap strokes array at 500 items to conserve memory while preserving detailed drawings
    if (state.strokes.length > 500) {
      state.strokes = state.strokes.slice(-500);
    }

    cleanStaleWhiteboards();

    return NextResponse.json({
      success: true,
      version: state.version,
      strokeCount: state.strokes.length,
    });
  } catch (error: any) {
    console.error("[WHITEBOARD_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to save whiteboard stroke" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> | { roomId: string } }
) {
  try {
    const resolvedParams = await params;
    const roomId = String(resolvedParams.roomId);

    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const state = getOrCreateRoomState(roomId);
    state.strokes = [];
    state.clearTimestamp = Date.now();
    state.version += 1;
    state.lastUpdated = Date.now();

    return NextResponse.json({
      success: true,
      version: state.version,
      clearTimestamp: state.clearTimestamp,
    });
  } catch (error: any) {
    console.error("[WHITEBOARD_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to clear whiteboard" }, { status: 500 });
  }
}
