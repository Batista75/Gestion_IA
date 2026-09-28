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

L’index des conditions est `KnowledgeChunk`. Son fonctionnement est dans [Recherche et modèles](recherche.md).

Pour un devis, la lecture des conditions est limitée au client nommé. Les pièces d’un autre client ne sont pas interrogées, même si le vecteur est calculé. Sans client unique, aucune recherche de conditions n’est lancée.

Une remise est appliquée seulement si une seule valeur est écrite, par exemple `remise de 10 %`. Deux remises différentes ne sont pas tranchées. Aucune remise inventée n’est ajoutée.

Le budget graphique, la file et les modèles sont dans [Recherche et modèles](recherche.md).

## Suite d’une demande

Le modèle n’écrit pas un devis. `prépare un devis pour …` exécute la suite dans l’application, avant le modèle :

1. Recevoir la phrase.
2. Reconnaître le client déjà enregistré et les articles du catalogue.
3. Lire les conditions de ce client seulement.
4. Lire chaque article cité : quantité, et matériel ou prestation. Une catégorie seule (`portables`, `serveurs`, `postes`, `prestations`) ne convient que s’il n’y a qu’un article de cette catégorie.
5. Lire le prix catalogue HT s’il est écrit, sinon le coût enregistré, et le stock.
6. Calculer dans `src/domain/pricing.ts`. Le prix catalogue écrit passe par `catalogUnitCents`. Sans prix catalogue, le prix unitaire vient du coût et du taux de marque 30 % (`saleLineFigures`). Le total HT additionne ces montants de ligne déjà calculés.
7. Enregistrer le devis en brouillon sur le dossier unique, ou sur le dossier nommé, seulement si chaque ligne citée est chiffrée.
8. Afficher le paquet : lignes, total HT, lien du brouillon. Le modèle ne propose pas les montants.

S’il manque le client, l’article, un prix ou un coût, ou un dossier unique, rien n’est enregistré. Le paquet dit ce qui manque. S’il y a plusieurs dossiers, le chiffrage est montré et rien n’est écrit. Un montant en dollars n’est pas converti.

## Fiabilité

Le modèle ne calcule pas le total. Le brouillon n’est pas une commande et n’est pas envoyé. La validation et l’envoi restent sur le dossier.
