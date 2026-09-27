import Link from "next/link";
import { searchAll } from "@/lib/global-search";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const query = (await searchParams).q ?? "";
  const groups = await searchAll(query);
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Recherche</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Projets, clients, fournisseurs, produits, devis, pièces de vente et documents.
        </p>
      </div>
      <form action="/recherche" className="flex flex-col gap-2 sm:flex-row">
        <input
          name="q"
          defaultValue={query}
          placeholder="Nom, référence ou titre"
          className="h-11 w-full max-w-md rounded-lg border border-input bg-background px-3 text-sm"
        />
        <button type="submit" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium">
          Rechercher
        </button>
      </form>
      {query.trim().length < 2 ? (
        <p className="text-sm text-muted-foreground">Saisissez au moins deux caractères.</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun résultat pour « {query.trim()} ».</p>
      ) : (
        <div className="grid gap-6">
          {groups.map((group) => (
            <section key={group.title} className="grid gap-2">
              <h2 className="text-lg font-semibold">{group.title}</h2>
              <ul className="grid gap-1">
                {group.rows.map((row) => (
                  <li key={`${group.title}-${row.href}-${row.label}`}>
                    <Link href={row.href} className="text-sm font-medium underline-offset-4 hover:underline">
                      {row.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
