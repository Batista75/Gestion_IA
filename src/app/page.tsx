import Link from "next/link";
import { InboxForm } from "@/components/inbox-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [projects, inbox] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.inboxItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Accueil</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Déposez une information ou ouvrez un dossier. Une note de l’accueil
          ne crée pas de projet. L’assistant peut créer un compte, un
          fournisseur, un produit ou un projet si vous le lui demandez.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/clients" className="inline-flex min-h-11 items-center rounded-lg bg-muted px-3 text-sm font-medium">
            Clients
          </Link>
          <Link href="/fournisseurs" className="inline-flex min-h-11 items-center rounded-lg bg-muted px-3 text-sm font-medium">
            Fournisseurs
          </Link>
          <Link href="/produits" className="inline-flex min-h-11 items-center rounded-lg bg-muted px-3 text-sm font-medium">
            Produits
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle information</CardTitle>
            <CardDescription>
              Texte libre. Le classement assisté viendra ensuite ; pour
              l’instant la pièce reste visible et non affectée.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InboxForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>À valider</CardTitle>
            <CardDescription>
              Les propositions de prix, de tiers ou de rapprochement
              apparaîtront ici, avec leur source, avant toute confirmation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Aucune proposition en attente.
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Projets récents</h2>
          <Link
            href="/projets"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Tous les projets
          </Link>
        </div>
        {projects.length === 0 ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Aucun dossier. Créez le premier depuis{" "}
              <Link href="/projets" className="font-medium text-foreground">
                Projets
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>{project.primaryClient}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    <Badge variant="secondary">{project.status}</Badge>
                    <p className="text-sm">{project.nextAction}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">À classer</h2>
        {inbox.length === 0 ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Aucune information en attente.
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-2">
            {inbox.map((item) => (
              <li key={item.id}>
                <Card size="sm">
                  <CardContent className="grid gap-1">
                    <p className="text-sm leading-6">{item.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.createdAt.toLocaleString("fr-FR")} · sans projet
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
