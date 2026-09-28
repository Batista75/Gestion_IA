export const ACTIVITY_KINDS = [
  { id: "client", label: "Clients", row: "Client" },
  { id: "fournisseur", label: "Fournisseurs", row: "Fournisseur" },
  { id: "produit", label: "Produits", row: "Produit" },
  { id: "projet", label: "Projets", row: "Projet" },
  { id: "action", label: "Actions de dossier", row: "Action" },
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number]["id"];

export type ActivityFilter = {
  text: string;
  kind: ActivityKind | "";
  projectId: string;
  entityId: string;
};

export type ActivityMatch = {
  kind: ActivityKind;
  title: string;
  summary: string;
  actor: string;
  source: string;
  projectId: string;
  entityId: string;
};

const KIND_IDS = new Set<string>(ACTIVITY_KINDS.map((item) => item.id));

const ENTITY_KIND: Record<string, ActivityKind> = {
  client: "client",
  supplier: "fournisseur",
  product: "produit",
  project: "projet",
};

export function readActivityFilter(input: {
  q?: string;
  type?: string;
  projet?: string;
  fiche?: string;
}): ActivityFilter {
  const type = (input.type ?? "").trim();
  return {
    text: (input.q ?? "").trim(),
    kind: KIND_IDS.has(type) ? (type as ActivityKind) : "",
    projectId: (input.projet ?? "").trim(),
    entityId: (input.fiche ?? "").trim(),
  };
}

export function activityKindLabel(kind: ActivityKind, place: "filter" | "row" = "row"): string {
  const item = ACTIVITY_KINDS.find((entry) => entry.id === kind);
  if (!item) return kind;
  return place === "filter" ? item.label : item.row;
}

export function kindFromEntity(entityType: string): ActivityKind | "" {
  return ENTITY_KIND[entityType] ?? "";
}

export function activityMatches(trace: ActivityMatch, filter: ActivityFilter): boolean {
  if (filter.kind && trace.kind !== filter.kind) return false;
  if (filter.entityId && trace.entityId !== filter.entityId) return false;
  if (filter.projectId) {
    const linked =
      trace.kind === "action"
        ? trace.projectId === filter.projectId
        : trace.kind === "projet" && trace.entityId === filter.projectId;
    if (!linked) return false;
  }
  const text = filter.text.toLocaleLowerCase("fr-FR");
  if (!text) return true;
  const hay = `${trace.title} ${trace.summary} ${trace.actor} ${trace.source}`.toLocaleLowerCase("fr-FR");
  return hay.includes(text);
}

export function eventsQuery(filter: ActivityFilter): string {
  const params = new URLSearchParams();
  if (filter.text) params.set("q", filter.text);
  if (filter.kind) params.set("type", filter.kind);
  if (filter.projectId) params.set("projet", filter.projectId);
  if (filter.entityId) params.set("fiche", filter.entityId);
  const query = params.toString();
  return query ? `/evenements?${query}` : "/evenements";
}

export function splitActivityTokens(values: readonly string[]): { records: string[]; actions: string[] } {
  const records: string[] = [];
  const actions: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    const match = /^(fiche|action):([A-Za-z0-9]+)$/.exec(value);
    if (!match) continue;
    seen.add(value);
    if (match[1] === "fiche") records.push(match[2]!);
    else actions.push(match[2]!);
  }
  return { records, actions };
}
