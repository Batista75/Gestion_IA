import assert from "node:assert/strict";
import test from "node:test";
import { structuredPlanEligible, structuredPlanGate } from "../src/domain/structured-plan.ts";
import { understandIntent } from "../src/domain/knowledge.ts";
import {
  CLIENT_EXAMPLES,
  asksToEnrichRecord,
  enrichmentOwnsTurn,
  emptyDraft,
  frenchVat,
  identifyClient,
  knownRecordPrompt,
  presentProposal,
  proposalFields,
  qualifyDraft,
  readConfirmation,
  reviseDraft,
} from "../src/domain/client-file.ts";

test("particulier en France", () => {
  const draft = identifyClient(CLIENT_EXAMPLES[0].text);
  assert.ok(draft);
  assert.equal(draft.kind, "particulier");
  assert.equal(draft.scope, "france");
  assert.equal(draft.civility, "Madame");
  assert.equal(draft.firstName, "Marie");
  assert.equal(draft.lastName, "Dupont");
  assert.equal(draft.postalCode, "75011");
  assert.equal(draft.city, "Paris");
  assert.equal(draft.email, "marie.dupont@mail.fr");
  assert.match(draft.phone, /06 12 34 56 78/);
  assert.match(draft.notes, /appartement/);
});

test("particulier au Royaume-Uni", () => {
  const draft = identifyClient(CLIENT_EXAMPLES[1].text);
  assert.ok(draft);
  assert.equal(draft.kind, "particulier");
  assert.equal(draft.scope, "international");
  assert.equal(draft.country, "Royaume-Uni");
  assert.equal(draft.lastName, "Miller");
  assert.equal(draft.postalCode, "SW1A 1AA");
  assert.equal(draft.city, "London");
});

test("entreprise française, TVA déduite du SIREN", () => {
  const draft = identifyClient(CLIENT_EXAMPLES[2].text);
  assert.ok(draft);
  assert.equal(draft.kind, "entreprise");
  assert.equal(draft.scope, "france");
  assert.equal(draft.legalName, "Menuiserie Lambert SAS");
  assert.equal(draft.legalForm, "SAS");
  assert.equal(draft.tradeName, "Atelier Lambert");
  assert.equal(draft.siren, "732829320");
  assert.equal(draft.siret, "73282932000009");
  assert.equal(draft.vatNumber, frenchVat("732829320"));
  assert.equal(draft.vatDeduced, true);
  assert.equal(draft.city, "Villeurbanne");
  assert.equal(draft.contactName, "Paul Lambert");
  assert.equal(draft.contactRole, "gérant");
});

test("entreprise internationale", () => {
  const draft = identifyClient(CLIENT_EXAMPLES[3].text);
  assert.ok(draft);
  assert.equal(draft.kind, "entreprise");
  assert.equal(draft.scope, "international");
  assert.equal(draft.country, "Allemagne");
  assert.equal(draft.legalForm, "GmbH");
  assert.equal(draft.vatNumber, "DE136695976");
  assert.equal(draft.city, "München");
  assert.equal(draft.contactName, "Anna Müller");
  assert.equal(draft.contactRole, "achats");
  assert.equal(draft.address, "Musterstraße 10");
  assert.equal(draft.missing.includes("adresse"), false);
});

test("bloc entreprise finlandaise, action et champs séparés", () => {
  const draft = identifyClient(`ajoute le client : Grid Solutions Oy

Vehmaistenkatu 5

33730 TAMPERE

FINLAND

Business ID: 1558237-3

Trade Reg. No.: 1558237-3

VAT ID: FI15582373`);
  assert.ok(draft);
  assert.equal(draft.kind, "entreprise");
  assert.equal(draft.scope, "international");
  assert.equal(draft.legalName, "Grid Solutions Oy");
  assert.equal(draft.legalForm, "Oy");
  assert.equal(draft.country, "Finlande");
  assert.equal(draft.address, "Vehmaistenkatu 5");
  assert.equal(draft.postalCode, "33730");
  assert.equal(draft.city, "Tampere");
  assert.equal(draft.vatNumber, "FI15582373");
  assert.equal(draft.registration, "1558237-3");
  assert.equal(draft.missing.includes("pays"), false);
  assert.equal(draft.missing.includes("adresse"), false);
  assert.ok(draft.missing.includes("e-mail ou téléphone"));
  const proposal = presentProposal(draft);
  assert.match(proposal, /Action demandée : création d’un client/);
  assert.match(proposal, /Grid Solutions Oy/);
  assert.doesNotMatch(proposal, /Vehmaistenkatu 5 33730/);
  assert.ok(proposalFields(draft).some((field) => field.label === "Action" && field.value === "Création"));
});

test("la confirmation et la correction", () => {
  const draft = identifyClient(CLIENT_EXAMPLES[0].text);
  assert.ok(draft);
  assert.equal(readConfirmation("Je confirme."), "confirm");
  assert.equal(readConfirmation("non"), "reject");
  assert.equal(readConfirmation("le téléphone est le 06 98 76 54 32"), "comment");
  const revised = reviseDraft(draft, "c'est une entreprise, le téléphone est le 06 98 76 54 32");
  assert.equal(revised.changed, true);
  assert.equal(revised.draft.kind, "entreprise");
  assert.match(revised.draft.phone, /06 98 76 54 32/);
  assert.equal(revised.draft.lastName, "Dupont");
  assert.match(revised.draft.legalName || `${revised.draft.firstName} ${revised.draft.lastName}`, /Dupont/);
  assert.ok(proposalFields(revised.draft).some((field) => field.label === "Nom" && field.value.includes("Dupont")));
});

test("compléter une entreprise déjà déclarée", () => {
  assert.equal(asksToEnrichRecord("ajoute un contact chez Holzwerk"), true);
  assert.equal(asksToEnrichRecord("liste des clients"), false);
  assert.equal(asksToEnrichRecord("ajouter un fournisseur Quincaillerie Durand"), false);

  const current = qualifyDraft({
    ...emptyDraft(),
    mode: "update",
    kind: "entreprise",
    legalName: "Holzwerk Müller GmbH",
    legalForm: "GmbH",
    country: "Allemagne",
    vatNumber: "DE136695976",
    notes: "Livraison habituelle le jeudi.",
  });
  const revised = reviseDraft(
    current,
    "ajoute un contact Anne Durand, directrice commerciale, chez Holzwerk Müller GmbH",
  );
  assert.equal(revised.changed, true);
  assert.equal(revised.draft.contactName, "Anne Durand");
  assert.equal(revised.draft.contactRole, "directrice commerciale");
  assert.equal(revised.draft.legalName, "Holzwerk Müller GmbH");
  assert.equal(revised.draft.country, "Allemagne");
  assert.equal(revised.draft.vatNumber, "DE136695976");
  assert.match(presentProposal(revised.draft), /conservées/);

  const unnamed = reviseDraft(current, "ajoute un contact chez Holzwerk Müller GmbH");
  assert.equal(unnamed.changed, false);
  assert.equal(unnamed.draft.contactName, "");
  const prompt = knownRecordPrompt(current);
  assert.match(prompt, /Aucun contact n’est encore enregistré/);
  assert.match(prompt, /Holzwerk Müller GmbH/);

  const informed = reviseDraft(
    current,
    "ajoute une information sur Holzwerk Müller GmbH : livraison le mardi",
  );
  assert.equal(informed.changed, true);
  assert.match(informed.draft.notes, /Livraison habituelle le jeudi/);
  assert.match(informed.draft.notes, /livraison le mardi/);
});

test("une correction de téléphone ne change ni le nom ni les notes", () => {
  const current = qualifyDraft({
    ...emptyDraft(),
    legalName: "Dupont",
    kind: "entreprise",
    notes: "Déjà noté",
  });
  const revised = reviseDraft(current, "Son téléphone est 01 23 45 67 89.");
  assert.equal(revised.changed, true);
  assert.match(revised.draft.phone, /01 23 45 67 89/);
  assert.equal(revised.draft.legalName, "Dupont");
  assert.equal(revised.draft.notes, "Déjà noté");
  const address = reviseDraft(current, "L'adresse est 12 rue des Lilas.");
  assert.equal(address.draft.address, "12 rue des Lilas");
  assert.equal(address.draft.legalName, "Dupont");
  assert.equal(address.draft.notes, "Déjà noté");
  const filled = qualifyDraft({
    ...current,
    address: "12 rue des Lilas",
    email: "ancien@dupont.fr",
    notes: "note existante",
  });
  const email = reviseDraft(filled, "Remplace l'email par a@b.fr");
  assert.equal(email.draft.email, "a@b.fr");
  assert.equal(email.draft.address, "12 rue des Lilas");
  assert.equal(email.draft.notes, "note existante");
  assert.equal(email.draft.legalName, "Dupont");
  const phone = reviseDraft(filled, "Corrige le téléphone : 01 23 45 67 89");
  assert.match(phone.draft.phone, /01 23 45 67 89/);
  assert.equal(phone.draft.address, "12 rue des Lilas");
  assert.equal(phone.draft.email, "ancien@dupont.fr");
  assert.equal(phone.draft.legalName, "Dupont");
  assert.equal(phone.draft.notes, "note existante");
  assert.notEqual(phone.draft.legalName, "01 23 45 67 89");
});

test("une phrase libre ne devient pas le nom du client", () => {
  for (const text of [
    "J'ai un nouveau client Dupont.",
    "J'ai un nouveau client RECETTE-V3-002 Dupont.",
    "Ajoute Dupont comme client.",
    "Je voudrais ajouter Dupont comme client.",
    "Je voudrais enregistrer Dupont comme nouveau client.",
  ]) {
    const draft = identifyClient(text);
    assert.equal(draft, null);
    assert.equal(structuredPlanEligible(text), true);
  }
});

test("un nom suivi d’une proposition n’est pas une fiche", () => {
  for (const text of [
    "Ajoute un client Dupont qui habite Lyon.",
    "Nouveau client Dupont qui habite Lyon.",
    "Ajoute le client Dupont avec son fils.",
    "Crée le client Dupont, son téléphone est 01 23 45 67 89.",
    "Ajoute un client RECETTE-V3-002 Dupont qui habite Lyon.",
  ]) {
    assert.equal(identifyClient(text), null);
  }
});

test("Pour et SA restent des noms", () => {
  const house = identifyClient("Nouveau client : Maison Pour Tous");
  assert.ok(house);
  assert.equal(house.legalName, "Maison Pour Tous");
  const company = identifyClient("Nouveau client : Dupont SA");
  assert.ok(company);
  assert.equal(company.legalName, "Dupont SA");
});

test("un intitulé structuré reste une fiche client", () => {
  const created = identifyClient("Créer le client : Dupont");
  assert.ok(created);
  assert.equal(created.legalName, "Dupont");
  const labeled = identifyClient("Nouveau client : Atelier Nord");
  assert.ok(labeled);
  assert.equal(labeled.legalName, "Atelier Nord");
  const spoken = identifyClient("Nouveau client Dupont");
  assert.ok(spoken);
  assert.equal(spoken.legalName, "Dupont");
});

test("une création de client avec une coordonnée n’est pas une mise à jour", () => {
  for (const text of [
    "Ajoute Bernard comme client, téléphone 01 98 76 54 32.",
    "Ajoute Alice comme client, adresse 12 rue des Lilas.",
    "Crée le client Bernard, téléphone 01 98 76 54 32.",
    "J'ai un nouveau client Bernard, téléphone 01 98 76 54 32.",
    "Ajoute RECETTE-V3-002 Bernard comme client, téléphone 01 98 76 54 32.",
    "Ajoute RECETTE-V3-002 Alice comme client, adresse 12 rue des Lilas.",
  ]) {
    assert.equal(asksToEnrichRecord(text), false);
    assert.equal(enrichmentOwnsTurn(text, understandIntent(text)), false);
    assert.equal(structuredPlanGate(structuredPlanEligible(text), false), "plan");
  }
  assert.equal(asksToEnrichRecord("ajoute un contact chez Holzwerk"), true);
  assert.equal(enrichmentOwnsTurn("ajoute un contact chez Holzwerk", "open"), true);
});

test("une correction explicite reste une mise à jour de fiche", () => {
  const phone = "Le téléphone de Dupont est 01 23 45 67 89.";
  const address = "Mets à jour l'adresse de Dupont : 12 rue des Lilas.";
  const change = "Change le téléphone de Dupont.";
  const fix = "Corrige l'adresse du client Dupont.";
  assert.equal(understandIntent(phone), "change");
  assert.equal(structuredPlanEligible(phone), false);
  for (const text of [phone, address, change, fix]) {
    assert.equal(enrichmentOwnsTurn(text, understandIntent(text)), true);
    assert.equal(structuredPlanEligible(text), false);
  }
});

test("un fournisseur avec e-mail n’enrichit pas le client du même nom", () => {
  const text = "Ajoute ACME comme fournisseur, email contact@acme.fr";
  assert.equal(asksToEnrichRecord(text), false);
  assert.equal(enrichmentOwnsTurn(text, "change"), false);
  assert.equal(enrichmentOwnsTurn(text, understandIntent(text)), false);
});
