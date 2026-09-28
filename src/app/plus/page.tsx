import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { shortEvaluationHolds } from "@/domain/short-eval";
import { formatDoneAt, orderByDoneAt, readDoneOrder, v2Phases, v2Progress, v2ProgressCounts, type DoneOrder } from "@/domain/v2-progress";
import { runShortEvaluation } from "@/lib/short-messages";
import { cn } from "cn";

export default async function MorePage({
  searchParams,
}: {
  searchParams: Promise<{ ordre?: string; vue?: string }>;
}) {
  const params = await searchParams;
  const order = readDoneOrder(params.ordre);
  const pane = params.vue === "phases" || params.vue === "messages" ? params.vue : "cible";
  const rows = order ? orderByDoneAt(v2Progress, order) : v2Progress;
  const counts = v2ProgressCounts();
  const shorts = runShortEvaluation();
  const shortsHold = shortEvaluationHolds(shorts);
  const panes = [
    ["cible", "Cible V2"],
    ["phases", "Phases"],
    ["messages", "Messages courts"],
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Plus</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/manuel" className={cn(buttonVariants(), "h-9 px-3")}>Manuel</Link>
          <Link href="/documentation/v2" className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}>Demandes</Link>
          <Link href="/documentation/technique" className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}>Technique</Link>
          <Link href="/documentation/technique/dat" className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}>DAT</Link>
          <Link href="/documentation/technique/dct" className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}>DCT</Link>
          <Link href="/configuration" className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}>Configuration</Link>
        </div>
      </div>
      <nav className="flex shrink-0 flex-wrap gap-2" aria-label="Volets de Plus">
        {panes.map(([key, label]) => (
          <Link
            key={key}
            href={paneHref(key, order)}
            aria-current={pane === key ? "page" : undefined}
            className={cn(buttonVariants({ variant: pane === key ? "default" : "outline" }), "h-9 px-3")}
          >
            {label}
          </Link>
        ))}
      </nav>
      {pane === "cible" ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {counts.done} faits, {counts.open} pas faits. Les lignes sans date restent en bas.
          </p>
          <div className="flex flex-wrap gap-2">
            <OrderLink href={paneHref("cible", null)} active={order === null} label="Ordre de la liste" />
            <OrderLink href={paneHref("cible", "recent")} active={order === "recent"} label="Plus récent" />
            <OrderLink href={paneHref("cible", "ancien")} active={order === "ancien"} label="Plus ancien" />
          </div>
        </div>
      ) : (
        <p className="shrink-0 text-sm text-muted-foreground">
          {pane === "phases"
            ? "La chaîne avance dans cet ordre. La phase en cours est la première qui reste à faire."
            : shortsHold
              ? `${shorts.length} phrases tiennent. Le contrôle rejoue la chaîne sur ces textes. Rien n’est écrit.`
              : "Une phrase ne tient pas. Le contrôle n’a rien écrit."}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card">
        {pane === "phases" ? <PhaseTable /> : pane === "messages" ? <MessageTable shorts={shorts} /> : <TargetTable rows={rows} order={order} />}
      </div>
    </div>
  );
}

function paneHref(pane: "cible" | "phases" | "messages", order: DoneOrder | null): string {
  const params = new URLSearchParams();
  if (pane !== "cible") params.set("vue", pane);
  if (order) params.set("ordre", order);
  const query = params.toString();
  return query ? `/plus?${query}` : "/plus";
}

function PhaseTable() {
  return (
    <table className="w-full min-w-[36rem] border-collapse text-sm">
      <caption className="sr-only">Phases de la chaîne hybride</caption>
      <thead className="sticky top-0 z-10">
        <tr className="border-b border-border bg-muted text-left text-xs tracking-wide text-muted-foreground uppercase">
          <th className="w-16 bg-muted px-3 py-2 font-medium">Phase</th>
          <th className="bg-muted px-3 py-2 font-medium">Travail</th>
          <th className="w-28 bg-muted px-3 py-2 font-medium">État</th>
          <th className="w-40 bg-muted px-3 py-2 font-medium">Réalisé</th>
        </tr>
      </thead>
      <tbody>
        {v2Phases.map((phase) => (
          <tr key={phase.order} className="border-b border-border last:border-0">
            <td className="px-3 py-1.5 text-muted-foreground">{phase.order}</td>
            <td className="px-3 py-1.5">
              <span className="font-medium">{phase.title}</span>
              <span className="text-muted-foreground"> — {phase.summary}</span>
            </td>
            <td className="px-3 py-1.5">
              <Badge variant={phase.state === "fait" ? "secondary" : "outline"}>
                {phase.state === "fait" ? "Fait" : "Pas fait"}
              </Badge>
            </td>
            <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
              {formatDoneAt(phase.doneAt) || "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MessageTable({ shorts }: { shorts: ReturnType<typeof runShortEvaluation> }) {
  return (
    <table className="w-full min-w-[36rem] border-collapse text-sm">
      <caption className="sr-only">Contrôle des messages courts</caption>
      <thead className="sticky top-0 z-10">
        <tr className="border-b border-border bg-muted text-left text-xs tracking-wide text-muted-foreground uppercase">
          <th className="bg-muted px-3 py-2 font-medium">Phrase</th>
          <th className="bg-muted px-3 py-2 font-medium">Contrôle</th>
          <th className="w-28 bg-muted px-3 py-2 font-medium">Résultat</th>
        </tr>
      </thead>
      <tbody>
        {shorts.map((item) => (
          <tr key={`${item.phrase}-${item.check}`} className="border-b border-border last:border-0">
            <td className="px-3 py-1.5 font-medium whitespace-nowrap">{item.phrase}</td>
            <td className="px-3 py-1.5 text-muted-foreground">{item.check}</td>
            <td className="px-3 py-1.5">
              <Badge variant={item.ok ? "secondary" : "outline"}>{item.ok ? "Tient" : "Écart"}</Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TargetTable({ rows, order }: { rows: typeof v2Progress; order: DoneOrder | null }) {
  return (
    <table className="w-full min-w-[36rem] border-collapse text-sm">
      <caption className="sr-only">Avancement de la cible V2</caption>
      <thead className="sticky top-0 z-10">
        <tr className="border-b border-border bg-muted text-left text-xs tracking-wide text-muted-foreground uppercase">
          <th className="bg-muted px-3 py-2 font-medium">Domaine</th>
          <th className="bg-muted px-3 py-2 font-medium">Point</th>
          <th className="w-28 bg-muted px-3 py-2 font-medium">État</th>
          <th className="w-40 bg-muted px-3 py-2 font-medium">
            <Link href={nextOrderHref(order)} className="underline-offset-4 hover:underline">
              Réalisé{order === "recent" ? " ↓" : order === "ancien" ? " ↑" : ""}
            </Link>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.point} className="border-b border-border last:border-0">
            <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{row.domain}</td>
            <td className="px-3 py-1.5">{row.point}</td>
            <td className="px-3 py-1.5">
              <Badge variant={row.status === "fait" ? "secondary" : "outline"}>
                {row.status === "fait" ? "Fait" : "Pas fait"}
              </Badge>
            </td>
            <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
              {formatDoneAt(row.doneAt) || "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OrderLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: active ? "secondary" : "outline" }), "min-h-11 px-4")}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

function nextOrderHref(order: DoneOrder | null): string {
  if (order === "recent") return "/plus?ordre=ancien";
  if (order === "ancien") return "/plus";
  return "/plus?ordre=recent";
}
