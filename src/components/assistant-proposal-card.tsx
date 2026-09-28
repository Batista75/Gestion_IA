import { CircleCheck, Clock, Info, Lightbulb } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "cn";

export type ProposalState = "a_confirmer" | "confirmee" | "sans_suite";

const STATE_LABEL: Record<ProposalState, string> = {
  a_confirmer: "À confirmer",
  confirmee: "Confirmée",
  sans_suite: "Sans suite dans ce fil",
};

export function AssistantProposalCard({
  title = "Proposition",
  state,
  fields,
  children,
  actions,
  note,
}: {
  title?: string;
  state: ProposalState;
  fields?: Array<{ label: string; value: string }>;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  note?: string;
}) {
  const open = state === "a_confirmer";
  return (
    <section
      data-proposal={state}
      aria-label={`${title} — ${STATE_LABEL[state]}`}
      className={cn(
        "overflow-hidden rounded-lg border bg-surface shadow-xs",
        open ? "border-proposal/35" : "border-border",
      )}
    >
      <header className={cn("flex items-center justify-between gap-2 px-3 py-2", open ? "bg-proposal-soft" : "bg-surface-2/70")}>
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium">
          <Lightbulb aria-hidden="true" className={cn("size-3.5 shrink-0", open ? "text-proposal" : "text-muted-foreground")} />
          <span className="truncate">{title}</span>
        </span>
        <StatusBadge tone={state === "confirmee" ? "success" : open ? "proposal" : "neutral"}>
          {state === "confirmee" ? (
            <CircleCheck aria-hidden="true" className="size-3" />
          ) : open ? (
            <Clock aria-hidden="true" className="size-3" />
          ) : null}
          {STATE_LABEL[state]}
        </StatusBadge>
      </header>
      <div className="grid gap-2 px-3 py-2.5">
        {fields && fields.length > 0 ? (
          <dl className="grid gap-1 text-sm">
            {fields.map((field) => (
              <div key={field.label} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-2">
                <dt className="truncate text-muted-foreground">{field.label}</dt>
                <dd className="break-words">{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2">{actions}</div> : null}
      {open ? (
        <p className="flex items-start gap-1.5 border-t border-border px-3 py-2 text-xs leading-5 text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {note ?? "Rien n’est encore enregistré. L’écriture attend votre confirmation."}
        </p>
      ) : null}
    </section>
  );
}
