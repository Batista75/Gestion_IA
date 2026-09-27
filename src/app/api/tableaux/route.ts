import { csvTable } from "@/domain/board";
import {
  listDeadlines,
  listDocuments,
  listGroups,
  listJournal,
  listLines,
  listQuoteTable,
  listTexts,
  type Listed,
} from "@/lib/commercial-board";

export const dynamic = "force-dynamic";

async function tableOf(view: string, query: URLSearchParams): Promise<Listed | null> {
  const q = query.get("q") ?? "";
  if (view === "documents") return listDocuments(q);
  if (view === "devis") return listQuoteTable(q);
  if (view === "lignes") return listLines(q);
  if (view === "echeances") return listDeadlines(q);
  if (view === "textes") return listTexts(q);
  if (view === "journal") {
    const submitted = query.get("filtre") === "1";
    const sales = submitted ? query.get("ventes") === "1" : true;
    return listJournal(q, query.get("du") ?? "", query.get("au") ?? "", sales);
  }
  if (view === "regroupements") {
    const groups = await listGroups(q);
    return {
      headers: ["Fournisseur", "Référence", "Désignation", "Famille", "Prix indiqué"],
      rows: groups.flatMap((group) => group.rows.map((row) => [{ text: group.supplier }, ...row])),
    };
  }
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const view = url.searchParams.get("vue") ?? "";
  const listed = await tableOf(view, url.searchParams);
  if (!listed) {
    return new Response("Export inconnu.", { status: 404 });
  }
  const body = csvTable(
    listed.headers,
    listed.rows.map((row) => row.map((cell) => cell.text)),
  );
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${view || "tableau"}.csv"`,
    },
  });
}
