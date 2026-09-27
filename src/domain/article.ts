export function articleFamily(text: string): "produit" | "service" {
  return /\b(services?|prestations?|forfaits?|abonnements?|maintenances?|assistances?|formations?)\b/i.test(
    text,
  )
    ? "service"
    : "produit";
}

export function writtenCurrency(raw: string): "" | "EUR" | "USD" {
  if (/\$|\busd\b/i.test(raw)) return "USD";
  if (/€|\beur\b/i.test(raw)) return "EUR";
  return "";
}

export function shownUnitCost(costStated: string, fallbacks: string[]): string {
  return [costStated, ...fallbacks].map((value) => value.trim()).find(Boolean) ?? "";
}

export function articleFromQuoteLine(line: {
  product: string;
  reference: string;
  statedPrice: string;
  conditions: string;
}): {
  name: string;
  reference: string;
  kind: "produit" | "service";
  costStated: string;
  currency: "" | "EUR" | "USD";
} {
  return {
    name: line.product.slice(0, 120),
    reference: line.reference.slice(0, 60),
    kind: articleFamily(`${line.product}\n${line.conditions}`),
    costStated: line.statedPrice.slice(0, 80),
    currency: writtenCurrency(line.statedPrice),
  };
}
