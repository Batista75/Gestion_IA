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
    "Ajoute ClimPro comme fournisseur.",
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
