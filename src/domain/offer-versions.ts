import { createHash } from "node:crypto";

export type OfferLine = {
  product: string;
  reference: string;
  statedPrice: string;
  conditions: string;
};

/** Montants et mentions recopiés tels qu’ils sont écrits. Jamais additionnés. */
export type WrittenCommercial = {
  clientName: string;
  currency: string;
  statedTotalHt: string;
  statedVat: string;
  statedTotalTtc: string;
  vatMention: string;
  conditions: string;
};

export type OfferVersion = {
  title: string;
  issuedOn: string;
  supplierName: string;
  versionLabel: string;
  fingerprint: string;
  lines: OfferLine[];
} & WrittenCommercial;

export type DocumentKind =
  | "rfq"
  | "devis"
  | "commande"
  | "facture"
  | "tarif"
  | "avoir"
  | "livraison"
  | "contrat"
  | "fiche"
  | "releve"
  | "document"
  | "autre";

/** Rôle relu sur une facture. Ce n’est pas une nature. */
export type DocumentRole = "" | "acompte";

export type DocumentParties = {
  clientName: string;
  supplierName: string;
};

export type DocumentReading = {
  kind: DocumentKind;
  role: DocumentRole;
  heading: string;
  enrichment: string;
  offers: OfferVersion[];
  pricedLines: OfferLine[];
  parties: DocumentParties;
};

const PRICE =
  /(\d{1,6}(?:[ \u00a0]\d{3})*(?:[,.]\d{1,4})?)\s*(?:€|eur)\s*(ht|ttc)?/i;

export function readOfferFile(text: string, filename: string): DocumentReading {
  const parts = splitDocuments(text);
  const readings = (parts.length > 0 ? parts : [text]).map((part) => readSingle(part, filename));
  if (readings.length === 1) return readings[0] ?? readSingle("", filename);
  const primary = readings.find((reading) => reading.kind !== "document" && reading.kind !== "autre") ?? readings[0];
  return {
    kind: primary?.kind ?? "document",
    role: primary?.role ?? "",
    heading: readings[0]?.heading ?? filename,
    offers: readings.flatMap((reading) => reading.offers),
    pricedLines: readings.flatMap((reading) => reading.pricedLines),
    parties: {
      clientName: readings.map((reading) => reading.parties.clientName).find(Boolean) ?? "",
      supplierName: readings.map((reading) => reading.parties.supplierName).find(Boolean) ?? "",
    },
    enrichment: readings.map((reading) => reading.enrichment).join("\n\n"),
  };
}

function readSingle(text: string, filename: string): DocumentReading {
  const parties = partiesOf(text);
  const parsed = [text]
    .map((part) => parseOffer(part, filename))
    .filter((offer): offer is OfferVersion => offer !== null)
    .map((offer) => ({
      ...offer,
      supplierName: offer.supplierName || parties.supplierName,
      clientName: offer.clientName || parties.clientName,
    }));
  const kind = documentKind(text, filename);
  const role = documentRole(kind, text, filename);
  const offers = keepsCommercialVersion(kind) ? parsed : [];
  const pricedLines = parsed.flatMap((offer) => offer.lines);
  const heading = clean(text.split(/\n/).map((line) => line.trim()).find(Boolean) || filename).slice(0, 180);
  return {
    kind,
    role,
    heading,
    offers,
    pricedLines,
    parties,
    enrichment: enrichmentOf(filename, kind, text, offers, pricedLines, parties),
  };
}

export function datasheetProduct(
  text: string,
): { reference: string; name: string; ordering: string } | null {
  const kit = text.match(/AOM-DK\d{3,5}/i)?.[0] ?? "";
  const described = /\b(development kit|fiche technique|datasheet|data sheet)\b/i.test(text);
  const namedSheet = /(?:^|[_-])DS(?:[_-]|\.)/i.test(text);
  if (!kit || (!described && !namedSheet)) return null;
  const ordering = text.match(/AOM-DK\d{3,5}-[A-Z0-9]+/i)?.[0] ?? "";
  const reference = kit;
  return {
    reference,
    name: `Kit de développement ${reference}`,
    ordering,
  };
}

export function keepsCommercialVersion(kind: DocumentKind): boolean {
  return kind === "devis" || kind === "tarif";
}

/** Tables que la confirmation d’une pièce a le droit d’écrire. Jamais une pièce de vente du dossier. */
export function documentWriteTargets(kind: DocumentKind): Array<
  "fichier" | "client" | "supplier" | "product" | "quote" | "demand"
> {
  switch (kind) {
    case "autre":
    case "releve":
      return ["fichier"];
    case "rfq":
      return ["fichier", "client", "supplier", "demand"];
    case "devis":
    case "tarif":
      return ["fichier", "client", "supplier", "product", "quote", "demand"];
    default:
      return ["fichier", "client", "supplier", "product"];
  }
}

export function kindLabel(kind: string): string {
  switch (kind) {
    case "rfq":
      return "Demande de chiffrage";
    case "devis":
      return "Devis";
    case "commande":
      return "Commande";
    case "facture":
      return "Facture";
    case "tarif":
      return "Tarif";
    case "avoir":
      return "Avoir";
    case "livraison":
      return "Bon de livraison";
    case "contrat":
      return "Contrat";
    case "fiche":
      return "Documentation technique";
    case "releve":
      return "Relevé bancaire";
    case "document":
      return "Document";
    default:
      return "Autre";
  }
}

export function splitDocuments(text: string): string[] {
  const parts = text
    .split(
      /\n(?=\s*(?:facture|invoice|avoir|bon de livraison|bon de commande|purchase order|commande|rfq|demande[\s-]+de[\s-]+prix|devis|quotation|price offer|tarif)\b)/i,
    )
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
}

function parseOffer(text: string, filename: string): OfferVersion | null {
  const lines = parseLines(text);
  if (lines.length === 0) return null;
  if (!/\b(devis|offre|quotation|tarif|prix)\b/i.test(text) && lines.length < 1) return null;
  const header = headerOf(text, filename);
  const fingerprint = createHash("sha256")
    .update(
      [
        header.versionLabel,
        header.supplierName,
        ...lines.map((line) =>
          [line.product, line.reference, line.statedPrice, line.conditions].join("|"),
        ),
      ].join("\n"),
    )
    .digest("hex");
  return { ...header, ...writtenCommercial(text), fingerprint, lines };
}

function parseLines(text: string): OfferLine[] {
  const structured = parseStructuredRows(text);
  if (structured.length > 0) return structured;
  const lines: OfferLine[] = [];
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line || !PRICE.test(line)) continue;
    if (/^(?:total|sous-total|tva|vat|montant|net [àa] payer|prix hors taxes)\b/i.test(line)) continue;
    const parsed = parseOfferLine(line);
    if (parsed) lines.push(parsed);
  }
  return lines;
}

const EUROPEAN_AMOUNT = /\d{1,3}(?:\.\d{3})*,\d{2}/;
const GROUPED_AMOUNT = /\d{1,3}(?: \d{3})+\.\d{2}/;
const POSITION_ROW =
  /^(\d+)\s+(\d+)\s+pcs\s+([A-Z]{1,8}-[A-Z0-9]+)\s+(.+?)\s+EUR\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i;
const BUNDLE_ROW =
  /^(.+?[A-Za-z].*?)\s+(\d{1,4})\s+(\d{1,3}(?: \d{3})+\.\d{2})\s+(\d{1,3}(?: \d{3})+\.\d{2})\s*$/;

type DraftRow = {
  product: string;
  reference: string;
  unit: string;
  total: string;
  quantity: string;
  family: string;
  notes: string[];
  components: string[];
};

function parseStructuredRows(text: string): OfferLine[] {
  const fromLayout = layoutRows(text);
  if (fromLayout.length > 0) return fromLayout;
  return markdownRows(text);
}

function layoutRows(text: string): OfferLine[] {
  const drafts: DraftRow[] = [];
  let current: DraftRow | null = null;
  let family = "";
  const flush = () => {
    if (current) drafts.push(current);
    current = null;
  };
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const position = line.match(POSITION_ROW);
    if (position) {
      flush();
      current = {
        product: clean(position[4] ?? ""),
        reference: position[3] ?? "",
        unit: position[5] ?? "",
        total: position[6] ?? "",
        quantity: `${position[2] ?? ""} pcs`.trim(),
        family,
        notes: [],
        components: [],
      };
      continue;
    }
    const bundle = line.match(BUNDLE_ROW);
    if (bundle && !/^(total|vat|tva|prix)\b/i.test(bundle[1] ?? "")) {
      flush();
      current = {
        product: clean(bundle[1] ?? ""),
        reference: "",
        unit: bundle[3] ?? "",
        total: bundle[4] ?? "",
        quantity: bundle[2] ?? "",
        family,
        notes: [],
        components: [],
      };
      continue;
    }
    const section = line.match(/^(MIPS\d+|ARMv\d+)\s*$/i);
    if (section) {
      family = section[1] ?? family;
      continue;
    }
    if (!current || isNoise(line)) continue;
    const component = line.match(/^(.+?[A-Za-z].{2,}?)\s+(\d{1,4})\s*$/);
    if (component) {
      const name = clean(component[1] ?? "");
      if (name.length >= 3) current.components.push(name);
      continue;
    }
    if (current.notes.length < 4) current.notes.push(clean(line));
  }
  flush();
  return drafts.map(draftToLine).filter((line): line is OfferLine => line !== null);
}

function markdownRows(text: string): OfferLine[] {
  if (!text.includes("|")) return [];
  const lines: OfferLine[] = [];
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line.startsWith("|") || /^\|\s*:?-{3,}/.test(line)) continue;
    const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
    const amounts = cells.flatMap((cell) =>
      [...cell.matchAll(new RegExp(`${EUROPEAN_AMOUNT.source}|${GROUPED_AMOUNT.source}`, "g"))].map(
        (match) => match[0],
      ),
    );
    if (amounts.length === 0) continue;
    const reference = cells.join(" ").match(/\b([A-Z]{1,8}-[A-Z0-9]+)\b/)?.[1] ?? "";
    const productCell = cells
      .map((cell) => cell.replace(/\b(Description|Quantity|Price for you|Sum)\b\s*-?\s*/gi, ""))
      .map((cell) => cell.replace(EUROPEAN_AMOUNT, "").replace(GROUPED_AMOUNT, "").trim())
      .filter((cell) => cell.length >= 3 && !/^(EUR|USD|pcs)$/i.test(cell))
      .sort((left, right) => right.length - left.length)[0];
    const product = clean(productCell ?? "").replace(reference, "").trim();
    const draft: DraftRow = {
      product,
      reference,
      unit: amounts[0] ?? "",
      total: amounts[1] ?? "",
      quantity: "",
      family: "",
      notes: [],
      components: [],
    };
    const parsed = draftToLine(draft);
    if (parsed) lines.push(parsed);
  }
  return lines;
}

function draftToLine(draft: DraftRow): OfferLine | null {
  const product = draft.product.replace(/\s+/g, " ").trim();
  if (product.length < 2 || /^(total|prix hors taxes|vat|tva)\b/i.test(product)) return null;
  const model = [...draft.components, ...draft.notes].join(" ").match(/\b((?:SSG|SYS)-[A-Z0-9-]+)\b/i)?.[1] ?? "";
  const reference = draft.reference || model;
  const conditions = [
    draft.quantity ? `quantité ${draft.quantity}` : "",
    draft.total ? `total indiqué ${draft.total} EUR` : "",
    draft.family ? `famille ${draft.family}` : "",
    draft.components.length > 0
      ? `postes : ${draft.components.slice(0, 6).join(" ; ")}`
      : "",
    draft.notes.join(" "),
  ]
    .filter(Boolean)
    .join(", ")
    .slice(0, 500);
  return {
    product: product.slice(0, 120),
    reference: reference.slice(0, 60),
    statedPrice: `${draft.unit} EUR`,
    conditions,
  };
}

function isNoise(line: string): boolean {
  return (
    /^(page\b|tel\.?|fax\b|ref\.:|pos\.|description\b|prix\b)/i.test(line) ||
    /\b(siret|iban|www\.|societe generale|code naf|gérant)\b/i.test(line) ||
    /\blauterbach sarl\b/i.test(line) ||
    line === "."
  );
}

function parseOfferLine(line: string): OfferLine | null {
  const statedPrice = pricePhrase(line);
  if (!statedPrice) return null;
  const parts = line.split(/\s*[|;]\s*/).map((part) => part.trim()).filter(Boolean);
  let product = "";
  let reference = "";
  const conditions: string[] = [];
  const chunks = parts.length > 1 ? parts : [line.replace(PRICE, " ")];
  for (const part of chunks) {
    if (PRICE.test(part)) continue;
    const refOnly = part.match(/^(?:r[ée]f(?:[ée]rence)?\.?\s*)([A-Z0-9][A-Z0-9-]{1,24})$/i);
    if (refOnly) {
      reference = refOnly[1] ?? reference;
      continue;
    }
    if (!product) {
      const embedded = part.match(/^(.*?\p{L}.*?)\s+([A-Z]{1,8}-?\d[\w-]{0,16})$/u);
      if (embedded?.[1] && embedded[2]) {
        product = clean(embedded[1]);
        reference = embedded[2];
      } else {
        product = clean(part);
      }
      continue;
    }
    conditions.push(part);
  }
  if (product.length < 2) return null;
  return {
    product,
    reference,
    statedPrice,
    conditions: conditions.join(", "),
  };
}

function headerOf(
  text: string,
  filename: string,
): Pick<OfferVersion, "title" | "issuedOn" | "supplierName" | "versionLabel"> {
  const number = offerNumber(text, filename);
  const date = offerDate(text);
  const supplier = text.match(/(?:fournisseur|[ée]metteur|vendeur|supplier)\s*[:]\s*([^\n]+)/i);
  const titleLine = text.split(/\n/).find((line) =>
    /\b(devis|offre|offer|quotation|tarif|facture|commande|rfq|demande de prix|avoir|livraison)\b/i.test(line),
  );
  const title = clean(titleLine || filename.replace(/\.[^.]+$/, "")).slice(0, 140);
  const versionLabel = [number, date].filter(Boolean).join(" · ") || filename;
  return {
    title: title || filename,
    issuedOn: date,
    supplierName: clean(supplier?.[1] ?? ""),
    versionLabel,
  };
}

function offerNumber(text: string, filename: string): string {
  const patterns = [
    /n[°o]\s*d[´'`’']?\s*offre\s+([A-Z0-9][A-Z0-9./-]{2,})/i,
    /\bprice\s+offer\s+([A-Z0-9][A-Z0-9./-]{2,})/i,
    /\bref\.\s*:\s*([A-Z0-9][A-Z0-9./-]{2,})/i,
    /\bn[°o]\s*[:.]?\s*([A-Z0-9][A-Z0-9./-]{2,})/i,
  ];
  for (const pattern of patterns) {
    const found = text.match(pattern)?.[1];
    if (found) return found;
  }
  return filename.match(/(?:quotation|devis|offre)[_\s-]*(?:no|n[°o])?[_\s-]*(\d{4,})/i)?.[1] ?? "";
}

function offerDate(text: string): string {
  const labeled = text.match(/\bDate\s+(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i)?.[1];
  if (labeled) return labeled;
  const dotted = text.match(/\b(\d{2}\.\d{2}\.\d{4})\b/)?.[1];
  if (dotted) return dotted;
  const classic = text.match(/\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/)?.[1] ?? "";
  return /^\d{4}/.test(classic) ? "" : classic;
}

const KIND_RULES: Array<{ kind: DocumentKind; pattern: RegExp }> = [
  { kind: "facture", pattern: /\b(factures?|invoices?)\b/i },
  { kind: "avoir", pattern: /\b(avoirs?\s*(?:n[°o]|#|num[ée]ro)|credit note|note de cr[ée]dit)\b/i },
  { kind: "livraison", pattern: /\b(bon de livraison|delivery note|bordereau de livraison)\b/i },
  { kind: "commande", pattern: /\b(bon de commande|purchase order|commandes?)\b/i },
  {
    kind: "rfq",
    pattern:
      /\b(rfq|rfp|demande[\s-]+de[\s-]+prix|request[\s-]+for[\s-]+quotation|appel d['’\s-]*offres|consultations?)\b/i,
  },
  { kind: "devis", pattern: /\b(devis|offres?|offers?|quotations?|price\s+offer)\b/i },
  { kind: "tarif", pattern: /\btarifs?\b/i },
  { kind: "contrat", pattern: /\b(contrat|conditions g[ée]n[ée]rales|cgv)\b/i },
  { kind: "fiche", pattern: /\b(development kit|fiche technique|datasheet|data sheet)\b/i },
];

/** Titre de la pièce. Le premier mot de nature dans le nom ou les premières lignes l’emporte. Une adresse courriel ne compte pas. */
const TITLE_RULES: Array<{ kind: DocumentKind; pattern: RegExp }> = [
  { kind: "facture", pattern: /\b(factures?|invoices?)\b(?!@)/i },
  { kind: "avoir", pattern: /(?:^\s*avoirs?\b|\bavoirs?\s*(?:n[°o]|#|num[ée]ro)\b|\bcredit note\b|\bnote de cr[ée]dit\b)(?!@)/i },
  { kind: "livraison", pattern: /\b(bon de livraison|delivery note|bordereau de livraison)\b(?!@)/i },
  { kind: "commande", pattern: /\b(bon de commande|purchase order)\b(?!@)/i },
  {
    kind: "releve",
    pattern: /\b(relev[ée]s? bancaires?|relev[ée]s? de compte|extraits? de compte|bank statements?|account statements?)\b(?!@)/i,
  },
  {
    kind: "rfq",
    pattern:
      /\b(rfq|rfp|demandes?[\s-]+de[\s-]+(?:prix|chiffrage|cotation)|requests?[\s-]+for[\s-]+quotations?|appels? d['’\s-]*offres)\b(?!@)/i,
  },
  {
    kind: "devis",
    pattern:
      /\b(devis|offres?|offers?|quotations?|quotes?|soumissions?|price\s+offers?|nous vous offrons|n[°o]\s*d[´'`’']?\s*offre)\b(?!@)/i,
  },
  { kind: "tarif", pattern: /\btarifs?\b(?!@)/i },
  { kind: "contrat", pattern: /\b(contrats?|conditions g[ée]n[ée]rales|cgv)\b(?!@)/i },
  {
    kind: "fiche",
    pattern:
      /\b(documentations? techniques?|fiches? techniques?|notices? techniques?|development kits?|datasheets?|data sheets?)\b(?!@)/i,
  },
];

function documentKind(text: string, filename: string): DocumentKind {
  if (!text.trim()) return "autre";
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const header = [filename.replace(/[_./-]+/g, " "), ...lines.slice(0, 24)].join("\n");
  return titleKind(header) ?? matchKind(header) ?? matchKind(text) ?? "document";
}

function documentRole(kind: DocumentKind, text: string, filename: string): DocumentRole {
  if (kind !== "facture") return "";
  return /\bacompte\b(?!@)/i.test(`${filename}\n${text}`) ? "acompte" : "";
}

function titleKind(head: string): DocumentKind | null {
  for (const line of head.split(/\n/)) {
    const found = titleOnLine(line);
    if (found) return found;
  }
  return null;
}

function titleOnLine(line: string): DocumentKind | null {
  let best: { index: number; kind: DocumentKind } | null = null;
  for (const rule of TITLE_RULES) {
    const match = rule.pattern.exec(line);
    if (!match || match.index === undefined) continue;
    if (!best || match.index < best.index) best = { index: match.index, kind: rule.kind };
  }
  return best?.kind ?? null;
}

function matchKind(value: string): DocumentKind | null {
  for (const rule of KIND_RULES) {
    if (rule.pattern.test(value)) return rule.kind;
  }
  return null;
}

function partiesOf(text: string): DocumentParties {
  const clientName = labeled(text, "client|destinataire|acheteur|customer|bill to");
  const supplierName = labeled(text, "fournisseur|[ée]metteur|vendeur|supplier");
  if (clientName || supplierName) return { clientName, supplierName };
  const legal = legalEntities(text);
  if (/nous vous offrons|nous vous remercions/i.test(text) && legal[0]) {
    return { supplierName: legal[0], clientName: addresseeName(text, legal[0]) };
  }
  if (/price offer|quotation/i.test(text) && legal.length > 0) {
    return {
      clientName: legal[0] ?? "",
      supplierName: legal.length > 1 ? (legal[legal.length - 1] ?? "") : "",
    };
  }
  return { clientName: "", supplierName: legal[0] ?? "" };
}

function legalEntities(text: string): string[] {
  const found: string[] = [];
  const pattern =
    /([A-Z0-9][\p{L}0-9&'’-]+(?:[^\S\n]+[\p{L}0-9&'’-]+){0,3})[^\S\n]+(SARL|SAS|SASU|SA|GmbH|Ltd|LLC|OÜ|OY|Inc\.?|BV|AG)(?![\p{L}\p{N}])/giu;
  for (const match of text.matchAll(pattern)) {
    const name = clean(`${match[1] ?? ""} ${match[2] ?? ""}`);
    if (name.length < 4) continue;
    if (!found.some((item) => item.toLowerCase() === name.toLowerCase())) found.push(name);
  }
  return found;
}

function addresseeName(text: string, supplier: string): string {
  const supplierKey = supplier.split(/\s+/)[0]?.toLowerCase() ?? "";
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line || (supplierKey && line.toLowerCase().includes(supplierKey))) continue;
    if (isStreet(line) || isNoise(line) || line.length > 80) continue;
    if (!/\p{L}/u.test(line)) continue;
    if (/\b(EUR|page|tel|fax|date|ref)\b/i.test(line)) continue;
    return clean(line).slice(0, 160);
  }
  return "";
}

function isStreet(line: string): boolean {
  return /\b(rue|avenue|boulevard|chemin|impasse|place|cedex)\b/i.test(line) || /^\d{1,5}[,\s]/.test(line);
}

function statedCommercialNotes(text: string): string[] {
  const written = writtenCommercial(text);
  const notes: string[] = [];
  if (written.statedTotalHt) notes.push(amountNote("Total HT indiqué", written.statedTotalHt));
  const rate = written.vatMention.match(/VAT\s+(\d+(?:[.,]\d+)?)\s*%/i)?.[1];
  if (rate) notes.push(`TVA indiquée ${rate} %`);
  else if (written.statedVat) notes.push(amountNote("TVA indiquée", written.statedVat));
  if (written.statedTotalTtc) notes.push(amountNote("Total TTC indiqué", written.statedTotalTtc));
  const until = written.conditions.match(/Offre valable jusqu’au\s+(\S+)/)?.[1];
  if (until) notes.push(`Offre valable jusqu’au ${until}`);
  const incoterm = written.conditions.match(/EXW\s+[^.]*/)?.[0];
  if (incoterm) notes.push(`Conditions indiquées : ${clean(incoterm)}`);
  const vatSentence = written.vatMention
    .split(". ")
    .map((part) => part.trim())
    .find((part) => /^TVA en Supplément/i.test(part));
  if (vatSentence) notes.push(vatSentence);
  return notes;
}

function writtenCommercial(text: string): WrittenCommercial {
  const horsTaxes = text.match(/Prix\s+Hors\s+Taxes[\s\S]{0,80}?EUR\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i)?.[1];
  const total = text.match(/\bTotal\s+EUR\s+(\d{1,3}(?: \d{3})+\.\d{2})/i)?.[1];
  const statedTotalHt = horsTaxes
    ? `EUR ${horsTaxes}`
    : total
      ? `EUR ${total}`
      : ownLineAmount(text, "total\\s+ht|montant\\s+ht|sous-total\\s+ht");
  const vatAmount = text.match(/\bVAT\s+\d+(?:[.,]\d+)?\s*%\s+EUR\s+(\d{1,3}(?: \d{3})*(?:\.\d{2})?)/i)?.[1];
  const statedVat = vatAmount ? `EUR ${vatAmount}` : ownLineAmount(text, "montant\\s+tva|tva|vat");
  const withVat = text.match(/Total\s+with\s+VAT\s+EUR\s+(\d{1,3}(?: \d{3})+\.\d{2})/i)?.[1];
  const statedTotalTtc = withVat ? `EUR ${withVat}` : ownLineAmount(text, "total\\s+ttc|montant\\s+ttc|net\\s+[àa]\\s+payer");
  const vatRate = text.match(/\bVAT\s+(\d+(?:[.,]\d+)?)\s*%/i)?.[1];
  const vatNote = text.match(/TVA en Supplément[^\n]+/i)?.[0];
  const vatMention = [vatRate ? `VAT ${vatRate} %` : "", vatNote ? clean(vatNote) : ""]
    .filter(Boolean)
    .join(". ")
    .slice(0, 500);
  const until = text.match(/\b(?:active until|valable jusqu['’]au)\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i)?.[1];
  const incoterm = text.match(/\b(EXW\s+[^\n.]+)/i)?.[1];
  const conditions = [until ? `Offre valable jusqu’au ${until}` : "", incoterm ? clean(incoterm) : ""]
    .filter(Boolean)
    .join(". ")
    .slice(0, 500);
  const sample = `${statedTotalHt}\n${text.slice(0, 4000)}`;
  const currency = /\$|\bUSD\b/i.test(sample) && !/€|\bEUR\b/i.test(sample) ? "USD" : /€|\bEUR\b/i.test(sample) ? "EUR" : "";
  return {
    clientName: "",
    currency,
    statedTotalHt: statedTotalHt.slice(0, 80),
    statedVat: statedVat.slice(0, 80),
    statedTotalTtc: statedTotalTtc.slice(0, 80),
    vatMention,
    conditions,
  };
}

function amountNote(label: string, value: string): string {
  if (value.startsWith("EUR ")) return `${label} ${value.slice(4)} EUR`;
  return `${label} ${value}`;
}

function ownLineAmount(text: string, label: string): string {
  for (const raw of text.split(/\n/)) {
    const match = raw.trim().match(new RegExp(`^(?:${label})\\s*[:\\-]?\\s*(.+)$`, "i"));
    if (!match) continue;
    const phrase = amountPhrase(match[1] ?? "");
    if (phrase) return phrase;
  }
  return "";
}

function amountPhrase(raw: string): string {
  const match = clean(raw).match(/(\d{1,3}(?:[ \u00a0.]\d{3})*(?:[,.]\d{2}))\s*(€|eur|usd)?/i);
  if (!match?.[1]) return "";
  const unit = !match[2] ? "" : match[2] === "€" || /eur/i.test(match[2]) ? " €" : " USD";
  return `${match[1]}${unit}`.trim().slice(0, 80);
}

function labeled(text: string, labels: string): string {
  const match = text.match(new RegExp(`(?:${labels})\\s*[:\\-]\\s*([^\\n]+)`, "i"));
  return clean(match?.[1] ?? "").slice(0, 160);
}

function enrichmentOf(
  filename: string,
  kind: DocumentKind,
  text: string,
  offers: OfferVersion[],
  pricedLines: OfferLine[],
  parties: DocumentParties,
): string {
  const head = [
    `Pièce : ${filename}`,
    `Type : ${kindLabel(kind)}`,
    parties.clientName ? `Client : ${parties.clientName}` : "",
    parties.supplierName ? `Fournisseur : ${parties.supplierName}` : "",
    ...statedCommercialNotes(text),
  ].filter(Boolean);
  if (offers.length > 0) {
    const blocks = offers.map((offer) => {
      const lines = offer.lines.map((line) => linePhrase(line));
      return [
        `Version ${offer.versionLabel}`,
        offer.supplierName ? `Fournisseur : ${offer.supplierName}` : "",
        "Cette version est conservée à part. Elle ne remplace pas un autre devis du même produit.",
        ...lines,
      ]
        .filter(Boolean)
        .join("\n");
    });
    return [...head, ...blocks].join("\n\n");
  }
  if (pricedLines.length > 0) {
    return [
      ...head,
      "Montants indiqués dans la pièce. Ils ne deviennent pas une version de devis.",
      ...pricedLines.map((line) => linePhrase(line)),
    ].join("\n");
  }
  const excerpt = text.trim().replace(/\s+/g, " ").slice(0, 900);
  if (!excerpt) {
    return [...head, "Fichier conservé. Le texte n’a pas pu être extrait."].join("\n");
  }
  return [...head, `Extrait : ${excerpt}`].join("\n");
}

function linePhrase(line: OfferLine): string {
  return `- ${line.product}${line.reference ? ` (${line.reference})` : ""} — prix indiqué ${line.statedPrice}${
    line.conditions ? ` — conditions : ${line.conditions}` : ""
  }`;
}

function pricePhrase(line: string): string {
  const match = line.match(PRICE);
  if (!match) return "";
  const tax = match[2] ? ` ${match[2].toUpperCase()}` : "";
  return `${match[1]} €${tax}`.replace(/\u00a0/g, " ");
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export type DirectoryQuote = {
  title: string;
  versionLabel: string;
  supplierName: string;
  fingerprint: string;
  lines: Array<{ product: string; statedPrice: string; conditions: string }>;
};

export type DirectoryDemand = {
  title: string;
  supplierName: string;
  clientName: string;
  status: string;
};

export type DirectorySnapshot = {
  clients: string[];
  suppliers: string[];
  products: Array<{ name: string; reference: string }>;
  quotes: DirectoryQuote[];
  demands: DirectoryDemand[];
  projects: string[];
};

export type ProposedAction =
  | { type: "create_client"; name: string }
  | { type: "create_supplier"; name: string }
  | {
      type: "create_product";
      name: string;
      reference: string;
      supplierName: string;
      source: string;
      costStated: string;
      currency: string;
      kind: "produit" | "service";
    }
  | { type: "add_quote_version"; offer: OfferVersion }
  | { type: "record_demand"; title: string; reference: string; clientName: string; supplierName: string }
  | { type: "mark_demand"; title: string; status: "offre reçue" };

export type ProposalField = { label: string; value: string };
export type ProposalSource = { label: string; title: string };

export type DocumentProposalDraft = {
  kind: DocumentKind;
  title: string;
  summary: string;
  fields: ProposalField[];
  actions: ProposedAction[];
  sources: ProposalSource[];
};

export function proposeFromReading(
  reading: DocumentReading,
  filename: string,
  directory: DirectorySnapshot,
  ragHits: ProposalSource[],
  context = "",
): DocumentProposalDraft | null {
  if (reading.kind === "autre") return null;
  if (
    reading.kind === "document" &&
    !reading.parties.clientName &&
    !reading.parties.supplierName &&
    reading.pricedLines.length === 0
  ) {
    return null;
  }

  const clientName = reading.parties.clientName;
  const supplierName = reading.parties.supplierName;
  const knownClient = knownParty(clientName, directory.clients);
  const knownSupplier = knownParty(supplierName, directory.suppliers);
  const projectName = mentionedProject(
    `${context}\n${reading.heading}\n${filename}`,
    directory.projects,
  );
  const actions: ProposedAction[] = [];
  const title = (reading.offers[0]?.title || reading.heading || filename).slice(0, 180);
  const reference = reading.offers[0]?.versionLabel || "";

  const archival = reading.kind === "releve";
  if (clientName && !knownClient && !archival) actions.push({ type: "create_client", name: clientName });
  if (supplierName && !knownSupplier && !archival) actions.push({ type: "create_supplier", name: supplierName });

  if (reading.kind === "devis" || reading.kind === "tarif") {
    for (const offer of reading.offers) {
      const already = directory.quotes.some((quote) => quote.fingerprint === offer.fingerprint);
      if (!already) actions.push({ type: "add_quote_version", offer });
    }
    const demand = directory.demands.find(
      (item) => item.status !== "offre reçue" && sameText(item.supplierName, supplierName),
    );
    if (demand) actions.push({ type: "mark_demand", title: demand.title, status: "offre reçue" });
  } else if (reading.kind === "fiche") {
    const sheet = datasheetProduct(`${filename}\n${reading.heading}\n${reading.enrichment}`);
    const known = sheet
      ? directory.products.some(
          (product) => sameText(product.reference, sheet.reference) || sameText(product.name, sheet.name),
        )
      : false;
    if (sheet && !known) {
      actions.push({
        type: "create_product",
        name: sheet.name,
        reference: sheet.reference,
        supplierName,
        source: "fiche",
        costStated: "",
        currency: "",
        kind: "produit",
      });
    }
  } else if (reading.kind === "rfq") {
    const same = directory.demands.find(
      (item) => sameText(item.title, title) && sameText(item.supplierName, supplierName),
    );
    if (!same) {
      actions.push({
        type: "record_demand",
        title,
        reference: reference.slice(0, 80),
        clientName,
        supplierName,
      });
    }
  } else if (!archival) {
    for (const line of reading.pricedLines) {
      if (!matchProduct(line, directory.products)) actions.push(productFromLine(line, supplierName, reading.kind));
    }
  }

  return {
    kind: reading.kind,
    title,
    summary: summaryOf(reading, filename, knownClient, knownSupplier, directory, actions, ragHits, projectName),
    fields: fieldsOf(reading, clientName, supplierName, knownClient, knownSupplier, actions, projectName),
    actions,
    sources: sourcesOf(knownClient, knownSupplier, reading, directory, ragHits),
  };
}

export function actionLabel(action: ProposedAction): string {
  switch (action.type) {
    case "create_client":
      return `Créer le client ${action.name}`;
    case "create_supplier":
      return `Créer le fournisseur ${action.name}`;
    case "create_product":
      return `Créer le produit ${action.name}`;
    case "add_quote_version":
      return `Ajouter la version ${action.offer.versionLabel}`;
    case "record_demand":
      return `Ouvrir la demande ${action.title}`;
    case "mark_demand":
      return `Mettre à jour la demande ${action.title} : offre reçue`;
  }
}

function fieldsOf(
  reading: DocumentReading,
  clientName: string,
  supplierName: string,
  knownClient: string | null,
  knownSupplier: string | null,
  actions: ProposedAction[],
  projectName: string | null,
): ProposalField[] {
  const products = reading.pricedLines.map((line) => {
    const price = line.statedPrice ? ` — ${line.statedPrice}` : "";
    const conditions = line.conditions ? ` — ${line.conditions}` : "";
    return `${line.product}${price}${conditions}`;
  });
  return [
    { label: "Type", value: kindLabel(reading.kind) },
    ...(reading.role === "acompte" ? [{ label: "Rôle", value: "Acompte" }] : []),
    { label: "Étape", value: cycleSentence(reading.kind) },
    {
      label: "Projet",
      value: projectName
        ? `${projectName} · déjà ouvert, pièce non rattachée`
        : "Non rattaché",
    },
    {
      label: "Client",
      value: clientName
        ? knownClient
          ? `${knownClient} · déjà au répertoire`
          : `${clientName} · à créer`
        : "Non identifié",
    },
    {
      label: "Fournisseur",
      value: supplierName
        ? knownSupplier
          ? `${knownSupplier} · déjà au répertoire`
          : `${supplierName} · à créer`
        : "Non identifié",
    },
    { label: "Produits", value: products.join("\n") || "Aucun produit chiffré" },
    {
      label: "Suite",
      value:
        actions.length > 0
          ? actions.map((action) => actionLabel(action)).join("\n")
          : "Conserver la pièce, sans nouvelle fiche",
    },
  ];
}

function summaryOf(
  reading: DocumentReading,
  filename: string,
  knownClient: string | null,
  knownSupplier: string | null,
  directory: DirectorySnapshot,
  actions: ProposedAction[],
  ragHits: ProposalSource[],
  projectName: string | null,
): string {
  const clientName = reading.parties.clientName;
  const supplierName = reading.parties.supplierName;
  const lines = [
    `Type reconnu : ${kindLabel(reading.kind)}.`,
    cycleSentence(reading.kind),
    `Pièce : ${filename}.`,
  ];
  if (reading.role === "acompte") lines.splice(1, 0, "Rôle : acompte.");
  lines.push(
    clientName
      ? knownClient
        ? `Client déjà au répertoire : ${knownClient}.`
        : `Client à créer : ${clientName}. La fiche restera à compléter.`
      : "Aucun client identifié sur la pièce.",
  );
  lines.push(
    supplierName
      ? knownSupplier
        ? `Fournisseur déjà au répertoire : ${knownSupplier}.`
        : `Fournisseur à créer : ${supplierName}.`
      : "Aucun fournisseur identifié sur la pièce.",
  );
  for (const line of reading.pricedLines) {
    const known = matchProduct(line, directory.products);
    const family = lineFamily(line) === "service" ? "Service" : "Produit";
    const cost = line.statedPrice ? `, coût unitaire ${line.statedPrice}` : "";
    const devise = lineCurrency(line.statedPrice);
    lines.push(
      known
        ? `Article déjà au catalogue : ${known.name}, famille ${family}${cost}${devise ? `, devise ${devise}` : ""}.`
        : `Article à créer : ${line.product}, famille ${family}${cost}${devise ? `, devise ${devise}` : ""}.`,
    );
    const earlier = earlierVersion(line, reading, directory);
    const oldPrice = earlier?.lines.find((item) => sameText(item.product, line.product))?.statedPrice;
    if (earlier && line.statedPrice && oldPrice && oldPrice !== line.statedPrice) {
      lines.push(
        `Une version existe déjà${earlier.versionLabel ? ` (${earlier.versionLabel})` : ""}, coût unitaire ${oldPrice}. Le coût unitaire ${line.statedPrice} est proposé à part, avec ses conditions.`,
      );
    }
  }
  if (!keepsCommercialVersion(reading.kind) && reading.kind !== "rfq" && reading.kind !== "fiche" && reading.pricedLines.length > 0) {
    lines.push("Les montants restent ceux de la pièce. Aucune version de devis n’est créée.");
  }
  if ((reading.kind === "devis" || reading.kind === "tarif") && reading.offers.length > 0) {
    const fresh = actions.some((action) => action.type === "add_quote_version");
    if (!fresh) {
      lines.push("Cette version est déjà enregistrée. Le fichier est conservé, le devis n’est pas dupliqué.");
    }
  }
  if (ragHits.length > 0) {
    lines.push(`Fiches proches : ${ragHits.slice(0, 4).map((hit) => `${hit.label} ${hit.title}`).join(", ")}.`);
  }
  lines.push(
    projectName
      ? `Projet déjà ouvert : ${projectName}. La pièce reste hors dossier tant que vous ne demandez pas de l’y rattacher.`
      : "Aucun projet n’est ouvert depuis cette pièce.",
  );
  lines.push("Rien n’est écrit tant que la proposition n’est pas confirmée.");
  return lines.join("\n");
}

function productFromLine(line: OfferLine, supplierName: string, source: string): ProposedAction {
  return {
    type: "create_product",
    name: line.product,
    reference: line.reference,
    supplierName,
    source,
    costStated: line.statedPrice.slice(0, 80),
    currency: lineCurrency(line.statedPrice),
    kind: lineFamily(line),
  };
}

function lineFamily(line: OfferLine): "produit" | "service" {
  return /\b(services?|prestations?|forfaits?|abonnements?|maintenances?|assistances?|formations?)\b/i.test(
    `${line.product}\n${line.conditions}`,
  )
    ? "service"
    : "produit";
}

function lineCurrency(raw: string): "" | "EUR" | "USD" {
  if (/\$|\busd\b/i.test(raw)) return "USD";
  if (/€|\beur\b/i.test(raw)) return "EUR";
  return "";
}

export function statedLineQuantity(conditions: string): string {
  const match = conditions.match(/\bquantité\s+([^,]{1,40})/i);
  return match?.[1]?.trim().slice(0, 40) ?? "";
}

export function cycleSentence(kind: DocumentKind): string {
  switch (kind) {
    case "rfq":
      return "Demande de devis reçue. La suite est l’offre, puis la fourniture du produit ou du service dans un projet.";
    case "devis":
    case "tarif":
      return "Offre à comparer. Les autres versions du même produit restent à part.";
    case "commande":
      return "Commande à honorer : produit ou service, dans le cadre d’un projet.";
    case "livraison":
      return "Fourniture du produit ou du service.";
    case "facture":
    case "avoir":
      return "Pièce après la fourniture. Elle ne devient pas une version de devis.";
    case "contrat":
      return "Cadre de la fourniture, avant ou pendant le projet.";
    case "fiche":
      return "Documentation technique du produit ou du kit à fournir. Elle n’indique pas un prix de devis.";
    case "releve":
      return "Relevé bancaire reçu. Aucun paiement n’est rapproché.";
    default:
      return "Pièce reçue dans le fil de l’activité.";
  }
}

function mentionedProject(context: string, names: string[]): string | null {
  const hay = fold(context);
  const unique = [...new Map(names.map((name) => [fold(name), name])).values()];
  const hits = unique.filter((name) => {
    const folded = fold(name);
    return folded.length >= 3 && hay.includes(folded);
  });
  if (hits.length === 0) return null;
  hits.sort((left, right) => fold(right).length - fold(left).length);
  const best = hits[0];
  if (!best) return null;
  const sameLength = hits.filter((name) => fold(name).length === fold(best).length);
  return sameLength.length === 1 ? best : null;
}

function sourcesOf(
  knownClient: string | null,
  knownSupplier: string | null,
  reading: DocumentReading,
  directory: DirectorySnapshot,
  ragHits: ProposalSource[],
): ProposalSource[] {
  const sources: ProposalSource[] = [];
  if (knownClient) sources.push({ label: "Client", title: knownClient });
  if (knownSupplier) sources.push({ label: "Fournisseur", title: knownSupplier });
  for (const line of reading.pricedLines) {
    const known = matchProduct(line, directory.products);
    if (known) sources.push({ label: "Produit", title: known.name });
  }
  sources.push(...ragHits);
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${fold(source.label)}:${fold(source.title)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function earlierVersion(
  line: OfferLine,
  reading: DocumentReading,
  directory: DirectorySnapshot,
): DirectoryQuote | null {
  const current = reading.offers.find((offer) => offer.lines.some((item) => sameText(item.product, line.product)));
  return (
    directory.quotes.find((quote) => {
      if (current && quote.fingerprint === current.fingerprint) return false;
      return quote.lines.some((item) => sameText(item.product, line.product) && item.statedPrice && item.statedPrice !== line.statedPrice);
    }) ?? null
  );
}

function matchProduct(
  line: OfferLine,
  products: Array<{ name: string; reference: string }>,
): { name: string; reference: string } | null {
  if (line.reference) {
    const byRef = products.find((product) => product.reference && fold(product.reference) === fold(line.reference));
    if (byRef) return byRef;
  }
  const name = knownParty(line.product, products.map((product) => product.name));
  return name ? products.find((product) => product.name === name) ?? null : null;
}

function knownParty(name: string, names: string[]): string | null {
  const wanted = fold(name);
  if (wanted.length < 2) return null;
  const exact = names.find((item) => fold(item) === wanted);
  if (exact) return exact;
  const contained = names.filter((item) => {
    const folded = fold(item);
    return folded.length >= 3 && wanted.includes(folded);
  });
  return contained.length === 1 ? contained[0] ?? null : null;
}

function sameText(left: string, right: string): boolean {
  return Boolean(left) && Boolean(right) && fold(left) === fold(right);
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
