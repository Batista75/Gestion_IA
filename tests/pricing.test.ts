import assert from "node:assert/strict";
import test from "node:test";
import { quoteFromTargetMarkup } from "../src/domain/pricing.ts";

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
