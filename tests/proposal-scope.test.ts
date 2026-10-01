import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { intentCatalog } from "../src/domain/intent-catalog.ts";
import { emptyPlan, type BusinessPlan } from "../src/domain/business-brief.ts";
import {
  assistantTurnKind,
  businessPlanDecision,
  cardMayAct,
  createProposalLedger,
  pendingInThread,
  proposalFollowUpState,
  presentBusinessPlan,
  proposalActionGate,
  readPieceIds,
  readStoredPlan,
  readStoredProposalCard,
  runClaimedConfirmation,
  selectProposalTarget,
  selectablePending,
  settleBusinessPlan,
  UNAVAILABLE_PROPOSAL,
  type PendingCandidate,
  type ProposalTarget,
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

function target(partial: Partial<ProposalTarget> & Pick<ProposalTarget, "id" | "type">): ProposalTarget {
  return { conversationId: filA, status: "en_attente", ...partial };
}

test("une carte porte son identifiant et son type, une carte ancienne reste lisible", () => {
  const stored = readStoredProposalCard({
    id: "prop-a",
    type: "client",
    fields: [{ label: "Nom", value: "Dupont" }],
    confirmable: false,
  });
  assert.equal(stored?.id, "prop-a");
  assert.equal(stored?.type, "client");
  assert.equal(stored?.confirmable, false);
  assert.equal(cardMayAct(stored), false);
  const actionable = readStoredProposalCard({
    id: "prop-b",
    type: "catalog",
    fields: [{ label: "Nom", value: "Bernard" }],
  });
  assert.equal(cardMayAct(actionable), true);
  const historical = readStoredProposalCard({ fields: [{ label: "Nom", value: "Ancien" }] });
  assert.equal(historical?.id, undefined);
  assert.equal(historical?.type, undefined);
  assert.equal(cardMayAct(historical), false);
  assert.equal(readStoredProposalCard({ id: "sans-type", fields: [{ label: "Nom", value: "X" }] })?.id, undefined);
});

test("confirmer A laisse B en attente, même d’un autre type ou plus récente", () => {
  const rows = [
    target({ id: "dupont", type: "client" }),
    target({ id: "bernard", type: "catalog" }),
    target({ id: "martin", type: "client" }),
  ];
  assert.equal(selectProposalTarget(rows, { proposalId: "dupont", proposalType: "client" }, filA)?.id, "dupont");
  assert.equal(selectProposalTarget(rows, { proposalId: "bernard", proposalType: "catalog" }, filA)?.id, "bernard");
  assert.equal(selectProposalTarget(rows, { proposalId: "martin", proposalType: "client" }, filA)?.id, "martin");
  assert.equal(selectProposalTarget(rows, { proposalId: "dupont", proposalType: "catalog" }, filA), null);
  assert.equal(selectProposalTarget(rows, { proposalId: "inconnu", proposalType: "client" }, filA), null);
  assert.equal(selectProposalTarget(rows, { proposalId: "dupont", proposalType: "client" }, filB), null);
  assert.equal(
    selectProposalTarget([target({ id: "dupont", type: "client", conversationId: filB })], { proposalId: "dupont", proposalType: "client" }, filA),
    null,
  );
});

test("une proposition déjà tranchée n’est pas reprise", () => {
  const waiting = [target({ id: "dupont", type: "client" })];
  assert.equal(selectProposalTarget(waiting, { proposalId: "dupont", proposalType: "client" }, filA)?.id, "dupont");
  waiting[0]!.status = "confirmee";
  assert.equal(selectProposalTarget(waiting, { proposalId: "dupont", proposalType: "client" }, filA), null);
  waiting[0]!.status = "rejetee";
  assert.equal(selectProposalTarget(waiting, { proposalId: "dupont", proposalType: "client" }, filA), null);
  assert.match(UNAVAILABLE_PROPOSAL, /plus disponible/);
});

test("un clic structuré ne reprend pas un parcours suspendu", () => {
  const action = { action: "confirm" as const, proposalId: "prop-a", proposalType: "client" as const };
  assert.equal(assistantTurnKind({ proposalAction: action, taskSuspended: true }), "structured");
  assert.equal(assistantTurnKind({ proposalAction: null, taskSuspended: true }), "task");
  assert.equal(assistantTurnKind({ proposalAction: null, taskSuspended: false }), "text");
  assert.deepEqual(proposalActionGate(action), { kind: "ready", action });
  assert.equal(proposalActionGate(null).kind, "absent");
  assert.equal(proposalActionGate({ action: "confirm", proposalId: "x", proposalType: "document" }).kind, "invalid");
  const route = readFileSync("src/app/api/assistant/route.ts", "utf8");
  const structured = route.indexOf("await applyProposalAction");
  const task = route.indexOf("resumeSuspendedTask(");
  const latest = route.indexOf("await confirmLatestWrite");
  assert.ok(structured > 0 && structured < task && task < latest);
  assert.match(readFileSync("src/lib/catalog-proposals.ts", "utf8"), /export async function confirmLatestWrite/);
  assert.match(readFileSync("src/lib/catalog-proposals.ts", "utf8"), /export async function rejectLatestWrite/);
});

function claimedWrite(ledger: ReturnType<typeof createProposalLedger>) {
  return runClaimedConfirmation({
    claim: ledger.claim,
    write: ledger.write,
    succeeded: (value) => value.ok,
    markConfirmed: ledger.markConfirmed,
    markFailed: ledger.markFailed,
  });
}

test("deux confirmations concurrentes n’écrivent qu’une fois", async () => {
  for (const kind of ["client", "catalog"] as const) {
    const ledger = createProposalLedger();
    const [left, right] = await Promise.all([claimedWrite(ledger), claimedWrite(ledger)]);
    const won = [left, right].filter((item) => item.status === "confirmed");
    assert.equal(won.length, 1, kind);
    assert.equal(ledger.writes(), 1, kind);
    assert.equal(ledger.history(), 1, kind);
    assert.equal(ledger.status(), "confirmee", kind);
  }
});

test("une confirmation et un rejet concurrents ne se mélangent pas", async () => {
  const rejectedFirst = createProposalLedger();
  assert.equal(await rejectedFirst.reject(), true);
  const lost = await claimedWrite(rejectedFirst);
  assert.equal(lost.status, "lost");
  assert.equal(rejectedFirst.writes(), 0);
  assert.equal(rejectedFirst.history(), 0);
  assert.equal(rejectedFirst.status(), "rejetee");

  const claimedFirst = createProposalLedger();
  const confirmed = await runClaimedConfirmation({
    claim: claimedFirst.claim,
    write: async () => {
      assert.equal(await claimedFirst.reject(), false);
      return claimedFirst.write();
    },
    succeeded: (value) => value.ok,
    markConfirmed: claimedFirst.markConfirmed,
    markFailed: claimedFirst.markFailed,
  });
  assert.equal(confirmed.status, "confirmed");
  assert.equal(claimedFirst.writes(), 1);
  assert.equal(claimedFirst.history(), 1);
  assert.equal(claimedFirst.status(), "confirmee");
});

test("un échec passe à echec et ne réécrit pas", async () => {
  const ledger = createProposalLedger();
  let attempts = 0;
  const failed = await runClaimedConfirmation({
    claim: ledger.claim,
    write: async () => {
      attempts += 1;
      throw new Error("écriture interrompue");
    },
    succeeded: () => true,
    markConfirmed: ledger.markConfirmed,
    markFailed: ledger.markFailed,
  });
  assert.equal(failed.status, "failed");
  assert.equal(ledger.status(), "echec");
  assert.equal(attempts, 1);
  const again = await claimedWrite(ledger);
  assert.equal(again.status, "lost");
  assert.equal(ledger.writes(), 0);
  assert.equal(ledger.history(), 0);
});

test("chaque type réclame la ligne avant l’écriture, le plan parlé compris", () => {
  const files = [
    "src/lib/client-proposals.ts",
    "src/lib/catalog-proposals.ts",
    "src/lib/contract-reply.ts",
    "src/lib/intervention-reply.ts",
    "src/lib/equipment-reply.ts",
    "src/lib/purchase-reply.ts",
    "src/lib/claim-reply.ts",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /runClaimedConfirmation/, file);
    assert.match(source, /status: "en_cours"/, file);
    assert.match(source, /status: "en_attente"/, file);
    assert.equal(source.includes("Proposal.update("), false, file);
  }
  const catalog = readFileSync("src/lib/catalog-proposals.ts", "utf8");
  assert.match(catalog, /withChangeSource\("assistant", \(\) => applyCatalogCommand\(command\)\)/);
  const plan = readFileSync("src/lib/business-plan-proposals.ts", "utf8");
  const claim = plan.indexOf('status: "en_cours"');
  const apply = plan.indexOf("applyBusinessPlan(");
  assert.ok(claim > 0 && claim < apply);
  assert.match(plan, /claimed\.count !== 1/);
});

test("les boutons Confirmer et Rejeter se lisent sur la carte", () => {
  assert.equal(
    proposalFollowUpState({
      latest: false,
      userText: "Confirmer cette proposition.",
      assistantSource: "action",
    }),
    "confirmee",
  );
  assert.equal(
    proposalFollowUpState({
      latest: false,
      userText: "Je confirme.",
      assistantSource: "action",
    }),
    "confirmee",
  );
  assert.equal(
    proposalFollowUpState({
      latest: false,
      userText: "Rejeter cette proposition.",
      assistantSource: "action",
    }),
    "sans_suite",
  );
  assert.equal(proposalFollowUpState({ latest: true, userText: null, assistantSource: null }), "a_confirmer");
});
