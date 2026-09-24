export interface BoundedPagination {
  take: number;
  skip: number;
  page: number;
}

export function extractPagination(
  url: string,
  defaultLimit: number = 50,
  maxLimit: number = 100
): BoundedPagination {
  const { searchParams } = new URL(url);
  const parsedLimit = parseInt(searchParams.get("limit") || `${defaultLimit}`, 10);
  const parsedPage = parseInt(searchParams.get("page") || "1", 10);

  const take = Math.min(Math.max(isNaN(parsedLimit) ? defaultLimit : parsedLimit, 1), maxLimit);
  const page = Math.max(isNaN(parsedPage) ? 1 : parsedPage, 1);
  const skip = (page - 1) * take;

  return { take, skip, page };
}
