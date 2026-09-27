import assert from "node:assert/strict";
import test from "node:test";
import { v2Progress, v2ProgressCounts } from "../src/domain/v2-progress.ts";

test("chaque ligne de Plus a un domaine, un point et un état", () => {
  const points = new Set<string>();
  for (const row of v2Progress) {
    assert.ok(row.domain.trim().length > 0);
    assert.ok(row.point.trim().length > 0);
    assert.ok(row.status === "fait" || row.status === "pas");
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
  const counts = v2ProgressCounts();
  assert.equal(counts.done + counts.open, v2Progress.length);
  assert.ok(counts.done > 0);
  assert.ok(counts.open > 0);
});
