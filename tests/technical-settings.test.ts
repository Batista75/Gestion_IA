import assert from "node:assert/strict";
import test from "node:test";
import { cleanModelName, maskSecret, nextApiKey } from "../src/domain/technical-settings.ts";

test("la clé affichée ne montre que la fin", () => {
  assert.equal(maskSecret(""), "");
  assert.equal(maskSecret("abcd"), "••••");
  assert.equal(maskSecret("cle-secrete-1234"), "••••1234");
});

test("une clé vide conserve l’ancienne, une case la retire", () => {
  assert.deepEqual(nextApiKey("ancienne-cle", "", false), { ok: true, value: "ancienne-cle" });
  assert.deepEqual(nextApiKey("ancienne-cle", "", true), { ok: true, value: "" });
  assert.deepEqual(nextApiKey("", "nouvelle-cle", false), { ok: true, value: "nouvelle-cle" });
  assert.equal(nextApiKey("", "trop courte", false).ok, false);
  assert.equal(nextApiKey("", "avec espace dedans", false).ok, false);
});

test("le nom de modèle reste un identifiant court", () => {
  assert.deepEqual(cleanModelName(""), { ok: true, value: "" });
  assert.deepEqual(cleanModelName("qwen2.5:7b"), { ok: true, value: "qwen2.5:7b" });
  assert.equal(cleanModelName("modèle français").ok, false);
});
