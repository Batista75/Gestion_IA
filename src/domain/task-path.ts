import { classifyPendingTurn, confirmationBelongsToProposal } from "./conversation-turn.ts";
import { structuredPlanEligible } from "./structured-plan.ts";

export type StepState = "en_attente" | "en_cours" | "terminee" | "suspendue";

export type TaskStep = {
  id: "intention" | "champs" | "simulation" | "ecriture";
  label: string;
  state: StepState;
};

export type TaskOverrides = {
  projet: string;
  type: string;
  societe: string;
};

export type StoredTask = {
  intent: string;
  action: string;
  request: string;
  field: string;
  question: string;
  proposed: string;
  status: "suspendue" | "prete";
  steps: TaskStep[];
  overrides: TaskOverrides;
  valeurs: Record<string, string>;
  attachments: string[];
  view: string;
};

export type ResumeKind = "valeur" | "oui" | "non";

const QUESTION = /^(comment|pourquoi|qu['’]est-ce|quels?\b|quelles?\b|est-ce|c['’]est quoi|que |qui |ou |où |quand )\b/i;
const NEW_WRITE =
  /\b(enregistr\w*|cr[ée]e[rz]?\b|cr[ée]er|ajout\w*|modifi\w*|supprim\w*|rattache\w*|affect\w*|rapproch\w*|pr[ée]pare\w*|prepar\w*|envoy\w*|montre\w*|liste[rz]?\b|cherch\w*|affich\w*)\b/i;

/** Quatre étapes fixes. L’écriture reste en attente : ce parcours n’enregistre rien. */
export function taskSteps(input: { ready: boolean; simulated: boolean }): TaskStep[] {
  return [
    { id: "intention", label: "Intention", state: "terminee" },
    { id: "champs", label: "Champs", state: input.ready ? "terminee" : "suspendue" },
    { id: "simulation", label: "Simulation", state: input.simulated ? "terminee" : "en_attente" },
    { id: "ecriture", label: "Écriture", state: "en_attente" },
  ];
}

export function pathLine(steps: TaskStep[]): string {
  const text = steps.map((step) => `${step.label} ${stateLabel(step.state)}`).join(" · ");
  return `Parcours : ${text}.`;
}

/** Une réponse courte reprend la tâche. Une commande, une question ou une fiche n’en est pas une. */
export function resumeKind(text: string): ResumeKind | null {
  const raw = text.trim();
  if (!raw || raw.length > 160) return null;
  if (/^fiche\s*:/i.test(raw)) return null;
  if (raw.endsWith("?")) return null;
  if (QUESTION.test(raw) || NEW_WRITE.test(raw) || structuredPlanEligible(raw)) return null;
  if (/\b(ouvr\w*|nouveau\s+clients?|nouvelle\s+cliente|nouveau\s+projets?|nouveau\s+dossiers?)\b/i.test(raw)) return null;
  const turn = classifyPendingTurn(raw);
  if (turn === "confirm") return "oui";
  if (turn === "reject") return "non";
  if (turn === "new_intent" || turn === "correction") return null;
  return "valeur";
}

/** Une proposition en attente prend la confirmation. Sans proposition, le parcours reprend. */
export function resumeSuspendedTask(text: string, proposalPending: boolean): ResumeKind | null {
  if (confirmationBelongsToProposal(text, proposalPending)) return null;
  return resumeKind(text);
}

export function cleanAnswer(text: string): string {
  let value = text.trim().replace(/[.!]+$/g, "").trim();
  const lead = /^(la societe est|le fournisseur est|societe|fournisseur|projet|type|c est|est|le|la|l)\s+/i;
  for (let i = 0; i < 4 && lead.test(fold(value)); i += 1) {
    value = value.replace(/^(la société est|le fournisseur est|société|societe|fournisseur|projet|type|c'est|c est|est|le|la|l')\s+/i, "").trim();
  }
  return value;
}

export function nextOverrides(
  current: TaskOverrides,
  valeurs: Record<string, string>,
  field: string,
  kind: ResumeKind,
  text: string,
  proposed: string,
): { overrides: TaskOverrides; valeurs: Record<string, string>; accepted: string; kept: boolean } {
  const overrides = { ...current };
  const next = { ...valeurs };
  if (kind === "non") return { overrides, valeurs: next, accepted: "", kept: false };
  const value = kind === "oui" ? proposed.trim() : cleanAnswer(text);
  if (!value || !field) return { overrides, valeurs: next, accepted: "", kept: false };
  if (field === "projet") overrides.projet = value;
  else if (field === "type") overrides.type = value;
  else if (field === "société") overrides.societe = value;
  next[field] = value;
  return { overrides, valeurs: next, accepted: value, kept: true };
}

export function readStoredTask(value: unknown): StoredTask | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.intent !== "string" || !row.intent.trim()) return null;
  if (typeof row.request !== "string" || !row.request.trim()) return null;
  if (row.status !== "suspendue" && row.status !== "prete") return null;
  const overrides = row.overrides as Record<string, unknown> | null;
  return {
    intent: row.intent,
    action: typeof row.action === "string" ? row.action : "",
    request: row.request,
    field: typeof row.field === "string" ? row.field : "",
    question: typeof row.question === "string" ? row.question : "",
    proposed: typeof row.proposed === "string" ? row.proposed : "",
    status: row.status,
    steps: readSteps(row.steps),
    overrides: {
      projet: typeof overrides?.projet === "string" ? overrides.projet : "",
      type: typeof overrides?.type === "string" ? overrides.type : "",
      societe: typeof overrides?.societe === "string" ? overrides.societe : "",
    },
    valeurs: readMap(row.valeurs),
    attachments: readList(row.attachments),
    view: typeof row.view === "string" ? row.view : "/",
  };
}

function stateLabel(state: StepState): string {
  if (state === "terminee") return "terminée";
  if (state === "suspendue") return "suspendue";
  if (state === "en_cours") return "en cours";
  return "en attente";
}

function readSteps(value: unknown): TaskStep[] {
  const source = new Map<string, StepState>();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const row = item as { id?: unknown; state?: unknown };
      if (typeof row.id !== "string" || !isState(row.state)) continue;
      source.set(row.id, row.state);
    }
  }
  return taskSteps({ ready: false, simulated: false }).map((step) => ({
    ...step,
    state: source.get(step.id) ?? step.state,
  }));
}

function isState(value: unknown): value is StepState {
  return value === "en_attente" || value === "en_cours" || value === "terminee" || value === "suspendue";
}

function readMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return Object.fromEntries(entries.slice(0, 12));
}

function readList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 8);
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
