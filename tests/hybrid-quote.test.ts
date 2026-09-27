import assert from "node:assert/strict";
import test from "node:test";
import { catalogUnitCents } from "../src/domain/pricing.ts";
import {
  asksHybridQuote,
  discountConflict,
  negotiatedDiscount,
  quotedItems,
} from "../src/domain/hybrid-quote.ts";

test("une demande de devis se reconnaît, une consultation non", () => {
  assert.equal(asksHybridQuote("prépare un devis pour Marie Dupont, 2 charnières"), true);
  assert.equal(asksHybridQuote("que sait-on de Marie Dupont"), false);
});

test("la remise négociée est unique, sinon elle n’est pas appliquée", () => {
  assert.equal(negotiatedDiscount("Remise négociée de 10 % sur le matériel."), 10);
  assert.equal(negotiatedDiscount("Pas de condition particulière."), null);
  assert.equal(discountConflict("Remise de 10 % et remise de 5 %."), true);
  assert.equal(negotiatedDiscount("Remise de 10 % et remise de 5 %."), null);
});

test("le prix catalogue moins la remise ne passe pas par le modèle", () => {
  assert.equal(catalogUnitCents(10000, 10), 9000);
  assert.equal(catalogUnitCents(10000, 0), 10000);
});

test("la quantité écrite devant le produit est reprise", () => {
  const items = quotedItems("prépare un devis pour Marie, 2 charnières et vis à bois", [
    { name: "Charnière", reference: "CH-1" },
    { name: "Vis à bois", reference: "VIS-01" },
  ]);
  assert.deepEqual(items, [
    { name: "Charnière", reference: "CH-1", quantity: 2 },
    { name: "Vis à bois", reference: "VIS-01", quantity: 1 },
  ]);
});
