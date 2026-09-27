import Link from "next/link";
import { notFound } from "next/navigation";
import { CommercialSheet } from "@/components/commercial-sheet";
import { PrintButton } from "@/components/print-button";
import { buttonVariants } from "@/components/ui/button";
import { sheetBuys, sheetHeading } from "@/domain/company";
import { deliveryFromRecord, deliverySummary } from "@/domain/delivery";
import { formatCents, saleOperationTotals, storedSaleFigures } from "@/domain/pricing";
import { loadCompany } from "@/lib/company-store";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SaleDocumentPage({
  params,
}: {
  params: Promise<{ id: string; documentId: string }>;
}) {
  const { id, documentId } = await params;
  const document = await prisma.saleDocument.findFirst({
    where: { id: documentId, projectId: id },
    include: { lines: { orderBy: { createdAt: "asc" } }, project: true },
  });
  if (!document) notFound();
  const buys = sheetBuys(document.kind);
  const [company, client, supplier] = await Promise.all([
    loadCompany(),
    buys
      ? Promise.resolve(null)
      : prisma.client.findFirst({
          where: { name: { equals: document.project.primaryClient, mode: "insensitive" } },
        }),
    buys
      ? prisma.supplier.findFirst({
          where: { name: { equals: document.supplierName, mode: "insensitive" } },
        })
      : Promise.resolve(null),
  ]);
  const figures = document.lines.map((line) => storedSaleFigures(line));
  const totals = saleOperationTotals(figures);
  const partyLines = buys
    ? [supplier?.address, supplier?.email, supplier?.phone].filter((line): line is string => Boolean(line))
    : [
        client?.address,
        [client?.postalCode, client?.city].filter(Boolean).join(" "),
        client?.country,
        client?.email,
        client?.phone,
      ].filter((line): line is string => Boolean(line));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/projets/${document.projectId}`} className={cn(buttonVariants({ variant: "outline" }), "min-h-11 px-4")}>
          Retour au dossier
        </Link>
        <PrintButton />
      </div>
      {!company.legalName ? (
        <p className="text-sm print:hidden">
          La raison sociale et le logo se saisissent dans{" "}
          <Link href="/configuration" className="font-medium underline-offset-4 hover:underline">
            Configuration
          </Link>
          .
        </p>
      ) : null}
      <CommercialSheet
        heading={sheetHeading(document.kind)}
        title={document.title}
        dateLabel={document.createdAt.toLocaleDateString("fr-FR")}
        dossier={document.project.name}
        company={company}
        partyRole={buys ? "Fournisseur" : "Client"}
        partyName={buys ? document.supplierName || "Fournisseur non nommé" : document.project.primaryClient}
        partyLines={partyLines}
        lines={document.lines.map((line, index) => ({
          name: line.name,
          kind: line.kind,
          quantity: line.quantity,
          unitLabel: formatCents(buys ? line.costCents : figures[index]?.unitNetCents ?? null),
          amountLabel: formatCents(buys ? figures[index]?.lineCostCents ?? null : figures[index]?.lineNetCents ?? null),
        }))}
        totalLabel={`Total HT ${formatCents(buys ? (totals.missing > 0 ? null : totals.costCents) : totals.missing > 0 ? null : totals.netCents)}`}
        deliveryLines={deliverySummary(deliveryFromRecord(document.project))}
        notes={[
          "Montants hors taxes. La TVA n’est pas appliquée sur cette présentation.",
          buys
            ? "Cette commande reprend le coût d’achat des lignes. Elle ne montre pas le prix de vente."
            : "Cette pièce reprend le prix de vente HT déjà calculé sur le dossier. Elle n’a pas de numéro attribué par l’application.",
        ]}
      />
    </div>
  );
}
