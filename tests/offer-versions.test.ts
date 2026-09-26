import assert from "node:assert/strict";
import test from "node:test";
import { recordFocus } from "../src/domain/knowledge.ts";
import { readOfferFile } from "../src/domain/offer-versions.ts";

const march = `Devis Quincaillerie Durand n° D-2024-03 du 12/03/2024
Fournisseur : Quincaillerie Durand
Vis à bois VIS-01 | 0,12 € HT | franco 100 pièces
Charnière CH-2 | 3,40 € HT | départ usine`;

const january = `Devis Quincaillerie Durand n° D-2026-01 du 02/01/2026
Fournisseur : Quincaillerie Durand
Vis à bois VIS-01 | 0,18 € HT | franco 50 pièces, délai 3 semaines`;

test("deux devis du même produit restent deux versions", () => {
  const first = readOfferFile(march, "durand-2024.txt");
  const second = readOfferFile(january, "durand-2026.txt");
  assert.equal(first.kind, "devis");
  assert.equal(second.kind, "devis");
  assert.equal(first.offers.length, 1);
  assert.equal(second.offers.length, 1);
  assert.notEqual(first.offers[0]?.fingerprint, second.offers[0]?.fingerprint);

  const oldLine = first.offers[0]?.lines.find((line) => line.product === "Vis à bois");
  const newLine = second.offers[0]?.lines.find((line) => line.product === "Vis à bois");
  assert.equal(oldLine?.reference, "VIS-01");
  assert.equal(oldLine?.statedPrice, "0,12 € HT");
  assert.equal(oldLine?.conditions, "franco 100 pièces");
  assert.equal(newLine?.statedPrice, "0,18 € HT");
  assert.equal(newLine?.conditions, "franco 50 pièces, délai 3 semaines");
  assert.match(first.enrichment, /ne remplace pas un autre devis/);
  assert.match(second.enrichment, /0,18 € HT/);
});

test("un fichier qui contient deux devis est séparé", () => {
  const reading = readOfferFile(`${march}\n\n${january}`, "durand.txt");
  assert.equal(reading.offers.length, 2);
  assert.equal(reading.offers[0]?.versionLabel, "D-2024-03 · 12/03/2024");
  assert.equal(reading.offers[1]?.versionLabel, "D-2026-01 · 02/01/2026");
  const prices = reading.offers.flatMap((offer) =>
    offer.lines.filter((line) => line.product === "Vis à bois").map((line) => line.statedPrice),
  );
  assert.deepEqual(prices, ["0,12 € HT", "0,18 € HT"]);
});

test("une facture est enrichie sans devenir une version de devis", () => {
  const reading = readOfferFile(
    `Facture n° F-9 du 01/02/2026\nVis à bois VIS-01 | 0,12 € HT`,
    "facture.txt",
  );
  assert.equal(reading.kind, "document");
  assert.equal(reading.offers.length, 0);
  assert.match(reading.enrichment, /Type : document/);
});

test("un tarif avec prix est une version commerciale", () => {
  const reading = readOfferFile(
    `Tarif 2026\nFournisseur : Quincaillerie Durand\nVis à bois VIS-01 | 0,20 € HT | par 1000`,
    "tarif.txt",
  );
  assert.equal(reading.kind, "tarif");
  assert.equal(reading.offers[0]?.lines[0]?.statedPrice, "0,20 € HT");
  assert.equal(reading.offers[0]?.lines[0]?.conditions, "par 1000");
});

test("un fichier sans texte reste conservé", () => {
  const reading = readOfferFile("", "scan.pdf");
  assert.equal(reading.kind, "autre");
  assert.match(reading.enrichment, /n’a pas pu être extrait/);
});

test("une question de devis ne bascule pas vers les pièces", () => {
  assert.equal(recordFocus("fichiers du devis Durand"), "quote");
  assert.equal(recordFocus("les pièces jointes"), "piece");
  assert.equal(recordFocus("liste des fichiers"), "piece");
});
