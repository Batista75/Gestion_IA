import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "cn";

const entries = [
  {
    href: "/clients",
    title: "Clients",
    text: "Particuliers et entreprises, en France ou à l’international. Une fiche créée depuis une pièce reste à compléter.",
  },
  {
    href: "/fournisseurs",
    title: "Fournisseurs",
    text: "Les fournisseurs cités sur un devis, une commande ou une facture, après confirmation.",
  },
  {
    href: "/produits",
    title: "Produits",
    text: "Le catalogue, avec chaque version de devis : prix indiqué et conditions, sans les fusionner.",
  },
];

export default function DirectoryPage() {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Répertoire</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Les mêmes fiches que le menu Liste : clients, fournisseurs et articles.
          L’accueil propose une fiche ; ces écrans la tiennent et permettent de
          la saisir à la main.
        </p>
      </div>
      <ul className="grid gap-3">
        {entries.map((entry) => (
          <li key={entry.href}>
            <Card>
              <CardHeader>
                <CardTitle>{entry.title}</CardTitle>
                <CardDescription>{entry.text}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={entry.href} className={cn(buttonVariants(), "min-h-11 px-4")}>
                  Ouvrir {entry.title.toLowerCase()}
                </Link>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
