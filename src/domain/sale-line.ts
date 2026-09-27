export type SaleKind = "devis" | "commande_client" | "commande_fournisseur";
export type SaleStatus = "en_cours" | "non_abouti" | "transforme";

export function assignSuppliers<T extends { supplierName: string }>(
  lines: T[],
  fallback: string,
): { groups: Array<{ supplierName: string; lines: T[] }>; missing: T[] } {
  const fallbackName = fallback.trim().replace(/\s+/g, " ");
  const missing: T[] = [];
  const grouped = new Map<string, T[]>();
  for (const line of lines) {
    const name = line.supplierName.trim() || fallbackName;
    if (name.length < 2) {
      missing.push(line);
      continue;
    }
    const bucket = grouped.get(name) ?? [];
    bucket.push(line);
    grouped.set(name, bucket);
  }
  return {
    groups: [...grouped.entries()].map(([supplierName, rows]) => ({ supplierName, lines: rows })),
    missing,
  };
}

/** Une commande client suit un devis. Une commande fournisseur suit une commande client. Pas de facture. */
export function saleParentAllowed(parentKind: string, childKind: string): boolean {
  if (childKind === "commande_client") return parentKind === "devis";
  if (childKind === "commande_fournisseur") return parentKind === "commande_client";
  return false;
}

export function saleKindLabel(kind: string): string {
  if (kind === "commande_client") return "Commande client";
  if (kind === "commande_fournisseur") return "Commande fournisseur";
  return "Devis";
}

export function saleStatusLabel(status: string): string {
  if (status === "brouillon") return "Brouillon";
  if (status === "non_abouti") return "Non abouti";
  if (status === "transforme") return "Commande établie";
  return "En cours";
}
