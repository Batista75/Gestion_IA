import assert from "node:assert/strict";
import test from "node:test";
import {
  documentKey,
  documentLabel,
  memoryApplies,
  memoryNotice,
  mergeMemory,
} from "../src/domain/document-memory.ts";

test("deux pièces ne partagent pas la même clé", () => {
  assert.equal(documentKey("Devis_Rive.PDF"), documentKey("devis_rive.pdf"));
  assert.notEqual(documentKey("devis_rive.pdf"), documentKey("autre.pdf"));
  assert.equal(documentKey("dossier/devis_rive.pdf"), "devis_rive.pdf");
  assert.equal(documentLabel({ selectedKind: "document", selectedLabel: "offre.pdf", attachments: ["autre.pdf"] }), "offre.pdf");
  assert.equal(documentLabel({ selectedKind: "", selectedLabel: "", attachments: ["devis_rive.pdf"] }), "devis_rive.pdf");
});

test("une correction reste sur la pièce et ne s’étend pas à une autre", () => {
  const first = mergeMemory(null, { document: "devis_rive.pdf", projet: "Atlas", type: "", societe: "Durand" });
  assert.ok(first);
  assert.equal(memoryApplies(first, "devis_rive.pdf"), true);
  assert.equal(memoryApplies(first, "facture_durand.pdf"), false);
  const kept = mergeMemory(first, { document: "devis_rive.pdf", projet: "", type: "devis", societe: "" });
  assert.equal(kept?.projet, "Atlas");
  assert.equal(kept?.type, "devis");
  assert.equal(kept?.societe, "Durand");
  assert.match(memoryNotice(kept!), /devis_rive.pdf/);
  assert.match(memoryNotice(kept!), /ne devient pas une règle/);
  assert.equal(mergeMemory(null, { document: "", projet: "Atlas", type: "", societe: "" }), null);
});
