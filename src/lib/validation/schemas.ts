// Relative Path: src/lib/validation/schemas.ts

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationError {
  success: false;
  errors: Record<string, string[]>;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface LoginPayload {
  email?: string;
  password?: string;
}

export function validateLoginSchema(data: LoginPayload): ValidationResult<Required<LoginPayload>> {
  const errors: Record<string, string[]> = {};

  const email = data.email?.trim().toLowerCase() || "";
  const password = data.password || "";

  if (!email) {
    errors.email = ["Email address is required."];
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = ["Invalid email format."];
  }

  if (!password) {
    errors.password = ["Password is required."];
  } else if (password.length < 6) {
    errors.password = ["Password must be at least 6 characters."];
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { email, password },
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export function validatePaginationQuery(
  searchParams: URLSearchParams
): ValidationResult<Required<PaginationQuery>> {
  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const rawLimit = parseInt(searchParams.get("limit") || "10", 10);

  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 100);

  return {
    success: true,
    data: { page, limit },
  };
}
