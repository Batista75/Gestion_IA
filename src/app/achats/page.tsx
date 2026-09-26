import Link from "next/link";
import { LaterSection } from "@/components/later-section";

export default function PurchasesPage() {
  return (
    <div className="grid gap-6">
      <LaterSection
        title="Achats"
        summary="Les fournisseurs ont leur fiche. La commande, la réception, la facture et le paiement restent des objets distincts, pas encore saisissables."
        items={[
          "Devis fournisseur comme hypothèse de coût, avec variante et validité.",
          "Commande approuvée, puis réception ou service fait.",
          "Facture rapprochée, avoir et paiement, y compris le parcours sans commande.",
          "Alerte si un prix sans date de validité a plus d’un mois.",
        ]}
      />
      <p className="text-sm">
        <Link
          href="/fournisseurs"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Ouvrir la vue Fournisseurs
        </Link>
      </p>
    </div>
  );
}
