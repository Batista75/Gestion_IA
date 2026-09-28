import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

export function EmptyState({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-6 text-center", className)}>
      <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {children ? <div className="max-w-sm text-xs leading-5 text-muted-foreground">{children}</div> : null}
    </div>
  );
}
