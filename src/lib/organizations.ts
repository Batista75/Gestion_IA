import { nameKey } from "@/domain/catalog";
import { prisma } from "@/lib/db";

export async function attachOrganization(input: {
  kind: "client" | "supplier";
  id: string;
  name: string;
}): Promise<void> {
  const key = nameKey(input.name);
  if (!key) return;
  const current = input.kind === "client"
    ? await prisma.client.findUnique({ where: { id: input.id }, select: { organizationId: true } })
    : await prisma.supplier.findUnique({ where: { id: input.id }, select: { organizationId: true } });
  if (!current) return;
  const previousId = current.organizationId;
  const found = await prisma.organization.findUnique({ where: { nameKey: key } });
  const org = found
    ? found.name === input.name
      ? found
      : await prisma.organization.update({ where: { id: found.id }, data: { name: input.name } })
    : await prisma.organization.create({ data: { name: input.name, nameKey: key } });
  if (previousId !== org.id) {
    if (input.kind === "client") {
      await prisma.client.update({ where: { id: input.id }, data: { organizationId: org.id } });
    } else {
      await prisma.supplier.update({ where: { id: input.id }, data: { organizationId: org.id } });
    }
  }
  if (previousId && previousId !== org.id) await releaseOrganization(previousId);
}

export async function releaseOrganization(id: string | null | undefined): Promise<void> {
  if (!id) return;
  const [clients, suppliers] = await Promise.all([
    prisma.client.count({ where: { organizationId: id } }),
    prisma.supplier.count({ where: { organizationId: id } }),
  ]);
  if (clients + suppliers === 0) {
    await prisma.organization.delete({ where: { id } }).catch(() => undefined);
  }
}
