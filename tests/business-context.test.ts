import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readPacket } from "../src/domain/answer-packet.ts";
import {
  buildBusinessContext,
  readStoredBusinessContext,
  type BusinessContext,
  type BusinessDirectoryRow,
} from "../src/domain/business-context.ts";
import { readUnderstanding } from "../src/domain/completeness.ts";
import { cardMayAct, readStoredProposalCard } from "../src/domain/proposal-scope.ts";
import {
  buildSituationReading,
  situationModelGuide,
  situationReadingEligible,
  type ProjectNameRow,
  type SituationMentionKind,
  type SituationReading,
} from "../src/domain/situation-reading.ts";

const GUIDE = [
  "Tu réponds par un seul objet JSON, sans texte autour.",
  "La seule clé est mentions.",
  "Chaque mention a exactement les clés kind et text.",
  "kind vaut client, supplier, product, quantity, amount ou document.",
  "text est un extrait exact de la demande, 120 caractères au plus.",
  "Au plus 8 mentions.",
  "N’envoie aucun identifiant, ni start, ni end.",
].join(" ");

type Mention = { kind: SituationMentionKind; text: string };

function readingOf(
  text: string,
  mentions: Mention[] | null,
  options?: { projects?: ProjectNameRow[]; pageProjectId?: string; fileIds?: string[] },
): SituationReading {
  return buildSituationReading({
    conversationId: "thread-v3-009",
    inboxItemId: null,
    fileIds: options?.fileIds ?? [],
    userText: text,
    projects: options?.projects ?? [],
    pageProjectId: options?.pageProjectId ?? "",
    modelOutput: mentions ? { mentions } : null,
    model: mentions ? "modele-test" : null,
    directory: [],
  });
}

function contextOf(
  text: string,
  mentions: Mention[] | null,
  rows: BusinessDirectoryRow[],
  options?: { projects?: ProjectNameRow[]; pageProjectId?: string; fileIds?: string[] },
): { reading: SituationReading; context: BusinessContext } {
  const reading = readingOf(text, mentions, options);
  return { reading, context: buildBusinessContext({ reading, rows }) };
}

function entity(context: BusinessContext, text: string) {
  return context.entities.find((item) => item.mentionText === text);
}

function linkedTo(context: BusinessContext, value: string, item: string): boolean {
  const relation = context.relations.find((entry) => {
    const pool = entry.kind === "quantity_for_item" ? context.quantities : context.amounts;
    const found = pool.find((span) => span.start === entry.valueAnchor.start && span.end === entry.valueAnchor.end);
    const target = context.entities.find(
      (row) => row.start === entry.entityAnchor.start && row.end === entry.entityAnchor.end,
    );
    return found?.text === value && target?.mentionText === item;
  });
  return Boolean(relation);
}

function hasIssue(context: BusinessContext, reason: string, mentionText?: string): boolean {
  return context.issues.some((issue) => issue.reason === reason && (mentionText === undefined || issue.mentionText === mentionText));
}

function numbersOutsideAnchors(value: unknown, key: string): number[] {
  if (typeof value === "number") return key === "start" || key === "end" ? [] : [value];
  if (Array.isArray(value)) return value.flatMap((item) => numbersOutsideAnchors(item, key));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([name, item]) => numbersOutsideAnchors(item, name));
  }
  return [];
}

const CLIM = { id: "sup-clim", name: "ClimPro", table: "supplier" } as const;
const AP25 = { id: "prod-25", name: "MSZ-AP25", table: "product", productKind: "produit" } as const;
const AP35 = { id: "prod-35", name: "MSZ-AP35", table: "product", productKind: "produit" } as const;
const DUPONT_PROJECT = { id: "proj-dupont", name: "Climatisation Dupont" };

test("S1 relie la quantité et le montant au produit résolu", () => {
  const text = "J'ai reçu le devis de ClimPro pour le chantier Climatisation Dupont : 4 unités MSZ-AP25 pour 3 600 € HT";
  const { reading, context } = contextOf(
    text,
    [
      { kind: "supplier", text: "ClimPro" },
      { kind: "client", text: "Climatisation Dupont" },
      { kind: "product", text: "MSZ-AP25" },
      { kind: "quantity", text: "4 unités" },
      { kind: "amount", text: "3 600 € HT" },
      { kind: "document", text: "devis" },
    ],
    [CLIM, AP25],
    { projects: [DUPONT_PROJECT] },
  );
  assert.equal(context.projectContext, reading.projectContext);
  assert.equal(context.projectContext.state, "matched");
  const actor = entity(context, "ClimPro");
  assert.equal(actor?.resolution.state, "resolved");
  assert.equal(actor?.view, "actor");
  assert.equal(actor?.resolution.state === "resolved" && actor.resolution.conflict, false);
  assert.equal(entity(context, "Climatisation Dupont"), undefined);
  const item = entity(context, "MSZ-AP25");
  assert.equal(item?.view, "item");
  assert.equal(item?.resolution.state === "resolved" && item.resolution.family, "product");
  assert.equal(linkedTo(context, "4 unités", "MSZ-AP25"), true);
  assert.equal(linkedTo(context, "3 600 € HT", "MSZ-AP25"), true);
  assert.equal(context.event.kind, "quote_received");
  assert.equal(context.event.evidenceText, "devis");
  assert.deepEqual(context.documents, [{ kind: "quote", mentionText: "devis" }]);
  assert.equal("actors" in context, false);
  assert.equal("items" in context, false);
});

test("S2 ne choisit pas entre client et fournisseur", () => {
  const { context } = contextOf(
    "J'ai reçu le devis de Dupont pour Climatisation Martin",
    [{ kind: "supplier", text: "Dupont" }],
    [
      { id: "c1", name: "Dupont", table: "client" },
      { id: "s1", name: "Dupont", table: "supplier" },
    ],
  );
  const dupont = entity(context, "Dupont");
  assert.equal(dupont?.view, null);
  assert.equal(dupont?.resolution.state, "ambiguous");
  if (dupont?.resolution.state === "ambiguous") {
    assert.equal(dupont.resolution.scope, "cross_family");
    assert.equal(dupont.resolution.candidates.length, 2);
    assert.equal("entityId" in dupont.resolution, false);
  }
  assert.equal(hasIssue(context, "cross_family_ambiguity", "Dupont"), true);
});

test("S3 garde le produit inconnu et ses relations", () => {
  const text = "ClimPro propose 4 unités XZ-999 pour 4 200 € HT";
  const { context } = contextOf(
    text,
    [
      { kind: "supplier", text: "ClimPro" },
      { kind: "product", text: "XZ-999" },
      { kind: "quantity", text: "4 unités" },
      { kind: "amount", text: "4 200 € HT" },
    ],
    [CLIM],
  );
  const item = entity(context, "XZ-999");
  assert.equal(item?.resolution.state, "unresolved");
  assert.deepEqual(item?.modelHints, ["product"]);
  assert.equal(item?.view, "item");
  assert.equal(hasIssue(context, "unknown_entity", "XZ-999"), true);
  assert.equal(linkedTo(context, "4 unités", "XZ-999"), true);
  assert.equal(linkedTo(context, "4 200 € HT", "XZ-999"), true);
  assert.equal(context.event.kind, "commercial_proposal");
  assert.equal(context.event.evidenceText, "propose");
  assert.equal(entity(context, "ClimPro")?.view, "actor");
});

test("S4 ne lie pas le montant unique de deux items", () => {
  const text = "ClimPro propose 2 unités MSZ-AP25 et 3 unités MSZ-AP35 pour 5 500 € HT";
  const { context } = contextOf(
    text,
    [
      { kind: "supplier", text: "ClimPro" },
      { kind: "quantity", text: "2 unités" },
      { kind: "product", text: "MSZ-AP25" },
      { kind: "quantity", text: "3 unités" },
      { kind: "product", text: "MSZ-AP35" },
      { kind: "amount", text: "5 500 € HT" },
    ],
    [CLIM, AP25, AP35],
  );
  assert.equal(linkedTo(context, "2 unités", "MSZ-AP25"), true);
  assert.equal(linkedTo(context, "3 unités", "MSZ-AP35"), true);
  assert.equal(linkedTo(context, "5 500 € HT", "MSZ-AP35"), false);
  assert.equal(context.relations.some((relation) => relation.kind === "amount_for_item"), false);
  assert.equal(hasIssue(context, "relation_not_deterministic", "5 500 € HT"), true);
});

test("S5 lie chaque montant à son item sans total", () => {
  const text = "ClimPro propose 2 unités MSZ-AP25 à 900 € et 1 unité MSZ-AP35 à 1 200 €";
  const { context } = contextOf(
    text,
    [
      { kind: "quantity", text: "2 unités" },
      { kind: "product", text: "MSZ-AP25" },
      { kind: "amount", text: "900 €" },
      { kind: "quantity", text: "1 unité" },
      { kind: "product", text: "MSZ-AP35" },
      { kind: "amount", text: "1 200 €" },
    ],
    [AP25, AP35],
  );
  assert.equal(linkedTo(context, "900 €", "MSZ-AP25"), true);
  assert.equal(linkedTo(context, "1 200 €", "MSZ-AP35"), true);
  assert.equal(context.amounts.map((item) => item.text).join("|"), "900 €|1 200 €");
  assert.deepEqual(numbersOutsideAnchors(context, ""), []);
});

test("S6 recopie un dossier ambigu", () => {
  const { reading, context } = contextOf(
    "J'ai reçu le devis de ClimPro pour Climatisation Dupont aujourd'hui",
    [{ kind: "supplier", text: "ClimPro" }],
    [CLIM],
    { projects: [DUPONT_PROJECT, { id: "proj-2", name: "Climatisation Dupont" }] },
  );
  assert.equal(context.projectContext, reading.projectContext);
  assert.equal(context.projectContext.state, "ambiguous");
});

test("S7 n'invente pas de montant", () => {
  const text = "J'ai reçu le devis de ClimPro pour 4 unités MSZ-AP25";
  const home = contextOf(text, [{ kind: "supplier", text: "ClimPro" }, { kind: "product", text: "MSZ-AP25" }, { kind: "quantity", text: "4 unités" }], [CLIM, AP25]);
  assert.equal(home.context.projectContext.state, "unresolved");
  assert.equal(home.context.amounts.length, 0);
  const page = contextOf(
    text,
    [{ kind: "supplier", text: "ClimPro" }, { kind: "product", text: "MSZ-AP25" }, { kind: "quantity", text: "4 unités" }],
    [CLIM, AP25],
    { projects: [DUPONT_PROJECT], pageProjectId: "proj-dupont" },
  );
  assert.equal(page.context.projectContext.state, "current");
  assert.equal(page.context.projectContext, page.reading.projectContext);
});

test("S8 et S16 montrent Thermix comme acteur mentionné", () => {
  const { context } = contextOf(
    "J'ai reçu le devis de Thermix pour le chantier Dupont",
    [{ kind: "supplier", text: "Thermix" }],
    [],
  );
  const thermix = entity(context, "Thermix");
  assert.equal(thermix?.resolution.state, "unresolved");
  assert.deepEqual(thermix?.modelHints, ["supplier"]);
  assert.equal(thermix?.view, "actor");
  assert.equal(hasIssue(context, "unknown_entity", "Thermix"), true);
  assert.equal(context.relations.length, 0);
});

test("S9 et S13 gardent le conflit quand l'indice est client", () => {
  const { context } = contextOf(
    "Notre client ClimPro nous a envoyé son devis pour le chantier",
    [{ kind: "client", text: "ClimPro" }],
    [CLIM],
  );
  const clim = entity(context, "ClimPro");
  assert.equal(clim?.resolution.state, "resolved");
  if (clim?.resolution.state === "resolved") {
    assert.equal(clim.resolution.family, "supplier");
    assert.equal(clim.resolution.conflict, true);
    assert.equal(clim.resolution.entityId, "sup-clim");
  }
  assert.equal(clim?.view, "actor");
  assert.deepEqual(clim?.modelHints, ["client"]);
  assert.equal(hasIssue(context, "role_conflict", "ClimPro"), true);
});

test("S10 recopie les fichiers sans lire leur contenu", () => {
  const { context } = contextOf(
    "J'ai reçu ce devis pour le chantier Dupont aujourd'hui",
    [{ kind: "document", text: "devis" }],
    [],
    { fileIds: ["file-1"] },
  );
  assert.deepEqual(context.attachments, { fileIds: ["file-1"], contentRead: false });
  assert.equal(context.event.kind, "quote_received");
});

test("S11 laisse un contexte partiel sans mentions", () => {
  const { reading, context } = contextOf(
    "J'ai reçu le devis de ClimPro pour le chantier Dupont",
    null,
    [CLIM],
    { projects: [DUPONT_PROJECT], fileIds: ["file-2"] },
  );
  assert.equal(context.projectContext, reading.projectContext);
  assert.equal(context.event.kind, "quote_received");
  assert.equal(context.documents[0]?.kind, "quote");
  assert.deepEqual(context.attachments.fileIds, ["file-2"]);
  assert.deepEqual(context.entities, []);
  assert.deepEqual(context.quantities, []);
  assert.deepEqual(context.amounts, []);
  assert.deepEqual(context.relations, []);
  assert.deepEqual(context.issues, []);
  assert.deepEqual(context.provenance.mentions, { origin: "none" });
});

test("S12 reste hors gate", () => {
  assert.equal(situationReadingEligible("ClimPro intervient mardi sur le chantier Dupont"), false);
});

test("S14 laisse Atlas hors des vues", () => {
  const { context } = contextOf(
    "ClimPro propose 4 unités Atlas pour le chantier Dupont",
    [{ kind: "product", text: "Atlas" }],
    [
      { id: "sup-atlas", name: "Atlas", table: "supplier" },
      { id: "prod-atlas", name: "Atlas", table: "product", productKind: "produit" },
    ],
  );
  const atlas = entity(context, "Atlas");
  assert.equal(atlas?.view, null);
  assert.equal(atlas?.resolution.state, "ambiguous");
  if (atlas?.resolution.state === "ambiguous") {
    assert.equal(atlas.resolution.scope, "cross_family");
    assert.equal("entityId" in atlas.resolution, false);
  }
  assert.deepEqual(atlas?.modelHints, ["product"]);
  assert.equal(context.relations.length, 0);
});

test("S15 défend le domaine contre deux fournisseurs de même nom", () => {
  const { context } = contextOf(
    "J'ai reçu le devis de Dupont pour le chantier Martin",
    [{ kind: "supplier", text: "Dupont" }],
    [
      { id: "s-a", name: "Dupont", table: "supplier" },
      { id: "s-b", name: "Dupont", table: "supplier" },
    ],
  );
  const dupont = entity(context, "Dupont");
  assert.equal(dupont?.view, "actor");
  assert.equal(dupont?.resolution.state, "ambiguous");
  if (dupont?.resolution.state === "ambiguous") {
    assert.equal(dupont.resolution.scope, "same_family");
    assert.deepEqual(dupont.resolution.candidates.map((item) => item.entityId).sort(), ["s-a", "s-b"]);
    assert.equal("entityId" in dupont.resolution, false);
  }
  assert.equal(hasIssue(context, "duplicate_name", "Dupont"), true);
});

test("S17 ne relie ni la quantité ni le montant à travers une mention omise", () => {
  const text = "ClimPro propose 2 unités MSZ-AP25 et 3 unités MSZ-AP35 pour 5 500 € HT";
  const { context } = contextOf(
    text,
    [
      { kind: "quantity", text: "2 unités" },
      { kind: "product", text: "MSZ-AP35" },
      { kind: "amount", text: "5 500 € HT" },
    ],
    [AP35],
  );
  assert.equal(linkedTo(context, "2 unités", "MSZ-AP35"), false);
  assert.equal(linkedTo(context, "5 500 € HT", "MSZ-AP35"), false);
  assert.equal(context.relations.length, 0);
  assert.equal(hasIssue(context, "relation_not_deterministic", "5 500 € HT"), true);
});

test("S18 refuse les valeurs répétées", () => {
  const text = "2 MSZ-AP25 à 900 € et 2 MSZ-AP35 à 900 €";
  const { context } = contextOf(
    text,
    [
      { kind: "quantity", text: "2" },
      { kind: "product", text: "MSZ-AP25" },
      { kind: "amount", text: "900 €" },
      { kind: "quantity", text: "2" },
      { kind: "product", text: "MSZ-AP35" },
      { kind: "amount", text: "900 €" },
    ],
    [AP25, AP35],
  );
  assert.equal(context.relations.length, 0);
  assert.equal(hasIssue(context, "repeated_anchor", "2"), true);
  assert.equal(hasIssue(context, "repeated_anchor", "900 €"), true);
  assert.equal(entity(context, "MSZ-AP25")?.view, "item");
  assert.equal(entity(context, "MSZ-AP35")?.view, "item");
});

test("S19 bloque la quantité après un deux-points", () => {
  const blocked = contextOf("MSZ-AP25 : 5 unités", [
    { kind: "product", text: "MSZ-AP25" },
    { kind: "quantity", text: "5 unités" },
  ], [AP25]);
  assert.equal(blocked.context.relations.length, 0);
  assert.equal(hasIssue(blocked.context, "unlinked_quantity", "5 unités"), true);
  const linked = contextOf("MSZ-AP25 pour 5 unités", [
    { kind: "product", text: "MSZ-AP25" },
    { kind: "quantity", text: "5 unités" },
  ], [AP25]);
  assert.equal(linkedTo(linked.context, "5 unités", "MSZ-AP25"), true);
});

test("S20 lie un montant placé avant le produit", () => {
  const { context } = contextOf(
    "900 € le MSZ-AP25",
    [
      { kind: "amount", text: "900 €" },
      { kind: "product", text: "MSZ-AP25" },
    ],
    [AP25],
  );
  assert.equal(linkedTo(context, "900 €", "MSZ-AP25"), true);
  assert.equal(context.amounts[0]?.text, "900 €");
});

test("S21 n'enjambe pas une mention cross-family", () => {
  const { context } = contextOf(
    "4 unités Atlas et MSZ-AP25",
    [
      { kind: "quantity", text: "4 unités" },
      { kind: "product", text: "Atlas" },
      { kind: "product", text: "MSZ-AP25" },
    ],
    [
      { id: "sup-atlas", name: "Atlas", table: "supplier" },
      { id: "prod-atlas", name: "Atlas", table: "product", productKind: "produit" },
      AP25,
    ],
  );
  assert.equal(entity(context, "Atlas")?.view, null);
  assert.equal(context.relations.length, 0);
  assert.equal(hasIssue(context, "unlinked_quantity", "4 unités"), true);
});

test("S22 résout la fiche produit malgré l'indice fournisseur", () => {
  const { context } = contextOf(
    "ClimPro propose Atlas pour 4 unités au tarif indiqué",
    [{ kind: "supplier", text: "Atlas" }],
    [{ id: "prod-atlas", name: "Atlas", table: "product", productKind: "produit" }],
  );
  const atlas = entity(context, "Atlas");
  assert.equal(atlas?.view, "item");
  assert.equal(atlas?.resolution.state, "resolved");
  if (atlas?.resolution.state === "resolved") {
    assert.equal(atlas.resolution.family, "product");
    assert.equal(atlas.resolution.entityType, "product");
    assert.equal(atlas.resolution.conflict, true);
  }
  assert.deepEqual(atlas?.modelHints, ["supplier"]);
});

test("S23 n'ajoute pas le dossier comme acteur inconnu", () => {
  const { context } = contextOf(
    "J'ai reçu le devis de ClimPro pour le chantier Climatisation Dupont",
    [
      { kind: "supplier", text: "ClimPro" },
      { kind: "client", text: "Climatisation Dupont" },
    ],
    [CLIM],
    { projects: [DUPONT_PROJECT] },
  );
  assert.equal(entity(context, "Climatisation Dupont"), undefined);
  assert.equal(context.projectContext.state, "matched");
  assert.equal(entity(context, "ClimPro")?.view, "actor");
});

test("un service n'est pas un conflit avec l'indice produit", () => {
  const { context } = contextOf(
    "ClimPro propose 4 unités Audit réseau pour 900 € HT",
    [
      { kind: "product", text: "Audit réseau" },
      { kind: "quantity", text: "4 unités" },
      { kind: "amount", text: "900 € HT" },
    ],
    [{ id: "srv-1", name: "Audit réseau", table: "product", productKind: "service" }],
  );
  const item = entity(context, "Audit réseau");
  assert.equal(item?.resolution.state, "resolved");
  if (item?.resolution.state === "resolved") {
    assert.equal(item.resolution.family, "product");
    assert.equal(item.resolution.entityType, "service");
    assert.equal(item.resolution.conflict, false);
  }
  assert.equal(item?.view, "item");
});

test("deux indices sur la même ancre ne fondent pas une vue", () => {
  const { context } = contextOf(
    "J'ai reçu le devis de ClimPro pour le chantier Martin",
    [
      { kind: "supplier", text: "ClimPro" },
      { kind: "client", text: "ClimPro" },
    ],
    [],
  );
  const clim = entity(context, "ClimPro");
  assert.equal(clim?.view, null);
  assert.deepEqual(clim?.modelHints, ["client", "supplier"]);
  assert.equal(hasIssue(context, "model_hint_ambiguity", "ClimPro"), true);
  assert.equal(context.relations.length, 0);
});

test("une paire et un segment qui divergent ne lient pas le montant", () => {
  const text = "MSZ-AP25 : 3 600 € le MSZ-AP35";
  const { context } = contextOf(
    text,
    [
      { kind: "product", text: "MSZ-AP25" },
      { kind: "amount", text: "3 600 €" },
      { kind: "product", text: "MSZ-AP35" },
    ],
    [AP25, AP35],
  );
  assert.equal(context.relations.length, 0);
  assert.equal(hasIssue(context, "relation_not_deterministic", "3 600 €"), true);
});

test("un chevauchement d'ancres ne produit pas de relation", () => {
  const inside = contextOf(
    "MSZ-AP25 pour 5 unités",
    [
      { kind: "product", text: "MSZ-AP25" },
      { kind: "quantity", text: "5" },
    ],
    [AP25],
  );
  assert.equal(inside.context.relations.length, 0);
  assert.equal(hasIssue(inside.context, "overlapping_anchor", "5"), true);
  const wrapped = contextOf(
    "ClimPro propose 4 unités MSZ-AP25 pour 900 €",
    [
      { kind: "quantity", text: "4 unités MSZ-AP25" },
      { kind: "product", text: "MSZ-AP25" },
      { kind: "amount", text: "900 €" },
    ],
    [AP25],
  );
  assert.equal(wrapped.context.relations.length, 0);
  assert.equal(hasIssue(wrapped.context, "overlapping_anchor", "MSZ-AP25"), true);
});

test("les extraits de quantité et de montant sont des tranches exactes", () => {
  const text = "ClimPro propose 4 unités XZ-999 pour 4 200 € HT";
  const { context } = contextOf(
    text,
    [
      { kind: "product", text: "XZ-999" },
      { kind: "quantity", text: "4 unités" },
      { kind: "amount", text: "4 200 € HT" },
    ],
    [],
  );
  for (const span of [...context.quantities, ...context.amounts]) {
    assert.equal(text.slice(span.start, span.end), span.text);
  }
  assert.deepEqual(numbersOutsideAnchors(context, ""), []);
});

test("la table d'événement et les documents restent lexicaux", () => {
  const offer = contextOf("Le fournisseur m'a envoyé son offre pour le chantier", [], []).context;
  assert.equal(offer.event.kind, "offer_received");
  assert.equal(offer.event.evidenceText, "offre");
  const price = contextOf("Nous avons reçu le tarif de ClimPro pour le chantier", [], []).context;
  assert.equal(price.event.kind, "price_received");
  const proposal = contextOf("J'ai reçu la proposition de ClimPro pour le chantier", [], []).context;
  assert.equal(proposal.event.kind, "commercial_proposal");
  assert.equal(proposal.documents[0]?.kind, "proposal");
  const quote = contextOf("J'ai reçu le chiffrage de ClimPro pour le chantier", [], []).context;
  assert.equal(quote.event.kind, "commercial_proposal");
  assert.equal(quote.documents[0]?.kind, "proposal");
  const several = contextOf("Il m'a envoyé son tarif pour notre devis du chantier", [{ kind: "document", text: "devis" }], []).context;
  assert.equal(several.event.kind, "unknown");
  assert.equal(several.event.evidenceText, null);
  assert.deepEqual(several.documents.map((item) => item.kind), ["price", "quote"]);
  const verb = contextOf("ClimPro propose un devis pour 4 unités ce matin", [], []).context;
  assert.equal(verb.event.kind, "commercial_proposal");
  assert.equal(verb.event.evidenceText, "propose");
  assert.equal(verb.documents[0]?.mentionText, "devis");
});

test("la persistance exige situation et businessContext", () => {
  const { reading, context } = contextOf(
    "J'ai reçu le devis de ClimPro pour le chantier Climatisation Dupont",
    [{ kind: "supplier", text: "ClimPro" }],
    [CLIM],
    { projects: [DUPONT_PROJECT] },
  );
  const stored = { situation: reading, businessContext: context };
  assert.deepEqual(Object.keys(stored).sort(), ["businessContext", "situation"]);
  assert.equal(readStoredProposalCard(stored), null);
  assert.equal(cardMayAct(readStoredProposalCard(stored)), false);
  assert.equal(readUnderstanding(stored), null);
  assert.equal(readPacket(stored), null);
  const again = readStoredBusinessContext(stored);
  assert.equal(again?.event.kind, "quote_received");
  assert.equal(again?.entities[0]?.mentionText, "ClimPro");
  assert.equal(again?.projectContext.state, "matched");
  assert.equal(readStoredBusinessContext({ businessContext: context }), null);
  assert.equal(readStoredBusinessContext({ situation: reading }), null);
  assert.equal(readStoredBusinessContext({ situation: reading, businessContext: context, fields: [] }), null);
});

test("answerFromSituation ne rappelle pas le modèle et ne lit pas la conversation", () => {
  const source = readFileSync(new URL("../src/app/api/assistant/route.ts", import.meta.url), "utf8");
  const start = source.indexOf("async function answerFromSituation");
  const end = source.indexOf("async function answerFromStructuredPlan");
  const body = source.slice(start, end);
  assert.equal(body.split("readSituationMentions").length - 1, 1);
  assert.equal(body.includes("chatWithOllama"), false);
  assert.equal(body.includes("streamModel"), false);
  assert.equal(body.includes("modelInterpretation"), false);
  assert.equal(body.includes("prisma.conversation"), false);
  assert.equal(body.includes("extractedText"), false);
  const domain = readFileSync(new URL("../src/domain/business-context.ts", import.meta.url), "utf8");
  assert.equal(domain.includes("pricing"), false);
  assert.equal(domain.includes("src/lib"), false);
  assert.equal(domain.includes("@/lib"), false);
  assert.equal(situationModelGuide(), GUIDE);
  const chat = readFileSync(new URL("../src/components/assistant-chat.tsx", import.meta.url), "utf8");
  const cardStart = chat.indexOf("function BusinessContextCard");
  const cardEnd = chat.indexOf("function EntityLines");
  const card = chat.slice(cardStart, cardEnd);
  assert.equal(card.includes("<Button"), false);
  assert.equal(card.includes("AssistantProposalCard"), false);
  assert.equal(card.includes("Nature détectée d’après les mots du message"), true);
  assert.equal(chat.includes("Contenu du fichier non utilisé pour ce contexte"), true);
  assert.equal(chat.includes("aucune fiche de ce nom"), true);
});
