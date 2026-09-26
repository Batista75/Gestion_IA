import assert from "node:assert/strict";
import test from "node:test";
import {
  isEmbedOnlyModel,
  isOversizedChatModel,
  pickChatModel,
  pickEmbedModel,
} from "../src/domain/agent.ts";
import { CLIENT_EXAMPLES, identifyClient, mergeKnownClient, reviseDraft } from "../src/domain/client-file.ts";
import {
  cosine,
  mentionedNames,
  rankKnowledge,
  renderKnowledge,
  understandIntent,
  uniqueNameMatch,
  type KnowledgeDoc,
} from "../src/domain/knowledge.ts";

const installed = [
  "bge-m3:latest",
  "nomic-embed-text:latest",
  "mixtral:latest",
  "qwen-dgfip-multisec-2ep:latest",
  "llama3.1:8b",
];

test("le modèle de conversation tient dans 16 Go", () => {
  assert.equal(pickChatModel(installed), "qwen-dgfip-multisec-2ep:latest");
  assert.equal(pickChatModel(installed, "mixtral:latest"), "mixtral:latest");
  assert.equal(pickEmbedModel(installed), "nomic-embed-text:latest");
  assert.equal(pickEmbedModel(["bge-m3:latest"]), null);
  assert.equal(isEmbedOnlyModel("nomic-embed-text:latest"), true);
  assert.equal(isOversizedChatModel("mixtral:latest"), true);
  assert.equal(isOversizedChatModel("qwen2.5:7b"), false);
});

test("l’intention distingue une recherche, une liste et une correction", () => {
  assert.equal(understandIntent("que sait-on de Holzwerk Müller ?"), "lookup");
  assert.equal(understandIntent("liste des clients"), "directory");
  assert.equal(understandIntent("quels clients en Allemagne"), "lookup");
  assert.equal(
    understandIntent("le téléphone de Holzwerk Müller GmbH est le +49 89 000111"),
    "change",
  );
  assert.equal(understandIntent(CLIENT_EXAMPLES[0].text), "open");
});

test("un nom déjà connu est retrouvé sans confondre deux homonymes", () => {
  const names = ["Marie Dupont", "Paul Dupont", "Holzwerk Müller GmbH"];
  assert.deepEqual(mentionedNames("que sait-on de Marie Dupont", names), ["Marie Dupont"]);
  assert.equal(uniqueNameMatch("Dupont", names), null);
  assert.equal(uniqueNameMatch("Holzwerk", names), "Holzwerk Müller GmbH");
});

test("la recherche lexicale retrouve la fiche et n’invente pas", () => {
  const docs: KnowledgeDoc[] = [
    {
      sourceType: "client",
      sourceId: "1",
      title: "Holzwerk Müller GmbH",
      summary: "Entreprise, Allemagne",
      body: "Client Holzwerk Müller GmbH\nTVA DE136695976\nAdresse Musterstraße 10",
    },
    {
      sourceType: "client",
      sourceId: "2",
      title: "Marie Dupont",
      summary: "Particulier, France",
      body: "Client Marie Dupont\nTéléphone 06 12 34 56 78",
    },
  ];
  const ranked = rankKnowledge("téléphone de Marie Dupont", docs, null);
  assert.equal(ranked[0]?.title, "Marie Dupont");
  const vector = [1, 0, 0];
  const withVectors = docs.map((doc, index) => ({
    ...doc,
    embedding: index === 1 ? [1, 0, 0] : [0, 1, 0],
  }));
  const hybrid = rankKnowledge("question", withVectors, vector);
  assert.equal(hybrid[0]?.title, "Marie Dupont");
  assert.ok(cosine([1, 0], [1, 0]) > 0.99);
  assert.match(renderKnowledge([], "lookup"), /Aucune fiche/);
});

test("une correction reprend la fiche existante", () => {
  const existing = identifyClient(CLIENT_EXAMPLES[3].text);
  assert.ok(existing);
  const revised = reviseDraft(existing, "le téléphone est le +49 89 000111");
  const merged = mergeKnownClient(existing, revised.draft);
  assert.equal(merged.vatNumber, "DE136695976");
  assert.equal(merged.address, "Musterstraße 10");
  assert.match(merged.phone, /000111/);
  assert.equal(merged.legalName, "Holzwerk Müller GmbH");
});
