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
