// Relative Path: src/lib/logger/scrubbers.ts

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /pass/i,
  /token/i,
  /authorization/i,
  /auth/i,
  /bearer/i,
  /creditcard/i,
  /card/i,
  /cvv/i,
  /ssn/i,
  /secret/i,
  /apikey/i,
  /api_key/i,
  /cookie/i,
  /session/i,
  /jwt/i,
  /privatekey/i,
];

export function redactSensitiveData<T>(input: T, seen = new WeakSet()): T {
  if (input === null || input === undefined) return input;
  if (typeof input !== "object") return input;

  if (seen.has(input as object)) {
    return "[CIRCULAR_REFERENCE]" as unknown as T;
  }

  seen.add(input as object);

  if (input instanceof Error) {
    const errorObject: Record<string, unknown> = {
      name: input.name,
      message: input.message,
      stack: input.stack,
      cause: (input as Error & { cause?: unknown }).cause,
    };
    return redactSensitiveData(errorObject, seen) as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactSensitiveData(item, seen)) as unknown as T;
  }

  const redactedObj: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));

    if (isSensitiveKey) {
      redactedObj[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redactedObj[key] = redactSensitiveData(value, seen);
    } else if (typeof value === "string" && isSensitiveString(value)) {
      redactedObj[key] = "[REDACTED]";
    } else {
      redactedObj[key] = value;
    }
  }

  return redactedObj as T;
}

function isSensitiveString(value: string): boolean {
  if (/^bearer\s+[a-zA-Z0-9\-_.]+/i.test(value)) return true;
  if (/^eyJ[a-zA-Z0-9\-_.]+\.[a-zA-Z0-9\-_.]+/i.test(value)) return true;
  return false;
}
