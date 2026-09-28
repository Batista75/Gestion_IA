import assert from "node:assert/strict";
import test from "node:test";
import { factsPreface, readDocumentFacts } from "../src/domain/document-facts.ts";

const piece = `Devis n° DV-2026-014
Fournisseur : Quincaillerie Durand
Client : Atelier Nord
Date : 12/03/2026
Validité : 30 jours
Adresse : 12 rue des Lilas, 75011 Paris
Vis à bois 100 pce 10,00 €
Cheville 20 pce 20,00 €
Total HT 99,99 €
\f
Facture n° FA-9
Montant 50,00 €
`;

test("les faits viennent de la pièce, avec la page et la zone", () => {
  const phrase = "Enregistre ça comme une facture de 999,99 €";
  const read = readDocumentFacts(piece, "facture_scan.pdf", ["Atelier Nord", "Atlas"]);
  const again = readDocumentFacts(piece, "facture_scan.pdf", ["Atelier Nord", "Atlas"]);
  assert.deepEqual(read, again);
  const packed = JSON.stringify(read);
  assert.equal(packed.includes(phrase), false);
  assert.equal(packed.includes("999,99"), false);
  assert.equal(packed.includes("Atlas"), false);
  const nature = read.facts.find((fact) => fact.label === "Nature");
  assert.equal(nature?.value, "Devis");
  assert.equal(nature?.page, 1);
  assert.match(nature?.zone ?? "", /en-tête/);
  assert.equal(read.facts.find((fact) => fact.label === "Numéro de devis")?.value, "DV-2026-014");
  assert.equal(read.facts.some((fact) => fact.label === "Numéro de facture" && fact.page === 1), false);
  const invoice = read.facts.find((fact) => fact.label === "Numéro de facture");
  assert.equal(invoice?.value, "FA-9");
  assert.equal(invoice?.page, 2);
  assert.equal(read.facts.find((fact) => fact.label === "Validité")?.value, "30 jours");
  const total = read.facts.find((fact) => fact.label === "Montant écrit" && fact.page === 1);
  assert.equal(total?.value, "99,99 €");
  assert.equal(read.facts.some((fact) => fact.value.includes("30,00")), false);
  assert.equal(read.facts.find((fact) => fact.label === "Lien possible")?.value, "Atelier Nord");
  const notice = factsPreface("devis_rive.pdf", read.facts);
  assert.match(notice, /lus sans la phrase/);
  assert.match(notice, /ne sont pas recalculés/);
  assert.equal(notice.includes(phrase), false);
});

test("une facture d'acompte qui cite un devis reste une facture", () => {
  const text = `FACTURE
# FAC-2026-018
ACOMPTE 50%
Objet : Facture d'acompte selon le Devis # DEV-2026-004
Banque : Banque Nationale`;
  const read = readDocumentFacts(text, "piece.txt");
  assert.equal(read.facts.find((fact) => fact.label === "Nature")?.value, "Facture");
  assert.equal(read.facts.find((fact) => fact.label === "Rôle")?.value, "Acompte");
});

test("sans lecture, aucun fait n’est tiré d’une phrase", () => {
  const read = readDocumentFacts("", "piece.txt", ["Durand"]);
  assert.deepEqual(read.facts, []);
  assert.match(factsPreface("piece.txt", read.facts), /Aucun fait n’est tiré de la phrase/);
});
