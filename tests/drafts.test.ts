import assert from "node:assert/strict";
import test from "node:test";
import { narrativeFits, renderPacket } from "../src/domain/answer-packet.ts";
import { asksHybridQuote } from "../src/domain/hybrid-quote.ts";
import {
  daysBefore,
  invoiceDraftPacket,
  quoteDraftPacket,
  readDraftQuestion,
  trackingDraftPacket,
} from "../src/domain/drafts.ts";
import { formatCents } from "../src/domain/pricing.ts";
import { readPurchaseEntry, readPurchaseQuestion } from "../src/domain/purchases.ts";

const INVOICE = "Prépare une relance pour une facture en retard de 15 jours";
const TRACKING = "Prépare une relance de tracking pour Quincaillerie Durand";
const QUOTE = "Prépare une demande de cotation spéciale pour Latitude 5440 auprès de Quincaillerie Durand";
const PURCHASE =
  "Enregistre un achat pour Quincaillerie Durand, désignation Relance baie, famille serveur, commandé le 2026-08-01, bon de commande 400,00 €, facture 400,00 €, référence FAC-88, facture le 2026-08-01, reliquat clos, chez nous.";

test("un brouillon n’est pas un devis ni une mesure d’achat", () => {
  assert.equal(readDraftQuestion(INVOICE)?.kind, "invoice");
  assert.equal(readDraftQuestion("Prépare une relance de facture")?.kind, "invoice");
  assert.equal(readDraftQuestion(TRACKING)?.kind, "tracking");
  assert.equal(readDraftQuestion(QUOTE)?.kind, "quote");
  assert.equal(readDraftQuestion("prépare un devis pour Atelier Nord"), null);
  assert.equal(asksHybridQuote(INVOICE), false);
  assert.equal(readPurchaseQuestion(TRACKING), null);
  assert.equal(readPurchaseEntry(INVOICE), null);
  const invoice = readDraftQuestion(INVOICE);
  assert.equal(invoice?.kind === "invoice" && invoice.days, 15);
});

test("la phrase d’achat recopie la référence et la date, sans en inventer", () => {
  const sketch = readPurchaseEntry(PURCHASE);
  assert.equal(sketch?.invoiceReference, "FAC-88");
  assert.equal(sketch?.invoiceOn, "2026-08-01");
  assert.equal(sketch?.invoiceCents, 40_000);
  assert.equal(readPurchaseEntry("Enregistre un achat pour Durand, facture 10,00 €")?.invoiceReference, "");
});

test("la relance ne part qu’avec une référence, une date et le retard demandé", () => {
  assert.equal(daysBefore("2026-08-01", "2026-09-28"), 58);
  assert.equal(daysBefore("2026-09-20", "2026-09-28"), 8);
  const packet = invoiceDraftPacket({
    today: "2026-09-28",
    days: 15,
    rows: [
      {
        supplierName: "Quincaillerie Durand",
        designation: "Relance baie",
        invoiceReference: "FAC-88",
        invoiceOn: "2026-08-01",
        invoiceCents: 40_000,
      },
      {
        supplierName: "Quincaillerie Durand",
        designation: "Relance recente",
        invoiceReference: "FAC-90",
        invoiceOn: "2026-09-20",
        invoiceCents: 5_000,
      },
      {
        supplierName: "Fournitures Helios",
        designation: "Sans pièce",
        invoiceReference: "",
        invoiceOn: "2026-01-01",
        invoiceCents: 1_000,
      },
    ],
  });
  assert.equal(packet.measures[0]?.value, "1");
  assert.match(packet.rows[0]?.detail ?? "", /FAC-88/);
  assert.match(packet.rows[0]?.detail ?? "", /2026-08-01/);
  assert.match(packet.rows[0]?.detail ?? "", new RegExp(formatCents(40_000).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(packet.rows.some((row) => row.detail.includes("FAC-90")), false);
  assert.match(packet.missing.join(" "), /sans référence ou sans date/);
  assert.match(packet.missing.join(" "), /Rien n’est envoyé/);
  assert.match(packet.method, /n’est attribué/);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});

test("le suivi recopié est celui déjà enregistré", () => {
  const packet = trackingDraftPacket({
    supplierName: "Quincaillerie Durand",
    rows: [
      { supplierName: "Quincaillerie Durand", designation: "Baie commande", orderedOn: "2026-02-01", tracking: "COLIS-88" },
      { supplierName: "Quincaillerie Durand", designation: "Câblage", orderedOn: "2026-03-15", tracking: "" },
    ],
  });
  assert.match(packet.rows[0]?.detail ?? "", /COLIS-88/);
  assert.match(packet.rows[0]?.detail ?? "", /2026-02-01/);
  assert.equal(packet.rows.some((row) => row.detail.includes("Câblage")), false);
  assert.match(packet.missing.join(" "), /sans numéro de suivi/);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});

test("la cotation ne recopie pas un prix absent", () => {
  const packet = quoteDraftPacket({
    supplierName: "Quincaillerie Durand",
    productName: "Latitude 5440",
    reference: "LAT-5440",
    costCents: null,
  });
  assert.match(packet.rows[0]?.detail ?? "", /LAT-5440/);
  assert.equal(packet.rows[0]?.detail.includes("€"), false);
  assert.match(packet.missing.join(" "), /Aucun coût écrit/);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});
