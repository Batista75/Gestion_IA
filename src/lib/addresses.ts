import { formatAddress, readExtraAddress } from "@/domain/address";
import { prisma } from "@/lib/db";

export async function syncPrimaryAddress(input: {
  clientId?: string | null;
  supplierId?: string | null;
  line: string;
  postalCode: string;
  city: string;
  country: string;
}): Promise<void> {
  const clientId = input.clientId || null;
  const supplierId = clientId ? null : input.supplierId || null;
  if (!clientId && !supplierId) return;
  const line = input.line.trim().slice(0, 300);
  const postalCode = input.postalCode.trim().slice(0, 20);
  const city = input.city.trim().slice(0, 80);
  const country = input.country.trim().slice(0, 80);
  if (!line && !postalCode && !city && !country) return;
  const existing = await prisma.address.findFirst({
    where: { isPrimary: true, ...(clientId ? { clientId } : { supplierId }) },
    orderBy: { createdAt: "asc" },
  });
  const data = { kind: "siege", line, postalCode, city, country, isPrimary: true, clientId, supplierId };
  if (existing) {
    await prisma.address.update({ where: { id: existing.id }, data });
    return;
  }
  await prisma.address.create({ data });
}

export async function addExtraAddress(input: {
  clientId?: string | null;
  supplierId?: string | null;
  kind: string;
  line: string;
  postalCode: string;
  city: string;
  country: string;
}): Promise<{ ok: boolean; summary: string }> {
  const clientId = input.clientId || null;
  const supplierId = clientId ? null : input.supplierId || null;
  if (!clientId && !supplierId) return { ok: false, summary: "La fiche de l’adresse est introuvable." };
  const parsed = readExtraAddress(input);
  if (!parsed.ok) return { ok: false, summary: parsed.error };
  if (clientId) {
    const parent = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!parent) return { ok: false, summary: "Ce client est introuvable." };
  } else if (supplierId) {
    const parent = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
    if (!parent) return { ok: false, summary: "Ce fournisseur est introuvable." };
  }
  await prisma.address.create({
    data: { ...parsed.value, isPrimary: false, clientId, supplierId },
  });
  const label = formatAddress(parsed.value);
  return { ok: true, summary: `Adresse « ${label} » ajoutée.` };
}
