import assert from "node:assert/strict";
import test from "node:test";
import {
  THREAD_MESSAGE_LIMIT,
  cleanThreadTitle,
  nextOpenThread,
  openThreadLabel,
  requestedThreadId,
  restoreThread,
  threadAddress,
  threadIsFull,
  threadProjectHref,
} from "../src/domain/thread.ts";
import { proposedThreadTitle } from "../src/domain/thread-title.ts";

test("un fil accepte des messages jusqu’à la limite, puis demande un nouveau fil", () => {
  assert.equal(THREAD_MESSAGE_LIMIT, 40);
  assert.equal(threadIsFull(0), false);
  assert.equal(threadIsFull(THREAD_MESSAGE_LIMIT - 1), false);
  assert.equal(threadIsFull(THREAD_MESSAGE_LIMIT), true);
  assert.equal(threadIsFull(THREAD_MESSAGE_LIMIT + 5), true);
});

test("le titre d’un fil reprend l’intention reconnue et le nom cité", () => {
  assert.equal(
    proposedThreadTitle(
      "Enregistre un achat pour Quincaillerie Durand, désignation Switch spare, dossier Lampes Nord, famille réseau, commandé le 2026-09-01, bon de commande 200,00 €, reliquat clos, chez nous",
    ),
    "Achat · Switch spare · Lampes Nord",
  );
  assert.equal(
    proposedThreadTitle("Enregistre une intégration réseau pour Atelier Nord, dossier Lampes Nord, le 2026-09-15, 4 heures, taux horaire 90,00 €"),
    "Intervention · Atelier Nord · 2026-09-15",
  );
  assert.equal(proposedThreadTitle("Quelle est la rentabilité réelle du projet Lampes Nord ?"), "Rentabilité · Lampes Nord");
  assert.equal(proposedThreadTitle("Quelle est la prochaine étape du projet Lampes Nord ?"), "Parcours · Lampes Nord");
  assert.equal(
    proposedThreadTitle("prépare un devis pour Atelier Nord, 10 portables, préparation en atelier"),
    "Devis client · Atelier Nord",
  );
  assert.equal(proposedThreadTitle("bonjour"), "bonjour");
});

test("écarter un fil ouvre le précédent, ou aucun s’il était seul", () => {
  const threads = [{ id: "recent" }, { id: "ancien" }];
  assert.deepEqual(nextOpenThread(threads, "recent"), { id: "ancien" });
  assert.equal(nextOpenThread(threads, "autre"), threads[0]);
  assert.equal(nextOpenThread([{ id: "seul" }], "seul"), null);
});

test("un fil rouvert reprend la tête et quitte les archivés", () => {
  const moved = restoreThread([{ id: "ouvert" }], [{ id: "arch" }, { id: "autre" }], "arch");
  assert.deepEqual(moved, { open: [{ id: "arch" }, { id: "ouvert" }], archived: [{ id: "autre" }] });
  assert.equal(restoreThread([], [{ id: "arch" }], "absent"), null);
});

test("un titre de fil se limite à 80 caractères", () => {
  assert.deepEqual(cleanThreadTitle("  Achat   Nord  "), { title: "Achat Nord" });
  assert.deepEqual(cleanThreadTitle(" "), { error: "Le titre doit contenir au moins 2 caractères." });
  assert.equal("error" in cleanThreadTitle("a".repeat(81)), true);
});

test("l’adresse garde le fil choisi et retire le marqueur de nouveau fil", () => {
  assert.equal(requestedThreadId("fil-accueil-01"), "fil-accueil-01");
  assert.equal(requestedThreadId("court"), "");
  assert.equal(requestedThreadId(null), "");
  assert.equal(threadAddress("/", "fil-accueil-01", "nouveau=1&autre=1"), "/?autre=1&fil=fil-accueil-01");
  assert.equal(threadAddress("/projets/seed-lampes-nord", "fil-dossier-01"), "/projets/seed-lampes-nord?fil=fil-dossier-01");
});

test("le nom du dossier dans la liste mène au dossier avec le même fil", () => {
  assert.equal(
    threadProjectHref("seed-lampes-nord", "fil-accueil-01"),
    "/projets/seed-lampes-nord?fil=fil-accueil-01",
  );
  assert.equal(threadProjectHref("", "fil-accueil-01"), "");
  assert.equal(threadProjectHref("seed-lampes-nord", "x"), "");
});

test("l’en-tête porte le titre du fil, ou Nouveau fil s’il est vide", () => {
  assert.equal(openThreadLabel("Rentabilité · Lampes Nord"), "Rentabilité · Lampes Nord");
  assert.equal(openThreadLabel("  "), "Nouveau fil");
  assert.equal(openThreadLabel(null), "Nouveau fil");
  assert.equal(openThreadLabel(undefined), "Nouveau fil");
});
