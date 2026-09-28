import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { currentSession } from "@/lib/actor";
import { prisma } from "@/lib/db";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestion IA",
  description:
    "Gestion locale des projets, devis et pièces pour une petite entreprise.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const path = (await headers()).get("x-gestion-path") ?? "";
  const bare = path === "/connexion" || path.startsWith("/connexion/");
  let company = "Société locale";
  if (!bare) {
    try {
      const row = await prisma.companyProfile.findUnique({ where: { id: "local" } });
      if (row?.legalName.trim()) company = row.legalName.trim();
    } catch {
      company = "Société locale";
    }
  }
  const session = bare ? null : await currentSession();
  const operator = session?.mark ?? "";
  const role = session?.role ?? "";
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {bare ? children : <AppShell company={company} operator={operator} role={role}>{children}</AppShell>}
      </body>
    </html>
  );
}
