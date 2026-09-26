import { PriceSimulator } from "@/components/price-simulator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SalesPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Ventes</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Le simulateur calcule un prix conseillé à partir du coût, du taux de
          marque et de la remise. Il ne numérote pas de devis et ne fixe pas la
          TVA.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Aide à l’établissement du prix</CardTitle>
          <CardDescription>
            Exemple de la spécification : coût 700 € HT, marque 30 %, remise
            10 %.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PriceSimulator />
        </CardContent>
      </Card>
    </div>
  );
}
