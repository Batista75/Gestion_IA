# Écart avec les demandes

Ce chapitre liste ce que les demandes de `docs/fonctionnel` n’obtiennent pas encore. La conception livrée est le [DCT](dct.md). Une ligne pas faite de [Réalisations](realisations.md) n’est pas décrite ici comme livrée.

Aujourd’hui :

- l’enveloppe cite la page, le projet, le document ouvert et les noms de pièces, pas encore la zone dans la page ;
- une pièce jointe est lue sans la phrase : `readDocumentFacts` dans `src/domain/document-facts.ts` pose des faits avec la page et la zone ; les montants restent ceux écrits sur la pièce ;
- le rapprochement mélange mots, vecteurs et reranker, sans faire primer l’identifiant métier ni appliquer les droits avant la recherche ;
- une question explicite peut encore être expliquée par le modèle, sans écrire ; l’interpréteur JSON précède les demandes qui ne sont pas déjà des règles, et il n’exécute pas ;
- la confiance champ par champ, la question unique et la fiche de compréhension s’appliquent aux actions du catalogue encore sans exécution ;
- la simulation précède l’écriture des actions à risque encore sans exécution ; le parcours suspendu reprend après une réponse courte, et l’écriture reste en attente ;
- une correction de projet, de type ou de fournisseur est isolée dans `DocumentMemory` pour le nom de la pièce ; elle ne devient pas une règle du répertoire ;
- le journal trace les changements de fiche, pas encore l’entrée, le contexte, la proposition, la validation et le résultat d’une action de la chaîne.

Le devis préparé hors du modèle est dans [Devis hybride](devis-hybride.md).

## Hors de ce socle

L’avoir émis, l’encaissement, le rapprochement bancaire, la date d’échéance, le pack d’articles et le connecteur agréé ne sont pas implémentés. Ils restent des demandes. La facture affichée ne crée pas de titre de paiement. Le mécanisme de réimpression est dans le [DCT](dct.md).
