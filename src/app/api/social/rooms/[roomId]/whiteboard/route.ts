// Relative Path: src/app/api/social/rooms/[roomId]/whiteboard/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
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

interface WhiteboardAuthorization {
  room: {
    allowMemberWhiteboard: boolean;
  };
  participant: {
    role: "HOST" | "MODERATOR" | "MEMBER";
    canDraw: boolean;
  };
}

type WhiteboardAuthorizationResult =
  | { allowed: true; authorization: WhiteboardAuthorization }
  | { allowed: false; response: NextResponse };

// The current client sends one normalized point per pointer/touch move. This
// generous cap preserves unusually long strokes while bounding request geometry.
const MAX_WHITEBOARD_POINTS_PER_DELTA = 10_000;
const MAX_WHITEBOARD_POINTS_PER_REQUEST = 10_000;
// Match the existing retained-stroke window so one batch cannot exceed stored state.
const MAX_WHITEBOARD_BATCH_SIZE = 500;
// Current client colors are six-digit hex strings and widths are 3 (pen) or 24 (eraser).
const WHITEBOARD_COLOR_LENGTH = 7;
const MAX_WHITEBOARD_WIDTH = 24;
const WHITEBOARD_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDrawPoint(value: unknown): value is DrawPoint {
  if (!isRecord(value)) return false;

  const keys = Object.keys(value);
  return (
    keys.length === 2 &&
    keys.every((key) => key === "x" || key === "y") &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    value.x >= 0 &&
    value.x <= 1 &&
    typeof value.y === "number" &&
    Number.isFinite(value.y) &&
    value.y >= 0 &&
    value.y <= 1
  );
}

function isValidDrawDelta(value: unknown): value is DrawDelta {
  if (!isRecord(value)) return false;

  const keys = Object.keys(value);
  const hasOnlySupportedFields = keys.every(
    (key) => key === "points" || key === "color" || key === "width" || key === "isEraser"
  );

  return (
    hasOnlySupportedFields &&
    Array.isArray(value.points) &&
    value.points.length >= 1 &&
    value.points.length <= MAX_WHITEBOARD_POINTS_PER_DELTA &&
    value.points.every(isValidDrawPoint) &&
    typeof value.color === "string" &&
    value.color.length === WHITEBOARD_COLOR_LENGTH &&
    WHITEBOARD_COLOR_PATTERN.test(value.color) &&
    typeof value.width === "number" &&
    Number.isFinite(value.width) &&
    value.width > 0 &&
    value.width <= MAX_WHITEBOARD_WIDTH &&
    (value.isEraser === undefined || typeof value.isEraser === "boolean")
  );
}

function parseWhiteboardDeltas(body: unknown): DrawDelta[] | null {
  if (!isRecord(body)) return null;

  const keys = Object.keys(body);
  if (keys.length !== 1) return null;

  let candidates: unknown[];
  if (keys[0] === "delta") {
    candidates = [body.delta];
  } else if (keys[0] === "deltas" && Array.isArray(body.deltas)) {
    if (body.deltas.length < 1 || body.deltas.length > MAX_WHITEBOARD_BATCH_SIZE) {
      return null;
    }
    candidates = body.deltas;
  } else {
    return null;
  }

  const deltas: DrawDelta[] = [];
  let totalPoints = 0;
  for (const candidate of candidates) {
    if (!isValidDrawDelta(candidate)) return null;
    totalPoints += candidate.points.length;
    if (totalPoints > MAX_WHITEBOARD_POINTS_PER_REQUEST) return null;
    deltas.push(candidate);
  }

  return deltas;
}

function parseSynchronizationParameter(value: string | null): number | null {
  if (value === null) return 0;
  if (!/^(?:0|[1-9]\d*)$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function authorizeWhiteboardAccess(
  roomId: string,
  userId: string
): Promise<WhiteboardAuthorizationResult> {
  const room = await prisma.studyRoom.findUnique({
    where: { id: roomId },
    select: {
      state: true,
      allowMemberWhiteboard: true,
    },
  });

  if (!room || (room.state !== "ACTIVE" && room.state !== "SCHEDULED")) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Study Room not found or no longer active" },
        { status: 404 }
      ),
    };
  }

  const participant = await prisma.studyRoomParticipant.findUnique({
    where: { roomId_userId: { roomId, userId } },
    select: { role: true, canDraw: true },
  });

  if (!participant) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Access denied to room whiteboard" },
        { status: 403 }
      ),
    };
  }

  return {
    allowed: true,
    authorization: {
      room: { allowMemberWhiteboard: room.allowMemberWhiteboard },
      participant,
    },
  };
}

function hasWhiteboardDrawingAuthority(authorization: WhiteboardAuthorization): boolean {
  const { room, participant } = authorization;
  return (
    participant.role === "HOST" ||
    participant.role === "MODERATOR" ||
    (participant.role === "MEMBER" &&
      room.allowMemberWhiteboard &&
      participant.canDraw)
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> | { roomId: string } }
) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const roomId = String(resolvedParams.roomId);

    const access = await authorizeWhiteboardAccess(roomId, authenticatedUser.id);
    if (!access.allowed) return access.response;

    const { searchParams } = new URL(request.url);
    const sinceVersion = parseSynchronizationParameter(searchParams.get("sinceVersion"));
    const clientClearTime = parseSynchronizationParameter(searchParams.get("clearTime"));

    if (sinceVersion === null || clientClearTime === null) {
      return NextResponse.json(
        { error: "Invalid whiteboard synchronization parameters" },
        { status: 400 }
      );
    }

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
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const roomId = String(resolvedParams.roomId);

    const access = await authorizeWhiteboardAccess(roomId, authenticatedUser.id);
    if (!access.allowed) return access.response;

    if (!hasWhiteboardDrawingAuthority(access.authorization)) {
      return NextResponse.json({ error: "Drawing disabled for this user" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid whiteboard delta payload" },
        { status: 400 }
      );
    }

    const deltas = parseWhiteboardDeltas(body);
    if (!deltas) {
      return NextResponse.json(
        { error: "Invalid whiteboard delta payload" },
        { status: 400 }
      );
    }

    const state = getOrCreateRoomState(roomId);
    state.strokes.push(...deltas);
    state.version += deltas.length;
    state.lastUpdated = Date.now();

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
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> | { roomId: string } }
) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const roomId = String(resolvedParams.roomId);

    const access = await authorizeWhiteboardAccess(roomId, authenticatedUser.id);
    if (!access.allowed) return access.response;

    if (!hasWhiteboardDrawingAuthority(access.authorization)) {
      return NextResponse.json({ error: "Drawing disabled for this user" }, { status: 403 });
    }

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
