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
  searchParams: Promise<{ q?: string; fiche?: string }>;
}) {
  const { q = "", fiche = "" } = await searchParams;
  const suppliers = await listSuppliers(q);
  const opened = suppliers.find((supplier) => supplier.id === fiche) ?? null;
  const keep = q ? `&q=${encodeURIComponent(q)}` : "";
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
    <DataBoard
      title="Liste des fournisseurs"
      intro="La fiche reprend la forme, le SIRET, la TVA et l’adresse du siège, comme un client. D’autres adresses et d’autres interlocuteurs peuvent y être ajoutés. La commande, la réception et la facture fournisseur ne se saisissent pas encore."
      basePath="/fournisseurs"
      query={{ q }}
      headers={["Nom", "Forme", "Ville", "E-mail", "Téléphone", "Aussi", "Fiche"]}
      rows={suppliers.map((supplier) => [
        { text: supplier.name },
        { text: supplier.legalForm || "—" },
        { text: supplier.city || "—" },
        { text: supplier.email || "—" },
        { text: supplier.phone || "—" },
        supplier.organization?.client
          ? { text: supplier.organization.client.name, href: `/clients?q=${encodeURIComponent(supplier.organization.client.name)}` }
          : { text: "—" },
        { text: opened?.id === supplier.id ? "Ouverte" : "Ouvrir", href: `/fournisseurs?fiche=${supplier.id}${keep}` },
      ])}
      empty="Aucun fournisseur ne correspond à cette recherche."
    />
    <p className="shrink-0 text-sm text-muted-foreground">
      Les créations et les corrections sont dans{" "}
      <Link href="/evenements?type=fournisseur" className="font-medium text-foreground underline-offset-4 hover:underline">
        Événements
      </Link>
      .
    </p>
    {opened ? (
      <div className="grid min-h-0 max-h-[42%] shrink-0 gap-2 overflow-auto">
        <Link href={`/fournisseurs${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="text-sm font-medium underline-offset-4 hover:underline">
          Fermer la fiche
        </Link>
        <PartyManager
          title=""
          intro=""
          showFinder={false}
          pane="record"
          actionPath="/fournisseurs"
          query={q}
          noun="fournisseur"
          profile="supplier"
          createAction={createSupplierAction}
          updateAction={updateSupplierAction}
          deleteAction={deleteSupplierAction}
          addContactAction={addContactAction}
          addAddressAction={addAddressAction}
          records={[toRecord(opened)]}
        />
      </div>
    ) : (
      <details className="shrink-0 rounded-lg border border-border bg-card px-4 py-2">
        <summary className="cursor-pointer text-sm font-medium">Nouveau fournisseur</summary>
        <div className="pt-3">
          <PartyManager
            title=""
            intro=""
            showFinder={false}
            pane="create"
            actionPath="/fournisseurs"
            query={q}
            noun="fournisseur"
            profile="supplier"
            createAction={createSupplierAction}
            updateAction={updateSupplierAction}
            deleteAction={deleteSupplierAction}
            addContactAction={addContactAction}
            addAddressAction={addAddressAction}
            records={[]}
          />
        </div>
      </details>
    )}
    </div>
  );
}

function primaryContact(supplier: Awaited<ReturnType<typeof listSuppliers>>[number]) {
  return supplier.contacts.find((contact) => contact.isPrimary) ?? supplier.contacts[0];
}

function toRecord(supplier: Awaited<ReturnType<typeof listSuppliers>>[number]) {
  return {
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
  };
}
