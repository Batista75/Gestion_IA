import { DataBoard } from "@/components/data-board";
import { listTexts } from "@/lib/commercial-board";

export const dynamic = "force-dynamic";

export default async function TextsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const listed = await listTexts(query.q ?? "");
  return (
    <DataBoard
      title="Liste des textes"
      intro="Conditions déjà écrites sur un devis reçu, descriptions d’articles et consignes de livraison. Ce ne sont pas des modèles à insérer automatiquement dans une pièce."
      basePath="/listes/textes"
      query={query}
      headers={listed.headers}
      rows={listed.rows}
      empty="Aucun texte enregistré."
      exportView="textes"
    />
  );
}
