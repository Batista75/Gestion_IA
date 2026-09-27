import assert from "node:assert/strict";
import test from "node:test";
import { compareOffers, offerChanges } from "../src/domain/supplier-offer.ts";

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

test("la comparaison retient le plus petit nombre de centimes, sans les additionner", () => {
  const compared = compareOffers([
    { id: "haut", supplierName: "Nord", statedCost: "20,00 €", unitCostCents: 2000 },
    { id: "bas", supplierName: "Helios", statedCost: "10,00 € et 5,00 €", unitCostCents: 1000 },
    { id: "illisible", supplierName: "Sud", statedCost: "sur devis", unitCostCents: null },
  ]);
  assert.deepEqual(compared.rows.map((row) => row.id), ["bas", "haut", "illisible"]);
  assert.deepEqual(
    compared.rows.filter((row) => row.lowest).map((row) => row.id),
    ["bas"],
  );
  assert.equal(compared.rows.reduce((sum, row) => sum + (row.unitCostCents ?? 0), 0), 3000);
  assert.equal(compared.rows.find((row) => row.lowest)?.unitCostCents, 1000);
});

test("deux offres au même prix sont toutes les deux les plus basses", () => {
  const compared = compareOffers([
    { id: "a", supplierName: "Nord", statedCost: "10,00 €", unitCostCents: 1000 },
    { id: "b", supplierName: "Helios", statedCost: "10,00 EUR", unitCostCents: 1000 },
  ]);
  assert.equal(compared.rows.filter((row) => row.lowest).length, 2);
});
