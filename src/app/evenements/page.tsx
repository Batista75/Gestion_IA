import Link from "next/link";
import { eventsQuery, readActivityFilter } from "@/domain/activity";
import { activitySubject, listActivity } from "@/lib/activity";
import { EventBoard } from "@/components/event-board";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; projet?: string; fiche?: string }>;
}) {
  const params = await searchParams;
  const filter = readActivityFilter(params);
  const [{ rows, truncated }, subject] = await Promise.all([listActivity(filter), activitySubject(filter)]);
  const withoutProject = eventsQuery({ ...filter, projectId: "" });
  const withoutFiche = eventsQuery({ ...filter, entityId: "" });

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Événements</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Toutes les traces des opérations : créations, corrections, suppressions de fiches, et actions de dossier.
          Le filtre limite la liste. Cocher puis supprimer retire la trace. Les fiches, les projets et les pièces restent.
        </p>
      </div>
      {filter.projectId ? (
        <p className="text-sm">
          Dossier : {subject.projectName || "ce dossier n’est plus dans la liste"}.{" "}
          <Link href={withoutProject} className="font-medium underline-offset-4 hover:underline">
            Tous les événements
          </Link>
        </p>
      ) : null}
      {filter.entityId ? (
        <p className="text-sm">
          Fiche : {subject.ficheName || "cette fiche n’est plus dans la liste"}.{" "}
          <Link href={withoutFiche} className="font-medium underline-offset-4 hover:underline">
            Toutes les fiches
          </Link>
        </p>
      ) : null}
      <EventBoard key={eventsQuery(filter)} rows={rows} filter={filter} truncated={truncated} />
    </div>
  );
}
