import assert from "node:assert/strict";
import test from "node:test";
import { narrativeFits, renderPacket } from "../src/domain/answer-packet.ts";
import {
  averageRatePacket,
  delayDays,
  delayPacket,
  formatMinutes,
  monthWindow,
  quarterWindow,
  readInterventionEntry,
  readTimeQuestion,
  recapPacket,
  threeMonthWindow,
  unbilledHoursPacket,
  type StoredIntervention,
} from "../src/domain/interventions.ts";
import { formatCents } from "../src/domain/pricing.ts";

const now = new Date("2026-09-28T12:00:00Z");

function row(patch: Partial<StoredIntervention> & Pick<StoredIntervention, "kind" | "occurredOn" | "durationMinutes">): StoredIntervention {
  return {
    clientName: "Atelier Nord",
    projectName: "Lampes Nord",
    rateUnit: "horaire",
    rateCents: 8000,
    ticket: "",
    billedReference: "",
    onSite: false,
    underContract: false,
    requestedOn: "",
    arrivedOn: "",
    ...patch,
  };
}

test("les fenêtres de temps sont des dates UTC", () => {
  assert.deepEqual(quarterWindow(now), { from: "2026-07-01", to: "2026-10-01", label: "T3 2026" });
  assert.equal(monthWindow(now).from, "2026-09-01");
  assert.equal(monthWindow(now).to, "2026-10-01");
  assert.match(monthWindow(now).label, /septembre 2026/);
  assert.deepEqual(threeMonthWindow(now), { from: "2026-07-01", to: "2026-10-01", label: "2026-07-01 → 2026-10-01" });
  assert.equal(delayDays("2026-09-16", "2026-09-18"), 2);
  assert.equal(delayDays("2026-09-18", "2026-09-16"), null);
  assert.equal(formatMinutes(300), "5 h");
});

test("le taux moyen ne mélange pas l’heure et la journée", () => {
  const quarter = quarterWindow(now);
  const packet = averageRatePacket({
    rows: [
      row({ kind: "integration", occurredOn: "2026-09-15", durationMinutes: 240, rateCents: 9000 }),
      row({ kind: "integration", occurredOn: "2026-08-02", durationMinutes: 60, rateCents: 11000 }),
      row({ kind: "integration", occurredOn: "2026-08-03", durationMinutes: 60, rateUnit: "journalier", rateCents: 50000 }),
      row({ kind: "assistance", occurredOn: "2026-09-10", durationMinutes: 60, rateCents: 1000 }),
    ],
    types: ["integration"],
    unit: "horaire",
    ...quarter,
    pending: 0,
  });
  assert.equal(packet.measures.find((measure) => measure.label === "Horaire")?.value, formatCents(10000));
  assert.equal(packet.measures.find((measure) => measure.label === "Interventions horaire")?.value, "2");
  assert.equal(packet.rows.some((line) => /Assistance/.test(line.detail)), false);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
  assert.equal(readTimeQuestion("prépare un devis pour Atelier Nord"), null);
  assert.equal(readTimeQuestion("Quel est le taux horaire moyen facturé pour l’intégration réseau ce trimestre ?")?.kind, "average_rate");
});

test("les heures non facturées ignorent la pièce déjà écrite", () => {
  const month = monthWindow(now);
  const packet = unbilledHoursPacket({
    rows: [
      row({ kind: "assistance", occurredOn: "2026-09-10", durationMinutes: 120 }),
      row({ kind: "assistance", occurredOn: "2026-09-20", durationMinutes: 180, ticket: "T-18" }),
      row({ kind: "assistance", occurredOn: "2026-09-12", durationMinutes: 60, billedReference: "F-77" }),
      row({ kind: "integration", occurredOn: "2026-09-15", durationMinutes: 240 }),
    ],
    types: ["assistance", "intervention"],
    ...month,
    pending: 0,
  });
  assert.equal(packet.measures.find((measure) => measure.label === "Heures")?.value, "5 h");
  assert.equal(packet.measures.find((measure) => measure.label === "Interventions")?.value, "2");
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});

test("le récapitulatif additionne les durées et recopie le ticket", () => {
  const packet = recapPacket({
    rows: [
      row({ kind: "assistance", occurredOn: "2026-09-20", durationMinutes: 180, ticket: "T-18" }),
      row({ kind: "panne", occurredOn: "2026-09-18", durationMinutes: 120 }),
    ],
    clientName: "Atelier Nord",
    pending: 0,
  });
  assert.equal(packet.measures.find((measure) => measure.label === "Tickets")?.value, "1");
  assert.equal(packet.measures.find((measure) => measure.label === "Heures")?.value, "5 h");
  assert.match(packet.method, /Aucun montant de forfait/);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});

test("le délai moyen compare deux dates déjà enregistrées", () => {
  const window = threeMonthWindow(now);
  const packet = delayPacket({
    rows: [
      row({
        kind: "panne",
        occurredOn: "2026-09-18",
        durationMinutes: 120,
        onSite: true,
        underContract: true,
        requestedOn: "2026-09-16",
        arrivedOn: "2026-09-18",
      }),
      row({
        kind: "panne",
        occurredOn: "2026-09-11",
        durationMinutes: 60,
        onSite: false,
        underContract: true,
        requestedOn: "2026-09-01",
        arrivedOn: "2026-09-11",
      }),
    ],
    ...window,
    pending: 0,
  });
  assert.equal(packet.measures.find((measure) => measure.label === "Délai")?.value, "2 jours");
  assert.equal(packet.measures.find((measure) => measure.label === "Interventions")?.value, "1");
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});

test("une intervention incomplète pose une seule question, et la phrase complète garde le taux", () => {
  const gap = readInterventionEntry("Enregistre un ticket pour Atelier Nord");
  assert.equal(gap?.ready, false);
  if (gap && !gap.ready) assert.match(gap.missing, /type/);
  const ready = readInterventionEntry(
    "Enregistre une intégration réseau pour Atelier Nord, dossier Lampes Nord, le 2026-09-15, 4 heures, taux horaire 90,00 €",
  );
  assert.equal(ready?.ready, true);
  if (ready && ready.ready) {
    assert.equal(ready.draft.kind, "integration");
    assert.equal(ready.draft.occurredOn, "2026-09-15");
    assert.equal(ready.draft.durationMinutes, 240);
    assert.equal(ready.draft.rateCents, 9000);
    assert.equal(ready.draft.rateUnit, "horaire");
  }
  const billed = readInterventionEntry(
    "Enregistre une assistance pour Atelier Nord, dossier Lampes Nord, le 2026-09-12, 1 heure, taux horaire 80,00 €, facturée F-77",
  );
  assert.equal(billed?.ready, true);
  if (billed && billed.ready) assert.equal(billed.draft.billedReference, "F-77");
  const ticket = readInterventionEntry(
    "Enregistre un ticket T-18 d’assistance pour Atelier Nord, dossier Lampes Nord, le 2026-09-20, 3 heures, taux horaire 80,00 €",
  );
  assert.equal(ticket?.ready, true);
  if (ticket && ticket.ready) {
    assert.equal(ticket.draft.kind, "assistance");
    assert.equal(ticket.draft.ticket, "T-18");
    assert.equal(ticket.draft.durationMinutes, 180);
    assert.equal(ticket.draft.rateCents, 8000);
  }
  const fault = readInterventionEntry(
    "Enregistre une panne sur site sous contrat pour Atelier Nord, dossier Lampes Nord, le 2026-09-18, 2 heures, taux horaire 95,00 €, demande le 2026-09-16, arrivée le 2026-09-18",
  );
  assert.equal(fault?.ready, true);
  if (fault && fault.ready) {
    assert.equal(fault.draft.kind, "panne");
    assert.equal(fault.draft.occurredOn, "2026-09-18");
    assert.equal(fault.draft.requestedOn, "2026-09-16");
    assert.equal(fault.draft.arrivedOn, "2026-09-18");
    assert.equal(fault.draft.onSite, true);
    assert.equal(fault.draft.underContract, true);
    assert.equal(fault.draft.rateCents, 9500);
  }
  assert.equal(readInterventionEntry("prépare un devis pour Atelier Nord, 2 lampes"), null);
});
