# Spécification technique

Ce document décrit le socle qui tourne au 26 septembre 2026. Il ne remplace pas la [spécification fonctionnelle (PDF)](/documentation/specification), qui reste le cadre du produit visé. Le [manuel](/manuel) dit ce que l’on fait à l’écran. Ici, c’est le fonctionnement.

## Socle

Application Next.js, React et TypeScript, sur le réseau local. PostgreSQL est sur la même machine. Ollama est sur le PC hôte du réseau, par défaut `http://192.168.1.5:11434`. En NAT VirtualBox, l’adresse de repli est `http://10.0.2.2:11434`. Aucun service d’IA public n’est appelé.

L’accueil sert l’assistant. Le port de développement est `3847`.

Les prix, la TVA et les numéros de pièce ne sont pas calculés par le modèle. Les formules de prix de vente sont dans `src/domain/pricing.ts`. Un montant écrit par l’utilisateur est conservé tel quel.

## Orchestration

`POST /api/assistant` reçoit le fil, au plus 40 messages. Le dernier message utilisateur est enregistré, puis traité dans cet ordre.

1. Une phrase parlée du type « Créer le projet : … Le projet consiste à … », ou un tableau collé, est enregistrée tout de suite.
2. Une question de prix de vente reçoit la règle métier, sans modèle.
3. `Je confirme.` enregistre la proposition la plus récente, fiche client ou autre fiche. `non` n’écrit rien.
4. Une question de parcours commercial, de prochaine étape ou de preuve documentaire est répondue depuis l’instruction métier, sans modèle. Un seul projet nommé fait lire ses étapes enregistrées.
5. Une consultation ou une liste est lue dans les fiches, sans modèle.
6. Une demande d’ajouter un contact ou une information, ou une correction, relit d’abord la fiche client déjà enregistrée. Si le nom est unique et que la nouvelle valeur est comprise, une proposition de mise à jour s’ouvre. Les champs non cités restent ceux de la fiche. Une note nouvelle s’ajoute à la note déjà écrite. Si la valeur manque, la réponse décrit la fiche et demande le contact ou l’information, sans proposition.
7. Une phrase de client ouvre une proposition.
8. Une phrase de fournisseur, de produit, de projet court ou de devis ouvre une proposition. Elle n’écrit pas.
9. Un commentaire sur une fiche client en attente produit une nouvelle proposition.
10. Un nom seul déjà connu, sans verbe d’action, demande s’il faut consulter ou modifier.

S’il ne reste rien de tout cela, et si Ollama répond, le modèle de conversation prend le relais. S’il ne répond pas, le fil affiche l’indisponibilité. La consultation des fiches continue par les mots.

Le modèle dispose d’outils. `search_records` relit les fiches. Les autres outils, client, fournisseur, produit, projet et devis, ne font que proposer. Le modèle a au plus trois pas. Il ne numérote pas de facture et ne calcule pas de montant.

## Fil et étapes

Chaque échange est une conversation dans PostgreSQL : titre tiré du premier message, messages, étape, proposition et sources. **Nouveau fil** crée une autre conversation. Il n’efface pas la précédente. L’accueil rouvre la plus récente, sauf si l’adresse demande un fil précis.

Si un message cite un seul projet déjà nommé, la conversation lui est liée. La note et les fichiers de Pièces reçues ne le sont pas.

La réponse est un flux. L’étape visible précède le texte : lecture des fiches, règle métier, proposition, enregistrement, ou recherche. Le navigateur lit ce flux avec le SDK `ai` (`useChat`, `DefaultChatTransport`) vers l’API compatible OpenAI d’Ollama, sous `/v1`.

Le composant de fil `assistant-ui` n’est pas utilisé. Le bloc de l’accueil garde les pièces jointes et le bouton **Confirmer**.

## Confirmation

Une seule écriture attendue à la fois : la plus récente entre la proposition de client et la proposition de catalogue.

- **Confirmer** ou `Je confirme.` l’applique.
- `non` n’écrit pas. La proposition de client reste pour être corrigée. La proposition de fournisseur, de produit, de projet ou de devis est écartée.
- La phrase parlée de projet et le tableau collé ne passent pas par cette attente.

## Nom ambigu

Si le message ne contient qu’un nom déjà enregistré, sans verbe de création, de modification ou de consultation, la réponse est : ce nom est déjà enregistré, voulez-vous consulter la fiche ou la modifier ? Deux homonymes ne déclenchent pas cette question. `que sait-on de …` reste une consultation.

## Recherche dans les fiches

La recherche élargie réunit le tri par les mots, le tri vectoriel et le tri hybride, au plus 12 fiches. Le reranker, s’il répond, ne garde que les passages qui répondent à la question. Un score trop bas écarte la fiche. Si le reranker manque ou si ses scores ne départagent rien, l’ordre hybride est gardé. Une liste du répertoire ne passe pas par le reranker.

Sans embeddings, la recherche par les mots continue. Le passage envoyé au reranker reprend les lignes qui portent les mots de la question.

Le contexte donné au modèle est limité à 4 fiches. Une consultation en affiche au plus 5. Le texte d’une fiche client, fournisseur ou produit reprend aussi jusqu’à cinq lignes de modifications, datées, pour qu’une question du type `que sait-on de …` puisse citer la trace.

## Journal des modifications

Chaque création, mise à jour et suppression d’un client, d’un fournisseur, d’un produit ou d’un projet écrit une ligne `RecordEvent` : type, identifiant, nom, action, résumé, source et horodatage. Le résumé ne cite que les champs qui changent, sous la forme `ancien → nouveau`. Un champ vide à l’origine est « non renseigné », un champ vidé est « retiré ». Une mise à jour sans différence n’écrit pas de ligne.

La source vient du contexte d’appel : `assistant` pour une confirmation, un dossier parlé ou une pièce confirmée ; `formulaire` pour les écrans ; sinon `application`. L’écriture est branchée sur le client Prisma, afin qu’un appel oublié reste tracé. Clients, Fournisseurs, Produits et Projets affichent les dernières lignes. L’actualité d’un projet reste distincte : elle décrit le dossier, le journal décrit les changements de fiche.

## Modèles et GPU

Trois rôles, choisis dans Configuration : conversation, embeddings, reranker. **Automatique**, si les modèles sont installés : Qwen2.5-14B-Instruct en Q4_K_M (souvent `qwen2.5:14b`), `bge-m3`, `bge-reranker-v2-m3`.

Le budget est un utilisateur, 16 Go de mémoire graphique et 32 Go de RAM. Les travaux GPU passent par une file unique. Elle ne s’appelle pas elle-même. L’ordre est : embeddings, reranker, puis conversation. Les deux premiers se déchargent. La conversation garde un contexte de 4 096 jetons, une température de 0,1, et reste chargée dix minutes.

La clé d’API n’est envoyée qu’en en-tête `Authorization` vers cet hôte privé. Une adresse publique est refusée. L’écran de santé ne teste que la base.

## Vue projet

`/projets/[id]` charge le client du répertoire quand le nom correspond, le contexte du dossier, la livraison, les lignes `ProjectLine` et les documents `SaleDocument`. La livraison est saisie sur le dossier : destinataire, adresse, contact, créneau et mode. Elle est recopiée sur les pièces, sans devenir un bon de livraison numéroté. Une ligne porte un coût en centimes, un taux de marque et une remise, entiers de 0 à 99. Le prix de vente et la marge passent par `quoteFromTargetMarkup` dans `src/domain/pricing.ts`. Un coût absent laisse le prix non indiqué. Le total n’additionne que les lignes chiffrées.

Établir un devis copie les lignes sélectionnées. Un devis en cours devient une commande client, ou un devis non abouti. Une commande client ouvre une commande fournisseur par fournisseur nommé. Confirmer les chiffres écrit la date dans l’actualité du projet. Reprendre les chiffres retire cette confirmation. Aucun numéro de facture n’est attribué.

`/projets/[id]/documents/[documentId]` présente la pièce. Le devis et la commande client affichent le prix de vente HT. La commande fournisseur affiche le coût d’achat. `/projets/[id]/facture` reprend la dernière commande client et la référence saisie sur l’étape Facturation. Elle n’écrit pas de numéro. L’en-tête vient de `CompanyProfile` : raison sociale, coordonnées et logo dans `data/entreprise`. Le logo est servi par `GET /api/entreprise/logo`.

La fiche projet montre les produits et les devis dans la colonne principale, et le tableau des neuf étapes à droite sur un grand écran. Une seule étape est ouverte pour la saisie. Le parcours commercial est `ProjectStep`, une ligne par étape et par projet. Les neuf étapes, leurs actions et leurs preuves sont dans `src/domain/trade-workflow.ts` (`TRADE_STEPS`). Le fichier lu à l’écran et ajouté au prompt du modèle est `instructions/metiers/achat-revente-technologies.md`. Une situation « fait » exige une référence d’au moins deux caractères. L’avertissement d’ordre est indicatif : les étapes de remise et de réception attendent l’expédition, la facturation attend un bon de livraison ou un procès-verbal. `asksTradeWorkflow` répond avant la consultation des fiches. Si un seul projet est nommé, `listProjectSteps` et `projectTradeReply` décrivent la prochaine preuve.

## Hors de ce socle

L’avoir, le paiement, le rapprochement bancaire, le pilotage chiffré, l’export et le connecteur agréé ne sont pas implémentés. Ils restent dans la spécification fonctionnelle. La facture affichée ne crée pas de titre de paiement : elle montre la référence déjà saisie. La commande client et la commande fournisseur de la vue projet préparent l’opération, sans numéro de pièce ni transmission.
