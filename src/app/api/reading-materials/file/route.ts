import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return new NextResponse("Missing document ID", { status: 400 });

    const handbook = await prisma.handbook.findUnique({
      where: { id },
      select: { fileData: true, fileName: true },
    });

    if (!handbook || !handbook.fileData) {
      return new NextResponse("File not found", { status: 404 });
    }

    const base64Data = handbook.fileData.replace(/^data:application\/pdf;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${handbook.fileName || "document.pdf"}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}