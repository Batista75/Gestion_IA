# Spécification technique

Ce document décrit le socle qui tourne au 27 septembre 2026. La cible de revue est la [spécification V2](/documentation/v2) : une chaîne où le modèle interprète et les règles exécutent. Le [PDF d’origine](/documentation/specification) est conservé, il n’est plus la base de revue. Le [manuel](/manuel) dit ce que l’on fait à l’écran. Ici, c’est le fonctionnement, puis l’écart avec la chaîne.

## Socle

Application Next.js, React et TypeScript, sur le réseau local. PostgreSQL est sur la même machine. Ollama est sur le PC hôte du réseau, par défaut `http://192.168.1.5:11434`. En NAT VirtualBox, l’adresse de repli est `http://10.0.2.2:11434`. Aucun service d’IA public n’est appelé.

L’accueil sert l’assistant. Le port de développement est `3847`.

Les prix, la TVA et les numéros de pièce ne sont pas calculés par le modèle. Les formules de prix de vente sont dans `src/domain/pricing.ts`. Un montant écrit par l’utilisateur est conservé tel quel.

## Orchestration en service

`POST /api/assistant` reçoit le fil, au plus 40 messages. Le dernier message utilisateur est enregistré, puis traité dans cet ordre. Ce traitement est une suite de règles, puis un relais au modèle si aucune règle ne reconnaît la phrase. La cible V2 retire ce relais libre : une demande non couverte par le catalogue pose une question ciblée, elle n’invente pas une action.

1. Une phrase parlée du type « Créer le projet : … Le projet consiste à … », ou un tableau collé, est enregistrée tout de suite.
2. Une question de prix de vente reçoit la règle métier, sans modèle.
3. `Je confirme.` enregistre la proposition la plus récente, fiche client ou autre fiche. `non` n’écrit rien.
4. `prépare un devis pour …` suit l’assistant hybride : client en SQL, conditions filtrées sur ce client, prix catalogue, brouillon. Le modèle ne calcule pas.
5. Une question de parcours commercial, de prochaine étape ou de preuve documentaire est répondue depuis l’instruction métier, sans modèle. Un seul projet nommé fait lire ses étapes enregistrées.
6. Une consultation ou une liste est lue dans les fiches, sans modèle.
7. Une demande d’ajouter un contact ou une information, ou une correction, relit d’abord la fiche client déjà enregistrée. Si le nom est unique et que la nouvelle valeur est comprise, une proposition de mise à jour s’ouvre. Les champs non cités restent ceux de la fiche. Une note nouvelle s’ajoute à la note déjà écrite. Si la valeur manque, la réponse décrit la fiche et demande le contact ou l’information, sans proposition.
8. Une phrase de client ouvre une proposition.
9. Une phrase de fournisseur, de produit, de projet court ou de devis ouvre une proposition. Elle n’écrit pas.
10. Un commentaire sur une fiche client en attente produit une nouvelle proposition.
11. Un nom seul déjà connu, sans verbe d’action, demande s’il faut consulter ou modifier.

S’il ne reste rien de tout cela, `decideFree` dans `src/domain/intent-catalog.ts` tranche. Une intention du catalogue encore sans exécution passe par `blockingQuestion` dans `src/domain/completeness.ts` : le premier champ sous son seuil produit une seule question, un choix fermé, une confirmation, ou une valeur manquante. Rien n’est écrit. La même réponse porte une fiche de compréhension : l’action, les champs au-dessus de leur seuil, et le point à confirmer. Le projet, le type ou le fournisseur se corrigent sur cette fiche (`Fiche : projet …, type …, fournisseur …`) sans remplacer le message d’origine. Si tous les champs passent le seuil et que l’action est à risque, `simulateWrite` dans `src/domain/simulation.ts` décrit le résultat prévu. Aucun montant n’est calculé, aucun numéro de facture n’est attribué, et rien n’est écrit. `taskSteps` dans `src/domain/task-path.ts` pose quatre étapes : intention, champs, simulation, écriture. L’écriture reste en attente. La tâche est enregistrée dans `AssistantTask`, une par fil. Tant que les champs sont suspendus, une réponse courte reprend la demande d’origine, avec la page et les pièces déjà jointes. `oui` confirme seulement une hypothèse déjà proposée. Une commande ou une question explicite ne reprend pas le parcours. Une phrase d’écriture hors liste, et une phrase qui n’est ni une règle ni une question explicite, passent par `parseInterpretation` dans `src/domain/interpreter.ts`. Le modèle ne peut renvoyer que les clés `intent`, `targets`, `missing`, `hypotheses` et `confidence`, avec une intention du catalogue. Une intention d’écriture n’est pas exécutée : elle ouvre la fiche. Une question explicite, si Ollama répond, part encore au modèle pour être expliquée. S’il ne répond pas, le fil affiche l’indisponibilité. La consultation des fiches continue par les mots.

Le modèle ne dispose plus que d’outils de lecture : `search_records`, `search_client_agreements`, `get_product_info`. Il ne propose plus de fiche et ne crée plus de brouillon. Le brouillon de devis reste la règle `prépare un devis pour …`, exécutée avant lui. Il a au plus trois pas. Il ne numérote pas de facture et ne calcule pas de montant.

Chaque appel porte une enveloppe construite par l’application, dans `resolveContext`. Le client envoie seulement le chemin de la page et les noms des pièces jointes. Le serveur vérifie le projet et le document dans PostgreSQL, puis ajoute l’opérateur J Smith, le rôle opérateur, les actions déjà autorisées par le catalogue, et les trois dernières modifications de fiche. Un identifiant de projet inconnu est ignoré. La réponse d’une action encore absente rappelle ce contexte. Le modèle le reçoit aussi, sans pouvoir le réécrire.

## Devis hybride

La préparation d’un devis sépare les conditions écrites et les montants. Le détail est dans [Assistant devis hybride](/documentation/devis-hybride).

Le client, le catalogue, le stock et le devis sont dans PostgreSQL. Le prix unitaire HT d’un brouillon est le prix catalogue indiqué, moins la remise écrite pour ce client : quantité × prix HT × (1 − remise). Cette formule est dans `catalogUnitCents`. Elle ne passe pas par le modèle. Sans prix catalogue, la ligne n’est pas chiffrée. Plusieurs remises différentes ne sont pas tranchées.

Les conditions viennent des notes du client, de ses dossiers, des devis reçus rattachés et des pièces de ces dossiers. Une recherche de devis ne lit pas les pièces d’un autre client. Le vecteur, s’il est calculé, ne classe que ce lot. L’index général reste `KnowledgeChunk`, avec `bge-m3`. Il n’y a pas de base Chroma, Qdrant ou LanceDB séparée.

Le devis est créé au statut `brouillon`, sur le dossier unique du client, ou sur le dossier nommé. Aucun envoi n’est fait. S’il y a plusieurs dossiers, le chiffrage est montré et rien n’est écrit. Le total HT du document utilise `saleUnitCents`, le prix déjà calculé, et non la formule de marque.

## Fil et étapes

Chaque échange est une conversation dans PostgreSQL : titre tiré du premier message, messages, étape, proposition et sources. **Nouveau fil** crée une autre conversation. Il n’efface pas la précédente. L’accueil rouvre la plus récente, sauf si l’adresse demande un fil précis.

Si un message cite un seul projet déjà nommé, la conversation lui est liée. La note et les fichiers de Pièces reçues ne le sont pas.

La réponse est un flux. L’étape visible précède le texte : lecture des fiches, règle métier, proposition, enregistrement, ou recherche. Le navigateur lit ce flux avec le SDK `ai` (`useChat`, `DefaultChatTransport`) vers l’API compatible OpenAI d’Ollama, sous `/v1`.

Le composant de fil `assistant-ui` n’est pas utilisé. Le bloc de l’accueil garde les pièces jointes et le bouton **Confirmer**.

## Confirmation

Une seule écriture attendue à la fois : la plus récente entre la proposition de client et la proposition de catalogue.

- **Confirmer** ou `Je confirme.` l’applique.
- `non` n’écrit pas. La proposition de client reste pour être corrigée. La proposition de fournisseur, de produit, de projet ou de devis est écartée.
- La phrase parlée de projet, le tableau collé et le brouillon de devis hybride ne passent pas par cette attente. Le brouillon n’est pas envoyé.

## Nom ambigu

Si le message ne contient qu’un nom déjà enregistré, sans verbe de création, de modification ou de consultation, la réponse est : ce nom est déjà enregistré, voulez-vous consulter la fiche ou la modifier ? Deux homonymes ne déclenchent pas cette question. `que sait-on de …` reste une consultation.

## Recherche dans les fiches

La recherche élargie réunit le tri par les mots, le tri vectoriel et le tri hybride, au plus 12 fiches. Le reranker, s’il répond, ne garde que les passages qui répondent à la question. Un score trop bas écarte la fiche. Si le reranker manque ou si ses scores ne départagent rien, l’ordre hybride est gardé. Une liste du répertoire ne passe pas par le reranker.

Sans embeddings, la recherche par les mots continue. Le passage envoyé au reranker reprend les lignes qui portent les mots de la question.

Un PDF qui a déjà une couche de texte est lu par `pdftotext`, sans charger le modèle de mise en page. Le lecteur en retire le type, les parties, le numéro, la date, les lignes chiffrées et le total imprimé. Les montants restent ceux de la pièce : un prix `EUR 2.170,00` ou `21 109.75` n’est pas réécrit, et les lignes ne sont pas additionnées. Un composant sans prix reste dans le descriptif de la ligne. Docling, sur le processeur, ne sert que si cette couche manque, ou pour un document Word, un tableur, une présentation ou une image.

Quand Docling est utilisé, il reste sur le processeur. Les modèles de mise en page sont dans `data/docling`. Le GPU reste réservé à Ollama. Il rend un markdown, puis son découpage hybride fournit les passages. Sans ces passages, l’application découpe le texte par titres et garde un tableau entier. Chaque passage est une fiche Pièce, à côté du résumé commercial. Une pièce déjà enregistrée sans couche de texte exploitable est relue une fois, au fil des recherches. Un PDF déjà lisible n’est pas renvoyé au modèle. Sans Docling, l’extraction Word reste le repli. Le fichier est conservé même si aucun texte n’est lu.

Le contexte donné au modèle est limité à 4 fiches. Une consultation en affiche au plus 5. Le texte d’une fiche client, fournisseur ou produit reprend aussi jusqu’à cinq lignes de modifications, datées, pour qu’une question du type `que sait-on de …` puisse citer la trace.

## Journal des modifications

Chaque création, mise à jour et suppression d’un client, d’un fournisseur, d’un produit ou d’un projet écrit une ligne `RecordEvent` : type, identifiant, nom, action, résumé, source et horodatage. Le résumé ne cite que les champs qui changent, sous la forme `ancien → nouveau`. Un champ vide à l’origine est « non renseigné », un champ vidé est « retiré ». Une mise à jour sans différence n’écrit pas de ligne.

La source vient du contexte d’appel : `assistant` pour une confirmation, un dossier parlé ou une pièce confirmée ; `formulaire` pour les écrans ; sinon `application`. L’écriture est branchée sur le client Prisma, afin qu’un appel oublié reste tracé. Clients, Fournisseurs, Produits et Projets affichent les dernières lignes. L’actualité d’un projet reste distincte : elle décrit le dossier, le journal décrit les changements de fiche.

## Modèles et GPU

Trois rôles, choisis dans Configuration : conversation, embeddings, reranker. **Automatique**, si les modèles sont installés : Qwen2.5-14B-Instruct en Q4_K_M (souvent `qwen2.5:14b`), `bge-m3`, `bge-reranker-v2-m3`.

Le budget est un utilisateur, 16 Go de mémoire graphique et 32 Go de RAM. Les travaux GPU passent par une file unique. Elle ne s’appelle pas elle-même. L’ordre est : embeddings, reranker, puis conversation. Les deux premiers se déchargent. La conversation garde un contexte de 4 096 jetons, une température de 0,1, et reste chargée dix minutes.

La clé d’API n’est envoyée qu’en en-tête `Authorization` vers cet hôte privé. Une adresse publique est refusée. L’écran de santé ne teste que la base.

## Vue projet

`/projets/[id]` charge le client lié (`Project.clientId`), le contexte du dossier, la livraison, les lignes `ProjectLine` et les documents `SaleDocument`. Le client, le produit et le fournisseur se choisissent dans les listes du répertoire. Le catalogue `Product` est unique : une ligne de dossier pointe vers un produit, elle n’en crée pas un autre. La livraison est saisie sur le dossier : destinataire, adresse, contact, créneau et mode. Elle est recopiée sur les pièces, sans devenir un bon de livraison numéroté. Une ligne porte un coût en centimes, un taux de marque et une remise, entiers de 0 à 99. Le prix de vente et la marge passent par `quoteFromTargetMarkup` dans `src/domain/pricing.ts`. Un coût absent laisse le prix non indiqué. Le total n’additionne que les lignes chiffrées.

Établir un devis copie les lignes sélectionnées. Un devis en cours devient une commande client, ou un devis non abouti. Une commande client ouvre une commande fournisseur par fournisseur nommé. Confirmer les chiffres écrit la date dans l’actualité du projet. Reprendre les chiffres retire cette confirmation. Aucun numéro de facture n’est attribué.

`/projets/[id]/documents/[documentId]` présente la pièce. Le devis et la commande client affichent le prix de vente HT. La commande fournisseur affiche le coût d’achat. `/projets/[id]/facture` reprend la dernière commande client et la référence saisie sur l’étape Facturation. Elle n’écrit pas de numéro. L’en-tête vient de `CompanyProfile` : raison sociale, coordonnées et logo dans `data/entreprise`. Le logo est servi par `GET /api/entreprise/logo`.

La fiche projet montre les produits et les devis dans la colonne principale, et le tableau des neuf étapes à droite sur un grand écran. Une seule étape est ouverte pour la saisie. Le parcours commercial est `ProjectStep`, une ligne par étape et par projet. Les neuf étapes, leurs actions et leurs preuves sont dans `src/domain/trade-workflow.ts` (`TRADE_STEPS`). Le fichier lu à l’écran et ajouté au prompt du modèle est `instructions/metiers/achat-revente-technologies.md`. Une situation « fait » exige une référence d’au moins deux caractères. L’avertissement d’ordre est indicatif : les étapes de remise et de réception attendent l’expédition, la facturation attend un bon de livraison ou un procès-verbal. `asksTradeWorkflow` répond avant la consultation des fiches. Si un seul projet est nommé, `listProjectSteps` et `projectTradeReply` décrivent la prochaine preuve.

## Ergonomie des rubriques

Le menu est un rail à gauche : Accueil, Projets, Ventes, Achats, Référentiels, Finance, Pilotage, Administration. Administration contient Plus (`/plus`). Le tableau de cette page lit `v2Progress` dans `src/domain/v2-progress.ts` : chaque ligne a un domaine, un point, l’état `fait` ou `pas`, et `doneAt`, l’instant de livraison affiché en heure de Paris. Une ligne pas faite n’a pas de date. `ordre=recent` ou `ordre=ancien` trie les lignes datées ; les lignes sans date restent après. La barre du haut porte la raison sociale, la recherche globale, Configuration et le manuel. Sur un écran étroit, le rail s’ouvre par **Menu**.

Les listes partagent la même coquille : titre, recherche, filtres, choix de 10, 25, 50 ou 100 lignes, pagination, export CSV (`GET /api/tableaux`). Les montants HT des pièces produites passent par `saleLineFigures` et `saleOperationTotals`. Un total imprimé sur un devis reçu reste le texte de la pièce. Aucune liste n’attribue de numéro.

- **Devis client** (`/suivi`) est le tableau des devis du dossier, filtré par situation et par client.
- **Projets** (`/projets`) place le tableau des dossiers en haut, avec le bouton Nouveau dossier, et le journal des modifications et des actions en bas. L’auteur est l’initiale du prénom et le nom (`operatorMark` dans `src/domain/operator.ts`). L’utilisateur en place est Jhon Smith, affiché J Smith. `RecordEvent.actor` garde cette marque. Le mot de passe n’est pas demandé.
- **Documents** (`/listes/documents`) mêle devis, commandes client, commandes fournisseur et devis reçus. Colonnes : type, date, référence du dossier, client ou fournisseur, projet, montant HT, situation. Chaque ligne a un téléchargement : HTML pour une pièce produite (`GET /api/ventes/[id]`), fichier d’origine pour un devis reçu qui en a un.
- **Clients, fournisseurs, articles** gardent la saisie sous le tableau. Un article fournisseur est un produit ou un service. La pièce jointe d’un devis confirme référence, désignation, famille, coût unitaire écrit, devise et fournisseur. La date de saisie est la création. Le montant n’est pas recalculé.
- **Regroupements** (`/listes/regroupements`) groupe le catalogue par fournisseur. Un pack au prix ajusté n’existe pas.
- **Historiques lignes** (`/listes/lignes`) donne une ligne de tableau par ligne de pièce.
- **Échéances** (`/listes/echeances`) liste les commandes client. La facturation est « À facturer » ou « Référence enregistrée ». Le paiement est « Non suivi ». Aucune date d’échéance et aucun coût de retard ne sont calculés.
- **Textes** (`/listes/textes`) reprend les conditions de devis reçu, les descriptions d’articles et les consignes de livraison.
- **Tableau de bord** (`/pilotage`) compte les devis en attente, les commandes client, le chiffre d’affaires HT de ces commandes et les projets. Il classe les articles et les clients des commandes. Les impayés sont le nombre de commandes sans référence de facture.
- **Tableau d’analyse** (`/pilotage/analyse`) compare deux périodes : chiffre d’affaires HT, nombre de commandes, nombre de devis, marge HT. L’écart est la seconde période moins la première. `periodGap` dans `src/domain/board.ts` calcule le pourcentage. Si la première valeur est nulle et la seconde ne l’est pas, le pourcentage reste « — ».
- **Journal des ventes** (`/comptabilite/journal`) filtre par dates et par cases : ventes, paiements, TVA sur encaissements, paiements en attente. Seule la case Ventes alimente le tableau. Les trois autres rappellent que le paiement et la TVA ne sont pas tenus.

## Écart avec la chaîne cible

La chaîne décrite dans la spécification V2 n’est pas le chemin par défaut. Aujourd’hui :

- l’enveloppe cite la page, le projet, le document ouvert et les noms de pièces, pas encore la zone dans la page ;
- l’analyse d’une pièce dépend encore du message ;
- le rapprochement mélange mots, vecteurs et reranker, sans faire primer l’identifiant métier ni appliquer les droits avant la recherche ;
- une question explicite peut encore être expliquée par le modèle, sans écrire ; l’interpréteur JSON précède les demandes qui ne sont pas déjà des règles, et il n’exécute pas ;
- la confiance champ par champ, la question unique et la fiche de compréhension s’appliquent aux actions du catalogue encore sans exécution ;
- la simulation précède l’écriture des actions à risque encore sans exécution ; le parcours suspendu reprend après une réponse courte, et l’écriture reste en attente ;
- une correction n’est pas isolée dans la mémoire du document ;
- le journal trace les changements de fiche, pas encore l’entrée, le contexte, la proposition, la validation et le résultat.

Deux bornes sont déjà en place et restent la référence des règles : `prépare un devis pour …` calcule hors du modèle, et les outils d’écriture du catalogue ne font que proposer. Le détail du devis est dans [Assistant devis hybride](/documentation/devis-hybride).

## Hors de ce socle

L’avoir, l’encaissement, le rapprochement bancaire, la date d’échéance, le pack d’articles et le connecteur agréé ne sont pas implémentés. Ils restent dans la spécification V2. La facture affichée ne crée pas de titre de paiement : elle montre la référence déjà saisie. La commande client et la commande fournisseur de la vue projet préparent l’opération, sans numéro de pièce ni transmission.
