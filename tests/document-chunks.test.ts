import assert from "node:assert/strict";
import test from "node:test";
import {
  chunkDocumentText,
  composeExtraction,
  doclingExtension,
  documentBody,
  pieceIdentity,
  piecePassages,
  retrievalParts,
} from "../src/domain/document-chunks.ts";

test("un pdf et une image partent vers Docling, un texte simple non", () => {
  assert.equal(doclingExtension("offre.pdf", ""), "pdf");
  assert.equal(doclingExtension("photo.JPEG", "image/jpeg"), "jpeg");
  assert.equal(doclingExtension("note.txt", "text/plain"), null);
  assert.equal(doclingExtension("sans-nom", "application/pdf"), "pdf");
});

test("le markdown Docling est découpé par titre, le tableau reste entier", () => {
  const table = ["| Produit | Prix |", "| --- | --- |", "| Vis | 0,18 € |", "| Kit | 12 € |"].join("\n");
  const text = [
    "# Chiffrage",
    "Première section du devis. ".repeat(12),
    "# Livraison",
    "Quai nord, 15 octobre.",
    table,
  ].join("\n\n");
  const chunks = chunkDocumentText(text, 220);
  assert.ok(chunks.length >= 2);
  assert.match(chunks[0] ?? "", /# Chiffrage/);
  assert.match(chunks[0] ?? "", /Première section/);
  const delivery = chunks.find((chunk) => chunk.includes("Quai nord"));
  assert.match(delivery ?? "", /# Livraison/);
  const grid = chunks.find((chunk) => chunk.includes("0,18 €"));
  assert.match(grid ?? "", /\| Vis \| 0,18 € \|/);
  assert.match(grid ?? "", /\| Kit \| 12 € \|/);
});

test("un tableau trop long répète son en-tête", () => {
  const rows = Array.from({ length: 8 }, (_, index) => `| Ligne ${index} | valeur longue ${index} |`);
  const table = ["| Article | Détail |", "| --- | --- |", ...rows].join("\n");
  const parts = chunkDocumentText(table, 120);
  assert.ok(parts.length >= 2);
  for (const part of parts) {
    assert.match(part, /\| Article \| Détail \|/);
  }
});

test("les passages Docling sont indexés à part du résumé commercial", () => {
  const extracted = composeExtraction(
    "# Devis\n\nVis à bois 0,18 € HT",
    ["# Devis\n\nVis à bois 0,18 € HT", "# Annexe\n\nDélai 3 semaines"],
    "docling",
  );
  assert.match(documentBody(extracted), /0,18 € HT/);
  assert.doesNotMatch(documentBody(extracted), /gestion-ia-passages/);
  const parts = retrievalParts(extracted);
  assert.equal(parts.length, 2);
  assert.match(parts[1] ?? "", /3 semaines/);
  const passages = piecePassages({
    id: "file1",
    originalName: "devis-helios.pdf",
    kind: "devis",
    enrichment: "Type : Devis. Prix indiqué 0,18 € HT.",
    extractedText: extracted,
  });
  assert.equal(passages[0]?.sourceId, "file1#meta");
  assert.match(passages[0]?.body ?? "", /Type : Devis/);
  assert.equal(passages[2]?.title, "devis-helios.pdf · extrait 2");
  assert.equal(pieceIdentity(passages[2]?.sourceId ?? ""), "file1");
});

test("une pièce sans texte reste cherchable par son nom", () => {
  const passages = piecePassages({
    id: "file2",
    originalName: "scan.bin",
    kind: "autre",
    enrichment: "",
    extractedText: "",
  });
  assert.equal(passages.length, 1);
  assert.match(passages[0]?.body ?? "", /Fichier conservé/);
});
