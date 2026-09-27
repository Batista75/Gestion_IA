export const interpreterIntents = [
  "register_document",
  "assign_project",
  "prepare_customer_quote",
  "update_cost",
  "register_order",
  "match_payment",
  "answer_question",
  "import_brief",
  "price_rule",
  "confirm_pending",
  "maintain_record",
  "read_trade",
] as const;

export type InterpreterIntent = (typeof interpreterIntents)[number];

export type Hypothesis = {
  field: string;
  value: string;
  reason: string;
};

export type Interpretation = {
  intent: InterpreterIntent;
  targets: string[];
  missing: string[];
  hypotheses: Hypothesis[];
  confidence: Record<string, number>;
};

const READ_INTENTS = new Set<InterpreterIntent>(["answer_question", "price_rule", "read_trade"]);

const LABELS: Record<InterpreterIntent, string> = {
  register_document: "Enregistrer un document",
  assign_project: "Affecter à un projet",
  prepare_customer_quote: "Préparer un devis client",
  update_cost: "Mettre à jour un coût",
  register_order: "Enregistrer une commande",
  match_payment: "Rapprocher un paiement",
  answer_question: "Répondre à une question",
  import_brief: "Enregistrer un tableau ou un projet parlé",
  price_rule: "Rappeler la règle de prix",
  confirm_pending: "Confirmer ou écarter une proposition",
  maintain_record: "Proposer une fiche du répertoire",
  read_trade: "Lire le parcours et les preuves",
};

const KEYS = new Set(["intent", "targets", "missing", "hypotheses", "confidence"]);

export function interpreterGuide(): string {
  return [
    "Réponds par un seul objet JSON.",
    "Clés autorisées : intent, targets, missing, hypotheses, confidence.",
    `intent est exactement l’une de : ${interpreterIntents.join(", ")}.`,
    "targets et missing sont des listes de textes courts.",
    "hypotheses est une liste d’objets field, value, reason.",
    "confidence est un objet de nombres entre 0 et 1.",
    "Ne lance aucune action. Ne calcule aucun montant, aucune TVA, aucun numéro.",
  ].join(" ");
}

export function intentLabel(intent: InterpreterIntent): string {
  return LABELS[intent];
}

/** Une intention de lecture peut être expliquée. Les autres ne sont pas exécutées. */
export function interpreterEffect(value: Interpretation): "lire" | "ecrire" {
  return READ_INTENTS.has(value.intent) ? "lire" : "ecrire";
}

export function plainQuestion(text: string): Interpretation | null {
  const trimmed = text.trim();
  const explain = /^(comment|pourquoi|qu['’]est-ce|quels?\b|quelles?\b|est-ce|c['’]est quoi)\b/i;
  if (!explain.test(trimmed) && !trimmed.endsWith("?")) return null;
  return {
    intent: "answer_question",
    targets: [],
    missing: [],
    hypotheses: [{ field: "question", value: trimmed.slice(0, 160), reason: "La phrase est une question." }],
    confidence: { question: 0.95 },
  };
}

export function parseInterpretation(raw: string): Interpretation | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!Object.keys(row).every((key) => KEYS.has(key))) return null;
  if (typeof row.intent !== "string" || !isIntent(row.intent)) return null;
  const targets = textList(row.targets);
  const missing = textList(row.missing);
  const hypotheses = hypothesisList(row.hypotheses);
  const confidence = confidenceMap(row.confidence);
  if (!targets || !missing || !hypotheses || !confidence) return null;
  return { intent: row.intent, targets, missing, hypotheses, confidence };
}

export function interpretationLine(value: Interpretation): string {
  const hypothesis = value.hypotheses[0];
  const because = hypothesis
    ? ` Hypothèse : ${hypothesis.field} ${hypothesis.value}, ${hypothesis.reason}`
    : "";
  return `Interprétation : ${intentLabel(value.intent)}.${because} Rien n’est exécuté.`;
}

function isIntent(value: string): value is InterpreterIntent {
  return interpreterIntents.some((intent) => intent === value);
}

function textList(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const texts: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const text = item.trim();
    if (!text) continue;
    texts.push(text.slice(0, 160));
    if (texts.length >= 8) break;
  }
  return texts;
}

function hypothesisList(value: unknown): Hypothesis[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const rows: Hypothesis[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as { field?: unknown; value?: unknown; reason?: unknown };
    if (typeof row.field !== "string" || typeof row.value !== "string" || typeof row.reason !== "string") {
      return null;
    }
    rows.push({
      field: row.field.trim().slice(0, 80),
      value: row.value.trim().slice(0, 160),
      reason: row.reason.trim().slice(0, 200),
    });
    if (rows.length >= 6) break;
  }
  return rows.filter((row) => row.field && row.value && row.reason);
}

function confidenceMap(value: unknown): Record<string, number> | null {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const scores: Record<string, number> = {};
  for (const [key, score] of Object.entries(value)) {
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) return null;
    scores[key.slice(0, 80)] = score;
  }
  return scores;
}
