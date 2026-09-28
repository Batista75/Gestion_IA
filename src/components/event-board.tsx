"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { deleteEventsAction, type EventDeleteState } from "@/app/evenements/actions";
import { ACTIVITY_KINDS, eventsQuery, type ActivityFilter } from "@/domain/activity";
import type { ActivityRow } from "@/lib/activity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const emptyState: EventDeleteState = { message: null, ok: false };

export function EventBoard({
  rows,
  filter,
  truncated,
}: {
  rows: ActivityRow[];
  filter: ActivityFilter;
  truncated: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState(deleteEventsAction, emptyState);
  const chosen = rows.filter((row) => selected.has(row.token));
  const allChecked = rows.length > 0 && chosen.length === rows.length;
  const someChecked = chosen.length > 0 && !allChecked;
  const cleared = eventsQuery({ ...filter, text: "", kind: "" });
  const filtering = Boolean(filter.text || filter.kind);

  function toggleAll(on: boolean) {
    setSelected(on ? new Set(rows.map((row) => row.token)) : new Set());
  }

  function toggle(token: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(token);
      else next.delete(token);
      return next;
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <form method="get" className="flex shrink-0 flex-wrap items-end gap-2">
        {filter.projectId ? <input type="hidden" name="projet" value={filter.projectId} /> : null}
        {filter.entityId ? <input type="hidden" name="fiche" value={filter.entityId} /> : null}
        <div className="grid min-w-0 flex-1 gap-1">
          <label htmlFor="evenement-q" className="text-sm font-medium">
            Recherche
          </label>
          <Input
            id="evenement-q"
            name="q"
            defaultValue={filter.text}
            placeholder="Nom, résumé, auteur"
            className="min-h-11"
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor="evenement-type" className="text-sm font-medium">
            Type
          </label>
          <select
            id="evenement-type"
            name="type"
            defaultValue={filter.kind}
            className="min-h-11 rounded-lg border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Tous</option>
            {ACTIVITY_KINDS.map((kind) => (
              <option key={kind.id} value={kind.id}>
                {kind.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" className="min-h-11 px-4">
          Filtrer
        </Button>
        {filtering ? (
          <Link href={cleared} className="inline-flex min-h-11 items-center px-2 text-sm underline-offset-4 hover:underline">
            Effacer le filtre
          </Link>
        ) : null}
      </form>

      <form
        action={formAction}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
        onSubmit={(event) => {
          if (chosen.length === 0) {
            event.preventDefault();
            return;
          }
          const count = chosen.length;
          const sentence =
            count === 1
              ? "Retirer cette trace ? La fiche, le projet et les pièces restent."
              : `Retirer ces ${count} traces ? Les fiches, les projets et les pièces restent.`;
          if (!window.confirm(sentence)) event.preventDefault();
        }}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <label className="inline-flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={allChecked}
              ref={(node) => {
                if (node) node.indeterminate = someChecked;
              }}
              onChange={(event) => toggleAll(event.target.checked)}
              disabled={rows.length === 0 || pending}
              aria-label="Tout cocher"
            />
            Tout cocher
          </label>
          <Button type="submit" variant="destructive" className="min-h-11 px-4" disabled={chosen.length === 0 || pending}>
            {pending ? "Suppression…" : "Supprimer la sélection"}
          </Button>
        </div>
        {state.message ? (
          <p role={state.ok ? "status" : "alert"} className={state.ok ? "shrink-0 text-sm" : "shrink-0 text-sm text-destructive"}>
            {state.message}
          </p>
        ) : null}
        {truncated ? (
          <p className="shrink-0 text-sm text-muted-foreground">
            D’autres traces plus anciennes existent. Affinez le filtre pour les retrouver.
          </p>
        ) : null}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {filtering || filter.projectId || filter.entityId
              ? "Aucun événement ne correspond à ce filtre."
              : "Aucune trace pour le moment. Une création, une correction ou une action de dossier apparaîtra ici."}
          </p>
        ) : (
          <ul className="grid min-h-0 flex-1 content-start gap-1 overflow-auto">
            {rows.map((row) => (
              <li key={row.token}>
                <label className="flex min-h-11 items-start gap-3 rounded-lg px-2 py-2 text-sm leading-6 hover:bg-muted">
                  <input
                    type="checkbox"
                    name="trace"
                    value={row.token}
                    className="mt-1 size-4 shrink-0"
                    checked={selected.has(row.token)}
                    onChange={(event) => toggle(row.token, event.target.checked)}
                    disabled={pending}
                    aria-label={`${row.kindLabel} ${row.title}`}
                  />
                  <span className="min-w-0 break-words">
                    <span className="text-muted-foreground">{row.at}</span>
                    {" · "}
                    <span className="font-medium">{row.actor}</span>
                    {" · "}
                    {row.kindLabel}
                    {" · "}
                    <span className="font-medium">{row.title}</span>
                    {" · "}
                    {row.summary}
                    {row.kind === "action" ? null : (
                      <>
                        {" · "}
                        {row.source}
                      </>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </form>
    </div>
  );
}
