import { DataBoard } from "@/components/data-board";
import { listDocuments } from "@/lib/commercial-board";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const listed = await listDocuments(query.q ?? "");
  return (
    <DataBoard
      title="Liste des documents"
      intro="Devis, commandes et devis reçus. Le montant d’une pièce produite est le total HT des lignes chiffrées. Le total imprimé d’un devis reçu reste celui de la pièce."
      basePath="/listes/documents"
      query={query}
      headers={listed.headers}
      rows={listed.rows}
      empty="Aucun document ne correspond à cette recherche."
      exportView="documents"
    />
  );
}
