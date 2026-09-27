import assert from "node:assert/strict";
import test from "node:test";
import { intentCatalog } from "../src/domain/intent-catalog.ts";
import {
  interpretationLine,
  interpreterEffect,
  interpreterGuide,
  interpreterIntents,
  parseInterpretation,
  plainQuestion,
} from "../src/domain/interpreter.ts";

test("l’interpréteur n’accepte que les intentions du catalogue", () => {
  assert.deepEqual(new Set(interpreterIntents), new Set(intentCatalog.map((row) => row.id)));
  assert.match(interpreterGuide(), /Ne lance aucune action/);
  assert.match(interpreterGuide(), /aucun montant/);
});

test("une question explicite est une lecture, sans appel au modèle", () => {
  const question = plainQuestion("Comment classe-t-on un devis ?");
  assert.equal(question?.intent, "answer_question");
  assert.equal(question ? interpreterEffect(question) : "", "lire");
  assert.equal(plainQuestion("range ce devis"), null);
});

test("le JSON est refusé s’il sort du schéma ou s’il demande une exécution", () => {
  const accepted = parseInterpretation(
    '{"intent":"register_document","targets":["devis_rive.pdf"],"missing":["société"],"hypotheses":[{"field":"projet","value":"Atlas","reason":"page ouverte"}],"confidence":{"projet":0.7}}',
  );
  assert.equal(accepted?.intent, "register_document");
  assert.equal(accepted ? interpreterEffect(accepted) : "", "ecrire");
  assert.match(interpretationLine(accepted!), /Rien n’est exécuté/);
  assert.match(interpretationLine(accepted!), /Atlas/);
  assert.equal(parseInterpretation('{"intent":"inventer","targets":[]}'), null);
  assert.equal(parseInterpretation('{"intent":"register_document","execute":true}'), null);
  assert.equal(parseInterpretation('{"intent":"register_document","confidence":{"montant":2}}'), null);
});
