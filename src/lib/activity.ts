import {
  activityKindLabel,
  activityMatches,
  kindFromEntity,
  type ActivityFilter,
  type ActivityKind,
  type ActivityMatch,
} from "@/domain/activity";
import { prisma } from "@/lib/db";

const WINDOW = 500;
const SHOWN = 200;

export type ActivityRow = ActivityMatch & {
  token: string;
  kindLabel: string;
  at: string;
};

export async function listActivity(filter: ActivityFilter): Promise<{ rows: ActivityRow[]; truncated: boolean }> {
  const recordsWhere = recordWhere(filter);
  const actionsWhere = actionWhere(filter);
  const [records, actions] = await Promise.all([
    recordsWhere === null
      ? Promise.resolve([])
      : prisma.recordEvent.findMany({
          where: recordsWhere,
          orderBy: { createdAt: "desc" },
          take: WINDOW,
        }),
    actionsWhere === null
      ? Promise.resolve([])
      : prisma.projectEvent.findMany({
          where: actionsWhere,
          orderBy: { createdAt: "desc" },
          take: WINDOW,
          include: { project: { select: { name: true } } },
        }),
  ]);

  const rows = [
    ...records.flatMap((row) => {
      const kind = kindFromEntity(row.entityType);
      if (!kind) return [];
      const trace: ActivityMatch = {
        kind,
        title: row.entityName,
        summary: row.summary,
        actor: row.actor.trim() || "J Smith",
        source: sourceText(row.source),
        projectId: "",
        entityId: row.entityId,
      };
      if (!activityMatches(trace, filter)) return [];
      return [{ ...trace, token: `fiche:${row.id}`, kindLabel: activityKindLabel(kind), at: row.createdAt.toISOString() }];
    }),
    ...actions.flatMap((row) => {
      const trace: ActivityMatch = {
        kind: "action",
        title: row.project.name,
        summary: row.body,
        actor: "Application",
        source: "Application",
        projectId: row.projectId,
        entityId: "",
      };
      if (!activityMatches(trace, filter)) return [];
      return [{ ...trace, token: `action:${row.id}`, kindLabel: activityKindLabel("action"), at: row.createdAt.toISOString() }];
    }),
  ].sort((left, right) => right.at.localeCompare(left.at));

  const shown = rows.slice(0, SHOWN);
  return {
    rows: shown.map((row) => ({
      ...row,
      at: new Date(row.at).toLocaleString("fr-FR"),
    })),
    truncated: rows.length > SHOWN || records.length === WINDOW || actions.length === WINDOW,
  };
}

export async function deleteActivity(records: string[], actions: string[]): Promise<number> {
  const [recordResult, actionResult] = await Promise.all([
    records.length === 0
      ? Promise.resolve({ count: 0 })
      : prisma.recordEvent.deleteMany({ where: { id: { in: records } } }),
    actions.length === 0
      ? Promise.resolve({ count: 0 })
      : prisma.projectEvent.deleteMany({ where: { id: { in: actions } } }),
  ]);
  return recordResult.count + actionResult.count;
}

export async function activitySubject(filter: ActivityFilter): Promise<{ projectName: string; ficheName: string }> {
  const [project, ficheName] = await Promise.all([
    filter.projectId
      ? prisma.project.findUnique({ where: { id: filter.projectId }, select: { name: true } })
      : Promise.resolve(null),
    filter.entityId ? ficheNameOf(filter.entityId) : Promise.resolve(""),
  ]);
  return { projectName: project?.name ?? "", ficheName };
}

function recordWhere(filter: ActivityFilter) {
  if (filter.kind === "action") return null;
  if (filter.projectId && filter.kind && filter.kind !== "projet") return null;
  if (filter.projectId && filter.entityId && filter.entityId !== filter.projectId) return null;
  const entityType = entityTypeOf(filter.kind);
  return {
    ...(entityType ? { entityType } : {}),
    ...(filter.projectId ? { entityType: "project", entityId: filter.projectId } : {}),
    ...(filter.entityId ? { entityId: filter.entityId } : {}),
  };
}

function actionWhere(filter: ActivityFilter) {
  if (filter.kind && filter.kind !== "action") return null;
  if (filter.entityId) return null;
  return {
    ...(filter.projectId ? { projectId: filter.projectId } : {}),
  };
}

function entityTypeOf(kind: ActivityKind | ""): string {
  if (kind === "client") return "client";
  if (kind === "fournisseur") return "supplier";
  if (kind === "produit") return "product";
  if (kind === "projet") return "project";
  return "";
}

async function ficheNameOf(id: string): Promise<string> {
  const [client, supplier, product, project] = await Promise.all([
    prisma.client.findUnique({ where: { id }, select: { name: true } }),
    prisma.supplier.findUnique({ where: { id }, select: { name: true } }),
    prisma.product.findUnique({ where: { id }, select: { name: true } }),
    prisma.project.findUnique({ where: { id }, select: { name: true } }),
  ]);
  return client?.name || supplier?.name || product?.name || project?.name || "";
}

function sourceText(source: string): string {
  if (source === "assistant") return "Assistant";
  if (source === "formulaire") return "Formulaire";
  return "Application";
}
