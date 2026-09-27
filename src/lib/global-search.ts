import { prisma } from "@/lib/db";

export type SearchGroup = { title: string; rows: Array<{ label: string; href: string }> };

export async function searchAll(query: string): Promise<SearchGroup[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const contains = { contains: q, mode: "insensitive" as const };
  const [projects, clients, suppliers, products, quotes, sales, files] = await Promise.all([
    prisma.project.findMany({
      where: { OR: [{ name: contains }, { primaryClient: contains }, { reference: contains }] },
      take: 8,
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({ where: { name: contains }, take: 8, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { name: contains }, take: 8, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { OR: [{ name: contains }, { reference: contains }] },
      take: 8,
      orderBy: { name: "asc" },
    }),
    prisma.quote.findMany({ where: { title: contains }, take: 8, orderBy: { createdAt: "desc" } }),
    prisma.saleDocument.findMany({
      where: { title: contains },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { project: true },
    }),
    prisma.storedFile.findMany({
      where: { originalName: contains },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return [
    { title: "Projets", rows: projects.map((row) => ({ label: row.name, href: `/projets/${row.id}` })) },
    { title: "Clients", rows: clients.map((row) => ({ label: row.name, href: `/clients?q=${encodeURIComponent(row.name)}` })) },
    { title: "Fournisseurs", rows: suppliers.map((row) => ({ label: row.name, href: `/fournisseurs?q=${encodeURIComponent(row.name)}` })) },
    {
      title: "Produits et services",
      rows: products.map((row) => ({ label: row.reference ? `${row.reference} · ${row.name}` : row.name, href: `/produits?q=${encodeURIComponent(row.name)}` })),
    },
    { title: "Devis reçus", rows: quotes.map((row) => ({ label: row.title, href: "/listes/documents" })) },
    {
      title: "Pièces de vente",
      rows: sales.map((row) => ({ label: `${row.title} · ${row.project.name}`, href: `/projets/${row.projectId}/documents/${row.id}` })),
    },
    { title: "Documents", rows: files.map((row) => ({ label: row.originalName, href: `/api/pieces/${row.id}` })) },
  ].filter((group) => group.rows.length > 0);
}
