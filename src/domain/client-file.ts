import { plainLabel } from "./catalog.ts";
import { classifyPendingTurn } from "./conversation-turn.ts";
import { explicitClientCreation } from "./structured-plan.ts";
import type { AgentIntent } from "./knowledge.ts";

export type ClientKind = "particulier" | "entreprise" | "";
export type ClientScope = "france" | "international" | "";

export type ClientDraft = {
  mode: "create" | "update";
  kind: ClientKind;
  scope: ClientScope;
  civility: string;
  firstName: string;
  lastName: string;
  legalName: string;
  tradeName: string;
  legalForm: string;
  country: string;
  address: string;
  postalCode: string;
  city: string;
  siren: string;
  siret: string;
  vatNumber: string;
  vatDeduced: boolean;
  email: string;
  phone: string;
  contactName: string;
  contactRole: string;
  registration: string;
  notes: string;
  missing: string[];
};

export type ProposalField = { label: string; value: string };

export const CLIENT_EXAMPLES = [
  {
    id: "particulier-france",
    label: "Particulier en France",
    text: "Nouveau client particulier : Mme Marie Dupont, 14 rue des Lilas, 75011 Paris, France, marie.dupont@mail.fr, 06 12 34 56 78. Travaux dans son appartement.",
  },
  {
    id: "particulier-international",
    label: "Particulier à l’international",
    text: "Nouveau client particulier : M. John Miller, 18 Oak Street, London SW1A 1AA, Royaume-Uni, john.miller@mail.co.uk, +44 20 7946 0958.",
  },
  {
    id: "entreprise-france",
    label: "Entreprise française",
    text: "Nouveau client entreprise : Menuiserie Lambert SAS, enseigne Atelier Lambert, SIREN 732829320, SIRET 73282932000009, siège 8 avenue de la République, 69100 Villeurbanne, France, contact Paul Lambert, gérant, paul.lambert@atelier-lambert.fr, 04 72 10 20 30.",
  },
  {
    id: "entreprise-internationale",
    label: "Entreprise internationale",
    text: "Nouveau client entreprise : Holzwerk Müller GmbH, Allemagne, TVA DE136695976, Musterstraße 10, 80331 München, contact Anna Müller, achats, anna.mueller@holzwerk-mueller.de, +49 89 123456.",
  },
] as const;

const LEGAL_FORMS = [
  "SASU",
  "SAS",
  "SARL",
  "EURL",
  "SCI",
  "GmbH",
  "LLC",
  "Ltd",
  "Inc",
  "BV",
  "SRL",
  "SpA",
  "SA",
  "AG",
  "Oy",
  "Oyj",
  "ApS",
  "AS",
  "PLC",
  "NV",
  "KG",
  "EI",
];

const ROLES = new Set([
  "gerant",
  "gérant",
  "president",
  "président",
  "directeur",
  "directrice",
  "achats",
  "achat",
  "comptable",
  "commercial",
  "commerciale",
  "assistant",
  "assistante",
]);

export function qualifyDraft(draft: ClientDraft): ClientDraft {
  return finalize({ ...emptyDraft(), ...draft, missing: [] });
}

export function draftFromKnownFields(
  fields: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    notes?: string;
    siren?: string;
  },
  mode: "create" | "update",
): ClientDraft {
  const siren = (fields.siren ?? "").replace(/\s/g, "");
  return qualifyDraft({
    ...emptyDraft(),
    mode,
    legalName: (fields.name ?? "").trim(),
    email: (fields.email ?? "").trim(),
    phone: (fields.phone ?? "").trim(),
    address: (fields.address ?? "").trim(),
    notes: (fields.notes ?? "").trim(),
    siret: siren.length === 14 ? siren : "",
    siren: siren.length === 14 ? siren.slice(0, 9) : siren,
  });
}

const MERGE_KEYS = [
  "civility",
  "firstName",
  "lastName",
  "legalName",
  "tradeName",
  "legalForm",
  "country",
  "address",
  "postalCode",
  "city",
  "siren",
  "siret",
  "vatNumber",
  "email",
  "phone",
  "contactName",
  "contactRole",
  "registration",
  "notes",
] as const;

export function mergeKnownClient(existing: ClientDraft, incoming: ClientDraft): ClientDraft {
  const next = { ...existing, mode: "update" as const, missing: [] as string[], vatDeduced: false };
  const existingName = fold(displayName(existing));
  const incomingName = fold(displayName(incoming));
  const fragment =
    incomingName.length > 0 &&
    incomingName.length < existingName.length &&
    existingName.includes(incomingName);
  for (const key of MERGE_KEYS) {
    if (fragment && (key === "legalName" || key === "firstName" || key === "lastName" || key === "civility")) {
      continue;
    }
    const value = incoming[key];
    if (value) next[key] = value;
  }
  if (incoming.kind) next.kind = incoming.kind;
  return qualifyDraft(next);
}

export function emptyDraft(): ClientDraft {
  return {
    mode: "create",
    kind: "",
    scope: "",
    civility: "",
    firstName: "",
    lastName: "",
    legalName: "",
    tradeName: "",
    legalForm: "",
    country: "",
    address: "",
    postalCode: "",
    city: "",
    siren: "",
    siret: "",
    vatNumber: "",
    vatDeduced: false,
    email: "",
    phone: "",
    contactName: "",
    contactRole: "",
    registration: "",
    notes: "",
    missing: [],
  };
}

export function displayName(draft: ClientDraft): string {
  if (draft.kind === "particulier") {
    const person = [draft.firstName, draft.lastName].filter(Boolean).join(" ");
    return person || draft.legalName;
  }
  return draft.legalName || [draft.firstName, draft.lastName].filter(Boolean).join(" ");
}

export function identifyClient(text: string): ClientDraft | null {
  const raw = text.trim().replace(/[^\S\n]+/g, " ");
  if (!raw || isOtherCatalogCommand(raw) || isProjectCommand(raw)) return null;
  if (!looksLikeClientBrief(raw)) return null;
  const draft = finalize(extractDraft(raw));
  if (!reliableClientName(raw, draft)) return null;
  return draft;
}

function correctionTargets(comment: string): Set<string> {
  const folded = fold(comment);
  const targets = new Set<string>();
  if (/\b(telephone|tel)\b/.test(folded)) targets.add("phone");
  if (/\b(e-?mail|courriel|mail)\b/.test(folded)) targets.add("email");
  const street = /\b\d{1,5}\s+(?:bis\s+|ter\s+)?(?:rue|avenue|boulevard|bd|chemin|impasse|place|allee|route)\b/.test(folded);
  if (/\badresse\b/.test(folded) || (/\bplutot\b/.test(folded) && street)) {
    targets.add("address");
    targets.add("postalCode");
    targets.add("city");
  }
  if (/\bcontacts?\b/.test(folded)) {
    targets.add("contactName");
    targets.add("contactRole");
  }
  if (/(?:informations?|pr[eé]cision|notes?)\s*(?:sur [^,:]{0,80})?\s*[:：]/i.test(comment)) {
    targets.add("notes");
  }
  if (
    /\bparticuliers?\b|\bmadame\b|\bmme\b|\bmonsieur\b|\bentreprises?\b|\bsociete\b|\bcompany\b|\bgmbh\b|\bsas\b|\bsarl\b|\bsasu\b|\bltd\b|\bllc\b|\boyj?\b/.test(
      folded,
    )
  ) {
    targets.add("kind");
  }
  if (/\benseigne\b/.test(folded)) targets.add("tradeName");
  if (/\bpays\b/.test(folded)) targets.add("country");
  if (/\bsiret\b/.test(folded)) {
    targets.add("siret");
    targets.add("siren");
  } else if (/\bsiren\b/.test(folded)) {
    targets.add("siren");
  }
  if (/\b(tva|vat)\b/.test(folded)) targets.add("vatNumber");
  return targets;
}

export function reviseDraft(
  current: ClientDraft,
  comment: string,
): { draft: ClientDraft; changed: boolean } {
  const next = { ...current, missing: [], vatDeduced: false };
  const found = extractDraft(comment);
  const keys = [
    "kind",
    "civility",
    "firstName",
    "lastName",
    "legalName",
    "tradeName",
    "legalForm",
    "country",
    "address",
    "postalCode",
    "city",
    "siren",
    "siret",
    "vatNumber",
    "email",
    "phone",
    "contactName",
    "contactRole",
    "registration",
    "notes",
  ] as const;
  const targets = correctionTargets(comment);
  let changed = false;
  for (const key of keys) {
    if (!targets.has(key)) continue;
    if (key === "kind" || key === "legalName" || key === "firstName" || key === "lastName" || key === "civility") continue;
    const value = found[key];
    if (typeof value === "string" && value && value !== current[key]) {
      if (
        key === "notes" &&
        current.notes &&
        !current.notes.includes(value) &&
        !value.includes(current.notes)
      ) {
        next.notes = `${current.notes} ${value}`.trim();
      } else {
        next[key] = value;
      }
      changed = true;
    }
  }
  if (targets.has("kind") && found.kind && found.kind !== current.kind) {
    next.kind = found.kind;
    changed = true;
  }
  return { draft: finalize(next), changed };
}

export function readConfirmation(
  text: string,
): "confirm" | "reject" | "comment" {
  const turn = classifyPendingTurn(text);
  if (turn === "confirm") return "confirm";
  if (turn === "reject") return "reject";
  return "comment";
}

export function proposalFields(draft: ClientDraft): ProposalField[] {
  const fields: ProposalField[] = [
    { label: "Action", value: draft.mode === "update" ? "Mise à jour" : "Création" },
    { label: "Type", value: kindLabel(draft.kind) },
    { label: "Périmètre", value: scopeLabel(draft.scope) },
    { label: "Nom", value: labeledName(draft) },
    { label: "Enseigne", value: draft.tradeName },
    { label: "Forme", value: draft.legalForm },
    { label: "Pays", value: draft.country },
    { label: "Adresse", value: draft.address },
    { label: "Code postal", value: draft.postalCode },
    { label: "Ville", value: draft.city },
    { label: "Identifiant", value: draft.registration },
    { label: "SIREN", value: draft.siren },
    { label: "SIRET", value: draft.siret },
    {
      label: "TVA",
      value: draft.vatNumber
        ? draft.vatDeduced
          ? `${draft.vatNumber} (déduit du SIREN)`
          : draft.vatNumber
        : "",
    },
    {
      label: "Contact",
      value: [draft.contactName, draft.contactRole].filter(Boolean).join(", "),
    },
    { label: "E-mail", value: draft.email },
    { label: "Téléphone", value: draft.phone },
    { label: "Notes", value: draft.notes },
  ];
  return fields.filter((field) => field.value);
}

export function presentProposal(draft: ClientDraft): string {
  const action = draft.mode === "update" ? "mise à jour d’un client" : "création d’un client";
  const read = proposalFields(draft)
    .filter((field) => field.label !== "Action")
    .map((field) => `${field.label} : ${field.value}`);
  const gaps =
    draft.missing.length > 0
      ? `À préciser : ${draft.missing.join(", ")}.`
      : "Les informations utiles à un dossier commercial sont réunies.";
  return [
    `Action demandée : ${action}.`,
    read.length > 0
      ? `Analyse : ${read.join(" ; ")}.`
      : "Analyse : le message ne permet pas de séparer les informations.",
    gaps,
    draft.mode === "update" ? "Les informations déjà enregistrées et non citées sont conservées." : "",
    "Rien n’est enregistré avant votre accord.",
    "Confirmez-vous l’enregistrement ? Sinon, indiquez la correction, par exemple « le téléphone est le 06 98 76 54 32 ».",
  ]
    .filter(Boolean)
    .join("\n");
}

export function notesWithRegistration(notes: string, registration: string): string {
  if (!registration || notes.includes(registration)) return notes;
  const line = `Identifiant d'entreprise : ${registration}`;
  return notes ? `${line}. ${notes}` : line;
}

export function isNewClientBrief(text: string): boolean {
  return /(?:nouveau client|cr[ée]er (?:un |le |une )?(?:compte )?client|cr[ée]ation d['’]un compte client|ajoute(?:r|z)?(?:\s+le|\s+un|\s+une)?(?:\s+compte)?\s+client|fiche client)/i.test(
    text,
  );
}

export function isProjectCommand(text: string): boolean {
  return /^(?:cr[ée]e(?:r|z)?|ajoute(?:r|z)?|ouvre(?:z)?)\s+(?:d['’]un\s+|un\s+|le\s+)?projet\b/i.test(
    text.trim(),
  );
}

function isOtherCatalogCommand(text: string): boolean {
  return /^(?:cr[ée]e(?:r|z)?|ajoute(?:r|z)?|ouvre(?:z)?|enregistre(?:r|z)?|devis)\b/i.test(
    text.trim(),
  ) && !/client/i.test(text);
}

function reliableClientName(message: string, draft: ClientDraft): boolean {
  const shown = displayName(draft).trim();
  if (!plainLabel(shown)) return false;
  const name = fold(shown.replace(/['’]/g, " "));
  const source = fold(clean(message).replace(/['’]/g, " "));
  if (name === source || name.length >= Math.floor(source.length * 0.75)) return false;
  if (/\b(nouveau client|nouvelle cliente|j ai|je veux|je voudrais|comme client)\b/.test(name)) return false;
  return true;
}

function looksLikeClientBrief(text: string): boolean {
  return /client|particulier|entreprise|soci[ée]t[ée]|\b(?:sas|sarl|sasu|gmbh|ltd|oy|oyj)\b|vat\s*id|business\s*id/i.test(
    text,
  );
}

function extractDraft(text: string): ClientDraft {
  const draft = emptyDraft();
  const source = text.trim();
  const email = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) draft.email = email[0];

  const siret = source.match(/\b(\d{14})\b/);
  if (siret) {
    draft.siret = siret[1] ?? "";
    draft.siren = draft.siret.slice(0, 9);
  }
  if (!draft.siren) {
    const siren = source.match(/\b(?:siren\s*)?(\d{9})\b/i);
    if (siren && !source.includes(siren[1] + "00000")) draft.siren = siren[1] ?? "";
  }

  const labeledVat = source.match(
    /(?:vat(?:\s*id)?|n°?\s*tva|tva)\s*[:：]?\s*([A-Z]{2}[\s-]?[A-Z0-9]{6,14})/i,
  );
  const vat = labeledVat ?? source.match(
    /\b((?:FR[0-9A-Z]{2}\d{9})|(?:DE\d{9})|(?:FI\d{8})|(?:BE0?\d{9,10})|(?:GB[0-9A-Z]{5,12})|(?:IT\d{11})|(?:ES[A-Z0-9]\d{7}[A-Z0-9])|(?:NL\d{9}B\d{2})|(?:CHE[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{3}))\b/i,
  );
  if (vat) draft.vatNumber = (vat[1] ?? "").replace(/[\s-]/g, "").toUpperCase();
  applyRegistration(source, draft);

  const withoutIds = source
    .replace(draft.email, " ")
    .replace(draft.siret, " ")
    .replace(draft.vatNumber, " ")
    .replace(draft.registration, " ")
    .replace(draft.siren, " ");
  const phone = withoutIds.match(
    /(?:\+\d{1,3}[\s.-]*)?(?:\d[\s.-]*){8,14}\d/,
  );
  if (phone) draft.phone = phone[0].replace(/\s+/g, " ").trim();

  applyKind(source, draft);
  applyCountry(source, draft);
  applyIdentity(source, draft);
  applyAddress(source, draft);
  applyContact(source, draft);
  applyNotes(source, draft);
  return draft;
}

function applyKind(source: string, draft: ClientDraft) {
  const folded = fold(source);
  const particulierAt = folded.search(/\bparticuliers?\b|\bmadame\b|\bmme\b|\bmonsieur\b/);
  const entrepriseAt = folded.search(
    /\bentreprises?\b|\bsociete\b|\bcompany\b|\bgmbh\b|\bsas\b|\bsarl\b|\bsasu\b|\bltd\b|\bllc\b|\boyj?\b/,
  );
  if (particulierAt >= 0 || entrepriseAt >= 0) {
    draft.kind = entrepriseAt > particulierAt ? "entreprise" : "particulier";
  }
  if (draft.siren && !draft.kind) draft.kind = "entreprise";
}

function applyCountry(source: string, draft: ClientDraft) {
  const folded = fold(source);
  const countries: Array<[RegExp, string]> = [
    [/\broyaume-uni\b|\broyaume uni\b|\bangleterre\b|\bunited kingdom\b|\bgb\b/, "Royaume-Uni"],
    [/\ballemagne\b|\bgermany\b|\bdeutschland\b/, "Allemagne"],
    [/\bbelgique\b|\bbelgium\b/, "Belgique"],
    [/\bsuisse\b|\bswitzerland\b/, "Suisse"],
    [/\bespagne\b|\bspain\b/, "Espagne"],
    [/\bitalie\b|\bitaly\b/, "Italie"],
    [/\bpays-bas\b|\bpays bas\b|\bnetherlands\b/, "Pays-Bas"],
    [/\bluxembourg\b/, "Luxembourg"],
    [/\betats-unis\b|\betats unis\b|\busa\b|\bunited states\b/, "États-Unis"],
    [/\bfinlande\b|\bfinland\b/, "Finlande"],
    [/\bsuede\b|\bsu[eè]de\b|\bsweden\b/, "Suède"],
    [/\bnorv[eè]ge\b|\bnorway\b/, "Norvège"],
    [/\bdanemark\b|\bdenmark\b/, "Danemark"],
    [/\bautriche\b|\baustria\b/, "Autriche"],
    [/\bpologne\b|\bpoland\b/, "Pologne"],
    [/\bportugal\b/, "Portugal"],
    [/\birlande\b|\bireland\b/, "Irlande"],
    [/\bfrance\b/, "France"],
  ];
  for (const [pattern, label] of countries) {
    if (pattern.test(folded)) {
      draft.country = label;
      return;
    }
  }
}

function applyIdentity(source: string, draft: ClientDraft) {
  const head = source.split(/[:：]/)[0] ?? source;
  if (/[:：]/.test(source) && /\b(t[ée]l[ée]phones?|tel|adresses?|e-?mails?|courriels?|mails?)\b/i.test(head)) {
    return;
  }
  const trade = source.match(/enseigne\s+([^,]+)/i);
  if (trade) draft.tradeName = clean(trade[1] ?? "");
  if (!isNewClientBrief(source) && !/^[^:]{0,40}:/.test(source)) return;

  const clause = clauseAfterIntro(source);
  if (!clause || /^(le |la |l'|c'est |c est )/i.test(clause)) return;
  if (draft.kind === "particulier") {
    const parsed = parsePerson(clause);
    draft.civility = parsed.civility;
    draft.firstName = parsed.firstName;
    draft.lastName = parsed.lastName;
    return;
  }
  const form = findLegalForm(clause);
  draft.legalForm = form;
  draft.legalName = clean(clause);
  if (!draft.kind && form) draft.kind = "entreprise";
}

function applyAddress(source: string, draft: ClientDraft) {
  const street = source.match(
    /\b(\d{1,5}\s+(?:bis\s+|ter\s+)?(?:rue|avenue|boulevard|bd|chemin|impasse|place|all[ée]e|route|quai|cours|voie|sentier|street|road|lane)\b[^,.;\n]*)/i,
  );
  if (street) {
    draft.address = clean(street[1] ?? "");
    const after = source.slice((street.index ?? 0) + street[0].length);
    const city = after.match(/^\s*,\s*([A-Za-zÀ-ÿ][^,.;\n]{1,40})/);
    if (city && !/^\d/.test(city[1] ?? "") && !draft.city) draft.city = titleWord(clean(city[1] ?? ""));
  }
  const parts = source.split(/[,\n]/);
  for (const part of parts) {
    const segment = part.trim().replace(/^si[èe]ge\s+/i, "");
    if (!segment || segment.length > 80) continue;
    const postal = segment.match(/^(\d{4,5})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' .-]{1,40})$/);
    if (postal) {
      draft.postalCode = draft.postalCode || (postal[1] ?? "");
      draft.city = draft.city || titleWord(postal[2] ?? "");
      continue;
    }
    if (
      /(?:\b(?:rue|avenue|boulevard|impasse|chemin|street|route|place|all[ée]e|road|lane)\b|stra(?:ss|ß)e|katu|tie|kuja|polku|gatan|vej|straat)/i.test(
        segment,
      )
    ) {
      draft.address = draft.address || clean(segment);
    }
  }
  const french = source.match(/\b(\d{5})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,40})/);
  if (french && !draft.postalCode) {
    draft.postalCode = french[1] ?? "";
    draft.city = titleWord(french[2] ?? "");
  }
  const uk = source.match(/\b([A-Za-zÀ-ÿ' -]{2,30}?)\s+([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
  if (uk) {
    draft.city = draft.city || clean(uk[1] ?? "");
    draft.postalCode = (uk[2] ?? "").toUpperCase();
  }
}

export function asksToEnrichRecord(text: string): boolean {
  if (explicitClientCreation(text)) return false;
  const folded = fold(text);
  const verb = /\b(ajoute\w*|complete\w*|renseigne\w*|precis\w*|indique\w*|mettre|mets|mettez|modifi\w*|chang\w*|corrig\w*)\b/.test(folded);
  const topic = /\b(contact|contacts|information|informations|fiche|note|notes|secteur|adresse|telephone|tel|e-mail|email|mail|siret|siren|tva)\b/.test(folded);
  if (verb && topic) return true;
  return /\bcontacts?\b/.test(folded) && /\b(est|sont)\b/.test(folded);
}

export function enrichmentOwnsTurn(text: string, intent: AgentIntent): boolean {
  if (explicitClientCreation(text)) return false;
  return asksToEnrichRecord(text) || intent === "change";
}

export function knownRecordPrompt(draft: ClientDraft): string {
  const lines = proposalFields(draft)
    .filter((field) => field.label !== "Action" && field.label !== "Périmètre")
    .map((field) => `${field.label} : ${field.value}`);
  const contact = draft.contactName
    ? `Le contact enregistré est ${draft.contactName}${draft.contactRole ? `, ${draft.contactRole}` : ""}.`
    : "Aucun contact n’est encore enregistré.";
  return [
    `${displayName(draft)} est déjà dans les fiches.`,
    ...lines,
    contact,
    "Dites le contact à ajouter, par exemple « contact Anne Durand, directrice », ou l’information à compléter. Rien n’est enregistré avant votre accord.",
  ].join("\n");
}

export function clientFieldMap(draft: ClientDraft): Record<string, string> {
  return {
    name: displayName(draft),
    kind: draft.kind,
    country: draft.country,
    city: draft.city,
    address: draft.address,
    postalCode: draft.postalCode,
    siren: draft.siren,
    siret: draft.siret,
    vatNumber: draft.vatNumber,
    contactName: draft.contactName,
    contactRole: draft.contactRole,
    email: draft.email,
    phone: draft.phone,
    notes: draft.notes,
    tradeName: draft.tradeName,
    legalForm: draft.legalForm,
    sector: "",
  };
}

function applyContact(source: string, draft: ClientDraft) {
  const keyword = /contacts?/i.exec(source);
  if (!keyword) return;
  const rest = source.slice(keyword.index + keyword[0].length);
  const person = "([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]+(?:\\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]+){0,3})";
  const match =
    rest.match(new RegExp(`^\\s+(?:de|du|des|pour|chez)\\s+[^,:]{0,80}[:：]\\s*${person}`)) ??
    rest.match(new RegExp(`^\\s*[:：]\\s*${person}`)) ??
    rest.match(new RegExp(`^\\s+(?:est\\s+|s['’]appelle\\s+)?${person}`));
  if (!match) return;
  const name = clean(match[1] ?? "");
  const first = name.split(/\s+/)[0] ?? "";
  if (!name || /^(un|une|le|la|les|des|du|de|chez|pour)$/i.test(first)) return;
  draft.contactName = name;
  const after = rest.slice((match.index ?? 0) + match[0].length);
  const role = after.match(/^\s*[,:(]\s*([^,;\n)]+)/);
  if (!role) return;
  const raw = clean(role[1] ?? "");
  const folded = fold(raw);
  const head = folded.split(/\s+/)[0] ?? "";
  if (ROLES.has(folded) || ROLES.has(head)) draft.contactRole = raw;
}

function applyNotes(source: string, draft: ClientDraft) {
  const info = source.match(/(?:informations?|pr[eé]cision|notes?)\s*(?:sur [^,:]{0,80})?\s*[:：]\s*([^\n]+)/i);
  if (info) {
    draft.notes = clean(info[1] ?? "");
    return;
  }
  const sentences = source.split(/(?<=\.)\s+/);
  const notes = sentences.filter((sentence) => {
    const folded = sentence.trim();
    if (!folded || folded.includes("@")) return false;
    if (/\d{5}|\+\d|\bSIREN\b|\bSIRET\b|\bTVA\b/i.test(folded)) return false;
    if (/nouveau client|enseigne|contact\s+/i.test(folded)) return false;
    return folded.endsWith(".") && !/^\s*(?:Mme|M\.|Monsieur)/i.test(folded);
  });
  if (notes.length > 0) draft.notes = notes.join(" ").trim();
}

function finalize(draft: ClientDraft): ClientDraft {
  const next = { ...draft };
  if (!next.country && next.postalCode.length === 5 && /^\d{5}$/.test(next.postalCode)) {
    next.country = "France";
  }
  if (!next.country && /^[A-Z]{1,2}\d/.test(next.postalCode)) next.country = "Royaume-Uni";
  if (next.vatNumber.startsWith("FR")) next.country = next.country || "France";
  if (next.vatNumber.startsWith("DE")) next.country = next.country || "Allemagne";
  if (next.vatNumber.startsWith("FI")) next.country = next.country || "Finlande";
  if (next.registration && !next.kind) next.kind = "entreprise";
  if (next.country === "France" || (!next.country && next.siren)) {
    next.scope = "france";
    if (!next.country) next.country = "France";
  } else if (next.country) {
    next.scope = next.country === "France" ? "france" : "international";
  }
  if (next.kind === "entreprise" && next.scope === "france" && isLuhn(next.siren) && !next.vatNumber) {
    next.vatNumber = frenchVat(next.siren);
    next.vatDeduced = true;
  }
  if (next.siren && !isLuhn(next.siren)) next.missing = ["SIREN à vérifier"];
  next.missing = unique([...next.missing, ...commercialGaps(next)]);
  return next;
}

function commercialGaps(draft: ClientDraft): string[] {
  const gaps: string[] = [];
  if (!draft.kind) gaps.push("particulier ou entreprise");
  if (!draft.country) gaps.push("pays");
  if (!displayName(draft)) gaps.push("nom");
  if (!draft.address) gaps.push("adresse");
  if (!draft.email && !draft.phone) gaps.push("e-mail ou téléphone");
  if (draft.kind === "entreprise" && draft.scope === "france" && !draft.siren) gaps.push("SIREN");
  if (draft.kind === "entreprise" && draft.scope === "international" && !draft.vatNumber) {
    gaps.push("identifiant fiscal");
  }
  if (draft.kind === "entreprise" && !draft.contactName) gaps.push("contact");
  return gaps;
}

function applyRegistration(source: string, draft: ClientDraft) {
  const found = new Set<string>();
  const pattern =
    /(?:business\s*id|trade\s*reg(?:istration)?\.?\s*no\.?|y-tunnus|company\s*(?:no|number)|n°\s*d['’]immatriculation)\s*[:：.]?\s*([A-Z0-9][A-Z0-9./-]{2,24})/gi;
  for (const match of source.matchAll(pattern)) {
    const value = (match[1] ?? "").replace(/[.,;]+$/g, "");
    if (value) found.add(value);
  }
  if (found.size > 0) draft.registration = [...found].join(", ");
}

function clauseAfterIntro(source: string): string {
  const intro = source.includes(":") ? source.split(":").slice(1).join(":") : source;
  const clause = intro.split(/,|\n/)[0]?.trim() ?? "";
  return clause
    .replace(
      /^(?:ajoute(?:r|z)?|cr[ée]e(?:r|z)?|cr[ée]ation(?:\s+d['’]un)?|nouveau)\s+(?:le\s+|un\s+|une\s+|d['’]un\s+)?(?:compte\s+)?/i,
      "",
    )
    .replace(/^(?:nouveau client|client|particulier|entreprise)\s+/i, "")
    .trim();
}

function parsePerson(clause: string): { civility: string; firstName: string; lastName: string } {
  const match = clause.match(/^(?:(Mme|Madame|M\.|Monsieur|Mr|Mrs)\s+)?(.+)$/i);
  const civilityRaw = match?.[1] ?? "";
  const rest = (match?.[2] ?? clause).trim().split(/\s+/);
  const civility = /^mme|^madame|^mrs/i.test(civilityRaw)
    ? "Madame"
    : civilityRaw
      ? "Monsieur"
      : "";
  return {
    civility,
    firstName: rest[0] ?? "",
    lastName: rest.slice(1).join(" "),
  };
}

function findLegalForm(clause: string): string {
  const tokens = clause.split(/\s+/);
  const last = tokens.at(-1) ?? "";
  return LEGAL_FORMS.find((form) => form.toLowerCase() === last.toLowerCase()) ?? "";
}

function labeledName(draft: ClientDraft): string {
  const person = [draft.firstName, draft.lastName].filter(Boolean).join(" ");
  if (draft.kind === "particulier") {
    return [draft.civility, person].filter(Boolean).join(" ") || draft.legalName;
  }
  return draft.legalName || person;
}

function kindLabel(kind: ClientKind): string {
  if (kind === "particulier") return "Particulier";
  if (kind === "entreprise") return "Entreprise";
  return "";
}

function scopeLabel(scope: ClientScope): string {
  if (scope === "france") return "France";
  if (scope === "international") return "International";
  return "";
}

export function isLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let alternate = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function frenchVat(siren: string): string {
  const key = (12 + 3 * (Number(siren) % 97)) % 97;
  return `FR${String(key).padStart(2, "0")}${siren}`;
}

function titleWord(value: string): string {
  const text = clean(value);
  if (text !== text.toUpperCase() || text === text.toLowerCase()) return text;
  return text
    .toLowerCase()
    .replace(/(^|[\s'-])([a-zà-ÿ])/g, (_all, separator: string, character: string) =>
      separator + character.toUpperCase(),
    );
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[.,;]+$/g, "").trim();
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
