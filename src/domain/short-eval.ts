export type ShortCard = {
  confirm: string;
  understood: string[];
  supplier: string;
  documentType: string;
  project: string;
};

export type ShortTools = {
  decide: (text: string) => { id: string | null; execution: string };
  catalog: (id: string) => { required: string[]; risk: "lecture" | "confirmation" | "brouillon"; label: string } | null;
  card: (input: {
    text: string;
    required: string[];
    projectName: string;
    attachments: string[];
    societe: string;
    action: string;
  }) => ShortCard;
  simulate: (input: {
    action: string;
    risk: "lecture" | "confirmation" | "brouillon";
    ready: boolean;
    document: string;
    documentType: string;
    project: string;
    supplier: string;
    client: string;
  }) => string;
  steps: (input: { ready: boolean; simulated: boolean }) => { id: string; state: string }[];
  resume: (text: string) => "valeur" | "oui" | "non" | null;
  keepAnswer: (
    field: string,
    kind: "valeur" | "oui" | "non",
    text: string,
    proposed: string,
  ) => { kept: boolean; accepted: string };
  isQuestion: (text: string) => boolean;
  isHybridQuote: (text: string) => boolean;
  remember: (file: string, societe: string) => { document: string; societe: string };
  applies: (memory: { document: string; societe: string }, file: string) => boolean;
  notice: (memory: { document: string; projet: string; type: string; societe: string }) => string;
  correction: (text: string) => { societe: string } | null;
};

export type ShortRow = {
  phrase: string;
  check: string;
  ok: boolean;
};

/** Contrôle déterministe. Aucun montant n’est calculé, rien n’est écrit. */
export function evaluateShortMessages(tools: ShortTools): ShortRow[] {
  const bare = register("Enregistre ça", tools, { projectName: "", attachments: [], societe: "" });
  const filed = register("Enregistre ça", tools, {
    projectName: "Atlas",
    attachments: ["devis_rive.pdf"],
    societe: "",
  });
  const resumed = register("Enregistre ça", tools, {
    projectName: "Atlas",
    attachments: ["devis_rive.pdf"],
    societe: "Durand",
  });
  const durand = tools.keepAnswer("société", "valeur", "Durand", "");
  const oui = tools.keepAnswer("société", "oui", "oui", "");
  const memory = tools.remember("devis_rive.pdf", "Durand");
  const removed = tools.decide("Supprime tout ça");
  const lookup = tools.decide("que sait-on de Marie Dupont");

  return [
    row(
      "Enregistre ça",
      "Sans pièce, une seule question demande le document. L’écriture reste en attente.",
      bare.decision.id === "register_document" &&
        bare.decision.execution === "absente" &&
        /document/i.test(bare.card.confirm) &&
        !/société/i.test(bare.card.confirm) &&
        bare.simulation === "" &&
        bare.writing === "en_attente",
    ),
    row(
      "Enregistre ça",
      "Avec devis_rive.pdf et le projet Atlas, la seule question est la société.",
      /société/i.test(filed.card.confirm) &&
        filed.card.understood.some((line) => line.includes("devis_rive.pdf")) &&
        filed.card.understood.some((line) => line.includes("Atlas")) &&
        filed.card.understood.some((line) => /devis/i.test(line)) &&
        filed.simulation === "" &&
        filed.writing === "en_attente",
    ),
    row(
      "Durand",
      "La réponse reprend la même demande, simule, et n’attribue aucun numéro.",
      tools.resume("Durand") === "valeur" &&
        durand.kept &&
        durand.accepted === "Durand" &&
        resumed.card.confirm === "" &&
        resumed.card.supplier === "Durand" &&
        /Simulation/.test(resumed.simulation) &&
        /Aucun numéro de facture/.test(resumed.simulation) &&
        /Rien n’est écrit/.test(resumed.simulation) &&
        !/\d+,\d{2}/.test(resumed.simulation) &&
        resumed.writing === "en_attente",
    ),
    row(
      "Comment classe-t-on un devis ?",
      "La phrase est une question. Elle ne reprend pas une écriture.",
      tools.isQuestion("Comment classe-t-on un devis ?") && tools.resume("Comment classe-t-on un devis ?") === null,
    ),
    row(
      "prépare un devis pour Atelier Nord",
      "La phrase est la règle du brouillon, pas une action encore absente.",
      tools.isHybridQuote("prépare un devis pour Atelier Nord") &&
        tools.resume("prépare un devis pour Atelier Nord") === null,
    ),
    row(
      "Supprime tout ça",
      "Aucune action du catalogue ne correspond. Rien n’est repris.",
      removed.id === null && removed.execution === "absente" && tools.resume("Supprime tout ça") === null,
    ),
    row(
      "oui",
      "Sans hypothèse déjà proposée, oui ne remplit pas la société.",
      tools.resume("oui") === "oui" && !oui.kept,
    ),
    row(
      "Fiche : fournisseur Durand",
      "La fiche corrige la pièce. Elle ne lance pas une nouvelle commande.",
      tools.correction("Fiche : fournisseur Durand")?.societe === "Durand" &&
        tools.resume("Fiche : fournisseur Durand") === null,
    ),
    row(
      "que sait-on de Marie Dupont",
      "La consultation reste une lecture.",
      lookup.execution === "recherche" &&
        tools.resume("que sait-on de Marie Dupont") === null &&
        !tools.isHybridQuote("que sait-on de Marie Dupont"),
    ),
    row(
      "autre.pdf",
      "La société Durand reste sur devis_rive.pdf. Elle ne devient pas une règle.",
      tools.applies(memory, "devis_rive.pdf") &&
        !tools.applies(memory, "autre.pdf") &&
        /ne devient pas une règle/.test(
          tools.notice({ document: memory.document, projet: "", type: "", societe: memory.societe }),
        ),
    ),
  ];
}

export function shortEvaluationHolds(rows: ShortRow[]): boolean {
  return rows.length > 0 && rows.every((item) => item.ok);
}

function register(
  text: string,
  tools: ShortTools,
  scene: { projectName: string; attachments: string[]; societe: string },
) {
  const decision = tools.decide(text);
  const spec = decision.id ? tools.catalog(decision.id) : null;
  const card = tools.card({
    text,
    required: spec?.required ?? [],
    projectName: scene.projectName,
    attachments: scene.attachments,
    societe: scene.societe,
    action: spec?.label ?? "",
  });
  const ready = card.confirm === "";
  const simulation =
    spec && decision.execution === "absente"
      ? tools.simulate({
          action: spec.label,
          risk: spec.risk,
          ready,
          document: scene.attachments[0] ?? "",
          documentType: card.documentType,
          project: card.project,
          supplier: card.supplier,
          client: "",
        })
      : "";
  const writing = tools.steps({ ready, simulated: simulation !== "" }).find((step) => step.id === "ecriture")?.state ?? "";
  return { decision, card, simulation, writing };
}

function row(phrase: string, check: string, ok: boolean): ShortRow {
  return { phrase, check, ok };
}
