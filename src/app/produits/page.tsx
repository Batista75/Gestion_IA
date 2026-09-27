import {
  createProductAction,
  createQuoteAction,
  deleteProductAction,
  deleteQuoteAction,
  updateProductAction,
} from "@/app/catalog-actions";
import { ChangeJournal } from "@/components/change-journal";
import { DataBoard } from "@/components/data-board";
import { ProductManager } from "@/components/product-manager";
import { listRecordEvents } from "@/lib/record-journal";
import { shownUnitCost, writtenCurrency } from "@/domain/article";
import { productOrigin } from "@/domain/catalog";
import { formatOfferCents } from "@/domain/pricing";
import { listProducts } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; source?: string; edition?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const edition = params.edition ?? "";
  const source = ["devis", "assistant", "manuel"].includes(params.source ?? "")
    ? (params.source ?? "")
    : "";
  const [products, journal] = await Promise.all([
    listProducts(query, source),
    listRecordEvents("product", 40),
  ]);

  return (
    <div className="grid gap-6">
    <DataBoard
      title="Liste des articles"
      intro="Un article est un produit ou un service. Le coût affiché est celui de la dernière offre fournisseur. Les autres offres restent sur la fiche, avec le prix écrit et sa valeur en centimes. La source ouvre la pièce d’origine quand elle existe."
      basePath="/produits"
      query={{ q: query, source }}
      headers={["Référence", "Désignation", "Famille", "Coût unitaire", "Devise", "Fournisseur", "Date de saisie", "Source", "Édition"]}
      rows={products.map((product) => {
        const latest = product.offers[0];
        const cost = latest?.statedCost || shownUnitCost(
          product.costStated,
          product.lines.map((line) => line.statedPrice),
        );
        const currency = product.currency.trim() || writtenCurrency(cost);
        const documents = sourceDocuments(product.lines);
        const sourceCell = documents[0]
          ? {
              text: documents.length > 1 ? `${documents[0].name} (+${documents.length - 1})` : documents[0].name,
              href: `/api/pieces/${documents[0].id}`,
              download: true,
            }
          : product.sourceUrl
            ? { text: "Site du fournisseur", href: product.sourceUrl, external: true }
            : { text: product.sourceNote.trim() ? product.sourceNote.trim().slice(0, 80) : "—" };
        return [
        { text: product.reference || "—" },
        { text: product.name },
        { text: product.kind === "service" ? "Service" : "Produit" },
        { text: product.offers.length > 1 ? `${cost || "non indiqué"} · ${product.offers.length} offres` : cost || "non indiqué" },
        { text: currency || "non indiqué" },
        { text: latest?.supplier?.name || latest?.supplierName || product.supplier?.name || "—" },
        { text: product.createdAt.toLocaleDateString("fr-FR") },
        sourceCell,
        { text: "Éditer", href: `/produits?edition=${product.id}${query ? `&q=${encodeURIComponent(query)}` : ""}${source ? `&source=${source}` : ""}#edition` },
      ];
      })}
      empty="Aucun article ne correspond à cette recherche."
      filters={source ? <input type="hidden" name="source" value={source} /> : undefined}
    />
    <ChangeJournal entries={journal.slice(0, 12)} />
    <ProductManager
      query={query}
      source={source}
      showHeading={false}
      showFinder={false}
      edition={edition}
      createAction={createProductAction}
      updateAction={updateProductAction}
      deleteAction={deleteProductAction}
      deleteQuoteAction={deleteQuoteAction}
      quoteAction={createQuoteAction}
      records={products.map((product) => ({
        id: product.id,
        name: product.name,
        reference: product.reference,
        unit: product.unit,
        description: product.description,
        supplierName: product.supplier?.name ?? "",
        statedPrice: product.statedPrice,
        costStated: shownUnitCost(product.costStated, product.lines.map((line) => line.statedPrice)),
        currency: product.currency.trim() || writtenCurrency(shownUnitCost(product.costStated, product.lines.map((line) => line.statedPrice))),
        vatNote: product.vatNote,
        kind: product.kind,
        stockQty: product.stockQty,
        sourceNote: product.sourceNote,
        sourceUrl: product.sourceUrl,
        documents: sourceDocuments(product.lines),
        enteredLabel: product.createdAt.toLocaleDateString("fr-FR"),
        origin: productOrigin(
          product.source,
          product.lines.map((line) => line.quote.title),
        ),
        updatedLabel: product.updatedAt.toLocaleString("fr-FR"),
        offers: product.offers.map((offer) => ({
          id: offer.id,
          supplierName: offer.supplier?.name || offer.supplierName,
          statedCost: offer.statedCost,
          centsLabel: offer.unitCostCents === null ? "" : formatOfferCents(offer.unitCostCents, offer.currency),
          fileId: offer.sourceFile?.id ?? "",
          fileName: offer.sourceFile?.originalName ?? "",
          sourceUrl: offer.sourceUrl,
          at: offer.createdAt.toLocaleString("fr-FR"),
        })),
        versions: [...product.lines]
          .sort((left, right) => right.quote.createdAt.getTime() - left.quote.createdAt.getTime())
          .map((line) => ({
            id: line.id,
            quoteId: line.quoteId,
            quoteTitle: line.quote.title,
            versionLabel: line.quote.versionLabel,
            issuedOn: line.quote.issuedOn,
            supplierName: line.quote.supplierName,
            statedPrice: line.statedPrice,
            conditions: line.conditions,
            fileId: line.quote.file?.id ?? "",
            fileName: line.quote.file?.originalName ?? "",
          })),
      }))}
    />
    </div>
  );
}

function sourceDocuments(
  lines: Array<{ quote: { file: { id: string; originalName: string } | null } }>,
): Array<{ id: string; name: string }> {
  const seen = new Set<string>();
  const documents: Array<{ id: string; name: string }> = [];
  for (const line of lines) {
    const file = line.quote.file;
    if (!file || seen.has(file.id)) continue;
    seen.add(file.id);
    documents.push({ id: file.id, name: file.originalName || "document" });
  }
  return documents;
}
