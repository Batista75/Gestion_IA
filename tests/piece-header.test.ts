import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HEADER_METHOD, VALIDITY_METHOD } from "../src/domain/piece-header.ts";
import {
  documentWriteTargets,
  proposeFromReading,
  readOfferFile,
  type DirectorySnapshot,
} from "../src/domain/offer-versions.ts";

const directory: DirectorySnapshot = {
  clients: [],
  suppliers: [],
  products: [],
  quotes: [],
  demands: [],
  projects: [],
};

const accounts = ["FR76", "NEXUFR2PPXX", "1234-567-8901", "9928103481", "CHASUS33", "00123", "CH56"];

function value(reading: ReturnType<typeof readOfferFile>, label: string): string {
  const proposal = proposeFromReading(reading, "piece.txt", directory, []);
  return proposal?.fields.find((field) => field.label === label)?.value ?? "";
}

test("les dix devis recopient l’en-tête écrit", () => {
  const web = readOfferFile(
    `NEXUS DIGITAL SAS                                                            DEVIS N° DEV-2026-0142
Date : 15/10/2026
Validité : 30 jours
Code Client : CLT-8891
  ÉMETTEUR                                                            DESTINATAIRE / CLIENT
  NEXUS DIGITAL SAS                                                   LOGITECH DISTRIBUTION SARL
                                                                                 Total HT :                          36 090,00 €
                                                                                 TVA (20.0%) :                        7 218,00 €
                                                                                 Total TTC :                       43 308,00 €
  - Acompte de 30% à la signature du devis, 40% au livrable V1, solde de 30% à la recette finale.
  - IBAN : FR76 3000 4012 3456 7890 1234 567 / BIC : NEXUFR2PPXX`,
    "devis-web.txt",
  );
  assert.equal(web.kind, "devis");
  assert.equal(web.header.currency, "EUR");
  assert.equal(web.header.reference, "DEV-2026-0142");
  assert.equal(web.header.validity, "2026-11-14");
  assert.ok(web.header.method.startsWith(HEADER_METHOD));
  assert.match(web.header.method, new RegExp(VALIDITY_METHOD));
  assert.equal(web.header.totalHt, "36 090,00 €");
  assert.equal(web.header.totalDue, "43 308,00 €");
  assert.equal(web.header.deposit, "30%");
  assert.equal(web.header.taxes[0], "TVA (20.0%) : 7 218,00 €");
  assert.equal(web.parties.supplierName, "NEXUS DIGITAL SAS");
  assert.equal(web.parties.clientName, "LOGITECH DISTRIBUTION SARL");
  assert.equal(JSON.stringify(web.header).includes("10 827"), false);
  assert.equal(JSON.stringify(web.header).includes("10827"), false);
  assert.equal(accounts.some((token) => JSON.stringify(web.header).includes(token)), false);
  assert.equal(accounts.some((token) => web.enrichment.includes(token)), false);

  const saas = readOfferFile(
    `QUOTATION # CS-2026-883
CLOUDSTACK IRELAND LTD                                                                                       Date : 22/10/2026
                                                                                                       Valid Date : 15/11/2026
                                                                                                             Currency : EUR (€)
  PROVIDER / VENDOR                                                 BILLED TO (CLIENT)
  CLOUDSTACK IRELAND LTD                                            MEDIA FINANCE FRANCE SAS
                                                                               Subtotal Net :                    27 600,00 €
                                                                               VAT (0% - Reverse Charge) :             0,00 €
                                                                               Total Amount Due :              27 600,00 €
  Autoliquidation de la TVA : Reverse charge applies as per Article 196 of EU VAT Directive 2006/112/EC.`,
    "devis-saas.txt",
  );
  assert.equal(saas.header.currency, "EUR");
  assert.equal(saas.header.reference, "CS-2026-883");
  assert.equal(saas.header.validity, "15/11/2026");
  assert.equal(saas.header.method.includes(VALIDITY_METHOD), false);
  assert.equal(saas.header.totalHt, "27 600,00 €");
  assert.equal(saas.header.totalDue, "27 600,00 €");
  assert.match(saas.header.taxes.join(" "), /Reverse Charge/);
  assert.equal(saas.parties.supplierName, "CLOUDSTACK IRELAND LTD");
  assert.equal(saas.parties.clientName, "MEDIA FINANCE FRANCE SAS");

  const aws = readOfferFile(
    `QUOTE # US-2026-9901
AUSTIN CLOUD SOLUTIONS LLC                                                                          Date : November 02, 2026
                                                                                              Valid Until : December 02, 2026
                                                                                                             Currency : USD ($)
  VENDOR                                                           CUSTOMER
  AUSTIN CLOUD SOLUTIONS LLC                                       GLOBAL RETAIL EUROPE LTD
                                                                               Subtotal :                         $32,275.00
                                                                               US Sales Tax (0.00%) :                  $0.00
                                                                               Total Quote Value :               $32,275.00
  - Payment Terms: 50% Upfront deposit ($16,137.50), 50% upon final migration milestone.
  - Wire Payment Details: Chase Bank NA, SWIFT: CHASUS33XXX, Account: 9928103481`,
    "devis-aws.txt",
  );
  assert.equal(aws.header.currency, "USD");
  assert.equal(aws.header.reference, "US-2026-9901");
  assert.equal(aws.header.validity, "December 02, 2026");
  assert.equal(aws.header.totalHt, "$32,275.00");
  assert.equal(aws.header.totalDue, "$32,275.00");
  assert.match(aws.header.deposit, /\$16,137\.50/);
  assert.match(aws.header.taxes.join(" "), /Sales Tax/);
  assert.equal(aws.parties.clientName, "GLOBAL RETAIL EUROPE LTD");
  assert.equal(accounts.some((token) => JSON.stringify(aws.header).includes(token)), false);

  const network = readOfferFile(
    `NETSYS INFRASTRUCTURE SAS                                                  DEVIS N° MAT-2026-402
Date : 05/11/2026
Validité : 15 jours (Prix Matériel)
  VENDEUR / INTÉGRATEUR                                            CLIENT / LIVRER À
  NETSYS INFRASTRUCTURE SAS                                        CLINIQUE SANTÉ LUXE PARIS
                                                                              Montant Total HT :                   28 600,00 €
                                                                              Net Commercial HT :                  27 170,00 €
                                                                              TVA (20.0%) :                          5 434,00 €
                                                                              Total TTC :                        32 604,00 €`,
    "devis-reseau.txt",
  );
  assert.equal(network.header.validity, "2026-11-20");
  assert.equal(network.header.totalHt, "28 600,00 €");
  assert.equal(network.header.netHt, "27 170,00 €");
  assert.equal(network.header.totalDue, "32 604,00 €");
  assert.equal(network.parties.supplierName, "NETSYS INFRASTRUCTURE SAS");
  assert.equal(network.parties.clientName, "CLINIQUE SANTÉ LUXE PARIS");

  const regie = readOfferFile(
    `ALTENIS CONSULTING EURL                                                          DEVIS N° AT-2026-089
Date : 10/11/2026
Validité : 30 jours
  PRESTATAIRE                                                       CLIENT
  ALTENIS CONSULTING EURL                                           AERO SPACE TECH SAS
                                                                                Total HT :                           44 400,00 €
                                                                                TVA (20.0%) :                         8 880,00 €
                                                                                Total TTC :                       53 280,00 €
  - Pénalités de retard : 3 fois le taux d'intérêt légal en vigueur.`,
    "devis-regie.txt",
  );
  assert.equal(regie.header.validity, "2026-12-10");
  assert.equal(regie.header.totalDue, "53 280,00 €");
  assert.match(regie.header.method, /Aucune pénalité n’est calculée/);
  assert.equal(regie.header.deposit, "");
  assert.equal(JSON.stringify(regie.header).includes("taux"), false);

  const swiss = readOfferFile(
    `DEVIS N° CH-2026-1102
Date : 18.10.2026
Gültig bis : 30.11.2026
Währung : CHF
  ANBIETER                                                         KUNDE
  SWISS SECURE IT AG                                               GENEVA PRIVATE BANK SA
                                                                                                                  30 750,00
                                                                             Zwischentotal (Total HT) :
                                                                                                                       CHF
                                                                             MwSt / TVA (8.1% - Taux
                                                                                                              2 490,75 CHF
                                                                             Suisse) :
                                                                             Gesamtbefrag (Total                33 240,75
                                                                             TTC) :                                  CHF`,
    "devis-suisse.txt",
  );
  assert.equal(swiss.header.currency, "CHF");
  assert.equal(swiss.header.reference, "CH-2026-1102");
  assert.equal(swiss.header.validity, "30.11.2026");
  assert.equal(swiss.header.totalHt, "30 750,00 CHF");
  assert.equal(swiss.header.totalDue, "33 240,75 CHF");
  assert.match(swiss.header.taxes.join(" "), /2 490,75 CHF/);
  assert.equal(swiss.parties.supplierName, "SWISS SECURE IT AG");
  assert.equal(swiss.parties.clientName, "GENEVA PRIVATE BANK SA");

  const care = readOfferFile(
    `INFOGÉRANCE PRO SERVICES                                                  DEVIS N° MSP-2026-003
Date : 01/11/2026
Validité : 30 jours
Engagement : 12 Mois
  PRESTATAIRE MSP                                                  CLIENT SOUSCRIPTEUR
  INFOGÉRANCE PRO SERVICES                                         GROUPE TEXTILE DU NORD SA
                                                                                 Total Mensuel HT :                   2 580,00 €
                                                                                 TVA (20.0%) :                          516,00 €
                                                                                   soit un montant annuel engagé HT de 30 960,00 €`,
    "devis-msp.txt",
  );
  assert.equal(care.kind, "devis");
  assert.equal(care.header.monthlyHt, "2 580,00 €");
  assert.equal(care.header.annualHt, "30 960,00 €");
  assert.equal(care.header.engagement, "12 Mois");
  assert.equal(care.header.validity, "2026-12-01");
  assert.equal(care.parties.supplierName, "INFOGÉRANCE PRO SERVICES");
  assert.equal(care.parties.clientName, "GROUPE TEXTILE DU NORD SA");

  const bi = readOfferFile(
    `QUOTATION # UK-2026-771
DATA ANALYTICS UK LTD                                                                                     Date : 12/11/2026
                                                                                                    Valid Until : 12/12/2026
                                                                                                          Currency : GBP (£)
  SERVICE PROVIDER                                               CLIENT COMPANY
  DATA ANALYTICS UK LTD                                          BRITISH LOGISTICS GROUP LTD
                                                                           Subtotal Net :                      £20,550.00
                                                                           UK VAT (20.0%) :                     £4,110.00
                                                                           Total Payable :                   £24,660.00`,
    "devis-bi.txt",
  );
  assert.equal(bi.header.currency, "GBP");
  assert.equal(bi.header.validity, "12/12/2026");
  assert.equal(bi.header.totalHt, "£20,550.00");
  assert.equal(bi.header.totalDue, "£24,660.00");
  assert.match(bi.header.taxes.join(" "), /£4,110\.00/);
  assert.equal(bi.parties.clientName, "BRITISH LOGISTICS GROUP LTD");

  const training = readOfferFile(
    `LEARN IT ACADEMY SAS                                                          DEVIS N° FOR-2026-554
Date : 14/11/2026
Validité : 45 jours
  ORGANISME DE FORMATION                                              ENTREPRISE CLIENTE
  LEARN IT ACADEMY SAS                                                MUTUELLE ASSURANCE ET CONSEIL
                                                                                Total HT :                           8 300,00 €
                                                                                TVA (Exonéré - Art. 261-4-4°a
                                                                                                                          0,00 €
                                                                                du CGI) :
                                                                                                                     8 300,00
                                                                                Total à Payer Net :
                                                                                                                            €`,
    "devis-formation.txt",
  );
  assert.equal(training.header.validity, "2026-12-29");
  assert.equal(training.header.totalHt, "8 300,00 €");
  assert.equal(training.header.totalDue, "8 300,00 €");
  assert.match(training.header.taxes.join(" "), /261-4-4/);
  assert.equal(training.parties.clientName, "MUTUELLE ASSURANCE ET CONSEIL");

  const erp = readOfferFile(
    `Canada / Dollar Canadien (CAD $)
                                                                        SOUMISSION N° CA-2026-
339
Date : 16 novembre 2026
                                                                                             Valide jusqu'au : 16 décembre 2026
                                                                                                                 Devise : CAD ($)
  FOURNISSEUR                                                      CLIENT
  QUEBEC ERP SOLUTIONS INC.                                        MANUFACTURIERS DU ST-LAURENT LTEE
                                                                              Sous-total :                          35,700.00 $
                                                                              TPS (5.000%) :                         1,785.00 $
                                                                              TVQ (9.975%) :                         3,561.08 $
                                                                              Total Soumission :            41,046.08 $ CAD`,
    "devis-erp.txt",
  );
  assert.equal(erp.header.currency, "CAD");
  assert.equal(erp.header.reference, "CA-2026-339");
  assert.equal(erp.header.validity, "16 décembre 2026");
  assert.equal(erp.header.totalHt, "35,700.00 $");
  assert.equal(erp.header.totalDue, "41,046.08 $");
  assert.equal(erp.header.taxes.length, 2);
  assert.match(erp.header.taxes[0] ?? "", /TPS/);
  assert.match(erp.header.taxes[1] ?? "", /TVQ/);
  assert.equal(erp.header.taxes.join(" ").includes("5 346"), false);
  assert.equal(erp.parties.supplierName, "QUEBEC ERP SOLUTIONS INC.");
  assert.equal(erp.parties.clientName, "MANUFACTURIERS DU ST-LAURENT LTEE");
  assert.match(erp.header.method, /Les lignes ne sont pas additionnées/);
  assert.match(erp.header.method, /Aucune devise n’est convertie/);
});

test("la facture d’acompte garde sa nature et deux taxes", () => {
  const invoice = readOfferFile(
    `Apex Solutions Inc.                                                                                   FACTURE
                                                                                                          # FAC-2026-018
                                                                                                              ACOMPTE 50%
 ÉMETTEUR                                                             CLIENT
 Apex Solutions Inc.                                                  Logistique Nord-Avenir Ltée
                                                                                                           Référence Devise : CAD ($)
  Objet : Facture d'acompte (50%) pour le projet d'intégration ERP selon le Devis # DEV-2026-004
  Date d'émission : 15 octobre 2026 | Date d'échéance : 29 octobre 2026 (Payable sous 14 jours)
 Acompte de 50% à la signature du contrat
                                                                                            1                   16 250,00 $
                                                                         Sous-total HT :                        16 250,00 $
                                                                         TPS (5,00%) :                               812,50 $
                                                                         TVQ (9,975%) :                             1 620,94 $
                                                                         Total à payer (CAD) :               18 683,44 $
 Banque : Banque Nationale du Canada | Transit : 00123 | N° Institution : 006
 N° de compte : 1234-567-8901 | Projet : INT-ERP-2026`,
    "facture-acompte.txt",
  );
  assert.equal(invoice.kind, "facture");
  assert.equal(invoice.role, "acompte");
  assert.equal(invoice.header.currency, "CAD");
  assert.equal(invoice.header.reference, "FAC-2026-018");
  assert.equal(invoice.header.quoteReference, "DEV-2026-004");
  assert.equal(invoice.header.issuedOn, "15 octobre 2026");
  assert.equal(invoice.header.dueOn, "29 octobre 2026");
  assert.equal(invoice.header.paymentDelay, "14 jours");
  assert.equal(invoice.header.totalHt, "16 250,00 $");
  assert.equal(invoice.header.totalDue, "18 683,44 $");
  assert.match(invoice.header.deposit, /16 250,00 \$/);
  assert.equal(invoice.header.taxes.length, 2);
  assert.equal(invoice.parties.supplierName, "Apex Solutions Inc.");
  assert.equal(invoice.parties.clientName, "Logistique Nord-Avenir Ltée");
  assert.equal(accounts.some((token) => JSON.stringify(invoice.header).includes(token)), false);
  assert.equal(accounts.some((token) => invoice.enrichment.includes(token)), false);
  const proposal = proposeFromReading(invoice, "facture-acompte.txt", directory, []);
  assert.equal(proposal?.fields.find((field) => field.label === "Rôle")?.value, "Acompte");
  assert.equal(proposal?.fields.find((field) => field.label === "Devise")?.value, "CAD");
  assert.equal(proposal?.actions.some((action) => action.type === "add_quote_version"), false);
  assert.equal(documentWriteTargets("facture").includes("quote"), false);
});

test("une demande, une commande, une livraison et un avoir gardent leur titre", () => {
  const samples = [
    ["rfq", "DEMANDE DE CHIFFRAGE\nDemande n° RFQ-2026-010\nDate : 04/03/2026\nTotal HT : 1 200,00 €", "RFQ-2026-010"],
    ["commande", "BON DE COMMANDE\nCommande n° CMD-2026-044\nTotal HT : 500,00 €", "CMD-2026-044"],
    ["livraison", "BON DE LIVRAISON\nLivraison n° BL-2026-012\nTotal HT : 80,00 €", "BL-2026-012"],
    ["avoir", "AVOIR\nAvoir n° AV-2026-003\nTotal HT : 120,00 €", "AV-2026-003"],
  ] as const;
  for (const [kind, text, reference] of samples) {
    const reading = readOfferFile(text, `${kind}.txt`);
    assert.equal(reading.kind, kind);
    assert.equal(reading.header.reference, reference);
    assert.match(reading.header.totalHt, /€/);
    assert.equal(reading.offers.length, 0);
  }
});

test("une notice sans prix ne reçoit pas de montant", () => {
  const notice = readOfferFile(
    `NOTICE TECHNIQUE
Fabricant : Helios Instruments
Référence : HL-440
Capteur de pression différentielle. Aucun prix n’est indiqué.`,
    "notice-hl440.txt",
  );
  assert.equal(notice.kind, "fiche");
  assert.equal(notice.header.manufacturer, "Helios Instruments");
  assert.equal(notice.header.productReference, "HL-440");
  assert.equal(notice.header.totalHt, "");
  assert.equal(notice.header.totalDue, "");
  assert.equal(notice.header.taxes.length, 0);
  assert.equal(notice.header.currency, "");
  assert.equal(value(notice, "Fabricant"), "Helios Instruments");
});

test("un relevé recopie la période et les soldes, pas le compte", () => {
  const statement = readOfferFile(
    `RELEVÉ BANCAIRE
Période du 01/09/2026 au 30/09/2026
Client : Atelier Nord
Solde initial : 1 200,00 €
Solde final : 980,50 €
IBAN : FR76 3000 4012 3456 7890 1234 567
N° de compte : 1234-567-8901
Transit : 00123`,
    "releve.txt",
  );
  assert.equal(statement.kind, "releve");
  assert.match(statement.header.period, /01\/09\/2026 au 30\/09\/2026/);
  assert.equal(statement.header.balances.length, 2);
  assert.match(statement.header.balances.join(" "), /1 200,00 €/);
  assert.match(statement.header.balances.join(" "), /980,50 €/);
  assert.equal(accounts.some((token) => JSON.stringify(statement.header).includes(token)), false);
  assert.equal(accounts.some((token) => statement.enrichment.includes(token)), false);
  const proposal = proposeFromReading(statement, "releve.txt", directory, []);
  assert.deepEqual(documentWriteTargets("releve"), ["fichier"]);
  assert.equal(proposal?.actions.length, 0);
  assert.equal(proposal?.actions.some((action) => action.type === "create_client"), false);
});

test("le mensuel et l’annuel restent deux montants écrits", () => {
  const contract = readOfferFile(
    `CONTRAT DE MAINTENANCE
Contrat n° CT-2026-007
Date : 01/11/2026
Engagement ferme de 12 mois
Total mensuel HT : 100,00 €
soit un montant annuel engagé HT de 999,00 €`,
    "contrat-tarif.txt",
  );
  assert.equal(contract.kind, "contrat");
  assert.equal(contract.header.reference, "CT-2026-007");
  assert.equal(contract.header.monthlyHt, "100,00 €");
  assert.equal(contract.header.annualHt, "999,00 €");
  assert.equal(contract.header.engagement, "12 mois");
  const blob = `${JSON.stringify(contract.header)}\n${contract.enrichment}`;
  assert.equal(blob.includes("1 200"), false);
  assert.equal(blob.includes("1200"), false);

  const tariff = readOfferFile(
    `TARIF PUBLIC
Tarif n° TR-2026-002
Vis | 10,00 € HT
Écrou | 20,00 € HT
Total HT : 450,00 €`,
    "tarif.txt",
  );
  assert.equal(tariff.kind, "tarif");
  assert.equal(tariff.header.totalHt, "450,00 €");
  assert.equal(tariff.enrichment.includes("30,00"), false);
  assert.equal(documentWriteTargets("tarif").includes("quote"), true);
});

test("confirmer une facture n’écrit pas de pièce de vente", () => {
  const source = readFileSync("src/lib/document-proposals.ts", "utf8");
  assert.equal(source.includes("saleDocument.create"), false);
  assert.equal(documentWriteTargets("facture").includes("quote"), false);
  assert.deepEqual(documentWriteTargets("releve"), ["fichier"]);
  assert.equal(documentWriteTargets("devis").includes("quote"), true);
});
