import assert from "node:assert/strict";
import test from "node:test";
import { narrativeFits, renderPacket } from "../src/domain/answer-packet.ts";
import { readContractEntry } from "../src/domain/contracts.ts";
import { readEquipmentEntry } from "../src/domain/equipment.ts";
import { readInterventionEntry } from "../src/domain/interventions.ts";
import { formatCents } from "../src/domain/pricing.ts";
import {
  directPacket,
  gapPacket,
  overduePacket,
  outstandingPacket,
  purchaseGap,
  purchaseGapMessage,
  purchaseProposalPacket,
  readPurchaseEntry,
  readPurchaseQuestion,
  readSupplierTerms,
  subcontractPacket,
  termsGapMessage,
  termsProposalPacket,
  volumePacket,
  yearWindow,
  type StoredPurchase,
  type SupplierTerms,
} from "../src/domain/purchases.ts";

const now = new Date("2026-09-28T12:00:00Z");
const year = yearWindow(now);

const LINE =
  "Enregistre un achat pour Holzwerk Müller GmbH, désignation Baie commande, famille serveur, commandé le 2026-02-01, bon de commande 1 200,00 €, facture 1 250,00 €, reliquat ouvert, expédition le 2026-09-01, suivi COLIS-88, livraison directe";
const SUB =
  "Enregistre un achat pour Holzwerk Müller GmbH, désignation Câblage, famille sous-traitance, commandé le 2026-03-15, bon de commande 800,00 €, facture 800,00 €, reliquat clos, expédition le 2026-04-01, chez nous";
const OLD =
  "Enregistre un achat pour Holzwerk Müller GmbH, désignation Pose site, famille sous-traitance, commandé le 2025-11-01, bon de commande 500,00 €, reliquat ouvert, expédition le 2026-08-01, livraison directe";
const TERMS = "Enregistre un encours de 4 000,00 € et un paiement à 60 jours pour Holzwerk Müller GmbH";

function row(patch: Partial<StoredPurchase> & Pick<StoredPurchase, "designation" | "orderedOn" | "orderCents">): StoredPurchase {
  return {
    supplierName: "Holzwerk Müller GmbH",
    family: "serveur",
    invoiceCents: null,
    remainder: "ouvert",
    shipsOn: "",
    tracking: "",
    delivery: "chez_nous",
    ...patch,
  };
}

test("une phrase incomplète pose une seule question", () => {
  const sketch = readPurchaseEntry("Enregistre un achat pour Holzwerk Müller GmbH");
  assert.ok(sketch);
  assert.equal(purchaseGapMessage(sketch), "Indiquez la famille : serveur, poste, portable, réseau, prestation, autre ou sous-traitance.");
  const terms = readSupplierTerms("Enregistre un paiement à 60 jours pour Holzwerk Müller GmbH");
  assert.ok(terms);
  assert.equal(termsGapMessage(terms), "Indiquez le montant de l’encours.");
});

test("les phrases d’achat recopient les deux montants", () => {
  const line = readPurchaseEntry(LINE);
  assert.ok(line);
  assert.equal(purchaseGapMessage(line), null);
  assert.equal(line.family, "serveur");
  assert.equal(line.designation, "Baie commande");
  assert.equal(line.orderedOn, "2026-02-01");
  assert.equal(line.orderCents, 120_000);
  assert.equal(line.invoiceCents, 125_000);
  assert.equal(line.remainder, "ouvert");
  assert.equal(line.shipsOn, "2026-09-01");
  assert.equal(line.tracking, "COLIS-88");
  assert.equal(line.delivery, "chez_client");
  assert.equal(purchaseGap(line.orderCents, line.invoiceCents), 5_000);

  const sub = readPurchaseEntry(SUB);
  assert.equal(sub?.family, "sous-traitance");
  assert.equal(sub?.orderCents, 80_000);
  assert.equal(sub?.invoiceCents, 80_000);
  assert.equal(sub?.remainder, "clos");
  assert.equal(sub?.delivery, "chez_nous");

  const old = readPurchaseEntry(OLD);
  assert.equal(old?.invoiceCents, null);
  assert.equal(old?.orderedOn, "2025-11-01");
  assert.equal(purchaseGapMessage(old!), null);

  const terms = readSupplierTerms(TERMS);
  assert.equal(termsGapMessage(terms!), null);
  assert.equal(terms?.outstandingCents, 400_000);
  assert.equal(terms?.paymentDays, 60);
});

test("les questions d’achat ne sont pas des écritures", () => {
  assert.equal(readPurchaseQuestion("Quel est l’écart entre le bon de commande et la facture du grossiste ?")?.kind, "gap");
  assert.equal(readPurchaseQuestion("Quels reliquats ont une date d’expédition dépassée ?")?.kind, "overdue");
  assert.equal(readPurchaseQuestion("Quels numéros de suivi pour une livraison directe ?")?.kind, "direct");
  assert.deepEqual(readPurchaseQuestion("Quels grossistes ont un encours et un paiement à 60 jours ?"), {
    kind: "outstanding",
    days: 60,
    daysConflict: false,
  });
  assert.deepEqual(readPurchaseQuestion("Quel est le montant de sous-traitance depuis le début de l’année ?"), {
    kind: "subcontract",
    period: "year",
  });
  assert.deepEqual(readPurchaseQuestion("Quel est le volume d’achat par constructeur depuis le début de l’année ?"), {
    kind: "volume",
    period: "year",
  });
  assert.equal(readPurchaseEntry("Quel est l’écart entre le bon de commande et la facture ?"), null);
  assert.equal(readPurchaseQuestion(LINE), null);
  assert.equal(readContractEntry(LINE), null);
  assert.equal(readInterventionEntry(LINE), null);
  assert.equal(readEquipmentEntry(LINE), null);
});

test("les paquets comparent des centimes déjà enregistrés", () => {
  const rows = [
    row({
      designation: "Baie commande",
      orderedOn: "2026-02-01",
      orderCents: 120_000,
      invoiceCents: 125_000,
      remainder: "ouvert",
      shipsOn: "2026-09-01",
      tracking: "COLIS-88",
      delivery: "chez_client",
    }),
    row({
      designation: "Câblage",
      family: "sous-traitance",
      orderedOn: "2026-03-15",
      orderCents: 80_000,
      invoiceCents: 80_000,
      remainder: "clos",
      shipsOn: "2026-04-01",
      delivery: "chez_nous",
    }),
    row({
      designation: "Pose site",
      family: "sous-traitance",
      orderedOn: "2025-11-01",
      orderCents: 50_000,
      remainder: "ouvert",
      shipsOn: "2026-08-01",
      delivery: "chez_client",
    }),
    row({
      designation: "Seuil",
      orderedOn: "2026-09-28",
      orderCents: 10_000,
      invoiceCents: 10_000,
      remainder: "ouvert",
      shipsOn: "2026-09-28",
      delivery: "chez_nous",
    }),
  ];
  const gap = gapPacket({ rows, supplierName: "", pending: 1 });
  assert.equal(gap.measures.find((item) => item.label === "Écart")?.value, formatCents(5_000));
  assert.equal(gap.measures.find((item) => item.label === "Lignes")?.value, "3");
  assert.match(gap.missing.join(" "), /sans facture/);
  assert.match(gap.method, /deux montants déjà enregistrés/);
  assert.equal(narrativeFits(gap, renderPacket(gap)), true);

  const late = overduePacket({ rows, today: "2026-09-28", pending: 0 });
  assert.deepEqual(
    late.rows.map((item) => item.label),
    ["Holzwerk Müller GmbH · Baie commande", "Holzwerk Müller GmbH · Pose site"],
  );
  assert.equal(narrativeFits(late, renderPacket(late)), true);

  const direct = directPacket({ rows, pending: 0 });
  assert.deepEqual(direct.rows.map((item) => item.detail), ["suivi COLIS-88"]);
  assert.match(direct.missing.join(" "), /sans numéro de suivi/);
  assert.equal(narrativeFits(direct, renderPacket(direct)), true);

  const subcontract = subcontractPacket({ rows, ...year, pending: 0 });
  assert.equal(subcontract.measures[0]?.value, formatCents(80_000));
  assert.equal(subcontract.rows.length, 1);
  assert.equal(narrativeFits(subcontract, renderPacket(subcontract)), true);

  const volume = volumePacket({ rows, ...year, pending: 0 });
  assert.equal(volume.measures[0]?.value, formatCents(210_000));
  assert.equal(narrativeFits(volume, renderPacket(volume)), true);
});

test("l’encours à 60 jours ignore un délai différent et un encours nul", () => {
  const rows: SupplierTerms[] = [
    { supplierName: "Holzwerk Müller GmbH", outstandingCents: 400_000, paymentDays: 60 },
    { supplierName: "Menuiserie Lambert SAS", outstandingCents: 100_000, paymentDays: 30 },
    { supplierName: "Nordic Substation Systems AS", outstandingCents: 0, paymentDays: 60 },
  ];
  const packet = outstandingPacket({ rows, days: 60, pending: 0 });
  assert.deepEqual(packet.rows.map((item) => item.label), ["Holzwerk Müller GmbH"]);
  assert.equal(packet.measures.find((item) => item.label === "Encours")?.value, formatCents(400_000));
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});

test("la carte d’achat n’écrit rien avant confirmation", () => {
  const sketch = readPurchaseEntry(LINE);
  assert.ok(sketch?.family && sketch.remainder && sketch.delivery && sketch.orderCents !== null);
  const packet = purchaseProposalPacket({
    supplierName: "Holzwerk Müller GmbH",
    designation: sketch.designation,
    family: sketch.family,
    orderedOn: sketch.orderedOn,
    orderCents: sketch.orderCents,
    invoiceCents: sketch.invoiceCents,
    remainder: sketch.remainder,
    shipsOn: sketch.shipsOn,
    tracking: sketch.tracking,
    delivery: sketch.delivery,
    projectId: "",
    projectName: "",
    invoiceReference: "",
    invoiceOn: "",
  });
  assert.match(packet.missing.join(" "), /Rien n’est enregistré avant confirmation/);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
  const terms = readSupplierTerms(TERMS);
  assert.ok(terms?.outstandingCents !== null && terms.paymentDays);
  const card = termsProposalPacket({
    supplierName: "Holzwerk Müller GmbH",
    outstandingCents: terms.outstandingCents,
    paymentDays: terms.paymentDays,
  });
  assert.equal(narrativeFits(card, renderPacket(card)), true);
});
