import {
  createSupplierAction,
  deleteSupplierAction,
  updateSupplierAction,
} from "@/app/catalog-actions";
import { PartyManager } from "@/components/party-manager";
import { listSuppliers } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const suppliers = await listSuppliers(q);
  return (
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
      }))}
    />
  );
}
