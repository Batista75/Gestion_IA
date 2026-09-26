import { LaterSection } from "@/components/later-section";

export default function MorePage() {
  return (
    <LaterSection
      title="Plus"
      summary="Référentiels, exports, sauvegarde et paramètres de société. La spécification complète est conservée dans le dépôt."
      items={[
        "Clients, fournisseurs, produits et services, avec l’historique des prix.",
        "Export documentaire et export comptable, puis sauvegarde restaurable.",
        "Connecteur vers une plateforme agréée, désactivable.",
        "Spécification : docs/specifications-gestion-ia.pdf",
      ]}
    />
  );
}
