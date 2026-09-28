import type { AnswerPacket } from "./answer-packet.ts";
import { centsFromWritten, formatCents } from "./pricing.ts";

export const CONTRACT_KINDS = ["maintenance", "infogerance", "location"] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

export const CONTRACT_PERIODS = ["mensuel", "trimestriel", "semestriel", "annuel"] as const;
export type ContractPeriod = (typeof CONTRACT_PERIODS)[number];

const MONTHS: Record<ContractPeriod, number> = {
  mensuel: 1,
  trimestriel: 3,
  semestriel: 6,
  annuel: 12,
};

const KIND_LABEL: Record<ContractKind, string> = {
  maintenance: "Maintenance",
  infogerance: "Infogérance",
  location: "Location",
};

export const CONTRACT_DUE_METHOD =
  "L’échéance retient les contrats confirmés dont la date de fin est comprise entre aujourd’hui et dans 30 jours, dates UTC. Le montant mensuel indiqué est le montant de période déjà enregistré, divisé par le nombre de mois de la périodicité, arrondi au centime. Le modèle ne compare pas les dates et n’estime pas les montants.";

export const CONTRACT_MONTHLY_METHOD =
  "Le montant mensuel de chaque contrat est le montant de période déjà enregistré, divisé par le nombre de mois de la périodicité, arrondi au centime. Le total additionne ces montants mensuels déjà calculés. Seuls les contrats confirmés comptent. Le modèle ne les estime pas.";

export type StoredContract = {
  clientName: string;
  kind: ContractKind;
  startsOn: string;
  endsOn: string;
  periodicity: ContractPeriod;
  amountCents: number;
};

export type ContractPayload = {
  clientId: string;
  clientName: string;
  kind: ContractKind;
  startsOn: string;
  endsOn: string;
  periodicity: ContractPeriod;
  amountCents: number;
};

export type ContractQuestion =
  | { kind: "due"; types: ContractKind[] }
  | { kind: "monthly"; types: ContractKind[] };

export type ContractEntry =
  | { ready: false; missing: string }
  | {
      ready: true;
      draft: {
        kind: ContractKind;
        startsOn: string;
        endsOn: string;
        periodicity: ContractPeriod;
        amountCents: number;
      };
    };

export function kindLabel(kind: ContractKind): string {
  return KIND_LABEL[kind];
}

export function monthlyCents(amountCents: number, periodicity: ContractPeriod): number {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error("Le montant de période doit être un entier de centimes, positif ou nul.");
  }
  return Math.round(amountCents / MONTHS[periodicity]);
}

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function addUtcDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days)).toISOString().slice(0, 10);
}

export function isDueOn(endsOn: string, today: string, horizon: string): boolean {
  return endsOn >= today && endsOn <= horizon;
}

export function readContractQuestion(text: string): ContractQuestion | null {
  const folded = fold(text);
  if (/\bcontrats?\b/.test(folded) && /\becheances?\b/.test(folded) && /\b30\s+jours\b/.test(folded)) {
    return { kind: "due", types: kindsNamed(folded) };
  }
  if (
    /\bmontant\s+recurrent\b|\brecurrent\s+mensuel\b|\bmontant\s+mensuel\b/.test(folded) &&
    /\b(contrats?|infogerances?|entretiens?|maintenances?|locations?)\b/.test(folded)
  ) {
    return { kind: "monthly", types: kindsNamed(folded) };
  }
  return null;
}

export function readContractEntry(text: string): ContractEntry | null {
  const folded = fold(text);
  if (readContractQuestion(text)) return null;
  if (!/\b(enregistre|enregistrer|proposer|proposez|propose|ajoute|ajouter|creer|saisir|saisis)\b/.test(folded)) {
    return null;
  }
  if (!/\bcontrats?\b/.test(folded)) return null;
  if (/\$|\busd\b/i.test(text)) {
    return { ready: false, missing: "Montant en dollars. Le contrat en euro n’est pas proposé." };
  }
  const kinds = kindsNamed(folded);
  if (kinds.length !== 1) {
    return {
      ready: false,
      missing:
        kinds.length > 1
          ? "Un seul type : maintenance, infogérance ou location."
          : "Indiquez le type : maintenance, infogérance ou location.",
    };
  }
  const dates = readDatePair(text);
  if (!dates) {
    return { ready: false, missing: "Indiquez le début et la fin, par exemple du 2026-01-01 au 2026-12-31." };
  }
  if (dates.endsOn < dates.startsOn) {
    return { ready: false, missing: "La fin est avant le début. Le contrat n’est pas proposé." };
  }
  const periods = periodsNamed(folded);
  if (periods.length !== 1) {
    return {
      ready: false,
      missing:
        periods.length > 1
          ? "Une seule périodicité : mensuel, trimestriel, semestriel ou annuel."
          : "Indiquez la périodicité : mensuel, trimestriel, semestriel ou annuel.",
    };
  }
  const amountCents = centsFromWritten(text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ").replace(/\b\d{1,2}[/.]\d{1,2}[/.]\d{4}\b/g, " "));
  if (amountCents === null) {
    return { ready: false, missing: "Indiquez le montant écrit de la période." };
  }
  const kind = kinds[0];
  const periodicity = periods[0];
  if (!kind || !periodicity) return { ready: false, missing: "Indiquez le type : maintenance, infogérance ou location." };
  return {
    ready: true,
    draft: { kind, startsOn: dates.startsOn, endsOn: dates.endsOn, periodicity, amountCents },
  };
}

export function contractPayload(value: unknown): ContractPayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ContractPayload>;
  if (typeof raw.clientId !== "string" || raw.clientId.trim().length === 0) return null;
  if (typeof raw.clientName !== "string" || raw.clientName.trim().length < 2) return null;
  if (!isKind(raw.kind) || !isPeriod(raw.periodicity)) return null;
  if (!isIsoDate(raw.startsOn) || !isIsoDate(raw.endsOn) || raw.endsOn < raw.startsOn) return null;
  if (typeof raw.amountCents !== "number" || !Number.isInteger(raw.amountCents) || raw.amountCents < 0) return null;
  return {
    clientId: raw.clientId,
    clientName: raw.clientName.trim(),
    kind: raw.kind,
    startsOn: raw.startsOn,
    endsOn: raw.endsOn,
    periodicity: raw.periodicity,
    amountCents: raw.amountCents,
  };
}

export function duePacket(input: {
  contracts: StoredContract[];
  types: ContractKind[];
  today: string;
  pending: number;
}): AnswerPacket {
  const horizon = addUtcDays(input.today, 30);
  const wanted = input.types.length > 0 ? input.types : [...CONTRACT_KINDS];
  const kept = input.contracts
    .filter((contract) => wanted.includes(contract.kind) && isDueOn(contract.endsOn, input.today, horizon))
    .sort((left, right) => left.endsOn.localeCompare(right.endsOn) || left.clientName.localeCompare(right.clientName));
  return {
    title: "Contrats à échéance",
    period: `${input.today} → ${horizon}`,
    filters: wanted.map(kindLabel),
    measures: [{ label: "Contrats", value: kept.length === 0 ? "aucun" : String(kept.length) }],
    rows: kept.map(contractRow),
    sources: ["Contrats confirmés"],
    missing: [kept.length === 0 ? "Aucun contrat confirmé n’arrive à échéance dans les 30 jours." : "", pendingLine(input.pending)].filter(
      Boolean,
    ),
    method: CONTRACT_DUE_METHOD,
  };
}

export function monthlyPacket(input: {
  contracts: StoredContract[];
  types: ContractKind[];
  pending: number;
}): AnswerPacket {
  if (input.types.length === 0) {
    return {
      title: "Montant récurrent mensuel",
      period: "",
      filters: [],
      measures: [],
      rows: [],
      sources: [],
      missing: ["Indiquez le type : infogérance, entretien, maintenance ou location."],
      method: "Rien n’est calculé tant qu’il manque cet élément.",
    };
  }
  const kept = input.contracts
    .filter((contract) => input.types.includes(contract.kind))
    .sort((left, right) => left.clientName.localeCompare(right.clientName));
  const months = kept.map((contract) => monthlyCents(contract.amountCents, contract.periodicity));
  const total = months.reduce((sum, value) => sum + value, 0);
  return {
    title: "Montant récurrent mensuel",
    period: "",
    filters: input.types.map(kindLabel),
    measures:
      kept.length === 0
        ? [{ label: "Mensuel", value: "aucun contrat" }]
        : [
            { label: "Mensuel", value: formatCents(total) },
            { label: "Contrats", value: String(kept.length) },
          ],
    rows: kept.map(contractRow),
    sources: ["Contrats confirmés"],
    missing: [kept.length === 0 ? "Aucun contrat confirmé de ce type." : "", pendingLine(input.pending)].filter(Boolean),
    method: CONTRACT_MONTHLY_METHOD,
  };
}

export function contractGapPacket(missing: string): AnswerPacket {
  return {
    title: "Contrat à confirmer",
    period: "",
    filters: [],
    measures: [],
    rows: [],
    sources: [],
    missing: [missing],
    method: "Rien n’est enregistré tant qu’il manque cet élément.",
  };
}

export function contractProposalPacket(draft: Omit<ContractPayload, "clientId">): AnswerPacket {
  return {
    title: "Contrat à confirmer",
    period: `${draft.startsOn} → ${draft.endsOn}`,
    filters: [draft.clientName, kindLabel(draft.kind), draft.periodicity],
    measures: [
      { label: "Montant", value: formatCents(draft.amountCents) },
      { label: "Mensuel", value: formatCents(monthlyCents(draft.amountCents, draft.periodicity)) },
    ],
    rows: [],
    sources: ["Phrase"],
    missing: ["Rien n’est enregistré avant confirmation."],
    method:
      "Le montant de période est le premier montant écrit. Le mensuel le divise par le nombre de mois de la périodicité, arrondi au centime. Le modèle ne propose pas ces montants.",
  };
}

export function contractFields(draft: Omit<ContractPayload, "clientId">): Array<{ label: string; value: string }> {
  return [
    { label: "Client", value: draft.clientName },
    { label: "Type", value: kindLabel(draft.kind) },
    { label: "Début", value: draft.startsOn },
    { label: "Fin", value: draft.endsOn },
    { label: "Périodicité", value: draft.periodicity },
    { label: "Montant", value: formatCents(draft.amountCents) },
    { label: "Mensuel", value: formatCents(monthlyCents(draft.amountCents, draft.periodicity)) },
  ];
}

function contractRow(contract: StoredContract): { label: string; detail: string } {
  return {
    label: `${contract.clientName} · ${kindLabel(contract.kind)}`,
    detail: `fin ${contract.endsOn}, ${contract.periodicity}, période ${formatCents(contract.amountCents)}, mensuel ${formatCents(monthlyCents(contract.amountCents, contract.periodicity))}`,
  };
}

function pendingLine(pending: number): string {
  if (pending <= 0) return "";
  return pending === 1
    ? "1 contrat en attente de confirmation n’est pas compté."
    : `${pending} contrats en attente de confirmation ne sont pas comptés.`;
}

function kindsNamed(folded: string): ContractKind[] {
  const found: ContractKind[] = [];
  if (/\binfogerances?\b/.test(folded)) found.push("infogerance");
  if (/\b(maintenances?|entretiens?)\b/.test(folded)) found.push("maintenance");
  if (/\blocations?\b/.test(folded)) found.push("location");
  return found;
}

function periodsNamed(folded: string): ContractPeriod[] {
  const found: ContractPeriod[] = [];
  if (/\bsemestriels?\b|\bsemestrielles?\b/.test(folded)) found.push("semestriel");
  if (/\btrimestriels?\b|\btrimestrielles?\b/.test(folded)) found.push("trimestriel");
  if (/\bmensuels?\b|\bmensuelles?\b|\bpar mois\b/.test(folded)) found.push("mensuel");
  if (/\bannuels?\b|\bannuelles?\b|\bpar an\b/.test(folded)) found.push("annuel");
  return found;
}

function readDatePair(text: string): { startsOn: string; endsOn: string } | null {
  const found: Array<{ at: number; iso: string }> = [];
  for (const match of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const iso = validIso(match[1] ?? "", match[2] ?? "", match[3] ?? "");
    if (iso) found.push({ at: match.index ?? 0, iso });
  }
  for (const match of text.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) {
    const iso = validIso(match[3] ?? "", match[2] ?? "", match[1] ?? "");
    if (iso) found.push({ at: match.index ?? 0, iso });
  }
  found.sort((left, right) => left.at - right.at);
  const first = found[0];
  const second = found[1];
  if (!first || !second) return null;
  return { startsOn: first.iso, endsOn: second.iso };
}

function validIso(yearRaw: string, monthRaw: string, dayRaw: string): string | null {
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && validIso(value.slice(0, 4), value.slice(5, 7), value.slice(8, 10)) === value;
}

function isKind(value: unknown): value is ContractKind {
  return typeof value === "string" && CONTRACT_KINDS.includes(value as ContractKind);
}

function isPeriod(value: unknown): value is ContractPeriod {
  return typeof value === "string" && CONTRACT_PERIODS.includes(value as ContractPeriod);
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
