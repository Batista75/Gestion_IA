import assert from "node:assert/strict";
import test from "node:test";
import {
  commandFromTool,
  parseCatalogCommand,
  productOrigin,
  readSupplierUrl,
  validateProduct,
} from "../src/domain/catalog.ts";
import { identifyClient } from "../src/domain/client-file.ts";
import { structuredPlanEligible } from "../src/domain/structured-plan.ts";

test("crée un compte client et une mise à jour", () => {
  const created = parseCatalogCommand(
    "création d'un compte client Atelier Nord, email contact@atelier.fr, téléphone 01 02 03 04 05",
  );
  assert.equal(created?.type, "create_client");
  if (created?.type === "create_client") {
    assert.equal(created.party.name, "Atelier Nord");
    assert.equal(created.party.email, "contact@atelier.fr");
    assert.equal(created.party.phone, "01 02 03 04 05");
  }

  const updated = parseCatalogCommand(
    "mettre à jour le client Atelier Nord, adresse 12 rue des Lilas, Paris",
  );
  assert.equal(updated?.type, "update_client");
  if (updated?.type === "update_client") {
    assert.equal(updated.party.name, "Atelier Nord");
    assert.equal(updated.party.address, "12 rue des Lilas, Paris");
  }
});

test("crée un projet, un fournisseur et un devis", () => {
  const project = parseCatalogCommand(
    "créer projet Atlas pour le client Atelier Nord",
  );
  assert.equal(project?.type, "create_project");
  if (project?.type === "create_project") {
    assert.equal(project.name, "Atlas");
    assert.equal(project.primaryClient, "Atelier Nord");
  }

  const supplier = parseCatalogCommand("ajouter un fournisseur Quincaillerie Durand");
  assert.equal(supplier?.type, "create_supplier");

  const quote = parseCatalogCommand(
    "devis Offre mars, produit Vis à bois, référence VIS-01, produit Charnière",
  );
  assert.equal(quote?.type, "record_quote");
  if (quote?.type === "record_quote") {
    assert.equal(quote.title, "Offre mars");
    assert.equal(quote.products.length, 2);
    assert.equal(quote.products[0]?.reference, "VIS-01");
    assert.equal(quote.products[1]?.name, "Charnière");
  }
});

test("une question libre n’est pas une commande", () => {
  assert.equal(parseCatalogCommand("Comment ranger une facture ?"), null);
});

test("une commande structurée isole le nom et le client", () => {
  const client = parseCatalogCommand(
    "création d'un compte client Atelier Nord, email contact@atelier.fr, téléphone 01 02 03 04 05",
  );
  assert.equal(client?.type, "create_client");
  if (client?.type === "create_client") assert.equal(client.party.name, "Atelier Nord");

  const project = parseCatalogCommand("créer projet Atlas pour le client Atelier Nord");
  assert.equal(project?.type, "create_project");
  if (project?.type === "create_project") {
    assert.equal(project.name, "Atlas");
    assert.equal(project.primaryClient, "Atelier Nord");
  }

  const labeled = parseCatalogCommand("créer projet Atlas, client Atelier Nord");
  assert.equal(labeled?.type, "create_project");
  if (labeled?.type === "create_project") assert.equal(labeled.primaryClient, "Atelier Nord");

  const supplier = parseCatalogCommand("ajouter un fournisseur Quincaillerie Durand");
  assert.equal(supplier?.type, "create_supplier");
  if (supplier?.type === "create_supplier") assert.equal(supplier.party.name, "Quincaillerie Durand");
});

test("une phrase naturelle de projet n’est pas une commande catalogue", () => {
  for (const text of [
    "Ouvre un projet Climatisation pour Dupont.",
    "Ouvre le projet Toiture pour Dupont.",
    "Crée le projet Toiture pour Dupont.",
    "Ouvre un projet RECETTE-V3-002 Climatisation pour RECETTE-V3-002 Dupont.",
    "Ouvre le dossier RECETTE-V3-002 Climatisation pour RECETTE-V3-002 Dupont.",
  ]) {
    assert.equal(parseCatalogCommand(text), null);
    assert.equal(structuredPlanEligible(text), true);
  }
});

test("une phrase naturelle de client n’isole pas un mauvais nom", () => {
  const dotted = parseCatalogCommand("Crée le client Dupont.");
  assert.equal(dotted, null);
  assert.equal(structuredPlanEligible("Crée le client Dupont."), true);

  assert.equal(
    parseCatalogCommand("Crée le client Dupont, son téléphone est 01 23 45 67 89."),
    null,
  );
  const lyon = "Ajoute un client Dupont qui habite Lyon.";
  assert.equal(parseCatalogCommand(lyon), null);
  assert.equal(identifyClient(lyon), null);
  assert.equal(structuredPlanEligible(lyon), true);
});

test("la phrase de recette client reste disponible pour le plan", () => {
  const text = "J'ai un nouveau client RECETTE-V3-002 Dupont.";
  assert.equal(identifyClient(text), null);
  assert.equal(parseCatalogCommand(text), null);
  assert.equal(structuredPlanEligible(text), true);
});

test("un outil Ollama devient une commande", () => {
  const command = commandFromTool("create_product", {
    name: "Vis à bois",
    supplierName: "Durand",
  });
  assert.equal(command?.type, "create_product");
  if (command?.type === "create_product") {
    assert.equal(command.product.supplierName, "Durand");
  }
});

test("une note vide et un lien http sont acceptés, un autre schéma non", () => {
  const empty = validateProduct({
    name: "Vis à bois",
    reference: "",
    unit: "",
    description: "",
    supplierName: "",
    sourceNote: "  Prix vu en magasin  ",
    sourceUrl: "",
  });
  assert.equal(empty.ok, true);
  if (empty.ok) {
    assert.equal(empty.value.sourceNote, "Prix vu en magasin");
    assert.equal(empty.value.sourceUrl, "");
  }
  const site = readSupplierUrl("https://fournisseur.example/vis");
  assert.equal(site.ok, true);
  if (site.ok) assert.equal(site.value, "https://fournisseur.example/vis");
  assert.equal(readSupplierUrl("javascript:alert(1)").ok, false);
  assert.equal(readSupplierUrl("www.fournisseur.example").ok, false);
});

test("l’origine produit cite le devis", () => {
  assert.equal(
    productOrigin("devis", ["Offre mars"]),
    "Devis : Offre mars",
  );
  assert.equal(productOrigin("assistant", []), "Saisi par l’assistant");
});
