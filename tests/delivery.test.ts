import assert from "node:assert/strict";
import test from "node:test";
import { cleanDelivery, deliveryModeLabel, deliverySummary } from "../src/domain/delivery.ts";

const blank = {
  recipient: "",
  address: "",
  postalCode: "",
  city: "",
  country: "",
  contact: "",
  phone: "",
  slot: "",
  mode: "",
  note: "",
};

test("une livraison vide reste vide, une adresse est reprise telle quelle", () => {
  assert.deepEqual(deliverySummary(blank), []);
  const cleaned = cleanDelivery({
    ...blank,
    recipient: "  Quai   nord ",
    address: "4 rue du Port",
    postalCode: "44000",
    city: "Nantes",
    mode: "sur_site",
    slot: "15 octobre, 14 h",
    phone: "02 40 00 00 00",
  });
  assert.equal(cleaned.ok, true);
  if (!cleaned.ok) return;
  assert.equal(cleaned.value.recipient, "Quai nord");
  const lines = deliverySummary(cleaned.value);
  assert.match(lines.join(" "), /4 rue du Port/);
  assert.match(lines.join(" "), /Nantes/);
  assert.match(lines.join(" "), /Sur site/);
  assert.match(lines.join(" "), /15 octobre, 14 h/);
  assert.equal(deliveryModeLabel("a_distance"), "À distance");
});

test("un mode inconnu et un téléphone illisible sont refusés", () => {
  assert.equal(cleanDelivery({ ...blank, mode: "drone" }).ok, false);
  assert.equal(cleanDelivery({ ...blank, phone: "abc" }).ok, false);
});
