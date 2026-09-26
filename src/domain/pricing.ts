export type PricingInput = {
  directCostHt: number;
  targetMarkupRate: number;
  discountRate: number;
};

export type PricingResult = {
  listPriceHt: number;
  netPriceHt: number;
  directMarginHt: number;
  achievedMarkupRate: number;
};

export function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertOpenUnitInterval(label: string, value: number) {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error(
      `${label} doit être compris entre 0 et 1, strictement inférieur à 1.`,
    );
  }
}

/**
 * Taux de marque sur le prix net HT : (prix net HT − coût direct HT) / prix net HT.
 * prix net cible = C / (1 − m)
 * prix affiché avant remise = C / [(1 − m) × (1 − d)]
 */
export function quoteFromTargetMarkup(input: PricingInput): PricingResult {
  if (!Number.isFinite(input.directCostHt) || input.directCostHt < 0) {
    throw new Error("Le coût direct HT doit être un montant positif ou nul.");
  }
  assertOpenUnitInterval("Le taux de marque", input.targetMarkupRate);
  assertOpenUnitInterval("La remise", input.discountRate);

  const netPriceHt = roundCents(
    input.directCostHt / (1 - input.targetMarkupRate),
  );
  const listPriceHt = roundCents(
    input.directCostHt /
      ((1 - input.targetMarkupRate) * (1 - input.discountRate)),
  );
  const directMarginHt = roundCents(netPriceHt - input.directCostHt);
  const achievedMarkupRate =
    netPriceHt === 0 ? 0 : directMarginHt / netPriceHt;

  return {
    listPriceHt,
    netPriceHt,
    directMarginHt,
    achievedMarkupRate,
  };
}
