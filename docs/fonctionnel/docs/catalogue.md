# Catalogue fermé

L’interpréteur choisit une intention dans cette liste. Il n’en invente pas. Il ne déclenche pas l’action.

- **Enregistrer un document.** Obligatoire : document, type, société. Actions : classer, versionner, rattacher.
- **Affecter à un projet.** Obligatoire : document, projet. Action : créer le lien métier.
- **Préparer un devis client.** Obligatoire : projet, client facturé, lignes. Actions : calculer, créer un brouillon. Le calcul est celui du moteur, pas du modèle.
- **Mettre à jour un coût.** Obligatoire : projet, ligne, source. Action : créer une nouvelle hypothèse de coût. Un prix historique n’est pas écrasé.
- **Enregistrer une commande.** Obligatoire : devis accepté, client, livraison. Action : créer la commande.
- **Rapprocher un paiement.** Obligatoire : mouvement, facture ou projet. Action : proposer une ventilation.
- **Répondre à une question.** Obligatoire : question, périmètre. Actions : rechercher, expliquer. Les totaux viennent du moteur, pas du texte du modèle.

Chaque action a des préconditions, des droits, des données obligatoires, un niveau de risque, une simulation, une exécution, et une annulation quand elle est possible.

La sortie du modèle est contrainte : intention du catalogue, cibles, informations manquantes, hypothèses avec leur motif, confiance par champ. Une hypothèse cite sa raison. Exemple : le projet proposé est celui qui est ouvert.

## Complétude

La décision ne repose pas sur un score global. Une confiance élevée peut cacher une erreur sur le projet ou sur le montant. Chaque champ est évalué à part, puis un seuil dépend de sa criticité :

- type du document : confirmation sous 85 % ;
- projet : confirmation sous 90 % ;
- client facturé : confirmation avant toute émission ;
- société : confirmation sous 90 % ;
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

Pour une action encore sans exécution, les quatre étapes sont l’intention, les champs, la simulation et l’écriture. L’écriture reste en attente tant que l’action n’est pas livrée. Rien n’est écrit à la place de cette attente.

## Séparation

L’IA comprend une formulation imprécise, identifie un document, extrait des lignes, propose un projet, rapproche des désignations, suggère une TVA, prépare la matière d’un devis, suggère un rapprochement, explique un résultat.

Le moteur vérifie les préconditions, attribue l’identifiant définitif, recalcule les totaux, contrôle les droits, relie les produits, applique la TVA validée, calcule prix, marge et taxes, empêche le double comptage, et exécute la transaction. Le modèle n’est pas la source de vérité financière. Il n’a pas d’accès SQL libre : il ne voit que les outils du catalogue.
