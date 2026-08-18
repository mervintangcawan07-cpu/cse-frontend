import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/serverAuth";
import { cachedJsonResponse, CACHE_PROFILES } from "@/lib/cache";

// GET: Fetch all handbooks metadata
export async function GET() {
  try {
    const handbooks = await prisma.handbook.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        category: true,
        description: true,
        pages: true,
        fileName: true,
        createdAt: true,
      },
    });
    return cachedJsonResponse(
      { handbooks },
      "STATIC_METADATA"
    );
  } catch (error) {
    console.error("[READING_MATERIALS_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch handbooks" },
      { status: 500, headers: CACHE_PROFILES.PRIVATE }
    );
  }
}

// POST: Upload a new handbook
export async function POST(req: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(req);
    if (errorResponse) return errorResponse;

    const { title, category, description, pages, fileData, fileName } = await req.json();
    if (!title || !description || !fileData) {
      return NextResponse.json({ error: "Required fields missing" }, { status: 400 });
    }

    const handbook = await prisma.handbook.create({
      data: {
        title,
        category,
        description,
        pages: pages || "Official Ref",
        fileData,
        fileName: fileName || "document.pdf",
      },
    });

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

    const { id, title, category, description, pages, fileData, fileName } = await req.json();
    if (!id) return NextResponse.json({ error: "Handbook ID required" }, { status: 400 });

    const updateData: Record<string, string> = {
      title,
      category,
      description,
      pages: pages || "Official Ref",
    };

    // Replace file only if a new PDF was selected during edit
    if (fileData) {
      updateData.fileData = fileData;
      if (fileName) updateData.fileName = fileName;
    }

    const handbook = await prisma.handbook.update({
      where: { id },
      data: updateData,
    });

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
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete handbook" }, { status: 500 });
  }
}