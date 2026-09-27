import assert from "node:assert/strict";
import test from "node:test";
import { addressKindLabel, formatAddress, readExtraAddress } from "../src/domain/address.ts";

test("une adresse se lit en une ligne", () => {
  assert.equal(
    formatAddress({ line: "12 rue des Lilas", postalCode: "69001", city: "Lyon", country: "France" }),
    "12 rue des Lilas, 69001 Lyon, France",
  );
});

test("le siège, la facturation et la livraison ont un libellé", () => {
  assert.equal(addressKindLabel("siege"), "Siège");
  assert.equal(addressKindLabel("facturation"), "Facturation");
  assert.equal(addressKindLabel("livraison"), "Livraison");
});

test("une adresse supplémentaire sans rue ni ville est refusée", () => {
  const refused = readExtraAddress({ kind: "livraison", line: "1", postalCode: "", city: "", country: "" });
  assert.equal(refused.ok, false);
});

test("le code postal et la ville suffisent pour une adresse de facturation", () => {
  const accepted = readExtraAddress({
    kind: "facturation",
    line: "",
    postalCode: "75002",
    city: "Paris",
    country: "France",
  });
  assert.equal(accepted.ok, true);
  if (accepted.ok) assert.equal(accepted.value.kind, "facturation");
});

test("le siège ne se saisit pas comme adresse supplémentaire", () => {
  const refused = readExtraAddress({ kind: "siege", line: "12 rue des Lilas", postalCode: "", city: "", country: "" });
  assert.equal(refused.ok, false);
});
