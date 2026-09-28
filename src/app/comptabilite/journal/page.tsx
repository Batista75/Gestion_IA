import { DataBoard } from "@/components/data-board";
import { listJournal } from "@/lib/commercial-board";

export const dynamic = "force-dynamic";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const submitted = query.filtre === "1";
  const sales = submitted ? query.ventes === "1" : true;
  const payments = query.paiements === "1";
  const vat = query.tva === "1";
  const waiting = query.attente === "1";
  const listed = await listJournal(query.q ?? "", query.du ?? "", query.au ?? "", sales);
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <DataBoard
        title="Journal des ventes"
        intro="Devis et commandes client de la période. Les montants sont hors taxes. La référence est celle du dossier, si vous l’avez saisie."
        basePath="/comptabilite/journal"
        query={query}
        headers={listed.headers}
        rows={listed.rows}
        empty={sales ? "Aucune vente sur cette période." : "Cochez Ventes pour afficher les devis et les commandes client."}
        exportView="journal"
        filters={
          <>
            <input type="hidden" name="filtre" value="1" />
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Du
              <input type="date" name="du" defaultValue={query.du ?? ""} className="h-11 rounded-lg border border-input bg-background px-3 text-sm" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Au
              <input type="date" name="au" defaultValue={query.au ?? ""} className="h-11 rounded-lg border border-input bg-background px-3 text-sm" />
            </label>
            <Check name="ventes" label="Ventes" checked={sales} />
            <Check name="paiements" label="Paiements" checked={payments} />
            <Check name="tva" label="TVA sur encaissements" checked={vat} />
            <Check name="attente" label="Paiements en attente" checked={waiting} />
          </>
        }
      />
      {payments ? (
        <p className="shrink-0 text-sm text-muted-foreground">Aucun paiement n’est enregistré. La banque ne lance pas de règlement.</p>
      ) : null}
      {vat ? (
        <p className="shrink-0 text-sm text-muted-foreground">La TVA n’est pas calculée. Les montants du journal restent hors taxes.</p>
      ) : null}
      {waiting ? (
        <p className="shrink-0 text-sm text-muted-foreground">
          Les commandes sans référence de facture sont dans les échéances. Aucun montant de retard n’est estimé.
        </p>
      ) : null}
    </div>
  );
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="inline-flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" name={name} value="1" defaultChecked={checked} />
      {label}
    </label>
  );
}
