import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDoneAt, v2Phases, v2Progress, v2ProgressCounts } from "@/domain/v2-progress";
import { cn } from "cn";

export default function MorePage() {
  const counts = v2ProgressCounts();
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6">
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
          <Link
            href="/documentation/devis-hybride"
            className={cn(buttonVariants({ variant: "outline" }), "min-h-11 px-4")}
          >
            Devis hybride
          </Link>
          <Link
            href="/documentation/v2"
            className={cn(buttonVariants({ variant: "outline" }), "min-h-11 px-4")}
          >
            Cible V2
          </Link>
        </CardContent>
      </Card>

      <section className="grid gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Phases</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            La chaîne avance dans cet ordre. La phase en cours est la première qui reste à faire.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">Phases de la chaîne hybride</caption>
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="w-16 px-3 py-2 font-medium">Phase</th>
                <th className="px-3 py-2 font-medium">Travail</th>
                <th className="w-28 px-3 py-2 font-medium">État</th>
                <th className="w-40 px-3 py-2 font-medium">Réalisé</th>
              </tr>
            </thead>
            <tbody>
              {v2Phases.map((phase) => (
                <tr key={phase.order} className="border-b border-border last:border-0">
                  <td className="px-3 py-1.5 text-muted-foreground">{phase.order}</td>
                  <td className="px-3 py-1.5">
                    <span className="font-medium">{phase.title}</span>
                    <span className="text-muted-foreground"> — {phase.summary}</span>
                  </td>
                  <td className="px-3 py-1.5">
                    <Badge variant={phase.state === "fait" ? "secondary" : "outline"}>
                      {phase.state === "fait" ? "Fait" : "Pas fait"}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                    {formatDoneAt(phase.doneAt) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Cible V2</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {counts.done} faits, {counts.open} pas faits. Ce tableau est la liste tenue à jour :
            une capacité livrée passe de Pas fait à Fait, avec la date et l’heure.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">Avancement de la cible V2</caption>
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="px-3 py-2 font-medium">Domaine</th>
                <th className="px-3 py-2 font-medium">Point</th>
                <th className="w-28 px-3 py-2 font-medium">État</th>
                <th className="w-40 px-3 py-2 font-medium">Réalisé</th>
              </tr>
            </thead>
            <tbody>
              {v2Progress.map((row) => (
                <tr key={row.point} className="border-b border-border last:border-0">
                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{row.domain}</td>
                  <td className="px-3 py-1.5">{row.point}</td>
                  <td className="px-3 py-1.5">
                    <Badge variant={row.status === "fait" ? "secondary" : "outline"}>
                      {row.status === "fait" ? "Fait" : "Pas fait"}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                    {formatDoneAt(row.doneAt) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
