import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCents,
  readCostCents,
  saleLineFigures,
  saleOperationTotals,
} from "../src/domain/pricing.ts";
import { assignSuppliers, saleParentAllowed } from "../src/domain/sale-line.ts";

test("le prix de vente et la marge suivent la règle du coût", () => {
  const line = saleLineFigures({
    quantity: 1,
    costCents: 70000,
    markupPercent: 30,
    discountPercent: 10,
  });
  assert.equal(line.unitNetCents, 100000);
  assert.equal(line.unitListCents, 111111);
  assert.equal(line.lineMarginCents, 30000);
  const doubled = saleLineFigures({
    quantity: 2,
    costCents: 70000,
    markupPercent: 30,
    discountPercent: 0,
  });
  assert.equal(doubled.lineCostCents, 140000);
  assert.equal(doubled.lineNetCents, 200000);
  assert.equal(doubled.lineMarginCents, 60000);
});

test("sans coût, le prix de vente reste non indiqué", () => {
  const line = saleLineFigures({
    quantity: 1,
    costCents: null,
    markupPercent: 30,
    discountPercent: 0,
  });
  assert.equal(line.lineNetCents, null);
  assert.equal(line.lineMarginCents, null);
  assert.match(formatCents(null), /non indiqué/);
  const totals = saleOperationTotals([line, saleLineFigures({
    quantity: 1,
    costCents: 10000,
    markupPercent: 0,
    discountPercent: 0,
  })]);
  assert.equal(totals.missing, 1);
  assert.equal(totals.netCents, 10000);
});

test("un montant et une commande fournisseur se lisent sans inventer", () => {
  assert.equal(readCostCents("700"), 70000);
  assert.equal(readCostCents(""), null);
  assert.throws(() => saleLineFigures({
    quantity: 1,
    costCents: 10000,
    markupPercent: 100,
    discountPercent: 0,
  }));
  const assigned = assignSuppliers(
    [
      { supplierName: "Helios", name: "Vis" },
      { supplierName: "", name: "Pose" },
      { supplierName: "Helios", name: "Cheville" },
    ],
    "Atelier Nord",
  );
  assert.equal(assigned.missing.length, 0);
  assert.equal(assigned.groups.length, 2);
  assert.equal(assigned.groups.find((group) => group.supplierName === "Helios")?.lines.length, 2);
});

test("une pièce ne suit que son parent prévu, et jamais une facture", () => {
  assert.equal(saleParentAllowed("devis", "commande_client"), true);
  assert.equal(saleParentAllowed("commande_client", "commande_fournisseur"), true);
  assert.equal(saleParentAllowed("devis", "commande_fournisseur"), false);
  assert.equal(saleParentAllowed("commande_client", "facture"), false);
  assert.equal(saleParentAllowed("devis", "devis"), false);
});
