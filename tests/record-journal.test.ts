import assert from "node:assert/strict";
import test from "node:test";
import { CLIENT_FIELD_LABELS, fieldChangeSummary } from "../src/domain/record-journal.ts";

test("le résumé ne garde que les champs qui changent", () => {
  const before = {
    name: "Holzwerk Müller GmbH",
    country: "Allemagne",
    contactName: "",
    contactRole: "",
    notes: "Livraison habituelle le jeudi.",
  };
  const after = {
    ...before,
    contactName: "Anne Durand",
    contactRole: "directrice commerciale",
    notes: "Livraison habituelle le jeudi. livraison le mardi",
  };
  const summary = fieldChangeSummary(before, after, CLIENT_FIELD_LABELS);
  assert.match(summary, /Contact : non renseigné → Anne Durand/);
  assert.match(summary, /Fonction : non renseigné → directrice commerciale/);
  assert.match(summary, /Notes :/);
  assert.doesNotMatch(summary, /Pays/);
  assert.equal(
    fieldChangeSummary(before, before, CLIENT_FIELD_LABELS),
    "",
  );
  assert.match(
    fieldChangeSummary({ phone: "+49 89 123456" }, { phone: "" }, { phone: "Téléphone" }),
    /Téléphone : \+49 89 123456 → retiré/,
  );
});
