import assert from "node:assert/strict";
import test from "node:test";
import {
  blockingQuestion,
  fieldThresholds,
  readCardCorrection,
  readUnderstanding,
  understandingCard,
} from "../src/domain/completeness.ts";

const empty = {
  text: "",
  projectName: "",
  projectClient: "",
  attachments: [] as string[],
  selectedLabel: "",
  selectedKind: "",
  projectChoices: [] as string[],
};

test("les seuils suivent la criticité, sans score global", () => {
  assert.equal(fieldThresholds.type, 0.85);
  assert.equal(fieldThresholds.projet, 0.9);
  assert.equal(fieldThresholds.client, 1);
  assert.equal(fieldThresholds.montant, 1);
  assert.equal(fieldThresholds.tva, 1);
});

test("une demande incomplète pose une seule question, la première qui bloque", () => {
  const question = blockingQuestion({
    ...empty,
    required: ["document", "type", "société"],
    text: "Enregistre ça",
  });
  assert.equal(question?.kind, "valeur");
  assert.equal(question?.field, "document");
  assert.match(question?.text ?? "", /Quel document/);
  assert.doesNotMatch(question?.text ?? "", /société/);
});

test("la pièce et le projet ouvert laissent la société comme seule question", () => {
  const question = blockingQuestion({
    ...empty,
    required: ["document", "type", "société"],
    text: "Enregistre ça",
    projectName: "Atlas",
    attachments: ["devis_rive.pdf"],
  });
  assert.equal(question?.field, "société");
  assert.equal(question?.kind, "valeur");
});

test("deux projets donnent un choix fermé", () => {
  const question = blockingQuestion({
    ...empty,
    required: ["document", "projet"],
    text: "rattache ce devis",
    attachments: ["devis_rive.pdf"],
    projectChoices: ["Renouvellement réseau Atlas", "Audit réseau Atlas"],
  });
  assert.equal(question?.kind, "choix");
  assert.match(question?.text ?? "", /Renouvellement réseau Atlas/);
  assert.match(question?.text ?? "", /Audit réseau Atlas/);
});

test("un projet seulement cité demande confirmation", () => {
  const question = blockingQuestion({
    ...empty,
    required: ["projet"],
    text: "rattache au projet",
    projectChoices: ["Atlas"],
  });
  assert.equal(question?.kind, "confirmation");
  assert.match(question?.text ?? "", /Atlas/);
});

test("la fiche dit ce qui est compris et le seul point à confirmer", () => {
  const card = understandingCard({
    ...empty,
    action: "Enregistrer un document",
    required: ["document", "type", "société"],
    text: "Enregistre ça",
    projectName: "Atlas",
    attachments: ["devis_rive.pdf"],
    projectOptions: ["Atlas", "Horizon"],
  });
  assert.match(card.understood.join(" "), /devis_rive.pdf/);
  assert.match(card.understood.join(" "), /devis/);
  assert.match(card.understood.join(" "), /Atlas/);
  assert.equal(card.confirm.includes("société"), true);
  assert.equal(card.project, "Atlas");
  assert.equal(card.documentType, "devis");
});

test("une correction de la fiche lève le champ choisi", () => {
  const card = understandingCard({
    ...empty,
    action: "Enregistrer un document",
    required: ["document", "type", "société"],
    text: "Enregistre ça",
    projectName: "Atlas",
    attachments: ["devis_rive.pdf"],
    overrides: { projet: "", type: "", société: "Durand" },
  });
  assert.equal(card.confirm, "");
  assert.match(card.understood.join(" "), /Durand/);
  assert.equal(card.supplier, "Durand");
});

test("la ligne Fiche ne réécrit pas la demande", () => {
  const correction = readCardCorrection("Fiche : projet Atlas, type devis, fournisseur Durand");
  assert.deepEqual(correction, { projet: "Atlas", type: "devis", société: "Durand" });
  assert.equal(readCardCorrection("Enregistre ça"), null);
  const restored = readUnderstanding({ understanding: { action: "Enregistrer un document", understood: ["Le projet retenu est Atlas."] } });
  assert.equal(restored?.action, "Enregistrer un document");
  assert.equal(restored?.understood[0], "Le projet retenu est Atlas.");
});

test("le client facturé est confirmé même s’il est celui du projet ouvert", () => {
  const question = blockingQuestion({
    ...empty,
    required: ["client"],
    text: "enregistre la commande",
    projectName: "Atlas",
    projectClient: "Atelier Nord",
  });
  assert.equal(question?.kind, "confirmation");
  assert.match(question?.text ?? "", /Atelier Nord/);
});
