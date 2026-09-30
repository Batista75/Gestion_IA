import { inboxAttentionLabel } from "@/domain/inbox-entry";
import { homeMoneyLabel, storedSaleFigures } from "@/domain/pricing";
import { prisma } from "@/lib/db";

export type HomeProjectCard = {
  id: string;
  name: string;
  client: string;
  status: string;
  nextAction: string;
  quoted: string;
  cost: string;
  margin: string;
};

export type HomeAlert = { text: string; href: string };

export async function recentProjectCards(): Promise<HomeProjectCard[]> {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      sales: {
        where: { kind: "devis", status: { not: "non_abouti" } },
        include: { lines: true },
      },
    },
  });
  return projects.map((project) => {
    const lines = project.sales.flatMap((document) => document.lines);
    const money = homeMoneyLabel(
      lines.map((line) => {
        try {
          return storedSaleFigures(line);
        } catch {
          return {
            unitNetCents: null,
            unitListCents: null,
            lineCostCents: null,
            lineNetCents: null,
            lineMarginCents: null,
          };
        }
      }),
    );
    return {
      id: project.id,
      name: project.name,
      client: project.primaryClient,
      status: project.status,
      nextAction: project.nextAction,
      quoted: money.quoted,
      cost: money.cost,
      margin: money.margin,
    };
  });
}

export async function homeAlerts(): Promise<HomeAlert[]> {
  const [pending, openEntries, drafts] = await Promise.all([
    prisma.documentProposal.count({ where: { status: "en_attente" } }),
    prisma.inboxItem.count({ where: { status: { in: ["a_traiter", "proposee"] } } }),
    prisma.saleDocument.count({ where: { kind: "devis", status: "brouillon" } }),
  ]);
  const alerts: HomeAlert[] = [];
  if (pending > 0) {
    alerts.push({
      text: pending === 1 ? "1 document attend une confirmation." : `${pending} documents attendent une confirmation.`,
      href: "/#a-traiter",
    });
  }
  const entryAlert = inboxAttentionLabel(openEntries);
  if (entryAlert) {
    alerts.push({ text: entryAlert, href: "/#pieces" });
  }
  if (drafts > 0) {
    alerts.push({
      text: drafts === 1 ? "1 devis est encore en brouillon." : `${drafts} devis sont encore en brouillon.`,
      href: "/suivi",
    });
  }
  return alerts;
}
