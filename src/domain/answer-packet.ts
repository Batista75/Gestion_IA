export type AnswerMeasure = { label: string; value: string };
export type AnswerRow = { label: string; detail: string };

/** Lecture chiffrée. Les valeurs sont déjà décidées par le domaine. */
export type AnswerPacket = {
  title: string;
  period: string;
  filters: string[];
  measures: AnswerMeasure[];
  rows: AnswerRow[];
  sources: string[];
  missing: string[];
  method: string;
};

export function renderPacket(packet: AnswerPacket): string {
  const lines = [packet.title];
  if (packet.period) lines.push(`Période : ${packet.period}`);
  if (packet.filters.length > 0) lines.push(`Filtres : ${packet.filters.join(", ")}`);
  if (packet.measures.length > 0) {
    lines.push("Mesures :");
    for (const measure of packet.measures) lines.push(`- ${measure.label} : ${measure.value}`);
  }
  if (packet.rows.length > 0) {
    lines.push("Détail :");
    for (const row of packet.rows) lines.push(`- ${row.label} — ${row.detail}`);
  }
  if (packet.sources.length > 0) lines.push(`Sources : ${packet.sources.join(" · ")}`);
  if (packet.missing.length > 0) lines.push(`Manque : ${packet.missing.join(" ")}`);
  if (packet.method) lines.push(`Méthode : ${packet.method}`);
  return lines.join("\n");
}

export function foreignFigures(packet: AnswerPacket, phrase: string): string[] {
  const allowed = new Set(figureKeys(packetCorpus(packet)));
  const extras: string[] = [];
  for (const figure of figuresOf(phrase)) {
    if (allowed.has(figure.key)) continue;
    extras.push(figure.label);
  }
  return extras;
}

export function narrativeFits(packet: AnswerPacket, phrase: string): boolean {
  return foreignFigures(packet, phrase).length === 0;
}

export function readPacket(value: unknown): AnswerPacket | null {
  if (!value || typeof value !== "object" || !("packet" in value)) return null;
  const packet = (value as { packet?: unknown }).packet;
  if (!packet || typeof packet !== "object") return null;
  const row = packet as Partial<AnswerPacket>;
  if (typeof row.title !== "string" || typeof row.method !== "string") return null;
  return {
    title: row.title,
    period: typeof row.period === "string" ? row.period : "",
    filters: stringList(row.filters),
    measures: labeled(row.measures, "value"),
    rows: labeled(row.rows, "detail"),
    sources: stringList(row.sources),
    missing: stringList(row.missing),
    method: row.method,
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function labeled<Key extends "value" | "detail">(
  value: unknown,
  key: Key,
): Array<{ label: string } & Record<Key, string>> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { label?: unknown; value?: unknown; detail?: unknown };
    const extra = row[key];
    if (typeof row.label !== "string" || typeof extra !== "string") return [];
    return [{ label: row.label, [key]: extra } as { label: string } & Record<Key, string>];
  });
}

/** La phrase affichée reprend le paquet. Si un chiffre s’y glisse, elle est remplacée. */
export function safeReply(packet: AnswerPacket): string {
  const reply = renderPacket(packet);
  if (narrativeFits(packet, reply)) return reply;
  return `${packet.title}\nLa phrase a été retenue : elle ajoutait un chiffre absent de la lecture.`;
}

function packetCorpus(packet: AnswerPacket): string {
  return [
    packet.title,
    packet.period,
    packet.method,
    ...packet.filters,
    ...packet.measures.flatMap((measure) => [measure.label, measure.value]),
    ...packet.rows.flatMap((row) => [row.label, row.detail]),
    ...packet.sources,
    ...packet.missing,
  ].join("\n");
}

type Figure = { key: string; label: string };

function figuresOf(text: string): Figure[] {
  const found: Figure[] = [];
  const source = text.replace(/[\u00a0\u202f]/g, " ");
  const money = /(?:(£|\$|€)\s*)?(\d{1,3}(?:[ \u00a0]\d{3})+|\d{1,3}(?:,\d{3})+|\d+)(?:([,.])(\d{2}))?(?!\d)\s*(€|eur|usd|gbp|chf|cad|£|\$)?/gi;
  for (const match of source.matchAll(money)) {
    const pre = match[1] ?? "";
    const post = match[5] ?? "";
    if (!pre && !post) continue;
    const cents = moneyCents(match[2] ?? "", match[3] ?? "", match[4] ?? "");
    if (cents === null) continue;
    const after = source.slice(match.index ?? 0, (match.index ?? 0) + match[0].length + 8);
    const currency = moneyCurrency(`${pre}${post}`, after);
    found.push({ key: `money:${currency}:${cents}`, label: match[0].trim() });
  }
  for (const match of source.matchAll(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),\s*(\d{4})\b/gi)) {
    const month = englishMonth(match[1] ?? "");
    if (!month) continue;
    found.push({ key: `date:${match[3]}-${month}-${(match[2] ?? "").padStart(2, "0")}`, label: match[0] });
  }
  for (const match of source.matchAll(/\b(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})\b/gi)) {
    const month = frenchMonth(match[2] ?? "");
    if (!month) continue;
    found.push({ key: `date:${match[3]}-${month}-${(match[1] ?? "").padStart(2, "0")}`, label: match[0] });
  }
  for (const match of source.matchAll(/(\d{1,3}(?:[,.]\d{1,3})?)\s*%/g)) {
    const raw = (match[1] ?? "").replace(",", ".");
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    found.push({ key: `percent:${value}`, label: match[0].trim() });
  }
  for (const match of source.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    found.push({ key: `date:${match[1]}-${match[2]}-${match[3]}`, label: match[0] });
  }
  for (const match of source.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g)) {
    const year = (match[3] ?? "").length === 2 ? `20${match[3]}` : match[3];
    const month = (match[2] ?? "").padStart(2, "0");
    const day = (match[1] ?? "").padStart(2, "0");
    found.push({ key: `date:${year}-${month}-${day}`, label: match[0] });
  }
  for (const match of source.matchAll(/\b([A-Za-z]{2,}(?:-[A-Za-z0-9]{2,})+)\b/g)) {
    found.push({ key: `ref:${(match[1] ?? "").toUpperCase()}`, label: match[1] ?? "" });
  }
  return found;
}

function figureKeys(text: string): string[] {
  return figuresOf(text).map((figure) => figure.key);
}

function moneyCurrency(token: string, after: string): string {
  if (/\bCAD\b/i.test(after)) return "CAD";
  if (/£|\bgbp\b/i.test(token)) return "GBP";
  if (/\bchf\b/i.test(token)) return "CHF";
  if (/\busd\b|\$/i.test(token)) return "USD";
  return "EUR";
}

function moneyCents(whole: string, separator: string, fraction: string): number | null {
  const major = separator === "." ? whole.replace(/[ ,]/g, "") : whole.replace(/[ .]/g, "");
  if (!/^\d+$/.test(major)) return null;
  const minor = (fraction || "0").padEnd(2, "0").slice(0, 2);
  const cents = Number(major) * 100 + Number(minor);
  return Number.isSafeInteger(cents) ? cents : null;
}

function englishMonth(name: string): string {
  const month = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(name.toLowerCase());
  return month < 0 ? "" : String(month + 1).padStart(2, "0");
}

function frenchMonth(name: string): string {
  const folded = name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const month = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"].indexOf(folded);
  return month < 0 ? "" : String(month + 1).padStart(2, "0");
}

