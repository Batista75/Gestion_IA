import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decideFree } from "../src/domain/intent-catalog.ts";
import { readStoredProposalCard } from "../src/domain/proposal-scope.ts";
import {
  anchorMentions,
  buildSituationReading,
  describeProjectContext,
  matchKnownEntities,
  matchProjectContext,
  parseSituationModelOutput,
  readStoredSituation,
  situationReadingEligible,
  situationReadingTurn,
  situationReply,
  SITUATION_RAW_LIMIT,
} from "../src/domain/situation-reading.ts";
import { structuredPlanEligible } from "../src/domain/structured-plan.ts";

const RECEIVED = "J'ai reçu le devis de ClimPro pour le chantier Dupont";
const OFFER = "ClimPro propose 4 unités MSZ-AP25 pour 3 600 € HT";
const SENT = "Le fournisseur m'a envoyé sa proposition pour le dossier Climatisation";

const REFUSED = [
  "Pourquoi ClimPro propose 4 unités ?",
  "Explique le devis de ClimPro reçu hier",
  "Je n'ai pas reçu le devis de ClimPro",
  "Je confirme.",
  "Rejette.",
  "Ajoute ClimPro comme fournisseur",
  "Nouveau client Dupont. Dossier Toiture pour Dupont.",
  "Cherche le fournisseur ClimPro",
  "Montre la fiche Dupont",
  "Ouvre le dossier Climatisation",
  "Prépare un devis pour Dupont",
  "devis",
  "",
  "Dupont a une climatisation",
  "Contrat reçu de ClimPro pour le chantier Dupont",
  "Envoie le devis à Dupont par mail",
  "Propose un prix à Dupont pour 4 unités",
  "Fais une proposition à Dupont pour la climatisation",
  "J'ai envoyé le devis à Dupont hier",
  "Dupont a reçu notre devis hier",
  "Le client Martin propose un rendez-vous mardi",
  "Paiement reçu de Dupont, 1 200 €",
  "Nous avons reçu le règlement de Dupont",
  "J'ai reçu la commande de Dupont pour 4 unités",
  "Dupont a reçu sa livraison hier, tout est conforme",
  "Je n'ai jamais reçu le devis de ClimPro",
  "Aucun devis reçu de ClimPro",
  "Dis-moi ce que ClimPro propose pour Dupont",
  "Résume la proposition de ClimPro",
  "Enregistre le devis reçu de ClimPro",
  "Rattache le devis reçu au projet Climatisation Dupont",
  "Mets à jour le coût avec le devis reçu de ClimPro",
  "Que sait-on du devis reçu de ClimPro",
  "J'ai reçu un appel de Dupont, son téléphone est 06 12 34 56 78",
  "Je propose un devis à Dupont pour 3 600 €",
  "On propose un tarif de 900 € à Dupont",
  "Compare le devis reçu de ClimPro avec celui de Durand",
  "Lis le devis que j'ai reçu de ClimPro",
  "Peux-tu lire le devis que j'ai reçu de ClimPro",
];

test("trois phrases cibles éligibles, y compris un parcours answer_question", () => {
  assert.equal(situationReadingEligible(RECEIVED), true);
  assert.equal(situationReadingEligible(OFFER), true);
  assert.equal(situationReadingEligible(SENT), true);
  assert.equal(decideFree(RECEIVED).id, "answer_question");
  assert.notEqual(decideFree(RECEIVED).execution, "absente");
  assert.equal(decideFree(OFFER).id, "answer_question");
  assert.equal(decideFree(SENT).id, null);
  assert.equal(decideFree(SENT).execution, "absente");
});

test("contre-exemples, P-2, P-3 et texte trop long", () => {
  for (const phrase of REFUSED) {
    assert.equal(situationReadingEligible(phrase), false, phrase);
  }
  const long = `J'ai reçu le devis de ClimPro pour le chantier Dupont. ${"détail ".repeat(80)}`;
  assert.ok(long.trim().length > 500);
  assert.equal(situationReadingEligible(long), false);
});

test("le gate ne remplace pas une règle déjà répondue", () => {
  for (const flag of ["correction", "answeredDirectly", "structuredPlanAnswered", "deterministicSheet"] as const) {
    assert.equal(
      situationReadingTurn({
        correction: flag === "correction",
        answeredDirectly: flag === "answeredDirectly",
        structuredPlanAnswered: flag === "structuredPlanAnswered",
        deterministicSheet: flag === "deterministicSheet",
        text: RECEIVED,
      }),
      false,
    );
  }
  assert.equal(
    situationReadingTurn({
      correction: false,
      answeredDirectly: false,
      structuredPlanAnswered: false,
      deterministicSheet: false,
      text: RECEIVED,
    }),
    true,
  );
});

test("créations, confirmation et rejet restent hors lecture", () => {
  const supplier = "Ajoute ClimPro comme fournisseur";
  const pair = "Nouveau client Dupont. Dossier Toiture pour Dupont.";
  assert.equal(structuredPlanEligible(supplier), true);
  assert.equal(structuredPlanEligible(pair), true);
  assert.equal(situationReadingEligible(supplier), false);
  assert.equal(situationReadingEligible(pair), false);
  assert.equal(situationReadingEligible("Je confirme."), false);
  assert.equal(situationReadingEligible("Rejette."), false);
});

test("JSON invalide, clé interdite et contrat trop large", () => {
  assert.equal(parseSituationModelOutput("{"), null);
  assert.equal(parseSituationModelOutput(JSON.stringify({ mentions: [], start: 1 })), null);
  assert.equal(
    parseSituationModelOutput(JSON.stringify({ mentions: [{ kind: "client", text: "ClimPro", id: "x" }] })),
    null,
  );
  assert.equal(parseSituationModelOutput("x".repeat(SITUATION_RAW_LIMIT + 1)), null);
  const many = { mentions: Array.from({ length: 9 }, () => ({ kind: "client", text: "ClimPro" })) };
  assert.equal(parseSituationModelOutput(JSON.stringify(many)), null);
});

test("ancrage : absente, répétée, montant et quantité", () => {
  const text = "ClimPro propose 4 unités pour 3 600 € puis ClimPro";
  const output = parseSituationModelOutput(
    JSON.stringify({
      mentions: [
        { kind: "supplier", text: "Durand" },
        { kind: "supplier", text: "ClimPro" },
        { kind: "amount", text: "trois euros" },
        { kind: "amount", text: "4 unités" },
        { kind: "amount", text: "3 600 €" },
        { kind: "quantity", text: "quatre" },
        { kind: "quantity", text: "4 unités" },
      ],
    }),
  );
  assert.ok(output);
  const anchored = anchorMentions(text, output);
  assert.deepEqual(
    anchored.map((item) => item.text),
    ["ClimPro", "3 600 €", "4 unités"],
  );
  assert.equal(anchored[0]?.start, text.indexOf("ClimPro"));
  assert.equal(anchored[0]?.end, text.indexOf("ClimPro") + "ClimPro".length);
});

test("dossier unique, homonyme, inclusion et page", () => {
  const unique = matchProjectContext("devis Climatisation Dupont", [{ id: "p1", name: "Climatisation Dupont" }], "");
  assert.deepEqual(unique, { state: "matched", projectId: "p1", projectName: "Climatisation Dupont" });

  const homonym = matchProjectContext("devis Dupont", [
    { id: "a", name: "Dupont" },
    { id: "b", name: "Dupont" },
  ], "");
  assert.equal(homonym.state, "ambiguous");
  assert.equal("projectId" in homonym, false);
  if (homonym.state === "ambiguous") {
    assert.match(describeProjectContext(homonym), /Plusieurs dossiers portent le nom Dupont/);
  }

  const included = matchProjectContext("Climatisation Dupont et le chantier Dupont", [
    { id: "short", name: "Dupont" },
    { id: "long", name: "Climatisation Dupont" },
  ], "");
  assert.equal(included.state, "ambiguous");
  if (included.state === "ambiguous") {
    assert.deepEqual(included.projectNames, ["Dupont", "Climatisation Dupont"]);
  }

  const fragment = "J'ai reçu le devis de ClimPro pour le chantier Dupont";
  const projects = [{ id: "long", name: "Climatisation Dupont" }];
  assert.deepEqual(matchProjectContext(fragment, projects, ""), { state: "unresolved" });
  assert.deepEqual(matchProjectContext(fragment, projects, ""), { state: "unresolved" });
  assert.deepEqual(matchProjectContext(fragment, projects, "long"), {
    state: "current",
    projectId: "long",
    projectName: "Climatisation Dupont",
  });
});

test("knownEntities ignore le kind du modèle et croise les tables", () => {
  const mentions = anchorMentions("devis ClimPro", {
    mentions: [{ kind: "product", text: "ClimPro" }],
  });
  const found = matchKnownEntities(mentions, [
    { kind: "client", name: "ClimPro" },
    { kind: "supplier", name: "Climpro" },
  ]);
  assert.deepEqual(
    found.map((item) => item.kind),
    ["client", "supplier"],
  );
});

test("échec de lecture : dossier serveur, mentions vides, pas de carte", () => {
  const reading = buildSituationReading({
    conversationId: "c1",
    inboxItemId: null,
    fileIds: [],
    userText: RECEIVED,
    projects: [{ id: "p1", name: "Climatisation Dupont" }],
    pageProjectId: "",
    modelOutput: null,
    model: null,
    directory: [{ kind: "supplier", name: "ClimPro" }],
  });
  assert.deepEqual(reading.mentions, []);
  assert.deepEqual(reading.knownEntities, []);
  assert.deepEqual(reading.mentionProvenance, { origin: "none" });
  assert.equal(reading.projectContext.state, "unresolved");
  assert.equal(reading.projectContextProvenance, "server-rule");
  assert.match(situationReply(reading, true), /n’est pas disponible/);
  assert.equal("fields" in reading, false);
  assert.equal(readStoredProposalCard({ situation: reading }), null);
});

test("relecture du champ situation sans proposition", () => {
  const reading = buildSituationReading({
    conversationId: "c1",
    inboxItemId: null,
    fileIds: [],
    userText: "J'ai reçu le devis de Climatisation Dupont aujourd'hui",
    projects: [{ id: "p1", name: "Climatisation Dupont" }],
    pageProjectId: "",
    modelOutput: { mentions: [{ kind: "supplier", text: "Climatisation Dupont" }] },
    model: "qwen",
    directory: [],
  });
  const stored = { situation: reading };
  assert.equal(readStoredProposalCard(stored), null);
  assert.equal(reading.projectContext.state, "matched");
  assert.equal(reading.mentionProvenance.origin, "ollama");
  const card = JSON.stringify(stored);
  assert.equal(card.includes("\"fields\""), false);
  const reloaded = readStoredSituation(JSON.parse(card));
  assert.equal(reloaded?.projectContext.state, "matched");
  assert.equal(reloaded?.mentionProvenance.origin, "ollama");
});

test("P-1 : un parcours inachevé avec identifiant bloque seul la lecture", () => {
  const phrase = "J'ai reçu le devis de ClimPro, à associer au projet Dupont";
  const free = decideFree(phrase);
  assert.equal(free.execution, "absente");
  assert.equal(free.id, "assign_project");
  assert.equal(situationReadingEligible(phrase), false);
});

test("P-2 : nous proposons est inéligible", () => {
  assert.equal(situationReadingEligible("Nous proposons une offre à Dupont pour 3 600 €"), false);
});

test("P-3 : calcule et pourrais-tu en tête sont inéligibles", () => {
  assert.equal(situationReadingEligible("Calcule la marge sur le devis reçu de ClimPro"), false);
  assert.equal(situationReadingEligible("Pourrais-tu lire le devis que j'ai reçu de ClimPro"), false);
});

test("une réception sans objet commercial est inéligible", () => {
  assert.equal(situationReadingEligible("ClimPro m'a envoyé un mail hier soir"), false);
});

test("contrat Ollama : corps trop long, texte trop long, kind inconnu", () => {
  const padded = `{"mentions":[${" ".repeat(SITUATION_RAW_LIMIT)}{"kind":"client","text":"ClimPro"}]}`;
  assert.ok(padded.length > SITUATION_RAW_LIMIT);
  assert.doesNotThrow(() => JSON.parse(padded));
  assert.equal(parseSituationModelOutput(padded), null);

  const longText = "a".repeat(121);
  assert.equal(
    parseSituationModelOutput(JSON.stringify({ mentions: [{ kind: "client", text: longText }] })),
    null,
  );

  assert.equal(
    parseSituationModelOutput(JSON.stringify({ mentions: [{ kind: "invoice", text: "ClimPro" }] })),
    null,
  );
});

test("une quantité présente sans chiffre est écartée", () => {
  const text = "ClimPro propose quatre unités pour le devis reçu";
  const bare = "quatre unités";
  assert.ok(text.includes(bare));
  assert.equal(/\d/.test(bare), false);
  const anchored = anchorMentions(text, { mentions: [{ kind: "quantity", text: bare }] });
  assert.deepEqual(anchored, []);
  const withDigit = anchorMentions(`${text} et 4 unités`, {
    mentions: [
      { kind: "quantity", text: bare },
      { kind: "quantity", text: "4 unités" },
    ],
  });
  assert.deepEqual(withDigit.map((item) => item.text), ["4 unités"]);
});

test("le nom long l'emporte et un mot plus long ne rattache pas", () => {
  const matched = matchProjectContext("devis pour Climatisation Dupont", [
    { id: "short", name: "Dupont" },
    { id: "long", name: "Climatisation Dupont" },
  ], "");
  assert.deepEqual(matched, { state: "matched", projectId: "long", projectName: "Climatisation Dupont" });

  const word = matchProjectContext("devis pour Dupontel", [{ id: "p", name: "Dupont" }], "");
  assert.deepEqual(word, { state: "unresolved" });
});

test("ordre de la route : lecture après la fiche, avant le modèle de conversation", () => {
  const source = readFileSync(new URL("../src/app/api/assistant/route.ts", import.meta.url), "utf8");
  const post = source.slice(0, source.indexOf("async function answerFromSituation"));
  const at = (marker: string) => post.indexOf(marker);
  const order = [
    "answerDirectly(",
    "answerFromStructuredPlan(",
    "free.execution === \"absente\" && free.id",
    "situationReadingTurn(",
    "return answerFromSituation(",
    "plainQuestion(",
    "modelInterpretation(",
  ];
  const indexes = order.map(at);
  assert.ok(indexes.every((index) => index >= 0));
  for (let i = 1; i < indexes.length; i += 1) {
    assert.ok((indexes[i] ?? 0) > (indexes[i - 1] ?? 0));
  }
});
