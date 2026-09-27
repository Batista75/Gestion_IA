export type OfferIdentity = {
  statedCost: string;
  supplierName: string;
};

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Une offre nouvelle a un fournisseur ou un prix, différent de la dernière offre de ce fournisseur. */
export function offerChanges(previous: OfferIdentity | null, next: OfferIdentity): boolean {
  const stated = next.statedCost.trim();
  const supplier = fold(next.supplierName);
  if (!stated && !supplier) return false;
  if (!previous) return true;
  return previous.statedCost.trim() !== stated || fold(previous.supplierName) !== supplier;
}
