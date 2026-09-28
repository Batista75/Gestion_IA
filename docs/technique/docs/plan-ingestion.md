# Plan d’ingestion des pièces

Ce chapitre suit la lecture des PDF déposés. Le lecteur recopie la nature et, plus tard, les faits déjà écrits. Le modèle ne lit pas la pièce. Aucune fiche n’est écrite sans confirmation. Les contraintes de prix, de taxe et de dossier ne sont pas recopiées ici : elles restent dans le [DCT](dct.md) et la [modélisation](modelisation.md). Le rapprochement bancaire reste dans l’[écart](ecart.md).

Les contrôles de cette lecture sont des textes extraits. Ils ne sont pas chargés dans PostgreSQL et ne deviennent pas le catalogue.

## Natures

Une pièce reçoit une seule nature : demande de chiffrage, devis, commande, facture, avoir, bon de livraison, contrat, tarif, documentation technique, relevé bancaire, document, ou autre. L’acompte est un rôle de la facture, pas une nature. Une pièce sans texte reste autre.

## Lots

Chaque lot se termine par une fonction de domaine testée sans modèle. L’état ci-dessous est mis à jour quand le lot est livré. Ce n’est pas le tableau de Réalisations, ni le plan du chat.

Avancement du chantier : 1 sur 8, soit 13 %. Seul un lot marqué livré compte.

1. **Nature.** Le nom du fichier ou les premières lignes donnent une nature de la liste fermée. La facture d’acompte reste une facture, avec le rôle acompte. Une mention de devis ou de banque sur cette facture ne change pas la nature. Une pièce vide reste autre. État : livré.
2. **En-tête de devis.** Parties, devise fermée, totaux et taxes écrits, validité écrite, sur les dix devis de contrôle. État : pas commencé.
3. **Facture et acompte.** Référence, dates écrites, devise, montants écrits et deux taxes, sur la facture d’acompte de contrôle. Les coordonnées de compte restent hors champ. État : pas commencé.
4. **Demande, commande, livraison, avoir.** Les mêmes règles d’en-tête, pour que ces titres ne basculent pas. État : pas commencé.
5. **Documentation technique.** Titre, référence et fabricant. Un prix absent reste absent. État : pas commencé.
6. **Relevé bancaire.** Période et soldes écrits. Il attend un relevé de contrôle. La facture d’acompte n’en est pas un. État : pas commencé.
7. **Contrat et tarif.** Durée et montants écrits. Le mensuel et l’annuel restent deux montants. État : pas commencé.
8. **Confirmation.** Chaque nature a des fiches autorisées. Une facture ne crée pas de pièce de vente. Un relevé ne crée qu’un fichier. État : pas commencé.

Le lot 1 classe la pièce. Les montants, les dates et les parties restent pour les lots suivants. Un relevé reconnu ne crée ni client, ni fournisseur, ni article.
