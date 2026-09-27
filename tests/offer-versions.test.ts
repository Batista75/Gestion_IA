import assert from "node:assert/strict";
import test from "node:test";
import { recordFocus } from "../src/domain/knowledge.ts";
import {
  documentWriteTargets,
  proposeFromReading,
  readOfferFile,
  statedLineQuantity,
  type DirectorySnapshot,
  type DocumentKind,
} from "../src/domain/offer-versions.ts";

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

const lauterbach = `Lauterbach SARL, 6 rue Nicolas Ledoux, 94000 Créteil, France
NTECHNOLOGIES Réseaux
Mohamed Badi
10, Avenue de la cour de France
91260 Juvisy Sur Orge
Nous vous remercions pour votre demande du 03-04-2023. Nous vous offrons:
Date        03-04-2023
N° d´offre 230249
MIPS32
1       1 pcs LA-7760         JTAG Debugger for MIPS32 (ICD)                                         EUR     2.170,00        2.170,00
                              supports MIPS32 4Kp
2       1 pcs LA-7960X        License for Multicore Debugging                                        EUR        920,00        920,00
3       1 pcs LA-3506         PowerDebug X50                                                         EUR     3.010,00        3.010,00
MIPS64
4      1 pcs LA-7761          JTAG Debugger for MIPS64 (ICD)                                         EUR     2.480,00      2.480,00
5      1 pcs LA-7960X         License for Multicore Debugging                                        EUR        920,00      920,00
6      1 pcs LA-3506          PowerDebug X50                                                         EUR     3.010,00      3.010,00
ARMv8
7      1 pcs LA-3255          Debugger for Armv8/Armv9 IDC20A (PACK)                                 EUR     2.170,00      2.170,00
8      1 pcs LA-3506          PowerDebug X50                                                         EUR     3.010,00      3.010,00
9      1 pcs LA-3253          Debugger Cortex-A/R (Armv7) IDC20A (PACK)                              EUR     2.170,00      2.170,00
10     1 pcs LA-7960X         License for Multicore Debugging                                        EUR        920,00      920,00
11     1 pcs LA-3506          PowerDebug X50                                                         EUR     3.010,00      3.010,00
Prix Hors Taxes         EUR                 23.790,00
TVA en Supplément uniquement en France.
Nous n’acceptons pas de commande via des distributeurs.`;

const serversimply = `NTECH-LOG SAS                                                   Price offer 2300017
Mohamed Badi                                                                           01.03.2023
 Description                                                      Quantity Price for you         Sum
Server 1                                                             17       21 109.75    358 865.81
Storage SuperServer SSG-640P-E1CR36H - 4U - Dual Intel Xeon
Scalable Processors - up to 4TB memory - 36x SATA/SAS - Broadcom     17
32GB DDR4-3200 2Rx4 ECC Registered DIMM                             136
.
Server 2                                                              9       10 038.59     90 347.32
Twin SuperServer SYS-120TP-DTTR - 1U - 2 nodes                        9
.
Server 3                                                            4         7 826.96           31 307.84
Storage SuperServer SSG-640P-E1CR24L - 4U                             4
.
All prices are EXW Tallinn, Estonia
Offer will be active until 10.03.2023 and it will cancel all other offers with same products.
Serversimply OÜ
Total EUR      480 520.97
VAT 0% EUR              0.00
Total with VAT EUR       480 520.97`;

test("un devis Lauterbach reprend chaque référence et le prix écrit", () => {
  const reading = readOfferFile(lauterbach, "230249_N.pdf");
  assert.equal(reading.kind, "devis");
  assert.equal(reading.parties.supplierName, "Lauterbach SARL");
  assert.equal(reading.parties.clientName, "NTECHNOLOGIES Réseaux");
  assert.equal(reading.offers[0]?.versionLabel, "230249 · 03-04-2023");
  const expected = [
    ["LA-7760", "2.170,00 EUR"],
    ["LA-7960X", "920,00 EUR"],
    ["LA-3506", "3.010,00 EUR"],
    ["LA-7761", "2.480,00 EUR"],
    ["LA-7960X", "920,00 EUR"],
    ["LA-3506", "3.010,00 EUR"],
    ["LA-3255", "2.170,00 EUR"],
    ["LA-3506", "3.010,00 EUR"],
    ["LA-3253", "2.170,00 EUR"],
    ["LA-7960X", "920,00 EUR"],
    ["LA-3506", "3.010,00 EUR"],
  ];
  const lines = reading.offers[0]?.lines ?? [];
  assert.equal(lines.length, expected.length);
  expected.forEach(([reference, price], index) => {
    assert.equal(lines[index]?.reference, reference);
    assert.equal(lines[index]?.statedPrice, price);
  });
  assert.match(lines[0]?.product ?? "", /JTAG Debugger for MIPS32/);
  assert.match(lines[0]?.conditions ?? "", /famille MIPS32/);
  assert.match(lines[3]?.conditions ?? "", /famille MIPS64/);
  assert.match(reading.enrichment, /Total HT indiqué 23\.790,00 EUR/);
  assert.match(reading.enrichment, /TVA en Supplément uniquement en France/);
  assert.equal(reading.pricedLines.some((line) => /23\.790,00/.test(line.statedPrice)), false);
});

test("une offre groupée garde les trois prix écrits et ignore les composants", () => {
  const reading = readOfferFile(serversimply, "Quotation_NO_2300017.pdf");
  assert.equal(reading.kind, "devis");
  assert.equal(reading.parties.clientName, "NTECH-LOG SAS");
  assert.equal(reading.parties.supplierName, "Serversimply OÜ");
  assert.equal(reading.offers[0]?.versionLabel, "2300017 · 01.03.2023");
  const lines = reading.offers[0]?.lines ?? [];
  assert.deepEqual(
    lines.map((line) => [line.product, line.statedPrice, line.reference]),
    [
      ["Server 1", "21 109.75 EUR", "SSG-640P-E1CR36H"],
      ["Server 2", "10 038.59 EUR", "SYS-120TP-DTTR"],
      ["Server 3", "7 826.96 EUR", "SSG-640P-E1CR24L"],
    ],
  );
  assert.equal(lines.some((line) => /32GB DDR4/.test(line.product)), false);
  assert.match(lines[0]?.conditions ?? "", /quantité 17/);
  assert.match(lines[0]?.conditions ?? "", /total indiqué 358 865\.81 EUR/);
  assert.match(reading.enrichment, /Total HT indiqué 480 520\.97 EUR/);
  assert.match(reading.enrichment, /TVA indiquée 0 %/);
  assert.match(reading.enrichment, /Total TTC indiqué 480 520\.97 EUR/);
  assert.match(reading.enrichment, /10\.03\.2023/);
  assert.match(reading.enrichment, /EXW Tallinn/);
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

  const linked = proposeFromReading(
    rfq,
    "rfq.txt",
    { ...emptyDirectory, projects: ["Atlas", "Atlas", "Horizon", "Horizon 2"] },
    [],
    "pour le projet Atlas",
  );
  assert.match(linked?.summary ?? "", /Demande de devis reçue/);
  assert.match(linked?.summary ?? "", /Projet déjà ouvert : Atlas/);
  assert.equal(linked?.fields.find((field) => field.label === "Projet")?.value, "Atlas · déjà ouvert, pièce non rattachée");
  const precise = proposeFromReading(
    rfq,
    "rfq.txt",
    { ...emptyDirectory, projects: ["Horizon", "Horizon 2"] },
    [],
    "dossier Horizon 2",
  );
  assert.match(precise?.summary ?? "", /Projet déjà ouvert : Horizon 2/);
});

test("chaque type de pièce écrit seulement les tables du modèle", () => {
  const kinds: DocumentKind[] = [
    "rfq",
    "devis",
    "commande",
    "facture",
    "tarif",
    "avoir",
    "livraison",
    "contrat",
    "fiche",
    "document",
    "autre",
  ];
  for (const kind of kinds) {
    const targets = documentWriteTargets(kind);
    assert.equal(targets.includes("fichier"), true);
    assert.equal(targets.includes("quote"), kind === "devis" || kind === "tarif");
    assert.equal(targets.includes("demand"), kind === "rfq" || kind === "devis" || kind === "tarif");
  }
  assert.deepEqual(documentWriteTargets("autre"), ["fichier"]);
  assert.deepEqual(documentWriteTargets("facture"), ["fichier", "client", "supplier", "product"]);
  assert.deepEqual(documentWriteTargets("avoir"), documentWriteTargets("facture"));
  assert.deepEqual(documentWriteTargets("livraison"), documentWriteTargets("facture"));
  assert.deepEqual(documentWriteTargets("contrat"), documentWriteTargets("facture"));
  assert.deepEqual(documentWriteTargets("commande"), documentWriteTargets("facture"));
});

test("les totaux écrits sont recopiés et les lignes ne sont pas additionnées", () => {
  const plain = readOfferFile(
    `Devis n° D-1 du 01/03/2026
Fournisseur : Atelier Nord
Vis | 10,00 € HT
Écrou | 20,00 € HT`,
    "sans-total.txt",
  );
  assert.equal(plain.offers[0]?.statedTotalHt, "");
  assert.equal(plain.offers[0]?.statedTotalTtc, "");
  assert.equal(plain.offers[0]?.currency, "EUR");
  assert.equal(plain.pricedLines.some((line) => line.statedPrice.includes("30")), false);

  const labeled = readOfferFile(
    `Facture n° F-9 du 01/02/2026
Client : Atelier Cèdre
Fournisseur : Fournitures Helios
Vis à bois VIS-01 | 10,00 € HT
Total HT : 99,99 €
TVA : 19,99 €
Total TTC : 119,98 €`,
    "facture-totaux.txt",
  );
  assert.equal(labeled.kind, "facture");
  assert.equal(labeled.offers.length, 0);
  assert.equal(labeled.pricedLines.length, 1);
  assert.equal(labeled.pricedLines[0]?.statedPrice, "10,00 € HT");
  const proposal = proposeFromReading(labeled, "facture-totaux.txt", emptyDirectory, []);
  const product = proposal?.actions.find((action) => action.type === "create_product");
  assert.equal(product?.type, "create_product");
  if (product?.type === "create_product") {
    assert.equal(product.costStated, "10,00 € HT");
    assert.equal(product.currency, "EUR");
    assert.equal(product.source, "facture");
    assert.equal(product.kind, "produit");
  }
  assert.equal(proposal?.actions.some((action) => action.type === "add_quote_version"), false);
  assert.match(labeled.enrichment, /Total HT indiqué 99,99 €/);
  assert.match(labeled.enrichment, /19,99 €/);
  assert.match(labeled.enrichment, /119,98 €/);
  assert.equal(labeled.enrichment.includes("30"), false);
});

test("un devis confirmable porte le total écrit, le client et la quantité", () => {
  const reading = readOfferFile(lauterbach, "230249_N.pdf");
  const offer = reading.offers[0];
  assert.equal(offer?.statedTotalHt, "EUR 23.790,00");
  assert.equal(offer?.statedVat, "");
  assert.match(offer?.vatMention ?? "", /TVA en Supplément/);
  assert.equal(offer?.currency, "EUR");
  assert.equal(offer?.clientName, "NTECHNOLOGIES Réseaux");
  const grouped = readOfferFile(serversimply, "Quotation_NO_2300017.pdf");
  const servers = grouped.offers[0];
  assert.equal(servers?.statedTotalHt, "EUR 480 520.97");
  assert.equal(servers?.statedVat, "EUR 0.00");
  assert.equal(servers?.statedTotalTtc, "EUR 480 520.97");
  assert.match(servers?.conditions ?? "", /10\.03\.2023/);
  assert.match(servers?.conditions ?? "", /EXW Tallinn/);
  assert.equal(statedLineQuantity(servers?.lines[0]?.conditions ?? ""), "17");
  assert.equal(documentWriteTargets("devis").includes("quote"), true);
});

test("un avoir, un bon de livraison et un contrat ne deviennent pas un devis", () => {
  const samples = [
    ["avoir", "Avoir n° AV-2\nFournisseur : Helios\nVis VIS-01 | 0,12 € HT", "avoir.txt"],
    ["livraison", "Bon de livraison n° BL-3\nFournisseur : Helios\nVis VIS-01 | 0,12 € HT", "bl.txt"],
    ["contrat", "Contrat cadre\nFournisseur : Helios\nMaintenance | 40,00 € HT", "contrat.txt"],
  ] as const;
  for (const [kind, text, filename] of samples) {
    const reading = readOfferFile(text, filename);
    assert.equal(reading.kind, kind);
    assert.equal(reading.offers.length, 0);
    const proposal = proposeFromReading(reading, filename, emptyDirectory, []);
    assert.equal(proposal?.actions.some((action) => action.type === "add_quote_version"), false);
    const product = proposal?.actions.find((action) => action.type === "create_product");
    assert.equal(product?.type, "create_product");
    if (product?.type === "create_product") {
      assert.equal(product.source, kind);
      assert.match(product.costStated, /€/);
    }
  }
  const service = proposeFromReading(
    readOfferFile("Contrat cadre\nMaintenance annuelle | 40,00 € HT", "contrat.txt"),
    "contrat.txt",
    emptyDirectory,
    [],
  );
  const row = service?.actions.find((action) => action.type === "create_product");
  if (row?.type === "create_product") assert.equal(row.kind, "service");
});

test("une fiche de kit n’ouvre ni devis ni projet", () => {
  const reading = readOfferFile(
    `Qualcomm QCS6490 Development Kit
AOM-DK2721
Part No. AOM-DK2721-FAA1E`,
    "AOM-DK2721_DS.pdf",
  );
  assert.equal(reading.kind, "fiche");
  assert.equal(reading.offers.length, 0);
  const proposal = proposeFromReading(reading, "AOM-DK2721_DS.pdf", emptyDirectory, []);
  assert.equal(proposal?.actions[0]?.type, "create_product");
  if (proposal?.actions[0]?.type === "create_product") {
    assert.equal(proposal.actions[0].reference, "AOM-DK2721");
    assert.match(proposal.actions[0].name, /Kit de développement/);
  }
});
