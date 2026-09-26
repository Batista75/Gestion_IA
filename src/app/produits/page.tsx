import {
  createProductAction,
  createQuoteAction,
  updateProductAction,
} from "@/app/catalog-actions";
import { ProductManager } from "@/components/product-manager";
import { productOrigin } from "@/domain/catalog";
import { listProducts } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; source?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const source = ["devis", "assistant", "manuel"].includes(params.source ?? "")
    ? (params.source ?? "")
    : "";
  const products = await listProducts(query, source);

  return (
    <ProductManager
      query={query}
      source={source}
      createAction={createProductAction}
      updateAction={updateProductAction}
      quoteAction={createQuoteAction}
      records={products.map((product) => ({
        id: product.id,
        name: product.name,
        reference: product.reference,
        unit: product.unit,
        description: product.description,
        supplierName: product.supplier?.name ?? "",
        origin: productOrigin(
          product.source,
          product.lines.map((line) => line.quote.title),
        ),
        updatedLabel: product.updatedAt.toLocaleString("fr-FR"),
      }))}
    />
  );
}
