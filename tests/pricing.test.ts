import assert from "node:assert/strict";
import test from "node:test";
import { centsFromWritten, checkAffair, formatOfferCents, quoteFromTargetMarkup } from "../src/domain/pricing.ts";

test("exemple pédagogique de la spec : 700 €, marque 30 %, remise 10 %", () => {
  const quote = quoteFromTargetMarkup({
    directCostHt: 700,
    targetMarkupRate: 0.3,
    discountRate: 0.1,
  });

  assert.equal(quote.listPriceHt, 1111.11);
  assert.equal(quote.netPriceHt, 1000);
  assert.equal(quote.directMarginHt, 300);
  assert.equal(quote.achievedMarkupRate, 0.3);
});

test("sans remise, le prix affiché est le prix net", () => {
  const quote = quoteFromTargetMarkup({
    directCostHt: 200,
    targetMarkupRate: 0.2,
    discountRate: 0,
  });

  assert.equal(quote.netPriceHt, 250);
  assert.equal(quote.listPriceHt, 250);
  assert.equal(quote.directMarginHt, 50);
});

test("refuse un taux de marque ou une remise hors intervalle", () => {
  assert.throws(() =>
    quoteFromTargetMarkup({
      directCostHt: 100,
      targetMarkupRate: 1,
      discountRate: 0,
    }),
  );
  assert.throws(() =>
    quoteFromTargetMarkup({
      directCostHt: 100,
      targetMarkupRate: 0.2,
      discountRate: 1,
    }),
  );
});

test("les trois devis d’exemple se contrôlent sans inventer un taux ni un coût", () => {
  const france = checkAffair({
    currency: "EUR",
    zone: "france",
    eurPerUsd: null,
    lines: [
      { amountCents: 9_000_000, discountRate: 0.05, costCents: null },
      { amountCents: 1_200_000, discountRate: 0, costCents: null },
      { amountCents: 1_200_000, discountRate: 0, costCents: null },
    ],
  });
  assert.equal(france.netHtCents, 10_950_000);
  assert.equal(france.vatCents, 2_190_000);
  assert.equal(france.ttcCents, 13_140_000);
  assert.equal(france.marginCents, null);
  assert.equal(france.eurCents, 10_950_000);

  const intracom = checkAffair({
    currency: "EUR",
    zone: "intracom",
    eurPerUsd: null,
    lines: [
      { amountCents: 1_850_000, discountRate: 0, costCents: null },
      { amountCents: 2_400_000, discountRate: 0, costCents: null },
      { amountCents: 1_425_000, discountRate: 0, costCents: null },
    ],
  });
  assert.equal(intracom.netHtCents, 5_675_000);
  assert.equal(intracom.vatCents, 0);
  assert.equal(intracom.ttcCents, 5_675_000);

  const exported = checkAffair({
    currency: "USD",
    zone: "export",
    eurPerUsd: null,
    lines: [
      { amountCents: 3_250_000, discountRate: 0, costCents: null },
      { amountCents: 2_400_000, discountRate: 0, costCents: null },
    ],
  });
  assert.equal(exported.netHtCents, 5_650_000);
  assert.equal(exported.vatCents, 0);
  assert.equal(exported.eurCents, null);
  assert.equal(
    checkAffair({
      currency: "USD",
      zone: "export",
      eurPerUsd: 0.92,
      lines: [{ amountCents: 10_000, discountRate: 0, costCents: 4_000 }],
    }).eurCents,
    9_200,
  );
  assert.equal(
    checkAffair({
      currency: "EUR",
      zone: "france",
      eurPerUsd: null,
      lines: [{ amountCents: 10_000, discountRate: 0, costCents: 4_000 }],
    }).marginCents,
    6_000,
  );
});

test("un montant écrit devient des centimes sans additionner deux prix", () => {
  assert.equal(centsFromWritten("0,12 € HT"), 12);
  assert.equal(centsFromWritten("1 254,30 € HT"), 125430);
  assert.equal(centsFromWritten("2.170,00 EUR"), 217000);
  assert.equal(centsFromWritten("21 109.75"), 2110975);
  assert.equal(centsFromWritten("10,00"), 1000);
  assert.equal(centsFromWritten("10.00"), 1000);
  assert.equal(centsFromWritten("10,00 € et 20,00 €"), 1000);
  assert.equal(centsFromWritten(""), null);
  assert.equal(centsFromWritten("sans montant"), null);
  assert.equal(formatOfferCents(125430, "EUR"), "1 254,30 EUR");
});
