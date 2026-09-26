import assert from "node:assert/strict";
import test from "node:test";
import {
  CLIENT_EXAMPLES,
  asksToEnrichRecord,
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
