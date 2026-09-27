import assert from "node:assert/strict";
import test from "node:test";
import { planNotedPiece } from "../src/domain/noted-piece.ts";
import { saleParentAllowed } from "../src/domain/sale-line.ts";

test("une livraison ou une facture se rattache à une commande, un avoir à une facture", () => {
  const delivery = planNotedPiece({
    kind: "livraison",
    reference: "  BL-12  ",
    parentKind: "commande_client",
  });
  assert.deepEqual(delivery, { kind: "livraison", reference: "BL-12" });
  const invoice = planNotedPiece({
    kind: "facture",
    reference: "F-9",
    parentKind: "livraison",
  });
  assert.deepEqual(invoice, { kind: "facture", reference: "F-9" });
  const credit = planNotedPiece({
    kind: "avoir",
    reference: "AV-1",
    parentKind: "facture",
  });
  assert.deepEqual(credit, { kind: "avoir", reference: "AV-1" });
});

test("une facture n’est pas émise depuis un devis, et une référence vide est refusée", () => {
  assert.equal("error" in planNotedPiece({ kind: "facture", reference: "F-1", parentKind: "devis" }), true);
  assert.equal("error" in planNotedPiece({ kind: "avoir", reference: "AV-1", parentKind: "commande_client" }), true);
  assert.equal("error" in planNotedPiece({ kind: "livraison", reference: " ", parentKind: "commande_client" }), true);
  assert.equal(saleParentAllowed("commande_client", "facture"), false);
});
