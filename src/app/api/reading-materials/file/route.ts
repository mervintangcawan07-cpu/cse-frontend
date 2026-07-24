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

    let contentType = "application/pdf";
    const lowerName = handbook.fileName.toLowerCase();

    if (lowerName.endsWith(".doc")) {
      contentType = "application/msword";
    } else if (lowerName.endsWith(".docx")) {
      contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
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
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[FILE_STREAM_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}