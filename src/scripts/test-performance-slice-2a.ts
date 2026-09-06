import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildBoundedPage,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  validateBoundedPaginationQuery,
} from "../lib/validation/schemas";

function parse(query = "") {
  return validateBoundedPaginationQuery(new URLSearchParams(query));
}

function requireValid(query = "") {
  const result = parse(query);
  assert.equal(result.success, true);
  if (!result.success) throw new Error("Expected valid pagination parameters.");
  return result.data;
}

function pageFromRows<T>(rows: T[], query = "") {
  const pagination = requireValid(query);
  const queriedRows = rows.slice(
    pagination.skip,
    pagination.skip + pagination.take
  );
  return buildBoundedPage(queriedRows, pagination);
}

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const rows = Array.from({ length: 60 }, (_, index) => index + 1);

const defaults = requireValid();
assert.deepEqual(defaults, {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  skip: 0,
  take: DEFAULT_PAGE_SIZE + 1,
});

const firstPage = pageFromRows(rows);
assert.deepEqual(firstPage.items, rows.slice(0, 25));
assert.deepEqual(firstPage.pagination, {
  page: 1,
  pageSize: 25,
  hasPreviousPage: false,
  hasNextPage: true,
});

const nextPage = pageFromRows(rows, "page=2&limit=25");
assert.deepEqual(nextPage.items, rows.slice(25, 50));
assert.equal(nextPage.pagination.hasPreviousPage, true);
assert.equal(nextPage.pagination.hasNextPage, true);

const finalPage = pageFromRows(rows, "page=3&limit=25");
assert.deepEqual(finalPage.items, rows.slice(50));
assert.equal(finalPage.pagination.hasNextPage, false);

const emptyPage = pageFromRows([], "page=1&limit=25");
assert.deepEqual(emptyPage.items, []);
assert.deepEqual(emptyPage.pagination, {
  page: 1,
  pageSize: 25,
  hasPreviousPage: false,
  hasNextPage: false,
});

const beyondPage = pageFromRows(rows, "page=4&limit=25");
assert.deepEqual(beyondPage.items, []);
assert.equal(beyondPage.pagination.hasPreviousPage, true);
assert.equal(beyondPage.pagination.hasNextPage, false);

for (const query of ["page=0", "page=-1", "page=1.5", "page=abc", "page=10001"]) {
  assert.equal(parse(query).success, false, `Expected invalid page: ${query}`);
}

for (const query of ["limit=0", "limit=-1", "limit=1.5", "limit=abc"]) {
  assert.equal(parse(query).success, false, `Expected invalid limit: ${query}`);
}

const clamped = requireValid("page=2&limit=1000000");
assert.equal(clamped.limit, MAX_PAGE_SIZE);
assert.equal(clamped.skip, MAX_PAGE_SIZE);
assert.equal(clamped.take, MAX_PAGE_SIZE + 1);

const searchableRows = Array.from({ length: 80 }, (_, index) => ({
  id: String(index + 1).padStart(3, "0"),
  email: index % 2 === 0 ? `match-${index}@example.com` : `other-${index}@example.com`,
  status: index % 3 === 0 ? "BANNED" : "ACTIVE",
}));
const searched = searchableRows.filter((row) => row.email.includes("match"));
const searchedPage = pageFromRows(searched, "page=2&limit=10");
assert.equal(searchedPage.items.length, 10);
assert.ok(searchedPage.items.every((row) => row.email.includes("match")));

const filtered = searchableRows.filter((row) => row.status === "BANNED");
const filteredPage = pageFromRows(filtered, "page=2&limit=10");
assert.ok(filteredPage.items.every((row) => row.status === "BANNED"));

const orderedRows = Array.from({ length: 53 }, (_, index) => ({
  id: String(index + 1).padStart(3, "0"),
  createdAt: new Date(Date.UTC(2026, 8, Math.floor(index / 3) + 1)).toISOString(),
})).sort((left, right) => {
  const byDate = right.createdAt.localeCompare(left.createdAt);
  return byDate !== 0 ? byDate : right.id.localeCompare(left.id);
});

const sequentialIds = [1, 2, 3]
  .flatMap((page) => pageFromRows(orderedRows, `page=${page}&limit=20`).items)
  .map((row) => row.id);
assert.equal(new Set(sequentialIds).size, orderedRows.length);
assert.deepEqual(sequentialIds, orderedRows.map((row) => row.id));

const userRoute = source("src/app/api/admin/users/route.ts");
const loginHistoryRoute = source("src/app/api/admin/login-history/route.ts");
const supportRoute = source("src/app/api/admin/support-tickets/route.ts");
const usersPage = source("src/app/admin/users/page.tsx");
const systemPage = source("src/app/admin/system/page.tsx");

assert.equal((userRoute.match(/requireAdminAuth\(/g) ?? []).length, 2);
assert.equal((supportRoute.match(/getAuthenticatedSessionResult\(/g) ?? []).length, 2);
assert.equal((loginHistoryRoute.match(/getAuthenticatedSessionResult\(/g) ?? []).length, 1);
assert.ok(
  userRoute.indexOf("await requireAdminAuth(request)") <
    userRoute.indexOf("const paginationResult")
);
assert.ok(
  supportRoute.indexOf("await getAuthenticatedSessionResult()") <
    supportRoute.indexOf("const paginationResult")
);
assert.ok(
  loginHistoryRoute.indexOf("await getAuthenticatedSessionResult()") <
    loginHistoryRoute.indexOf("const paginationResult")
);

for (const route of [userRoute, loginHistoryRoute, supportRoute]) {
  assert.match(route, /orderBy: \[\{ createdAt: "desc" \}, \{ id: "desc" \}\]/);
  assert.match(route, /skip: paginationResult\.data\.skip/);
  assert.match(route, /take: paginationResult\.data\.take/);
  assert.match(route, /pagination: page\.pagination/);
}

assert.match(userRoute, /if \(filter === "PRO"\) where\.isPaid = true/);
assert.match(userRoute, /if \(filter === "BANNED"\) where\.isBanned = true/);
assert.match(userRoute, /export async function PATCH/);
assert.match(supportRoute, /export async function PUT/);
assert.match(loginHistoryRoute, /totalFailedAttempts/);
assert.match(userRoute, /users: page\.items/);
assert.match(loginHistoryRoute, /history: page\.items/);
assert.match(supportRoute, /tickets: page\.items/);

for (const pageSource of [usersPage, systemPage]) {
  assert.match(pageSource, /limit: String\(PAGE_SIZE\)/);
  assert.match(pageSource, />\s*Previous\s*</);
  assert.match(pageSource, />\s*Next\s*</);
}
assert.match(usersPage, /filter,\s*page: String\(page\)/);

console.log("Slice 2A pagination and query-contract tests: PASS");
