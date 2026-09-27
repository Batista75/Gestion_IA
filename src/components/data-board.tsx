import type { ReactNode } from "react";
import Link from "next/link";
import { PAGE_SIZES, pageOf, pageSizeOf, slicePage } from "@/domain/board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Cell } from "@/lib/commercial-board";

export function DataBoard({
  title,
  intro,
  basePath,
  query,
  headers,
  rows,
  empty,
  filters,
  exportView,
}: {
  title: string;
  intro?: string;
  basePath: string;
  query: Record<string, string | undefined>;
  headers: string[];
  rows: Cell[][];
  empty: string;
  filters?: ReactNode;
  exportView?: string;
}) {
  const size = pageSizeOf(query.taille);
  const window = slicePage(rows, pageOf(query.page), size);
  const kept = Object.entries(query).filter(([key, value]) => key !== "page" && value);
  const params = new URLSearchParams();
  for (const [key, value] of kept) params.set(key, value ?? "");
  const exportParams = new URLSearchParams(params);
  if (exportView) exportParams.set("vue", exportView);
  const pageHref = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    next.set("taille", String(size));
    return `${basePath}?${next.toString()}`;
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {intro ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{intro}</p> : null}
        </div>
        {exportView ? (
          <a
            href={`/api/tableaux?${exportParams.toString()}`}
            className="inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
          >
            Exporter CSV
          </a>
        ) : null}
      </div>
      <form action={basePath} className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Recherche
          <Input name="q" defaultValue={query.q ?? ""} placeholder="Rechercher" className="h-11 sm:w-64" />
        </label>
        {filters}
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Lignes
          <select name="taille" defaultValue={String(size)} className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground">
            {PAGE_SIZES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline" className="min-h-11 px-4">
          Filtrer
        </Button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left text-xs tracking-wide text-muted-foreground uppercase">
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {window.rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-3 py-6 text-muted-foreground">
                  {empty}
                </td>
              </tr>
            ) : (
              window.rows.map((row, index) => (
                <tr key={`${row[0]?.text ?? "ligne"}-${index}`} className="border-b border-border last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td key={`${headers[cellIndex] ?? cellIndex}`} className="px-3 py-2 align-top">
                      {cell.href && (cell.download || cell.external) ? (
                        <a
                          href={cell.href}
                          target={cell.external ? "_blank" : undefined}
                          rel={cell.external ? "noreferrer noopener" : undefined}
                          className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline"
                        >
                          {cell.text}
                        </a>
                      ) : cell.href ? (
                        <Link href={cell.href} className="font-medium underline-offset-4 hover:underline">
                          {cell.text}
                        </Link>
                      ) : (
                        cell.text
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          {rows.length === 0
            ? "0 ligne"
            : `${(window.page - 1) * size + 1}–${(window.page - 1) * size + window.rows.length} sur ${rows.length}`}
        </span>
        {window.page > 1 ? (
          <Link href={pageHref(window.page - 1)} className="underline-offset-4 hover:underline">
            Précédent
          </Link>
        ) : null}
        {window.page < window.pages ? (
          <Link href={pageHref(window.page + 1)} className="underline-offset-4 hover:underline">
            Suivant
          </Link>
        ) : null}
      </p>
    </section>
  );
}
