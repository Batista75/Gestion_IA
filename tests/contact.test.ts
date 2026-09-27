import assert from "node:assert/strict";
import test from "node:test";
import { contactLabel, readExtraContact, splitContactName } from "../src/domain/contact.ts";

test("un nom complet se sépare en prénom et nom", () => {
  assert.deepEqual(splitContactName("  Anne   Durand "), { firstName: "Anne", lastName: "Durand" });
  assert.deepEqual(splitContactName("Durand"), { firstName: "", lastName: "Durand" });
  assert.deepEqual(splitContactName("Jean Pierre Martin"), { firstName: "Jean Pierre", lastName: "Martin" });
});

test("le libellé affiche le nom, puis l’e-mail", () => {
  assert.equal(contactLabel({ firstName: "Anne", lastName: "Durand" }), "Anne Durand");
  assert.equal(contactLabel({ firstName: "", lastName: "", email: "a@bois.fr" }), "a@bois.fr");
});

test("un interlocuteur sans nom est refusé", () => {
  const refused = readExtraContact({ firstName: " ", lastName: "", role: "", email: "", phone: "" });
  assert.equal(refused.ok, false);
});

test("un e-mail d’interlocuteur invalide est refusé", () => {
  const refused = readExtraContact({
    firstName: "Anne",
    lastName: "Durand",
    role: "Achats",
    email: "anne",
    phone: "",
  });
  assert.equal(refused.ok, false);
});
