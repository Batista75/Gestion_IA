import { NextResponse } from "next/server";
import { formatCents, saleLineFigures, saleOperationTotals } from "@/domain/pricing";
import { saleKindLabel } from "@/domain/sale-line";
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
  const document = await prisma.saleDocument.findUnique({
    where: { id },
    include: { lines: { orderBy: { createdAt: "asc" } }, project: true },
  });
  if (!document) return new NextResponse("Introuvable", { status: 404 });
  const buys = document.kind === "commande_fournisseur";
  const figures = document.lines.map((line) => {
    try {
      return saleLineFigures(line);
    } catch {
      return null;
    }
  });
  const rows = document.lines
    .map((line, index) => {
      const money = figures[index];
      const amount = buys ? money?.lineCostCents ?? null : money?.lineNetCents ?? null;
      return `<tr><td>${escapeHtml(line.name)}</td><td>${line.quantity}</td><td>${escapeHtml(formatCents(amount))}</td></tr>`;
    })
    .join("");
  const totals = saleOperationTotals(figures.flatMap((line) => (line ? [line] : [])));
  const total = buys ? totals.costCents : totals.netCents;
  const filename = `${saleKindLabel(document.kind)}-${document.title}`.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 80);
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>${escapeHtml(document.title)}</title><body><h1>${escapeHtml(saleKindLabel(document.kind))}</h1><p>${escapeHtml(document.title)}</p><p>Dossier ${escapeHtml(document.project.name)} · ${escapeHtml(document.createdAt.toLocaleDateString("fr-FR"))}</p><table><thead><tr><th>Désignation</th><th>Quantité</th><th>Montant HT</th></tr></thead><tbody>${rows}</tbody></table><p>Total HT ${escapeHtml(formatCents(document.lines.length === 0 || totals.missing === document.lines.length ? null : total))}</p><p>Ce fichier reprend la pièce enregistrée. Il n’attribue pas de numéro.</p></body></html>`;
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}.html"`,
      "Cache-Control": "private, no-store",
    },
  });
}
