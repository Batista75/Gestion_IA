import assert from "node:assert/strict";
import test from "node:test";
import {
  commandFromTool,
  parseCatalogCommand,
  productOrigin,
} from "../src/domain/catalog.ts";

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

test("l’origine produit cite le devis", () => {
  assert.equal(
    productOrigin("devis", ["Offre mars"]),
    "Devis : Offre mars",
  );
  assert.equal(productOrigin("assistant", []), "Saisi par l’assistant");
});
