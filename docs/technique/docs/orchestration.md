# Orchestration en service

Ce chapitre fixe l’ordre de traitement. L’architecture est le [DAT](dat.md). La conception d’ensemble est le [DCT](dct.md).

`POST /api/assistant` reçoit le fil, au plus 40 messages. Le dernier message utilisateur est enregistré, puis traité dans cet ordre.

1. Une phrase parlée du type « Créer le projet : … Le projet consiste à … », ou un tableau collé, est enregistrée tout de suite.
2. Une question de mesure est lue dans les enregistrements confirmés et rendue en paquet, sans modèle. L’échéance d’un contrat à 30 jours, le montant récurrent mensuel, le taux moyen, les heures non facturées, le récapitulatif de tickets, le délai d’intervention, les garanties de l’an dernier, le parc de plus de cinq ans, l’écart de facture, le reliquat, le suivi, le volume, l’encours, la sous-traitance, le résumé des réclamations du mois, les retours sous garantie encore en cours, la rentabilité d’un dossier, le stock atelier, les réceptions sans intervention, les achats non repris, la relance de facture, la relance de suivi, la demande de cotation et la trésorerie de la semaine en font partie. Le brouillon recopie le paquet. Rien n’est envoyé. La trésorerie n’enregistre ni encaissement ni pénalité. Une phrase qui enregistre un contrat, une intervention, un équipement installé, un achat, un encours, une réclamation ou un retour ouvre une proposition, sans écrire. Un achat peut nommer un dossier : le lien n’est écrit qu’après confirmation. Le garde-fou et les familles sont dans le [plan du chat](plan-chat.md).
3. Une question de prix de vente reçoit la règle métier, sans modèle.
4. `Je confirme.` enregistre la proposition la plus récente, fiche client ou autre fiche. `non` n’écrit rien. Un `oui` qui répond à une hypothèse déjà proposée du parcours reprend ce parcours, il ne confirme pas une fiche absente.
5. `prépare un devis pour …` suit l’[assistant hybride](devis-hybride.md) : plusieurs lignes, matériel ou prestation, prix catalogue ou coût avec le taux de marque, paquet, brouillon. Le modèle ne calcule pas.
6. Une question de parcours commercial, de prochaine étape ou de preuve documentaire est répondue depuis l’instruction métier, sans modèle. Un seul projet nommé fait lire ses étapes enregistrées.
7. Une consultation ou une liste est lue dans les fiches, sans modèle.
8. Une demande d’ajouter un contact ou une information, ou une correction de fiche client, relit d’abord la fiche déjà enregistrée. Si le nom est unique et que la nouvelle valeur est comprise, une proposition de mise à jour s’ouvre. Les champs non cités restent ceux de la fiche.
9. Une phrase de client ouvre une proposition.
10. Une phrase de fournisseur, de produit, de projet court ou de devis ouvre une proposition. Elle n’écrit pas.
11. Un commentaire sur une fiche client en attente produit une nouvelle proposition.
12. Un nom seul déjà connu, sans verbe d’action, demande s’il faut consulter ou modifier.

S’il ne reste rien de tout cela, `decideFree` dans `src/domain/intent-catalog.ts` tranche. Une intention du catalogue encore sans exécution passe par `blockingQuestion` dans `src/domain/completeness.ts` : le premier champ sous son seuil produit une seule question. Rien n’est écrit. La même réponse porte une fiche de compréhension. Le projet, le type ou le fournisseur se corrigent sur cette fiche (`Fiche : projet …, type …, fournisseur …`) sans remplacer le message d’origine.

Si tous les champs passent le seuil et que l’action est à risque, `simulateWrite` dans `src/domain/simulation.ts` décrit le résultat prévu. Aucun montant n’est calculé, aucun numéro de facture n’est attribué, et rien n’est écrit.

`taskSteps` dans `src/domain/task-path.ts` pose quatre étapes : intention, champs, simulation, écriture. L’écriture reste en attente. La tâche est enregistrée dans `AssistantTask`, une par fil. Tant que les champs sont suspendus, une réponse courte reprend la demande d’origine, avec la page et les pièces déjà jointes. Une commande ou une question explicite ne reprend pas le parcours.

Une correction de projet, de type ou de fournisseur est enregistrée dans `DocumentMemory`, sous le nom de la pièce. `mergeMemory` dans `src/domain/document-memory.ts` ne recopie pas cette correction sur un autre fichier. Elle ne modifie pas le répertoire. Sans pièce nommée, la correction reste sur la demande en cours.

Avant la question, `readDocumentFacts` dans `src/domain/document-facts.ts` relit le texte déjà extrait de la pièce. La phrase en cours n’est pas un argument. Chaque fait cite la page et la zone. Un montant est recopié tel qu’il est écrit. Aucun total n’est recalculé, et aucun numéro de facture n’est attribué. Un nom du répertoire trouvé dans la pièce devient un lien possible. Sans texte extrait, la réponse le dit et ne tire aucun fait de la phrase.

Une phrase d’écriture hors liste, et une phrase qui n’est ni une règle ni une question explicite, passent par `parseInterpretation` dans `src/domain/interpreter.ts`. Le modèle ne peut renvoyer que les clés `intent`, `targets`, `missing`, `hypotheses` et `confidence`, avec une intention du catalogue. Une intention d’écriture n’est pas exécutée : elle ouvre la fiche. Une question explicite, si Ollama répond, part encore au modèle pour être expliquée. S’il ne répond pas, le fil affiche l’indisponibilité.

Le modèle ne dispose plus que d’outils de lecture : `search_records`, `search_client_agreements`, `get_product_info`. Il ne propose plus de fiche et ne crée plus de brouillon. Il a au plus trois pas.

`evaluateShortMessages` dans `src/domain/short-eval.ts` rejoue des phrases courtes sur ces fonctions, sans modèle et sans base. Le tableau est sur Plus. Une phrase qui ne tient pas est un écart. Le contrôle n’écrit rien.

Chaque appel porte une enveloppe construite par l’application, dans `resolveContext`. Le client envoie seulement le chemin de la page et les noms des pièces jointes. Le serveur vérifie le projet et le document dans PostgreSQL, puis ajoute l’opérateur connecté, le rôle opérateur, les actions déjà autorisées par le catalogue, et les trois dernières modifications de fiche. Un identifiant de projet inconnu est ignoré.

## Fil et confirmation

Chaque échange est une conversation dans PostgreSQL. **Nouveau fil** crée une autre conversation. Il n’efface pas la précédente. L’accueil rouvre la plus récente, sauf si l’adresse demande un fil précis.

La réponse est un flux. L’étape visible précède le texte. Le navigateur lit ce flux avec le SDK `ai` vers l’API compatible OpenAI d’Ollama, sous `/v1`.

Une seule écriture de fiche attendue à la fois : la plus récente entre la proposition de client, la proposition de catalogue, la proposition de contrat, la proposition d’intervention, la proposition d’équipement, la proposition d’achat, la proposition d’encours, la proposition de réclamation et la proposition de retour. **Confirmer** ou `Je confirme.` l’applique. `non` n’écrit pas. La phrase parlée de projet, le tableau collé et le brouillon de devis hybride ne passent pas par cette attente. Le brouillon n’est pas envoyé. Un contrat n’est compté dans une échéance ou un montant mensuel qu’après cette confirmation. Une intervention n’entre dans un taux, des heures ou un délai qu’après la sienne. Un équipement n’entre dans une garantie ou un âge qu’après la sienne. Un achat n’entre dans un écart, un reliquat, un suivi, un volume ou une sous-traitance qu’après la sienne. Une réclamation n’entre dans le résumé du mois, et un retour n’entre dans la liste en cours, qu’après la sienne.

Si le message ne contient qu’un nom déjà enregistré, sans verbe, la réponse demande s’il faut consulter la fiche ou la modifier. Deux homonymes ne déclenchent pas cette question.

Les questions d’analyse, de recherche de preuve et de brouillon prévues ensuite sont dans le [plan du chat](plan-chat.md). Elles ne sont pas encore des règles de cette page.
