import { DataBoard } from "@/components/data-board";
import { listClientQuotes } from "@/lib/commercial-board";

export const dynamic = "force-dynamic";

export default async function ClientQuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const situation = query.situation ?? "";
  const client = query.client ?? "";
  const board = await listClientQuotes(query.q ?? "", situation, client);
  return (
    <DataBoard
      title="Liste Devis client"
      intro="Devis établis depuis un dossier. Le montant HT vient des lignes chiffrées. L’application ne leur donne pas de numéro."
      basePath="/suivi"
      query={{ q: query.q, situation, client, taille: query.taille }}
      headers={board.listed.headers}
      rows={board.listed.rows}
      empty="Aucun devis client ne correspond à ces filtres."
      exportView="devis"
      filters={
        <>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Situation
            <select name="situation" defaultValue={situation} className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground">
              <option value="">Toutes</option>
              {board.situations.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Client
            <select name="client" defaultValue={client} className="h-11 max-w-64 rounded-lg border border-input bg-background px-3 text-sm text-foreground">
              <option value="">Tous</option>
              {board.clients.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </>
      }
    />
  );
}
