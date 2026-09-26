import assert from "node:assert/strict";
import test from "node:test";
import { cleanCompany, readLogo, sheetBuys, sheetHeading } from "../src/domain/company.ts";

const blank = {
  legalName: "",
  address: "",
  postalCode: "",
  city: "",
  country: "",
  email: "",
  phone: "",
  siren: "",
  vatNumber: "",
};

test("une entreprise se nettoie sans inventer un numéro", () => {
  const cleaned = cleanCompany({
    ...blank,
    legalName: "  Atelier   Nord ",
    siren: "732 829 320",
    vatNumber: "fr 32 732829320",
    email: "contact@atelier.fr",
  });
  assert.equal(cleaned.ok, true);
  if (!cleaned.ok) return;
  assert.equal(cleaned.value.legalName, "Atelier Nord");
  assert.equal(cleaned.value.siren, "732829320");
  assert.equal(cleaned.value.vatNumber, "FR32732829320");
});

test("un SIREN incomplet et un logo inconnu sont refusés", () => {
  const siren = cleanCompany({ ...blank, legalName: "Atelier Nord", siren: "123" });
  assert.equal(siren.ok, false);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(readLogo(png).ok, true);
  assert.equal(readLogo(Uint8Array.from([1, 2, 3, 4])).ok, false);
  assert.match(readLogo(new Uint8Array(2_000_001)).error ?? "", /2 Mo/);
});

test("les documents produits ont un intitulé, la facture n’est pas une commande d’achat", () => {
  assert.equal(sheetHeading("devis"), "Devis client");
  assert.equal(sheetHeading("commande_fournisseur"), "Commande fournisseur");
  assert.equal(sheetHeading("facture"), "Facture client");
  assert.equal(sheetBuys("commande_fournisseur"), true);
  assert.equal(sheetBuys("facture"), false);
});
