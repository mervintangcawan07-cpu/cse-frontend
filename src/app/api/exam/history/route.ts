import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: Request) {
  try {
    const authenticatedUser = await getAuthenticatedUser();

    if (!authenticatedUser) {
      return NextResponse.json({ error: "Unauthorized: Missing user authentication" }, { status: 401 });
    }

    const userId = authenticatedUser.id;

    // Detect if pagination parameters are explicitly supplied
    const url = request?.url ? new URL(request.url) : null;
    const query = url ? new URLSearchParams(url.search) : null;
    const rawPage = query ? query.get("page") : null;
    const rawLimit = query ? query.get("limit") : null;
    const isPaginated = rawPage !== null || rawLimit !== null;

    let history: any[] = [];
    let total = 0;
    let page = DEFAULT_PAGE;
    let limit = DEFAULT_LIMIT;

    if (isPaginated) {
      const parsedPage = rawPage ? parseInt(rawPage, 10) : DEFAULT_PAGE;
      const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : DEFAULT_LIMIT;

      page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : DEFAULT_PAGE;
      const validLimit = Number.isInteger(parsedLimit) && parsedLimit >= 1 ? parsedLimit : DEFAULT_LIMIT;
      limit = Math.min(validLimit, MAX_LIMIT);

      const skip = (page - 1) * limit;

      try {
        const [results, count] = await Promise.all([
          prisma.examResult.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.examResult.count({ where: { userId } }),
        ]);
        history = results;
        total = count;
      } catch (dbErr) {
        if ((prisma as any).examAttempt) {
          const [attempts, count] = await Promise.all([
            (prisma as any).examAttempt.findMany({
              where: { userId },
              orderBy: { createdAt: "desc" },
              skip,
              take: limit,
            }),
            (prisma as any).examAttempt.count({ where: { userId } }),
          ]);
          history = attempts;
          total = count;
        }
      }
    } else {
      // Unbounded backward-compatible query for legacy callers without pagination parameters
      try {
        history = await prisma.examResult.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
      } catch (dbErr) {
        if ((prisma as any).examAttempt) {
          history = await (prisma as any).examAttempt.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
          });
        }
      }
    }

    // Standardize object fields
    const formattedHistory = history.map((item) => ({
      id: item.id,
      score: item.score ?? item.correct ?? 0,
      totalItems: item.totalItems ?? 170,
      percentage: item.percentage ?? (item.totalItems ? Math.round((item.correct / item.totalItems) * 100) : item.score),
      correct: item.correct ?? item.score ?? 0,
      incorrect: item.incorrect ?? 0,
      skipped: item.skipped ?? 0,
      createdAt: item.createdAt,
    }));

    if (isPaginated) {
      const totalPages = Math.ceil(total / limit) || 1;
      return NextResponse.json(
        {
          history: formattedHistory,
          attempts: formattedHistory,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page * limit < total,
            hasPrevious: page > 1,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ history: formattedHistory, attempts: formattedHistory }, { status: 200 });
  } catch (error: any) {
    console.error("[EXAMS_HISTORY_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch exam history", details: error?.message },
      { status: 500 }
    );
  }
}