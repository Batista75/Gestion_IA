import assert from "node:assert/strict";
import test from "node:test";
import { recordFocus } from "../src/domain/knowledge.ts";
import { proposeFromReading, readOfferFile, type DirectorySnapshot } from "../src/domain/offer-versions.ts";

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
    `Facture n° F-9 du 01/02/2026\nClient : Atelier Cèdre\nFournisseur : Fournitures Helios\nVis à bois VIS-01 | 0,12 € HT`,
    "facture.txt",
  );
  assert.equal(reading.kind, "facture");
  assert.equal(reading.offers.length, 0);
  assert.equal(reading.parties.clientName, "Atelier Cèdre");
  assert.equal(reading.parties.supplierName, "Fournitures Helios");
  assert.equal(reading.pricedLines[0]?.statedPrice, "0,12 € HT");
  assert.match(reading.enrichment, /Type : Facture/);
  assert.match(reading.enrichment, /ne deviennent pas une version de devis/);
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
  assert.equal(recordFocus("liste des demandes"), "demand");
});

const emptyDirectory: DirectorySnapshot = {
  clients: [],
  suppliers: [],
  products: [],
  quotes: [],
  demands: [],
  projects: [],
};

test("une demande de prix, une commande et un devis connu produisent des propositions distinctes", () => {
  const rfq = readOfferFile(
    `Demande de prix n° RFQ-12 du 04/03/2026
Client : Atelier Cèdre
Fournisseur : Fournitures Helios`,
    "rfq.txt",
  );
  assert.equal(rfq.kind, "rfq");
  const rfqProposal = proposeFromReading(rfq, "rfq.txt", emptyDirectory, [
    { label: "Client", title: "Atelier Cèdre" },
  ]);
  assert.equal(rfqProposal?.actions.some((action) => action.type === "record_demand"), true);
  assert.equal(rfqProposal?.actions.some((action) => action.type === "create_client"), true);
  assert.equal(rfqProposal?.actions.some((action) => action.type === "add_quote_version"), false);

  const order = readOfferFile(
    `Bon de commande n° BC-44 du 15/04/2026
Fournisseur : Fournitures Helios
Client : Atelier Cèdre
Vis à bois VIS-01 | 0,18 € HT | franco 50 pièces`,
    "commande.txt",
  );
  assert.equal(order.kind, "commande");
  assert.equal(order.offers.length, 0);
  const orderProposal = proposeFromReading(order, "commande.txt", emptyDirectory, []);
  assert.equal(orderProposal?.actions.some((action) => action.type === "create_product"), true);
  assert.equal(orderProposal?.actions.some((action) => action.type === "add_quote_version"), false);
  assert.match(orderProposal?.summary ?? "", /Aucune version de devis/);

  const quote = readOfferFile(january, "durand-2026.txt");
  const known: DirectorySnapshot = {
    clients: [],
    suppliers: ["Quincaillerie Durand"],
    products: [{ name: "Vis à bois", reference: "VIS-01" }],
    quotes: [
      {
        title: "Devis mars",
        versionLabel: "D-2024-03 · 12/03/2024",
        supplierName: "Quincaillerie Durand",
        fingerprint: "autre",
        lines: [{ product: "Vis à bois", statedPrice: "0,12 € HT", conditions: "franco 100 pièces" }],
      },
    ],
    demands: [{ title: "Demande Helios", supplierName: "Quincaillerie Durand", clientName: "", status: "ouverte" }],
    projects: ["Atlas"],
  };
  const quoteProposal = proposeFromReading(quote, "durand-2026.txt", known, []);
  assert.equal(quoteProposal?.actions.some((action) => action.type === "create_supplier"), false);
  assert.equal(quoteProposal?.actions.some((action) => action.type === "add_quote_version"), true);
  assert.equal(quoteProposal?.actions.some((action) => action.type === "mark_demand"), true);
  assert.match(quoteProposal?.summary ?? "", /0,18 € HT/);
  assert.match(quoteProposal?.summary ?? "", /0,12 € HT/);
  assert.match(quoteProposal?.summary ?? "", /à part/);

  const duplicate = proposeFromReading(
    quote,
    "durand-2026.txt",
    {
      ...known,
      quotes: [
        ...known.quotes,
        {
          title: quote.offers[0]?.title ?? "",
          versionLabel: quote.offers[0]?.versionLabel ?? "",
          supplierName: "Quincaillerie Durand",
          fingerprint: quote.offers[0]?.fingerprint ?? "",
          lines: (quote.offers[0]?.lines ?? []).map((line) => ({
            product: line.product,
            statedPrice: line.statedPrice,
            conditions: line.conditions,
          })),
        },
      ],
    },
    [],
  );
  assert.equal(duplicate?.actions.some((action) => action.type === "add_quote_version"), false);
  assert.match(duplicate?.summary ?? "", /déjà enregistrée/);

  const linked = proposeFromReading(rfq, "rfq.txt", { ...emptyDirectory, projects: ["Atlas"] }, [], "pour le projet Atlas");
  assert.match(linked?.summary ?? "", /Demande de devis reçue/);
  assert.match(linked?.summary ?? "", /Projet déjà ouvert : Atlas/);
  assert.equal(linked?.fields.find((field) => field.label === "Projet")?.value, "Atlas · déjà ouvert, pièce non rattachée");
});
