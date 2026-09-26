import { LaterSection } from "@/components/later-section";

export default function BankPage() {
  return (
    <LaterSection
      title="Banque"
      summary="Le rapprochement proposera une correspondance et laissera les cas ambigus à confirmer. Aucun paiement n’est initié depuis cette application."
      items={[
        "Import d’un relevé.",
        "Encaissement exact, acompte, paiement partiel ou groupé.",
        "Mouvement inconnu conservé dans « À rapprocher ».",
        "Séparation du réalisé, de l’engagé et du prévisionnel.",
      ]}
    />
  );
}
