import { revalidatePath } from "next/cache";
import { nameKey, type PartyInput } from "@/domain/catalog";
import { CLIENT_FIELD_LABELS, fieldChangeSummary } from "@/domain/record-journal";
import {
  displayName,
  draftFromKnownFields,
  emptyDraft,
  mergeKnownClient,
  notesWithRegistration,
  presentProposal,
  proposalFields,
  qualifyDraft,
  reviseDraft,
  asksToEnrichRecord,
  clientFieldMap,
  knownRecordPrompt,
  type ClientDraft,
  type ClientKind,
} from "@/domain/client-file";
import { mentionedNames, sourceLabel, uniqueNameMatch } from "@/domain/knowledge";
import { withChangeSource } from "@/lib/change-source";
import { syncPrimaryAddress } from "@/lib/addresses";
import { attachOrganization } from "@/lib/organizations";
import { syncPrimaryContact } from "@/lib/contacts";
import { stampProvenance } from "@/domain/provenance";
import { prisma } from "@/lib/db";

const PATHS = [
  "/",
  "/projets",
  "/clients",
  "/fournisseurs",
  "/produits",
  "/achats",
  "/ventes",
];

export type ProposalView = {
  reply: string;
  proposal: { fields: Array<{ label: string; value: string }> };
};

export async function openClientProposal(draft: ClientDraft): Promise<ProposalView> {
  const clients = await prisma.client.findMany({ take: 500 });
  const matchName = uniqueNameMatch(displayName(draft), clients.map((client) => client.name));
  const existing = matchName ? clients.find((client) => client.name === matchName) ?? null : null;
  const ready = existing
    ? mergeKnownClient(clientToDraft(existing), draft)
    : qualifyDraft({ ...draft, mode: "create" });
  await prisma.clientProposal.updateMany({
    where: { status: "en_attente" },
    data: { status: "remplacee" },
  });
  await prisma.clientProposal.create({
    data: { status: "en_attente", payload: ready, ...stampProvenance("regle", proposalFields(ready)) },
  });
  return view(ready);
}

export async function currentProposal(): Promise<ClientDraft | null> {
  const row = await prisma.clientProposal.findFirst({
    where: { status: "en_attente" },
    orderBy: { createdAt: "desc" },
  });
  return row ? asDraft(row.payload) : null;
}

export async function confirmCurrentProposal(): Promise<{
  ok: boolean;
  summary: string;
}> {
  const draft = await currentProposal();
  if (!draft) {
    return { ok: false, summary: "Il n’y a pas de fiche client en attente." };
  }
  const saved = await withChangeSource("assistant", () => saveClientDraft(draft, { allowUpdate: true }));
  if (!saved.ok) return saved;
  await prisma.clientProposal.updateMany({
    where: { status: "en_attente" },
    data: { status: "confirmee", validatedAt: new Date() },
  });
  return saved;
}

export async function proposeChangeFromMessage(text: string): Promise<{
  reply: string;
  proposal?: ProposalView["proposal"];
  sources: Array<{ label: string; title: string }>;
} | null> {
  const clients = await prisma.client.findMany({ take: 500, orderBy: { name: "asc" } });
  const names = mentionedNames(text, clients.map((client) => client.name));
  if (names.length === 0) return null;
  if (names.length > 1) {
    return {
      reply: `Plusieurs fiches correspondent : ${names.join(", ")}. Précisez le nom complet. Rien n’est enregistré.`,
      sources: names.map((name) => ({ label: sourceLabel("client"), title: name })),
    };
  }
  const client = clients.find((item) => item.name === names[0]);
  if (!client) return null;
  const before = clientToDraft(client);
  const revised = reviseDraft(before, text);
  const sources = [{ label: sourceLabel("client"), title: client.name }];
  if (!revised.changed) {
    return {
      reply: asksToEnrichRecord(text)
        ? knownRecordPrompt(before)
        : `J’ai trouvé ${client.name}, mais pas le champ à modifier. Précisez-le, par exemple le contact, le téléphone ou une information sur l’entreprise.`,
      sources,
    };
  }
  const opened = await openClientProposal(revised.draft);
  const delta = fieldChangeSummary(clientFieldMap(before), clientFieldMap(revised.draft), CLIENT_FIELD_LABELS);
  return {
    reply: [`D’après la fiche enregistrée.`, delta, opened.reply].filter(Boolean).join("\n"),
    proposal: opened.proposal,
    sources,
  };
}

export async function proposeFromParty(command: {
  type: "create_client" | "update_client";
  party: PartyInput;
}): Promise<ProposalView | { clarify: string }> {
  if (command.type === "update_client") {
    const clients = await prisma.client.findMany({ take: 500 });
    const exact = clients.find((client) => nameKey(client.name) === nameKey(command.party.name));
    const hits = mentionedNames(command.party.name, clients.map((client) => client.name));
    if (!exact && hits.length > 1) {
      return {
        clarify: `Plusieurs fiches correspondent : ${hits.join(", ")}. Précisez le nom complet. Rien n’est enregistré.`,
      };
    }
    const matchName = exact?.name ?? (hits.length === 1 ? hits[0] : null);
    const existing = matchName ? clients.find((client) => client.name === matchName) ?? null : null;
    if (!existing) {
      const draft = draftFromKnownFields(command.party, "create");
      draft.notes = [draft.notes, "Aucun compte de ce nom : proposition de création."]
        .filter(Boolean)
        .join(" ");
      return openClientProposal(draft);
    }
    return openClientProposal(overlay(clientToDraft(existing), command.party));
  }
  return openClientProposal(draftFromKnownFields(command.party, "create"));
}

export async function saveClientDraft(
  draft: ClientDraft,
  options: { id?: string | null; allowUpdate?: boolean } = {},
): Promise<{ ok: boolean; summary: string }> {
  const ready = qualifyDraft(draft);
  const name = displayName(ready).trim().replace(/\s+/g, " ");
  if (name.length < 2) {
    return { ok: false, summary: "Indiquez un nom d’au moins 2 caractères." };
  }
  if (name.length > 120) {
    return { ok: false, summary: "Le nom dépasse 120 caractères." };
  }
  if (ready.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ready.email)) {
    return { ok: false, summary: "L’adresse e-mail n’est pas valide." };
  }
  const key = nameKey(name);
  const byName = await prisma.client.findUnique({ where: { nameKey: key } });
  const target = options.id
    ? await prisma.client.findUnique({ where: { id: options.id } })
    : options.allowUpdate
      ? byName
      : null;
  if (!options.id && byName && !options.allowUpdate) {
    return { ok: false, summary: `Le client « ${byName.name} » existe déjà.` };
  }
  if (options.id && !target) {
    return { ok: false, summary: "Cette fiche client est introuvable." };
  }
  if (byName && target && byName.id !== target.id) {
    return { ok: false, summary: `Un client porte déjà le nom « ${byName.name} ».` };
  }
  const data = {
    name,
    nameKey: key,
    kind: ready.kind,
    civility: ready.civility,
    tradeName: ready.tradeName,
    legalForm: ready.legalForm,
    country: ready.country,
    postalCode: ready.postalCode,
    city: ready.city,
    siren: ready.siren,
    siret: ready.siret,
    vatNumber: ready.vatNumber,
    contactName: ready.contactName,
    contactRole: ready.contactRole,
    email: ready.email,
    phone: ready.phone,
    address: ready.address,
    notes: notesWithRegistration(ready.notes, ready.registration),
  };
  const saved = target
    ? await prisma.client.update({ where: { id: target.id }, data })
    : await prisma.client.create({ data });
  await syncPrimaryContact({
    clientId: saved.id,
    fullName: ready.contactName,
    role: ready.contactRole,
    email: ready.email,
    phone: ready.phone,
  });
  await syncPrimaryAddress({
    clientId: saved.id,
    line: ready.address,
    postalCode: ready.postalCode,
    city: ready.city,
    country: ready.country,
  });
  await attachOrganization({ kind: "client", id: saved.id, name });
  for (const path of PATHS) revalidatePath(path);
  return {
    ok: true,
    summary: target
      ? `Client « ${name} » mis à jour.`
      : `Client « ${name} » enregistré.`,
  };
}

export function draftFromForm(formData: FormData): ClientDraft {
  const kind = asKind(String(formData.get("kind") ?? ""));
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const person = kind === "particulier" ? splitPerson(name) : { firstName: "", lastName: "" };
  return qualifyDraft({
    ...emptyDraft(),
    kind,
    civility: text(formData, "civility"),
    firstName: person.firstName,
    lastName: person.lastName,
    legalName: kind === "particulier" ? "" : name,
    tradeName: text(formData, "tradeName"),
    legalForm: text(formData, "legalForm"),
    country: text(formData, "country"),
    address: text(formData, "address"),
    postalCode: text(formData, "postalCode"),
    city: text(formData, "city"),
    siren: text(formData, "siren").replace(/\s/g, ""),
    siret: text(formData, "siret").replace(/\s/g, ""),
    vatNumber: text(formData, "vatNumber").replace(/\s/g, "").toUpperCase(),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    contactName: text(formData, "contactName"),
    contactRole: text(formData, "contactRole"),
    notes: text(formData, "notes"),
  });
}

function overlay(base: ClientDraft, party: PartyInput): ClientDraft {
  const next = { ...base, mode: "update" as const };
  const siren = party.siren.replace(/\s/g, "");
  if (party.email.trim()) next.email = party.email.trim();
  if (party.phone.trim()) next.phone = party.phone.trim();
  if (party.address.trim()) next.address = party.address.trim();
  if (party.notes.trim()) next.notes = party.notes.trim();
  if (siren.length === 14) {
    next.siret = siren;
    next.siren = siren.slice(0, 9);
  } else if (siren) {
    next.siren = siren;
  }
  return qualifyDraft(next);
}

function clientToDraft(row: {
  name: string;
  kind: string;
  civility: string;
  tradeName: string;
  legalForm: string;
  country: string;
  postalCode: string;
  city: string;
  siren: string;
  siret: string;
  vatNumber: string;
  contactName: string;
  contactRole: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}): ClientDraft {
  const kind = asKind(row.kind);
  const person = kind === "particulier" ? splitPerson(row.name) : { firstName: "", lastName: "" };
  return qualifyDraft({
    ...emptyDraft(),
    mode: "update",
    kind,
    civility: row.civility,
    firstName: person.firstName,
    lastName: person.lastName,
    legalName: kind === "particulier" ? "" : row.name,
    tradeName: row.tradeName,
    legalForm: row.legalForm,
    country: row.country,
    address: row.address,
    postalCode: row.postalCode,
    city: row.city,
    siren: row.siren,
    siret: row.siret,
    vatNumber: row.vatNumber,
    email: row.email,
    phone: row.phone,
    contactName: row.contactName,
    contactRole: row.contactRole,
    notes: row.notes,
  });
}

function view(draft: ClientDraft): ProposalView {
  return {
    reply: presentProposal(draft),
    proposal: { fields: proposalFields(draft) },
  };
}

function asDraft(value: unknown): ClientDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<ClientDraft>;
  return qualifyDraft({
    ...emptyDraft(),
    ...record,
    mode: record.mode === "update" ? "update" : "create",
    kind: asKind(record.kind ?? ""),
    vatDeduced: Boolean(record.vatDeduced),
  });
}

function asKind(value: string): ClientKind {
  return value === "particulier" || value === "entreprise" ? value : "";
}

function splitPerson(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
