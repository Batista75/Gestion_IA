import type { AnswerPacket } from "./answer-packet.ts";
import { familyLabel, PRODUCT_FAMILIES, readProductFamily, type ProductFamily } from "./measures.ts";

export const WARRANTY_LEVELS = ["h4", "j1", "standard", "aucune"] as const;
export type WarrantyLevel = (typeof WARRANTY_LEVELS)[number];

const WARRANTY_LABEL: Record<WarrantyLevel, string> = {
  h4: "4 h",
  j1: "J+1",
  standard: "Standard",
  aucune: "Aucune",
};

export const WARRANTY_METHOD =
  "La liste compare la date d’installation déjà enregistrée à l’année civile précédente. Le niveau de garantie est celui enregistré. Le modèle ne l’estime pas.";

export const AGE_METHOD =
  "L’âge est la comparaison de la date d’installation déjà enregistrée à la date d’il y a cinq ans. Un équipement installé ce jour-là n’est pas compté. Le modèle ne l’estime pas.";

const WARRANTY_ASK = "Indiquez la garantie : 4 h, J+1, standard ou aucune.";
const WARRANTY_MANY = "Un seul niveau de garantie : 4 h, J+1, standard ou aucune.";
const FAMILY_ASK = "Indiquez la famille : serveur, poste, portable, réseau, prestation ou autre.";
const FAMILY_MANY = "Une seule famille : serveur, poste, portable, réseau, prestation ou autre.";
const DATE_ASK = "Indiquez la date d’installation, par exemple le 2019-04-01.";
const DESIGNATION_ASK = "Indiquez la désignation ou le produit.";
export const FAMILY_CONFLICT = "La famille écrite et celle du produit diffèrent. Indiquez une seule famille.";
const PERIOD_ASK = "Indiquez la période : l’an dernier.";

export type StoredEquipment = {
  clientName: string;
  designation: string;
  family: ProductFamily;
  installedOn: string;
  warranty: WarrantyLevel;
};

export type EquipmentPayload = StoredEquipment & {
  clientId: string;
  productId: string;
  productName: string;
};

export type EquipmentSketch = {
  designation: string;
  family: ProductFamily | "";
  installedOn: string;
  warranty: WarrantyLevel | "";
  familyConflict: boolean;
  warrantyConflict: boolean;
};

export type EquipmentQuestion =
  | { kind: "warranty"; levels: WarrantyLevel[]; period: "previous_year" | "missing" }
  | { kind: "age"; families: ProductFamily[] };

export function warrantyLabel(level: WarrantyLevel): string {
  return WARRANTY_LABEL[level];
}

export function previousYearWindow(now: Date): { from: string; to: string; label: string } {
  const year = now.getUTCFullYear() - 1;
  return { from: `${year}-01-01`, to: `${year + 1}-01-01`, label: String(year) };
}

export function ageCutoff(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear() - 5, now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
}

export function readEquipmentQuestion(text: string): EquipmentQuestion | null {
  const folded = fold(text);
  if (isEquipmentEntry(folded)) return null;
  if (/\bplus de (?:5|cinq) ans\b/.test(folded) && /\b(?:parc|serveurs?|postes?|portables?)\b/.test(folded)) {
    return { kind: "age", families: familiesNamed(folded) };
  }
  if (/\b(?:garantie|extension)\b/.test(folded) && /\b(?:j\s*\+\s*1|4\s*h|achete\w*|an dernier)\b/.test(folded)) {
    return {
      kind: "warranty",
      levels: levelsNamed(folded),
      period: /\b(?:achete\w*|an dernier)\b/.test(folded) ? "previous_year" : "missing",
    };
  }
  return null;
}

export function readEquipmentEntry(text: string): EquipmentSketch | null {
  const folded = fold(text);
  if (!isEquipmentEntry(folded)) return null;
  const levels = levelsNamed(folded);
  const families = familiesNamed(folded);
  return {
    designation: designationOf(text),
    family: families.length === 1 ? families[0] ?? "" : "",
    installedOn: firstDate(text),
    warranty: levels.length === 1 ? levels[0] ?? "" : "",
    familyConflict: families.length > 1,
    warrantyConflict: levels.length > 1,
  };
}

export function textForProductMatch(text: string, ignoreNames: string[]): string {
  let folded = fold(text);
  const names = [...ignoreNames].sort((left, right) => fold(right).length - fold(left).length);
  for (const name of names) {
    const token = fold(name).trim();
    if (token.length < 3) continue;
    folded = folded.split(token).join(" ");
  }
  return folded.replace(/\b(?:serveurs?|postes?|portables?|reseaux?|prestations?|autre)\b/g, " ");
}

export function applyProduct(
  sketch: EquipmentSketch,
  product: { name: string; family: string } | null,
): { sketch: EquipmentSketch; conflict: string } {
  if (!product) return { sketch, conflict: "" };
  const productFamily = readProductFamily(product.family);
  if (sketch.family && productFamily && sketch.family !== productFamily) {
    return { sketch, conflict: FAMILY_CONFLICT };
  }
  return {
    sketch: {
      ...sketch,
      family: sketch.family || productFamily,
      designation: sketch.designation || product.name.trim(),
    },
    conflict: "",
  };
}

export function equipmentGap(sketch: EquipmentSketch, conflict = ""): string | null {
  if (sketch.warrantyConflict) return WARRANTY_MANY;
  if (!sketch.warranty) return WARRANTY_ASK;
  if (conflict) return conflict;
  if (sketch.familyConflict) return FAMILY_MANY;
  if (!sketch.family) return FAMILY_ASK;
  if (!sketch.installedOn) return DATE_ASK;
  if (sketch.designation.trim().length < 2) return DESIGNATION_ASK;
  return null;
}

export function equipmentPayload(value: unknown): EquipmentPayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<EquipmentPayload>;
  if (!textId(raw.clientId) || !named(raw.clientName) || !named(raw.designation)) return null;
  if (!optionalText(raw.productId) || !optionalText(raw.productName)) return null;
  if (!isFamily(raw.family) || !isWarranty(raw.warranty) || !isIsoDate(raw.installedOn)) return null;
  return {
    clientId: raw.clientId,
    clientName: raw.clientName.trim(),
    productId: raw.productId.trim(),
    productName: raw.productName.trim(),
    designation: raw.designation.trim(),
    family: raw.family,
    installedOn: raw.installedOn,
    warranty: raw.warranty,
  };
}

export function warrantyPacket(input: {
  rows: StoredEquipment[];
  levels: WarrantyLevel[];
  from: string;
  to: string;
  label: string;
  pending: number;
}): AnswerPacket {
  if (input.levels.length === 0) return gap("Garanties souscrites", "Indiquez le niveau : 4 h, J+1, standard ou aucune.");
  const kept = input.rows
    .filter((row) => input.levels.includes(row.warranty) && row.installedOn >= input.from && row.installedOn < input.to)
    .sort(byDate);
  return {
    title: "Garanties souscrites",
    period: `${input.label} · ${input.from} → ${input.to}`,
    filters: input.levels.map(warrantyLabel),
    measures: [{ label: "Équipements", value: String(kept.length) }],
    rows: kept.map(equipmentRow),
    sources: ["Équipements installés confirmés"],
    missing: [kept.length === 0 ? "Aucun équipement confirmé ne correspond." : "", ...pendingLine(input.pending)].filter(Boolean),
    method: WARRANTY_METHOD,
  };
}

export function olderFleetPacket(input: {
  rows: StoredEquipment[];
  families: ProductFamily[];
  cutoff: string;
  pending: number;
}): AnswerPacket {
  if (input.families.length === 0) return gap("Parc de plus de cinq ans", FAMILY_ASK);
  const kept = input.rows.filter((row) => input.families.includes(row.family) && row.installedOn < input.cutoff).sort(byDate);
  return {
    title: "Parc de plus de cinq ans",
    period: `installé avant ${input.cutoff}`,
    filters: input.families.map((family) => familyLabel(family)),
    measures: [{ label: "Équipements", value: String(kept.length) }],
    rows: kept.map(equipmentRow),
    sources: ["Équipements installés confirmés"],
    missing: [kept.length === 0 ? "Aucun équipement confirmé ne correspond." : "", ...pendingLine(input.pending)].filter(Boolean),
    method: AGE_METHOD,
  };
}

export function equipmentGapPacket(missing: string): AnswerPacket {
  return gap("Équipement à confirmer", missing);
}

export function periodGapPacket(): AnswerPacket {
  return gap("Garanties souscrites", PERIOD_ASK);
}

export function equipmentProposalPacket(draft: Omit<EquipmentPayload, "clientId" | "productId">): AnswerPacket {
  const rows = equipmentDetails(draft);
  return {
    title: "Équipement à confirmer",
    period: draft.installedOn,
    filters: [draft.clientName, familyLabel(draft.family), warrantyLabel(draft.warranty)],
    measures: [],
    rows,
    sources: ["Phrase"],
    missing: ["Rien n’est enregistré avant confirmation."],
    method: "La désignation, la date et le niveau de garantie sont ceux écrits dans la phrase. L’âge n’est pas stocké. Le modèle ne les propose pas.",
  };
}

export function equipmentFields(draft: Omit<EquipmentPayload, "clientId" | "productId">): Array<{ label: string; value: string }> {
  return [
    { label: "Client", value: draft.clientName },
    { label: "Désignation", value: draft.designation },
    { label: "Famille", value: familyLabel(draft.family) },
    { label: "Installé le", value: draft.installedOn },
    { label: "Garantie", value: warrantyLabel(draft.warranty) },
    ...(draft.productName ? [{ label: "Produit", value: draft.productName }] : []),
  ];
}

function equipmentDetails(draft: Pick<StoredEquipment, "designation" | "family" | "installedOn" | "warranty"> & { productName?: string }) {
  const rows = [
    { label: "Désignation", detail: draft.designation },
    { label: "Famille", detail: familyLabel(draft.family) },
    { label: "Installé le", detail: draft.installedOn },
    { label: "Garantie", detail: warrantyLabel(draft.warranty) },
  ];
  if (draft.productName) rows.push({ label: "Produit", detail: draft.productName });
  return rows;
}

function equipmentRow(row: StoredEquipment): { label: string; detail: string } {
  return {
    label: `${row.clientName} · ${row.designation}`,
    detail: `${familyLabel(row.family)}, ${row.installedOn}, ${warrantyLabel(row.warranty)}`,
  };
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

function pendingLine(pending: number): string[] {
  if (pending <= 0) return [];
  return [
    pending === 1
      ? "1 équipement en attente de confirmation n’est pas compté."
      : `${pending} équipements en attente de confirmation ne sont pas comptés.`,
  ];
}

function byDate(left: StoredEquipment, right: StoredEquipment): number {
  return left.installedOn.localeCompare(right.installedOn) || left.designation.localeCompare(right.designation);
}

function isEquipmentEntry(folded: string): boolean {
  if (!/\b(?:enregistre|enregistrer|proposer|proposez|propose|ajoute|ajouter|creer|saisir|saisis)\b/.test(folded)) return false;
  if (/\bequipements?\b/.test(folded)) return true;
  if (familiesNamed(folded).length === 0) return false;
  return /\binstalles?\b/.test(folded) || /\bgarantie\b/.test(folded);
}

function familiesNamed(folded: string): ProductFamily[] {
  const found: ProductFamily[] = [];
  if (/\bserveurs?\b/.test(folded)) found.push("serveur");
  if (/\bpostes?\b/.test(folded)) found.push("poste");
  if (/\bportables?\b/.test(folded)) found.push("portable");
  if (/\breseaux?\b/.test(folded)) found.push("reseau");
  if (/\bprestations?\b/.test(folded)) found.push("prestation");
  if (/\bautre\b/.test(folded)) found.push("autre");
  return found;
}

function levelsNamed(folded: string): WarrantyLevel[] {
  const found: WarrantyLevel[] = [];
  if (/\b4\s*h\b/.test(folded)) found.push("h4");
  if (/\bj\s*\+\s*1\b/.test(folded)) found.push("j1");
  if (/\bstandard\b/.test(folded)) found.push("standard");
  if (/\baucune\b/.test(folded) || /\bsans garantie\b/.test(folded)) found.push("aucune");
  return found;
}

function designationOf(text: string): string {
  const match = text.match(/(?:désignation|designation)\s+([^,\n]+)/i);
  return match?.[1]?.trim() ?? "";
}

function firstDate(text: string): string {
  for (const match of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const iso = validIso(match[1] ?? "", match[2] ?? "", match[3] ?? "");
    if (iso) return iso;
  }
  for (const match of text.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) {
    const iso = validIso(match[3] ?? "", match[2] ?? "", match[1] ?? "");
    if (iso) return iso;
  }
  return "";
}

function validIso(yearRaw: string, monthRaw: string, dayRaw: string): string | null {
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && validIso(value.slice(0, 4), value.slice(5, 7), value.slice(8, 10)) === value;
}

function isFamily(value: unknown): value is ProductFamily {
  return typeof value === "string" && PRODUCT_FAMILIES.includes(value as ProductFamily);
}

function isWarranty(value: unknown): value is WarrantyLevel {
  return typeof value === "string" && WARRANTY_LEVELS.includes(value as WarrantyLevel);
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

function fold(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
