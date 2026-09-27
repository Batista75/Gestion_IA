import Link from "next/link";
import { formatCents } from "@/domain/pricing";
import { loadDashboard } from "@/lib/commercial-board";

export const dynamic = "force-dynamic";

export default async function SteeringPage() {
  const board = await loadDashboard();
  const cards = [
    { label: "Devis en attente", value: String(board.pending), href: "/suivi" },
    { label: "Commandes client", value: String(board.orders), href: "/listes/documents" },
    { label: "Chiffre d’affaires HT", value: formatCents(board.revenue), href: "/comptabilite/journal" },
    { label: "Projets", value: String(board.projects), href: "/projets" },
  ];
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Les montants HT viennent des commandes client déjà établies. Une ligne sans coût reste hors du total. La TVA et les encaissements ne sont pas calculés.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <li key={card.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
            <Link href={card.href} className="mt-2 inline-flex text-sm underline-offset-4 hover:underline">
              Ouvrir
            </Link>
          </li>
        ))}
      </ul>
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Impayés</h2>
        <p className="mt-2 text-sm leading-6">
          {board.unbilled} commande{board.unbilled > 1 ? "s" : ""} client sans référence de facture.
          Le coût d’un retard n’est pas estimé : aucun paiement n’est enregistré.
        </p>
        <Link href="/listes/echeances" className="mt-2 inline-flex text-sm underline-offset-4 hover:underline">
          Voir les échéances
        </Link>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Rank title="Top 5 articles en €" rows={board.byHt.map((row) => ({ name: row.name, value: formatCents(row.ht) }))} />
        <Rank title="Top 5 articles en volume" rows={board.byVolume.map((row) => ({ name: row.name, value: String(row.quantity) }))} />
        <Rank title="Top 5 des clients" rows={board.byClient.map((row) => ({ name: row.name, value: formatCents(row.ht) }))} />
        <Rank title="Top 5 des articles les plus rentables" rows={board.byMargin.map((row) => ({ name: row.name, value: formatCents(row.margin) }))} />
      </div>
    </div>
  );
}

function Rank({ title, rows }: { title: string; rows: Array<{ name: string; value: string }> }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Aucune commande client chiffrée.</p>
      ) : (
        <ol className="mt-3 grid gap-2 text-sm">
          {rows.map((row) => (
            <li key={row.name} className="flex items-baseline justify-between gap-3">
              <span>{row.name}</span>
              <span className="text-muted-foreground">{row.value}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
