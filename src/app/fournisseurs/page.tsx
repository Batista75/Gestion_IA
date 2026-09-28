import Link from "next/link";
import {
  addAddressAction,
  addContactAction,
  createSupplierAction,
  deleteSupplierAction,
  updateSupplierAction,
} from "@/app/catalog-actions";
import { DataBoard } from "@/components/data-board";
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
    <div className="grid gap-6">
    <DataBoard
      title="Liste des fournisseurs"
      intro="La fiche reprend la forme, le SIRET, la TVA et l’adresse du siège, comme un client. D’autres adresses et d’autres interlocuteurs peuvent y être ajoutés. La commande, la réception et la facture fournisseur ne se saisissent pas encore."
      basePath="/fournisseurs"
      query={{ q }}
      headers={["Nom", "Forme", "Ville", "E-mail", "Téléphone", "Aussi"]}
      rows={suppliers.map((supplier) => [
        { text: supplier.name },
        { text: supplier.legalForm || "—" },
        { text: supplier.city || "—" },
        { text: supplier.email || "—" },
        { text: supplier.phone || "—" },
        supplier.organization?.client
          ? { text: supplier.organization.client.name, href: `/clients?q=${encodeURIComponent(supplier.organization.client.name)}` }
          : { text: "—" },
      ])}
      empty="Aucun fournisseur ne correspond à cette recherche."
    />
    <p className="text-sm text-muted-foreground">
      Les créations et les corrections sont dans{" "}
      <Link href="/evenements?type=fournisseur" className="font-medium text-foreground underline-offset-4 hover:underline">
        Événements
      </Link>
      .
    </p>
    <PartyManager
      title=""
      intro=""
      showFinder={false}
      actionPath="/fournisseurs"
      query={q}
      noun="fournisseur"
      profile="supplier"
      createAction={createSupplierAction}
      updateAction={updateSupplierAction}
      deleteAction={deleteSupplierAction}
      addContactAction={addContactAction}
      addAddressAction={addAddressAction}
      records={suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        siren: supplier.siren,
        siret: supplier.siret,
        vatNumber: supplier.vatNumber,
        legalForm: supplier.legalForm,
        country: supplier.country,
        postalCode: supplier.postalCode,
        city: supplier.city,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        notes: supplier.notes,
        contactName: [primaryContact(supplier)?.firstName, primaryContact(supplier)?.lastName].filter(Boolean).join(" "),
        contactRole: primaryContact(supplier)?.role ?? "",
        contacts: supplier.contacts,
        addresses: supplier.addresses,
        counterpart: supplier.organization?.client
          ? {
              label: `Aussi client · ${supplier.organization.client.name}`,
              href: `/clients?q=${encodeURIComponent(supplier.organization.client.name)}`,
            }
          : null,
        updatedLabel: supplier.updatedAt.toLocaleString("fr-FR"),
      }))}
    />
    </div>
  );
}

function primaryContact(supplier: Awaited<ReturnType<typeof listSuppliers>>[number]) {
  return supplier.contacts.find((contact) => contact.isPrimary) ?? supplier.contacts[0];
}
