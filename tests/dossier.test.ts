import assert from "node:assert/strict";
import test from "node:test";
import { narrativeFits, renderPacket } from "../src/domain/answer-packet.ts";
import {
  hourAmountCents,
  profitPacket,
  projectIsOpen,
  readDossierQuestion,
  receivedPacket,
  stockPacket,
  unrecoveredPacket,
} from "../src/domain/dossier.ts";
import { formatCents } from "../src/domain/pricing.ts";
import { dossierNameOf, readPurchaseEntry } from "../src/domain/purchases.ts";

const PROFIT = "Quelle est la rentabilité réelle du projet Lampes Nord ?";
const STOCK = "Quelle est la valeur du stock atelier et la part déjà réservée ?";
const RECEIVED = "Quel matériel a été réceptionné sans intervention planifiée ?";
const MISSING = "Quel matériel acheté pour le chantier Lampes Nord est encore absent du devis ou de la facture constatée ?";
const PURCHASE =
  "Enregistre un achat pour Quincaillerie Durand, désignation Switch spare, dossier Lampes Nord, famille réseau, commandé le 2026-09-01, bon de commande 200,00 €, reliquat clos, chez nous.";

test("les quatre questions de dossier ne sont pas des écritures", () => {
  assert.equal(readDossierQuestion(PROFIT)?.kind, "profit");
  assert.equal(readDossierQuestion(STOCK)?.kind, "stock");
  assert.equal(readDossierQuestion(RECEIVED)?.kind, "received");
  assert.equal(readDossierQuestion(MISSING)?.kind, "unrecovered");
  assert.equal(readDossierQuestion(PURCHASE), null);
  assert.equal(readPurchaseEntry(PROFIT), null);
  assert.equal(dossierNameOf(PURCHASE), "Lampes Nord");
  assert.equal(projectIsOpen("À qualifier"), true);
  assert.equal(projectIsOpen("Gagné"), true);
  assert.equal(projectIsOpen("Clos"), false);
});

test("une heure confirmée multiplie la durée par le taux horaire", () => {
  assert.equal(hourAmountCents({ durationMinutes: 240, rateUnit: "horaire", rateCents: 9000 }), 36_000);
  assert.equal(hourAmountCents({ durationMinutes: 60, rateUnit: "horaire", rateCents: 9000 }), 9_000);
  assert.equal(hourAmountCents({ durationMinutes: 480, rateUnit: "journalier", rateCents: 70000 }), null);
});

test("la rentabilité sépare quatre nombres déjà stockés", () => {
  const packet = profitPacket({
    projectName: "Lampes Nord",
    sales: [
      { name: "Latitude 5440", family: "portable", kind: "produit", quantity: 10, saleUnitCents: 100_000 },
      { name: "Préparation atelier", family: "prestation", kind: "service", quantity: 1, saleUnitCents: 11_429 },
    ],
    purchases: [{ designation: "Switch spare", orderCents: 20_000 }],
    hours: [
      { label: "Intégration réseau", occurredOn: "2026-09-15", durationMinutes: 240, rateUnit: "horaire", rateCents: 9000 },
      { label: "Journée", occurredOn: "2026-09-16", durationMinutes: 480, rateUnit: "journalier", rateCents: 70_000 },
    ],
    unconfirmedQuotes: 1,
  });
  assert.equal(packet.measures.find((item) => item.label === "Matériel")?.value, formatCents(1_000_000));
  assert.equal(packet.measures.find((item) => item.label === "Prestations")?.value, formatCents(11_429));
  assert.equal(packet.measures.find((item) => item.label === "Achats")?.value, formatCents(20_000));
  assert.equal(packet.measures.find((item) => item.label === "Heures")?.value, formatCents(36_000));
  assert.match(packet.missing.join(" "), /devis non confirmé/);
  assert.match(packet.missing.join(" "), /journalier/);
  assert.match(packet.method, /quatre nombres restent séparés/);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});

test("le stock additionne le coût écrit et les quantités ouvertes", () => {
  const packet = stockPacket({
    products: [
      { name: "Préparation atelier", stockQty: 4, costCents: 8_000 },
      { name: "Latitude 5440", stockQty: 2, costCents: null },
      { name: "Vis à bois", stockQty: null, costCents: 10 },
    ],
    lines: [
      { projectName: "Lampes Nord", open: true, quantity: 3 },
      { projectName: "Atlas clos", open: false, quantity: 9 },
    ],
  });
  assert.equal(packet.measures.find((item) => item.label === "Valeur")?.value, formatCents(32_000));
  assert.equal(packet.measures.find((item) => item.label === "Réservée")?.value, "3");
  assert.equal(packet.rows.some((row) => row.label === "Atlas clos"), false);
  assert.match(packet.missing.join(" "), /sans coût écrit/);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});

test("une réception close sans date à venir est listée", () => {
  const packet = receivedPacket({
    today: "2026-09-28",
    purchases: [
      { designation: "Câblage", projectId: "", projectName: "", remainder: "clos" },
      { designation: "Switch spare", projectId: "lampes", projectName: "Lampes Nord", remainder: "clos" },
      { designation: "Baie commande", projectId: "lampes", projectName: "Lampes Nord", remainder: "ouvert" },
      { designation: "Pose site", projectId: "autre", projectName: "Autre", remainder: "clos" },
    ],
    interventions: [
      { projectId: "lampes", occurredOn: "2026-09-18" },
      { projectId: "autre", occurredOn: "2026-10-02" },
    ],
  });
  assert.deepEqual(packet.rows.map((row) => row.label), ["Câblage", "Switch spare"]);
  assert.equal(packet.measures[0]?.value, "2");
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});

test("un achat déjà nommé sur le devis n’est pas listé comme absent", () => {
  const packet = unrecoveredPacket({
    projectName: "Lampes Nord",
    purchases: [{ designation: "Latitude 5440" }, { designation: "Switch spare" }, { designation: "BL-da68" }],
    quoteNames: ["Latitude 5440", "LAT-5440"],
    notedReferences: ["BL-da68"],
  });
  assert.deepEqual(packet.rows.map((row) => row.label), ["Switch spare"]);
  assert.match(packet.method, /Aucune facture n’est créée/);
  assert.match(packet.missing.join(" "), /Aucune facture n’est créée/);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});
