import assert from "node:assert/strict";
import test from "node:test";
import {
  clarificationMayConfirm,
  classifyPendingTurn,
  pendingCorrectionDecision,
  pendingNamedRevision,
  pendingDraftsClarification,
  proposalCanBeConfirmed,
  proposalsReplacedBy,
  readFieldFocus,
  rejectPendingProposal,
  resolveRecordTarget,
  resolveUpdateTarget,
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
  for (const text of ["Non", "Non, annule.", "Annule.", "Rejette.", "Je rejette."]) {
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
  const dupontel = resolveUpdateTarget("Le téléphone de Dupontel est 01 23 45 67 89.", ["Dupont"]);
  assert.equal(dupontel.status, "none");
  const nordique = resolveUpdateTarget("Le téléphone d'Atelier Nordique est 01 23 45 67 89.", ["Atelier Nord"]);
  assert.equal(nordique.status, "none");
  const jean = resolveUpdateTarget("Le téléphone de Martin est 01 23 45 67 89.", ["Jean Martin"]);
  assert.equal(jean.status, "none");
  const kept = resolveUpdateTarget("Le téléphone de RECETTE-V3-002 Dupont est 01 23 45 67 89.", [
    "RECETTE-V3-002",
    "RECETTE-V3-002 Dupont",
  ]);
  assert.equal(kept.status, "one");
  if (kept.status === "one") assert.equal(kept.name, "RECETTE-V3-002 Dupont");
  const same = resolveUpdateTarget("Le téléphone de Dupont est le même que Martinez SARL.", ["Dupont", "Martinez SARL"]);
  assert.equal(same.status, "one");
  if (same.status === "one") assert.equal(same.name, "Dupont");
  const deco = resolveUpdateTarget("L'adresse de Dupont est 3 rue de Paris Déco.", ["Dupont", "Paris Déco"]);
  assert.equal(deco.status, "one");
  if (deco.status === "one") assert.equal(deco.name, "Dupont");
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

test("une adresse sépare le sujet et la valeur", () => {
  const martin = readFieldFocus("L'adresse de Martin est 12 rue de Paris.");
  assert.equal(martin?.kind, "named");
  assert.equal(martin?.subject, "Martin");
  assert.equal(martin?.value, "12 rue de Paris");
  const bare = readFieldFocus("L'adresse est 12 rue de Paris.");
  assert.equal(bare?.kind, "draft");
  assert.equal(bare?.subject, null);
  assert.equal(bare?.value, "12 rue de Paris");
  const own = readFieldFocus("Son adresse est 8 avenue de la République.");
  assert.equal(own?.kind, "draft");
  assert.equal(own?.value, "8 avenue de la République");
  assert.equal(readFieldFocus("L'adresse du client est 12 rue de Paris.")?.kind, "draft");
  assert.equal(readFieldFocus("L'adresse de la fiche est 12 rue de Paris.")?.kind, "draft");
  assert.equal(readFieldFocus("L'adresse de son client est 12 rue de Paris.")?.kind, "draft");
});

test("une adresse avec de corrige le brouillon courant", () => {
  const current = pending();
  const cases = [
    ["L'adresse est 12 rue de la Paix.", "12 rue de la Paix"],
    ["L'adresse est 12 rue de Paris.", "12 rue de Paris"],
    ["Son adresse est 8 avenue de la République.", "8 avenue de la République"],
    ["Mets l'adresse 3 chemin de la Gare.", "3 chemin de la Gare"],
  ] as const;
  for (const [text, address] of cases) {
    assert.equal(classifyPendingTurn(text), "correction");
    const focus = readFieldFocus(text);
    assert.equal(focus?.kind, "draft");
    const revised = reviseDraft(current, text);
    assert.equal(revised.changed, true);
    assert.equal(revised.draft.legalName, "Dupont");
    assert.equal(revised.draft.address, address);
  }
  assert.equal(resolveUpdateTarget("L'adresse est 12 rue de Paris.", ["Paris", "Paix"]).status, "none");
  assert.equal(resolveUpdateTarget("L'adresse est 12 rue de la Paix.", ["Paix", "Paris"]).status, "none");
  assert.equal(resolveUpdateTarget("Son adresse est 8 avenue de la République.", ["République"]).status, "none");
  assert.equal(resolveUpdateTarget("Mets l'adresse 3 chemin de la Gare.", ["Gare"]).status, "none");
});

test("ajoute, c'est, avec et devient corrigent le brouillon", () => {
  const current = pending();
  const cases = [
    ["Ajoute l'adresse 12 rue de Paris", "12 rue de Paris"],
    ["Complète l'adresse avec 12 rue de Paris", "12 rue de Paris"],
    ["L'adresse c'est 12 rue de Paris", "12 rue de Paris"],
    ["L'adresse devient 12 rue de Paris", "12 rue de Paris"],
    ["Ajoute l'adresse 8 avenue Victor Hugo", "8 avenue Victor Hugo"],
    ["Complète l'adresse avec 3 chemin de la Gare", "3 chemin de la Gare"],
    ["L'adresse devient 4 place de la République", "4 place de la République"],
  ] as const;
  for (const [text, address] of cases) {
    assert.equal(classifyPendingTurn(text), "correction");
    assert.equal(readFieldFocus(text)?.kind, "draft");
    assert.equal(resolveUpdateTarget(text, ["Paris", "Paix", "Victor Hugo", "Gare", "République"]).status, "none");
    const revised = reviseDraft(current, text);
    assert.equal(revised.draft.legalName, "Dupont");
    assert.equal(revised.draft.address, address);
  }
  assert.equal(classifyPendingTurn("Ajoute Bernard comme client, adresse 12 rue des Lilas"), "new_intent");
  assert.equal(classifyPendingTurn("Ajoute Bernard comme client, adresse 12 rue Haute, Paris"), "new_intent");
});

test("ajoute aussi et complète avec corrigent le brouillon", () => {
  const current = pending();
  const paris = ["Paris", "Victor Hugo", "République", "Gare", "Martin", "Dupont"];
  const cases = [
    ["Ajoute aussi l'adresse 12 rue Haute, Paris", "12 rue Haute", "Paris", ""],
    ["Complète avec l'adresse 12 rue Haute, Paris", "12 rue Haute", "Paris", ""],
    ["Ajoute également l'adresse 12 rue Haute, 75001 Paris", "12 rue Haute", "Paris", "75001"],
    ["Ajoute encore l'adresse 12 rue Haute, Paris", "12 rue Haute", "Paris", ""],
  ] as const;
  for (const [text, address, city, postalCode] of cases) {
    assert.equal(classifyPendingTurn(text), "correction");
    assert.equal(readFieldFocus(text)?.kind, "draft");
    assert.equal(resolveUpdateTarget(text, paris).status, "none");
    const revised = reviseDraft(current, text);
    assert.equal(revised.draft.legalName, "Dupont");
    assert.equal(revised.draft.address, address);
    assert.equal(revised.draft.city, city);
    assert.equal(revised.draft.postalCode, postalCode);
  }
  const phone = "Ajoute aussi le téléphone 0612345678";
  assert.equal(classifyPendingTurn(phone), "correction");
  assert.equal(resolveUpdateTarget(phone, paris).status, "none");
  assert.match(reviseDraft(current, phone).draft.phone, /0612345678/);
  const email = "Ajoute aussi l'email contact@paris.fr";
  assert.equal(classifyPendingTurn(email), "correction");
  assert.equal(resolveUpdateTarget(email, ["Paris"]).status, "none");
  assert.equal(reviseDraft(current, email).draft.email, "contact@paris.fr");
  assert.equal(resolveUpdateTarget("Note 12 rue Haute, Paris.", ["Paris"]).status, "none");
  assert.equal(resolveUpdateTarget("Note 12 rue Haute, 75001 Paris.", ["Paris"]).status, "none");
  assert.equal(resolveUpdateTarget("Note 12 avenue Victor Hugo, Lyon.", ["Victor Hugo", "Lyon"]).status, "none");
  const martin = "L'adresse de Martin est 12 rue Haute, Paris.";
  const target = resolveUpdateTarget(martin, ["Martin", "Paris"]);
  assert.equal(target.status, "one");
  if (target.status === "one") assert.equal(target.name, "Martin");
});

test("un e-mail ou un téléphone n’est pas une cible", () => {
  const current = pending();
  const email = "Ajoute l'email contact@paris.fr";
  assert.equal(classifyPendingTurn(email), "correction");
  assert.equal(resolveUpdateTarget(email, ["Paris"]).status, "none");
  assert.equal(reviseDraft(current, email).draft.email, "contact@paris.fr");
  assert.equal(reviseDraft(current, email).draft.legalName, "Dupont");
  const phone = "Ajoute le téléphone 01 23 45 67 89";
  assert.equal(classifyPendingTurn(phone), "correction");
  assert.equal(resolveUpdateTarget(phone, ["23", "Paris"]).status, "none");
  assert.match(reviseDraft(current, phone).draft.phone, /01 23 45 67 89/);
  assert.equal(resolveUpdateTarget("Voir contact@paris.fr", ["Paris"]).status, "none");
  assert.equal(resolveUpdateTarget("Rappel 01 23 45 67 89", ["23"]).status, "none");
  assert.equal(resolveUpdateTarget("Visite 12 rue de Paris demain.", ["Paris"]).status, "none");
});

test("pour Martin vise Martin", () => {
  const text = "Pour Martin, le téléphone est 0612345678.";
  const focus = readFieldFocus(text);
  assert.equal(focus?.kind, "named");
  assert.equal(focus?.subject, "Martin");
  assert.equal(classifyPendingTurn(text), "new_intent");
  const target = resolveUpdateTarget(text, ["Martin", "Dupont", "Paris"]);
  assert.equal(target.status, "one");
  if (target.status === "one") assert.equal(target.name, "Martin");
});

test("l’adresse d’une autre fiche vise le sujet", () => {
  const text = "L'adresse de Martin est 12 rue de Paris.";
  assert.equal(classifyPendingTurn(text), "new_intent");
  const target = resolveUpdateTarget(text, ["Martin", "Paris", "Dupont"]);
  assert.equal(target.status, "one");
  if (target.status === "one") assert.equal(target.name, "Martin");
});

test("un rejet de proposition client est définitif", () => {
  const first = rejectPendingProposal({ status: "en_attente", validatedAt: null }, "2026-09-30T18:00:00.000Z");
  assert.equal(first.changed, true);
  assert.equal(first.row.status, "rejetee");
  assert.equal(first.row.validatedAt, "2026-09-30T18:00:00.000Z");
  const second = rejectPendingProposal(first.row, "2026-09-30T18:05:00.000Z");
  assert.equal(second.changed, false);
  assert.equal(second.row.status, "rejetee");
  assert.equal(second.row.validatedAt, "2026-09-30T18:00:00.000Z");
  assert.equal(proposalCanBeConfirmed("rejetee"), false);
  assert.equal(proposalCanBeConfirmed("en_attente"), true);
  assert.equal(proposalCanBeConfirmed("remplacee"), false);
});

test("une correction sans nom ne choisit pas entre plusieurs fiches", () => {
  const text = "Son adresse est 9 rue des Roses.";
  assert.equal(pendingCorrectionDecision(["Dupont", "Martin"], text), "clarify");
  assert.equal(pendingCorrectionDecision(["Dupont"], text), "revise");
  assert.equal(pendingCorrectionDecision(["Dupont", "Martin"], "L'adresse de Martin est 9 rue des Roses."), "skip");
  const named = pendingNamedRevision(["Dupont", "Martin"], "L'adresse de Martin est 9 rue des Roses.");
  assert.equal(named.status, "revise");
  if (named.status === "revise") assert.equal(named.name, "Martin");
  assert.equal(pendingNamedRevision(["Dupont"], "L'adresse de Martin est 9 rue des Roses.").status, "skip");
  assert.match(pendingDraftsClarification(["Dupont", "Martin"]), /Dupont et Martin/);
  assert.match(pendingDraftsClarification(["Dupont", "Martin"]), /Rien n’a été modifié/);
  const ids = proposalsReplacedBy({
    replaceId: "martin",
    nextName: "Martin",
    pending: [
      { id: "dupont", name: "Dupont" },
      { id: "martin", name: "Martin" },
    ],
  });
  assert.deepEqual(ids, ["martin"]);
  assert.deepEqual(
    proposalsReplacedBy({
      replaceId: null,
      nextName: "Bernard",
      pending: [
        { id: "dupont", name: "Dupont" },
        { id: "martin", name: "Martin" },
      ],
    }),
    [],
  );
  assert.deepEqual(
    proposalsReplacedBy({
      replaceId: null,
      nextName: "Dupont",
      pending: [
        { id: "dupont", name: "Dupont" },
        { id: "dupontel", name: "Dupontel" },
      ],
    }),
    ["dupont"],
  );
});
