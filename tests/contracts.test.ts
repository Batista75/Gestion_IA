import assert from "node:assert/strict";
import test from "node:test";
import { narrativeFits, renderPacket } from "../src/domain/answer-packet.ts";
import {
  addUtcDays,
  contractPayload,
  duePacket,
  isDueOn,
  monthlyCents,
  monthlyPacket,
  readContractEntry,
  readContractQuestion,
  type StoredContract,
} from "../src/domain/contracts.ts";
import { formatCents } from "../src/domain/pricing.ts";

const maintenance: StoredContract = {
  clientName: "Atelier Nord",
  kind: "maintenance",
  startsOn: "2026-01-01",
  endsOn: "2026-10-20",
  periodicity: "annuel",
  amountCents: 120000,
};

const care: StoredContract = {
  clientName: "Atelier Nord",
  kind: "infogerance",
  startsOn: "2026-01-01",
  endsOn: "2027-06-01",
  periodicity: "mensuel",
  amountCents: 30000,
};

test("le montant mensuel divise le montant de période déjà enregistré", () => {
  assert.equal(monthlyCents(120000, "annuel"), 10000);
  assert.equal(monthlyCents(9000, "trimestriel"), 3000);
  assert.equal(monthlyCents(6000, "semestriel"), 1000);
  assert.equal(monthlyCents(30000, "mensuel"), 30000);
});

test("l’échéance à 30 jours compare des dates, sans estimer", () => {
  const today = "2026-09-28";
  const horizon = addUtcDays(today, 30);
  assert.equal(horizon, "2026-10-28");
  assert.equal(isDueOn(today, today, horizon), true);
  assert.equal(isDueOn(horizon, today, horizon), true);
  assert.equal(isDueOn("2026-09-27", today, horizon), false);
  assert.equal(isDueOn("2026-10-29", today, horizon), false);
  const packet = duePacket({ contracts: [maintenance, care], types: [], today, pending: 1 });
  assert.equal(packet.measures.find((measure) => measure.label === "Contrats")?.value, "1");
  assert.match(packet.rows[0]?.label ?? "", /Maintenance/);
  assert.equal(packet.rows.some((row) => /Infogérance/.test(row.label)), false);
  assert.match(packet.missing.join(" "), /1 contrat en attente/);
  assert.match(packet.method, /30 jours/);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});

test("le récurrent mensuel additionne les mensuels déjà calculés", () => {
  const packet = monthlyPacket({
    contracts: [maintenance, care],
    types: ["infogerance", "maintenance"],
    pending: 0,
  });
  assert.equal(packet.measures.find((measure) => measure.label === "Mensuel")?.value, formatCents(40000));
  assert.equal(packet.measures.find((measure) => measure.label === "Contrats")?.value, "2");
  assert.match(packet.method, /additionne ces montants mensuels déjà calculés/);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
  const open = monthlyPacket({ contracts: [maintenance], types: [], pending: 0 });
  assert.equal(open.measures.length, 0);
  assert.match(open.missing[0] ?? "", /type/);
});

test("une phrase de contrat incomplète pose une seule question", () => {
  assert.equal(readContractQuestion("prépare un devis pour Atelier Nord, 2 lampes"), null);
  assert.equal(readContractEntry("prépare un devis pour Atelier Nord, 2 lampes"), null);
  assert.equal(readContractQuestion("Quels contrats de maintenance arrivent à échéance dans 30 jours ?")?.kind, "due");
  const monthly = readContractQuestion("Quel est le montant récurrent mensuel de l’infogérance et de l’entretien ?");
  assert.equal(monthly?.kind, "monthly");
  assert.deepEqual(monthly && monthly.kind === "monthly" ? monthly.types : [], ["infogerance", "maintenance"]);
  const gap = readContractEntry("Enregistre un contrat pour Atelier Nord");
  assert.equal(gap?.ready, false);
  if (gap && !gap.ready) assert.match(gap.missing, /type/);
  const dollars = readContractEntry("Enregistre un contrat de location pour Nord, du 2026-01-01 au 2026-12-31, annuel, 100 USD");
  assert.equal(dollars?.ready, false);
  const ready = readContractEntry(
    "Enregistre un contrat de maintenance pour Atelier Nord, du 01/01/2026 au 20/10/2026, annuel, 1 200,00 €",
  );
  assert.equal(ready?.ready, true);
  if (ready && ready.ready) {
    assert.equal(ready.draft.kind, "maintenance");
    assert.equal(ready.draft.startsOn, "2026-01-01");
    assert.equal(ready.draft.endsOn, "2026-10-20");
    assert.equal(ready.draft.periodicity, "annuel");
    assert.equal(ready.draft.amountCents, 120000);
  }
  assert.equal(
    contractPayload({
      clientId: "c1",
      clientName: "Atelier Nord",
      kind: "maintenance",
      startsOn: "2026-01-01",
      endsOn: "2026-10-20",
      periodicity: "annuel",
      amountCents: 120000,
    })?.clientName,
    "Atelier Nord",
  );
});
