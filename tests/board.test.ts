import assert from "node:assert/strict";
import test from "node:test";
import { csvTable, inDayRange, monthBounds, pageSizeOf, periodGap, slicePage } from "../src/domain/board.ts";

test("la pagination retient 25 lignes par défaut et découpe la page", () => {
  assert.equal(pageSizeOf("7"), 25);
  assert.equal(pageSizeOf("50"), 50);
  const window = slicePage(["a", "b", "c", "d"], 2, 3);
  assert.deepEqual(window.rows, ["d"]);
  assert.equal(window.pages, 2);
  assert.equal(window.page, 2);
});

test("l’écart de période ne divise pas par zéro", () => {
  assert.deepEqual(periodGap(100, 150), { gap: 50, percent: "50 %" });
  assert.deepEqual(periodGap(0, 0), { gap: 0, percent: "0 %" });
  assert.equal(periodGap(0, 20).percent, "—");
});

test("une date reste dans l’intervalle calendaire", () => {
  const day = new Date(2026, 8, 27);
  assert.equal(inDayRange(day, "2026-09-01", "2026-09-30"), true);
  assert.equal(inDayRange(day, "2026-10-01", "2026-10-31"), false);
  assert.deepEqual(monthBounds(day, 0), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(monthBounds(day, -1), { from: "2026-08-01", to: "2026-08-31" });
});

test("le csv échappe les guillemets", () => {
  assert.equal(csvTable(["Nom"], [['A "B"']]).includes('"A ""B"""'), true);
});
