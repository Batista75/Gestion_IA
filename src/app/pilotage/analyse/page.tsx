import { monthBounds } from "@/domain/board";
import { DataBoard } from "@/components/data-board";
import {
  compareCounts,
  compareMoney,
  figuresBetween,
  loadProduced,
} from "@/lib/commercial-board";

export const dynamic = "force-dynamic";

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const anchor = new Date();
  const firstDefault = monthBounds(anchor, -1);
  const secondDefault = monthBounds(anchor, 0);
  const from = query.du1 || firstDefault.from;
  const to = query.au1 || firstDefault.to;
  const from2 = query.du2 || secondDefault.from;
  const to2 = query.au2 || secondDefault.to;
  const documents = await loadProduced();
  const left = figuresBetween(documents, from, to);
  const right = figuresBetween(documents, from2, to2);
  const rows = [
    ["Chiffre d’affaires HT", compareMoney(left.ht, right.ht)],
    ["Nombre de commandes client", compareCounts(left.orders, right.orders)],
    ["Nombre de devis", compareCounts(left.quotes, right.quotes)],
    ["Marge HT", compareMoney(left.margin, right.margin)],
  ] as const;
  return (
    <div className="grid gap-4">
      <DataBoard
        title="Tableau d’analyse"
        intro="Deux périodes, côte à côte. L’écart est la seconde moins la première. Le chiffre d’affaires et la marge ne comptent que les commandes client dont le coût est connu. La TVA n’est pas appliquée."
        basePath="/pilotage/analyse"
        query={{ ...query, du1: from, au1: to, du2: from2, au2: to2 }}
        headers={["", "1re période", "2e période", "Écart", "% écart"]}
        rows={rows.map(([label, values]) => [
          { text: label },
          { text: values.left },
          { text: values.right },
          { text: values.gap },
          { text: values.percent },
        ])}
        empty="Aucune période à comparer."
        filters={
          <>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Début 1
              <input type="date" name="du1" defaultValue={from} className="h-11 rounded-lg border border-input bg-background px-3 text-sm" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Fin 1
              <input type="date" name="au1" defaultValue={to} className="h-11 rounded-lg border border-input bg-background px-3 text-sm" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Début 2
              <input type="date" name="du2" defaultValue={from2} className="h-11 rounded-lg border border-input bg-background px-3 text-sm" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Fin 2
              <input type="date" name="au2" defaultValue={to2} className="h-11 rounded-lg border border-input bg-background px-3 text-sm" />
            </label>
          </>
        }
      />
    </div>
  );
}
