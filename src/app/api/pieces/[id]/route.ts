import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveStoredPath } from "@/lib/pieces";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const file = await prisma.storedFile.findUnique({ where: { id } });
  if (!file) return new NextResponse("Introuvable", { status: 404 });
  const target = resolveStoredPath(file.storagePath);
  if (!target) return new NextResponse("Introuvable", { status: 404 });
  try {
    const bytes = await readFile(target);
    const filename = encodeURIComponent(file.originalName);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${filename}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Introuvable", { status: 404 });
  }
}
