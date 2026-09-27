import assert from "node:assert/strict";
import test from "node:test";
import { currentOperatorMark, operatorMark } from "../src/domain/operator.ts";

test("l’auteur d’une modification est l’initiale et le nom", () => {
  assert.equal(operatorMark("Jhon", "Smith"), "J Smith");
  assert.equal(operatorMark("anne", "Durand"), "A Durand");
  assert.equal(currentOperatorMark(), "J Smith");
  assert.equal(operatorMark("", "Smith"), "");
});
