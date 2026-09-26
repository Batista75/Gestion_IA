import { LaterSection } from "@/components/later-section";

export default function AssistantPage() {
  return (
    <LaterSection
      title="Assistant"
      summary="Le copilote local lira, rapprochera et préparera. Il ne calcule pas les prix, n’émet pas de facture et ne classe rien sans confirmation."
      items={[
        "Boîte de réception : identifier le type de pièce et proposer un dossier.",
        "Questions sourcées sur les projets autorisés, avec le passage d’origine.",
        "Refus des instructions cachées dans un document.",
        "Modèle exécuté sur site : aucun contenu de facture n’est envoyé à un service d’IA tiers.",
      ]}
    />
  );
}
