import assert from "node:assert/strict";
import test from "node:test";
import {
  clarificationMayConfirm,
  classifyPendingTurn,
  resolveRecordTarget,
  revisesPendingDraft,
  storedClientForDraft,
} from "../src/domain/conversation-turn.ts";
import { emptyDraft, qualifyDraft, readConfirmation, reviseDraft } from "../src/domain/client-file.ts";
import { structuredPlanEligible, structuredPlanGate } from "../src/domain/structured-plan.ts";

const pending = () =>
  qualifyDraft({ ...emptyDraft(), legalName: "Dupont", kind: "entreprise", notes: "Déjà noté" });

test("les confirmations explicites", () => {
  for (const text of ["Oui", "Oui, je confirme.", "Je confirme.", "Valide.", "C'est validé."]) {
    assert.equal(classifyPendingTurn(text), "confirm");
    assert.equal(readConfirmation(text), "confirm");
  }
  for (const text of ["oui mais le téléphone est 01 23 45 67 89", "oui, ajoute aussi", "oui, sauf le pays"]) {
    assert.notEqual(classifyPendingTurn(text), "confirm");
  }
});

test("les rejets explicites", () => {
  for (const text of ["Non", "Non, annule.", "Annule.", "Rejette."]) {
    assert.equal(classifyPendingTurn(text), "reject");
    assert.equal(readConfirmation(text), "reject");
  }
  assert.equal(classifyPendingTurn("Non, plutôt 12 rue de Paris."), "correction");
});

test("les corrections de brouillon", () => {
  for (const text of [
    "Son téléphone est 01 23 45 67 89.",
    "L'adresse est 12 rue des Lilas.",
    "Corrige le téléphone : 01 23 45 67 89.",
    "Remplace l'email par a@b.fr.",
    "Non, plutôt 12 rue de Paris.",
    "Ajoute aussi son téléphone 01 23 45 67 89.",
  ]) {
    assert.equal(classifyPendingTurn(text), "correction");
    assert.equal(revisesPendingDraft(classifyPendingTurn(text)), true);
  }
});

test("les intentions indépendantes et le texte inconnu", () => {
  for (const text of [
    "Ouvre le dossier Toiture pour Martin.",
    "Ajoute Bernard comme client.",
    "Montre les projets de Martin.",
    "Le téléphone de Martin est 01 23 45 67 89.",
  ]) {
    assert.equal(classifyPendingTurn(text), "new_intent");
    assert.equal(revisesPendingDraft(classifyPendingTurn(text)), false);
  }
  assert.equal(classifyPendingTurn("Merci"), "unknown");
  assert.equal(structuredPlanGate(structuredPlanEligible("Ouvre le dossier Toiture pour Martin."), false), "plan");
  assert.equal(structuredPlanEligible("Ajoute Bernard comme client."), true);
});

test("une correction ne recopie pas le message dans les notes", () => {
  const current = pending();
  const phone = reviseDraft(current, "Son téléphone est 01 23 45 67 89.");
  assert.match(phone.draft.phone, /01 23 45 67 89/);
  assert.equal(phone.draft.legalName, "Dupont");
  assert.equal(phone.draft.notes, "Déjà noté");

  const address = reviseDraft(current, "L'adresse est 12 rue des Lilas.");
  assert.equal(address.draft.address, "12 rue des Lilas");
  assert.equal(address.draft.notes, "Déjà noté");

  const labeled = reviseDraft(current, "Corrige le téléphone : 01 23 45 67 89");
  assert.match(labeled.draft.phone, /01 23 45 67 89/);
  assert.equal(labeled.draft.legalName, "Dupont");

  const filled = qualifyDraft({
    ...emptyDraft(),
    legalName: "Dupont",
    kind: "entreprise",
    address: "12 rue des Lilas",
    email: "ancien@dupont.fr",
    notes: "note existante",
  });
  const email = reviseDraft(filled, "Remplace l'email par a@b.fr");
  assert.equal(email.draft.email, "a@b.fr");
  assert.equal(email.draft.address, "12 rue des Lilas");
  assert.equal(email.draft.notes, "note existante");
  assert.equal(email.draft.legalName, "Dupont");
  const phoneOnly = reviseDraft(filled, "Corrige le téléphone : 01 23 45 67 89");
  assert.match(phoneOnly.draft.phone, /01 23 45 67 89/);
  assert.equal(phoneOnly.draft.address, "12 rue des Lilas");
  assert.equal(phoneOnly.draft.email, "ancien@dupont.fr");
  assert.equal(phoneOnly.draft.legalName, "Dupont");
  assert.equal(phoneOnly.draft.notes, "note existante");

  const also = reviseDraft(current, "Ajoute aussi son téléphone 01 23 45 67 89.");
  assert.match(also.draft.phone, /01 23 45 67 89/);
  assert.equal(also.draft.notes, "Déjà noté");
});

test("une nouvelle demande laisse le brouillon classé à part", () => {
  const current = pending();
  for (const text of [
    "Ouvre le dossier Toiture pour Martin.",
    "Ajoute Bernard comme client.",
    "Montre les projets de Martin.",
    "Oui, je confirme.",
    "Non, annule.",
    "Merci",
  ]) {
    assert.equal(revisesPendingDraft(classifyPendingTurn(text)), false);
    assert.equal(current.legalName, "Dupont");
    assert.equal(current.notes, "Déjà noté");
  }
});

test("la cible d’une mise à jour est un nom complet", () => {
  assert.equal(resolveRecordTarget("Le téléphone de Dupontel est 01 23 45 67 89.", ["Dupont"]).status, "none");
  assert.equal(
    resolveRecordTarget("Le téléphone d'Atelier Nordique est 01 23 45 67 89.", ["Atelier Nord"]).status,
    "none",
  );
  assert.equal(resolveRecordTarget("Le téléphone de Martin est 01 23 45 67 89.", ["Jean Martin"]).status, "none");
  const unique = resolveRecordTarget("Le téléphone de Martin est 01 23 45 67 89.", ["Martin", "Dupont"]);
  assert.equal(unique.status, "one");
  if (unique.status === "one") assert.equal(unique.name, "Martin");
  const longer = resolveRecordTarget("Le téléphone de RECETTE-V3-002 Dupont est 01 23 45 67 89.", [
    "RECETTE-V3-002",
    "RECETTE-V3-002 Dupont",
  ]);
  assert.equal(longer.status, "one");
  if (longer.status === "one") assert.equal(longer.name, "RECETTE-V3-002 Dupont");
  assert.equal(resolveRecordTarget("Le temps est beau.", ["Martin"]).status, "none");
  const both = resolveRecordTarget("Le téléphone de Dupont est le même que Martinez SARL.", ["Dupont", "Martinez SARL"]);
  assert.equal(both.status, "ambiguous");
  if (both.status === "ambiguous") assert.deepEqual([...both.names].sort(), ["Dupont", "Martinez SARL"]);
  const deco = resolveRecordTarget("L'adresse de Dupont est 3 rue de Paris Déco.", ["Dupont", "Paris Déco"]);
  assert.equal(deco.status, "ambiguous");
  if (deco.status === "ambiguous") assert.deepEqual([...deco.names].sort(), ["Dupont", "Paris Déco"]);
});

test("la clarification ne confirme que la seule proposition affichée", () => {
  assert.equal(classifyPendingTurn("Merci"), "unknown");
  assert.equal(clarificationMayConfirm("dupont", ["dupont"]), true);
  assert.equal(clarificationMayConfirm("dupont", ["bernard", "dupont"]), false);
  assert.equal(clarificationMayConfirm("dupont", ["dupont", "bernard"]), false);
  assert.equal(clarificationMayConfirm(null, ["dupont"]), false);
});

test("une création Dupont ne vise pas Jean Dupont", () => {
  assert.equal(storedClientForDraft("Dupont", ["Jean Dupont"]), null);
  assert.equal(storedClientForDraft("Dupont", ["Jean Dupont", "Dupont"]), "Dupont");
});
