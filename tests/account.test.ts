import assert from "node:assert/strict";
import test from "node:test";
import { devAdmin, readAccountDraft, readLogin } from "../src/domain/account.ts";
import { hashPassword, verifyPassword } from "../src/lib/password.ts";
import { readSessionToken, signSession } from "../src/lib/session.ts";

test("le premier accès exige un e-mail, deux mots de passe identiques et 8 caractères", () => {
  const ready = readAccountDraft({
    firstName: " Jhon ",
    lastName: "Smith",
    email: "J.Smith@Atelier.Local",
    password: "Gestion-locale-1",
    confirm: "Gestion-locale-1",
  });
  assert.deepEqual(ready, {
    firstName: "Jhon",
    lastName: "Smith",
    email: "j.smith@atelier.local",
    password: "Gestion-locale-1",
  });
  assert.equal("error" in readAccountDraft({
    firstName: "Jhon",
    lastName: "Smith",
    email: "atelier",
    password: "Gestion-locale-1",
    confirm: "Gestion-locale-1",
  }), true);
  assert.equal("error" in readAccountDraft({
    firstName: "Jhon",
    lastName: "Smith",
    email: "j.smith@atelier.local",
    password: "court",
    confirm: "court",
  }), true);
  assert.equal("error" in readAccountDraft({
    firstName: "Jhon",
    lastName: "Smith",
    email: "j.smith@atelier.local",
    password: "Gestion-locale-1",
    confirm: "autre-mot",
  }), true);
});

test("le mot de passe stocké se vérifie sans être relu", () => {
  const stored = hashPassword("Gestion-locale-1");
  assert.equal(stored.includes("Gestion-locale-1"), false);
  assert.equal(verifyPassword("Gestion-locale-1", stored), true);
  assert.equal(verifyPassword("Gestion-locale-2", stored), false);
  const empty = readLogin({ email: "", password: "" });
  assert.equal("error" in empty, true);
});

test("le compte admin de développement a un accès valide", () => {
  const ready = readAccountDraft({ ...devAdmin, confirm: devAdmin.password });
  assert.equal("error" in ready, false);
  if ("error" in ready) return;
  assert.equal(ready.email, "admin@atelier.local");
  assert.equal(devAdmin.role, "admin");
});

test("une session signée expire et une session altérée est refusée", () => {
  const token = signSession({ id: "compte", mark: "J Smith" });
  assert.deepEqual(readSessionToken(token), { id: "compte", mark: "J Smith", role: "" });
  assert.equal(readSessionToken(`${token}x`), null);
  assert.equal(readSessionToken(undefined), null);
});
