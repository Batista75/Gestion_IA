import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className="truncate text-lg leading-6 font-semibold tabular-nums">{value}</span>
        {detail ? <span className="truncate text-xs text-muted-foreground">{detail}</span> : null}
      </span>
    </>
  );
  const className = "flex items-start gap-3 rounded-lg border border-border bg-surface p-3";
  if (!href) return <div className={className}>{body}</div>;
  return (
    <Link
      href={href}
      className={cn(className, "transition-colors duration-150 hover:border-input hover:bg-surface-2/60 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none")}
    >
      {body}
    </Link>
  );
}
