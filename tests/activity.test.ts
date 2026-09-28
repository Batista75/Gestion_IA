import assert from "node:assert/strict";
import test from "node:test";
import {
  activityMatches,
  eventsQuery,
  readActivityFilter,
  splitActivityTokens,
  type ActivityMatch,
} from "../src/domain/activity.ts";

const client: ActivityMatch = {
  kind: "client",
  title: "Holzwerk Müller GmbH",
  summary: "Contact : non renseigné → Anne Durand",
  actor: "A Local",
  source: "Formulaire",
  projectId: "",
  entityId: "client1",
};

const projectChange: ActivityMatch = {
  kind: "projet",
  title: "Cartes et kits",
  summary: "Statut : À qualifier → En cours",
  actor: "J Smith",
  source: "Application",
  projectId: "",
  entityId: "projet1",
};

const action: ActivityMatch = {
  kind: "action",
  title: "Cartes et kits",
  summary: "Livraison rattachée, référence BL-da68",
  actor: "Application",
  source: "Application",
  projectId: "projet1",
  entityId: "",
};

test("le filtre ignore un type inconnu et garde le texte", () => {
  const filter = readActivityFilter({ q: "  Anne ", type: "facture", projet: " projet1 ", fiche: " client1 " });
  assert.equal(filter.kind, "");
  assert.equal(filter.text, "Anne");
  assert.equal(filter.projectId, "projet1");
  assert.equal(filter.entityId, "client1");
  assert.equal(activityMatches(client, readActivityFilter({ q: "Anne", fiche: "client1" })), true);
  assert.equal(activityMatches(projectChange, readActivityFilter({ q: "Anne", fiche: "client1" })), false);
});

test("le texte ignore la casse et lit le résumé, l’auteur et la source", () => {
  const filter = readActivityFilter({ q: "formulaire" });
  assert.equal(activityMatches(client, filter), true);
  assert.equal(activityMatches(action, readActivityFilter({ q: "bl-da68" })), true);
  assert.equal(activityMatches(projectChange, readActivityFilter({ q: "anne" })), false);
});

test("un dossier ne garde que sa fiche projet et ses actions", () => {
  const filter = readActivityFilter({ type: "", projet: "projet1" });
  assert.equal(activityMatches(projectChange, filter), true);
  assert.equal(activityMatches(action, filter), true);
  assert.equal(activityMatches(client, filter), false);
  assert.equal(activityMatches(client, readActivityFilter({ type: "client", projet: "projet1" })), false);
});

test("une fiche ne montre que ses propres traces", () => {
  const filter = readActivityFilter({ fiche: "client1" });
  assert.equal(activityMatches(client, filter), true);
  assert.equal(activityMatches(action, filter), false);
  assert.equal(eventsQuery(filter), "/evenements?fiche=client1");
  assert.equal(eventsQuery(readActivityFilter({})), "/evenements");
});

test("les cases ne retiennent que des traces de fiche ou d’action", () => {
  const split = splitActivityTokens([
    "fiche:abc123",
    "action:def456",
    "fiche:abc123",
    "vente:nope",
    "fiche:",
    "  action:xyz  ",
    "fiche:avec-tiret",
  ]);
  assert.deepEqual(split.records, ["abc123"]);
  assert.deepEqual(split.actions, ["def456", "xyz"]);
});
