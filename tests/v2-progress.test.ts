import assert from "node:assert/strict";
import test from "node:test";
import { formatDoneAt, orderByDoneAt, readDoneOrder, v2Phases, v2Progress, v2ProgressCounts } from "../src/domain/v2-progress.ts";

test("chaque ligne de Plus a un domaine, un point et un état", () => {
  const points = new Set<string>();
  for (const row of v2Progress) {
    assert.ok(row.domain.trim().length > 0);
    assert.ok(row.point.trim().length > 0);
    assert.ok(row.status === "fait" || row.status === "pas");
    if (row.status === "fait") assert.equal(Number.isNaN(new Date(row.doneAt).getTime()), false);
    else assert.equal(row.doneAt, "");
    assert.equal(points.has(row.point), false);
    points.add(row.point);
  }
});

test("le tableau sépare ce qui est livré de la cible restante", () => {
  const byPoint = new Map(v2Progress.map((row) => [row.point, row.status]));
  assert.equal(
    byPoint.get("Menu Accueil, Projets, Ventes, Achats, Référentiels, Finance, Pilotage, Administration"),
    "fait",
  );
  assert.equal(byPoint.get("Notifications, rôles et règles automatiques"), "pas");
  assert.equal(
    byPoint.get("Phrase déjà reconnue traitée par une règle, avant le modèle"),
    "fait",
  );
  assert.equal(
    byPoint.get("Catalogue fermé : intention structurée, pas une action libre"),
    "fait",
  );
  assert.equal(byPoint.has("Confiance et source affichées sur chaque donnée extraite"), false);
  const counts = v2ProgressCounts();
  assert.equal(counts.done + counts.open, v2Progress.length);
  assert.ok(counts.done > 0);
  assert.ok(counts.open > 0);
  assert.equal(formatDoneAt("2026-09-27T14:05:21.000Z"), "27/09/2026 16:05");
  assert.equal(formatDoneAt(""), "");
  const card = v2Progress.find((row) => row.point.startsWith("Fiche de compréhension"));
  assert.equal(card?.status, "fait");
  const phase = v2Phases.find((item) => item.order === 4);
  assert.equal(phase?.state, "fait");
  assert.equal(v2Phases.find((item) => item.order === 5)?.state, "fait");
  assert.equal(v2Phases.find((item) => item.order === 6)?.state, "pas");
});

test("la date trie du plus récent au plus ancien, et l’inverse", () => {
  const rows = [
    { doneAt: "2026-09-26T10:00:00Z", point: "ancien" },
    { doneAt: "", point: "ouvert" },
    { doneAt: "2026-09-27T10:00:00Z", point: "recent-a" },
    { doneAt: "2026-09-27T10:00:00Z", point: "recent-b" },
  ];
  assert.deepEqual(orderByDoneAt(rows, "recent").map((row) => row.point), ["recent-a", "recent-b", "ancien", "ouvert"]);
  assert.deepEqual(orderByDoneAt(rows, "ancien").map((row) => row.point), ["ancien", "recent-a", "recent-b", "ouvert"]);
  assert.equal(readDoneOrder("recent"), "recent");
  assert.equal(readDoneOrder("ancien"), "ancien");
  assert.equal(readDoneOrder("autre"), null);
});
