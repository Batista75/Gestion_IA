export type QuestionKind = "choix" | "confirmation" | "valeur";

export type BlockingQuestion = {
  kind: QuestionKind;
  field: string;
  text: string;
};

/** Seuil en dessous duquel le champ bloque. 1 exige une confirmation explicite. */
export const fieldThresholds: Record<string, number> = {
  type: 0.85,
  projet: 0.9,
  client: 1,
  société: 0.9,
  document: 0.85,
  "devis accepté": 0.95,
  livraison: 0.9,
  ligne: 0.85,
  source: 0.9,
  mouvement: 0.95,
  "facture ou projet": 0.9,
  montant: 1,
  tva: 1,
};

export type FieldOverrides = {
  projet: string;
  type: string;
  société: string;
  /** Valeur acceptée pour un champ, y compris hors projet, type et société. */
  valeurs?: Record<string, string>;
};

export type CompletenessInput = {
  required: string[];
  text: string;
  projectName: string;
  projectClient: string;
  attachments: string[];
  selectedLabel: string;
  selectedKind: string;
  projectChoices: string[];
  projectOptions?: string[];
  supplierOptions?: string[];
  overrides?: FieldOverrides;
};

export type UnderstandingCard = {
  action: string;
  understood: string[];
  confirm: string;
  project: string;
  documentType: string;
  supplier: string;
  projects: string[];
  types: string[];
  suppliers: string[];
  attachments: string[];
  simulation: string;
  field: string;
  proposed: string;
  path: string;
};

const TYPE_WORD = /\b(devis|facture|commande|contrat|bon de livraison|rfq)\b/;

export function blockingQuestion(input: CompletenessInput): BlockingQuestion | null {
  for (const field of input.required) {
    const reading = readField(field, input);
    const threshold = fieldThresholds[field] ?? 0.9;
    if (reading.confidence >= threshold) continue;
    return questionFor(field, reading, input);
  }
  return null;
}

const SPOKEN = ["document", "type", "projet", "société", "client"];

export function understandingCard(input: CompletenessInput & { action: string }): UnderstandingCard {
  const question = blockingQuestion(input);
  const understood: string[] = [];
  const readings = new Map<string, { value: string; confidence: number }>();
  for (const field of [...new Set([...SPOKEN, ...input.required])]) {
    const reading = readField(field, input);
    readings.set(field, reading);
    const threshold = fieldThresholds[field] ?? 0.9;
    if (reading.value && reading.confidence >= threshold) {
      understood.push(understoodSentence(field, reading.value));
    }
  }
  const project = readings.get("projet")?.value ?? "";
  const documentType = readings.get("type")?.value ?? "";
  const supplier = readings.get("société")?.value ?? "";
  return {
    action: input.action,
    understood,
    confirm: question?.text ?? "",
    project,
    documentType,
    supplier,
    projects: listed([project, input.projectName, ...(input.projectOptions ?? []), ...input.projectChoices]),
    types: listed([documentType, "devis", "facture", "commande", "contrat"]),
    suppliers: listed([supplier, ...(input.supplierOptions ?? [])]),
    attachments: input.attachments.slice(0, 8),
    simulation: "",
    field: question?.field ?? "",
    proposed: question ? (readings.get(question.field)?.value ?? "") : "",
    path: "",
  };
}

/** « Fiche : projet Atlas, type devis, fournisseur Durand » corrige la fiche, pas le message. */
export function readCardCorrection(text: string): FieldOverrides | null {
  const match = /^fiche\s*:\s*(.+)$/i.exec(text.trim());
  if (!match) return null;
  const body = match[1] ?? "";
  const projet = labeled(body, "projet");
  const type = labeled(body, "type");
  const société = labeled(body, "fournisseur") || labeled(body, "société") || labeled(body, "societe");
  if (!projet && !type && !société) return null;
  return { projet, type, société };
}

export function readUnderstanding(value: unknown): UnderstandingCard | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { understanding?: unknown; action?: unknown };
  const source =
    row.understanding && typeof row.understanding === "object" ? row.understanding : row.action ? row : null;
  if (!source || typeof source !== "object") return null;
  const card = source as Record<string, unknown>;
  if (typeof card.action !== "string" || !card.action.trim()) return null;
  return {
    action: card.action,
    understood: stringList(card.understood),
    confirm: typeof card.confirm === "string" ? card.confirm : "",
    project: typeof card.project === "string" ? card.project : "",
    documentType: typeof card.documentType === "string" ? card.documentType : "",
    supplier: typeof card.supplier === "string" ? card.supplier : "",
    projects: stringList(card.projects).slice(0, 80),
    types: stringList(card.types).slice(0, 12),
    suppliers: stringList(card.suppliers).slice(0, 80),
    attachments: stringList(card.attachments).slice(0, 8),
    simulation: typeof card.simulation === "string" ? card.simulation : "",
    field: typeof card.field === "string" ? card.field : "",
    proposed: typeof card.proposed === "string" ? card.proposed : "",
    path: typeof card.path === "string" ? card.path : "",
  };
}

function readField(field: string, input: CompletenessInput): { value: string; confidence: number } {
  const chosen = chosenValue(field, input.overrides);
  if (chosen) return { value: chosen, confidence: 1 };
  const text = fold(input.text);
  const files = fold(input.attachments.join(" "));
  const selected = fold(input.selectedLabel);
  if (field === "document") {
    if (input.attachments.length > 0) return { value: input.attachments[0] ?? "", confidence: 0.98 };
    if (input.selectedKind === "document") return { value: input.selectedLabel, confidence: 0.98 };
    return { value: "", confidence: 0 };
  }
  if (field === "type") {
    const fromFile = TYPE_WORD.exec(files) ?? TYPE_WORD.exec(selected);
    if (fromFile) return { value: fromFile[1] ?? "", confidence: 0.92 };
    const fromText = TYPE_WORD.exec(text);
    if (fromText) return { value: fromText[1] ?? "", confidence: 0.7 };
    return { value: "", confidence: 0 };
  }
  if (field === "projet") {
    if (input.projectChoices.length >= 2) return { value: "", confidence: 0.4 };
    if (input.projectName) return { value: input.projectName, confidence: 0.97 };
    if (input.projectChoices.length === 1) return { value: input.projectChoices[0] ?? "", confidence: 0.72 };
    return { value: "", confidence: 0 };
  }
  if (field === "société") {
    if (input.selectedKind === "client" || input.selectedKind === "fournisseur") {
      return { value: input.selectedLabel, confidence: 0.96 };
    }
    return { value: "", confidence: 0 };
  }
  if (field === "client") {
    if (input.projectClient) return { value: input.projectClient, confidence: 0.92 };
    return { value: "", confidence: 0 };
  }
  if (field === "devis accepté") {
    if (/\b(accepte|signe)\b/.test(text)) return { value: "accepté", confidence: 0.8 };
    return { value: "", confidence: 0 };
  }
  if (field === "livraison") {
    if (/\b(livraison|adresse)\b/.test(text)) return { value: "citée", confidence: 0.7 };
    return { value: "", confidence: 0 };
  }
  if (field === "ligne" && /\bligne\b/.test(text)) return { value: "citée", confidence: 0.86 };
  if (field === "source" && /\b(devis|piece|document)\b/.test(text)) return { value: "citée", confidence: 0.86 };
  if (field === "mouvement" && /\b(virement|paiement|reglement)\b/.test(text)) return { value: "cité", confidence: 0.86 };
  if (field === "facture ou projet" && /\b(facture|projet)\b/.test(text)) return { value: "cité", confidence: 0.86 };
  return { value: "", confidence: 0 };
}

function questionFor(
  field: string,
  reading: { value: string; confidence: number },
  input: CompletenessInput,
): BlockingQuestion {
  if (field === "projet" && input.projectChoices.length >= 2) {
    const listed = input.projectChoices.slice(0, 4).join(" ; ");
    return {
      kind: "choix",
      field,
      text: `Ce document semble concerner plusieurs projets : ${listed}. Sur lequel dois-je l’enregistrer ?`,
    };
  }
  if (field === "type" && !reading.value) {
    return {
      kind: "choix",
      field,
      text: "Quel est le type du document : devis, facture, commande ou contrat ?",
    };
  }
  if (reading.value && reading.confidence > 0) {
    return { kind: "confirmation", field, text: confirmText(field, reading.value) };
  }
  return { kind: "valeur", field, text: missingText(field) };
}

function confirmText(field: string, value: string): string {
  if (field === "projet") return `Je propose de rattacher ceci à ${value}, le projet reconnu. Confirmer ?`;
  if (field === "client") return `Le client facturé est ${value}. Confirmer ?`;
  if (field === "type") return `Le document semble être un ${value}. Confirmer ?`;
  if (field === "devis accepté") return "Le devis est indiqué comme accepté. Confirmer ?";
  return `Je retiens ${field} : ${value}. Confirmer ?`;
}

function missingText(field: string): string {
  if (field === "document") return "Quel document dois-je enregistrer ?";
  if (field === "société") return "Quelle société figure sur le document ?";
  if (field === "projet") return "Sur quel projet dois-je l’enregistrer ?";
  if (field === "client") return "Quel est le client facturé ?";
  if (field === "livraison") return "Quelle adresse de livraison utiliser ?";
  if (field === "devis accepté") return "Quel devis accepté sert de base ?";
  if (field === "mouvement") return "Quel mouvement bancaire faut-il rapprocher ?";
  if (field === "ligne") return "Quelle ligne de coût faut-il mettre à jour ?";
  if (field === "source") return "Quelle pièce sert de source pour ce coût ?";
  return `Quelle valeur pour ${field} ?`;
}

function chosenValue(field: string, overrides: FieldOverrides | undefined): string {
  if (!overrides) return "";
  if (field === "projet" && overrides.projet.trim()) return overrides.projet.trim();
  if (field === "type" && overrides.type.trim()) return overrides.type.trim();
  if (field === "société" && overrides.société.trim()) return overrides.société.trim();
  const extra = overrides.valeurs?.[field];
  return typeof extra === "string" ? extra.trim() : "";
}

function understoodSentence(field: string, value: string): string {
  if (field === "document") return `Le document est ${value}.`;
  if (field === "type") return `Le type retenu est ${value}.`;
  if (field === "projet") return `Le projet retenu est ${value}.`;
  if (field === "société") return `La société retenue est ${value}.`;
  if (field === "client") return `Le client facturé est ${value}.`;
  return `${field} : ${value}.`;
}

function labeled(body: string, name: string): string {
  const match = new RegExp(`(?:^|,)\\s*${name}\\s+([^,]+)`, "i").exec(body);
  return (match?.[1] ?? "").trim();
}

function listed(values: string[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const value of values) {
    const name = value.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= 80) break;
  }
  return names;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_./-]+/g, " ");
}
