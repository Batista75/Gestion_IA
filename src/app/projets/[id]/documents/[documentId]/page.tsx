import Link from "next/link";
import { notFound } from "next/navigation";
import { CommercialSheet } from "@/components/commercial-sheet";
import { PrintButton } from "@/components/print-button";
import { buttonVariants } from "@/components/ui/button";
import { sheetBuys, sheetHeading } from "@/domain/company";
import { deliveryFromRecord, deliverySummary } from "@/domain/delivery";
import { formatCents, saleOperationTotals, storedSaleFigures } from "@/domain/pricing";
import { notedPieceLabel } from "@/domain/noted-piece";
import { saleKindLabel } from "@/domain/sale-line";
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
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      project: true,
      parent: { select: { id: true, kind: true, title: true } },
      children: { select: { id: true, kind: true, title: true }, orderBy: { createdAt: "asc" } },
      notedPieces: {
        where: { pieceParentId: null },
        orderBy: { createdAt: "asc" },
        include: {
          children: {
            orderBy: { createdAt: "asc" },
            include: { children: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
    },
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
      {document.parent ? (
        <p className="text-sm print:hidden">
          Issue de{" "}
          <Link href={`/projets/${document.projectId}/documents/${document.parent.id}`} className="font-medium underline-offset-4 hover:underline">
            {saleKindLabel(document.parent.kind)} · {document.parent.title}
          </Link>
        </p>
      ) : null}
      {document.notedPieces.length > 0 ? (
        <ul className="grid gap-1 text-sm print:hidden">
          {document.notedPieces.map((piece) => (
            <li key={piece.id}>
              {notedPieceLabel(piece.kind)} · {piece.reference}
              <span className="text-muted-foreground"> · référence recopiée, sans numéro attribué</span>
              {piece.children.length > 0 ? (
                <ul className="mt-1 grid gap-1 pl-4">
                  {piece.children.map((child) => (
                    <li key={child.id}>
                      {notedPieceLabel(child.kind)} · {child.reference}
                      {child.children.length > 0
                        ? ` · ${child.children.map((grandchild) => `${notedPieceLabel(grandchild.kind)} ${grandchild.reference}`).join(", ")}`
                        : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {document.children.length > 0 ? (
        <ul className="grid gap-1 text-sm print:hidden">
          {document.children.map((child) => (
            <li key={child.id}>
              A donné{" "}
              <Link href={`/projets/${document.projectId}/documents/${child.id}`} className="font-medium underline-offset-4 hover:underline">
                {saleKindLabel(child.kind)} · {child.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
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
