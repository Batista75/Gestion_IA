import assert from "node:assert/strict";
import test from "node:test";
import {
  asksModelToComputeMoney,
  resolveOllamaBaseUrl,
} from "../src/domain/ollama-endpoint.ts";

test("l’adresse par défaut est le PC hôte", () => {
  assert.equal(resolveOllamaBaseUrl(undefined), "http://192.168.1.5:11434");
  assert.equal(
    resolveOllamaBaseUrl("http://192.168.1.5:11434/"),
    "http://192.168.1.5:11434",
  );
});

test("accepte la passerelle NAT de VirtualBox", () => {
  assert.equal(
    resolveOllamaBaseUrl("http://10.0.2.2:11434"),
    "http://10.0.2.2:11434",
  );
});

test("refuse un service public", () => {
  assert.throws(
    () => resolveOllamaBaseUrl("https://api.openai.com/v1"),
    /réseau local/,
  );
});

test("une question de prix chiffrée ne part pas vers le modèle", () => {
  assert.equal(
    asksModelToComputeMoney(
      "Calcule le prix de vente pour un coût de 700 €, marque 30 % et remise 10 %.",
    ),
    true,
  );
  assert.equal(
    asksModelToComputeMoney("Comment ranger une facture fournisseur ?"),
    false,
  );
  assert.equal(
    asksModelToComputeMoney("créer produit Vis à bois, référence VIS-12"),
    false,
  );
});
