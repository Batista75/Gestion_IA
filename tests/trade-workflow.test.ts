import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  TRADE_RULES,
  TRADE_STEPS,
  advanceWarning,
  asksTradeWorkflow,
  assertProof,
  nextTradeStep,
  projectTradeReply,
  tradeRuleReply,
} from "../src/domain/trade-workflow.ts";

const instruction = readFileSync(
  path.join(process.cwd(), "instructions/metiers/achat-revente-technologies.md"),
  "utf8",
);

test("le fichier d’instruction reprend chaque étape et chaque règle", () => {
  for (const step of TRADE_STEPS) {
    assert.ok(instruction.includes(step.title), step.title);
    assert.ok(instruction.includes(step.action), step.action);
    assert.ok(instruction.includes(step.proof), step.proof);
  }
  for (const rule of TRADE_RULES) {
    assert.ok(instruction.includes(rule), rule);
  }
});

test("la prochaine étape suit les preuves enregistrées", () => {
  assert.equal(nextTradeStep([]).key, "demande");
  assert.equal(
    nextTradeStep([{ key: "demande", status: "fait", proofRef: "RFQ-12", proofNote: "" }]).key,
    "offre",
  );
});

test("une étape faite exige une référence, la facture attend une livraison ou une réception", () => {
  assert.throws(() => assertProof("fait", ""), /référence/);
  assert.doesNotThrow(() => assertProof("fait", "RFQ-12"));
  assert.notEqual(advanceWarning("facturation", []), "");
  assert.equal(
    advanceWarning("facturation", [
      { key: "livraison", status: "fait", proofRef: "BL-1", proofNote: "" },
    ]),
    "",
  );
});

test("une question de parcours se reconnaît, une liste de clients non", () => {
  assert.equal(asksTradeWorkflow("prochaine étape du projet Cartes et kits"), true);
  assert.equal(asksTradeWorkflow("liste des clients"), false);
  const reply = projectTradeReply("Cartes et kits", []);
  assert.match(reply, /Chiffrage|Réception de la demande/);
  assert.match(reply, /RFQ/);
  const invoice = tradeRuleReply("puis-je facturer");
  assert.match(invoice, /bon de livraison|procès-verbal/i);
  assert.match(invoice, /ne lui donne pas de numéro/);
});
