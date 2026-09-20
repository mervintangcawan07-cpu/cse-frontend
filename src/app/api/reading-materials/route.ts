import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/serverAuth";
import { cachedJsonResponse, CACHE_PROFILES } from "@/lib/cache";
import { getCachedReadingMaterials, revalidateReadingMaterialsCatalog } from "@/lib/cache/serverCache";

// GET: Fetch all handbooks metadata via Authoritative Server Data Cache
export async function GET() {
  try {
    const handbooks = await getCachedReadingMaterials();
    return cachedJsonResponse(
      { handbooks },
      "DATA_CACHE_ONLY"
    );
  } catch (error) {
    console.error("[READING_MATERIALS_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch handbooks" },
      { status: 500, headers: CACHE_PROFILES.PRIVATE }
    );
  }
}

/**
 * 🗜️ Inspects actual ZIP entry headers (PK\x03\x04 and PK\x01\x02) to verify internal files.
 */
function hasZipEntry(buf: Buffer, targetName: string): boolean {
  if (buf.length < 30) return false;
  for (let i = 0; i <= buf.length - 30; i++) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b) {
      // Local file header (PK\x03\x04)
      if (buf[i + 2] === 0x03 && buf[i + 3] === 0x04) {
        const nameLen = buf.readUInt16LE(i + 26);
        if (nameLen > 0 && i + 30 + nameLen <= buf.length) {
          if (buf.toString("utf8", i + 30, i + 30 + nameLen) === targetName) return true;
        }
      }
      // Central directory header (PK\x01\x02)
      if (buf[i + 2] === 0x01 && buf[i + 3] === 0x02 && i + 46 <= buf.length) {
        const nameLen = buf.readUInt16LE(i + 28);
        if (nameLen > 0 && i + 46 + nameLen <= buf.length) {
          if (buf.toString("utf8", i + 46, i + 46 + nameLen) === targetName) return true;
        }
      }
    }
  }
  return false;
}

function validateFilePayload(fileData: string, rawFileName?: string): { fileName: string; error?: string; status?: number } {
  if (typeof fileData !== "string" || !fileData.trim()) {
    return { fileName: "", error: "File data is required", status: 400 };
  }

  const base64Data = fileData.replace(/^data:[^;]+;base64,/, "");
  // Early pre-check before buffer allocation: 3 MB decoded is ~4.195 MB base64
  if (base64Data.length > 4.5 * 1024 * 1024) {
    return { fileName: "", error: "File size exceeds 3MB limit", status: 413 };
  }
  const buffer = Buffer.from(base64Data, "base64");

  // 3 MB decoded limit
  const MAX_FILE_SIZE = 3 * 1024 * 1024;
  if (buffer.byteLength > MAX_FILE_SIZE) {
    return { fileName: "", error: "File size exceeds 3MB limit", status: 413 };
  }

  const safeFileName = (rawFileName || "document.pdf").replace(/[\r\n"\\/]/g, "_").trim() || "document.pdf";
  const lowerName = safeFileName.toLowerCase();

  const isPdf = lowerName.endsWith(".pdf");
  const isDocx = lowerName.endsWith(".docx");
  const isTxt = lowerName.endsWith(".txt");

  if (!isPdf && !isDocx && !isTxt) {
    return {
      fileName: safeFileName,
      error: "Invalid file type. Only .pdf, .docx, and .txt files are allowed (.doc is not supported)",
      status: 400,
    };
  }

  if (isPdf) {
    if (buffer.length < 5 || !buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      return { fileName: safeFileName, error: "Invalid PDF format: missing PDF file signature", status: 400 };
    }
  } else if (isDocx) {
    const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    if (buffer.length < 4 || !buffer.subarray(0, 4).equals(zipHeader)) {
      return { fileName: safeFileName, error: "Invalid DOCX format: missing ZIP signature", status: 400 };
    }
    const hasContentTypes = hasZipEntry(buffer, "[Content_Types].xml");
    const hasWordDocument = hasZipEntry(buffer, "word/document.xml");
    if (!hasContentTypes || !hasWordDocument) {
      return { fileName: safeFileName, error: "Invalid DOCX format: missing required document structures", status: 400 };
    }
  } else if (isTxt) {
    try {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      const text = decoder.decode(buffer);
      if (text.includes("\0")) {
        return { fileName: safeFileName, error: "Invalid TXT format: binary content detected", status: 400 };
      }
    } catch {
      return { fileName: safeFileName, error: "Invalid TXT format: text is not valid UTF-8", status: 400 };
    }
  }

  return { fileName: safeFileName };
}

// POST: Upload a new handbook
export async function POST(req: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { title, category, description, pages, fileData, fileName } = body;

    if (typeof title !== "string" || !title.trim() || title.trim().length > 200) {
      return NextResponse.json({ error: "Title must be between 1 and 200 characters" }, { status: 400 });
    }
    if (typeof category !== "string" || !category.trim() || category.trim().length > 100) {
      return NextResponse.json({ error: "Category must be between 1 and 100 characters" }, { status: 400 });
    }
    if (typeof description !== "string" || !description.trim() || description.trim().length > 2000) {
      return NextResponse.json({ error: "Description must be between 1 and 2000 characters" }, { status: 400 });
    }
    if (pages !== undefined && pages !== null && (typeof pages !== "string" || pages.length > 50)) {
      return NextResponse.json({ error: "Pages description must not exceed 50 characters" }, { status: 400 });
    }

    const fileResult = validateFilePayload(fileData, fileName);
    if (fileResult.error) {
      return NextResponse.json({ error: fileResult.error }, { status: fileResult.status || 400 });
    }

    const handbook = await prisma.handbook.create({
      data: {
        title: title.trim(),
        category: category.trim(),
        description: description.trim(),
        pages: pages && typeof pages === "string" ? pages.trim() : "Official Ref",
        fileData,
        fileName: fileResult.fileName,
      },
    });
    revalidateReadingMaterialsCatalog();
    return NextResponse.json({ handbook }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create handbook" }, { status: 500 });
  }
}

// PUT: Update an existing handbook
export async function PUT(req: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { id, title, category, description, pages, fileData, fileName } = body;
    if (!id || typeof id !== "string") return NextResponse.json({ error: "Handbook ID required" }, { status: 400 });

    if (typeof title !== "string" || !title.trim() || title.trim().length > 200) {
      return NextResponse.json({ error: "Title must be between 1 and 200 characters" }, { status: 400 });
    }
    if (typeof category !== "string" || !category.trim() || category.trim().length > 100) {
      return NextResponse.json({ error: "Category must be between 1 and 100 characters" }, { status: 400 });
    }
    if (typeof description !== "string" || !description.trim() || description.trim().length > 2000) {
      return NextResponse.json({ error: "Description must be between 1 and 2000 characters" }, { status: 400 });
    }
    if (pages !== undefined && pages !== null && (typeof pages !== "string" || pages.length > 50)) {
      return NextResponse.json({ error: "Pages description must not exceed 50 characters" }, { status: 400 });
    }

    const updateData: Record<string, string> = {
      title: title.trim(),
      category: category.trim(),
      description: description.trim(),
      pages: pages && typeof pages === "string" ? pages.trim() : "Official Ref",
    };

    // Replace file only if a new document was selected during edit
    if (fileData) {
      const fileResult = validateFilePayload(fileData, fileName);
      if (fileResult.error) {
        return NextResponse.json({ error: fileResult.error }, { status: fileResult.status || 400 });
      }
      updateData.fileData = fileData;
      updateData.fileName = fileResult.fileName;
    }

    const handbook = await prisma.handbook.update({
      where: { id },
      data: updateData,
    });
    revalidateReadingMaterialsCatalog();
    return NextResponse.json({ handbook });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update handbook" }, { status: 500 });
  }
}

// DELETE: Remove a handbook
export async function DELETE(req: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(req);
    if (errorResponse) return errorResponse;

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await prisma.handbook.delete({ where: { id } });
    revalidateReadingMaterialsCatalog();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete handbook" }, { status: 500 });
  }
}