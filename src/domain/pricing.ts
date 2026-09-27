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

/** Premier montant écrit, en centimes. Les groupes de milliers sont lus, rien n’est additionné. */
export function centsFromWritten(raw: string): number | null {
  const text = raw.replace(/\u00a0/g, " ").trim();
  const token = text.match(/\d{1,3}(?:[ .]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/);
  if (!token) return null;
  let value = token[0].replace(/ /g, "");
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    value = lastComma > lastDot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const fraction = value.length - lastComma - 1;
    value = fraction === 3 ? value.replace(/,/g, "") : value.replace(",", ".");
  } else if (lastDot >= 0) {
    const parts = value.split(".");
    const tail = parts[parts.length - 1] ?? "";
    value = tail.length === 3 ? parts.join("") : `${parts.slice(0, -1).join("")}.${tail}`;
  }
  const [whole, fraction = ""] = value.split(".");
  if (!whole || !/^\d+$/.test(whole) || (fraction !== "" && !/^\d{1,2}$/.test(fraction))) return null;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Le texte écrit reste visible. Les centimes sont ceux du premier montant, jamais une somme. */
export function writtenAmountLabel(written: string, cents: number | null, currency = ""): string {
  const text = written.trim();
  if (!text) return "non indiqué";
  if (cents === null) return text;
  return `${text} · ${formatOfferCents(cents, currency)}`;
}

export function formatOfferCents(cents: number, currency = ""): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(Math.trunc(cents));
  const whole = Math.floor(absolute / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}${whole},${fraction}${currency ? ` ${currency}` : ""}`;
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

const euroFormat = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export type SaleLineDraft = {
  quantity: number;
  costCents: number | null;
  markupPercent: number;
  discountPercent: number;
};

export type SaleLineFigures = {
  unitNetCents: number | null;
  unitListCents: number | null;
  lineCostCents: number | null;
  lineNetCents: number | null;
  lineMarginCents: number | null;
};

export function catalogUnitCents(catalogCents: number, discountPercent: number): number {
  if (!Number.isInteger(catalogCents) || catalogCents < 0) {
    throw new Error("Le prix catalogue HT doit être un montant en centimes, positif ou nul.");
  }
  if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 99) {
    throw new Error("La remise négociée doit être un entier entre 0 et 99.");
  }
  return Math.round((catalogCents * (100 - discountPercent)) / 100);
}

export function figuresFromSaleUnit(
  quantity: number,
  saleUnitCents: number,
  costCents: number | null,
): SaleLineFigures {
  const count = readSaleQuantity(String(quantity));
  if (!Number.isInteger(saleUnitCents) || saleUnitCents < 0) {
    throw new Error("Le prix unitaire HT doit être un montant en centimes, positif ou nul.");
  }
  const lineNetCents = saleUnitCents * count;
  const lineCostCents = costCents === null ? null : costCents * count;
  return {
    unitNetCents: saleUnitCents,
    unitListCents: saleUnitCents,
    lineCostCents,
    lineNetCents,
    lineMarginCents: lineCostCents === null ? null : lineNetCents - lineCostCents,
  };
}

export function storedSaleFigures(input: SaleLineDraft & { saleUnitCents?: number | null }): SaleLineFigures {
  if (typeof input.saleUnitCents === "number") {
    return figuresFromSaleUnit(input.quantity, input.saleUnitCents, input.costCents);
  }
  return saleLineFigures(input);
}

export function saleLineFigures(input: SaleLineDraft): SaleLineFigures {
  const quantity = readSaleQuantity(String(input.quantity));
  const markupPercent = readSalePercent(String(input.markupPercent), "Le taux de marque");
  const discountPercent = readSalePercent(String(input.discountPercent), "La remise");
  if (input.costCents === null) {
    return {
      unitNetCents: null,
      unitListCents: null,
      lineCostCents: null,
      lineNetCents: null,
      lineMarginCents: null,
    };
  }
  if (!Number.isInteger(input.costCents) || input.costCents < 0) {
    throw new Error("Le coût HT doit être un montant en centimes, positif ou nul.");
  }
  const quote = quoteFromTargetMarkup({
    directCostHt: input.costCents / 100,
    targetMarkupRate: markupPercent / 100,
    discountRate: discountPercent / 100,
  });
  const unitNetCents = Math.round(quote.netPriceHt * 100);
  const unitListCents = Math.round(quote.listPriceHt * 100);
  const lineNetCents = unitNetCents * quantity;
  const lineCostCents = input.costCents * quantity;
  return {
    unitNetCents,
    unitListCents,
    lineCostCents,
    lineNetCents,
    lineMarginCents: lineNetCents - lineCostCents,
  };
}

export function saleOperationTotals(lines: SaleLineFigures[]): {
  costCents: number;
  netCents: number;
  marginCents: number;
  missing: number;
} {
  const priced = lines.filter((line) => line.lineNetCents !== null && line.lineCostCents !== null);
  return {
    costCents: priced.reduce((sum, line) => sum + (line.lineCostCents ?? 0), 0),
    netCents: priced.reduce((sum, line) => sum + (line.lineNetCents ?? 0), 0),
    marginCents: priced.reduce((sum, line) => sum + (line.lineMarginCents ?? 0), 0),
    missing: lines.length - priced.length,
  };
}

export function homeMoneyLabel(lines: SaleLineFigures[]): {
  quoted: string;
  cost: string;
  margin: string;
} {
  if (lines.length === 0) {
    return { quoted: "aucun devis", cost: "non indiqué", margin: "non indiqué" };
  }
  if (lines.some((line) => line.lineNetCents === null)) {
    return { quoted: "non indiqué", cost: "non indiqué", margin: "non indiqué" };
  }
  const net = lines.reduce((sum, line) => sum + (line.lineNetCents ?? 0), 0);
  if (lines.some((line) => line.lineCostCents === null)) {
    return { quoted: formatCents(net), cost: "non indiqué", margin: "non indiqué" };
  }
  const cost = lines.reduce((sum, line) => sum + (line.lineCostCents ?? 0), 0);
  return { quoted: formatCents(net), cost: formatCents(cost), margin: formatCents(net - cost) };
}

export function formatCents(cents: number | null): string {
  if (cents === null) return "non indiqué";
  return euroFormat.format(cents / 100);
}

export function centsInput(cents: number | null): string {
  if (cents === null) return "";
  const euros = cents / 100;
  return Number.isInteger(euros) ? String(euros) : euros.toFixed(2).replace(".", ",");
}

export function readSaleQuantity(raw: string): number {
  const trimmed = raw.trim();
  if (!/^\d{1,4}$/.test(trimmed)) {
    throw new Error("La quantité est un entier entre 1 et 9999.");
  }
  const value = Number(trimmed);
  if (value < 1) throw new Error("La quantité est un entier entre 1 et 9999.");
  return value;
}

export function readSalePercent(raw: string, label: string): number {
  const trimmed = raw.trim().replace("%", "");
  if (!/^\d{1,2}$/.test(trimmed)) {
    throw new Error(`${label} est un entier entre 0 et 99.`);
  }
  return Number(trimmed);
}

export function readCostCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cents = centsFromStated(trimmed);
  if (cents === null || cents < 0) {
    throw new Error("Le coût HT n’est pas un montant lisible.");
  }
  return cents;
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
