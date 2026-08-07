// Relative Path: src/lib/error/apiHandler.ts

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger/logger";

type ApiRouteHandler = (
  req: NextRequest,
  context?: any
) => Promise<NextResponse> | NextResponse;

export function safeApiHandler(routeName: string, handler: ApiRouteHandler) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    const startTime = performance.now();
    const method = req.method;
    const url = req.nextUrl?.pathname || routeName;

    try {
      const response = await handler(req, context);
      const durationMs = Math.round(performance.now() - startTime);

      logger.info(`API Request Success: ${method} ${routeName}`, {
        request: {
          route: url,
          method,
          statusCode: response.status,
          durationMs,
        },
      });

      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);
      const incidentId = `API-ERR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      logger.error(
        `API Handler Failure in [${method}] ${routeName}`,
        error,
        { incidentId, durationMs },
        {
          route: url,
          method,
          statusCode: 500,
          durationMs,
        }
      );

      return NextResponse.json(
        {
          error: "An unexpected system error occurred while processing your request.",
          incidentId,
        },
        { status: 500 }
      );
    }
  };
}
