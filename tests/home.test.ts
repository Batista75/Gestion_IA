import assert from "node:assert/strict";
import test from "node:test";
import { homeMoneyLabel } from "../src/domain/pricing.ts";

test("sans devis, le montant commercial reste vide", () => {
  assert.deepEqual(homeMoneyLabel([]), {
    quoted: "aucun devis",
    cost: "non indiqué",
    margin: "non indiqué",
  });
});

test("une ligne sans prix ne produit pas un total partiel", () => {
  assert.equal(
    homeMoneyLabel([
      {
        unitNetCents: null,
        unitListCents: null,
        lineCostCents: null,
        lineNetCents: null,
        lineMarginCents: null,
      },
    ]).quoted,
    "non indiqué",
  );
});
