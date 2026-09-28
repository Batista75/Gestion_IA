import assert from "node:assert/strict";
import test from "node:test";
import { narrativeFits, renderPacket } from "../src/domain/answer-packet.ts";
import { cashWeekPacket, readCashQuestion, weekWindow } from "../src/domain/cash.ts";
import { readContractQuestion } from "../src/domain/contracts.ts";
import { formatCents } from "../src/domain/pricing.ts";
import { readPurchaseQuestion } from "../src/domain/purchases.ts";

const WEEK = "Quelles sont les échéances grossistes à payer et les encaissements clients attendus cette semaine ?";

test("la semaine UTC commence le lundi", () => {
  assert.deepEqual(weekWindow(new Date("2026-09-28T12:00:00Z")), {
    from: "2026-09-28",
    to: "2026-10-05",
    label: "semaine en cours",
  });
  assert.equal(weekWindow(new Date("2026-10-04T12:00:00Z")).from, "2026-09-28");
  assert.equal(weekWindow(new Date("2026-10-05T12:00:00Z")).from, "2026-10-05");
});

test("la question de trésorerie n’est pas un contrat ni un encours", () => {
  assert.equal(readCashQuestion(WEEK)?.period, "week");
  assert.equal(readCashQuestion("Quelle est la trésorerie ?")?.period, "missing");
  assert.equal(readCashQuestion("Quelle est la trésorerie du mois ?")?.period, "unsupported");
  assert.equal(readContractQuestion(WEEK), null);
  assert.equal(readPurchaseQuestion(WEEK), null);
  assert.equal(readCashQuestion("Quels contrats arrivent à échéance dans 30 jours ?"), null);
});

test("la semaine liste la facture datée plus le délai confirmé, sans pénalité", () => {
  const packet = cashWeekPacket({
    from: "2026-09-28",
    to: "2026-10-05",
    undatedReceipts: 0,
    receipts: [],
    suppliers: [
      {
        supplierName: "Quincaillerie Durand",
        designation: "Relance baie",
        invoiceOn: "2026-08-01",
        invoiceCents: 40_000,
        paymentDays: 60,
      },
      {
        supplierName: "Quincaillerie Durand",
        designation: "Relance recente",
        invoiceOn: "2026-09-20",
        invoiceCents: 5_000,
        paymentDays: 60,
      },
      {
        supplierName: "Fournitures Helios",
        designation: "Sans date",
        invoiceOn: "",
        invoiceCents: 12_000,
        paymentDays: 30,
      },
    ],
  });
  assert.equal(packet.measures.find((item) => item.label === "À payer")?.value, formatCents(40_000));
  assert.equal(packet.measures.find((item) => item.label === "À encaisser")?.value, "non indiqué");
  assert.match(packet.rows[0]?.detail ?? "", /2026-09-30/);
  assert.equal(packet.rows.some((row) => row.detail.includes("Relance recente")), false);
  assert.match(packet.missing.join(" "), /sans date de facture/);
  assert.match(packet.missing.join(" "), /Aucun encaissement client/);
  assert.match(packet.missing.join(" "), /Aucune pénalité/);
  assert.match(packet.method, /rapprochement bancaire/);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});
