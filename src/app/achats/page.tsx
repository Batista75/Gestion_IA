import { LaterSection } from "@/components/later-section";

export default function PurchasesPage() {
  return (
    <LaterSection
      title="Achats"
      summary="L’offre fournisseur, la commande, la réception, la facture et le paiement restent des objets distincts. Leurs montants ne s’additionnent pas."
      items={[
        "Devis fournisseur comme hypothèse de coût, avec variante et validité.",
        "Commande approuvée, puis réception ou service fait.",
        "Facture rapprochée, avoir et paiement, y compris le parcours sans commande.",
        "Alerte si un prix sans date de validité a plus d’un mois.",
      ]}
    />
  );
}
