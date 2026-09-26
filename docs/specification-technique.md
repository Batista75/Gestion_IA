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
4. Une consultation ou une liste est lue dans les fiches, sans modèle.
5. Une phrase de client ouvre une proposition.
6. Une phrase de fournisseur, de produit, de projet court ou de devis ouvre une proposition. Elle n’écrit pas.
7. Un commentaire sur une fiche client en attente produit une nouvelle proposition.
8. Un nom seul déjà connu, sans verbe d’action, demande s’il faut consulter ou modifier.
9. Une correction explicite propose la mise à jour de la fiche retrouvée.

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

Le contexte donné au modèle est limité à 4 fiches. Une consultation en affiche au plus 5.

## Modèles et GPU

Trois rôles, choisis dans Configuration : conversation, embeddings, reranker. **Automatique**, si les modèles sont installés : Qwen2.5-14B-Instruct en Q4_K_M (souvent `qwen2.5:14b`), `bge-m3`, `bge-reranker-v2-m3`.

Le budget est un utilisateur, 16 Go de mémoire graphique et 32 Go de RAM. Les travaux GPU passent par une file unique. Elle ne s’appelle pas elle-même. L’ordre est : embeddings, reranker, puis conversation. Les deux premiers se déchargent. La conversation garde un contexte de 4 096 jetons, une température de 0,1, et reste chargée dix minutes.

La clé d’API n’est envoyée qu’en en-tête `Authorization` vers cet hôte privé. Une adresse publique est refusée. L’écran de santé ne teste que la base.

## Hors de ce socle

La facture, l’avoir, la commande, le paiement, le rapprochement bancaire, le pilotage chiffré, l’export et le connecteur agréé ne sont pas implémentés. Ils restent dans la spécification fonctionnelle.
