import assert from "node:assert/strict";
import test from "node:test";
import {
  createdInboxStatus,
  countsAsInboxAttention,
  inboxAttentionLabel,
  inboxClaim,
  inboxStatusFromProposals,
  inboxStatusWrite,
  readInboxItemId,
  resumeInboxStatus,
  type InboxProposal,
} from "../src/domain/inbox-entry.ts";

const activeBusiness: InboxProposal = { kind: "business", status: "en_attente" };
const runningBusiness: InboxProposal = { kind: "business", status: "en_cours" };
const confirmedBusiness: InboxProposal = { kind: "business", status: "confirmee" };
const failedBusiness: InboxProposal = { kind: "business", status: "echec" };
const rejectedBusiness: InboxProposal = { kind: "business", status: "rejetee" };
const replacedBusiness: InboxProposal = { kind: "business", status: "remplacee" };
const activeDocument: InboxProposal = { kind: "document", status: "en_attente" };
const confirmedDocument: InboxProposal = { kind: "document", status: "confirmee" };
const dismissedDocument: InboxProposal = { kind: "document", status: "ecartee" };

test("une entrée créée est à traiter", () => {
  assert.equal(createdInboxStatus(), "a_traiter");
  assert.equal(inboxStatusFromProposals("a_traiter", []), "a_traiter");
});

test("une proposition active rend l’entrée proposée", () => {
  assert.equal(inboxStatusFromProposals("a_traiter", [activeBusiness]), "proposee");
  assert.equal(inboxStatusFromProposals("a_traiter", [activeDocument]), "proposee");
  assert.equal(inboxStatusFromProposals("a_traiter", [runningBusiness]), "proposee");
});

test("une confirmation ne clôt pas l’entrée tant qu’une proposition reste active", () => {
  assert.equal(inboxStatusFromProposals("proposee", [confirmedDocument, activeDocument]), "proposee");
  assert.equal(inboxStatusFromProposals("proposee", [confirmedBusiness, activeBusiness]), "proposee");
});

test("l’entrée est traitée quand tout est réglé et qu’au moins une proposition est confirmée", () => {
  assert.equal(inboxStatusFromProposals("proposee", [confirmedDocument, dismissedDocument]), "traitee");
  assert.equal(inboxStatusFromProposals("proposee", [confirmedBusiness]), "traitee");
});

test("sans confirmation, un rejet ou un écartement ramène l’entrée à traiter", () => {
  assert.equal(inboxStatusFromProposals("proposee", [rejectedBusiness]), "a_traiter");
  assert.equal(inboxStatusFromProposals("proposee", [dismissedDocument, dismissedDocument]), "a_traiter");
  assert.equal(inboxStatusFromProposals("proposee", [replacedBusiness]), "a_traiter");
});

test("un échec de plan laisse l’entrée proposée", () => {
  assert.equal(inboxStatusFromProposals("proposee", [failedBusiness]), "proposee");
  assert.equal(inboxStatusFromProposals("proposee", [failedBusiness, dismissedDocument]), "proposee");
});

test("une proposition remplacée suivie d’une nouvelle active reste proposée", () => {
  assert.equal(inboxStatusFromProposals("proposee", [replacedBusiness, activeBusiness]), "proposee");
});

test("une entrée ignorée n’est pas recalculée", () => {
  assert.equal(inboxStatusFromProposals("ignoree", [confirmedBusiness]), "ignoree");
  assert.equal(inboxStatusFromProposals("ignoree", [activeDocument]), "ignoree");
  assert.equal(inboxStatusFromProposals("ignoree", []), "ignoree");
});

test("reprendre suit la présence d’une proposition active", () => {
  assert.equal(resumeInboxStatus([activeDocument, confirmedDocument]), "proposee");
  assert.equal(resumeInboxStatus([confirmedDocument, dismissedDocument]), "a_traiter");
  assert.equal(resumeInboxStatus([]), "a_traiter");
});

test("un identifiant d’entrée illisible est refusé", () => {
  assert.equal(readInboxItemId("entree-01"), "entree-01");
  assert.equal(readInboxItemId("  entree-01  "), "entree-01");
  assert.equal(readInboxItemId("court"), null);
  assert.equal(readInboxItemId("avec espace"), null);
  assert.equal(readInboxItemId(12), null);
});

test("un statut qui n’est plus celui lu n’est pas écrasé", () => {
  assert.equal(inboxStatusWrite("proposee", "proposee", "traitee"), "traitee");
  assert.equal(inboxStatusWrite("proposee", "ignoree", "traitee"), null);
  assert.equal(inboxStatusWrite("a_traiter", "a_traiter", "a_traiter"), null);
});

test("l’alerte d’accueil ne compte que les entrées encore ouvertes", () => {
  assert.equal(countsAsInboxAttention("a_traiter"), true);
  assert.equal(countsAsInboxAttention("proposee"), true);
  assert.equal(countsAsInboxAttention("traitee"), false);
  assert.equal(countsAsInboxAttention("ignoree"), false);
  assert.equal(inboxAttentionLabel(1), "1 entrée reste à traiter.");
  assert.equal(inboxAttentionLabel(2), "2 entrées restent à traiter.");
  assert.equal(inboxAttentionLabel(0), null);
});

test("le claim accepte le fil vide ou le même fil, et refuse un autre fil", () => {
  assert.equal(inboxClaim({ exists: true, conversationId: null, currentConversationId: "fil-courant" }), "reclamer");
  assert.equal(
    inboxClaim({ exists: true, conversationId: "fil-courant", currentConversationId: "fil-courant" }),
    "accepter",
  );
  assert.equal(
    inboxClaim({ exists: true, conversationId: "autre-fil", currentConversationId: "fil-courant" }),
    "refuser",
  );
  assert.equal(inboxClaim({ exists: false, conversationId: null, currentConversationId: "fil-courant" }), "refuser");
  assert.equal(inboxClaim({ exists: true, conversationId: null, currentConversationId: "  " }), "refuser");
});
