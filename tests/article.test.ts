import assert from "node:assert/strict";
import test from "node:test";
import { articleFamily, articleFromQuoteLine, shownUnitCost, writtenCurrency } from "../src/domain/article.ts";

test("une prestation est un service, une vis reste un produit", () => {
  assert.equal(articleFamily("Prestation d’installation"), "service");
  assert.equal(articleFamily("Vis à bois"), "produit");
});

test("la devise n’est retenue que si elle est écrite", () => {
  assert.equal(writtenCurrency("0,12 € HT"), "EUR");
  assert.equal(writtenCurrency("12.00 USD"), "USD");
  assert.equal(writtenCurrency("100"), "");
});

test("une ligne de devis devient un article avec son coût écrit", () => {
  assert.deepEqual(
    articleFromQuoteLine({
      product: "Prestation de formation",
      reference: "SRV-1",
      statedPrice: "450,00 EUR",
      conditions: "une journée",
    }),
    {
      name: "Prestation de formation",
      reference: "SRV-1",
      kind: "service",
      costStated: "450,00 EUR",
      currency: "EUR",
    },
  );
  assert.equal(shownUnitCost("", ["0,12 € HT"]), "0,12 € HT");
});
