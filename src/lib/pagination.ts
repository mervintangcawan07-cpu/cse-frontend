// Relative Path: src/lib/pagination.ts
export interface BoundedPagination {
  take: number;
  skip: number;
  page: number;
}

export const MAX_PAGE_NUMBER = 10_000;

export function extractPagination(
  urlOrPath: string,
  defaultLimit: number = 50,
  maxLimit: number = 100
): BoundedPagination {
  const safeUrl = urlOrPath.startsWith("http")
    ? new URL(urlOrPath)
    : new URL(urlOrPath, "http://localhost");

  const parsedLimit = parseInt(safeUrl.searchParams.get("limit") || `${defaultLimit}`, 10);
  const parsedPage = parseInt(safeUrl.searchParams.get("page") || "1", 10);

  const take = Math.min(
    Math.max(isNaN(parsedLimit) ? defaultLimit : parsedLimit, 1),
    maxLimit
  );

  // Ceil page to prevent high-offset database starvation
  const page = Math.min(
    Math.max(isNaN(parsedPage) ? 1 : parsedPage, 1),
    MAX_PAGE_NUMBER
  );

  const skip = (page - 1) * take;

  return { take, skip, page };
}