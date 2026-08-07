// Relative Path: src/middleware/validate.ts

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger/logger";
import { sanitizePayload } from "@/lib/validation/sanitizer";
import { ValidationResult } from "@/lib/validation/schemas";

type RouteHandlerWithValidatedBody<T> = (
  req: NextRequest,
  validatedBody: T,
  context?: any
) => Promise<NextResponse> | NextResponse;

/**
 * Higher-order middleware wrapper that sanitizes body payloads,
 * validates against a schema, and responds with a 400 error on validation failure.
 */
export function withValidatedBody<T>(
  validator: (data: unknown) => ValidationResult<T>,
  handler: RouteHandlerWithValidatedBody<T>
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    let rawBody: unknown;

    try {
      rawBody = await req.json();
    } catch {
      logger.warn("Malformed JSON body in request", {
        request: { route: req.nextUrl.pathname, method: req.method },
      });

      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    // 1. Sanitize payload against script/tag injections
    const sanitizedBody = sanitizePayload(rawBody);

    // 2. Validate payload bounds
    const validation = validator(sanitizedBody);

    if (!validation.success) {
      logger.warn(`Validation Failure: [${req.method}] ${req.nextUrl.pathname}`, {
        request: { route: req.nextUrl.pathname, method: req.method, statusCode: 400 },
        context: { errors: validation.errors },
      });

      return NextResponse.json(
        {
          error: "Validation failed.",
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    return handler(req, validation.data, context);
  };
}
