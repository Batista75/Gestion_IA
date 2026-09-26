"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/assistant", label: "Assistant" },
  { href: "/projets", label: "Projets" },
  { href: "/ventes", label: "Ventes" },
  { href: "/achats", label: "Achats" },
  { href: "/banque", label: "Banque" },
  { href: "/pilotage", label: "Pilotage" },
  { href: "/plus", label: "Plus" },
] as const;

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <Link href="/" className="text-base font-semibold tracking-tight">
            Gestion IA
          </Link>
          <div className="flex items-baseline gap-3">
            <Link
              href="/manuel"
              aria-current={pathname.startsWith("/manuel") ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline",
                pathname.startsWith("/manuel")
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              Manuel
            </Link>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Société pilote · local
            </p>
          </div>
        </div>
        <nav aria-label="Domaines" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max gap-1">
            {links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
