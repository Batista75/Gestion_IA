"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { logoutAction } from "@/app/connexion/actions";
import { cn } from "cn";

const daily = [
  { href: "/", label: "Accueil" },
  { href: "/projets", label: "Projets" },
  { href: "/clients", label: "Clients" },
  { href: "/fournisseurs", label: "Fournisseurs" },
  { href: "/produits", label: "Produits" },
] as const;

const more = [
  { href: "/suivi", label: "Devis" },
  { href: "/achats", label: "Achats" },
  { href: "/listes/echeances", label: "Échéances" },
  { href: "/banque", label: "Banque" },
  { href: "/comptabilite/journal", label: "Journal" },
  { href: "/pilotage", label: "Pilotage" },
  { href: "/pilotage/analyse", label: "Analyses" },
  { href: "/listes/documents", label: "Documents" },
  { href: "/listes/textes", label: "Modèles" },
  { href: "/configuration", label: "Configuration" },
  { href: "/manuel", label: "Manuel" },
  { href: "/plus", label: "Plus" },
  { href: "/recherche", label: "Recherche" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/projets") return pathname === "/projets" || pathname.startsWith("/projets/");
  if (href === "/pilotage") return pathname === "/pilotage";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function placeLabel(pathname: string): string {
  if (pathname.startsWith("/documentation")) return "Documentation";
  if (pathname.startsWith("/repertoire")) return "Répertoire";
  const match = [...daily, ...more]
    .filter((link) => isActive(pathname, link.href))
    .sort((left, right) => right.href.length - left.href.length)[0];
  return match?.label ?? "Gestion IA";
}

function NavLink({
  href,
  label,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex min-h-11 items-center rounded-lg px-3 text-sm",
        active ? "bg-primary font-medium text-primary-foreground" : "hover:bg-muted",
      )}
    >
      {label}
    </Link>
  );
}

function SideBar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const inMore = more.some((link) => link.href !== "/recherche" && isActive(pathname, link.href));
  const [expanded, setExpanded] = useState(false);
  const showMore = expanded || inMore;

  useEffect(() => {
    if (!inMore) setExpanded(false);
  }, [inMore, pathname]);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-border bg-card print:hidden lg:static",
        open ? "block" : "hidden lg:block",
      )}
    >
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="text-base font-semibold tracking-tight" onClick={onNavigate}>
          Gestion IA
        </Link>
      </div>
      <nav aria-label="Rubriques" className="grid gap-1 px-3 pb-8">
        <ul className="grid gap-1">
          {daily.map((link) => (
            <li key={link.href}>
              <NavLink
                href={link.href}
                label={link.label}
                active={isActive(pathname, link.href)}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-3 flex min-h-11 items-center justify-between rounded-lg px-3 text-sm font-medium hover:bg-muted"
          aria-expanded={showMore}
          onClick={() => setExpanded((value) => !value)}
        >
          Autres
          <span aria-hidden="true">{showMore ? "–" : "+"}</span>
        </button>
        {showMore ? (
          <ul className="grid gap-1">
            {more
              .filter((link) => link.href !== "/recherche")
              .map((link) => (
                <li key={link.href}>
                  <NavLink
                    href={link.href}
                    label={link.label}
                    active={isActive(pathname, link.href)}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
          </ul>
        ) : null}
      </nav>
    </aside>
  );
}

export function AppShell({
  company,
  operator,
  children,
}: {
  company: string;
  operator: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const place = placeLabel(pathname);

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
    <div className="min-h-full lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Suspense fallback={<div className="hidden border-r border-border lg:block" />}>
        <SideBar open={open} onNavigate={() => setOpen(false)} />
      </Suspense>
      {open ? (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-30 bg-black/30 print:hidden lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-2 border-b border-border bg-card px-3 print:hidden sm:px-4">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium lg:hidden"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            Menu
          </button>
          <p className="hidden min-w-0 max-w-40 truncate text-sm font-medium sm:block">{place}</p>
          <form action="/recherche" className="relative min-w-0 flex-1">
            <label htmlFor="global-search" className="sr-only">
              Rechercher un projet, un tiers, un produit ou une pièce
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="global-search"
              name="q"
              placeholder="Rechercher"
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-input bg-background pr-10 pl-9 text-sm"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-border px-1.5 text-xs text-muted-foreground sm:inline">
              /
            </kbd>
          </form>
          <span className="hidden max-w-40 truncate text-sm text-muted-foreground xl:inline">{company}</span>
          <span className="hidden max-w-28 truncate text-sm sm:inline">{operator}</span>
          <form action={logoutAction}>
            <button type="submit" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-muted">
              Quitter
            </button>
          </form>
        </header>
        <main className="px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
