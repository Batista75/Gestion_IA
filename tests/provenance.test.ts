import assert from "node:assert/strict";
import test from "node:test";
import { confidenceLabel, copiedFields, provenanceLabel, readProvenance } from "../src/domain/provenance.ts";

test("un champ recopié a une confiance de 1, sans additionner les montants", () => {
  const fields = copiedFields([
    { label: "Total HT", value: "10,00 € et 20,00 €" },
    { label: "Vide", value: "  " },
  ]);
  assert.deepEqual(fields, [{ field: "Total HT", confidence: 1 }]);
  assert.equal(confidenceLabel(1), "100 %");
});

test("une confiance hors de 0 à 1 est refusée", () => {
  const refused = readProvenance({
    modelVersion: "lecture",
    fields: [{ field: "Total HT", confidence: 1.2 }],
  });
  assert.equal("error" in refused, true);
});

test("la version vide est refusée, les origines connues ont un libellé", () => {
  assert.equal("error" in readProvenance({ modelVersion: " ", fields: [] }), true);
  assert.equal(provenanceLabel("lecture"), "Lecture de la pièce");
  assert.equal(provenanceLabel("regle"), "Règle, sans modèle");
  assert.equal(provenanceLabel("qwen2.5"), "qwen2.5");
});
