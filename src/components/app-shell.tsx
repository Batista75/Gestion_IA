"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { cn } from "cn";

const sections = [
  {
    title: "Accueil",
    links: [{ href: "/", label: "Tableau personnel" }],
  },
  {
    title: "Projets",
    links: [{ href: "/projets", label: "Tous les projets" }],
  },
  {
    title: "Ventes",
    links: [{ href: "/suivi", label: "Devis" }],
  },
  {
    title: "Achats",
    links: [{ href: "/achats", label: "Achats" }],
  },
  {
    title: "Référentiels",
    links: [
      { href: "/clients", label: "Clients" },
      { href: "/fournisseurs", label: "Fournisseurs" },
      { href: "/produits", label: "Produits et services" },
    ],
  },
  {
    title: "Finance",
    links: [
      { href: "/listes/echeances", label: "Échéances" },
      { href: "/banque", label: "Banque" },
      { href: "/comptabilite/journal", label: "Journal" },
    ],
  },
  {
    title: "Pilotage",
    links: [
      { href: "/pilotage", label: "Tableau de bord" },
      { href: "/pilotage/analyse", label: "Analyses" },
    ],
  },
  {
    title: "Administration",
    links: [
      { href: "/listes/documents", label: "Documents" },
      { href: "/listes/textes", label: "Modèles" },
      { href: "/configuration", label: "Configuration" },
      { href: "/documentation/v2", label: "Cible V2" },
    ],
  },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/projets") return pathname === "/projets" || pathname.startsWith("/projets/");
  if (href === "/pilotage") return pathname === "/pilotage";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SideBar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
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
      <nav aria-label="Rubriques" className="grid gap-4 px-3 pb-8">
        {sections.map((section) => (
          <div key={section.title} className="grid gap-1">
            <p className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{section.title}</p>
            <ul className="grid">
              {section.links.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <li key={`${section.title}-${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      onClick={onNavigate}
                      className={cn(
                        "flex min-h-10 items-center rounded-lg px-2 text-sm",
                        active ? "bg-primary font-medium text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function AppShell({
  company,
  children,
}: {
  company: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
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
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 print:hidden">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium lg:hidden"
            onClick={() => setOpen(true)}
          >
            Menu
          </button>
          <form action="/recherche" className="hidden min-w-0 flex-1 md:block">
            <input
              name="q"
              placeholder="Rechercher un projet, un tiers, un produit, une pièce"
              className="h-10 w-full max-w-md rounded-lg border border-input bg-background px-3 text-sm"
            />
          </form>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden max-w-48 truncate text-muted-foreground sm:inline">{company}</span>
            <span className="hidden text-muted-foreground md:inline">J Smith</span>
            <Link href="/configuration" className="inline-flex min-h-11 items-center hover:underline">
              Configuration
            </Link>
            <Link href="/manuel" className="inline-flex min-h-11 items-center hover:underline">
              Manuel
            </Link>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
