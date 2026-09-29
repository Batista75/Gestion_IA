import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { intentCatalog } from "../src/domain/intent-catalog.ts";
import { emptyPlan, type BusinessPlan } from "../src/domain/business-brief.ts";
import {
  businessPlanDecision,
  pendingInThread,
  presentBusinessPlan,
  readPieceIds,
  readStoredPlan,
  selectablePending,
  settleBusinessPlan,
  type PendingCandidate,
} from "../src/domain/proposal-scope.ts";

const filA = "conversation-a";
const filB = "conversation-b";

function row(partial: Partial<PendingCandidate> & Pick<PendingCandidate, "id" | "kind" | "createdAt">): PendingCandidate {
  return {
    conversationId: filA,
    status: "en_attente",
    ...partial,
  };
}

test("une intention à confirmer n’autorise pas l’écriture avant le oui", () => {
  const brief = intentCatalog.find((item) => item.id === "import_brief");
  assert.equal(brief?.risk, "confirmation");
  assert.equal(
    businessPlanDecision({
      status: "en_attente",
      conversationId: filA,
      currentConversationId: filA,
      explicitConfirmation: false,
    }),
    "attendre",
  );
});

test("après confirmation explicite du même fil, le plan peut être exécuté une fois", () => {
  assert.equal(
    businessPlanDecision({
      status: "en_attente",
      conversationId: filA,
      currentConversationId: filA,
      explicitConfirmation: true,
    }),
    "executer",
  );
  assert.deepEqual(settleBusinessPlan("succes"), { status: "confirmee", validated: true });
  for (const status of ["confirmee", "echec", "en_cours"]) {
    assert.equal(
      businessPlanDecision({
        status,
        conversationId: filA,
        currentConversationId: filA,
        explicitConfirmation: true,
      }),
      "deja_execute",
    );
  }
});

test("un échec d’exécution devient echec et n’autorise pas un nouvel essai", () => {
  assert.deepEqual(settleBusinessPlan("echec"), { status: "echec", validated: false });
  assert.notEqual(settleBusinessPlan("echec").status, "en_attente");
  assert.equal(
    businessPlanDecision({
      status: "echec",
      conversationId: filA,
      currentConversationId: filA,
      explicitConfirmation: true,
    }),
    "deja_execute",
  );
});

test("un oui dans le fil A ne retient pas la proposition du fil B", () => {
  const chosen = selectablePending(
    [
      row({ id: "b", kind: "client", conversationId: filB, createdAt: "2026-09-30T12:00:00.000Z" }),
      row({ id: "a", kind: "contract", conversationId: filA, createdAt: "2026-09-30T11:00:00.000Z" }),
    ],
    filA,
  );
  assert.equal(chosen?.id, "a");
  assert.equal(
    businessPlanDecision({
      status: "en_attente",
      conversationId: filB,
      currentConversationId: filA,
      explicitConfirmation: true,
    }),
    "hors_fil",
  );
});

test("sans proposition du fil courant, aucune proposition globale n’est retenue", () => {
  assert.equal(pendingInThread(""), null);
  assert.equal(pendingInThread("   "), null);
  const chosen = selectablePending(
    [
      row({ id: "old", kind: "catalog", conversationId: null, createdAt: "2026-09-30T12:00:00.000Z" }),
      row({ id: "other", kind: "client", conversationId: filB, createdAt: "2026-09-30T12:01:00.000Z" }),
    ],
    filA,
  );
  assert.equal(chosen, null);
  const expired = selectablePending(
    [row({ id: "gone", kind: "client", conversationId: null, status: "expiree", createdAt: "2026-09-30T12:02:00.000Z" })],
    filA,
  );
  assert.equal(expired, null);
  assert.equal(
    businessPlanDecision({
      status: "en_attente",
      conversationId: null,
      currentConversationId: filA,
      explicitConfirmation: true,
    }),
    "hors_fil",
  );
});

test("la carte du plan recopie les montants lus et n’en calcule pas", () => {
  const plan: BusinessPlan = {
    ...emptyPlan(),
    articles: [
      {
        reference: "PRD-1",
        name: "Baie",
        kind: "produit",
        domain: "",
        unit: "u",
        statedPrice: "3 800,00",
        currency: "EUR",
        vatNote: "",
      },
    ],
    quotes: [
      {
        reference: "DEV-1",
        clientName: "Atelier",
        clientRef: "",
        projectName: "",
        projectRef: "",
        currency: "EUR",
        vatZone: "france",
        conditions: "",
        discountRate: 0,
        discountReferences: [],
        lines: [],
        statedTotalHt: "109 500,00 €",
        statedVat: "21 900,00 €",
        statedTotalTtc: "131 400,00 €",
      },
    ],
  };
  const presented = presentBusinessPlan(plan);
  assert.match(presented.reply, /3 800,00/);
  assert.match(presented.reply, /131 400,00 €/);
  assert.match(presented.reply, /Rien n’est enregistré/);
  assert.equal(presented.reply.includes("140 300"), false);
  const stored = readStoredPlan({ ...plan, fileIds: ["fichier-01", "pas un id", "fichier-01"] });
  assert.equal(stored?.plan.quotes[0]?.statedTotalTtc, "131 400,00 €");
  assert.deepEqual(stored?.fileIds, ["fichier-01"]);
  assert.equal(readStoredPlan({ clients: [] }), null);
  assert.deepEqual(readPieceIds(["court", "piece-id-9", { id: "x" }]), ["piece-id-9"]);
});

test("le dépôt d’une pièce n’appelle pas applyBusinessPlan", () => {
  const intake = readFileSync("src/lib/pieces.ts", "utf8");
  assert.equal(intake.includes("applyBusinessPlan"), false);
  const confirm = readFileSync("src/lib/business-plan-proposals.ts", "utf8");
  assert.match(confirm, /applyBusinessPlan\(/);
  assert.match(confirm, /status: "en_cours"/);
  assert.match(confirm, /settleBusinessPlan/);
  assert.match(confirm, /fileIds/);
});
