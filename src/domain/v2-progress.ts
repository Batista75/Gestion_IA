export type V2Status = "fait" | "pas";

export type V2ProgressRow = {
  domain: string;
  point: string;
  status: V2Status;
  /** Instant ISO 8601 de la livraison. Vide tant que le point n’est pas fait. */
  doneAt: string;
};

/**
 * Liste affichée sur /plus. Quand une capacité de la cible V2 est livrée
 * ou retirée, mettre à jour la ligne ici.
 */
export const v2Progress: V2ProgressRow[] = [
  { domain: "Navigation", point: "Menu Accueil, Projets, Ventes, Achats, Référentiels, Finance, Pilotage, Administration", status: "fait", doneAt: "2026-09-27T07:44:10Z" },
  { domain: "Navigation", point: "Historiques, regroupements et textes hors du premier niveau", status: "fait", doneAt: "2026-09-27T07:44:10Z" },
  { domain: "Accueil", point: "Quatre zones : question, à traiter, projets récents, alertes", status: "fait", doneAt: "2026-09-27T07:44:10Z" },
  { domain: "Accueil", point: "Montant absent laissé « non indiqué »", status: "fait", doneAt: "2026-09-27T07:44:10Z" },
  { domain: "Recherche", point: "Recherche globale, résultats groupés par catégorie", status: "fait", doneAt: "2026-09-27T07:44:10Z" },
  { domain: "Projets", point: "Liste des projets ; dossier avec activité, ventes et produits", status: "fait", doneAt: "2026-09-26T21:43:31Z" },
  { domain: "Référentiels", point: "Fiches clients et fournisseurs", status: "fait", doneAt: "2026-09-26T15:23:02Z" },
  { domain: "Référentiels", point: "Article produit ou service ; coût déjà saisi non écrasé", status: "fait", doneAt: "2026-09-27T07:04:41Z" },
  { domain: "Ventes", point: "Devis brouillon : conditions du client et prix catalogue, calcul hors modèle", status: "fait", doneAt: "2026-09-27T06:49:42Z" },
  { domain: "Ventes", point: "Devis en cours vers commande client et commande fournisseur", status: "fait", doneAt: "2026-09-26T22:04:15Z" },
  { domain: "Achats", point: "Devis fournisseur proposé, écrit après confirmation", status: "fait", doneAt: "2026-09-26T18:36:22Z" },
  { domain: "Documents", point: "Liste des devis, commandes et devis reçus", status: "fait", doneAt: "2026-09-26T22:23:14Z" },
  { domain: "Documents", point: "Pièce nouvelle en attente tant qu’elle n’est pas confirmée", status: "fait", doneAt: "2026-09-26T18:36:22Z" },
  { domain: "Finance", point: "Aucune facture émise ni numérotée par l’application", status: "fait", doneAt: "2026-09-26T22:23:14Z" },
  { domain: "Pilotage", point: "Tableau de bord et comparaison de deux périodes, chiffres en base", status: "fait", doneAt: "2026-09-27T06:02:22Z" },
  { domain: "Administration", point: "Journal des changements de fiche, avec l’auteur", status: "fait", doneAt: "2026-09-27T06:27:00Z" },
  { domain: "Chaîne", point: "Phrase déjà reconnue traitée par une règle, avant le modèle", status: "fait", doneAt: "2026-09-26T20:50:13Z" },
  { domain: "Chaîne", point: "Enveloppe de contexte : page, sélection, actions récentes, rôle, droits", status: "fait", doneAt: "2026-09-27T13:38:23Z" },
  { domain: "Chaîne", point: "Faits du document sourcés, page et zone, indépendants du message", status: "pas", doneAt: "" },
  { domain: "Chaîne", point: "Résolveur SQL, lexique, vecteurs et récence, droits avant la recherche", status: "pas", doneAt: "" },
  { domain: "Chaîne", point: "Catalogue fermé : intention structurée, pas une action libre", status: "fait", doneAt: "2026-09-27T13:26:10Z" },
  { domain: "Chaîne", point: "Complétude de chaque champ, seuil selon la criticité", status: "fait", doneAt: "2026-09-27T14:05:21Z" },
  { domain: "Chaîne", point: "Question minimale : choix fermé, confirmation, ou valeur manquante", status: "fait", doneAt: "2026-09-27T14:05:21Z" },
  { domain: "Chaîne", point: "Parcours borné, suspendu puis repris après la réponse", status: "pas", doneAt: "" },
  { domain: "Chaîne", point: "Fiche de compréhension corrigeable sans reformuler le message", status: "fait", doneAt: "2026-09-27T14:20:23Z" },
  { domain: "Chaîne", point: "Quatre mémoires ; une correction ne devient pas une règle globale", status: "pas", doneAt: "" },
  { domain: "Chaîne", point: "Journal d’audit : entrée, contexte, proposition, validation, résultat", status: "pas", doneAt: "" },
  { domain: "Projets", point: "Filtres statut, client, montant, et statuts contrôlés", status: "pas", doneAt: "" },
  { domain: "Projets", point: "Fiche à onglets : synthèse, activité, ventes, achats, produits, documents, exécution, finance", status: "pas", doneAt: "" },
  { domain: "Référentiels", point: "Contacts séparés et contrôle des doublons", status: "pas", doneAt: "" },
  { domain: "Référentiels", point: "Offres fournisseur distinctes du produit, validité 30 jours", status: "pas", doneAt: "" },
  { domain: "Ventes", point: "Statuts envoyé, consulté, accepté, refusé, expiré, et versions d’un devis envoyé", status: "pas", doneAt: "" },
  { domain: "Ventes", point: "Livraison numérotée, facture émise et avoir", status: "pas", doneAt: "" },
  { domain: "Achats", point: "Besoin, consultation, comparaison, commande, réception, facture, paiement", status: "pas", doneAt: "" },
  { domain: "Documents", point: "Filtres par type, projet, tiers, date et statut", status: "pas", doneAt: "" },
  { domain: "Finance", point: "« À facturer » distinct d’« impayé », échéances calculées", status: "pas", doneAt: "" },
  { domain: "Finance", point: "Import de relevé et rapprochement bancaire à confirmer", status: "pas", doneAt: "" },
  { domain: "Pilotage", point: "Question de marge traduite en indicateurs SQL, puis expliquée", status: "pas", doneAt: "" },
  { domain: "Administration", point: "Notifications, rôles et règles automatiques", status: "pas", doneAt: "" },
  { domain: "Hors socle", point: "Historique daté des prix d’achat et de vente", status: "pas", doneAt: "" },
  { domain: "Hors socle", point: "Export documentaire, export comptable, sauvegarde restaurable", status: "pas", doneAt: "" },
  { domain: "Hors socle", point: "Connecteur vers une plateforme agréée, désactivable", status: "pas", doneAt: "" },
];

export type V2Phase = {
  order: number;
  title: string;
  state: V2Status;
  summary: string;
  doneAt: string;
};

/** Ordre de réalisation de la chaîne. La phase en cours est la première qui n’est pas faite. */
export const v2Phases: V2Phase[] = [
  {
    order: 1,
    title: "Catalogue fermé",
    state: "fait",
    summary: "Les phrases reconnues passent par une liste fermée. Le modèle cherche et explique, il n’écrit plus.",
    doneAt: "2026-09-27T13:26:10Z",
  },
  {
    order: 2,
    title: "Enveloppe de contexte",
    state: "fait",
    summary: "La page, le projet ouvert, la pièce ouverte, les pièces jointes, les actions récentes et l’opérateur accompagnent le message.",
    doneAt: "2026-09-27T13:38:23Z",
  },
  {
    order: 3,
    title: "Complétude et question unique",
    state: "fait",
    summary: "Chaque champ a un seuil. Une action encore absente pose une seule question : choix, confirmation, ou valeur manquante.",
    doneAt: "2026-09-27T14:05:21Z",
  },
  {
    order: 4,
    title: "Fiche de compréhension",
    state: "fait",
    summary: "L’écran montre l’action, ce qui est compris et le point à confirmer. Le projet, le type et le fournisseur se corrigent sur la fiche.",
    doneAt: "2026-09-27T14:20:23Z",
  },
  {
    order: 5,
    title: "Sortie JSON de l’interpréteur",
    state: "fait",
    summary: "Une demande hors règle reçoit un objet JSON du catalogue. Cette sortie ne lance pas l’action.",
    doneAt: "2026-09-27T14:32:18Z",
  },
  {
    order: 6,
    title: "Simulation avant écriture",
    state: "fait",
    summary: "Une action à risque dont la fiche est complète montre le résultat prévu. Rien n’est écrit.",
    doneAt: "2026-09-27T14:39:32Z",
  },
  {
    order: 7,
    title: "Parcours repris après réponse",
    state: "pas",
    summary: "Un traitement suspendu garde son état et reprend quand la réponse arrive.",
    doneAt: "",
  },
  {
    order: 8,
    title: "Mémoire des corrections",
    state: "pas",
    summary: "Une correction vaut pour le document concerné, pas pour une règle globale.",
    doneAt: "",
  },
  {
    order: 9,
    title: "Évaluation sur messages courts",
    state: "pas",
    summary: "Des phrases du type « Enregistre ça » servent à vérifier la chaîne.",
    doneAt: "",
  },
];

/** Date et heure de Paris, par exemple 27/09/2026 16:05. Vide si l’instant manque. */
export function formatDoneAt(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export type DoneOrder = "recent" | "ancien";

export function readDoneOrder(value: string | undefined): DoneOrder | null {
  if (value === "recent" || value === "ancien") return value;
  return null;
}

/** Les lignes datées se trient. Celles sans date restent après, dans l’ordre d’origine. */
export function orderByDoneAt<T extends { doneAt: string }>(rows: T[], order: DoneOrder): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftDated = left.row.doneAt !== "";
      const rightDated = right.row.doneAt !== "";
      if (leftDated !== rightDated) return leftDated ? -1 : 1;
      if (left.row.doneAt !== right.row.doneAt) {
        const olderFirst = left.row.doneAt < right.row.doneAt ? -1 : 1;
        return order === "ancien" ? olderFirst : -olderFirst;
      }
      return left.index - right.index;
    })
    .map((item) => item.row);
}

export function v2ProgressCounts(rows: V2ProgressRow[] = v2Progress): { done: number; open: number } {
  const done = rows.filter((row) => row.status === "fait").length;
  return { done, open: rows.length - done };
}
