import assert from "node:assert/strict";
import test from "node:test";
import { narrativeFits, renderPacket } from "../src/domain/answer-packet.ts";
import { catalogUnitCents, formatCents, saleLineFigures } from "../src/domain/pricing.ts";
import {
  asksHybridQuote,
  composeQuote,
  discountConflict,
  negotiatedDiscount,
  quotePacket,
  quotedItems,
  type QuoteCatalogItem,
} from "../src/domain/hybrid-quote.ts";

test("une demande de devis se reconnaît, une consultation non", () => {
  assert.equal(asksHybridQuote("prépare un devis pour Marie Dupont, 2 charnières"), true);
  assert.equal(asksHybridQuote("que sait-on de Marie Dupont"), false);
});

test("la remise négociée est unique, sinon elle n’est pas appliquée", () => {
  assert.equal(negotiatedDiscount("Remise négociée de 10 % sur le matériel."), 10);
  assert.equal(negotiatedDiscount("Pas de condition particulière."), null);
  assert.equal(discountConflict("Remise de 10 % et remise de 5 %."), true);
  assert.equal(negotiatedDiscount("Remise de 10 % et remise de 5 %."), null);
});

test("le prix catalogue moins la remise ne passe pas par le modèle", () => {
  assert.equal(catalogUnitCents(10000, 10), 9000);
  assert.equal(catalogUnitCents(10000, 0), 10000);
});

test("la quantité écrite devant le produit est reprise", () => {
  const items = quotedItems("prépare un devis pour Marie, 2 charnières et vis à bois", [
    { name: "Charnière", reference: "CH-1" },
    { name: "Vis à bois", reference: "VIS-01" },
  ]);
  assert.deepEqual(items, [
    { name: "Charnière", reference: "CH-1", quantity: 2 },
    { name: "Vis à bois", reference: "VIS-01", quantity: 1 },
  ]);
});

const lamp: QuoteCatalogItem = {
  name: "Lampe atelier",
  reference: "LAT-4",
  kind: "produit",
  family: "",
  currency: "EUR",
  statedPriceCents: null,
  costCents: 4800,
  stockQty: null,
};

const portable: QuoteCatalogItem = {
  name: "Latitude 5440",
  reference: "LAT-5440",
  kind: "produit",
  family: "portable",
  currency: "EUR",
  statedPriceCents: 100000,
  costCents: 70000,
  stockQty: 4,
};

const preparation: QuoteCatalogItem = {
  name: "Préparation atelier",
  reference: "PREP-1",
  kind: "service",
  family: "prestation",
  currency: "EUR",
  statedPriceCents: null,
  costCents: 8000,
  stockQty: null,
};

const install: QuoteCatalogItem = {
  name: "Installation sur site",
  reference: "INST-1",
  kind: "service",
  family: "prestation",
  currency: "EUR",
  statedPriceCents: 15000,
  costCents: 9000,
  stockQty: null,
};

test("un devis à plusieurs lignes distingue le matériel et la prestation", () => {
  const composed = composeQuote({
    text: "prépare un devis pour Atelier Nord, 10 portables, préparation en atelier et installation sur site",
    clientName: "Atelier Nord",
    catalog: [lamp, portable, preparation, install],
    discountPercent: 0,
    discountConflict: false,
  });
  assert.deepEqual(
    composed.lines.map((line) => ({ name: line.name, quantity: line.quantity, kind: line.kind, source: line.priceSource })),
    [
      { name: "Latitude 5440", quantity: 10, kind: "produit", source: "catalogue" },
      { name: "Préparation atelier", quantity: 1, kind: "service", source: "marque" },
      { name: "Installation sur site", quantity: 1, kind: "service", source: "catalogue" },
    ],
  );
  assert.equal(composed.lines[0]?.saleUnitCents, catalogUnitCents(100000, 0));
  const prepared = saleLineFigures({ quantity: 1, costCents: 8000, markupPercent: 30, discountPercent: 0 });
  assert.equal(composed.lines[1]?.saleUnitCents, prepared.unitNetCents);
  assert.equal(composed.missing.length, 0);
  const packet = quotePacket({
    clientName: "Atelier Nord",
    projectName: "Dossier Nord",
    lines: composed.lines,
    missing: [],
    href: "/projets/demo/documents/demo",
  });
  const total =
    composed.lines[0]!.saleUnitCents * 10 +
    composed.lines[1]!.saleUnitCents +
    composed.lines[2]!.saleUnitCents;
  assert.equal(packet.measures.find((measure) => measure.label === "Total HT")?.value, formatCents(total));
  assert.equal(packet.rows[0]?.detail.includes("matériel"), true);
  assert.equal(packet.rows[1]?.detail.includes("prestation"), true);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});

test("sans prix catalogue, le coût enregistré et la marque suffisent", () => {
  const composed = composeQuote({
    text: "prépare un devis pour Atelier Nord, 2 Lampe atelier",
    clientName: "Atelier Nord",
    catalog: [lamp],
    discountPercent: 0,
    discountConflict: false,
  });
  const unit = saleLineFigures({ quantity: 1, costCents: 4800, markupPercent: 30, discountPercent: 0 }).unitNetCents;
  assert.equal(composed.lines.length, 1);
  assert.equal(composed.lines[0]?.quantity, 2);
  assert.equal(composed.lines[0]?.saleUnitCents, unit);
  assert.equal(composed.lines[0]?.priceSource, "marque");
});

test("deux articles de la même catégorie posent une seule question", () => {
  const other: QuoteCatalogItem = { ...portable, name: "EliteBook", reference: "EB-1" };
  const composed = composeQuote({
    text: "prépare un devis pour Atelier Nord, 10 portables",
    clientName: "Atelier Nord",
    catalog: [portable, other],
    discountPercent: 0,
    discountConflict: false,
  });
  assert.equal(composed.lines.length, 0);
  assert.match(composed.missing[0] ?? "", /Latitude 5440/);
  assert.match(composed.missing[0] ?? "", /EliteBook/);
  const packet = quotePacket({
    clientName: "Atelier Nord",
    projectName: "",
    lines: [],
    missing: composed.missing,
    href: "",
  });
  assert.equal(packet.measures.length, 0);
});

test("le nom du dossier cité n’est pas un article", () => {
  const composed = composeQuote({
    text: "prépare un devis pour Atelier Nord, dossier Lampes Nord, 2 Lampe atelier",
    clientName: "Atelier Nord",
    ignoreNames: ["Lampes Nord"],
    catalog: [lamp],
    discountPercent: 0,
    discountConflict: false,
  });
  assert.equal(composed.lines.length, 1);
  assert.equal(composed.lines[0]?.name, "Lampe atelier");
  assert.equal(composed.lines[0]?.quantity, 2);
  assert.equal(composed.missing.some((line) => /Lampes Nord/.test(line)), false);
});

test("une prestation ne prend pas un article matériel", () => {
  const composed = composeQuote({
    text: "prépare un devis pour Atelier Nord, préparation en atelier",
    clientName: "Atelier Nord",
    catalog: [{ ...preparation, kind: "produit", family: "" }],
    discountPercent: 0,
    discountConflict: false,
  });
  assert.equal(composed.lines.length, 0);
  assert.match(composed.missing[0] ?? "", /Aucun article/);
});
