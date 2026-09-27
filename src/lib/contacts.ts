import { contactLabel, readExtraContact, splitContactName } from "@/domain/contact";
import { prisma } from "@/lib/db";

export async function syncPrimaryContact(input: {
  clientId?: string | null;
  supplierId?: string | null;
  fullName: string;
  role: string;
  email: string;
  phone: string;
}): Promise<void> {
  const clientId = input.clientId || null;
  const supplierId = clientId ? null : input.supplierId || null;
  if (!clientId && !supplierId) return;
  const { firstName, lastName } = splitContactName(input.fullName);
  const role = input.role.trim().slice(0, 80);
  const email = input.email.trim().slice(0, 160);
  const phone = input.phone.trim().slice(0, 40);
  if (!firstName && !lastName && !role && !email && !phone) return;
  const existing = await prisma.contact.findFirst({
    where: { isPrimary: true, ...(clientId ? { clientId } : { supplierId }) },
    orderBy: { createdAt: "asc" },
  });
  const data = { firstName, lastName, role, email, phone, isPrimary: true, clientId, supplierId };
  if (existing) {
    await prisma.contact.update({ where: { id: existing.id }, data });
    return;
  }
  await prisma.contact.create({ data });
}

export async function addExtraContact(input: {
  clientId?: string | null;
  supplierId?: string | null;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
}): Promise<{ ok: boolean; summary: string }> {
  const clientId = input.clientId || null;
  const supplierId = clientId ? null : input.supplierId || null;
  if (!clientId && !supplierId) return { ok: false, summary: "La fiche de l’interlocuteur est introuvable." };
  const parsed = readExtraContact(input);
  if (!parsed.ok) return { ok: false, summary: parsed.error };
  if (clientId) {
    const parent = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!parent) return { ok: false, summary: "Ce client est introuvable." };
  } else if (supplierId) {
    const parent = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
    if (!parent) return { ok: false, summary: "Ce fournisseur est introuvable." };
  }
  await prisma.contact.create({
    data: { ...parsed.value, isPrimary: false, clientId, supplierId },
  });
  const label = contactLabel(parsed.value);
  return { ok: true, summary: `Interlocuteur « ${label} » ajouté.` };
}
