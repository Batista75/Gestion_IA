import Link from "next/link";
import {
  addAddressAction,
  addContactAction,
  createClientAction,
  deleteClientAction,
  updateClientAction,
} from "@/app/catalog-actions";
import { DataBoard } from "@/components/data-board";
import { PartyManager } from "@/components/party-manager";
import { listClients } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; fiche?: string }>;
}) {
  const { q = "", fiche = "" } = await searchParams;
  const clients = await listClients(q);
  const opened = clients.find((client) => client.id === fiche) ?? null;
  const keep = q ? `&q=${encodeURIComponent(q)}` : "";
  return (
    <div className="grid min-h-0 gap-3">
    <DataBoard
      title="Liste des clients"
      intro="Particuliers et entreprises. Une fiche peut avoir plusieurs interlocuteurs et plusieurs adresses. Le contact et l’adresse du tableau restent ceux du siège. La recherche porte sur le nom, l’e-mail et le SIREN."
      basePath="/clients"
      query={{ q }}
      headers={["Nom", "Type", "Adresse", "Code postal", "Ville", "Téléphone", "Mail", "Fonction", "Aussi", "Fiche"]}
      rows={clients.map((client) => [
        { text: client.name },
        { text: client.kind === "entreprise" ? "Entreprise" : client.kind === "particulier" ? "Particulier" : "Non qualifié" },
        { text: client.address || "—" },
        { text: client.postalCode || "—" },
        { text: client.city || "—" },
        { text: client.phone || "—" },
        { text: client.email || "—" },
        { text: client.contactRole || "—" },
        client.organization?.supplier
          ? { text: client.organization.supplier.name, href: `/fournisseurs?q=${encodeURIComponent(client.organization.supplier.name)}` }
          : { text: "—" },
        { text: opened?.id === client.id ? "Ouverte" : "Ouvrir", href: `/clients?fiche=${client.id}${keep}` },
      ])}
      empty="Aucun client ne correspond à cette recherche."
    />
    <p className="text-sm text-muted-foreground">
      Les créations et les corrections sont dans{" "}
      <Link href="/evenements?type=client" className="font-medium text-foreground underline-offset-4 hover:underline">
        Événements
      </Link>
      .
    </p>
    {opened ? (
      <div className="grid gap-2">
        <Link href={`/clients${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="text-sm font-medium underline-offset-4 hover:underline">
          Fermer la fiche
        </Link>
        <PartyManager
          title=""
          intro=""
          showFinder={false}
          pane="record"
          actionPath="/clients"
          query={q}
          noun="client"
          profile="client"
          createAction={createClientAction}
          updateAction={updateClientAction}
          deleteAction={deleteClientAction}
          addContactAction={addContactAction}
          addAddressAction={addAddressAction}
          records={[toRecord(opened)]}
        />
      </div>
    ) : (
      <details className="rounded-lg border border-border bg-card px-4 py-2">
        <summary className="cursor-pointer text-sm font-medium">Nouveau client</summary>
        <div className="pt-3">
          <PartyManager
            title=""
            intro="Le formulaire enregistre la fiche. L’assistant identifie d’abord les informations, puis demande confirmation."
            showFinder={false}
            pane="create"
            actionPath="/clients"
            query={q}
            noun="client"
            profile="client"
            createAction={createClientAction}
            updateAction={updateClientAction}
            deleteAction={deleteClientAction}
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

function toRecord(client: Awaited<ReturnType<typeof listClients>>[number]) {
  return {
    id: client.id,
    name: client.name,
    siren: client.siren,
    email: client.email,
    phone: client.phone,
    address: client.address,
    notes: client.notes,
    updatedLabel: client.updatedAt.toLocaleString("fr-FR"),
    kind: client.kind,
    civility: client.civility,
    tradeName: client.tradeName,
    legalForm: client.legalForm,
    country: client.country,
    postalCode: client.postalCode,
    city: client.city,
    siret: client.siret,
    vatNumber: client.vatNumber,
    contactName: client.contactName,
    contactRole: client.contactRole,
    contacts: client.contacts,
    addresses: client.addresses,
    counterpart: client.organization?.supplier
      ? {
          label: `Aussi fournisseur · ${client.organization.supplier.name}`,
          href: `/fournisseurs?q=${encodeURIComponent(client.organization.supplier.name)}`,
        }
      : null,
    sector: client.sector,
    currency: client.currency,
  };
}
