import { DataBoard } from "@/components/data-board";
import { listDeadlines } from "@/lib/commercial-board";

export const dynamic = "force-dynamic";

export default async function DeadlinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const listed = await listDeadlines(query.q ?? "");
  return (
    <DataBoard
      title="Échéances impayées"
      intro="Commandes client dont la facturation n’a pas encore de référence, et celles qui en ont une. Aucune date d’échéance n’est calculée. Le paiement reste « non suivi » : aucun encaissement n’est enregistré ici."
      basePath="/listes/echeances"
      query={query}
      headers={listed.headers}
      rows={listed.rows}
      empty="Aucune commande client."
      exportView="echeances"
    />
  );
}
