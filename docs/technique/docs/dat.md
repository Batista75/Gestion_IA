# Document d’architecture technique

Ce document est le DAT. Il fixe le contexte, les contraintes, les couches, le déploiement, la sécurité et les interfaces. La conception des modules est le [DCT](dct.md). Les colonnes sont dans la [modélisation](modelisation.md). Les routes sont dans les [écrans](ecrans.md). L’ordre de traitement de l’assistant est dans l’[orchestration](orchestration.md).

## Contexte

Gestion IA est une application locale pour une petite entreprise. Elle tient les dossiers, classe les informations confirmées, et calcule le prix de vente par une règle du programme. Elle tourne sur le réseau local. Le manuel décrit l’usage. Les demandes sont dans `docs/fonctionnel`. Les états fait ou pas fait sont sur [Réalisations](realisations.md).

## Contraintes

- Les données et l’inférence restent sur le réseau local. Aucun service d’IA public n’est appelé.
- Le modèle de langage ne calcule pas un prix, une TVA, ni un numéro de pièce. Les formules sont dans `src/domain/pricing.ts`. La conception est dans le [DCT](dct.md).
- Une note reçue n’entre dans un projet que par une action explicite.
- PostgreSQL est la seule base. Il n’y a pas de seconde base vectorielle.
- L’application n’émet pas de facture et n’initie pas de paiement.

## Vue logique

Quatre couches. Le domaine ne parle pas à la base. La persistance ne décide pas d’un prix.

- **Présentation.** Pages et composants, `src/app` et `src/components`.
- **Application.** Actions serveur, routes HTTP, garde d’accès `src/proxy.ts`.
- **Domaine.** Règles pures, `src/domain`. Ces fichiers sont testés sans base.
- **Persistance.** Prisma et PostgreSQL, `src/lib/db.ts` et `prisma/schema.prisma`.
- **Inférence et lecture.** Ollama pour la conversation, les embeddings et le reranker. `pdftotext` puis Docling pour les pièces. Le détail est dans [Recherche et modèles](recherche.md).

Le client Prisma écrit une trace quand un client, un fournisseur, un produit ou un projet est créé, modifié ou supprimé. La conception du journal est dans le [DCT](dct.md).

## Vue de déploiement

Une machine Ubuntu porte l’application et PostgreSQL. Ollama est sur le PC hôte du réseau, par défaut `http://192.168.1.5:11434`. En NAT VirtualBox, l’adresse de repli est `http://10.0.2.2:11434`. Le port de développement est `3847`.

`bash scripts/setup-ubuntu.sh` installe Node.js 22 et PostgreSQL sur une Ubuntu neuve. `bash scripts/cloud-agent-start.sh --prepare` prépare la base et applique les migrations.

Fichiers hors base :

- `data/pieces` : binaires reçus.
- `data/entreprise` : logo.
- `data/docling` : modèles de mise en page. Le processeur les exécute. Le GPU reste pour Ollama.

Le budget graphique, la file et les trois rôles de modèle sont dans [Recherche et modèles](recherche.md).

## Sécurité

L’accès est un compte local. Le proxy refuse les pages et les API sans session. Deux chemins restent ouverts : `/connexion` et `GET /api/health`. Les pages sans session reviennent à la connexion. Les autres API répondent 401.

La session est un cookie que le script de la page ne peut pas lire. Le secret est `SESSION_SECRET`, ou un secret local de développement s’il manque. Le mot de passe est une empreinte. Le nom du cookie, sa durée, le premier compte et le compte admin de développement sont dans le [DCT](dct.md). La colonne est `Account` dans la [modélisation](modelisation.md).

Une adresse d’inférence publique est refusée. La clé d’API ne part que vers l’hôte privé configuré. L’écran de santé ne teste que la base.

## Interfaces

- Le navigateur parle à Next.js.
- Next.js parle à PostgreSQL.
- L’assistant parle à Ollama sur le réseau local.
- La lecture de mise en page parle à Docling sur la même machine, seulement quand le texte natif manque. Le détail est dans [Recherche et modèles](recherche.md).
- Aucun connecteur bancaire ni portail public de facturation.

## Carte des documents

Chaque fait a une seule page. Les autres renvoient.

- **DAT** (cette page) : contexte, contraintes, couches, déploiement, sécurité, interfaces.
- **[DCT](dct.md)** : modules, accès, prix, dossier, journal, place de l’assistant et de la recherche.
- **[Orchestration](orchestration.md)** : ordre des règles avant le modèle.
- **[Devis hybride](devis-hybride.md)** : la demande `prépare un devis pour …`.
- **[Recherche et modèles](recherche.md)** : index, lecture des pièces, GPU, modèles.
- **[Modélisation](modelisation.md)** : chaque table, ses champs, ses liens, ce qui n’est pas stocké.
- **[Écrans](ecrans.md)** : routes et contrôles.
- **[Écart](ecart.md)** : demandes encore absentes du chemin livré.
- **[Réalisations](realisations.md)** : état fait ou pas fait, le même tableau que Plus.
- **[Données](donnees.md)** : renvois, pour les liens déjà publiés.
