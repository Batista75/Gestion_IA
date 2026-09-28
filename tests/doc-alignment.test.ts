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

test("l’avancement du lot compte les points faits", () => {
  const page = readFileSync("docs/technique/docs/modelisation.md", "utf8");
  const block = page.split("## Avancement du lot")[1]?.split("## ")[0] ?? "";
  const states = [...block.matchAll(/\| (Fait|Pas fait) \|/g)].map((match) => match[1]);
  const done = states.filter((state) => state === "Fait").length;
  const percent = Math.round((done / states.length) * 100);
  assert.equal(states.length, 9);
  assert.match(block, new RegExp(`${done} sur ${states.length}`));
  assert.match(block, new RegExp(`${percent} %`));
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

test("le DAT et le DCT sont les deux entrées, sans recopier le lot", () => {
  const index = readFileSync("docs/technique/docs/index.md", "utf8");
  const dat = readFileSync("docs/technique/docs/dat.md", "utf8");
  const dct = readFileSync("docs/technique/docs/dct.md", "utf8");
  const donnees = readFileSync("docs/technique/docs/donnees.md", "utf8");
  assert.match(index, /dat\.md/);
  assert.match(index, /dct\.md/);
  assert.match(index, /modelisation\.md/);
  assert.match(readFileSync("src/lib/spec-books.ts", "utf8"), /"dat"/);
  assert.match(readFileSync("src/lib/spec-books.ts", "utf8"), /"dct"/);
  assert.match(readFileSync("docs/technique/mkdocs.yml", "utf8"), /dat\.md/);
  assert.match(readFileSync("docs/technique/mkdocs.yml", "utf8"), /dct\.md/);
  assert.match(dat, /Document d’architecture technique/);
  assert.match(dct, /Document de conception technique/);
  assert.equal(dat.includes("## Avancement du lot"), false);
  assert.equal(dct.includes("## Avancement du lot"), false);
  assert.match(donnees, /dct\.md/);
  assert.match(donnees, /modelisation\.md/);
  assert.ok(donnees.length < 700);
});

test("le plan d’ingestion compte les lots livrés", () => {
  const plan = readFileSync("docs/technique/docs/plan-ingestion.md", "utf8");
  assert.match(readFileSync("src/lib/spec-books.ts", "utf8"), /"plan-ingestion"/);
  assert.match(readFileSync("docs/technique/mkdocs.yml", "utf8"), /plan-ingestion\.md/);
  assert.match(readFileSync("docs/technique/docs/dat.md", "utf8"), /plan-ingestion\.md/);
  assert.equal(plan.includes("## Avancement du lot"), false);
  const states = [...plan.matchAll(/^\d+\. \*\*.+État : (livré|pas commencé)\.\s*$/gm)].map((match) => match[1]);
  assert.equal(states.length, 8);
  const done = states.filter((state) => state === "livré").length;
  const percent = Math.round((done / 8) * 100);
  assert.match(plan, new RegExp(`Avancement du chantier : ${done} sur 8, soit ${percent} %`));
});

test("le plan du chat est une page à part, sans recopier le lot", () => {
  const plan = readFileSync("docs/technique/docs/plan-chat.md", "utf8");
  assert.match(readFileSync("src/lib/spec-books.ts", "utf8"), /"plan-chat"/);
  assert.match(readFileSync("docs/technique/mkdocs.yml", "utf8"), /plan-chat\.md/);
  assert.match(readFileSync("docs/technique/docs/dat.md", "utf8"), /plan-chat\.md/);
  assert.equal(plan.includes("## Avancement du lot"), false);
  assert.match(plan, /paquet/);
  const states = [...plan.matchAll(/^\d+\. \*\*.+État : (livré|pas commencé)\.\s*$/gm)].map((match) => match[1]);
  assert.equal(states.length, 11);
  const done = states.filter((state) => state === "livré").length;
  const percent = Math.round((done / 11) * 100);
  assert.match(plan, new RegExp(`Avancement du chantier : ${done} sur 11, soit ${percent} %`));
});

test("le fonctionnel et la technique disent la même chose de la mémoire de pièce", () => {
  const chaine = readFileSync("docs/fonctionnel/docs/chaine.md", "utf8");
  const ecart = readFileSync("docs/technique/docs/ecart.md", "utf8");
  assert.match(chaine, /Elle ne devient pas une règle/);
  assert.match(ecart, /DocumentMemory/);
  assert.equal(ecart.includes("une correction n’est pas isolée"), false);
});
