# Assistant devis hybride

Ce document fixe l’intention « préparer un devis client » du catalogue fermé. Il ne décrit pas le reste de la chaîne.

## Objectif

Préparer un devis brouillon à partir d’une demande écrite. Les conditions commerciales viennent des documents du client. Les prix, le stock et l’enregistrement viennent de PostgreSQL. Le modèle local ne fait pas les calculs.

## Place dans la chaîne

`prépare un devis pour …` est exécuté par la règle métier, avant le modèle. Deux lectures restent séparées :

- Les conditions : notes du client, dossiers, devis reçus et pièces rattachées à ses dossiers.
- Les montants : clients, produits, devis et lignes dans PostgreSQL.

## Données SQL

PostgreSQL est la source des entités et des calculs. Les identifiants sont ceux déjà en base.

- Client : nom, e-mail, notes.
- Produit : référence, désignation, prix indiqué, coût indiqué, stock actuel, famille produit ou service.
- Devis : dossier, client via le dossier, date, statut, lignes.
- Ligne : article, quantité, prix unitaire HT calculé, remise lue.

Le stock vide reste « non indiqué ». Il se saisit sur la fiche article.

## Conditions du client

L’index vectoriel est la table `KnowledgeChunk`, avec `bge-m3` lorsqu’il est installé. Il n’y a pas de seconde base Chroma, Qdrant ou LanceDB.

Pour un devis, la lecture des conditions est limitée au client nommé. Les pièces d’un autre client ne sont pas interrogées, même si le vecteur est calculé. Sans client unique, aucune recherche de conditions n’est lancée.

Une remise est appliquée seulement si une seule valeur est écrite, par exemple `remise de 10 %`. Deux remises différentes ne sont pas tranchées. Aucune remise inventée n’est ajoutée.

## Modèle local

Cible : NVIDIA RTX 4080, 16 Go de mémoire graphique, 32 Go de RAM. Modèle de conversation : Qwen2.5-14B-Instruct, quantifié. Le contexte de conversation reste 4 096 jetons. Les travaux graphiques passent par la file unique.

## Suite d’une demande

Le modèle n’écrit pas un devis. `prépare un devis pour …` exécute la suite dans l’application, avant le modèle :

1. Recevoir la phrase.
2. Reconnaître le client déjà enregistré et les articles du catalogue.
3. Lire les conditions de ce client seulement.
4. Lire le prix catalogue HT et le stock de chaque article.
5. Calculer quantité × prix HT × (1 − remise) dans `catalogUnitCents`, `src/domain/pricing.ts`.
6. Enregistrer le devis en brouillon sur le dossier unique, ou sur le dossier nommé.
7. Afficher les lignes, le total HT et le lien du devis.

S’il manque le client, l’article, le prix catalogue ou un dossier unique, rien n’est enregistré. Le message dit ce qui manque. Le total HT du document utilise `saleUnitCents`, le prix déjà calculé, et non la formule de marque. S’il y a plusieurs dossiers, le chiffrage est montré et rien n’est écrit.

## Fiabilité

Le modèle ne calcule pas le total. Le brouillon n’est pas une commande et n’est pas envoyé. La validation et l’envoi restent sur le dossier.
