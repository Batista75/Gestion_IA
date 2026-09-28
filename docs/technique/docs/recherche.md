# Recherche et modèles

Ce chapitre fixe l’index, la lecture des pièces, le GPU et les modèles. L’architecture est le [DAT](dat.md). La place de cette recherche dans la conception est le [DCT](dct.md).

La recherche élargie réunit le tri par les mots, le tri vectoriel et le tri hybride, au plus 12 fiches. Le reranker, s’il répond, ne garde que les passages qui répondent à la question. Un score trop bas écarte la fiche. Si le reranker manque ou si ses scores ne départagent rien, l’ordre hybride est gardé. Une liste du répertoire ne passe pas par le reranker.

Sans embeddings, la recherche par les mots continue. Le passage envoyé au reranker reprend les lignes qui portent les mots de la question.

Un PDF qui a déjà une couche de texte est lu par `pdftotext`, sans charger le modèle de mise en page. Le lecteur en retire le type, les parties, le numéro, la date, les lignes chiffrées et le total imprimé. Les montants restent ceux de la pièce : un prix `EUR 2.170,00` ou `21 109.75` n’est pas réécrit, et les lignes ne sont pas additionnées. Un composant sans prix reste dans le descriptif de la ligne. Docling, sur le processeur, ne sert que si cette couche manque, ou pour un document Word, un tableur, une présentation ou une image.

Quand Docling est utilisé, il reste sur le processeur. Les modèles de mise en page sont dans `data/docling`. Le GPU reste réservé à Ollama. Il rend un markdown, puis son découpage hybride fournit les passages. Sans ces passages, l’application découpe le texte par titres et garde un tableau entier. Chaque passage est une fiche Pièce, à côté du résumé commercial. Une pièce déjà enregistrée sans couche de texte exploitable est relue une fois, au fil des recherches. Un PDF déjà lisible n’est pas renvoyé au modèle. Sans Docling, l’extraction Word reste le repli. Le fichier est conservé même si aucun texte n’est lu.

Le contexte donné au modèle est limité à 4 fiches. Une consultation en affiche au plus 5. Le texte d’une fiche client, fournisseur ou produit reprend aussi jusqu’à cinq lignes de modifications, datées.

## Modèles et GPU

Trois rôles, choisis dans Configuration : conversation, embeddings, reranker. **Automatique**, si les modèles sont installés : Qwen2.5-14B-Instruct en Q4_K_M (souvent `qwen2.5:14b`), `bge-m3`, `bge-reranker-v2-m3`.

Le budget est un utilisateur, 16 Go de mémoire graphique et 32 Go de RAM. Les travaux GPU passent par une file unique. Elle ne s’appelle pas elle-même. L’ordre est : embeddings, reranker, puis conversation. Les deux premiers se déchargent. La conversation garde un contexte de 4 096 jetons, une température de 0,1, et reste chargée dix minutes.

La clé d’API n’est envoyée qu’en en-tête `Authorization` vers cet hôte privé. Une adresse publique est refusée. L’écran de santé ne teste que la base.
