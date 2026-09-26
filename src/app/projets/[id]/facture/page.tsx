import Link from "next/link";
import { notFound } from "next/navigation";
import { CommercialSheet } from "@/components/commercial-sheet";
import { PrintButton } from "@/components/print-button";
import { buttonVariants } from "@/components/ui/button";
import { sheetHeading } from "@/domain/company";
import { deliveryFromRecord, deliverySummary } from "@/domain/delivery";
import { formatCents, saleLineFigures, saleOperationTotals } from "@/domain/pricing";
import { loadCompany } from "@/lib/company-store";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      steps: true,
      sales: {
        where: { kind: "commande_client" },
        orderBy: { createdAt: "desc" },
        include: { lines: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!project) notFound();
  const [company, client] = await Promise.all([
    loadCompany(),
    prisma.client.findFirst({
      where: { name: { equals: project.primaryClient, mode: "insensitive" } },
    }),
  ]);
  const order = project.sales[0] ?? null;
  const proof = (key: string) => project.steps.find((step) => step.stepKey === key)?.proofRef ?? "";
  const invoiceRef = proof("facturation");
  const figures = (order?.lines ?? []).map((line) => saleLineFigures(line));
  const totals = saleOperationTotals(figures);
  const partyLines = [
    client?.address,
    [client?.postalCode, client?.city].filter(Boolean).join(" "),
    client?.country,
    client?.email,
    client?.phone,
  ].filter((line): line is string => Boolean(line));
  const notes = [
    invoiceRef
      ? `Référence de facture enregistrée : ${invoiceRef}. L’application ne lui donne pas de numéro.`
      : "Référence de facture non enregistrée. Indiquez-la sur le parcours, à l’étape Facturation. L’application ne lui donne pas de numéro.",
    proof("engagement") ? `Bon de commande ${proof("engagement")}.` : "Bon de commande non encore enregistré.",
    proof("livraison") ? `Bon de livraison ${proof("livraison")}.` : "",
    proof("reception") ? `Procès-verbal ${proof("reception")}.` : "",
    order ? `Lignes reprises de ${order.title}.` : "Aucune commande client n’est encore ouverte sur ce dossier.",
    "Montants hors taxes. La TVA n’est pas appliquée sur cette présentation.",
  ].filter(Boolean);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/projets/${project.id}`} className={cn(buttonVariants({ variant: "outline" }), "min-h-11 px-4")}>
          Retour au dossier
        </Link>
        <PrintButton />
      </div>
      <CommercialSheet
        heading={sheetHeading("facture")}
        title={invoiceRef || "Référence non enregistrée"}
        dateLabel={(order?.createdAt ?? project.createdAt).toLocaleDateString("fr-FR")}
        dossier={project.name}
        company={company}
        partyRole="Client"
        partyName={project.primaryClient}
        partyLines={partyLines}
        lines={(order?.lines ?? []).map((line, index) => ({
          name: line.name,
          kind: line.kind,
          quantity: line.quantity,
          unitLabel: formatCents(figures[index]?.unitNetCents ?? null),
          amountLabel: formatCents(figures[index]?.lineNetCents ?? null),
        }))}
        totalLabel={`Total HT ${formatCents(totals.missing > 0 ? null : totals.netCents)}`}
        deliveryLines={deliverySummary(deliveryFromRecord(project))}
        notes={notes}
      />
    </div>
  );
}
