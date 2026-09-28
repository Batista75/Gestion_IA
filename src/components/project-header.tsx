import Link from "next/link";
import { ChevronRight, FolderOpen, type LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "cn";

export type ProjectFact = { icon: LucideIcon; label: string; value: string; detail?: string; href?: string };

export function ProjectHeader({
  name,
  subtitle,
  status,
  facts,
  actions,
}: {
  name: string;
  subtitle: string;
  status: string;
  facts: ProjectFact[];
  actions: React.ReactNode;
}) {
  return (
    <header className="grid shrink-0 gap-3">
      <nav aria-label="Fil d’Ariane" className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/projets" className="transition-colors duration-150 hover:text-foreground">
          Projets
        </Link>
        <ChevronRight aria-hidden="true" className="size-3.5" />
        <span aria-current="page" className="truncate text-foreground">
          {name}
        </span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <FolderOpen aria-hidden="true" className="size-5" />
          </span>
          <div className="grid min-w-0 gap-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="truncate text-lg leading-7 font-semibold tracking-tight">{name}</h1>
              <StatusBadge tone="accent" dot>
                {status}
              </StatusBadge>
            </div>
            <p className="line-clamp-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-border py-2.5 md:grid-cols-4 md:divide-x md:divide-border">
        {facts.map((fact) => {
          const Icon = fact.icon;
          return (
            <div key={fact.label} className="flex min-w-0 items-start gap-2 md:pl-4 md:first:pl-0">
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="grid min-w-0">
                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                <dd className="truncate text-sm font-medium">
                  {fact.href ? (
                    <Link href={fact.href} className="underline-offset-4 hover:underline">
                      {fact.value}
                    </Link>
                  ) : (
                    fact.value
                  )}
                </dd>
                {fact.detail ? <dd className="truncate text-xs text-muted-foreground">{fact.detail}</dd> : null}
              </div>
            </div>
          );
        })}
      </dl>
    </header>
  );
}

export function ProjectTabs({
  items,
  current,
}: {
  items: Array<{ key: string; label: string; href: string; count?: string }>;
  current: string;
}) {
  return (
    <nav aria-label="Volets du dossier" className="-mb-px flex shrink-0 gap-5 overflow-x-auto border-b border-border">
      {items.map((item) => {
        const active = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 border-b-2 text-sm transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:border-input hover:text-foreground",
            )}
          >
            {item.label}
            {item.count ? (
              <span className={cn("text-xs tabular-nums", active ? "text-muted-foreground" : "text-muted-foreground/80")}>
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
