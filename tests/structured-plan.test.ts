import assert from "node:assert/strict";
import test from "node:test";
import { planInboxLink } from "../src/domain/proposal-scope.ts";
import { decideFree } from "../src/domain/intent-catalog.ts";
import {
  parseStructuredPlan,
  projectRolesMatch,
  structuredAttemptOutcome,
  structuredPlanEligible,
  structuredPlanGate,
  translateStructuredPlan,
  valueAnchored,
  outsideStructuredPlan,
  structuredShape,
  type KnownClient,
} from "../src/domain/structured-plan.ts";

function plan(actions: unknown[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ source: "ollama", actions, missing: [], ...extra });
}

const client = { type: "CREATE_CLIENT", args: { name: "Dupont" } };
const project = { type: "CREATE_PROJECT", args: { name: "Toiture", clientName: "Dupont" } };
const folder = "Nouveau client Dupont. Dossier Toiture pour Dupont.";

function known(name: string, extra: Partial<KnownClient> = {}): KnownClient {
  return { name, email: extra.email ?? "", phone: extra.phone ?? "", address: extra.address ?? "" };
}

test("CREATE_CLIENT valide", () => {
  const parsed = parseStructuredPlan(plan([client]), "J'ai un nouveau client Dupont.");
  assert.equal(parsed.ok, true);
});

test("CREATE_PROJECT valide", () => {
  const parsed = parseStructuredPlan(plan([project]), "Ouvre le dossier Toiture pour Dupont.");
  assert.equal(parsed.ok, true);
});

test("couple client et projet", () => {
  const parsed = parseStructuredPlan(plan([client, project]), "Nouveau client Dupont, dossier Toiture.");
  assert.equal(parsed.ok, true);
});

test("JSON invalide", () => {
  assert.equal(parseStructuredPlan("{", "Dupont").ok, false);
});

test("objet non JSON", () => {
  assert.equal(parseStructuredPlan("bonjour", "bonjour").ok, false);
});

test("ActionType inconnu", () => {
  assert.equal(parseStructuredPlan(plan([{ type: "UPDATE_CLIENT", args: { name: "Dupont" } }]), "Dupont").ok, false);
});

test("clé inconnue", () => {
  assert.equal(parseStructuredPlan(plan([client], { extra: true }), "Dupont").ok, false);
});

test("clientId injecté", () => {
  assert.equal(parseStructuredPlan(plan([client], { clientId: "abc" }), "Dupont").ok, false);
});

test("id imbriqué", () => {
  assert.equal(
    parseStructuredPlan(plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", id: "abc" } }]), "Dupont").ok,
    false,
  );
});

test("action vide", () => {
  assert.equal(parseStructuredPlan(plan([{ type: "CREATE_CLIENT" }]), "Dupont").ok, false);
});

test("tableau vide", () => {
  assert.equal(parseStructuredPlan(plan([]), "Dupont").ok, false);
});

test("plus de deux actions", () => {
  assert.equal(parseStructuredPlan(plan([client, client, client]), "Dupont").ok, false);
});

test("nom trop long", () => {
  const name = "A".repeat(121);
  assert.equal(parseStructuredPlan(plan([{ type: "CREATE_CLIENT", args: { name } }]), name).ok, false);
});

test("email invalide", () => {
  assert.equal(
    parseStructuredPlan(plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", email: "pas-un-mail" } }]), "Dupont pas-un-mail").ok,
    false,
  );
});

test("confidence supérieure à 1", () => {
  assert.equal(
    parseStructuredPlan(plan([client], { confidence: [{ field: "name", value: 1.2 }] }), "Dupont").ok,
    false,
  );
});

test("missing trop long", () => {
  assert.equal(parseStructuredPlan(plan([client], { missing: ["m".repeat(121)] }), "Dupont").ok, false);
});

test("un plan sans source reçoit ollama côté serveur", () => {
  const clientOnly = parseStructuredPlan(
    JSON.stringify({ actions: [{ type: "CREATE_CLIENT", args: { name: "Dupont" } }], missing: [] }),
    "J'ai un nouveau client Dupont.",
  );
  assert.equal(clientOnly.ok, true);
  if (!clientOnly.ok) return;
  assert.equal(clientOnly.plan.source, "ollama");
  assert.equal(clientOnly.plan.actions[0]?.type, "CREATE_CLIENT");

  const projectOnly = parseStructuredPlan(
    JSON.stringify({
      actions: [{ type: "CREATE_PROJECT", args: { name: "Climatisation", clientName: "Dupont" } }],
      missing: [],
    }),
    "Ouvre le dossier Climatisation pour Dupont.",
  );
  assert.equal(projectOnly.ok, true);
  if (!projectOnly.ok) return;
  assert.equal(projectOnly.plan.source, "ollama");

  const couple = parseStructuredPlan(
    JSON.stringify({ actions: [client, project], missing: [] }),
    "Nouveau client Dupont. Dossier Toiture pour Dupont.",
  );
  assert.equal(couple.ok, true);
  if (!couple.ok) return;
  assert.equal(couple.plan.source, "ollama");
  assert.equal(couple.plan.actions.length, 2);
});

test("une provenance déclarée par le modèle est ignorée", () => {
  const parsed = parseStructuredPlan(
    JSON.stringify({ source: "user", actions: [client], missing: [] }),
    "J'ai un nouveau client Dupont.",
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.plan.source, "ollama");
});

test("ancrage du nom", () => {
  assert.equal(valueAnchored("J'ai un nouveau client Dupont.", "Dupont"), true);
  assert.equal(valueAnchored("J'ai un nouveau client Dupont.", "dupont"), true);
  assert.equal(valueAnchored("Client   Dupont,  merci.", "Dupont, merci"), true);
  assert.equal(parseStructuredPlan(plan([client]), "J'ai un nouveau client Dupont.").ok, true);
});

test("email présent et ancré", () => {
  const parsed = parseStructuredPlan(
    plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", email: "dupont@example.com" } }]),
    "Ajoute Dupont, dupont@example.com.",
  );
  assert.equal(parsed.ok, true);
});

test("email absent du message", () => {
  assert.equal(
    parseStructuredPlan(
      plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", email: "dupont@example.com" } }]),
      "J'ai un nouveau client Dupont.",
    ).ok,
    false,
  );
});

test("téléphone absent", () => {
  assert.equal(
    parseStructuredPlan(
      plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", phone: "0612345678" } }]),
      "J'ai un nouveau client Dupont.",
    ).ok,
    false,
  );
});

test("clientName inventé", () => {
  assert.equal(
    parseStructuredPlan(plan([{ type: "CREATE_PROJECT", args: { name: "Toiture", clientName: "Martin" } }]), "Ouvre le dossier Toiture.").ok,
    false,
  );
});

test("nom de dossier inventé", () => {
  assert.equal(
    parseStructuredPlan(plan([{ type: "CREATE_PROJECT", args: { name: "Toiture", clientName: "Dupont" } }]), "Dossier pour Dupont.").ok,
    false,
  );
});

test("CREATE_CLIENT devient create_client", () => {
  const parsed = parseStructuredPlan(plan([client]), "Client Dupont");
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const translated = translateStructuredPlan(parsed.plan, null, "Client Dupont");
  assert.equal(translated.kind, "catalog");
  if (translated.kind !== "catalog") return;
  assert.equal(translated.command.type, "create_client");
});

test("CREATE_PROJECT résolu devient create_project", () => {
  const parsed = parseStructuredPlan(plan([project]), "Dossier Toiture pour Dupont");
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const translated = translateStructuredPlan(parsed.plan, known("Dupont"), "Dossier Toiture pour Dupont");
  assert.equal(translated.kind, "catalog");
  if (translated.kind !== "catalog") return;
  assert.equal(translated.command.type, "create_project");
  if (translated.command.type !== "create_project") return;
  assert.equal(translated.command.primaryClient, "Dupont");
});

test("client et projet nouveaux deviennent un plan métier", () => {
  const parsed = parseStructuredPlan(plan([client, project]), folder);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const translated = translateStructuredPlan(parsed.plan, null, folder);
  assert.equal(translated.kind, "business");
  if (translated.kind !== "business") return;
  assert.equal(translated.plan.clients.length, 1);
  assert.equal(translated.plan.projects.length, 1);
});

test("client existant et projet deviennent seulement create_project", () => {
  const parsed = parseStructuredPlan(plan([client, project]), folder);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const translated = translateStructuredPlan(parsed.plan, known("DUPONT SARL"), folder);
  assert.equal(translated.kind, "catalog");
  if (translated.kind !== "catalog" || translated.command.type !== "create_project") return;
  assert.equal(translated.command.primaryClient, "DUPONT SARL");
  assert.equal(translated.command.name, "Toiture");
});

test("deux clients refusés", () => {
  const parsed = parseStructuredPlan(plan([client, { type: "CREATE_CLIENT", args: { name: "Martin" } }]), "Dupont et Martin");
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(translateStructuredPlan(parsed.plan, null, "Dupont et Martin").kind, "clarify");
});

test("projet puis client refusé", () => {
  const parsed = parseStructuredPlan(plan([project, client]), "Toiture Dupont");
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(translateStructuredPlan(parsed.plan, null, "Toiture Dupont").kind, "clarify");
});

test("noms de client différents refusés", () => {
  const parsed = parseStructuredPlan(
    plan([client, { type: "CREATE_PROJECT", args: { name: "Toiture", clientName: "Martin" } }]),
    "Dupont Martin Toiture",
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(translateStructuredPlan(parsed.plan, null, "Dupont Martin Toiture").kind, "clarify");
});

test("missing refuse la proposition", () => {
  const parsed = parseStructuredPlan(plan([client], { missing: ["adresse"] }), "Client Dupont");
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(translateStructuredPlan(parsed.plan, null, "Client Dupont").kind, "missing");
});

test("Du dans du salon Dupont est refusé", () => {
  assert.equal(valueAnchored("client du salon Dupont", "Du"), false);
});

test("Dupo dans Dupont est refusé", () => {
  assert.equal(valueAnchored("Dupont", "Dupo"), false);
});

test("Dupont dans Dupontel est refusé", () => {
  assert.equal(valueAnchored("Dupontel", "Dupont"), false);
});

test("email tronqué refusé", () => {
  assert.equal(
    parseStructuredPlan(
      plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", email: "dupont@acme.fr" } }]),
      "Client Dupont, jean.dupont@acme.fr.",
    ).ok,
    false,
  );
  assert.equal(
    parseStructuredPlan(
      plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", email: "x@acme.fr" } }]),
      "Client Dupont, x@acme.fromage.com.",
    ).ok,
    false,
  );
});

test("email complet exact accepté", () => {
  assert.equal(
    parseStructuredPlan(
      plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", email: "jean.dupont@acme.fr" } }]),
      "Client Dupont, jean.dupont@acme.fr.",
    ).ok,
    true,
  );
});

test("téléphone partiel refusé", () => {
  const message = "Client Dupont, 01 23 45 67 89.";
  assert.equal(parseStructuredPlan(plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", phone: "01" } }]), message).ok, false);
  assert.equal(
    parseStructuredPlan(plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", phone: "45 67" } }]), message).ok,
    false,
  );
});

test("téléphone complet accepté", () => {
  assert.equal(
    parseStructuredPlan(
      plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", phone: "01 23 45 67 89" } }]),
      "Client Dupont, 01 23 45 67 89.",
    ).ok,
    true,
  );
});

test("adresse partielle refusée", () => {
  assert.equal(
    parseStructuredPlan(
      plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", address: "Paris" } }]),
      "Client Dupont, 12 rue de Paris.",
    ).ok,
    false,
  );
});

test("adresse exacte acceptée", () => {
  assert.equal(
    parseStructuredPlan(
      plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", address: "12 rue de Paris" } }]),
      "Client Dupont, 12 rue de Paris.",
    ).ok,
    true,
  );
});

test("casse différente sur un nom complet", () => {
  assert.equal(valueAnchored("client DUPONT", "Dupont"), true);
});

test("apostrophe typographique", () => {
  assert.equal(valueAnchored("dossier d’Orsay", "d'Orsay"), true);
});

test("rôles name et clientName inversés", () => {
  const inverted = { type: "CREATE_PROJECT", args: { name: "Dupont", clientName: "Toiture" } };
  const message = "Ouvre le dossier Toiture pour Dupont";
  const parsed = parseStructuredPlan(plan([inverted]), message);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(projectRolesMatch(message, "Dupont", "Toiture"), false);
  assert.equal(translateStructuredPlan(parsed.plan, known("Toiture"), message).kind, "clarify");
});

test("crée, ajoute et ouvre sont éligibles", () => {
  for (const text of [
    "J'ai un nouveau client Dupont.",
    "Ajoute Dupont comme client.",
    "Crée le client Dupont.",
    "Ouvre le dossier Toiture pour Dupont.",
    "Ouvre un projet Climatisation pour Dupont.",
  ]) {
    assert.equal(structuredPlanEligible(text), true);
    assert.equal(structuredPlanGate(true, false), "plan");
  }
  const opened = decideFree("Ouvre le dossier Toiture pour Dupont");
  assert.equal(opened.execution, "recherche");
  assert.equal(structuredPlanGate(structuredPlanEligible("Ouvre le dossier Toiture pour Dupont"), false), "plan");
});

test("supprime, modifie et mets à jour ne sont pas des créations", () => {
  assert.equal(structuredPlanEligible("Supprime le client Dupont"), false);
  assert.equal(structuredPlanEligible("Modifie le client Dupont"), false);
  assert.equal(structuredPlanEligible("mets à jour le client Dupont"), false);
  assert.equal(structuredPlanEligible("mettre à jour le client Dupont"), false);
});

test("client existant sans donnée nouvelle", () => {
  const parsed = parseStructuredPlan(plan([client, project]), folder);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const translated = translateStructuredPlan(parsed.plan, known("DUPONT SARL"), folder);
  assert.equal(translated.kind, "catalog");
  if (translated.kind !== "catalog" || translated.command.type !== "create_project") return;
  assert.equal(translated.command.primaryClient, "DUPONT SARL");
});

test("email identique sur un client existant", () => {
  const message = "Ajoute Dupont, dupont@example.com. Dossier Toiture pour Dupont.";
  const parsed = parseStructuredPlan(
    plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", email: "dupont@example.com" } }, project]),
    message,
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const translated = translateStructuredPlan(parsed.plan, known("Dupont", { email: "Dupont@example.com" }), message);
  assert.equal(translated.kind, "catalog");
});

test("email différent sur un client existant", () => {
  const message = "Ajoute Dupont, dupont@example.com. Dossier Toiture pour Dupont.";
  const parsed = parseStructuredPlan(
    plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", email: "dupont@example.com" } }, project]),
    message,
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const translated = translateStructuredPlan(parsed.plan, known("Dupont", { email: "autre@example.com" }), message);
  assert.equal(translated.kind, "contact-differs");
  if (translated.kind !== "contact-differs") return;
  assert.deepEqual(translated.fields, ["email"]);
  assert.equal(translated.withProject, true);
});

test("téléphone différent sur un client existant", () => {
  const message = "Ajoute Dupont, 01 23 45 67 89. Dossier Toiture pour Dupont.";
  const parsed = parseStructuredPlan(
    plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", phone: "01 23 45 67 89" } }, project]),
    message,
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const translated = translateStructuredPlan(parsed.plan, known("Dupont", { phone: "06 00 00 00 00" }), message);
  assert.equal(translated.kind, "contact-differs");
  if (translated.kind !== "contact-differs") return;
  assert.deepEqual(translated.fields, ["phone"]);
});

test("adresse différente sur un client existant", () => {
  const message = "Ajoute Dupont, 12 rue de Paris. Dossier Toiture pour Dupont.";
  const parsed = parseStructuredPlan(
    plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", address: "12 rue de Paris" } }, project]),
    message,
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const translated = translateStructuredPlan(parsed.plan, known("Dupont", { address: "4 avenue de Lyon" }), message);
  assert.equal(translated.kind, "contact-differs");
  if (translated.kind !== "contact-differs") return;
  assert.deepEqual(translated.fields, ["address"]);
});

test("client existant seul avec un téléphone différent", () => {
  const message = "Ajoute Dupont comme client, 01 23 45 67 89.";
  const parsed = parseStructuredPlan(
    plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", phone: "01 23 45 67 89" } }]),
    message,
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const translated = translateStructuredPlan(parsed.plan, known("Dupont"), message);
  assert.equal(translated.kind, "contact-differs");
  if (translated.kind !== "contact-differs") return;
  assert.equal(translated.withProject, false);
});

test("une phrase Ollama n’hérite pas de l’entrée précédente", () => {
  assert.equal(planInboxLink(null, "entree-ancienne", true), "entree-ancienne");
  assert.equal(planInboxLink("entree-courante", "entree-ancienne", true), "entree-courante");
  assert.equal(planInboxLink(null, "entree-ancienne", false), null);
});

test("confidence.field autorisé", () => {
  assert.equal(
    parseStructuredPlan(plan([client], { confidence: [{ field: "name", value: 1 }] }), "Client Dupont").ok,
    true,
  );
});

test("confidence.field interdit", () => {
  assert.equal(
    parseStructuredPlan(plan([client], { confidence: [{ field: "clientId", value: 1 }] }), "Client Dupont").ok,
    false,
  );
  assert.equal(
    parseStructuredPlan(plan([client], { confidence: [{ field: "prixTTC", value: 1 }] }), "Client Dupont").ok,
    false,
  );
});

test("un échec de plan d’écriture ne relance pas une lecture", () => {
  assert.equal(structuredAttemptOutcome(true, false), "block");
  assert.equal(structuredAttemptOutcome(true, true), "propose");
  assert.equal(structuredAttemptOutcome(false, false), "continue");
});

test("téléphone cité mais absent d’un CREATE_PROJECT", () => {
  const message = "Ouvre le dossier Climatisation pour Dupont, son téléphone est 01 23 45 67 89.";
  const parsed = parseStructuredPlan(
    plan([{ type: "CREATE_PROJECT", args: { name: "Climatisation", clientName: "Dupont" } }]),
    message,
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const translated = translateStructuredPlan(parsed.plan, known("Dupont"), message);
  assert.equal(translated.kind, "omitted");
  if (translated.kind !== "omitted") return;
  assert.deepEqual(translated.fields, ["phone"]);
});

test("téléphone cité mais absent d’un CREATE_CLIENT", () => {
  const message = "Ajoute Dupont comme client, téléphone 01 23 45 67 89.";
  const parsed = parseStructuredPlan(plan([client]), message);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(translateStructuredPlan(parsed.plan, null, message).kind, "omitted");
});

test("email cité mais absent du plan", () => {
  const message = "Ajoute Dupont, dupont@example.com.";
  const parsed = parseStructuredPlan(plan([client]), message);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const translated = translateStructuredPlan(parsed.plan, null, message);
  assert.equal(translated.kind, "omitted");
  if (translated.kind !== "omitted") return;
  assert.deepEqual(translated.fields, ["email"]);
});

test("adresse citée mais absente du plan", () => {
  const message = "Ajoute Dupont, 12 rue de Paris.";
  const parsed = parseStructuredPlan(plan([client]), message);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const translated = translateStructuredPlan(parsed.plan, null, message);
  assert.equal(translated.kind, "omitted");
  if (translated.kind !== "omitted") return;
  assert.deepEqual(translated.fields, ["address"]);
});

test("téléphone présent dans la phrase et dans le plan", () => {
  const message = "Ajoute Dupont, 01 23 45 67 89.";
  const parsed = parseStructuredPlan(
    plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", phone: "01.23.45.67.89" } }]),
    message,
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(translateStructuredPlan(parsed.plan, null, message).kind, "catalog");
});

test("les lectures ne passent pas par StructuredPlan", () => {
  for (const text of [
    "Liste les nouveaux clients",
    "Combien de nouveaux clients ce mois ?",
    "Montre le nouveau projet de Dupont",
    "Ouvre le dossier Toiture",
    "Ouvre le projet Toiture",
  ]) {
    assert.equal(structuredPlanEligible(text), false);
    assert.equal(decideFree(text).execution, "recherche");
    assert.equal(structuredPlanGate(structuredPlanEligible(text), false), "continue");
  }
  assert.equal(structuredPlanEligible("Ouvre le dossier Toiture pour Dupont"), true);
});

test("les négations de création ne sont pas éligibles", () => {
  assert.equal(structuredPlanEligible("Ne crée pas le client Dupont"), false);
  assert.equal(structuredPlanEligible("N'ajoute pas Dupont comme client"), false);
  assert.equal(structuredPlanEligible("Je ne veux pas ouvrir de dossier pour Dupont"), false);
});

test("habite Lyon ne devient ni un nom ni un client incomplet", () => {
  const message = "Ajoute un client Dupont qui habite Lyon.";
  const whole = parseStructuredPlan(
    plan([{ type: "CREATE_CLIENT", args: { name: "Dupont qui habite Lyon" } }]),
    message,
  );
  if (whole.ok) assert.equal(translateStructuredPlan(whole.plan, null, message).kind, "clarify");
  const partial = parseStructuredPlan(plan([{ type: "CREATE_CLIENT", args: { name: "Dupont" } }]), message);
  assert.equal(partial.ok, true);
  if (!partial.ok) return;
  assert.equal(translateStructuredPlan(partial.plan, null, message).kind, "clarify");
});

test("une adresse écrite n’est pas perdue", () => {
  const message = "Ajoute Dupont comme client, adresse 12 rue des Lilas.";
  const dropped = parseStructuredPlan(plan([client]), message);
  assert.equal(dropped.ok, true);
  if (!dropped.ok) return;
  const missing = translateStructuredPlan(dropped.plan, null, message);
  assert.equal(missing.kind, "omitted");
  if (missing.kind !== "omitted") return;
  assert.deepEqual(missing.fields, ["address"]);

  const kept = parseStructuredPlan(
    plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", address: "12 rue des Lilas" } }]),
    message,
  );
  assert.equal(kept.ok, true);
  if (!kept.ok) return;
  const translated = translateStructuredPlan(kept.plan, null, message);
  assert.equal(translated.kind, "catalog");
  if (translated.kind !== "catalog" || translated.command.type !== "create_client") return;
  assert.equal(translated.command.party.address, "12 rue des Lilas");
});

test("un téléphone écrit n’est pas perdu", () => {
  const message = "Crée le client Dupont, son téléphone est 01 23 45 67 89.";
  const dropped = parseStructuredPlan(plan([client]), message);
  assert.equal(dropped.ok, true);
  if (!dropped.ok) return;
  const missing = translateStructuredPlan(dropped.plan, null, message);
  assert.equal(missing.kind, "omitted");
  if (missing.kind !== "omitted") return;
  assert.deepEqual(missing.fields, ["phone"]);
});

test("un fournisseur ou un produit ne devient pas un client", () => {
  for (const text of [
    "Ajoute la pompe MSZ-AP25 au catalogue.",
    "J'ai un nouveau fournisseur ClimPro.",
    "Enregistre un contrat pour Dupont.",
    "Ouvre une intervention pour Dupont.",
    "Ajoute un équipement pour Dupont.",
    "Note une réclamation pour Dupont.",
    "Enregistre un retour pour Dupont.",
  ]) {
    assert.equal(structuredPlanEligible(text), false);
    assert.equal(outsideStructuredPlan(text), true);
    assert.equal(structuredPlanGate(structuredPlanEligible(text), false), "continue");
  }
  const supplier = "Ajoute ClimPro comme fournisseur.";
  assert.equal(structuredShape(supplier), "supplier");
  assert.equal(structuredPlanEligible(supplier), true);
  assert.equal(outsideStructuredPlan(supplier), true);
  const parsed = parseStructuredPlan(
    plan([{ type: "CREATE_CLIENT", args: { name: "ClimPro" } }]),
    supplier,
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(translateStructuredPlan(parsed.plan, null, supplier).kind, "clarify");

  const product = "Ajoute la pompe MSZ-AP25 au catalogue.";
  const productPlan = parseStructuredPlan(
    plan([{ type: "CREATE_PROJECT", args: { name: "MSZ-AP25", clientName: "pompe" } }]),
    product,
  );
  if (productPlan.ok) {
    assert.equal(translateStructuredPlan(productPlan.plan, null, product).kind, "clarify");
  }
});

test("les questions de création restent des lectures", () => {
  for (const text of [
    "Peut-on créer un client Dupont ?",
    "Puis-je ajouter Dupont ?",
    "Comment créer un client ?",
    "Est-ce que je peux ouvrir un dossier ?",
  ]) {
    assert.equal(structuredPlanEligible(text), false);
    assert.equal(decideFree(text).execution, "recherche");
  }
});

test("Bernard absent : le téléphone est porté ou signalé", () => {
  const message = "Ajoute Bernard comme client, téléphone 01 98 76 54 32.";
  const kept = parseStructuredPlan(
    plan([{ type: "CREATE_CLIENT", args: { name: "Bernard", phone: "01 98 76 54 32" } }]),
    message,
  );
  assert.equal(kept.ok, true);
  if (!kept.ok) return;
  const ready = translateStructuredPlan(kept.plan, null, message);
  assert.equal(ready.kind, "catalog");
  if (ready.kind !== "catalog" || ready.command.type !== "create_client") return;
  assert.equal(ready.command.party.name, "Bernard");
  assert.equal(ready.command.party.phone, "01 98 76 54 32");

  const dropped = parseStructuredPlan(plan([{ type: "CREATE_CLIENT", args: { name: "Bernard" } }]), message);
  assert.equal(dropped.ok, true);
  if (!dropped.ok) return;
  const omitted = translateStructuredPlan(dropped.plan, null, message);
  assert.equal(omitted.kind, "omitted");
  if (omitted.kind !== "omitted") return;
  assert.deepEqual(omitted.fields, ["phone"]);
});

test("une adresse avec ville ou code postal est ancrée en entier", () => {
  const cases = [
    ["Ajoute DIAG-V3-004 Bernard comme client, adresse 12 rue Haute, Paris", "DIAG-V3-004 Bernard", "12 rue Haute, Paris"],
    ["Ajoute Bernard comme client, adresse 12 rue Haute, 75001 Paris", "Bernard", "12 rue Haute, 75001 Paris"],
    ["Ajoute Bernard comme client, adresse 8 avenue Victor Hugo, Lyon", "Bernard", "8 avenue Victor Hugo, Lyon"],
    ["Ajoute Bernard comme client, adresse 3 chemin de la Gare, 91300 Massy", "Bernard", "3 chemin de la Gare, 91300 Massy"],
    ["Ajoute Bernard comme client, adresse 12 rue Haute.", "Bernard", "12 rue Haute"],
  ];
  for (const [message, name, address] of cases) {
    const parsed = parseStructuredPlan(
      plan([{ type: "CREATE_CLIENT", args: { name, address } }]),
      message,
    );
    assert.equal(parsed.ok, true, message);
    if (!parsed.ok) continue;
    const translated = translateStructuredPlan(parsed.plan, null, message);
    assert.equal(translated.kind, "catalog", message);
    if (translated.kind !== "catalog" || translated.command.type !== "create_client") continue;
    assert.equal(translated.command.party.address, address);
  }
});

test("une adresse avec ville omise reste signalée", () => {
  const message = "Ajoute Bernard comme client, adresse 12 rue Haute, Paris";
  const dropped = parseStructuredPlan(plan([{ type: "CREATE_CLIENT", args: { name: "Bernard" } }]), message);
  assert.equal(dropped.ok, true);
  if (!dropped.ok) return;
  const missing = translateStructuredPlan(dropped.plan, null, message);
  assert.equal(missing.kind, "omitted");
  if (missing.kind !== "omitted") return;
  assert.deepEqual(missing.fields, ["address"]);
});

test("une adresse qui n’est pas celle de la phrase est refusée", () => {
  const withParis = "Ajoute Bernard comme client, adresse 12 rue Haute, Paris";
  const streetOnly = "Ajoute Bernard comme client, adresse 12 rue Haute";
  const refused = [
    [withParis, "12 rue Haute, Lyon"],
    [streetOnly, "12 rue Haute, Paris"],
    [withParis, "15 rue Haute, Paris"],
    [withParis, "12 rue Haute"],
  ];
  for (const [message, address] of refused) {
    assert.equal(
      parseStructuredPlan(plan([{ type: "CREATE_CLIENT", args: { name: "Bernard", address } }]), message).ok,
      false,
      address,
    );
  }
});

test("Alice absente : l’adresse est portée ou signalée", () => {
  const message = "Ajoute Alice comme client, adresse 12 rue des Lilas.";
  const kept = parseStructuredPlan(
    plan([{ type: "CREATE_CLIENT", args: { name: "Alice", address: "12 rue des Lilas" } }]),
    message,
  );
  assert.equal(kept.ok, true);
  if (!kept.ok) return;
  const ready = translateStructuredPlan(kept.plan, null, message);
  assert.equal(ready.kind, "catalog");
  if (ready.kind !== "catalog" || ready.command.type !== "create_client") return;
  assert.equal(ready.command.party.name, "Alice");
  assert.equal(ready.command.party.address, "12 rue des Lilas");

  const dropped = parseStructuredPlan(plan([{ type: "CREATE_CLIENT", args: { name: "Alice" } }]), message);
  assert.equal(dropped.ok, true);
  if (!dropped.ok) return;
  const omitted = translateStructuredPlan(dropped.plan, null, message);
  assert.equal(omitted.kind, "omitted");
  if (omitted.kind !== "omitted") return;
  assert.deepEqual(omitted.fields, ["address"]);
});

test("Dupont existant et un téléphone nouveau ne réécrit pas la fiche", () => {
  const message = "Ajoute Dupont comme client, téléphone 01 23 45 67 89.";
  const parsed = parseStructuredPlan(
    plan([{ type: "CREATE_CLIENT", args: { name: "Dupont", phone: "01 23 45 67 89" } }]),
    message,
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const differs = translateStructuredPlan(parsed.plan, known("Dupont"), message);
  assert.equal(differs.kind, "contact-differs");
  if (differs.kind !== "contact-differs") return;
  assert.equal(differs.name, "Dupont");
  assert.deepEqual(differs.fields, ["phone"]);
  const same = translateStructuredPlan(parsed.plan, known("Dupont", { phone: "01 23 45 67 89" }), message);
  assert.equal(same.kind, "already");
});

function accepted(raw: string, message: string) {
  const parsed = parseStructuredPlan(raw, message);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error(message);
  return parsed.plan;
}

test("le couple client et projet reste un plan métier", () => {
  const phrases = [
    "Nouveau client Dupont. Dossier Toiture pour Dupont.",
    "Ajoute Dupont comme client et ouvre le dossier Toiture pour Dupont",
    "Crée le client Dupont et ouvre le dossier Toiture pour Dupont",
  ];
  for (const message of phrases) {
    assert.equal(structuredShape(message), "client-or-project");
    const translated = translateStructuredPlan(accepted(plan([client, project]), message), null, message);
    assert.equal(translated.kind, "business");
  }
  const knownClient = translateStructuredPlan(accepted(plan([client, project]), folder), known("DUPONT SARL"), folder);
  assert.equal(knownClient.kind, "catalog");
  if (knownClient.kind !== "catalog") return;
  assert.equal(knownClient.command.type, "create_project");
});

test("comme client n’empêche pas le dossier", () => {
  const message = "Ajoute Dupont comme client et ouvre le dossier Toiture pour Dupont";
  const alone = translateStructuredPlan(accepted(plan([client]), message), null, message);
  assert.equal(alone.kind, "catalog");
  if (alone.kind !== "catalog") return;
  assert.equal(alone.command.type, "create_client");
  const pair = translateStructuredPlan(accepted(plan([client, project]), message), null, message);
  assert.equal(pair.kind, "business");
});

test("un fournisseur structuré reprend le nom et les contacts ancrés", () => {
  const message = "Ajoute ACME comme fournisseur, email contact@acme.fr, adresse 12 rue de Paris";
  assert.equal(structuredShape(message), "supplier");
  const translated = translateStructuredPlan(
    accepted(
      plan([{ type: "CREATE_SUPPLIER", args: { name: "ACME", email: "contact@acme.fr", address: "12 rue de Paris" } }]),
      message,
    ),
    null,
    message,
  );
  assert.equal(translated.kind, "catalog");
  if (translated.kind !== "catalog" || translated.command.type !== "create_supplier") return;
  assert.equal(translated.command.party.name, "ACME");
  assert.equal(translated.command.party.email, "contact@acme.fr");
  assert.equal(translated.command.party.siren, "");
  assert.equal(parseStructuredPlan(plan([{ type: "CREATE_SUPPLIER", args: { name: "ACME France" } }]), "Ajoute ACME comme fournisseur").ok, false);
  assert.equal(
    parseStructuredPlan(plan([{ type: "CREATE_SUPPLIER", args: { name: "ACME", email: "autre@acme.fr" } }]), "Ajoute ACME comme fournisseur").ok,
    false,
  );
  assert.equal(
    parseStructuredPlan(plan([{ type: "CREATE_SUPPLIER", args: { name: "ACME comme fournisseur" } }]), "Ajoute ACME comme fournisseur").ok,
    false,
  );
});

test("un e-mail fournisseur absent du plan est omis", () => {
  const message = "Ajoute ACME comme fournisseur, email contact@acme.fr";
  const translated = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_SUPPLIER", args: { name: "ACME" } }]), message),
    null,
    message,
  );
  assert.equal(translated.kind, "omitted");
  if (translated.kind !== "omitted") return;
  assert.deepEqual(translated.fields, ["email"]);
});

test("un fournisseur existant ne devient pas une mise à jour", () => {
  const message = "Ajoute ACME comme fournisseur, email contact@acme.fr";
  const same = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_SUPPLIER", args: { name: "ACME", email: "contact@acme.fr" } }]), message),
    known("ACME", { email: "contact@acme.fr" }),
    message,
  );
  assert.equal(same.kind, "already");
  if (same.kind !== "already") return;
  assert.equal(same.entity, "supplier");
  const differs = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_SUPPLIER", args: { name: "ACME", email: "contact@acme.fr" } }]), message),
    known("ACME", { email: "ancien@acme.fr" }),
    message,
  );
  assert.equal(differs.kind, "contact-differs");
});

test("un produit structuré force le kind et la famille explicite", () => {
  const simple = "Ajoute Switch X200 comme produit";
  assert.equal(structuredShape(simple), "product");
  const created = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Switch X200" } }]), simple),
    null,
    simple,
  );
  assert.equal(created.kind, "catalog");
  if (created.kind !== "catalog" || created.command.type !== "create_product") return;
  assert.equal(created.command.product.kind, "produit");
  assert.equal(created.command.product.family, "");
  assert.equal(created.command.product.supplierName, "");

  const family = "Ajoute Switch X200 comme produit, famille réseau";
  const withFamily = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Switch X200", family: "reseau" } }]), family),
    null,
    family,
  );
  assert.equal(withFamily.kind, "catalog");
  if (withFamily.kind !== "catalog" || withFamily.command.type !== "create_product") return;
  assert.equal(withFamily.command.product.family, "reseau");

  const serveur = "Ajoute Serveur Dell R750 comme produit";
  const bare = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Serveur Dell R750" } }]), serveur),
    null,
    serveur,
  );
  assert.equal(bare.kind, "catalog");
  if (bare.kind !== "catalog" || bare.command.type !== "create_product") return;
  assert.equal(bare.command.product.family, "");

  assert.equal(
    translateStructuredPlan(
      accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Switch X200", kind: "service" } }]), simple),
      null,
      simple,
    ).kind,
    "clarify",
  );
  assert.equal(parseStructuredPlan(plan([{ type: "CREATE_PRODUCT", args: { name: "Switch X200", family: "serveurs" } }]), family).ok, false);
  assert.equal(
    translateStructuredPlan(
      accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Switch X200" } }]), "Ajoute Switch X200 comme produit, famille serveurs"),
      null,
      "Ajoute Switch X200 comme produit, famille serveurs",
    ).kind,
    "clarify",
  );
});

test("la référence et l’unité s’ancrent sans la règle des trois caractères", () => {
  const message = "Ajoute Switch X200 comme produit, référence 123456, unité u";
  const translated = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Switch X200", reference: "123456", unit: "u" } }]), message),
    null,
    message,
  );
  assert.equal(translated.kind, "catalog");
  if (translated.kind !== "catalog" || translated.command.type !== "create_product") return;
  assert.equal(translated.command.product.reference, "123456");
  assert.equal(translated.command.product.unit, "u");
  const square = "Ajoute Switch X200 comme produit, unité m2";
  const unit = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Switch X200", unit: "m2" } }]), square),
    null,
    square,
  );
  assert.equal(unit.kind, "catalog");
  assert.equal(parseStructuredPlan(plan([{ type: "CREATE_PRODUCT", args: { name: "Switch X200", reference: "999" } }]), message).ok, false);
});

test("une référence de neuf chiffres n’est pas un SIREN", () => {
  const message = "Ajoute Switch X comme produit, référence 123456789";
  const translated = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Switch X", reference: "123456789" } }]), message),
    null,
    message,
  );
  assert.equal(translated.kind, "catalog");
  if (translated.kind !== "catalog" || translated.command.type !== "create_product") return;
  assert.equal(translated.command.product.reference, "123456789");
  const bare = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Switch X" } }]), "Ajoute Switch X comme produit 123456789"),
    null,
    "Ajoute Switch X comme produit 123456789",
  );
  assert.equal(bare.kind, "omitted");
  if (bare.kind !== "omitted") return;
  assert.ok(bare.fields.includes("siren"));
});

test("un montant, un SIRET ou un mot siret bloque le produit", () => {
  for (const message of [
    "Ajoute Switch X200 comme produit à 150 €",
    "Ajoute Switch X200 comme produit 150 EUR",
    "Ajoute Switch X200 comme produit 150 euros",
    "Ajoute Switch X200 comme produit $150",
  ]) {
    const translated = translateStructuredPlan(
      accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Switch X200" } }]), message),
      null,
      message,
    );
    assert.equal(translated.kind, "omitted");
    if (translated.kind !== "omitted") return;
    assert.ok(translated.fields.includes("amount"));
  }
  assert.equal(
    parseStructuredPlan(plan([{ type: "CREATE_PRODUCT", args: { name: "Switch X200", costStated: "150" } }]), "Ajoute Switch X200 comme produit").ok,
    false,
  );
  const siret = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Switch X200" } }]), "Ajoute Switch X200 comme produit, siret 12345678901234"),
    null,
    "Ajoute Switch X200 comme produit, siret 12345678901234",
  );
  assert.equal(siret.kind, "omitted");
  if (siret.kind !== "omitted") return;
  assert.ok(siret.fields.includes("siren"));
  assert.equal(siret.fields.includes("phone"), false);
  const phone = translateStructuredPlan(
    accepted(
      plan([{ type: "CREATE_SUPPLIER", args: { name: "ACME", phone: "06 12 34 56 78" } }]),
      "Ajoute ACME comme fournisseur, téléphone 06 12 34 56 78",
    ),
    null,
    "Ajoute ACME comme fournisseur, téléphone 06 12 34 56 78",
  );
  assert.equal(phone.kind, "catalog");
});

test("ouvre le dossier puis ajoute le service reste client ou projet", () => {
  const message = "Ouvre le dossier Toiture pour Dupont et ajoute le service pose";
  assert.equal(structuredShape(message), "client-or-project");
  assert.notEqual(structuredShape(message), "service");
});

test("nouveau client puis ajoute une prestation reste client ou projet", () => {
  const message = "Nouveau client Dupont, ajoute une prestation Audit";
  assert.equal(structuredShape(message), "client-or-project");
  assert.notEqual(structuredShape(message), "service");
});

test("un service est un produit dont le serveur fixe le kind", () => {
  const service = "Ajoute le service Audit réseau";
  assert.equal(structuredShape(service), "service");
  const translated = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Audit réseau" } }]), service),
    null,
    service,
  );
  assert.equal(translated.kind, "catalog");
  if (translated.kind !== "catalog" || translated.command.type !== "create_product") return;
  assert.equal(translated.command.product.kind, "service");
  assert.equal(translated.command.product.family, "");
  assert.equal(translated.command.product.name, "Audit réseau");
  assert.equal(parseStructuredPlan(plan([{ type: "CREATE_PRODUCT", args: { name: "service Audit réseau" } }]), service).ok, false);

  const prestation = "Ajoute une prestation Audit réseau";
  assert.equal(structuredShape(prestation), "service");
  const named = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Audit réseau" } }]), prestation),
    null,
    prestation,
  );
  assert.equal(named.kind, "catalog");
  if (named.kind !== "catalog" || named.command.type !== "create_product") return;
  assert.equal(named.command.product.kind, "service");
  assert.equal(named.command.product.family, "");
});

test("Service Premium dépend du déterminant", () => {
  assert.equal(structuredShape("Ajoute Service Premium"), "client-or-project");
  assert.equal(structuredShape("Ajoute le Service Premium"), "service");
  const translated = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Service Premium" } }]), "Ajoute le Service Premium"),
    null,
    "Ajoute le Service Premium",
  );
  assert.equal(translated.kind, "catalog");
  if (translated.kind !== "catalog" || translated.command.type !== "create_product") return;
  assert.equal(translated.command.product.name, "Service Premium");
  assert.equal(translated.command.product.kind, "service");
});

test("un rôle explicite l’emporte sur la forme service", () => {
  assert.equal(structuredShape("Ajoute le Service Plus comme client"), "client-or-project");
  assert.equal(structuredShape("Ajoute la prestation X comme produit"), "product");
  assert.equal(structuredShape("Ajoute la prestation Atlas comme produit"), "product");
  const product = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Atlas" } }]), "Ajoute la prestation Atlas comme produit"),
    null,
    "Ajoute la prestation Atlas comme produit",
  );
  assert.equal(product.kind, "catalog");
  if (product.kind !== "catalog" || product.command.type !== "create_product") return;
  assert.equal(product.command.product.kind, "produit");
});

test("deux rôles explicites ne choisissent pas", () => {
  const message = "Ajoute ACME comme client et comme fournisseur";
  assert.equal(structuredShape(message), null);
  assert.equal(structuredPlanEligible(message), false);
  assert.equal(
    translateStructuredPlan({ source: "ollama", actions: [client], missing: [] }, null, message).kind,
    "clarify",
  );
});

test("un mot hors périmètre bloque toutes les formes", () => {
  assert.equal(structuredShape("Ajoute ACME comme fournisseur pour le contrat Dupont"), null);
  assert.equal(structuredShape("Ajoute Switch X200 comme produit pour le contrat Dupont"), null);
});

test("un produit existant est déjà connu", () => {
  const message = "Ajoute Switch X200 comme produit";
  const translated = translateStructuredPlan(
    accepted(plan([{ type: "CREATE_PRODUCT", args: { name: "Switch X200" } }]), message),
    known("Switch X200"),
    message,
  );
  assert.equal(translated.kind, "already");
  if (translated.kind !== "already") return;
  assert.equal(translated.entity, "product");
});
