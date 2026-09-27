import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanAnswer,
  nextOverrides,
  pathLine,
  readStoredTask,
  resumeKind,
  taskSteps,
} from "../src/domain/task-path.ts";

const empty = { projet: "", type: "", societe: "" };

test("une fiche incomplète suspend les champs et laisse l’écriture en attente", () => {
  const steps = taskSteps({ ready: false, simulated: false });
  assert.equal(steps.find((step) => step.id === "champs")?.state, "suspendue");
  assert.equal(steps.find((step) => step.id === "simulation")?.state, "en_attente");
  assert.equal(steps.find((step) => step.id === "ecriture")?.state, "en_attente");
  assert.match(pathLine(steps), /Écriture en attente/);
});

test("une fiche complète simule sans terminer l’écriture", () => {
  const steps = taskSteps({ ready: true, simulated: true });
  assert.equal(steps.find((step) => step.id === "champs")?.state, "terminee");
  assert.equal(steps.find((step) => step.id === "simulation")?.state, "terminee");
  assert.equal(steps.find((step) => step.id === "ecriture")?.state, "en_attente");
});

test("une réponse courte reprend, une commande ou une question non", () => {
  assert.equal(resumeKind("Durand"), "valeur");
  assert.equal(resumeKind("oui"), "oui");
  assert.equal(resumeKind("non"), "non");
  assert.equal(resumeKind("Comment classe-t-on un devis ?"), null);
  assert.equal(resumeKind("prépare un devis pour Atlas"), null);
  assert.equal(resumeKind("Fiche : fournisseur Durand"), null);
  assert.equal(resumeKind("que sait-on de Marie Dupont"), null);
  assert.equal(resumeKind("Enregistre ça"), null);
});

test("la réponse nourrit le champ suspendu, un oui sans hypothèse ne compte pas", () => {
  assert.equal(cleanAnswer("la société est Durand"), "Durand");
  const filled = nextOverrides(empty, {}, "société", "valeur", "Durand", "");
  assert.equal(filled.kept, true);
  assert.equal(filled.overrides.societe, "Durand");
  assert.equal(filled.valeurs["société"], "Durand");
  const confirmed = nextOverrides(empty, {}, "projet", "oui", "oui", "Atlas");
  assert.equal(confirmed.overrides.projet, "Atlas");
  const bare = nextOverrides(empty, {}, "société", "oui", "oui", "");
  assert.equal(bare.kept, false);
  const refused = nextOverrides({ ...empty, societe: "Durand" }, { société: "Durand" }, "société", "non", "non", "Durand");
  assert.equal(refused.kept, false);
  assert.equal(refused.overrides.societe, "Durand");
});

test("une tâche enregistrée se relit sans inventer une étape", () => {
  const task = readStoredTask({
    intent: "register_document",
    request: "Enregistre ça",
    status: "suspendue",
    field: "société",
    steps: taskSteps({ ready: false, simulated: false }),
  });
  assert.equal(task?.intent, "register_document");
  assert.equal(task?.steps.length, 4);
  assert.equal(readStoredTask({ status: "suspendue" }), null);
});
