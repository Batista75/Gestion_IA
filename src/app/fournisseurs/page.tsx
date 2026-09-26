import {
  createSupplierAction,
  deleteSupplierAction,
  updateSupplierAction,
} from "@/app/catalog-actions";
import { ChangeJournal } from "@/components/change-journal";
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
    <ChangeJournal entries={journal.slice(0, 12)} />
    <PartyManager
      title="Fournisseurs"
      intro="La fiche fournisseur sert aux produits et aux devis. La commande, la réception et la facture restent à venir."
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
