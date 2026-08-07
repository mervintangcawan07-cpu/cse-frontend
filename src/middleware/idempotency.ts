// Relative Path: src/middleware/idempotency.ts

import { NextRequest, NextResponse } from "next/server";
import { idempotencyStore } from "@/lib/security/idempotency";
import { logger } from "@/lib/logger/logger";

type IdempotentRouteHandler = (
  req: NextRequest,
  context?: any
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps an API route with duplicate submission protection based on the X-Idempotency-Key header.
 */
export function withIdempotency(handler: IdempotentRouteHandler) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    // Only enforce idempotency on state-changing HTTP methods
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      return handler(req, context);
    }

    const idempotencyKey = req.headers.get("x-idempotency-key") || req.headers.get("idempotency-key");

    // If client provided no idempotency key, proceed standard execution
    if (!idempotencyKey) {
      return handler(req, context);
    }

    const key = `${req.nextUrl.pathname}:${idempotencyKey}`;
    const result = idempotencyStore.acquire(key);

    if (result.status === "PENDING") {
      logger.warn(`Duplicate Concurrent Request Blocked: ${req.nextUrl.pathname}`, {
        request: { route: req.nextUrl.pathname, method: req.method, statusCode: 409 },
        context: { idempotencyKey },
      });

      return NextResponse.json(
        { error: "A request with this idempotency key is currently being processed." },
        { status: 409 }
      );
    }

    if (result.status === "RESOLVED" && result.record) {
      logger.info(`Idempotent Cached Response Served: ${req.nextUrl.pathname}`, {
        request: { route: req.nextUrl.pathname, method: req.method, statusCode: result.record.statusCode },
        context: { idempotencyKey },
      });

      return NextResponse.json(result.record.responseBody, {
        status: result.record.statusCode || 200,
        headers: { "X-Cache-Lookup": "HIT-IDEMPOTENT" },
      });
    }

    try {
      const response = await handler(req, context);
      
      // Clone response body to store in cache
      const clonedRes = response.clone();
      let responseData: unknown;
      try {
        responseData = await clonedRes.json();
      } catch {
        responseData = { message: "Action completed successfully" };
      }

      if (response.status >= 200 && response.status < 300) {
        idempotencyStore.resolve(key, response.status, responseData);
      } else {
        // Release lock if API returned an error status so user can retry
        idempotencyStore.release(key);
      }

      return response;
    } catch (error) {
      idempotencyStore.release(key);
      throw error;
    }
  };
}
