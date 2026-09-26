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

export type MoneyCurrency = "EUR" | "USD";
export type VatZone = "france" | "intracom" | "export";

export function centsFromStated(raw: string): number | null {
  const cleaned = raw.replace(/\u00a0/g, " ").trim();
  const match = cleaned.match(/(\d{1,3}(?: \d{3})+|\d+)(?:[,.](\d{1,2}))?/);
  if (!match) return null;
  const whole = (match[1] ?? "").replace(/ /g, "");
  const fraction = (match[2] ?? "0").padEnd(2, "0").slice(0, 2);
  const cents = Number(whole) * 100 + Number(fraction);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function currencyOf(raw: string): MoneyCurrency {
  return /\$|\busd\b/i.test(raw) ? "USD" : "EUR";
}

export function vatRule(zone: VatZone): { rate: number; mention: string } {
  if (zone === "intracom") {
    return {
      rate: 0,
      mention: "Auto-liquidation TVA, article 262 ter I du CGI.",
    };
  }
  if (zone === "export") {
    return {
      rate: 0,
      mention: "Exonération à l’export hors Union européenne.",
    };
  }
  return { rate: 0.2, mention: "TVA au taux français de 20 %." };
}

export function convertToEur(
  cents: number,
  currency: MoneyCurrency,
  eurPerUsd: number | null,
): number | null {
  if (currency === "EUR") return cents;
  if (eurPerUsd === null || !Number.isFinite(eurPerUsd) || eurPerUsd <= 0) return null;
  return Math.round(cents * eurPerUsd);
}

export function grossMarginCents(
  saleHtCents: number,
  costHtCents: number,
): { marginCents: number; rate: number } {
  const marginCents = saleHtCents - costHtCents;
  const rate = saleHtCents === 0 ? 0 : marginCents / saleHtCents;
  return { marginCents, rate };
}

export type AffairLine = {
  amountCents: number;
  discountRate: number;
  costCents: number | null;
};

export type AffairCheck = {
  netHtCents: number;
  vatCents: number;
  ttcCents: number;
  marginCents: number | null;
  eurCents: number | null;
};

export function checkAffair(input: {
  lines: AffairLine[];
  zone: VatZone;
  currency: MoneyCurrency;
  eurPerUsd: number | null;
}): AffairCheck {
  const netHtCents = input.lines.reduce((sum, line) => {
    const discount = Math.round(line.amountCents * line.discountRate);
    return sum + (line.amountCents - discount);
  }, 0);
  const vat = vatRule(input.zone);
  const tax = Math.round(netHtCents * vat.rate);
  const costs = input.lines.map((line) => line.costCents);
  const margin =
    costs.every((cost) => cost !== null)
      ? grossMarginCents(
          netHtCents,
          costs.reduce((sum, cost) => sum + (cost ?? 0), 0),
        ).marginCents
      : null;
  return {
    netHtCents,
    vatCents: tax,
    ttcCents: netHtCents + tax,
    marginCents: margin,
    eurCents: convertToEur(netHtCents, input.currency, input.eurPerUsd),
  };
}
