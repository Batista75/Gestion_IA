import {
  addAddressAction,
  addContactAction,
  createClientAction,
  deleteClientAction,
  updateClientAction,
} from "@/app/catalog-actions";
import { ChangeJournal } from "@/components/change-journal";
import { DataBoard } from "@/components/data-board";
import { PartyManager } from "@/components/party-manager";
import { listClients } from "@/lib/catalog-store";
import { listRecordEvents } from "@/lib/record-journal";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const [clients, journal] = await Promise.all([listClients(q), listRecordEvents("client", 40)]);
  return (
    <div className="grid gap-6">
    <DataBoard
      title="Liste des clients"
      intro="Particuliers et entreprises. Une fiche peut avoir plusieurs interlocuteurs et plusieurs adresses. Le contact et l’adresse du tableau restent ceux du siège. La recherche porte sur le nom, l’e-mail et le SIREN."
      basePath="/clients"
      query={{ q }}
      headers={["Nom", "Type", "Adresse", "Code postal", "Ville", "Téléphone", "Mail", "Fonction"]}
      rows={clients.map((client) => [
        { text: client.name },
        { text: client.kind === "entreprise" ? "Entreprise" : client.kind === "particulier" ? "Particulier" : "Non qualifié" },
        { text: client.address || "—" },
        { text: client.postalCode || "—" },
        { text: client.city || "—" },
        { text: client.phone || "—" },
        { text: client.email || "—" },
        { text: client.contactRole || "—" },
      ])}
      empty="Aucun client ne correspond à cette recherche."
    />
    <ChangeJournal entries={journal.slice(0, 12)} />
    <PartyManager
      title=""
      intro="Le formulaire enregistre la fiche. L’assistant identifie d’abord les informations, puis demande confirmation."
      showFinder={false}
      actionPath="/clients"
      query={q}
      noun="client"
      profile="client"
      createAction={createClientAction}
      updateAction={updateClientAction}
      deleteAction={deleteClientAction}
      addContactAction={addContactAction}
      addAddressAction={addAddressAction}
      records={clients.map((client) => ({
        ...toRecord(client),
        history: journal.filter((event) => event.entityId === client.id).slice(0, 6),
      }))}
    />
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
    sector: client.sector,
    currency: client.currency,
  };
}
