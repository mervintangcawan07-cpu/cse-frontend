// Relative Path: src/lib/validation/sanitizer.ts

/**
 * Sanitizes primitive string inputs by trimming whitespace, stripping script/HTML tags,
 * and removing null bytes to prevent XSS and database string truncation attacks.
 */
export function sanitizeString(input: string): string {
  if (!input) return "";

  return input
    .replace(/\0/g, "") // Remove null bytes
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove script blocks
    .replace(/<[^>]*>/g, "") // Strip HTML tags
    .trim();
}

/**
 * Normalizes email address formatting (lowercases and trims).
 */
export function sanitizeEmail(email: string): string {
  return sanitizeString(email).toLowerCase();
}

/**
 * Recursively traverses objects and arrays to sanitize all contained string properties.
 */
export function sanitizePayload<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === "string") {
    return sanitizeString(input) as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizePayload(item)) as unknown as T;
  }

  if (typeof input === "object" && input.constructor === Object) {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitizedObj[key] = sanitizePayload(value);
    }
    return sanitizedObj as T;
  }

  return input;
}
