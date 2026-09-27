# Chaîne

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

L’enveloppe est construite par l’application, avant tout appel au modèle. Elle porte le message, les pièces jointes, la page et le projet ouverts, l’objet sélectionné, les actions récentes, l’identité, le rôle et les droits.

Le modèle ne fabrique pas cette enveloppe et ne choisit pas ses propres droits.

## Analyse documentaire

Ce palier lit la pièce sans s’appuyer sur la phrase. Il produit des faits sourcés, avec la page et la zone d’origine : nature du document, tiers, références, lignes, quantités, unités, montants écrits, dates et durée de validité, adresses, numéros de devis, de commande ou de facture, liens possibles avec les objets déjà enregistrés.

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

## Mémoires

Quatre mémoires restent distinctes.

- **Session** : derniers échanges et fichiers du fil.
- **Tâche** : traitement en cours, étapes faites, données encore manquantes.
- **Document** : correction de projet, de type ou de fournisseur retenue pour la pièce nommée.
- **Métier** : fournisseurs, produits, services, règles et habitudes déjà validées.

Une correction enrichit la mémoire du document ou de la tâche. Elle ne modifie pas une règle globale. « Ce devis concerne le projet Atlas, pas un autre » vaut pour ce document. Elle ne signifie pas que tous les documents du fournisseur concernent Atlas.

## Fiche de compréhension

Quand la demande est comprise, l’écran montre ce qui a été compris, le point encore à confirmer, et l’action proposée.

L’utilisateur corrige le projet, le type du document ou le fournisseur sur cette fiche, sans réécrire le message. La correction est retenue pour la pièce nommée. Elle ne devient pas une règle pour les autres documents, ni pour le fournisseur.
