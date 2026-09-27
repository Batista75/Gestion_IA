import assert from "node:assert/strict";
import test from "node:test";
import { canShareOrganization } from "../src/domain/catalog.ts";

test("le même nom relie un client et un fournisseur", () => {
  assert.equal(canShareOrganization("Hélios", "helios"), true);
  assert.equal(canShareOrganization("Helios", "Nord"), false);
  assert.equal(canShareOrganization("  ", "Helios"), false);
});
