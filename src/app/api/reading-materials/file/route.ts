import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildHandbookBinaryEtag,
  matchesEtag,
  BINARY_BROWSER_CACHE_HEADERS,
  BINARY_ERROR_CACHE_HEADERS,
} from "@/lib/cache/binaryCache";

/**
 * GET /api/reading-materials/file?id=<handbookId>
 *
 * Serves Handbook binary file bytes with conditional GET support (RFC 7232).
 *
 * Slice 4C fixes: the previous implementation used a one-year immutable
 * browser cache policy which is incorrect because an administrator can replace
 * fileData on the same Handbook id via PUT /api/reading-materials.
 *
 * New policy:
 *   - Weak ETag derived from Handbook.updatedAt milliseconds.
 *   - Browser sends If-None-Match on subsequent requests.
 *   - Metadata-only query first (select: { updatedAt }) when If-None-Match is
 *     present to avoid fetching large fileData blobs unnecessarily.
 *   - 304 Not Modified when ETag matches (browser reuses its cached bytes).
 *   - 200 with full payload when ETag differs or no conditional header.
 *   - Cache-Control: private, no-cache, max-age=0, must-revalidate
 *     Browser retains copy for conditional reuse; CDN is told no-store.
 *
 * Authorization: preserved unchanged from pre-Slice-4C implementation.
 * Range requests: out of scope for Slice 4C.
 * Schema changes: none — Handbook.updatedAt @updatedAt is already in schema.
 */
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return new NextResponse("Missing document ID", {
        status: 400,
        headers: BINARY_ERROR_CACHE_HEADERS,
      });
    }

    const ifNoneMatch = req.headers.get("If-None-Match");

    // ------------------------------------------------------------------
    // Fast path: If-None-Match present → metadata-only query to build ETag
    // without fetching the potentially large fileData blob.
    // ------------------------------------------------------------------
    if (ifNoneMatch) {
      const meta = await prisma.handbook.findUnique({
        where: { id },
        select: { updatedAt: true },
      });

      if (!meta) {
        return new NextResponse("File not found", {
          status: 404,
          headers: BINARY_ERROR_CACHE_HEADERS,
        });
      }

      const etag = buildHandbookBinaryEtag(id, meta.updatedAt);

      if (matchesEtag(ifNoneMatch, etag)) {
        // Client holds the current version — skip full DB read.
        return new NextResponse(null, {
          status: 304,
          headers: {
            ETag: etag,
            ...BINARY_BROWSER_CACHE_HEADERS,
          },
        });
      }
      // ETag mismatch — fall through to full query below.
    }

    // ------------------------------------------------------------------
    // Full query: fetch file bytes (and updatedAt for ETag).
    // ------------------------------------------------------------------
    const handbook = await prisma.handbook.findUnique({
      where: { id },
      select: { fileData: true, fileName: true, updatedAt: true },
    });

    if (!handbook || !handbook.fileData) {
      return new NextResponse("File not found", {
        status: 404,
        headers: BINARY_ERROR_CACHE_HEADERS,
      });
    }

    const etag = buildHandbookBinaryEtag(id, handbook.updatedAt);

    // Re-check: in the rare case the If-None-Match path was skipped entirely
    // (no conditional header on first load), or if updatedAt changed between
    // the two queries, a second match check is harmless and correct.
    if (ifNoneMatch && matchesEtag(ifNoneMatch, etag)) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          ...BINARY_BROWSER_CACHE_HEADERS,
        },
      });
    }

    let contentType = "application/pdf";
    const lowerName = handbook.fileName.toLowerCase();

    if (lowerName.endsWith(".doc")) {
      contentType = "application/msword";
    } else if (lowerName.endsWith(".docx")) {
      contentType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else if (lowerName.endsWith(".txt")) {
      contentType = "text/plain";
    }

    const base64Data = handbook.fileData.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${handbook.fileName || "document"}"`,
        ETag: etag,
        ...BINARY_BROWSER_CACHE_HEADERS,
      },
    });
  } catch (error) {
    console.error("[FILE_STREAM_ERROR]", error);
    return new NextResponse("Internal Server Error", {
      status: 500,
      headers: BINARY_ERROR_CACHE_HEADERS,
    });
  }
}