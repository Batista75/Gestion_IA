import Link from "next/link";
import { DataBoard } from "@/components/data-board";
import { formatCents } from "@/domain/pricing";
import { listQuoteTable, loadProduced } from "@/lib/commercial-board";

export const dynamic = "force-dynamic";

export default async function QuoteFollowPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  if (query.vue === "liste") {
    const listed = await listQuoteTable(query.q ?? "");
    return (
      <DataBoard
        title="Liste des devis"
        intro="Devis établis depuis un dossier. Le montant HT vient des lignes chiffrées. L’application ne leur donne pas de numéro."
        basePath="/suivi"
        query={query}
        headers={listed.headers}
        rows={listed.rows}
        empty="Aucun devis ne correspond à cette recherche."
        exportView="devis"
        filters={<input type="hidden" name="vue" value="liste" />}
      />
    );
  }
  const documents = (await loadProduced()).filter((document) => document.kind === "devis");
  const columns = [
    { title: "Devis en attente", rows: documents.filter((document) => document.status === "en_cours") },
    { title: "Devis transformés", rows: documents.filter((document) => document.status === "transforme") },
    { title: "Devis non aboutis", rows: documents.filter((document) => document.status === "non_abouti") },
  ];
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Suivi de devis</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Trois colonnes : en attente, transformé en commande, non abouti. La liste plate est à côté.
          </p>
        </div>
        <Link href="/suivi?vue=liste" className="inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline">
          Liste
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((column) => (
          <section key={column.title} className="grid content-start gap-2 rounded-lg border border-border bg-card p-3">
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{column.title}</h2>
            {column.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun devis dans cette colonne.</p>
            ) : (
              <ul className="grid gap-2">
                {column.rows.map((document) => (
                  <li key={document.id} className="rounded-lg border border-border px-3 py-2">
                    <Link href={document.href} className="font-medium underline-offset-4 hover:underline">
                      {document.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {document.party} · {formatCents(document.ht)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
