import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalogCommand, presentCommand } from "../src/domain/catalog.ts";
import { bareNameQuestion } from "../src/domain/knowledge.ts";

const names = ["Marie Dupont", "Paul Dupont", "Holzwerk Müller GmbH"];

test("un nom seul déjà connu demande de consulter ou de modifier", () => {
  assert.match(
    bareNameQuestion("Marie Dupont", names) ?? "",
    /Voulez-vous consulter la fiche ou la modifier/,
  );
  assert.equal(bareNameQuestion("que sait-on de Holzwerk", names), null);
  assert.equal(bareNameQuestion("téléphone de Marie Dupont", names), null);
  assert.equal(bareNameQuestion("Dupont", names), null);
  assert.equal(bareNameQuestion("créer client Marie Dupont", names), null);
});

test("une commande de catalogue se présente sans être enregistrée", () => {
  const command = parseCatalogCommand("ajouter un fournisseur Quincaillerie Durand");
  assert.ok(command);
  const view = presentCommand(command);
  assert.match(view.reply, /Rien n’est enregistré avant votre accord/);
  assert.match(view.reply, /Confirmez-vous l’enregistrement/);
  assert.equal(view.fields.some((field) => field.value === "Quincaillerie Durand"), true);

  const project = parseCatalogCommand("créer projet Atlas, client Atelier Nord");
  assert.ok(project);
  assert.match(presentCommand(project).reply, /Rien n’est enregistré avant votre accord/);
});
