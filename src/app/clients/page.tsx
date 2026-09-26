import {
  createClientAction,
  deleteClientAction,
  updateClientAction,
} from "@/app/catalog-actions";
import { PartyManager } from "@/components/party-manager";
import { listClients } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const clients = await listClients(q);
  return (
    <PartyManager
      title="Clients"
      intro="Un client est un particulier ou une entreprise, en France ou à l’international. Le formulaire enregistre la fiche. L’assistant identifie d’abord les informations, puis demande confirmation."
      actionPath="/clients"
      query={q}
      noun="client"
      profile="client"
      createAction={createClientAction}
      updateAction={updateClientAction}
      deleteAction={deleteClientAction}
      records={clients.map(toRecord)}
    />
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
    sector: client.sector,
    currency: client.currency,
  };
}
