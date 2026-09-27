import assert from "node:assert/strict";
import test from "node:test";
import { absentReply, decideFree, intentCatalog } from "../src/domain/intent-catalog.ts";
import { asksHybridQuote } from "../src/domain/hybrid-quote.ts";
import { parseCatalogCommand } from "../src/domain/catalog.ts";

test("le catalogue est fermé et couvre les sept intentions de la cible", () => {
  const ids = intentCatalog.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of [
    "register_document",
    "assign_project",
    "prepare_customer_quote",
    "update_cost",
    "register_order",
    "match_payment",
    "answer_question",
  ]) {
    assert.equal(ids.includes(id as (typeof ids)[number]), true);
  }
  assert.equal(intentCatalog.find((row) => row.id === "prepare_customer_quote")?.execution, "regle");
  assert.equal(intentCatalog.some((row) => row.execution === "regle" && row.id === "answer_question"), false);
});

test("les phrases déjà reconnues restent des règles du socle", () => {
  assert.equal(asksHybridQuote("prépare un devis pour Marie Dupont, 2 charnières"), true);
  assert.equal(parseCatalogCommand("ajouter un fournisseur Quincaillerie Durand")?.type, "create_supplier");
});

test("une demande hors exécution ne part pas en écriture", () => {
  const saved = decideFree("Enregistre ça");
  assert.equal(saved.id, "register_document");
  assert.equal(saved.execution, "absente");
  assert.deepEqual(saved.missing, ["document", "type", "société"]);
  assert.match(absentReply(saved), /Rien n’est écrit/);

  const unknown = decideFree("numérote une facture pour ce dossier");
  assert.equal(unknown.id, null);
  assert.equal(unknown.execution, "absente");
  assert.match(absentReply(unknown), /Aucune action du catalogue/);
});

test("une question libre reste une lecture", () => {
  const decision = decideFree("comment créer un devis");
  assert.equal(decision.id, "answer_question");
  assert.equal(decision.execution, "recherche");
});
