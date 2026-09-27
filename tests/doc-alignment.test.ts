import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { realisationPage } from "../src/domain/realisation-page.ts";
import { formatDoneAt, v2Phases, v2Progress } from "../src/domain/v2-progress.ts";

const functional = realisationPage({
  audience: "fonctionnel",
  rows: v2Progress,
  phases: v2Phases,
  formatWhen: formatDoneAt,
});
const technical = realisationPage({
  audience: "technique",
  rows: v2Progress,
  phases: v2Phases,
  formatWhen: formatDoneAt,
});

test("les réalisations publiées sont celles du tableau de l’application", () => {
  assert.equal(readFileSync("docs/fonctionnel/docs/realisations.md", "utf8"), functional);
  assert.equal(readFileSync("docs/technique/docs/realisations.md", "utf8"), technical);
  const functionalRows = functional.split("\n").filter((line) => line.startsWith("| ") && !line.includes("---") && !line.includes("Demande"));
  const technicalRows = technical.split("\n").filter((line) => line.startsWith("| ") && !line.includes("---") && !line.includes("Demande"));
  assert.deepEqual(functionalRows, technicalRows);
  for (const row of v2Progress) {
    assert.match(functional, new RegExp(row.point.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(functional, row.status === "fait" ? /Fait/ : /Pas fait/);
  }
  assert.match(functional, /\| 8 \| Mémoire des corrections \| Fait \|/);
  assert.match(functional, /\| 9 \| Évaluation sur messages courts \| Fait \|/);
});

test("le fonctionnel et la technique disent la même chose des faits de pièce", () => {
  const chaine = readFileSync("docs/fonctionnel/docs/chaine.md", "utf8");
  const orchestration = readFileSync("docs/technique/docs/orchestration.md", "utf8");
  assert.match(chaine, /sans s’appuyer sur la phrase/);
  assert.match(chaine, /page et la zone/);
  assert.match(chaine, /ne sont pas recalculés/);
  assert.match(orchestration, /n’est pas un argument/);
  assert.match(orchestration, /page et la zone/);
  assert.match(orchestration, /n’est recalculé/);
});

test("la modélisation cite chaque modèle Prisma", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const page = readFileSync("docs/technique/docs/modelisation.md", "utf8");
  const names = [...schema.matchAll(/^model (\w+)/gm)].map((match) => match[1]!);
  assert.ok(names.length >= 20);
  for (const name of names) {
    assert.match(page, new RegExp(`\\b${name}\\b`));
  }
  assert.match(readFileSync("src/lib/spec-books.ts", "utf8"), /"modelisation"/);
  assert.match(readFileSync("docs/technique/mkdocs.yml", "utf8"), /modelisation\.md/);
  assert.match(readFileSync("docs/technique/docs/index.md", "utf8"), /modelisation\.md/);
  assert.match(page, /Aucune table ne les conserve/);
  assert.match(page, /numéro de facture/);
  assert.match(page, /ne crée pas de `SaleDocument`/);
  assert.match(page, /Les lignes ne sont pas additionnées/);
});

test("le fonctionnel et la technique disent la même chose de la mémoire de pièce", () => {
  const chaine = readFileSync("docs/fonctionnel/docs/chaine.md", "utf8");
  const ecart = readFileSync("docs/technique/docs/ecart.md", "utf8");
  assert.match(chaine, /Elle ne devient pas une règle/);
  assert.match(ecart, /DocumentMemory/);
  assert.equal(ecart.includes("une correction n’est pas isolée"), false);
});
