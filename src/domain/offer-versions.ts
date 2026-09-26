import { createHash } from "node:crypto";

export type OfferLine = {
  product: string;
  reference: string;
  statedPrice: string;
  conditions: string;
};

export type OfferVersion = {
  title: string;
  issuedOn: string;
  supplierName: string;
  versionLabel: string;
  fingerprint: string;
  lines: OfferLine[];
};

export type DocumentReading = {
  kind: "devis" | "tarif" | "document" | "autre";
  enrichment: string;
  offers: OfferVersion[];
};

const PRICE =
  /(\d{1,6}(?:[ \u00a0]\d{3})*(?:[,.]\d{1,4})?)\s*(?:€|eur)\s*(ht|ttc)?/i;

export function readOfferFile(text: string, filename: string): DocumentReading {
  const parsed = splitDocuments(text)
    .map((part) => parseOffer(part, filename))
    .filter((offer): offer is OfferVersion => offer !== null);
  const kind = documentKind(text, filename, parsed.length > 0);
  const offers = keepsCommercialVersion(kind) ? parsed : [];
  return {
    kind,
    offers,
    enrichment: enrichmentOf(filename, kind, text, offers),
  };
}

export function keepsCommercialVersion(kind: DocumentReading["kind"]): boolean {
  return kind === "devis" || kind === "tarif";
}

export function kindLabel(kind: string): string {
  switch (kind) {
    case "devis":
      return "Devis";
    case "tarif":
      return "Tarif";
    case "document":
      return "Document";
    default:
      return "Autre";
  }
}

export function splitDocuments(text: string): string[] {
  const parts = text
    .split(/\n(?=\s*(?:devis|offre|quotation|tarif)\b)/i)
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
  return { ...header, fingerprint, lines };
}

function parseLines(text: string): OfferLine[] {
  const lines: OfferLine[] = [];
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line || !PRICE.test(line)) continue;
    if (/^(?:total|sous-total|tva|montant|net [àa] payer)\b/i.test(line)) continue;
    const parsed = parseOfferLine(line);
    if (parsed) lines.push(parsed);
  }
  return lines;
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

function headerOf(text: string, filename: string): Omit<OfferVersion, "fingerprint" | "lines"> {
  const number = text.match(/\bn[°o]\s*[:.]?\s*([A-Z0-9][A-Z0-9./-]{2,})/i);
  const date = text.match(/\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/);
  const supplier = text.match(/(?:fournisseur|[ée]metteur|vendeur)\s*[:]\s*([^\n]+)/i);
  const titleLine = text.split(/\n/).find((line) => /\b(devis|offre|tarif)\b/i.test(line));
  const title = clean(titleLine || filename.replace(/\.[^.]+$/, "")).slice(0, 140);
  const versionLabel = [number?.[1], date?.[1]].filter(Boolean).join(" · ") || filename;
  return {
    title: title || filename,
    issuedOn: date?.[1] ?? "",
    supplierName: clean(supplier?.[1] ?? ""),
    versionLabel,
  };
}

function documentKind(
  text: string,
  filename: string,
  hasOffer: boolean,
): DocumentReading["kind"] {
  const hay = `${filename}\n${text}`;
  if (hasOffer && /\b(devis|offre|quotation)\b/i.test(hay)) return "devis";
  if (hasOffer && /\btarif\b/i.test(hay)) return "tarif";
  if (/\b(contrat|facture|conditions g[ée]n[ée]rales|cgv)\b/i.test(hay)) return "document";
  if (text.trim().length > 0) return "document";
  return "autre";
}

function enrichmentOf(
  filename: string,
  kind: DocumentReading["kind"],
  text: string,
  offers: OfferVersion[],
): string {
  if (offers.length > 0) {
    const blocks = offers.map((offer) => {
      const lines = offer.lines.map(
        (line) =>
          `- ${line.product}${line.reference ? ` (${line.reference})` : ""} — prix indiqué ${line.statedPrice}${
            line.conditions ? ` — conditions : ${line.conditions}` : ""
          }`,
      );
      return [
        `Version ${offer.versionLabel}`,
        offer.supplierName ? `Fournisseur : ${offer.supplierName}` : "",
        "Cette version est conservée à part. Elle ne remplace pas un autre devis du même produit.",
        ...lines,
      ]
        .filter(Boolean)
        .join("\n");
    });
    return [`Pièce : ${filename}`, `Type : ${kind}`, ...blocks].join("\n\n");
  }
  const excerpt = text.trim().replace(/\s+/g, " ").slice(0, 900);
  if (!excerpt) {
    return `Pièce : ${filename}\nType : ${kind}\nFichier conservé. Le texte n’a pas pu être extrait.`;
  }
  return [`Pièce : ${filename}`, `Type : ${kind}`, `Extrait : ${excerpt}`].join("\n");
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
