import { DataBoard } from "@/components/data-board";
import { listLines } from "@/lib/commercial-board";

export const dynamic = "force-dynamic";

export default async function LinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const listed = await listLines(query.q ?? "");
  return (
    <DataBoard
      title="Historique des lignes"
      intro="Une ligne par produit ou service porté sur un devis ou une commande. Le montant HT est celui de la ligne, pas une somme recalculée du document."
      basePath="/listes/lignes"
      query={query}
      headers={listed.headers}
      rows={listed.rows}
      empty="Aucune ligne ne correspond à cette recherche."
      exportView="lignes"
    />
  );
}
