import assert from "node:assert/strict";
import test from "node:test";
import { readDocumentFacts } from "../src/domain/document-facts.ts";
import { proposeFromReading, readOfferFile, type DirectorySnapshot } from "../src/domain/offer-versions.ts";

const emptyDirectory: DirectorySnapshot = {
  clients: [],
  suppliers: [],
  products: [],
  quotes: [],
  demands: [],
  projects: [],
};

const invoice = `Apex Solutions Inc. FACTURE
CONSEIL & INTÉGRATION SYSTÈMES
# FAC-2026-018
ACOMPTE 50%
ÉMETTEUR
Apex Solutions Inc.
1000 Rue de la Gauchetière Ouest
Montréal, QC
N° TPS/TVH : 123456789 RT0001
CLIENT
Logistique Nord-Avenir Ltée
Objet : Facture d'acompte (50%) selon le Devis # DEV-2026-004
Banque : Banque Nationale du Canada | Transit : 00123 | N° Institution : 006
N° de compte : 1234-567-8901
Apex Solutions Inc. — Facture FAC-2026-018 Page 1 sur 1`;

const quotes: Array<[string, string]> = [
  ["DEV-2026-0142.txt", "NEXUS DIGITAL SAS DEVIS N° DEV-2026-0142\nContact: devis@nexusdigital.fr\nValidité : 30 jours\nPaiement : acompte 30 % à la commande"],
  ["CS-2026-883.txt", "CLOUDSTACK IRELAND LTD\nQUOTATION # CS-2026-883\nCurrency : EUR (€)"],
  ["US-2026-9901.txt", "AUSTIN CLOUD SOLUTIONS LLC\nQUOTE # US-2026-9901\nCurrency : USD ($)"],
  ["MAT-2026-402.txt", "NETSYS INFRASTRUCTURE SAS DEVIS N° MAT-2026-402\nContact: commandes@netsys-infra.fr"],
  ["AT-2026-089.txt", "ALTENIS CONSULTING EURL DEVIS N° AT-2026-089\nType : Régie"],
  ["CH-2026-1102.txt", "SWISS SECURE IT AG\nOFFRE N° CH-2026-1102\nWährung : CHF"],
  [
    "MSP-2026-003.txt",
    `INFOGÉRANCE PRO SERVICES DEVIS N° MSP-2026-003
Contact: contrat@infogerance-pro.fr
Date : 01/11/2026
Validité : 30 jours
PRESTATAIRE MSP
INFOGÉRANCE PRO SERVICES
CLIENT SOUSCRIPTEUR
GROUPE TEXTILE DU NORD SA
Objet : Contrat Annuel de Maintenance IT`,
  ],
  ["UK-2026-771.txt", "DATA ANALYTICS UK LTD\nQUOTATION # UK-2026-771\nCurrency : GBP (£)"],
  ["FOR-2026-554.txt", "LEARN IT ACADEMY SAS DEVIS N° FOR-2026-554\nType : Formation Professionnelle"],
  ["CA-2026-339.txt", "QUEBEC ERP SOLUTIONS INC.\nSOUMISSION N° CA-2026-339\nDevise : CAD ($)"],
];

test("les dix devis de contrôle restent des devis", () => {
  for (const [filename, text] of quotes) {
    const reading = readOfferFile(text, filename);
    assert.equal(reading.kind, "devis", filename);
    assert.equal(reading.role, "", filename);
  }
});

test("la facture d'acompte reste une facture malgré le devis et la banque", () => {
  const reading = readOfferFile(invoice, "piece.txt");
  assert.equal(reading.kind, "facture");
  assert.equal(reading.role, "acompte");
  assert.equal(reading.offers.length, 0);
  const named = readOfferFile(invoice, "Facture_d_Acompte.pdf");
  assert.equal(named.kind, "facture");
  assert.equal(named.role, "acompte");
  const proposal = proposeFromReading(reading, "piece.txt", emptyDirectory, []);
  assert.equal(proposal?.fields.find((field) => field.label === "Type")?.value, "Facture");
  assert.equal(proposal?.fields.find((field) => field.label === "Rôle")?.value, "Acompte");
  assert.match(proposal?.summary ?? "", /Rôle : acompte/);
  assert.equal(proposal?.actions.some((action) => action.type === "add_quote_version"), false);
  assert.equal(proposal?.fields.find((field) => field.label === "Projet")?.value, "Non rattaché");
  const facts = readDocumentFacts(invoice, "piece.txt");
  assert.equal(facts.facts.find((fact) => fact.label === "Nature")?.value, "Facture");
  assert.equal(facts.facts.find((fact) => fact.label === "Rôle")?.value, "Acompte");
});

test("un relevé bancaire ne crée pas de fiche et n'est pas une facture", () => {
  const text = `RELEVÉ BANCAIRE
Client : Atelier Nord
Banque Nationale du Canada
Période du 01/10/2026 au 31/10/2026
Solde : 1 200,00 €
Ligne
Ligne
Ligne
Commission | 12,00 € HT
Frais de facture carte`;
  const reading = readOfferFile(text, "releve.txt");
  assert.equal(reading.kind, "releve");
  assert.equal(reading.role, "");
  const proposal = proposeFromReading(reading, "releve.txt", emptyDirectory, []);
  assert.equal(proposal?.fields.find((field) => field.label === "Type")?.value, "Relevé bancaire");
  assert.equal(proposal?.actions.some((action) => action.type === "create_client"), false);
  assert.equal(proposal?.actions.some((action) => action.type === "create_supplier"), false);
  assert.equal(proposal?.actions.some((action) => action.type === "create_product"), false);
  assert.equal(proposal?.actions.some((action) => action.type === "add_quote_version"), false);
});

test("une demande de chiffrage et une documentation technique ont leur nature", () => {
  const demand = readOfferFile("DEMANDE DE CHIFFRAGE n° DC-14\nClient : Atelier Nord", "dc-14.txt");
  assert.equal(demand.kind, "rfq");
  assert.equal(demand.role, "");
  const sheet = readOfferFile("DOCUMENTATION TECHNIQUE\nSwitch Cisco C9300\nAucune tarification", "notice.txt");
  assert.equal(sheet.kind, "fiche");
  assert.equal(sheet.offers.length, 0);
});

test("une pièce sans texte reste autre", () => {
  const reading = readOfferFile("   \n", "Facture_vide.pdf");
  assert.equal(reading.kind, "autre");
  assert.equal(reading.role, "");
});

test("un contrat qui cite un devis plus bas reste un contrat", () => {
  const text = `Contrat cadre
Maintenance annuelle
Partie
Partie
Partie
Partie
Partie
Partie
Le devis joint reste à part.`;
  assert.equal(readOfferFile(text, "cadre.txt").kind, "contrat");
});
