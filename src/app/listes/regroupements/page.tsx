import Link from "next/link";
import { DataBoard } from "@/components/data-board";
import { listGroups } from "@/lib/commercial-board";

export const dynamic = "force-dynamic";

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const groups = await listGroups(query.q ?? "");
  const rows = groups.flatMap((group) =>
    group.rows.map((row) => [{ text: group.supplier }, ...row]),
  );
  return (
    <div className="grid gap-4">
      <DataBoard
        title="Regroupements"
        intro="Les articles du catalogue sont regroupés par fournisseur. Un pack au prix ajusté, affiché en une seule ligne sur la pièce, n’est pas un objet distinct."
        basePath="/listes/regroupements"
        query={query}
        headers={["Fournisseur", "Référence", "Désignation", "Famille", "Coût unitaire", "Devise", "Date de saisie"]}
        rows={rows}
        empty="Aucun article ne correspond à cette recherche."
        exportView="regroupements"
      />
      <ul className="grid gap-2 text-sm">
        {groups.map((group) => (
          <li key={group.supplier}>
            <Link href={`/fournisseurs?q=${encodeURIComponent(group.supplier)}`} className="underline-offset-4 hover:underline">
              {group.supplier}
            </Link>
            <span className="text-muted-foreground"> · {group.rows.length} article{group.rows.length > 1 ? "s" : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
