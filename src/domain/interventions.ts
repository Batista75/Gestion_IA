import type { AnswerPacket } from "./answer-packet.ts";
import { centsFromWritten, formatCents } from "./pricing.ts";

export const INTERVENTION_KINDS = ["assistance", "intervention", "integration", "panne"] as const;
export type InterventionKind = (typeof INTERVENTION_KINDS)[number];

export const RATE_UNITS = ["horaire", "journalier"] as const;
export type RateUnit = (typeof RATE_UNITS)[number];

const KIND_LABEL: Record<InterventionKind, string> = {
  assistance: "Assistance",
  intervention: "Intervention",
  integration: "Intégration réseau",
  panne: "Panne",
};

export const RATE_METHOD =
  "La moyenne est la moyenne arithmétique des taux déjà enregistrés, arrondie au centime. Les taux horaires et journaliers restent séparés. Le modèle ne l’estime pas.";

export const HOURS_METHOD =
  "Le total additionne les durées déjà enregistrées, en minutes. Une intervention dont la pièce facturée est écrite ne compte pas. Le modèle ne l’estime pas.";

export const RECAP_METHOD =
  "Le récapitulatif liste les interventions confirmées du client. Le total des heures additionne les durées déjà enregistrées. Aucun montant de forfait n’est calculé. Le modèle ne l’estime pas.";

export const DELAY_METHOD =
  "Le délai est la différence, en jours, entre la date de demande et la date d’arrivée déjà enregistrées. La moyenne arrondit la somme de ces délais divisée par le nombre d’interventions. Seules les pannes sur site marquées sous contrat comptent. Le modèle ne l’estime pas.";

export type StoredIntervention = {
  clientName: string;
  projectName: string;
  kind: InterventionKind;
  occurredOn: string;
  durationMinutes: number;
  rateUnit: RateUnit;
  rateCents: number;
  ticket: string;
  billedReference: string;
  onSite: boolean;
  underContract: boolean;
  requestedOn: string;
  arrivedOn: string;
};

export type InterventionPayload = StoredIntervention & {
  clientId: string;
  projectId: string;
};

export type TimeQuestion =
  | { kind: "average_rate"; unit: RateUnit | "both"; types: InterventionKind[]; period: "quarter" | "unsupported" | "missing" }
  | { kind: "unbilled"; types: InterventionKind[]; period: "month" | "unsupported" | "missing" }
  | { kind: "recap" }
  | { kind: "delay"; period: "three_months" | "unsupported" | "missing" };

export type InterventionEntry =
  | { ready: false; missing: string }
  | { ready: true; draft: Omit<InterventionPayload, "clientId" | "clientName" | "projectId" | "projectName"> };

export function kindLabel(kind: InterventionKind): string {
  return KIND_LABEL[kind];
}

export function formatMinutes(total: number): string {
  const minutes = Math.max(0, Math.trunc(total));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${String(rest).padStart(2, "0")}`;
}

export function quarterWindow(now: Date): { from: string; to: string; label: string } {
  const year = now.getUTCFullYear();
  const quarter = Math.floor(now.getUTCMonth() / 3);
  return {
    from: isoDay(year, quarter * 3, 1),
    to: isoDay(year, quarter * 3 + 3, 1),
    label: `T${quarter + 1} ${year}`,
  };
}

export function monthWindow(now: Date): { from: string; to: string; label: string } {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: isoDay(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    label: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(from),
  };
}

export function threeMonthWindow(now: Date): { from: string; to: string; label: string } {
  const from = isoDay(now.getUTCFullYear(), now.getUTCMonth() - 2, 1);
  const to = isoDay(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return { from, to, label: `${from} → ${to}` };
}

export function delayDays(requestedOn: string, arrivedOn: string): number | null {
  if (!isIsoDate(requestedOn) || !isIsoDate(arrivedOn) || arrivedOn < requestedOn) return null;
  const start = Date.parse(`${requestedOn}T00:00:00Z`);
  const end = Date.parse(`${arrivedOn}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function readTimeQuestion(text: string): TimeQuestion | null {
  const folded = fold(text);
  if (/\bdelai\b/.test(folded) && /\binterventions?\b/.test(folded) && /\b(pannes?|sur site)\b/.test(folded)) {
    return { kind: "delay", period: delayPeriod(folded) };
  }
  if (/\b(pas encore factur|non factur|sans factur)\w*/.test(folded) && /\b(heures?|assistances?|interventions?)\b/.test(folded)) {
    const named = kindsNamed(folded).filter((kind) => kind === "assistance" || kind === "intervention");
    return { kind: "unbilled", types: named.length > 0 ? named : ["assistance", "intervention"], period: monthPeriod(folded) };
  }
  if (/\b(recapitulatif|forfait|recharger)\b/.test(folded) && /\b(tickets?|heures?)\b/.test(folded)) {
    return { kind: "recap" };
  }
  if (/\btaux\b/.test(folded) && /\b(moyen|moyenne|facture)\b/.test(folded)) {
    return {
      kind: "average_rate",
      unit: rateUnitNamed(folded),
      types: kindsNamed(folded),
      period: quarterPeriod(folded),
    };
  }
  return null;
}

export function readInterventionEntry(text: string): InterventionEntry | null {
  const folded = fold(text);
  if (readTimeQuestion(text)) return null;
  if (!/\b(enregistre|enregistrer|proposer|proposez|propose|ajoute|ajouter|creer|saisir|saisis)\b/.test(folded)) return null;
  if (!/\b(interventions?|assistances?|integrations?|pannes?|tickets?)\b/.test(folded)) return null;
  if (/\$|\busd\b/i.test(text)) {
    return { ready: false, missing: "Montant en dollars. L’intervention en euro n’est pas proposée." };
  }
  const kinds = kindsNamed(folded);
  if (kinds.length !== 1) {
    return {
      ready: false,
      missing:
        kinds.length > 1
          ? "Un seul type : assistance, intervention, intégration ou panne."
          : "Indiquez le type : assistance, intervention, intégration ou panne.",
    };
  }
  const occurredOn = occurredDate(text);
  if (!occurredOn) return { ready: false, missing: "Indiquez la date, par exemple le 2026-09-15." };
  const requestedOn = dateAfter(text, /\bdemand[ée]e?(?:\s+le)?\s+/i);
  const arrivedOn = dateAfter(text, /\barriv[ée]e?(?:\s+le)?\s+/i);
  if ((requestedOn && !arrivedOn) || (!requestedOn && arrivedOn)) {
    return { ready: false, missing: "Indiquez la date de demande et la date d’arrivée." };
  }
  if (requestedOn && arrivedOn && arrivedOn < requestedOn) {
    return { ready: false, missing: "L’arrivée est avant la demande. L’intervention n’est pas proposée." };
  }
  const durationMinutes = readDuration(folded);
  if (durationMinutes === null) return { ready: false, missing: "Indiquez la durée en heures, par exemple 2 heures." };
  const units = unitsNamed(folded);
  if (units.length !== 1) {
    return {
      ready: false,
      missing:
        units.length > 1
          ? "Un seul taux : horaire ou journalier."
          : "Indiquez si le taux est horaire ou journalier.",
    };
  }
  const rateCents = rateAmount(text);
  if (rateCents === null) return { ready: false, missing: "Indiquez le montant du taux." };
  const kind = kinds[0];
  const rateUnit = units[0];
  if (!kind || !rateUnit) return { ready: false, missing: "Indiquez le type : assistance, intervention, intégration ou panne." };
  return {
    ready: true,
    draft: {
      kind,
      occurredOn,
      durationMinutes,
      rateUnit,
      rateCents,
      ticket: readToken(text, /\btickets?\s+([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)/i),
      billedReference: readToken(text, /\bfactur[ée]e?\s+(?:sur\s+)?([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)/i),
      onSite: /\bsur site\b/.test(folded),
      underContract: /\bsous contrat\b/.test(folded),
      requestedOn,
      arrivedOn,
    },
  };
}

export function interventionPayload(value: unknown): InterventionPayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<InterventionPayload>;
  if (!textId(raw.clientId) || !textId(raw.projectId)) return null;
  if (!named(raw.clientName) || !named(raw.projectName)) return null;
  if (!isKind(raw.kind) || !isUnit(raw.rateUnit)) return null;
  if (!isIsoDate(raw.occurredOn)) return null;
  if (!whole(raw.durationMinutes) || raw.durationMinutes < 1 || raw.durationMinutes > 99_999) return null;
  if (!whole(raw.rateCents) || raw.rateCents < 0) return null;
  if (!optionalText(raw.ticket) || !optionalText(raw.billedReference)) return null;
  if (typeof raw.onSite !== "boolean" || typeof raw.underContract !== "boolean") return null;
  if (!optionalDate(raw.requestedOn) || !optionalDate(raw.arrivedOn)) return null;
  if (raw.requestedOn && raw.arrivedOn && raw.arrivedOn < raw.requestedOn) return null;
  return {
    clientId: raw.clientId,
    clientName: raw.clientName.trim(),
    projectId: raw.projectId,
    projectName: raw.projectName.trim(),
    kind: raw.kind,
    occurredOn: raw.occurredOn,
    durationMinutes: raw.durationMinutes,
    rateUnit: raw.rateUnit,
    rateCents: raw.rateCents,
    ticket: raw.ticket.trim(),
    billedReference: raw.billedReference.trim(),
    onSite: raw.onSite,
    underContract: raw.underContract,
    requestedOn: raw.requestedOn,
    arrivedOn: raw.arrivedOn,
  };
}

export function averageRatePacket(input: {
  rows: StoredIntervention[];
  types: InterventionKind[];
  unit: RateUnit | "both";
  from: string;
  to: string;
  label: string;
  pending: number;
}): AnswerPacket {
  if (input.types.length === 0) {
    return gap("Taux moyen", "Indiquez le type : assistance, intervention, intégration ou panne.");
  }
  const units: RateUnit[] = input.unit === "both" ? ["horaire", "journalier"] : [input.unit];
  const kept = inWindow(input.rows, input.from, input.to).filter(
    (row) => input.types.includes(row.kind) && (input.unit === "both" || row.rateUnit === input.unit),
  );
  const measures = units.flatMap((unit) => {
    const rates = kept.filter((row) => row.rateUnit === unit).map((row) => row.rateCents);
    if (rates.length === 0) return [{ label: unitLabel(unit), value: "aucun" }];
    return [
      { label: unitLabel(unit), value: formatCents(average(rates)) },
      { label: `Interventions ${unit}`, value: String(rates.length) },
    ];
  });
  return {
    title: "Taux moyen",
    period: `${input.label} · ${input.from} → ${input.to}`,
    filters: input.types.map(kindLabel),
    measures,
    rows: kept.map(rateRow),
    sources: ["Interventions confirmées"],
    missing: pendingLine(input.pending),
    method: RATE_METHOD,
  };
}

export function unbilledHoursPacket(input: {
  rows: StoredIntervention[];
  types: InterventionKind[];
  from: string;
  to: string;
  label: string;
  pending: number;
}): AnswerPacket {
  const kept = inWindow(input.rows, input.from, input.to).filter(
    (row) => input.types.includes(row.kind) && row.billedReference === "",
  );
  const minutes = kept.reduce((sum, row) => sum + row.durationMinutes, 0);
  return {
    title: "Heures non facturées",
    period: `${input.label} · ${input.from} → ${input.to}`,
    filters: input.types.map(kindLabel),
    measures: [
      { label: "Heures", value: kept.length === 0 ? "aucune" : formatMinutes(minutes) },
      { label: "Interventions", value: String(kept.length) },
    ],
    rows: kept.map(durationRow),
    sources: ["Interventions confirmées"],
    missing: [kept.length === 0 ? "Aucune intervention confirmée de ce type n’est sans pièce facturée." : "", ...pendingLine(input.pending)].filter(Boolean),
    method: HOURS_METHOD,
  };
}

export function recapPacket(input: { rows: StoredIntervention[]; clientName: string; pending: number }): AnswerPacket {
  const minutes = input.rows.reduce((sum, row) => sum + row.durationMinutes, 0);
  const tickets = input.rows.filter((row) => row.ticket !== "");
  return {
    title: "Tickets et heures",
    period: "",
    filters: [input.clientName],
    measures: [
      { label: "Tickets", value: String(tickets.length) },
      { label: "Heures", value: input.rows.length === 0 ? "aucune" : formatMinutes(minutes) },
    ],
    rows: input.rows.map(durationRow),
    sources: ["Interventions confirmées"],
    missing: [input.rows.length === 0 ? "Aucune intervention confirmée pour ce client." : "", ...pendingLine(input.pending)].filter(Boolean),
    method: RECAP_METHOD,
  };
}

export function delayPacket(input: {
  rows: StoredIntervention[];
  from: string;
  to: string;
  label: string;
  pending: number;
}): AnswerPacket {
  const windowed = inWindow(input.rows, input.from, input.to).filter((row) => row.kind === "panne" && row.onSite && row.underContract);
  const dated = windowed.flatMap((row) => {
    const days = delayDays(row.requestedOn, row.arrivedOn);
    return days === null ? [] : [{ row, days }];
  });
  const undated = windowed.length - dated.length;
  const averageDays = dated.length === 0 ? null : average(dated.map((item) => item.days));
  return {
    title: "Délai moyen d’intervention",
    period: input.label,
    filters: ["Panne", "sur site", "sous contrat"],
    measures: [
      { label: "Délai", value: averageDays === null ? "aucun" : `${averageDays} jours` },
      { label: "Interventions", value: String(dated.length) },
    ],
    rows: dated.map((item) => ({
      label: `${item.row.clientName} · ${item.row.occurredOn}`,
      detail: `demande ${item.row.requestedOn}, arrivée ${item.row.arrivedOn}, ${item.days} jours`,
    })),
    sources: ["Interventions confirmées"],
    missing: [
      dated.length === 0 ? "Aucune panne sur site sous contrat n’a de dates de demande et d’arrivée." : "",
      undated > 0 ? `${undated} panne(s) sans les deux dates ne sont pas comptées.` : "",
      ...pendingLine(input.pending),
    ].filter(Boolean),
    method: DELAY_METHOD,
  };
}

export function timeGapPacket(title: string, missing: string): AnswerPacket {
  return gap(title, missing);
}

export function interventionProposalPacket(draft: Omit<InterventionPayload, "clientId" | "projectId">): AnswerPacket {
  return {
    title: "Intervention à confirmer",
    period: draft.occurredOn,
    filters: [draft.clientName, draft.projectName, kindLabel(draft.kind)],
    measures: [
      { label: "Durée", value: formatMinutes(draft.durationMinutes) },
      { label: draft.rateUnit === "horaire" ? "Taux horaire" : "Taux journalier", value: formatCents(draft.rateCents) },
    ],
    rows: interventionDetails(draft),
    sources: ["Phrase"],
    missing: ["Rien n’est enregistré avant confirmation."],
    method: "La durée et le taux sont ceux écrits dans la phrase. Le modèle ne les propose pas.",
  };
}

export function interventionFields(draft: Omit<InterventionPayload, "clientId" | "projectId">): Array<{ label: string; value: string }> {
  return [
    { label: "Client", value: draft.clientName },
    { label: "Dossier", value: draft.projectName },
    { label: "Type", value: kindLabel(draft.kind) },
    { label: "Date", value: draft.occurredOn },
    { label: "Durée", value: formatMinutes(draft.durationMinutes) },
    { label: "Taux", value: `${formatCents(draft.rateCents)} ${draft.rateUnit}` },
    ...interventionDetails(draft).map((row) => ({ label: row.label, value: row.detail })),
  ];
}

function interventionDetails(draft: Pick<StoredIntervention, "ticket" | "billedReference" | "onSite" | "underContract" | "requestedOn" | "arrivedOn">) {
  const rows: Array<{ label: string; detail: string }> = [];
  if (draft.ticket) rows.push({ label: "Ticket", detail: draft.ticket });
  rows.push({ label: "Facturation", detail: draft.billedReference || "pas facturée" });
  if (draft.onSite) rows.push({ label: "Lieu", detail: "sur site" });
  if (draft.underContract) rows.push({ label: "Contrat", detail: "sous contrat" });
  if (draft.requestedOn && draft.arrivedOn) {
    rows.push({ label: "Demande", detail: draft.requestedOn });
    rows.push({ label: "Arrivée", detail: draft.arrivedOn });
  }
  return rows;
}

function gap(title: string, missing: string): AnswerPacket {
  return {
    title,
    period: "",
    filters: [],
    measures: [],
    rows: [],
    sources: [],
    missing: [missing],
    method: "Rien n’est calculé tant qu’il manque cet élément.",
  };
}

function inWindow(rows: StoredIntervention[], from: string, to: string): StoredIntervention[] {
  return rows
    .filter((row) => row.occurredOn >= from && row.occurredOn < to)
    .sort((left, right) => left.occurredOn.localeCompare(right.occurredOn));
}

function average(values: number[]): number {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function rateRow(row: StoredIntervention): { label: string; detail: string } {
  return {
    label: `${row.clientName} · ${row.occurredOn}`,
    detail: `${kindLabel(row.kind)}, ${formatCents(row.rateCents)} ${row.rateUnit}`,
  };
}

function durationRow(row: StoredIntervention): { label: string; detail: string } {
  return {
    label: `${row.occurredOn} · ${kindLabel(row.kind)}`,
    detail: [formatMinutes(row.durationMinutes), row.ticket ? `ticket ${row.ticket}` : "sans ticket", row.billedReference ? `facturée ${row.billedReference}` : "pas facturée"].join(", "),
  };
}

function pendingLine(pending: number): string[] {
  if (pending <= 0) return [];
  return [pending === 1 ? "1 intervention en attente de confirmation n’est pas comptée." : `${pending} interventions en attente de confirmation ne sont pas comptées.`];
}

function unitLabel(unit: RateUnit): string {
  return unit === "horaire" ? "Horaire" : "Journalier";
}

function kindsNamed(folded: string): InterventionKind[] {
  const found: InterventionKind[] = [];
  if (/\bpannes?\b/.test(folded)) found.push("panne");
  if (/\bintegrations?\b|\breseaux?\b/.test(folded)) found.push("integration");
  if (/\bassistances?\b/.test(folded)) found.push("assistance");
  if (/\binterventions?\b/.test(folded)) found.push("intervention");
  return found;
}

function unitsNamed(folded: string): RateUnit[] {
  const found: RateUnit[] = [];
  if (/\bhoraires?\b|\ba l heure\b/.test(folded)) found.push("horaire");
  if (/\bjournaliers?\b|\bpar jour\b/.test(folded)) found.push("journalier");
  return found;
}

function rateUnitNamed(folded: string): RateUnit | "both" {
  const units = unitsNamed(folded);
  if (units.length === 1) return units[0] ?? "both";
  return "both";
}

function quarterPeriod(folded: string): "quarter" | "unsupported" | "missing" {
  if (/\bce trimestre\b/.test(folded)) return "quarter";
  if (/\b(trimestre|mois|annee)\b/.test(folded)) return "unsupported";
  return "missing";
}

function monthPeriod(folded: string): "month" | "unsupported" | "missing" {
  if (/\b(ce mois|du mois|ce mois-ci)\b/.test(folded)) return "month";
  if (/\b(mois|annee|trimestre)\b/.test(folded)) return "unsupported";
  return "missing";
}

function delayPeriod(folded: string): "three_months" | "unsupported" | "missing" {
  if (/\btrois mois\b/.test(folded)) return "three_months";
  if (/\b(mois|annee|trimestre)\b/.test(folded)) return "unsupported";
  return "missing";
}

function occurredDate(text: string): string {
  const reserved = new Set<number>();
  for (const pattern of [/\bdemand[ée]e?(?:\s+le)?\s+/i, /\barriv[ée]e?(?:\s+le)?\s+/i]) {
    const labeled = dateAt(text, pattern);
    if (labeled) reserved.add(labeled.at);
  }
  return allDates(text).find((item) => !reserved.has(item.at))?.iso ?? "";
}

function dateAfter(text: string, pattern: RegExp): string {
  return dateAt(text, pattern)?.iso ?? "";
}

function dateAt(text: string, pattern: RegExp): { at: number; iso: string } | null {
  const match = pattern.exec(text);
  if (!match) return null;
  const from = (match.index ?? 0) + match[0].length;
  const found = allDates(text.slice(from, from + 24))[0];
  if (!found) return null;
  return { at: from + found.at, iso: found.iso };
}

function allDates(text: string): Array<{ at: number; iso: string }> {
  const found: Array<{ at: number; iso: string }> = [];
  for (const match of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const iso = validIso(match[1] ?? "", match[2] ?? "", match[3] ?? "");
    if (iso) found.push({ at: match.index ?? 0, iso });
  }
  for (const match of text.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) {
    const iso = validIso(match[3] ?? "", match[2] ?? "", match[1] ?? "");
    if (iso) found.push({ at: match.index ?? 0, iso });
  }
  return found.sort((left, right) => left.at - right.at);
}

function readDuration(folded: string): number | null {
  const hours = folded.match(/\b(\d{1,3})\s*(?:heures?|h)\b/);
  if (!hours) return null;
  const hourCount = Number(hours[1]);
  const minuteMatch = folded.match(/\b(\d{1,2})\s*(?:minutes?|min)\b/);
  const minuteCount = minuteMatch ? Number(minuteMatch[1]) : 0;
  if (!Number.isInteger(hourCount) || !Number.isInteger(minuteCount) || minuteCount > 59) return null;
  const total = hourCount * 60 + minuteCount;
  if (total < 1 || total > 99_999) return null;
  return total;
}

function readToken(text: string, pattern: RegExp): string {
  return text.match(pattern)?.[1] ?? "";
}

function rateAmount(text: string): number | null {
  const cleaned = moneyText(text)
    .replace(/\btickets?\s+[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/gi, " ")
    .replace(/\bfactur[ée]e?\s+(?:sur\s+)?[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/gi, " ");
  const marked = cleaned.match(/(\d{1,3}(?:[ .\u00a0]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|eur)\b/i);
  return centsFromWritten(marked?.[0] ?? cleaned);
}

function moneyText(text: string): string {
  return text
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}[/.]\d{1,2}[/.]\d{4}\b/g, " ")
    .replace(/\b\d{1,3}\s*(?:heures?|h|minutes?|min)\b/gi, " ");
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

function isoDay(year: number, monthIndex: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && validIso(value.slice(0, 4), value.slice(5, 7), value.slice(8, 10)) === value;
}

function optionalDate(value: unknown): value is string {
  return value === "" || isIsoDate(value);
}

function isKind(value: unknown): value is InterventionKind {
  return typeof value === "string" && INTERVENTION_KINDS.includes(value as InterventionKind);
}

function isUnit(value: unknown): value is RateUnit {
  return typeof value === "string" && RATE_UNITS.includes(value as RateUnit);
}

function textId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function named(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 2;
}

function optionalText(value: unknown): value is string {
  return typeof value === "string";
}

function whole(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function fold(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
