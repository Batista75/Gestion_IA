export type V2Status = "fait" | "pas";

export type V2ProgressRow = {
  domain: string;
  point: string;
  status: V2Status;
};

/**
 * Liste affichée sur /plus. Quand une capacité de la cible V2 est livrée
 * ou retirée, mettre à jour la ligne ici.
 */
export const v2Progress: V2ProgressRow[] = [
  { domain: "Navigation", point: "Menu Accueil, Projets, Ventes, Achats, Référentiels, Finance, Pilotage, Administration", status: "fait" },
  { domain: "Navigation", point: "Historiques, regroupements et textes hors du premier niveau", status: "fait" },
  { domain: "Accueil", point: "Quatre zones : question, à traiter, projets récents, alertes", status: "fait" },
  { domain: "Accueil", point: "Montant absent laissé « non indiqué »", status: "fait" },
  { domain: "Recherche", point: "Recherche globale, résultats groupés par catégorie", status: "fait" },
  { domain: "Projets", point: "Liste des projets ; dossier avec activité, ventes et produits", status: "fait" },
  { domain: "Référentiels", point: "Fiches clients et fournisseurs", status: "fait" },
  { domain: "Référentiels", point: "Article produit ou service ; coût déjà saisi non écrasé", status: "fait" },
  { domain: "Ventes", point: "Devis brouillon : conditions du client et prix catalogue, calcul hors modèle", status: "fait" },
  { domain: "Ventes", point: "Devis en cours vers commande client et commande fournisseur", status: "fait" },
  { domain: "Achats", point: "Devis fournisseur proposé, écrit après confirmation", status: "fait" },
  { domain: "Documents", point: "Liste des devis, commandes et devis reçus", status: "fait" },
  { domain: "Documents", point: "Pièce nouvelle en attente tant qu’elle n’est pas confirmée", status: "fait" },
  { domain: "Finance", point: "Aucune facture émise ni numérotée par l’application", status: "fait" },
  { domain: "Pilotage", point: "Tableau de bord et comparaison de deux périodes, chiffres en base", status: "fait" },
  { domain: "Administration", point: "Journal des changements de fiche, avec l’auteur", status: "fait" },
  { domain: "Chaîne", point: "Phrase déjà reconnue traitée par une règle, avant le modèle", status: "fait" },
  { domain: "Chaîne", point: "Enveloppe de contexte : page, sélection, actions récentes, rôle, droits", status: "pas" },
  { domain: "Chaîne", point: "Faits du document sourcés, page et zone, indépendants du message", status: "pas" },
  { domain: "Chaîne", point: "Résolveur SQL, lexique, vecteurs et récence, droits avant la recherche", status: "pas" },
  { domain: "Chaîne", point: "Catalogue fermé : intention structurée, pas une action libre", status: "pas" },
  { domain: "Chaîne", point: "Complétude de chaque champ, seuil selon la criticité", status: "pas" },
  { domain: "Chaîne", point: "Question minimale : choix fermé, confirmation, ou valeur manquante", status: "pas" },
  { domain: "Chaîne", point: "Parcours borné, suspendu puis repris après la réponse", status: "pas" },
  { domain: "Chaîne", point: "Fiche de compréhension corrigeable sans reformuler le message", status: "pas" },
  { domain: "Chaîne", point: "Quatre mémoires ; une correction ne devient pas une règle globale", status: "pas" },
  { domain: "Chaîne", point: "Journal d’audit : entrée, contexte, proposition, validation, résultat", status: "pas" },
  { domain: "Projets", point: "Filtres statut, client, montant, et statuts contrôlés", status: "pas" },
  { domain: "Projets", point: "Fiche à onglets : synthèse, activité, ventes, achats, produits, documents, exécution, finance", status: "pas" },
  { domain: "Référentiels", point: "Contacts séparés et contrôle des doublons", status: "pas" },
  { domain: "Référentiels", point: "Offres fournisseur distinctes du produit, validité 30 jours", status: "pas" },
  { domain: "Ventes", point: "Statuts envoyé, consulté, accepté, refusé, expiré, et versions d’un devis envoyé", status: "pas" },
  { domain: "Ventes", point: "Livraison numérotée, facture émise et avoir", status: "pas" },
  { domain: "Achats", point: "Besoin, consultation, comparaison, commande, réception, facture, paiement", status: "pas" },
  { domain: "Documents", point: "Filtres par type, projet, tiers, date et statut", status: "pas" },
  { domain: "Finance", point: "« À facturer » distinct d’« impayé », échéances calculées", status: "pas" },
  { domain: "Finance", point: "Import de relevé et rapprochement bancaire à confirmer", status: "pas" },
  { domain: "Pilotage", point: "Question de marge traduite en indicateurs SQL, puis expliquée", status: "pas" },
  { domain: "Administration", point: "Notifications, rôles et règles automatiques", status: "pas" },
  { domain: "Hors socle", point: "Historique daté des prix d’achat et de vente", status: "pas" },
  { domain: "Hors socle", point: "Export documentaire, export comptable, sauvegarde restaurable", status: "pas" },
  { domain: "Hors socle", point: "Connecteur vers une plateforme agréée, désactivable", status: "pas" },
];

export function v2ProgressCounts(rows: V2ProgressRow[] = v2Progress): { done: number; open: number } {
  const done = rows.filter((row) => row.status === "fait").length;
  return { done, open: rows.length - done };
}
