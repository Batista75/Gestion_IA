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

export type ComparableOffer = {
  id: string;
  supplierName: string;
  statedCost: string;
  unitCostCents: number | null;
};

export type ComparedOffer = ComparableOffer & { lowest: boolean };

/** Classe les offres par centimes déjà lus. Un prix illisible reste visible, sans rang. Rien n’est additionné. */
export function compareOffers(offers: ComparableOffer[]): { rows: ComparedOffer[]; note: string } {
  const priced = offers.filter((offer) => offer.unitCostCents !== null);
  const lowest = priced.length === 0 ? null : Math.min(...priced.map((offer) => offer.unitCostCents ?? 0));
  const rows = [...offers]
    .sort((left, right) => {
      if (left.unitCostCents === null && right.unitCostCents === null) return 0;
      if (left.unitCostCents === null) return 1;
      if (right.unitCostCents === null) return -1;
      return left.unitCostCents - right.unitCostCents;
    })
    .map((offer) => ({ ...offer, lowest: lowest !== null && offer.unitCostCents === lowest }));
  if (offers.length === 0) return { rows, note: "Aucune offre à comparer." };
  if (priced.length === 0) return { rows, note: "Aucun prix écrit n’a pu être lu. La comparaison ne recalcule rien." };
  if (priced.length === 1) return { rows, note: "Une seule offre a un prix lisible. Les autres restent hors classement." };
  const tied = rows.filter((offer) => offer.lowest).length;
  if (tied > 1) return { rows, note: "Plusieurs offres ont le même prix le plus bas. Le texte écrit n’est pas modifié." };
  return { rows, note: "Le prix le plus bas est le plus petit nombre de centimes déjà lu. Aucune somme n’est faite." };
}

/** Une offre nouvelle a un fournisseur ou un prix, différent de la dernière offre de ce fournisseur. */
export function offerChanges(previous: OfferIdentity | null, next: OfferIdentity): boolean {
  const stated = next.statedCost.trim();
  const supplier = fold(next.supplierName);
  if (!stated && !supplier) return false;
  if (!previous) return true;
  return previous.statedCost.trim() !== stated || fold(previous.supplierName) !== supplier;
}
