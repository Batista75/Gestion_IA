import assert from "node:assert/strict";
import test from "node:test";
import {
  foreignFigures,
  narrativeFits,
  renderPacket,
  safeReply,
  type AnswerPacket,
} from "../src/domain/answer-packet.ts";
import {
  averageLineMargin,
  bestTariffPacket,
  lastCustomerOrder,
  previousMonthWindow,
  raisedWholesalePrices,
  readMeasureQuestion,
} from "../src/domain/measures.ts";

const packet: AnswerPacket = {
  title: "Lecture",
  period: "août 2026",
  filters: ["Serveur"],
  measures: [{ label: "Moyenne", value: "150,00 €" }],
  rows: [{ label: "NL-440", detail: "Offre 640,00 €" }],
  sources: ["Offres fournisseur"],
  missing: [],
  method: "Les centimes sont déjà enregistrés.",
};

test("une phrase qui ajoute un montant est refusée", () => {
  assert.deepEqual(foreignFigures(packet, "La moyenne est 150,00 €."), []);
  assert.equal(narrativeFits(packet, "La moyenne est 9 000,00 €."), false);
  assert.equal(foreignFigures(packet, "Référence DEV-NL-4418").some((item) => item.includes("DEV-NL-4418")), true);
  assert.equal(narrativeFits(packet, "Rien à ajouter."), true);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
  assert.equal(safeReply(packet), renderPacket(packet));
});

test("les exemples de questions ouvrent une famille", () => {
  const margin = readMeasureQuestion(
    "Quelle marge brute moyenne avons-nous réalisée sur la revente de serveurs et postes de travail le mois dernier ?",
  );
  assert.equal(margin?.kind, "average_margin");
  if (margin?.kind === "average_margin") {
    assert.deepEqual(margin.families, ["serveur", "poste"]);
    assert.equal(margin.period, "previous_month");
  }
  const tariff = readMeasureQuestion("Quel grossiste propose le meilleur tarif pour la référence NL-440 ?");
  assert.deepEqual(tariff, { kind: "best_tariff", reference: "NL-440" });
  const waiting = readMeasureQuestion(
    "Avons-nous des devis en attente contenant du matériel dont les prix grossistes ont augmenté depuis l’émission ?",
  );
  assert.equal(waiting?.kind, "raised_prices");
  const order = readMeasureQuestion(
    "Peux-tu me ressortir la configuration matérielle exacte et les options vendues au client Nordic lors de sa dernière commande ?",
  );
  assert.deepEqual(order, { kind: "last_order", client: "Nordic" });
  const report = readMeasureQuestion("Retrouve le procès-verbal de recette signé chez le client Portuaire.");
  assert.deepEqual(report, { kind: "reception_report", client: "Portuaire" });
});

test("la marge moyenne ne retient que la catégorie et le mois", () => {
  const window = previousMonthWindow(new Date("2026-09-15T12:00:00Z"));
  assert.equal(window.label, "août 2026");
  const result = averageLineMargin({
    lines: [
      { family: "serveur", confirmedAt: new Date("2026-08-10T00:00:00Z"), marginCents: 1000 },
      { family: "poste", confirmedAt: new Date("2026-08-20T00:00:00Z"), marginCents: 3000 },
      { family: "serveur", confirmedAt: new Date("2026-07-10T00:00:00Z"), marginCents: 9000 },
      { family: "portable", confirmedAt: new Date("2026-08-12T00:00:00Z"), marginCents: 500 },
      { family: "", confirmedAt: new Date("2026-08-12T00:00:00Z"), marginCents: 100 },
    ],
    families: ["serveur", "poste"],
    from: window.from,
    to: window.to,
    periodLabel: window.label,
  });
  assert.equal(result.measures.find((measure) => measure.label === "Moyenne")?.value, "20,00 €");
  assert.equal(result.measures.find((measure) => measure.label === "Lignes retenues")?.value, "2");
  assert.match(result.missing.join(" "), /1 ligne/);
  assert.equal(narrativeFits(result, renderPacket(result)), true);
});

test("un devis en attente ne sort que si l’offre plus tardive est plus chère", () => {
  const issued = new Date("2026-08-01T00:00:00Z");
  const result = raisedWholesalePrices([
    {
      documentTitle: "Devis kit",
      clientName: "Helios",
      productName: "Kit",
      reference: "NL-440",
      costCents: 64000,
      issuedAt: issued,
      offers: [{ cents: 69000, at: new Date("2026-08-20T00:00:00Z"), supplierName: "Nordlicht", statedCost: "690,00 €" }],
    },
    {
      documentTitle: "Devis stable",
      clientName: "Helios",
      productName: "Sonde",
      reference: "SC-12",
      costCents: 4800,
      issuedAt: issued,
      offers: [{ cents: 4000, at: new Date("2026-08-20T00:00:00Z"), supplierName: "Nordlicht", statedCost: "40,00 €" }],
    },
  ]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.label, "NL-440");
  assert.match(result.rows[0]?.detail ?? "", /690,00 €/);
});

test("la dernière commande est la plus récente du client nommé", () => {
  const result = lastCustomerOrder(
    [
      {
        title: "Ancienne",
        clientName: "Nordic Substation Systems AS",
        at: new Date("2026-01-01T00:00:00Z"),
        lines: [{ name: "Ancien compteur", quantity: 1, supplierName: "Baltic", family: "" }],
      },
      {
        title: "Récente",
        clientName: "Nordic Substation Systems AS",
        at: new Date("2026-08-01T00:00:00Z"),
        lines: [{ name: "Compteur triphasé", quantity: 40, supplierName: "Baltic Sensors OÜ", family: "" }],
      },
    ],
    "Nordic",
  );
  assert.match(result.title, /Nordic Substation/);
  assert.equal(result.rows[0]?.label, "Compteur triphasé");
  assert.match(result.rows[0]?.detail ?? "", /quantité 40/);
});

test("le meilleur tarif reprend le classement déjà fait", () => {
  const result = bestTariffPacket(
    "NL-440",
    [
      { supplierName: "Nordlicht", statedCost: "640,00 €", lowest: true },
      { supplierName: "Autre", statedCost: "690,00 €", lowest: false },
    ],
    "Le prix le plus bas est le plus petit nombre de centimes déjà lu. Aucune somme n’est faite.",
  );
  assert.equal(result.measures[0]?.value, "640,00 €");
  assert.equal(result.rows.length, 2);
  const missing = bestTariffPacket("", [], "");
  assert.match(missing.missing[0] ?? "", /référence/);
});
