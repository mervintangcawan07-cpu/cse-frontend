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

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const MAX_PAGE_NUMBER = 10_000;

export interface BoundedPagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export interface PaginationMetadata {
  page: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

function parsePositiveInteger(value: string | null): number | null {
  if (value === null || !/^[1-9]\d*$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function validateBoundedPaginationQuery(
  searchParams: URLSearchParams
): ValidationResult<BoundedPagination> {
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  const parsedPage = parsePositiveInteger(pageParam);
  const parsedLimit = parsePositiveInteger(limitParam);
  const errors: Record<string, string[]> = {};

  if (pageParam !== null && (parsedPage === null || parsedPage > MAX_PAGE_NUMBER)) {
    errors.page = [`Page must be an integer between 1 and ${MAX_PAGE_NUMBER}.`];
  }

  if (limitParam !== null && parsedLimit === null) {
    errors.limit = ["Limit must be a positive integer."];
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  const page = parsedPage ?? 1;
  const limit = Math.min(parsedLimit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  return {
    success: true,
    data: {
      page,
      limit,
      skip: (page - 1) * limit,
      take: limit + 1,
    },
  };
}

export function buildBoundedPage<T>(
  rows: T[],
  pagination: BoundedPagination
): { items: T[]; pagination: PaginationMetadata } {
  const hasNextPage = rows.length > pagination.limit;

  return {
    items: rows.slice(0, pagination.limit),
    pagination: {
      page: pagination.page,
      pageSize: pagination.limit,
      hasPreviousPage: pagination.page > 1,
      hasNextPage,
    },
  };
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
