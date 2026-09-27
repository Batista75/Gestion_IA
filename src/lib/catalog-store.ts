import { revalidatePath } from "next/cache";
import {
  nameKey,
  validateParty,
  validateProduct,
  type CatalogCommand,
  type PartyInput,
  type ProductInput,
} from "@/domain/catalog";
import { ensureSpokenProject } from "@/lib/business-records";
import { prisma } from "@/lib/db";

export type ActionResult = { ok: boolean; summary: string };

const PATHS = [
  "/",
  "/projets",
  "/clients",
  "/fournisseurs",
  "/produits",
  "/achats",
  "/ventes",
];

export async function listClients(query: string) {
  return prisma.client.findMany({
    where: partyWhere(query),
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

export async function listSuppliers(query: string) {
  return prisma.supplier.findMany({
    where: partyWhere(query),
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

export async function listProducts(query: string, source: string) {
  const q = query.trim();
  return prisma.product.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { reference: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(source === "devis" ? { lines: { some: {} } } : {}),
      ...(source === "manuel" || source === "assistant" ? { source } : {}),
    },
    include: {
      supplier: true,
      lines: { include: { quote: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

export async function applyCatalogCommand(
  command: CatalogCommand,
): Promise<ActionResult> {
  const result = await dispatch(command);
  if (result.ok) {
    for (const path of PATHS) revalidatePath(path);
  }
  return result;
}

export async function saveClientForm(
  id: string | null,
  input: PartyInput,
): Promise<ActionResult> {
  const result = id
    ? await updatePartyById("client", id, input)
    : await createParty("client", input);
  if (result.ok) {
    for (const path of PATHS) revalidatePath(path);
  }
  return result;
}

export async function saveSupplierForm(
  id: string | null,
  input: PartyInput,
): Promise<ActionResult> {
  const result = id
    ? await updatePartyById("supplier", id, input)
    : await createParty("supplier", input);
  if (result.ok) {
    for (const path of PATHS) revalidatePath(path);
  }
  return result;
}

export async function saveProductForm(
  id: string | null,
  input: ProductInput,
  stockQty?: number | null,
): Promise<ActionResult> {
  const result = id
    ? await updateProductById(id, input)
    : await createProduct(input, "manuel");
  if (result.ok && stockQty !== undefined) {
    await prisma.product.updateMany({
      where: { nameKey: nameKey(input.name) },
      data: { stockQty },
    });
  }
  if (result.ok) {
    for (const path of PATHS) revalidatePath(path);
  }
  return result;
}

export async function saveQuoteForm(input: {
  title: string;
  productsText: string;
  supplierName: string;
}): Promise<ActionResult> {
  const names = input.productsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const result = await dispatch({
    type: "record_quote",
    title: input.title,
    products: names.map((name) => ({
      name,
      reference: "",
      unit: "",
      description: "",
      supplierName: input.supplierName,
    })),
  });
  if (result.ok) {
    for (const path of PATHS) revalidatePath(path);
  }
  return result;
}

async function dispatch(command: CatalogCommand): Promise<ActionResult> {
  switch (command.type) {
    case "create_client":
      return createParty("client", command.party);
    case "update_client":
      return patchParty("client", command.party);
    case "create_supplier":
      return createParty("supplier", command.party);
    case "update_supplier":
      return patchParty("supplier", command.party);
    case "create_product":
      return createProduct(command.product, "assistant");
    case "update_product":
      return patchProduct(command.product);
    case "create_project":
      return createProject(command);
    case "record_quote":
      return recordQuote(command.title, command.products);
  }
}

async function createParty(
  kind: "client" | "supplier",
  input: PartyInput,
): Promise<ActionResult> {
  const parsed = validateParty(input);
  if (!parsed.ok) return { ok: false, summary: parsed.error };
  const key = nameKey(parsed.value.name);
  const existing = await findParty(kind, key);
  const label = kind === "client" ? "client" : "fournisseur";
  if (existing) {
    return {
      ok: true,
      summary: `Le ${label} « ${existing.name} » existe déjà.`,
    };
  }
  await createPartyRow(kind, parsed.value, key);
  return { ok: true, summary: `${capitalize(label)} « ${parsed.value.name} » créé.` };
}

async function patchParty(
  kind: "client" | "supplier",
  input: PartyInput,
): Promise<ActionResult> {
  const name = input.name.trim();
  if (name.length < 2) {
    return { ok: false, summary: "Indiquez le nom du compte à modifier." };
  }
  const existing = await findParty(kind, nameKey(name));
  const label = kind === "client" ? "client" : "fournisseur";
  if (!existing) {
    return { ok: false, summary: `Aucun ${label} « ${name} ».` };
  }
  const merged: PartyInput = {
    name: existing.name,
    siren: input.siren.trim() || existing.siren,
    email: input.email.trim() || existing.email,
    phone: input.phone.trim() || existing.phone,
    address: input.address.trim() || existing.address,
    notes: input.notes.trim() || existing.notes,
  };
  return updatePartyById(kind, existing.id, merged);
}

async function updatePartyById(
  kind: "client" | "supplier",
  id: string,
  input: PartyInput,
): Promise<ActionResult> {
  const parsed = validateParty(input);
  if (!parsed.ok) return { ok: false, summary: parsed.error };
  const key = nameKey(parsed.value.name);
  const clash = await findParty(kind, key);
  if (clash && clash.id !== id) {
    const label = kind === "client" ? "client" : "fournisseur";
    return { ok: false, summary: `Un ${label} porte déjà le nom « ${clash.name} ».` };
  }
  const data = { ...parsed.value, nameKey: key };
  if (kind === "client") {
    await prisma.client.update({ where: { id }, data });
  } else {
    await prisma.supplier.update({ where: { id }, data });
  }
  const label = kind === "client" ? "Client" : "Fournisseur";
  return { ok: true, summary: `${label} « ${parsed.value.name} » mis à jour.` };
}

async function createProduct(
  input: ProductInput,
  source: "manuel" | "assistant" | "devis",
): Promise<ActionResult> {
  const parsed = validateProduct(input);
  if (!parsed.ok) return { ok: false, summary: parsed.error };
  const key = nameKey(parsed.value.name);
  const existing = await prisma.product.findUnique({ where: { nameKey: key } });
  if (existing) {
    return { ok: true, summary: `Le produit « ${existing.name} » est déjà au catalogue.` };
  }
  const supplierId = await ensureSupplier(parsed.value.supplierName);
  await prisma.product.create({
    data: {
      name: parsed.value.name,
      nameKey: key,
      reference: parsed.value.reference,
      unit: parsed.value.unit,
      description: parsed.value.description,
      source,
      supplierId,
    },
  });
  return { ok: true, summary: `Produit « ${parsed.value.name} » ajouté au catalogue.` };
}

async function patchProduct(input: ProductInput): Promise<ActionResult> {
  const name = input.name.trim();
  if (name.length < 2) {
    return { ok: false, summary: "Indiquez le produit à modifier." };
  }
  const existing = await prisma.product.findUnique({
    where: { nameKey: nameKey(name) },
  });
  if (!existing) return { ok: false, summary: `Aucun produit « ${name} ».` };
  return updateProductById(existing.id, {
    name: existing.name,
    reference: input.reference.trim() || existing.reference,
    unit: input.unit.trim() || existing.unit,
    description: input.description.trim() || existing.description,
    supplierName: input.supplierName.trim(),
  }, Boolean(input.supplierName.trim()));
}

async function updateProductById(
  id: string,
  input: ProductInput,
  changeSupplier = true,
): Promise<ActionResult> {
  const parsed = validateProduct(input);
  if (!parsed.ok) return { ok: false, summary: parsed.error };
  const key = nameKey(parsed.value.name);
  const clash = await prisma.product.findUnique({ where: { nameKey: key } });
  if (clash && clash.id !== id) {
    return { ok: false, summary: `Un produit porte déjà le nom « ${clash.name} ».` };
  }
  const supplierId = changeSupplier
    ? await ensureSupplier(parsed.value.supplierName)
    : undefined;
  await prisma.product.update({
    where: { id },
    data: {
      name: parsed.value.name,
      nameKey: key,
      reference: parsed.value.reference,
      unit: parsed.value.unit,
      description: parsed.value.description,
      ...(supplierId !== undefined ? { supplierId } : {}),
    },
  });
  return { ok: true, summary: `Produit « ${parsed.value.name} » mis à jour.` };
}

async function createProject(
  command: Extract<CatalogCommand, { type: "create_project" }>,
): Promise<ActionResult> {
  const saved = await ensureSpokenProject({
    name: command.name,
    primaryClient: command.primaryClient,
    nextAction: command.nextAction,
  });
  return { ok: saved.ok, summary: saved.summary };
}

async function recordQuote(
  title: string,
  products: ProductInput[],
): Promise<ActionResult> {
  const quoteTitle = title.trim().replace(/\s+/g, " ");
  if (quoteTitle.length < 2) {
    return { ok: false, summary: "Indiquez le titre du devis." };
  }
  if (products.length === 0) {
    return { ok: false, summary: "Indiquez au moins un produit du devis." };
  }
  try {
    const names = await prisma.$transaction(async (tx) => {
      const collected: string[] = [];
      const existingQuote = await tx.quote.findFirst({
        where: { title: quoteTitle },
        orderBy: { createdAt: "desc" },
      });
      const quote =
        existingQuote ??
        (await tx.quote.create({ data: { title: quoteTitle } }));
      for (const input of products) {
        const parsed = validateProduct(input);
        if (!parsed.ok) throw new Error(parsed.error);
        const key = nameKey(parsed.value.name);
        let product = await tx.product.findUnique({ where: { nameKey: key } });
        const supplierId = await ensureSupplier(parsed.value.supplierName, tx);
        if (!product) {
          product = await tx.product.create({
            data: {
              name: parsed.value.name,
              nameKey: key,
              reference: parsed.value.reference,
              unit: parsed.value.unit || "u",
              description: parsed.value.description,
              source: "devis",
              supplierId,
            },
          });
        } else if (supplierId && !product.supplierId) {
          product = await tx.product.update({
            where: { id: product.id },
            data: { supplierId },
          });
        }
        const linked = await tx.quoteLine.findFirst({
          where: { quoteId: quote.id, productId: product.id },
        });
        if (!linked) {
          await tx.quoteLine.create({
            data: { quoteId: quote.id, productId: product.id },
          });
        }
        collected.push(product.name);
      }
      return collected;
    });
    return {
      ok: true,
      summary: `Devis « ${quoteTitle} » enregistré. Produits au catalogue : ${names.join(", ")}.`,
    };
  } catch (error) {
    return {
      ok: false,
      summary:
        error instanceof Error
          ? error.message
          : "Le devis n’a pas été enregistré.",
    };
  }
}

async function ensureSupplier(
  name: string,
  tx: Pick<typeof prisma, "supplier"> | Parameters<Parameters<typeof prisma.$transaction>[0]>[0] = prisma,
): Promise<string | null> {
  const trimmed = name.trim();
  if (trimmed.length < 2) return null;
  const key = nameKey(trimmed);
  const existing = await tx.supplier.findUnique({ where: { nameKey: key } });
  if (existing) return existing.id;
  const created = await tx.supplier.create({
    data: { name: trimmed, nameKey: key },
  });
  return created.id;
}

function findParty(kind: "client" | "supplier", key: string) {
  if (kind === "client") {
    return prisma.client.findUnique({ where: { nameKey: key } });
  }
  return prisma.supplier.findUnique({ where: { nameKey: key } });
}

function createPartyRow(kind: "client" | "supplier", input: PartyInput, key: string) {
  const data = { ...input, nameKey: key };
  if (kind === "client") return prisma.client.create({ data });
  return prisma.supplier.create({ data });
}

function partyWhere(query: string) {
  const q = query.trim();
  if (!q) return undefined;
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { email: { contains: q, mode: "insensitive" as const } },
      { siren: { contains: q } },
    ],
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
