import assert from "node:assert/strict";
import test from "node:test";
import { offerChanges } from "../src/domain/supplier-offer.ts";

test("une offre nouvelle garde un autre fournisseur ou un autre prix", () => {
  assert.equal(offerChanges(null, { statedCost: "", supplierName: "" }), false);
  assert.equal(offerChanges(null, { statedCost: "82,00 €", supplierName: "Helios" }), true);
  assert.equal(
    offerChanges(
      { statedCost: "87,00 €", supplierName: "Helios" },
      { statedCost: "82,00 €", supplierName: "Helios" },
    ),
    true,
  );
  assert.equal(
    offerChanges(
      { statedCost: "82,00 €", supplierName: "Helios" },
      { statedCost: "82,00 €", supplierName: "helios" },
    ),
    false,
  );
  assert.equal(
    offerChanges(
      { statedCost: "82,00 €", supplierName: "Helios" },
      { statedCost: "82,00 €", supplierName: "Nord" },
    ),
    true,
  );
});
