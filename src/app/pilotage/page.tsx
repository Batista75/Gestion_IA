import { LaterSection } from "@/components/later-section";

export default function SteeringPage() {
  return (
    <LaterSection
      title="Pilotage"
      summary="Le compte projet montrera le prévu, l’engagé, le facturé et le payé, chacun relié à ses pièces. Aucun chiffre n’est affiché tant que ces montants n’existent pas."
      items={[
        "Marge prévue et constatée, en HT, TVA à part.",
        "Cash du projet : encaissements, décaissements et besoin de financement.",
        "Contrôle entre la somme des projets et le total de l’entreprise.",
        "Chaque indicateur avec sa période et sa date de calcul.",
      ]}
    />
  );
}
