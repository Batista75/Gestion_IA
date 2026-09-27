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
import { productOrigin } from "@/domain/catalog";
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
      intro="Le prix indiqué et le coût indiqué restent ceux écrits sur la fiche. Ils ne sont pas recalculés. La saisie et les versions de devis sont sous le tableau."
      basePath="/produits"
      query={{ q: query, source }}
      headers={["Référence", "Désignation", "Famille", "Prix indiqué", "Coût indiqué", "Unité", "Fournisseur", "Date de saisie", "Édition"]}
      rows={products.map((product) => [
        { text: product.reference || "—" },
        { text: product.name },
        { text: product.kind === "service" ? "Service" : "Produit" },
        { text: product.statedPrice || "non indiqué" },
        { text: product.costStated || "non indiqué" },
        { text: product.unit || "—" },
        { text: product.supplier?.name || "—" },
        { text: product.createdAt.toLocaleDateString("fr-FR") },
        { text: "Éditer", href: `/produits?edition=${product.id}${query ? `&q=${encodeURIComponent(query)}` : ""}${source ? `&source=${source}` : ""}#edition` },
      ])}
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
        vatNote: product.vatNote,
        kind: product.kind,
        enteredLabel: product.createdAt.toLocaleDateString("fr-FR"),
        origin: productOrigin(
          product.source,
          product.lines.map((line) => line.quote.title),
        ),
        updatedLabel: product.updatedAt.toLocaleString("fr-FR"),
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
          })),
      }))}
    />
    </div>
  );
}
