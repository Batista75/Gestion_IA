import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  CLIENT_FIELD_LABELS,
  PARTY_FIELD_LABELS,
  PRODUCT_FIELD_LABELS,
  PROJECT_FIELD_LABELS,
  fieldChangeSummary,
} from "@/domain/record-journal";
import { currentChangeSource } from "@/lib/change-source";
import { currentOperatorMark } from "@/domain/operator";

const LABELS: Record<string, Record<string, string>> = {
  Client: CLIENT_FIELD_LABELS,
  Supplier: PARTY_FIELD_LABELS,
  Product: PRODUCT_FIELD_LABELS,
  Project: PROJECT_FIELD_LABELS,
};

const ENTITY: Record<string, string> = {
  Client: "client",
  Supplier: "supplier",
  Product: "product",
  Project: "project",
};

type Row = { id: string; name: string } & Record<string, unknown>;

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL est absent. Relancez scripts/cloud-agent-start.sh.",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  const base = new PrismaClient({ adapter });
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const labels = LABELS[model];
          const entityType = ENTITY[model];
          if (!labels || !entityType || (operation !== "create" && operation !== "update" && operation !== "delete")) {
            return query(args);
          }
          if (operation === "create") {
            const row = await query(args);
            await writeEvent(base, entityType, "création", asRow(row), "Fiche créée.");
            return row;
          }
          if (operation === "update") {
            const before = await readRow(base, model, args);
            const row = await query(args);
            const after = asRow(row);
            const summary = before && after
              ? fieldChangeSummary(pick(before, labels), pick(after, labels), labels)
              : "";
            if (summary) await writeEvent(base, entityType, "mise à jour", after, summary);
            return row;
          }
          const before = await readRow(base, model, args);
          const row = await query(args);
          await writeEvent(base, entityType, "suppression", before ?? asRow(row), "Fiche supprimée.");
          return row;
        },
      },
    },
  });
}

async function readRow(base: PrismaClient, model: string, args: unknown): Promise<Row | null> {
  if (!args || typeof args !== "object" || !("where" in args)) return null;
  const where = (args as { where?: unknown }).where;
  if (!where || typeof where !== "object" || !("id" in where)) return null;
  const id = (where as { id?: unknown }).id;
  if (typeof id !== "string") return null;
  const delegate = base[model as "client"];
  const row = await delegate.findUnique({ where: { id } });
  return asRow(row);
}

function asRow(value: unknown): Row | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") return null;
  return record as Row;
}

function pick(row: Row, labels: Record<string, string>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of Object.keys(labels)) {
    const value = row[key];
    values[key] = typeof value === "string" ? value : "";
  }
  return values;
}

async function writeEvent(
  base: PrismaClient,
  entityType: string,
  action: string,
  row: Row | null,
  summary: string,
): Promise<void> {
  if (!row?.id || !row.name || !summary) return;
  await base.recordEvent.create({
    data: {
      entityType,
      entityId: row.id,
      entityName: row.name,
      action,
      summary,
      source: currentChangeSource(),
      actor: currentOperatorMark(),
    },
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

function clientKnowsOffers(client: ReturnType<typeof createClient>): boolean {
  return (
    typeof client.supplierOffer?.findMany === "function" &&
    typeof client.contact?.findMany === "function" &&
    typeof client.address?.findMany === "function"
  );
}

function readClient(): ReturnType<typeof createClient> {
  const cached = globalForPrisma.prisma;
  if (cached && clientKnowsOffers(cached)) return cached;
  if (cached) void cached.$disconnect().catch(() => undefined);
  const created = createClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = created;
  return created;
}

export const prisma = readClient();
