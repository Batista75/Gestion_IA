import {
  createSupplierAction,
  deleteSupplierAction,
  updateSupplierAction,
} from "@/app/catalog-actions";
import { ChangeJournal } from "@/components/change-journal";
import { DataBoard } from "@/components/data-board";
import { PartyManager } from "@/components/party-manager";
import { listSuppliers } from "@/lib/catalog-store";
import { listRecordEvents } from "@/lib/record-journal";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const [suppliers, journal] = await Promise.all([
    listSuppliers(q),
    listRecordEvents("supplier", 40),
  ]);
  return (
    <div className="grid gap-6">
    <DataBoard
      title="Liste des fournisseurs"
      intro="La commande, la réception et la facture fournisseur ne se saisissent pas encore. La fiche se tient sous le tableau."
      basePath="/fournisseurs"
      query={{ q }}
      headers={["Nom", "E-mail", "Téléphone", "Adresse"]}
      rows={suppliers.map((supplier) => [
        { text: supplier.name },
        { text: supplier.email || "—" },
        { text: supplier.phone || "—" },
        { text: supplier.address || "—" },
      ])}
      empty="Aucun fournisseur ne correspond à cette recherche."
    />
    <ChangeJournal entries={journal.slice(0, 12)} />
    <PartyManager
      title=""
      intro=""
      showFinder={false}
      actionPath="/fournisseurs"
      query={q}
      noun="fournisseur"
      createAction={createSupplierAction}
      updateAction={updateSupplierAction}
      deleteAction={deleteSupplierAction}
      records={suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        siren: supplier.siren,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        notes: supplier.notes,
        updatedLabel: supplier.updatedAt.toLocaleString("fr-FR"),
        history: journal.filter((event) => event.entityId === supplier.id).slice(0, 6),
      }))}
    />
    </div>
  );
}
