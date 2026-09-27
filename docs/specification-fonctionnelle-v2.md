# Spécification fonctionnelle cible — Gestion IA V2

Ce document est la cible de revue du projet. Le [manuel](/manuel) dit ce qui fonctionne aujourd’hui. La [spécification technique](/documentation/technique) décrit le moteur livré et l’écart avec cette cible. L’avancement, fait ou pas fait, est le tableau de [Plus](/plus). Le [PDF du 26 septembre 2026](/documentation/specification) est conservé ; il ne sert plus de base de revue.

## Principe

La demande passe par une chaîne. L’IA interprète. Les règles métier contrôlent la faisabilité et l’exécution.

Un message court ne part pas seul vers le modèle. La demande comprise réunit quatre sources : le message, les pièces jointes, le contexte de l’écran, le contexte métier.

Exemple. L’utilisateur écrit « Enregistre ça ». Le fichier est un devis fournisseur, l’écran est le projet PRJ-042, le fournisseur Rive Réseaux est reconnu, une consultation est ouverte, deux références sont au catalogue, la pièce indique 30 jours de validité. L’intention devient : enregistrer une nouvelle version du devis fournisseur, la rattacher à PRJ-042, rapprocher les lignes du catalogue, actualiser les coûts proposés. L’utilisateur ne confirme que les points encore incertains.

## Chaîne

Chaque demande suit les mêmes étapes. L’application peut s’arrêter à la question ciblée, puis reprendre.

- Message et pièces jointes.
- Analyse du document, indépendante du message.
- Enrichissement par le contexte.
- Interprétation structurée.
- Informations suffisantes : sinon, une seule question ciblée.
- Plan métier validé, borné.
- Simulation, puis confirmation si le risque l’exige.
- Exécution déterministe.
- Journal, puis suggestion suivante.

## Récepteur

L’enveloppe est construite par l’application, avant tout appel au modèle. Elle porte :

- le message ;
- les pièces jointes ;
- la page et le projet ouverts ;
- l’objet sélectionné ;
- les actions récentes ;
- l’identité, le rôle et les droits.

Le modèle ne fabrique pas cette enveloppe et ne choisit pas ses propres droits.

## Analyse documentaire

Ce palier lit la pièce sans s’appuyer sur la phrase. Il produit des faits sourcés, avec la page et la zone d’origine :

- nature du document ;
- tiers ;
- références ;
- lignes, quantités, unités, montants écrits ;
- dates et durée de validité ;
- adresses ;
- numéros de devis, de commande ou de facture ;
- liens possibles avec les objets déjà enregistrés.

Les montants restent ceux de la pièce. Ils ne sont pas recalculés à ce palier.

## Résolveur de contexte

Il cherche dans les données métier : projet ouvert ou récent, client, fournisseur, commande, devis, produit ou service, prix précédent, conversation en cours, dernière action non terminée.

L’identifiant et la relation métier priment. Une recherche vectorielle seule ne prouve pas qu’un devis appartient à un projet.

L’ordre de lecture :

- requêtes et filtres sur les objets métier ;
- recherche lexicale des références et des numéros ;
- recherche vectorielle des descriptions libres, sur le lot déjà filtré ;
- récence et proximité métier ;
- droits appliqués avant la recherche.

## Interpréteur

Le modèle transforme la demande enrichie en objet structuré. Il ne déclenche pas l’action. La sortie est contrainte par un schéma : intention du catalogue, cibles, suite demandée, informations manquantes, hypothèses avec leur motif, confiance par champ.

Une hypothèse cite sa raison. Exemple : le projet proposé est celui qui est ouvert.

## Catalogue fermé

L’interpréteur choisit une intention dans cette liste. Il n’en invente pas.

- **Enregistrer un document.** Obligatoire : document, type, société. Actions : classer, versionner, rattacher.
- **Affecter à un projet.** Obligatoire : document, projet. Action : créer le lien métier.
- **Préparer un devis client.** Obligatoire : projet, client facturé, lignes. Actions : calculer, créer un brouillon. Le calcul est celui de [l’assistant devis hybride](/documentation/devis-hybride).
- **Mettre à jour un coût.** Obligatoire : projet, ligne, source. Action : créer une nouvelle hypothèse de coût. Un prix historique n’est pas écrasé.
- **Enregistrer une commande.** Obligatoire : devis accepté, client, livraison. Action : créer la commande.
- **Rapprocher un paiement.** Obligatoire : mouvement, facture ou projet. Action : proposer une ventilation.
- **Répondre à une question.** Obligatoire : question, périmètre. Actions : rechercher, expliquer. Les totaux viennent du moteur, pas du texte du modèle.

Chaque action a des préconditions, des droits, des données obligatoires, un niveau de risque, une simulation, une exécution, et une annulation quand elle est possible.

## Complétude

La décision ne repose pas sur un score global. Une confiance élevée peut cacher une erreur sur le projet ou sur le montant. Chaque champ est évalué à part, puis un seuil dépend de sa criticité :

- type du document : confirmation sous 85 % ;
- projet : confirmation sous 90 % ;
- client facturé : confirmation avant toute émission ;
- TVA : règle métier, pas une suggestion libre ;
- montant : rapprochement obligatoire avec la source ;
- action irréversible : confirmation explicite.

## Question ciblée

La question ne demande pas « davantage d’informations ». Elle porte sur la seule donnée bloquante. Trois formes suffisent :

- choix fermé, par exemple deux projets nommés ;
- confirmation d’une hypothèse déjà solide, par exemple le projet ouvert ;
- valeur manquante, par exemple l’adresse de livraison.

## Plan borné

Le planificateur ne compose pas librement une suite d’actions. Un orchestrateur à états suit un parcours prévu pour l’intention. Chaque étape est en attente, en cours, terminée, ou suspendue pour une réponse humaine. L’état est conservé et reprend après la réponse.

Exemple pour préparer un devis client : lire les devis fournisseur, comparer les lignes, traiter les prix expirés, calculer le prix dans le moteur, créer le brouillon.

## Séparation

L’IA comprend une formulation imprécise, identifie un document, extrait des lignes, propose un projet, rapproche des désignations, suggère une TVA, prépare la matière d’un devis, suggère un rapprochement, explique un résultat.

Le moteur vérifie les préconditions, attribue l’identifiant définitif, recalcule les totaux, contrôle les droits, relie les produits, applique la TVA validée, calcule prix, marge et taxes, empêche le double comptage, et exécute la transaction. Le modèle n’est pas la source de vérité financière. Il n’a pas d’accès SQL libre : il ne voit que les outils du catalogue.

## Mémoires

Quatre mémoires restent distinctes.

- **Session** : derniers échanges et fichiers du fil.
- **Tâche** : traitement en cours, étapes faites, données encore manquantes.
- **Projet** : clients, documents, hypothèses, décisions, commandes, événements.
- **Métier** : fournisseurs, produits, services, règles et habitudes déjà validées.

Une correction enrichit la mémoire du document ou de la tâche. Elle ne modifie pas une règle globale. « Ce devis concerne PRJ-042, pas PRJ-036 » vaut pour ce document. Elle ne signifie pas que tous les documents du fournisseur concernent PRJ-042.

## Fiche de compréhension

Quand la demande est comprise, l’écran montre :

- ce qui a été compris, en phrases courtes ;
- le point encore à confirmer ;
- l’action proposée.

L’utilisateur corrige le projet, le type du document ou le fournisseur sur cette fiche, sans réécrire le message.

## Périmètre métier

Le projet reste l’unité centrale : clients, contacts, besoins, produits et services, devis, commandes, achats, fournisseurs, livraisons, factures, documents, activité, échéances, situation financière.

Le menu reste Accueil, Projets, Ventes, Achats, Référentiels, Finance, Pilotage, Administration. La recherche globale est dans la barre du haut. Les historiques de lignes, les regroupements et les textes restent hors du premier niveau.

L’accueil garde quatre zones : la demande, à traiter, les projets récents, les alertes. Un montant absent reste « non indiqué ».

Les pièces se classent en devis client ou fournisseur, commande, facture, bon de livraison, demande de prix, document technique, contrat ou information libre.

Un article est un produit ou un service : référence, désignation, famille, unité, description, fournisseur, coût unitaire écrit, devise, date de saisie. L’offre fournisseur est un objet distinct : fournisseur, référence fournisseur, prix, devise, quantité minimale, remise, port, délai, date, validité. Un prix sans durée écrite vaut 30 jours, durée configurable. Un prix historique n’est pas écrasé.

Ventes : devis, commandes, livraisons, factures, avoirs. Un devis brouillon n’est pas envoyé. Les statuts envoyé, consulté, accepté, refusé et expiré, et les versions d’un devis envoyé, font partie de la cible.

Achats : besoin, consultation, devis fournisseur, comparaison, commande, réception, facture, paiement.

Finance : facturation, échéances, banque, journaux. « À facturer » n’est pas « impayé ». Le rapprochement bancaire est une proposition. L’application n’émet ni ne numérote de facture, et n’initie pas de paiement.

Pilotage : le tableau de bord et la comparaison de deux périodes lisent la base. Une question de marge est traduite en indicateurs, calculée, puis expliquée.

La fiche projet réunit synthèse, activité, ventes, achats, produits et services, documents, exécution et finance. Les statuts de projet sont contrôlés : à qualifier, en préparation, en négociation, gagné, en exécution, livré, à facturer, clôturé, perdu, suspendu.

Les contacts sont des fiches séparées. Les doublons sont signalés avant création. Les documents se filtrent par type, projet, tiers, date et statut. Une pièce nouvelle reste à traiter tant qu’elle n’est pas confirmée.

Les notifications, les rôles et les règles automatiques font partie de la cible. Le journal d’audit conserve l’entrée, le contexte, la proposition, la validation et le résultat.

## Composants

Les rôles de la chaîne sont des modules de l’application en place.

- Réception et coordination : route de l’assistant, enveloppe de contexte.
- Données, états et audit : PostgreSQL.
- Originaux, versions et empreintes : fichiers locaux.
- Lecture des pièces : `pdftotext`, Docling, Tesseract. Les montants écrits restent bruts.
- Interprétation : Ollama sur le PC hôte, sortie JSON contrainte par le schéma de l’intention.
- Contrats : types TypeScript du catalogue.
- Parcours : états enregistrés en base, reprise après la réponse.
- Règles et prix : `src/domain`.
- Recherche : SQL, lexique, puis `KnowledgeChunk` sur le lot filtré.
- Travaux du modèle : file unique déjà utilisée pour la carte graphique.

Un second serveur, un autre moteur d’inférence, un orchestrateur externe ou un autre OCR ne font pas partie de la cible. Ils doubleraient le socle sans changer les rôles.

## Ordre de réalisation

1. Catalogue fermé d’intentions et d’actions. Cette phase est en service : les écritures connues passent par les règles, le modèle ne fait que chercher et expliquer. Le détail est le tableau des phases de [Plus](/plus).
2. Enveloppe de contexte transmise par l’interface.
3. Sorties JSON contraintes.
4. Complétude champ par champ.
5. Questions ciblées.
6. Simulation avant écriture.
7. Parcours persistant, avec reprise.
8. Mémoire des corrections validées.
9. Évaluation sur de vrais messages courts.

Le critère de succès : la plupart des tâches partent d’un document déposé, d’une question, ou d’un projet ouvert, et une phrase minimale devient une proposition vérifiable.
