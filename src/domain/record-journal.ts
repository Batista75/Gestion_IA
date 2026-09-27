export const CLIENT_FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  kind: "Type",
  country: "Pays",
  city: "Ville",
  address: "Adresse",
  postalCode: "Code postal",
  siren: "SIREN",
  siret: "SIRET",
  vatNumber: "TVA",
  contactName: "Contact",
  contactRole: "Fonction",
  email: "E-mail",
  phone: "Téléphone",
  notes: "Notes",
  tradeName: "Enseigne",
  legalForm: "Forme",
  sector: "Secteur",
};

export const PARTY_FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  siren: "SIREN",
  email: "E-mail",
  phone: "Téléphone",
  address: "Adresse",
  notes: "Notes",
};

export const PRODUCT_FIELD_LABELS: Record<string, string> = {
  name: "Désignation",
  reference: "Référence",
  unit: "Unité",
  description: "Description",
  kind: "Famille",
  statedPrice: "Prix indiqué",
  costStated: "Coût unitaire",
  currency: "Devise",
};

export const PROJECT_FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  primaryClient: "Client",
  status: "Statut",
  purpose: "Objet",
  nextAction: "Prochaine action",
  deliveryRecipient: "Destinataire livraison",
  deliveryAddress: "Adresse de livraison",
  deliveryPostalCode: "Code postal livraison",
  deliveryCity: "Ville de livraison",
  deliveryCountry: "Pays de livraison",
  deliveryContact: "Contact livraison",
  deliveryPhone: "Téléphone livraison",
  deliverySlot: "Créneau de livraison",
  deliveryMode: "Mode de livraison",
  deliveryNote: "Consignes de livraison",
};

export function fieldChangeSummary(
  before: Record<string, string>,
  after: Record<string, string>,
  labels: Record<string, string>,
): string {
  return Object.entries(labels)
    .flatMap(([key, label]) => {
      const left = (before[key] ?? "").trim();
      const right = (after[key] ?? "").trim();
      if (left === right) return [];
      return [`${label} : ${left || "non renseigné"} → ${right || "retiré"}`];
    })
    .join(" · ");
}
