import assert from "node:assert/strict";
import test from "node:test";
import { narrativeFits, renderPacket } from "../src/domain/answer-packet.ts";
import {
  claimGap,
  claimProposalPacket,
  claimsPacket,
  monthWindow,
  readClaimEntry,
  readClaimQuestion,
  readReturnEntry,
  returnGap,
  returnProposalPacket,
  returnsPacket,
  type StoredClaim,
  type StoredReturn,
} from "../src/domain/claims.ts";
import { readContractEntry } from "../src/domain/contracts.ts";
import { readEquipmentEntry } from "../src/domain/equipment.ts";
import { readInterventionEntry } from "../src/domain/interventions.ts";
import { readPurchaseEntry } from "../src/domain/purchases.ts";

const now = new Date("2026-09-28T12:00:00Z");

const UNPACKED =
  "Enregistre une réclamation pour panne au déballage, client Atelier Nord, le 2026-09-10, ouverte, texte Carton écrasé à la livraison.";
const LATE =
  "Enregistre une réclamation pour retard de livraison, client Atelier Nord, le 2026-09-12, en cours, texte Colis annoncé le 2 septembre, reçu le 12.";
const OLD =
  "Enregistre une réclamation pour panne au déballage, client Atelier Nord, le 2026-08-20, ouverte, texte Hors mois.";
const RETURN =
  "Enregistre un retour sous garantie pour Atelier Nord, le 2026-09-18, en cours, texte Écran fissuré.";
const SWAP =
  "Enregistre un remplacement sous garantie pour Atelier Nord, le 2026-09-20, en cours, texte Baie échangée.";
const REFUSED =
  "Enregistre un retour hors garantie pour Atelier Nord, le 2026-09-05, clos, texte Refus client.";

test("le mois des réclamations est le mois UTC", () => {
  assert.deepEqual(monthWindow(now), { from: "2026-09-01", to: "2026-10-01", label: "septembre 2026" });
});

test("une réclamation incomplète pose une seule question", () => {
  const sketch = readClaimEntry("Enregistre une réclamation pour Atelier Nord");
  assert.ok(sketch);
  assert.equal(claimGap(sketch), "Indiquez le type : panne au déballage ou retard de livraison.");
  assert.equal(readClaimQuestion("Enregistre une réclamation pour Atelier Nord"), null);
});

test("les phrases recopient le texte constaté", () => {
  const unpacked = readClaimEntry(UNPACKED);
  assert.ok(unpacked);
  assert.equal(claimGap(unpacked), null);
  assert.equal(unpacked.kind, "deballage");
  assert.equal(unpacked.status, "ouverte");
  assert.equal(unpacked.occurredOn, "2026-09-10");
  assert.equal(unpacked.note, "Carton écrasé à la livraison.");

  const late = readClaimEntry(LATE);
  assert.equal(late?.kind, "retard");
  assert.equal(late?.status, "en_cours");
  assert.match(late?.note ?? "", /reçu le 12/);

  const back = readReturnEntry(RETURN);
  assert.ok(back);
  assert.equal(returnGap(back), null);
  assert.equal(back.kind, "retour");
  assert.equal(back.underWarranty, true);
  assert.equal(back.status, "en_cours");
  assert.equal(back.note, "Écran fissuré.");

  const swap = readReturnEntry(SWAP);
  assert.equal(swap?.kind, "remplacement");
  const refused = readReturnEntry(REFUSED);
  assert.equal(refused?.underWarranty, false);
  assert.equal(refused?.status, "clos");
});

test("une panne au déballage n’est pas une intervention", () => {
  assert.equal(readClaimEntry(OLD)?.occurredOn, "2026-08-20");
  assert.equal(readInterventionEntry(UNPACKED), null);
  assert.equal(readInterventionEntry(OLD), null);
  assert.equal(readContractEntry(UNPACKED), null);
  assert.equal(readEquipmentEntry(RETURN), null);
  assert.equal(readPurchaseEntry(UNPACKED), null);
  assert.equal(readClaimEntry("Résumé des réclamations du mois pour panne au déballage ou retard de livraison"), null);
  assert.deepEqual(readClaimQuestion("Résumé des réclamations du mois pour panne au déballage ou retard de livraison"), {
    kind: "claims",
    types: ["deballage", "retard"],
    period: "month",
  });
  assert.equal(readReturnEntry("Quelles demandes de retour et remplacements sous garantie sont en cours ?"), null);
  const question = readClaimQuestion("Quelles demandes de retour et remplacements sous garantie sont en cours ?");
  assert.equal(question?.kind, "returns");
  if (question?.kind === "returns") {
    assert.deepEqual(question.types, ["retour", "remplacement"]);
    assert.equal(question.warranty, true);
    assert.equal(question.openOnly, true);
  }
});

test("le résumé filtre le mois et recopie le texte", () => {
  const rows: StoredClaim[] = [
    { clientName: "Atelier Nord", kind: "deballage", occurredOn: "2026-09-10", status: "ouverte", note: "Carton écrasé à la livraison." },
    { clientName: "Atelier Nord", kind: "retard", occurredOn: "2026-09-12", status: "en_cours", note: "Colis annoncé le 2 septembre, reçu le 12." },
    { clientName: "Atelier Nord", kind: "deballage", occurredOn: "2026-08-20", status: "ouverte", note: "Hors mois." },
  ];
  const month = monthWindow(now);
  const packet = claimsPacket({ rows, types: ["deballage", "retard"], ...month, pending: 1 });
  assert.equal(packet.measures[0]?.value, "2");
  assert.match(packet.rows.map((row) => row.detail).join(" "), /Carton écrasé/);
  assert.match(packet.rows.map((row) => row.detail).join(" "), /reçu le 12/);
  assert.equal(packet.rows.some((row) => row.detail.includes("Hors mois")), false);
  assert.match(packet.method, /déjà enregistré/);
  assert.match(packet.missing.join(" "), /n’est pas comptée/);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});

test("les retours en cours sous garantie ignorent le clos et le hors garantie", () => {
  const rows: StoredReturn[] = [
    { clientName: "Atelier Nord", kind: "retour", occurredOn: "2026-09-18", status: "en_cours", underWarranty: true, note: "Écran fissuré." },
    { clientName: "Atelier Nord", kind: "remplacement", occurredOn: "2026-09-20", status: "en_cours", underWarranty: true, note: "Baie échangée." },
    { clientName: "Atelier Nord", kind: "retour", occurredOn: "2026-09-05", status: "clos", underWarranty: false, note: "Refus client." },
    { clientName: "Atelier Nord", kind: "retour", occurredOn: "2026-09-06", status: "en_cours", underWarranty: false, note: "Hors garantie encore ouvert." },
  ];
  const packet = returnsPacket({ rows, types: ["retour", "remplacement"], pending: 0 });
  assert.equal(packet.measures[0]?.value, "2");
  assert.match(packet.rows.map((row) => row.detail).join(" "), /Écran fissuré/);
  assert.match(packet.rows.map((row) => row.detail).join(" "), /Baie échangée/);
  assert.equal(packet.rows.some((row) => row.detail.includes("Refus client")), false);
  assert.equal(packet.rows.some((row) => row.detail.includes("Hors garantie")), false);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});

test("les cartes n’écrivent rien avant confirmation", () => {
  const claim = readClaimEntry(UNPACKED);
  assert.ok(claim?.kind && claim.status);
  const claimCard = claimProposalPacket({
    clientName: "Atelier Nord",
    kind: claim.kind,
    occurredOn: claim.occurredOn,
    status: claim.status,
    note: claim.note,
  });
  assert.match(claimCard.missing.join(" "), /Rien n’est enregistré avant confirmation/);
  assert.equal(narrativeFits(claimCard, renderPacket(claimCard)), true);
  const back = readReturnEntry(RETURN);
  assert.ok(back?.kind && back.status && back.underWarranty !== null);
  const returnCard = returnProposalPacket({
    clientName: "Atelier Nord",
    kind: back.kind,
    occurredOn: back.occurredOn,
    status: back.status,
    underWarranty: back.underWarranty,
    note: back.note,
  });
  assert.equal(narrativeFits(returnCard, renderPacket(returnCard)), true);
});
