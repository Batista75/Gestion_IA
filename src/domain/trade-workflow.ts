export const TRADE_ID = "achat-revente-technologies";

export const TRADE_TITLE = "Achat et revente de produits et services — technologies";

export type TradeStep = {
  key: string;
  order: number;
  title: string;
  action: string;
  proof: string;
  keywords: string[];
  requires: string[];
  requireAny: string[];
};

export const TRADE_STEPS: TradeStep[] = [
  {
    key: "demande",
    order: 1,
    title: "Réception de la demande",
    action: "Validation du besoin client, étude de faisabilité et d’éligibilité.",
    proof: "RFQ (Request for Quotation) ou cahier des charges client.",
    keywords: ["rfq", "cahier des charges", "demande"],
    requires: [],
    requireAny: [],
  },
  {
    key: "offre",
    order: 2,
    title: "Chiffrage & Proposition",
    action: "Élaboration de l’offre technique et financière (prix, délais, SLA).",
    proof: "Devis ou Offre commerciale (signée/datée) avec CGV.",
    keywords: ["devis", "offre", "chiffrage"],
    requires: ["demande"],
    requireAny: [],
  },
  {
    key: "engagement",
    order: 3,
    title: "Engagement client",
    action: "Validation formelle de l’offre par l’acheteur.",
    proof: "Bon de commande (PO) client signé ou accord formel.",
    keywords: ["bon de commande", "po client", "accord formel"],
    requires: ["offre"],
    requireAny: [],
  },
  {
    key: "confirmation",
    order: 4,
    title: "Confirmation de commande",
    action: "Saisie dans l’ERP, réservation des stocks et planification des services.",
    proof: "Accusé de réception de commande (ARC).",
    keywords: ["arc", "accuse de reception", "confirmation de commande"],
    requires: ["engagement"],
    requireAny: [],
  },
  {
    key: "preparation",
    order: 5,
    title: "Exécution / Préparation",
    action: "Assemblage/fabrication des produits et réservation des intervenants pour le service.",
    proof: "Fiche de préparation / Ordre de service (OS) interne.",
    keywords: ["ordre de service", "fiche de preparation", "preparation"],
    requires: ["confirmation"],
    requireAny: [],
  },
  {
    key: "expedition",
    order: 6,
    title: "Expédition & Exécution",
    action: "Mise à disposition des produits et réalisation de la prestation sur site/à distance.",
    proof: "Bordereau de transport / Ordre de mission intervenant.",
    keywords: ["bordereau", "ordre de mission", "expedition"],
    requires: ["preparation"],
    requireAny: [],
  },
  {
    key: "livraison",
    order: 7,
    title: "Remise des produits",
    action: "Livraison physique chez le client et vérification du colisage.",
    proof: "Bon de livraison (BL) signé par le destinataire avec réserves éventuelles.",
    keywords: ["bon de livraison", "bl"],
    requires: ["expedition"],
    requireAny: [],
  },
  {
    key: "reception",
    order: 8,
    title: "Réception des services",
    action: "Recette fonctionnelle ou constat d’achèvement de la prestation.",
    proof: "Procès-verbal (PV) de réception sans réserve (ou avec réserves levées).",
    keywords: ["proces-verbal", "pv de reception", "recette"],
    requires: ["expedition"],
    requireAny: [],
  },
  {
    key: "facturation",
    order: 9,
    title: "Facturation & Clôture",
    action: "Émission du titre de paiement basé sur la livraison effective.",
    proof: "Facture finale (mentionnant les numéros de PO et BL/PV) et justificatif de paiement (relevé/avis de virement).",
    keywords: ["facture", "virement", "cloture"],
    requires: [],
    requireAny: ["livraison", "reception"],
  },
];

export const TRADE_RULES = [
  "Un devis n’engage pas le client. L’engagement est le bon de commande signé ou l’accord formel.",
  "L’accusé de réception de commande attend le bon de commande client.",
  "La préparation et l’expédition attendent cet accusé.",
  "Le bon de livraison constate la remise des produits. Le procès-verbal constate la réception des services.",
  "La facture vient après un bon de livraison signé ou un procès-verbal de réception. Elle reprend les références déjà enregistrées du bon de commande et du BL ou du PV.",
  "L’application n’émet pas la facture et ne lui donne pas de numéro.",
  "Les prix, la TVA et les marges ne sont pas décidés par l’assistant.",
];

export type StepStatus = "a_faire" | "en_cours" | "fait";

export type StepRecord = {
  key: string;
  status: StepStatus;
  proofRef: string;
  proofNote: string;
};

export function tradeStep(key: string): TradeStep | null {
  return TRADE_STEPS.find((step) => step.key === key) ?? null;
}

export function stepStatusLabel(status: string): string {
  if (status === "fait") return "Preuve enregistrée";
  if (status === "en_cours") return "En cours";
  return "À faire";
}

export function readStepStatus(raw: string): StepStatus {
  if (raw === "en_cours" || raw === "fait") return raw;
  return "a_faire";
}

export function assertProof(status: StepStatus, proofRef: string): void {
  if (status === "fait" && proofRef.trim().length < 2) {
    throw new Error("Une étape faite exige la référence de sa preuve.");
  }
}

export function missingProofs(key: string, records: StepRecord[]): TradeStep[] {
  const step = tradeStep(key);
  if (!step) return [];
  const done = new Set(records.filter((record) => record.status === "fait").map((record) => record.key));
  const missing = step.requires
    .filter((required) => !done.has(required))
    .map((required) => tradeStep(required))
    .filter((item): item is TradeStep => Boolean(item));
  if (step.requireAny.length > 0 && !step.requireAny.some((required) => done.has(required))) {
    missing.push(
      ...step.requireAny
        .map((required) => tradeStep(required))
        .filter((item): item is TradeStep => Boolean(item)),
    );
  }
  return missing;
}

export function advanceWarning(key: string, records: StepRecord[]): string {
  const missing = missingProofs(key, records);
  if (missing.length === 0) return "";
  return `Preuves encore absentes : ${missing.map((step) => step.proof).join(" ")}`;
}

export function nextTradeStep(records: StepRecord[]): TradeStep {
  return (
    TRADE_STEPS.find((step) => {
      const record = records.find((item) => item.key === step.key);
      return !record || record.status !== "fait";
    }) ?? TRADE_STEPS[TRADE_STEPS.length - 1]!
  );
}

export function asksTradeWorkflow(text: string): boolean {
  const folded = fold(text);
  return /prochaine etape|ou en est|parcours commercial|instruction metier|quelle preuve|quelle etape|puis-je facturer|peut-on facturer|avant de facturer|bon de commande|accuse de reception|bon de livraison|proces-verbal|cahier des charges|ordre de mission|ordre de service/.test(
    folded,
  );
}

export function projectTradeReply(projectName: string, records: StepRecord[]): string {
  const next = nextTradeStep(records);
  const done = TRADE_STEPS.filter((step) =>
    records.some((record) => record.key === step.key && record.status === "fait"),
  );
  const warning = advanceWarning(next.key, records);
  return [
    "D’après le métier achat-revente technologies.",
    `Dossier ${projectName}.`,
    done.length > 0
      ? `Preuves enregistrées : ${done.map((step) => `${step.order}. ${step.title}`).join(" ; ")}.`
      : "Aucune preuve d’étape n’est encore enregistrée.",
    `Prochaine étape : ${next.order}. ${next.title}.`,
    `Action : ${next.action}`,
    `Preuve attendue : ${next.proof}`,
    warning,
    next.key === "facturation" ? TRADE_RULES[5] : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function tradeRuleReply(text: string): string {
  const folded = fold(text);
  const step = TRADE_STEPS.find((item) => item.keywords.some((keyword) => folded.includes(fold(keyword))));
  if (!step) {
    return [
      "D’après le métier achat-revente technologies.",
      ...TRADE_STEPS.map((item) => `${item.order}. ${item.title} — ${item.proof}`),
      ...TRADE_RULES,
    ].join("\n");
  }
  const rule =
    step.key === "facturation"
      ? TRADE_RULES[4]
      : step.key === "offre"
        ? TRADE_RULES[0]
        : step.key === "confirmation"
          ? TRADE_RULES[1]
          : "";
  return [
    "D’après le métier achat-revente technologies.",
    `Étape ${step.order}. ${step.title}.`,
    `Action : ${step.action}`,
    `Preuve attendue : ${step.proof}`,
    rule,
    step.key === "facturation" ? TRADE_RULES[5] : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function workflowKnowledge(records: StepRecord[]): string {
  const next = nextTradeStep(records);
  const lines = TRADE_STEPS.map((step) => {
    const record = records.find((item) => item.key === step.key);
    const status = stepStatusLabel(record?.status ?? "a_faire");
    const proof = record?.proofRef ? ` Preuve ${record.proofRef}.` : "";
    return `${step.order}. ${step.title} — ${status}.${proof}`;
  });
  return [`Parcours ${TRADE_TITLE}`, `Prochaine étape ${next.order}. ${next.title}. Preuve attendue : ${next.proof}`, ...lines].join("\n");
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
