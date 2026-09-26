import {
  createClientAction,
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
      intro="Chaque compte client se crée ici ou par l’assistant. Un projet crée aussi le compte s’il n’existe pas encore."
      actionPath="/clients"
      query={q}
      noun="client"
      createAction={createClientAction}
      updateAction={updateClientAction}
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
  };
}
