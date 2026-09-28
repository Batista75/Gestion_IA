import { addUtcDays } from "./contracts.ts";

export const HEADER_METHOD =
  "Les montants, la devise, les taxes et les dates sont recopiés tels qu’ils sont écrits. Les lignes ne sont pas additionnées. Aucune devise n’est convertie. Aucune pénalité n’est calculée. Les coordonnées de compte ne sont pas reprises.";

export const VALIDITY_METHOD =
  "La fin de validité est la date écrite plus la durée écrite, en jours UTC.";

export type PieceHeader = {
  currency: string;
  reference: string;
  issuedOn: string;
  validity: string;
  totalHt: string;
  netHt: string;
  taxes: string[];
  totalDue: string;
  deposit: string;
  dueOn: string;
  paymentDelay: string;
  monthlyHt: string;
  annualHt: string;
  engagement: string;
  period: string;
  balances: string[];
  quoteReference: string;
  supplierName: string;
  clientName: string;
  manufacturer: string;
  productReference: string;
  method: string;
};

const EMPTY: PieceHeader = {
  currency: "",
  reference: "",
  issuedOn: "",
  validity: "",
  totalHt: "",
  netHt: "",
  taxes: [],
  totalDue: "",
  deposit: "",
  dueOn: "",
  paymentDelay: "",
  monthlyHt: "",
  annualHt: "",
  engagement: "",
  period: "",
  balances: [],
  quoteReference: "",
  supplierName: "",
  clientName: "",
  manufacturer: "",
  productReference: "",
  method: HEADER_METHOD,
};

const FR_MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
  décembre: 12,
};

const EN_MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const AMOUNT =
  /(?<![\d,.])(?:£|\$|€)?\s*(?:\d{1,3}(?:[ \u00a0]\d{3})+|\d{1,3}(?:,\d{3})+|\d+)(?:[,.]\d{2})(?!\d)\s*(?:€|eur\b|usd\b|gbp\b|chf\b|cad\b|£|\$)?/gi;

export function statedCurrency(text: string): string {
  const labeled = text.match(/(?:currency|devise|währung)\s*:\s*(EUR|USD|GBP|CHF|CAD)\b/i);
  if (labeled?.[1]) return labeled[1].toUpperCase();
  if (/\bCAD\b|dollar canadien/i.test(text)) return "CAD";
  if (/\bCHF\b|franc suisse/i.test(text)) return "CHF";
  if (/\bGBP\b|£/.test(text)) return "GBP";
  if (/\bUSD\b/.test(text) && !/€|\bEUR\b/.test(text)) return "USD";
  if (/€|\bEUR\b/.test(text)) return "EUR";
  if (/\$/.test(text)) return "USD";
  return "";
}

export function readPieceHeader(text: string): PieceHeader {
  if (!text.trim()) return { ...EMPTY, taxes: [], balances: [] };
  const source = text.replace(/-(\n\s*)(\d)/g, "-$2");
  const lines = source.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const parties = partyColumns(lines);
  const issued = issuedOn(source);
  const duration = text.match(/validit[ée]\s*:\s*(\d+)\s*jours/i);
  const absolute = absoluteValidity(source);
  const start = parseWrittenDate(issued);
  const computed = !absolute && duration && start ? addUtcDays(start, Number(duration[1])) : "";
  const taxes = taxLines(lines);
  const notice = taxNotice(source);
  if (notice && !taxes.some((line) => line.includes(notice.slice(0, 24)))) taxes.push(notice);
  return {
    currency: statedCurrency(source),
    reference: referenceOf(source),
    issuedOn: clip(issued),
    validity: absolute || computed || (duration ? `${duration[1]} jours` : ""),
    totalHt: labeledAmount(lines, /(?:montant\s+)?total\s+ht|sous-total(?:\s+ht|\s+net)?|subtotal(?:\s+net)?|zwischentotal/i),
    netHt: labeledAmount(lines, /net\s+commercial\s+ht/i),
    taxes: taxes.map(clip),
    totalDue: labeledAmount(
      lines,
      /total\s+ttc|total\s+[àa]\s+payer|total\s+amount\s+due|total\s+quote\s+value|total\s+payable|gesamt|total\s+soumission|net\s+[àa]\s+payer/i,
    ),
    deposit: depositOf(lines),
    dueOn: clip(source.match(/date d['’][ée]ch[ée]ance\s*:\s*([^(|\n]+)/i)?.[1] ?? ""),
    paymentDelay: clip(source.match(/payable sous\s+(\d+\s*jours)/i)?.[1] ?? ""),
    monthlyHt: labeledAmount(lines, /total\s+mensuel\s+ht/i),
    annualHt: annualAmount(source),
    engagement: clip(source.match(/engagement(?:\s+ferme)?\s*(?::|de)\s*(\d+\s*mois)/i)?.[1] ?? ""),
    period: clip(source.match(/p[ée]riode\s+(?:du\s+)?([^\n]+)/i)?.[1] ?? ""),
    balances: balanceLines(lines),
    quoteReference: clip(source.match(/\bdevis\s*#\s*([A-Z0-9-]+)/i)?.[1] ?? ""),
    supplierName: parties.supplierName,
    clientName: parties.clientName,
    manufacturer: clip(source.match(/fabricant\s*:\s*([^\n]+)/i)?.[1] ?? ""),
    productReference: clip(source.match(/\b(AOM-DK\d{3,5}(?:-[A-Z0-9]+)?)\b/i)?.[1] ?? source.match(/r[ée]f(?:[ée]rence)?\s*:\s*([A-Z0-9-]{3,})/i)?.[1] ?? ""),
    method: computed ? `${HEADER_METHOD} ${VALIDITY_METHOD}` : HEADER_METHOD,
  };
}

export function headerFields(header: PieceHeader): Array<{ label: string; value: string }> {
  const rows: Array<[string, string]> = [
    ["Référence", header.reference],
    ["Devise", header.currency],
    ["Émission", header.issuedOn],
    ["Validité", header.validity],
    ["Total HT", header.totalHt],
    ["Net HT", header.netHt],
    ["Mensuel HT", header.monthlyHt],
    ["Annuel HT", header.annualHt],
    ["Total à payer", header.totalDue],
    ["Acompte écrit", header.deposit],
    ["Échéance", header.dueOn],
    ["Délai écrit", header.paymentDelay],
    ["Engagement", header.engagement],
    ["Période", header.period],
    ["Devis cité", header.quoteReference],
    ["Fabricant", header.manufacturer],
    ["Référence produit", header.productReference],
  ];
  const fields = rows.filter((row) => row[1]).map(([label, value]) => ({ label, value }));
  header.taxes.forEach((value, index) => fields.push({ label: index === 0 ? "Taxe écrite" : `Taxe écrite ${index + 1}`, value }));
  header.balances.forEach((value, index) => fields.push({ label: index === 0 ? "Solde écrit" : `Solde écrit ${index + 1}`, value }));
  return fields;
}

function partyColumns(lines: string[]): { supplierName: string; clientName: string } {
  let supplierName = "";
  let clientName = "";
  for (let index = 0; index < lines.length; index += 1) {
    const cells = columns(lines[index] ?? "");
    const roles = cells.map(partyRole);
    if (roles.includes("supplier") && roles.includes("client")) {
      const next = columns(lines[index + 1] ?? "");
      roles.forEach((role, cell) => {
        const name = next[cell] ?? "";
        if (role === "supplier" && !supplierName && partyNameOk(name)) supplierName = clip(name);
        if (role === "client" && !clientName && partyNameOk(name)) clientName = clip(name);
      });
    } else if (roles.length === 1 && roles[0] && !columns(lines[index] ?? "")[0]?.includes(" ")) {
      const name = lines[index + 1] ?? "";
      if (partyRole(name)) continue;
      if (roles[0] === "supplier" && !supplierName && partyNameOk(name)) supplierName = clip(name);
      if (roles[0] === "client" && !clientName && partyNameOk(name)) clientName = clip(name);
    }
  }
  return { supplierName, clientName };
}

function columns(line: string): string[] {
  return line.split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
}

function partyNameOk(name: string): boolean {
  const value = name.trim();
  if (value.length < 3 || value.length > 80) return false;
  if (/\d[,.]\d{2}/.test(value)) return false;
  if (/^[A-Z0-9-]{2,16}$/.test(value)) return false;
  return /\p{L}/u.test(value);
}

function partyRole(cell: string): "supplier" | "client" | "" {
  const value = cell.toLowerCase();
  if (/destinataire|customer|billed to|kunde|entreprise cliente|\bclient\b/.test(value)) return "client";
  if (/metteur|vendeur|fournisseur|prestataire|provider|vendor|anbieter|organisme/.test(value)) return "supplier";
  return "";
}

function labeledAmount(lines: string[], label: RegExp): string {
  const index = lines.findIndex((line) => {
    if (!label.test(line) || /\b(iban|bic|swift|transit|compte|account)\b/i.test(line)) return false;
    return line.includes(":") || amountSnippets(line).length > 0;
  });
  if (index < 0) return "";
  return withCurrency(lines, index, amountNear(lines, index));
}

function withCurrency(lines: string[], index: number, amount: string): string {
  if (!amount || /€|\$|£|\b(?:eur|usd|gbp|chf|cad)\b/i.test(amount)) return amount;
  for (let step = 1; step <= 2; step += 1) {
    const line = lines[index + step] ?? "";
    if (amountSnippets(line).length > 0) break;
    const token = currencyToken(line);
    if (token) return `${amount} ${token}`;
  }
  return amount;
}

function currencyToken(line: string): string {
  const collapsed = line.replace(/\s+/g, " ").trim();
  if (!collapsed || collapsed.length > 40 || amountSnippets(line).length > 0) return "";
  const tail = collapsed.match(/(?:€|\$|£|CHF|EUR|USD|GBP|CAD)$/i);
  return tail?.[0] ?? "";
}

function amountNear(lines: string[], index: number): string {
  const same = lastAmount(lines[index] ?? "");
  if (same) return same;
  for (let step = 1; step <= 3; step += 1) {
    const line = lines[index + step] ?? "";
    if (!line) continue;
    if (isOtherLabel(line)) break;
    if (amountOnly(line)) {
      const found = lastAmount(line);
      if (found) return found;
    }
  }
  const previous = lines[index - 1] ?? "";
  if (previous && !isOtherLabel(previous) && amountOnly(previous)) return lastAmount(previous);
  return "";
}

function isOtherLabel(line: string): boolean {
  return /\b(tva|vat|mwst|tps|tvq|sales tax|total|sous-total|subtotal|zwischentotal|gesamt)\b/i.test(line);
}

function lastAmount(line: string): string {
  const found = amountSnippets(line);
  return found[found.length - 1] ?? "";
}

function amountOnly(line: string): boolean {
  AMOUNT.lastIndex = 0;
  const stripped = line.replace(AMOUNT, "").replace(/\b(?:chf|eur|usd|gbp|cad)\b|€|\$|£/gi, "").trim();
  AMOUNT.lastIndex = 0;
  return stripped.length === 0;
}

function amountSnippets(line: string): string[] {
  AMOUNT.lastIndex = 0;
  return [...line.matchAll(AMOUNT)].map((match) => match[0].replace(/\s+/g, " ").trim()).filter((value) => !looksLikeAccount(value));
}

function taxLines(lines: string[]): string[] {
  const found: string[] = [];
  lines.forEach((line, index) => {
    if (!/\b(tva|vat|mwst|tps|tvq)\s*\(|\bsales tax\s*\(/i.test(line)) return;
    if (/\b(siret|neq|uid|total\s+ttc|total\s+[àa]\s+payer)\b/i.test(line)) return;
    const amount = amountSnippets(line).length ? "" : amountNear(lines, index);
    const phrase = clean(`${line.replace(/\s{2,}/g, " ")} ${amount}`.trim());
    if (!phrase || found.includes(phrase)) return;
    found.push(clip(phrase));
  });
  return found.slice(0, 4);
}

function taxNotice(text: string): string {
  const line = text
    .split(/\n/)
    .map((item) => item.trim())
    .find((item) => /autoliquidation|reverse charge|exon[ée]r|261-4-4|article 196/i.test(item));
  return line ? clip(line) : "";
}

function depositOf(lines: string[]): string {
  const hits = lines
    .map((line, index) => ({ line, index }))
    .filter((item) => /\bacompte\b|\bdeposit\b/i.test(item.line));
  if (hits.length === 0) return "";
  for (const hit of hits) {
    if (accountLine(hit.line)) continue;
    const percent = hit.line.match(/\d+(?:[.,]\d+)?\s*%/)?.[0]?.replace(/\s+/g, " ") ?? "";
    const amount = amountSnippets(hit.line)[0] || nearbyDepositAmount(lines, hit.index);
    if (amount) return [percent, amount].filter(Boolean).join(" · ").slice(0, 80);
  }
  const first = hits.find((hit) => !accountLine(hit.line)) ?? hits[0];
  return first?.line.match(/\d+(?:[.,]\d+)?\s*%/)?.[0]?.replace(/\s+/g, " ") ?? "";
}

function nearbyDepositAmount(lines: string[], index: number): string {
  for (let step = 1; step <= 3; step += 1) {
    const line = lines[index + step] ?? "";
    if (!line || accountLine(line) || /\bacompte\b|\bdeposit\b/i.test(line)) break;
    const amount = amountSnippets(line)[0];
    if (amount) return amount;
  }
  return "";
}

function accountLine(line: string): boolean {
  return /\b(iban|bic|swift|transit|compte|account)\b/i.test(line);
}

function annualAmount(text: string): string {
  const line = text.split(/\n/).find((item) => /annuel(?:le)?\s+engag[ée]/i.test(item));
  if (!line) return "";
  return amountSnippets(line)[0] ?? "";
}

function balanceLines(lines: string[]): string[] {
  return lines
    .filter((line) => /\bsoldes?\b/i.test(line) && !/\bacompte\b/i.test(line))
    .map((line) => {
      const amount = amountSnippets(line)[0];
      return amount ? clip(`${clean(line.split(/:/)[0] ?? "Solde")} : ${amount}`) : "";
    })
    .filter(Boolean)
    .slice(0, 3);
}

function referenceOf(text: string): string {
  const match = text.match(
    /(?:devis|quotation|quote|offre|soumission|facture|commande|avoir|livraison|contrat|demande|rfq)\s*(?:n[°o.]|no|#)?\s*#?\s*([A-Z]{2,5}-\d{4}-\d{2,5})|#\s*((?:FAC|DEV|CS|US|MAT|AT|CH|MSP|UK|FOR|CA)-\d{4}-\d{2,5})/i,
  );
  return (match?.[1] || match?.[2] || "").toUpperCase();
}

function issuedOn(text: string): string {
  const emission = text.match(/date d['’][ée]mission\s*:\s*([^|\n]+)/i)?.[1];
  if (emission) return clean(emission);
  const dated = text.match(/(?<!valid )\bdate\s*:\s*([^\n]+)/i)?.[1];
  return dated ? clean(dated).split("|")[0]?.trim() ?? "" : "";
}

function absoluteValidity(text: string): string {
  const match = text.match(
    /(?:valable jusqu['’]au|valide jusqu['’]au|g[üu]ltig bis|valid until|active until|valid date)\s*:?\s*([^\n]+)/i,
  );
  if (!match?.[1]) return "";
  return clip(clean(match[1]).split(/[|]/)[0] ?? "");
}

export function parseWrittenDate(value: string): string {
  const numeric = value.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  if (numeric) return iso(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
  const english = value.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),\s*(\d{4})\b/i);
  if (english) return iso(Number(english[3]), EN_MONTHS[english[1]?.toLowerCase() ?? ""] ?? 0, Number(english[2]));
  const french = value.match(/\b(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})\b/i);
  if (french) return iso(Number(french[3]), FR_MONTHS[french[2]?.toLowerCase() ?? ""] ?? 0, Number(french[1]));
  return "";
}

function iso(year: number, month: number, day: number): string {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function looksLikeAccount(value: string): boolean {
  return /\b(iban|bic|swift|transit|compte|account)\b/i.test(value);
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string): string {
  return clean(value).slice(0, 160);
}
