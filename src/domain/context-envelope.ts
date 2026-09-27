export type ContextHint = {
  view: string;
  attachments: string[];
};

export type ContextSnapshot = {
  viewLabel: string;
  projectId: string;
  projectName: string;
  projectClient: string;
  selectedKind: string;
  selectedLabel: string;
  attachments: string[];
  recent: string[];
  operator: string;
  role: string;
  allowed: string[];
};

export type ViewRef = {
  label: string;
  projectId: string;
  documentId: string;
};

const ID = "([\\w-]{8,80})";

export function emptySnapshot(): ContextSnapshot {
  return {
    viewLabel: "Accueil",
    projectId: "",
    projectName: "",
    projectClient: "",
    selectedKind: "",
    selectedLabel: "",
    attachments: [],
    recent: [],
    operator: "",
    role: "opérateur",
    allowed: [],
  };
}

export function readHint(value: unknown): ContextHint {
  const source = value && typeof value === "object" ? (value as { view?: unknown; attachments?: unknown }) : {};
  const raw = typeof source.view === "string" ? source.view.trim().slice(0, 200) : "";
  const view = raw.startsWith("/") && !raw.includes("\\") && !raw.includes("..") ? raw : "/";
  const attachments = Array.isArray(source.attachments)
    ? source.attachments
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().replace(/[/\\]/g, "").slice(0, 120))
        .filter(Boolean)
        .slice(0, 8)
    : [];
  return { view, attachments };
}

export function readView(path: string): ViewRef {
  const clean = (path.split("?")[0] ?? "/").split("#")[0] ?? "/";
  const project = new RegExp(`^/projets/${ID}`).exec(clean);
  const document = new RegExp(`^/projets/${ID}/documents/${ID}`).exec(clean);
  if (project && document) {
    return { label: "Document", projectId: project[1] ?? "", documentId: document[2] ?? "" };
  }
  if (project && /\/facture$/.test(clean)) {
    return { label: "Facture", projectId: project[1] ?? "", documentId: "" };
  }
  if (project) return { label: "Projet", projectId: project[1] ?? "", documentId: "" };
  if (clean === "/" || clean === "") return { label: "Accueil", projectId: "", documentId: "" };
  if (clean.startsWith("/clients")) return { label: "Clients", projectId: "", documentId: "" };
  if (clean.startsWith("/fournisseurs")) return { label: "Fournisseurs", projectId: "", documentId: "" };
  if (clean.startsWith("/produits")) return { label: "Produits et services", projectId: "", documentId: "" };
  if (clean.startsWith("/suivi")) return { label: "Devis", projectId: "", documentId: "" };
  return { label: "Page", projectId: "", documentId: "" };
}

export function contextLine(snapshot: ContextSnapshot): string {
  const parts = [snapshot.viewLabel];
  if (snapshot.projectName) parts.push(snapshot.projectName);
  if (snapshot.selectedLabel) parts.push(snapshot.selectedLabel);
  if (snapshot.attachments.length > 0) parts.push(`pièces ${snapshot.attachments.join(", ")}`);
  if (snapshot.operator) parts.push(`${snapshot.role} ${snapshot.operator}`);
  return `Contexte : ${parts.join(" · ")}.`;
}

export function contextBrief(snapshot: ContextSnapshot): string {
  const recent = snapshot.recent.length > 0 ? ` Actions récentes : ${snapshot.recent.join(" ; ")}.` : "";
  const allowed = snapshot.allowed.length > 0 ? ` Actions autorisées : ${snapshot.allowed.join(", ")}.` : "";
  return `${contextLine(snapshot)}${recent}${allowed} Ce contexte est construit par l’application.`;
}

const TYPE_WORD = /\b(devis|facture|commande|contrat|bon de livraison|rfq)\b/i;

export function knownSlots(snapshot: ContextSnapshot): Set<string> {
  const found = new Set<string>();
  const names = `${snapshot.attachments.join(" ")} ${snapshot.selectedLabel}`.replace(/[_./-]+/g, " ");
  if (snapshot.attachments.length > 0 || snapshot.selectedKind === "document") found.add("document");
  if (TYPE_WORD.test(names)) found.add("type");
  if (snapshot.projectName) found.add("projet");
  if (snapshot.projectClient) found.add("client");
  if (snapshot.selectedKind === "client" || snapshot.selectedKind === "fournisseur") {
    found.add("société");
    found.add("client");
  }
  return found;
}

export function withContext<T extends { missing: string[] }>(decision: T, snapshot: ContextSnapshot): T {
  const known = knownSlots(snapshot);
  return { ...decision, missing: decision.missing.filter((field) => !known.has(field)) };
}
