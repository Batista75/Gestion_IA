import assert from "node:assert/strict";
import test from "node:test";
import {
  contextLine,
  knownSlots,
  readHint,
  readView,
  withContext,
  type ContextSnapshot,
} from "../src/domain/context-envelope.ts";

const base: ContextSnapshot = {
  viewLabel: "Projet",
  projectId: "cm1234567890abcd",
  projectName: "Atlas",
  projectClient: "Atelier Nord",
  selectedKind: "",
  selectedLabel: "",
  attachments: ["devis_rive.pdf"],
  recent: ["mise à jour Vis à bois"],
  operator: "J Smith",
  role: "opérateur",
  allowed: ["Préparer un devis client"],
};

test("la page ouverte donne le projet et le document", () => {
  const view = readView("/projets/cm1234567890abcd/documents/cmabcdef12345678");
  assert.equal(view.label, "Document");
  assert.equal(view.projectId, "cm1234567890abcd");
  assert.equal(view.documentId, "cmabcdef12345678");
  assert.equal(readView("/").label, "Accueil");
  assert.equal(readView("/projets/cm1234567890abcd").label, "Projet");
});

test("un chemin hors page est ignoré", () => {
  assert.equal(readHint({ view: "http://evil", attachments: ["../secret"] }).view, "/");
  assert.deepEqual(readHint({ view: "/projets/cm1234567890abcd", attachments: ["devis.pdf"] }).attachments, ["devis.pdf"]);
});

test("le projet ouvert et la pièce lèvent les manques déjà connus", () => {
  const slots = knownSlots(base);
  assert.equal(slots.has("document"), true);
  assert.equal(slots.has("type"), true);
  assert.equal(slots.has("projet"), true);
  assert.equal(slots.has("client"), true);
  assert.equal(slots.has("société"), false);
  const next = withContext({ missing: ["document", "type", "société"] }, base);
  assert.deepEqual(next.missing, ["société"]);
  assert.match(contextLine(base), /Atlas/);
  assert.match(contextLine(base), /devis_rive.pdf/);
});
