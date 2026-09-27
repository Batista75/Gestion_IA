import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) return new NextResponse("Introuvable", { status: 404 });
  const filename = (quote.versionLabel || quote.title).replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 80);
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>${escapeHtml(quote.title)}</title><body><h1>Devis reçu</h1><p>${escapeHtml(quote.title)}</p><p>${escapeHtml(quote.versionLabel)}</p><p>Total indiqué ${escapeHtml(quote.statedTotalHt || "non indiqué")}</p><p>${escapeHtml(quote.conditions)}</p></body></html>`;
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename || "devis-recu")}.html"`,
      "Cache-Control": "private, no-store",
    },
  });
}
