import assert from "node:assert/strict";
import test from "node:test";
import { simulateWrite } from "../src/domain/simulation.ts";

const base = {
  action: "Enregistrer un document",
  risk: "confirmation" as const,
  ready: true,
  document: "devis_rive.pdf",
  documentType: "devis",
  project: "Atlas",
  supplier: "Durand",
  client: "",
};

test("une fiche incomplète ou une lecture ne simule pas", () => {
  assert.equal(simulateWrite({ ...base, ready: false }), "");
  assert.equal(simulateWrite({ ...base, risk: "lecture" }), "");
});

test("une action à risque décrit le résultat sans écrire ni numéroter", () => {
  const text = simulateWrite(base);
  assert.match(text, /Simulation : Enregistrer un document/);
  assert.match(text, /devis_rive.pdf/);
  assert.match(text, /Atlas/);
  assert.match(text, /Durand/);
  assert.match(text, /Aucun numéro de facture/);
  assert.match(text, /Rien n’est écrit/);
  assert.doesNotMatch(text, /\d+,\d{2}/);
});
