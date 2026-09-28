import type { AnswerPacket } from "./answer-packet.ts";
import { catalogUnitCents, formatCents, saleLineFigures } from "./pricing.ts";

export function asksHybridQuote(text: string): boolean {
  return (
    /\b(pr[ée]pare[rz]?|pr[ée]parer|fais|faites|[ée]tablis|[ée]tablir|g[ée]n[èe]re[rz]?)\b[\s\S]{0,48}\bdevis\b/i.test(text) ||
    /\bbrouillon de devis\b/i.test(text)
  );
}

export function negotiatedDiscount(text: string): number | null {
  const found = [...text.matchAll(/remises?(?:\s+\p{L}+){0,4}\s*(?:de|:)?\s*(\d{1,2})\s*(?:%|pour\s*cent)/giu)]
    .map((match) => Number(match[1]))
    .filter((value) => value >= 0 && value <= 99);
  const unique = [...new Set(found)];
  return unique.length === 1 ? unique[0] : null;
}

export function discountConflict(text: string): boolean {
  const found = [...text.matchAll(/remises?(?:\s+\p{L}+){0,4}\s*(?:de|:)?\s*(\d{1,2})\s*(?:%|pour\s*cent)/giu)]
    .map((match) => Number(match[1]))
    .filter((value) => value >= 0 && value <= 99);
  return new Set(found).size > 1;
}

export type CatalogHit = { name: string; reference: string };

function foldText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function quotedItems(
  text: string,
  products: CatalogHit[],
): Array<{ name: string; reference: string; quantity: number }> {
  const folded = foldText(text);
  const hits: Array<{ name: string; reference: string; quantity: number; at: number }> = [];
  for (const product of products) {
    const name = foldText(product.name);
    const reference = foldText(product.reference);
    const atName = name.length >= 3 ? folded.indexOf(name) : -1;
    const atReference = reference.length >= 2 ? folded.indexOf(reference) : -1;
    const at = atName >= 0 ? atName : atReference;
    if (at < 0) continue;
    hits.push({
      name: product.name,
      reference: product.reference,
      quantity: quantityBefore(folded, at),
      at,
    });
  }
  hits.sort((left, right) => left.at - right.at);
  const seen = new Set<string>();
  return hits.flatMap((hit) => {
    const key = foldText(hit.name);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ name: hit.name, reference: hit.reference, quantity: hit.quantity }];
  });
}

function quantityBefore(folded: string, at: number): number {
  const window = folded.slice(Math.max(0, at - 28), at);
  const match = window.match(/(\d{1,4})\s*(?:x|×)?\s*$/);
  if (!match) return 1;
  const quantity = Number(match[1]);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) return 1;
  return quantity;
}

/** Taux déjà retenu sur une ligne de vente quand la phrase n’en nomme pas. */
export const DEFAULT_MARKUP_PERCENT = 30;

export const QUOTE_METHOD =
  "Chaque ligne reprend le prix catalogue écrit, puis la remise unique déjà lue. Sans prix catalogue, le prix unitaire vient du coût enregistré et du taux de marque 30 %, par la règle de prix. Le total HT additionne ces montants de ligne déjà calculés. Le modèle ne propose pas les montants.";

export type QuoteCatalogItem = {
  name: string;
  reference: string;
  kind: "produit" | "service";
  family: string;
  currency: string;
  statedPriceCents: number | null;
  costCents: number | null;
  stockQty: number | null;
};

export type ComposedLine = {
  name: string;
  reference: string;
  kind: "produit" | "service";
  family: string;
  quantity: number;
  costCents: number | null;
  saleUnitCents: number;
  markupPercent: number;
  discountPercent: number;
  stockQty: number | null;
  priceSource: "catalogue" | "marque";
};

const FAMILY_WORD: Record<string, string> = {
  portables: "portable",
  portable: "portable",
  serveurs: "serveur",
  serveur: "serveur",
  postes: "poste",
  poste: "poste",
  reseaux: "reseau",
  reseau: "reseau",
  prestations: "prestation",
  prestation: "prestation",
};

export function composeQuote(input: {
  text: string;
  clientName: string;
  catalog: QuoteCatalogItem[];
  discountPercent: number | null;
  discountConflict: boolean;
}): { lines: ComposedLine[]; missing: string[] } {
  const chunks = requestChunks(input.text, input.clientName);
  if (chunks.length === 0) {
    return {
      lines: [],
      missing: [`Aucun article du catalogue n’est cité pour ${input.clientName}. Le devis n’est pas créé.`],
    };
  }
  const lines: ComposedLine[] = [];
  const missing: string[] = [];
  const discount = input.discountPercent ?? 0;
  for (const chunk of chunks) {
    const quantity = chunkQuantity(chunk);
    const label = chunkLabel(chunk);
    if (label.length < 2) continue;
    const hint = kindHint(label);
    const matches = matchCatalog(label, hint, input.catalog);
    if (matches.length === 0) {
      missing.push(`Aucun article du catalogue pour « ${label} ».`);
      continue;
    }
    if (matches.length > 1) {
      missing.push(`Plusieurs articles pour « ${label} » : ${matches.map((item) => item.name).join(", ")}. Nommez-en un.`);
      continue;
    }
    const product = matches[0];
    if (!product) continue;
    if (input.discountConflict) {
      missing.push(`${product.name} : plusieurs remises dans les conditions, aucune n’est appliquée.`);
      continue;
    }
    if (product.currency === "USD") {
      missing.push(`${product.name} : montant en dollars. Le devis en euro n’est pas calculé.`);
      continue;
    }
    const priced = priceCatalogLine(product, quantity, discount);
    if (!priced) {
      missing.push(`${product.name} : ni prix catalogue ni coût enregistré. Ligne non chiffrée.`);
      continue;
    }
    lines.push(priced);
  }
  if (lines.length === 0 && missing.length === 0) {
    missing.push(`Aucun article du catalogue n’est cité pour ${input.clientName}. Le devis n’est pas créé.`);
  }
  return { lines, missing };
}

export function quotePacket(input: {
  clientName: string;
  projectName: string;
  lines: ComposedLine[];
  missing: string[];
  href: string;
}): AnswerPacket {
  const total = input.lines.reduce((sum, line) => sum + line.saleUnitCents * line.quantity, 0);
  const rows = input.lines.map((line) => ({
    label: `${line.quantity} × ${line.name}`,
    detail: [
      line.kind === "service" ? "prestation" : "matériel",
      line.priceSource === "catalogue" ? "prix catalogue" : "prix depuis le coût",
      `unitaire ${formatCents(line.saleUnitCents)}`,
      `ligne ${formatCents(line.saleUnitCents * line.quantity)}`,
      line.discountPercent > 0 ? `remise ${line.discountPercent} %` : "aucune remise écrite",
      line.stockQty === null ? "stock non indiqué" : `stock ${line.stockQty}`,
      line.stockQty !== null && line.quantity > line.stockQty ? "quantité supérieure au stock" : "",
    ]
      .filter(Boolean)
      .join(", "),
  }));
  if (input.href) rows.push({ label: "Brouillon", detail: `enregistré ${input.href}` });
  return {
    title: "Devis brouillon",
    period: "",
    filters: [input.clientName, input.projectName].filter(Boolean),
    measures:
      input.lines.length === 0
        ? []
        : [
            { label: "Lignes", value: String(input.lines.length) },
            { label: "Total HT", value: formatCents(total) },
          ],
    rows,
    sources: ["Catalogue", "Règle de prix"],
    missing: input.missing,
    method: QUOTE_METHOD,
  };
}

function requestChunks(text: string, clientName: string): string[] {
  const named = clientName.trim();
  const withoutClient =
    named.length >= 2 ? text.replace(new RegExp(escapeRegExp(named), "i"), " ") : text;
  const rest = withoutClient.replace(/^[\s\S]*?\bdevis\b/i, " ");
  return rest
    .split(/[,;]|\bet\b/i)
    .map((part) => part.replace(/^\s*(?:pour|le|la|les|un|une|du|des|de|client)\b\s*/i, "").trim())
    .filter((part) => part.length >= 2 && !/^(?:devis|client)$/i.test(part));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chunkQuantity(chunk: string): number {
  const match = foldText(chunk).match(/^(\d{1,4})\s*(?:x|×)?\s+\S/);
  if (!match) return 1;
  const quantity = Number(match[1]);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) return 1;
  return quantity;
}

function chunkLabel(chunk: string): string {
  return chunk.replace(/^\d{1,4}\s*(?:x|×)?\s+/i, "").trim();
}

function kindHint(label: string): "produit" | "service" | "" {
  const folded = foldText(label);
  if (/\b(prestations?|services?|installations?|preparations?|maintenances?)\b/.test(folded)) return "service";
  if (/\b(portables?|serveurs?|postes?|materiels?|produits?)\b/.test(folded)) return "produit";
  return "";
}

function matchCatalog(label: string, hint: "produit" | "service" | "", catalog: QuoteCatalogItem[]): QuoteCatalogItem[] {
  const folded = foldText(label);
  const pool = hint ? catalog.filter((item) => item.kind === hint) : catalog;
  const family = FAMILY_WORD[folded] ?? "";
  const hits = pool.filter((item) => {
    const name = foldText(item.name);
    const reference = foldText(item.reference);
    if (reference.length >= 2 && folded.includes(reference)) return true;
    if (name.length >= 3 && folded.includes(name)) return true;
    if (family && item.family === family) return true;
    return tokensCover(name, folded);
  });
  const seen = new Set<string>();
  return hits.filter((item) => {
    const key = foldText(item.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tokensCover(name: string, foldedLabel: string): boolean {
  const tokens = name.split(/[^a-z0-9]+/).filter((token) => token.length >= 5);
  if (tokens.length === 0) return false;
  return tokens.every((token) => new RegExp(`\\b${token}\\b`).test(foldedLabel));
}

function priceCatalogLine(product: QuoteCatalogItem, quantity: number, discount: number): ComposedLine | null {
  const base = {
    name: product.name,
    reference: product.reference,
    kind: product.kind,
    family: product.family,
    quantity,
    costCents: product.costCents,
    stockQty: product.stockQty,
    discountPercent: discount,
  };
  if (product.statedPriceCents !== null) {
    return {
      ...base,
      saleUnitCents: catalogUnitCents(product.statedPriceCents, discount),
      markupPercent: 0,
      priceSource: "catalogue",
    };
  }
  if (product.costCents === null) return null;
  const figures = saleLineFigures({
    quantity: 1,
    costCents: product.costCents,
    markupPercent: DEFAULT_MARKUP_PERCENT,
    discountPercent: discount,
  });
  if (figures.unitNetCents === null) return null;
  return {
    ...base,
    saleUnitCents: figures.unitNetCents,
    markupPercent: DEFAULT_MARKUP_PERCENT,
    priceSource: "marque",
  };
}
