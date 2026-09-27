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
          Le manuel décrit les écrans en service. L’instruction métier fixe
          l’ordre des preuves de l’achat-revente. La spécification fonctionnelle
          décrit le produit visé, la spécification technique décrit le socle
          livré. Les listes sont dans le menu de gauche. Le serveur, les modèles
          et la clé d’API sont dans{" "}
          <Link href="/configuration" className="font-medium text-foreground underline-offset-4 hover:underline">
            Configuration
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documentation</CardTitle>
          <CardDescription>
            Le manuel et les spécifications sont dans docs. L’instruction métier
            est dans instructions/metiers.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/manuel"
            className={cn(buttonVariants(), "min-h-11 px-4")}
          >
            Ouvrir le manuel
          </Link>
          <Link
            href="/documentation/metier"
            className={cn(buttonVariants({ variant: "outline" }), "min-h-11 px-4")}
          >
            Instruction métier
          </Link>
          <a
            href="/documentation/specification"
            className={cn(buttonVariants({ variant: "outline" }), "min-h-11 px-4")}
          >
            Spécification fonctionnelle
          </a>
          <Link
            href="/documentation/technique"
            className={cn(buttonVariants({ variant: "outline" }), "min-h-11 px-4")}
          >
            Spécification technique
          </Link>
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
