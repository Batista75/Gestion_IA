"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarClock,
  ChartColumn,
  ChevronDown,
  CircleHelp,
  Ellipsis,
  Factory,
  FileText,
  Files,
  FolderKanban,
  Gauge,
  History,
  House,
  Landmark,
  LayoutTemplate,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { logoutAction } from "@/app/connexion/actions";
import { cn } from "cn";

type NavEntry = { href: string; label: string; icon: LucideIcon };

const daily: NavEntry[] = [
  { href: "/", label: "Accueil", icon: House },
  { href: "/projets", label: "Projets", icon: FolderKanban },
  { href: "/evenements", label: "Événements", icon: History },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/fournisseurs", label: "Fournisseurs", icon: Factory },
  { href: "/produits", label: "Produits", icon: Package },
];

const more: NavEntry[] = [
  { href: "/suivi", label: "Devis", icon: FileText },
  { href: "/achats", label: "Achats", icon: ShoppingCart },
  { href: "/listes/echeances", label: "Échéances", icon: CalendarClock },
  { href: "/banque", label: "Banque", icon: Landmark },
  { href: "/comptabilite/journal", label: "Journal", icon: BookOpen },
  { href: "/pilotage", label: "Pilotage", icon: Gauge },
  { href: "/pilotage/analyse", label: "Analyses", icon: ChartColumn },
  { href: "/listes/documents", label: "Documents", icon: Files },
  { href: "/listes/textes", label: "Modèles", icon: LayoutTemplate },
  { href: "/plus", label: "Plus", icon: Ellipsis },
];

const footer: NavEntry[] = [
  { href: "/manuel", label: "Manuel", icon: CircleHelp },
  { href: "/configuration", label: "Configuration", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/projets") return pathname === "/projets" || pathname.startsWith("/projets/");
  if (href === "/pilotage") return pathname === "/pilotage";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function NavLink({ entry, active, onNavigate }: { entry: NavEntry; active: boolean; onNavigate: () => void }) {
  const Icon = entry.icon;
  return (
    <Link
      href={entry.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "bg-primary-soft font-medium text-primary before:absolute before:inset-y-1.5 before:-left-3 before:w-0.5 before:rounded-full before:bg-primary"
          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{entry.label}</span>
    </Link>
  );
}

function SideBar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const inMore = more.some((entry) => isActive(pathname, entry.href));
  const [expanded, setExpanded] = useState(false);
  const showMore = expanded || inMore;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-sidebar flex-col border-r border-border bg-surface print:hidden lg:static lg:flex lg:h-full lg:min-h-0",
        open ? "flex" : "hidden",
      )}
    >
      <div className="flex h-topbar shrink-0 items-center gap-2 px-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight" onClick={onNavigate}>
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[0.7rem] font-semibold text-primary-foreground">
            G
          </span>
          Gestion IA
        </Link>
      </div>
      <nav aria-label="Rubriques" className="grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto px-3 py-2">
        <ul className="grid gap-0.5">
          {daily.map((entry) => (
            <li key={entry.href}>
              <NavLink entry={entry} active={isActive(pathname, entry.href)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-3 flex h-7 items-center justify-between rounded-md px-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors duration-150 hover:text-foreground"
          aria-expanded={showMore}
          onClick={() => setExpanded((value) => !value)}
        >
          Autres
          <ChevronDown aria-hidden="true" className={cn("size-3.5 transition-transform duration-150", showMore ? "" : "-rotate-90")} />
        </button>
        {showMore ? (
          <ul className="grid gap-0.5">
            {more.map((entry) => (
              <li key={entry.href}>
                <NavLink entry={entry} active={isActive(pathname, entry.href)} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        ) : null}
      </nav>
      <ul className="grid shrink-0 gap-0.5 border-t border-border px-3 py-2">
        {footer.map((entry) => (
          <li key={entry.href}>
            <NavLink entry={entry} active={isActive(pathname, entry.href)} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function AppShell({
  company,
  operator,
  role = "",
  children,
}: {
  company: string;
  operator: string;
  role?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const flush = /^\/projets\/[^/]+/.test(pathname);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      document.getElementById("global-search")?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="h-dvh overflow-hidden lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      <Suspense fallback={<div className="hidden border-r border-border bg-surface lg:block" />}>
        <SideBar open={open} onNavigate={() => setOpen(false)} />
      </Suspense>
      {open ? (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-30 bg-black/20 print:hidden lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div className="flex h-dvh min-h-0 min-w-0 flex-col">
        <header className="flex h-topbar shrink-0 items-center gap-3 border-b border-border bg-surface px-3 print:hidden sm:px-4">
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-md hover:bg-surface-2 lg:hidden"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu aria-hidden="true" className="size-4" />
          </button>
          <form action="/recherche" className="relative w-full max-w-xl min-w-0 flex-1">
            <label htmlFor="global-search" className="sr-only">
              Rechercher un projet, un tiers, un produit ou une pièce
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="global-search"
              name="q"
              placeholder="Rechercher un projet, un client, un fournisseur…"
              autoComplete="off"
              className="h-8 w-full rounded-md border border-border bg-surface-2 pr-9 pl-8 text-sm transition-colors duration-150 placeholder:text-muted-foreground hover:border-input focus-visible:border-ring focus-visible:bg-surface focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-border bg-surface px-1.5 text-[0.7rem] text-muted-foreground sm:inline">
              /
            </kbd>
          </form>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Link
              href="/manuel"
              aria-label="Manuel"
              title="Manuel"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
            >
              <CircleHelp aria-hidden="true" className="size-4" />
            </Link>
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
            <span className="hidden max-w-48 truncate text-xs text-muted-foreground xl:inline">{company}</span>
            <span className="flex items-center gap-2 pl-1">
              <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-[0.7rem] font-semibold text-foreground"
              >
                {initials(operator)}
              </span>
              <span className="hidden max-w-32 truncate text-sm sm:inline">{operator}</span>
              {role === "admin" ? (
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground">Admin</span>
              ) : null}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Quitter"
                title="Quitter"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
              >
                <LogOut aria-hidden="true" className="size-4" />
              </button>
            </form>
          </div>
        </header>
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            flush ? "overflow-hidden" : "overflow-auto px-4 py-3 sm:px-5",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
