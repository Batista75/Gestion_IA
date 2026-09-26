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

const later = [
  "Historique daté des prix d’achat et de vente.",
  "Export documentaire et export comptable, puis sauvegarde restaurable.",
  "Connecteur vers une plateforme agréée, désactivable.",
];

export default function MorePage() {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Plus</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Le manuel décrit les écrans en service, la spécification décrit le
          produit visé. Les listes sont dans Répertoire.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documentation</CardTitle>
          <CardDescription>
            Les deux documents sont aussi dans le dossier docs du dépôt.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/manuel"
            className={cn(buttonVariants(), "min-h-11 px-4")}
          >
            Ouvrir le manuel
          </Link>
          <a
            href="/documentation/specification"
            className={cn(buttonVariants({ variant: "outline" }), "min-h-11 px-4")}
          >
            Lire la spécification
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pas encore dans ce socle</CardTitle>
          <CardDescription>
            Ces capacités sont dans la spécification. Elles ne sont pas
            simulées ici.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid list-disc gap-2 pl-5 text-sm leading-6">
            {later.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
