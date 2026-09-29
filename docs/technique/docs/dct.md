# Document de conception technique

Ce document est le DCT. Il décrit comment le socle livré est conçu. L’architecture, le déploiement et la sécurité de contour sont dans le [DAT](dat.md). Les colonnes et les liens sont dans la [modélisation](modelisation.md). Les routes sont dans les [écrans](ecrans.md). L’ordre des règles de l’assistant est dans l’[orchestration](orchestration.md).

## Modules

- `src/domain` décide. Un fichier de ce dossier ne charge pas Prisma et n’appelle pas Ollama.
- `src/lib` lit et écrit la base, la session, les pièces et l’index.
- `src/app` expose les pages, les actions et les routes HTTP.
- `src/components` affiche. Un bouton inactif le reste tant que la saisie exigée manque.
- `src/proxy.ts` est la garde d’accès. Le contour est dans le [DAT](dat.md).

## Accès

Tant qu’aucun `Account` n’existe, `/connexion` propose de créer le premier compte, au rôle `admin`. Ensuite l’adresse et le mot de passe sont exigés. **Quitter** efface la session.

En développement, `ensureDevAdmin` crée `admin@atelier.local` s’il manque, avec le mot de passe `Admin-local-1`. Ce compte n’est pas créé hors du mode développement. S’il existe déjà, le mot de passe n’est pas réécrit. Le rôle est porté à `admin` s’il ne l’était pas.

Le cookie `gestion_session` est signé en HMAC pour 14 jours. Il porte l’identifiant, la marque et le rôle. La marque est l’initiale du prénom suivie du nom. Hors session, la marque écrite sur une trace reste `J Smith`. Le mot de passe en clair n’est pas stocké : la colonne `passwordHash` est une empreinte scrypt, décrite sur `Account`.

Le rôle livré est `admin` ou `utilisateur`. Les rôles fins et les notifications restent une cible, indiquée dans la [modélisation](modelisation.md).

## Prix

Une seule bibliothèque calcule : `src/domain/pricing.ts`.

- Sur un dossier, `quoteFromTargetMarkup` produit le prix de vente et la marge à partir du coût en centimes, du taux de marque et de la remise. Un coût absent laisse le prix non indiqué. Le total n’additionne que les lignes déjà chiffrées.
- Sur une offre ou un devis reçu, le premier montant lisible du texte devient des centimes. Les lignes ne sont pas additionnées. La formulation de cette règle et les colonnes sont dans la [modélisation](modelisation.md), sur `Quote`, `QuoteLine` et `SupplierOffer`.
- `prépare un devis pour …` suit le chapitre [Devis hybride](devis-hybride.md). Le total de ce brouillon additionne les prix unitaires déjà calculés.
- Un contrat confirmé porte un type fermé, un début, une fin, une périodicité et le montant de la période en centimes. L’échéance à 30 jours compare ces dates. Le montant mensuel divise le montant déjà enregistré. Les deux s’affichent en paquet.
- Une intervention confirmée porte un type fermé, une date, une durée en minutes et un taux en centimes. Le taux moyen, le total d’heures et le délai moyen se calculent sur ces valeurs déjà enregistrées.
- Un équipement installé confirmé porte le client, la désignation, la date d’installation et un niveau de garantie fermé. L’âge et le filtre de l’an dernier comparent cette date. Le modèle ne les estime pas.
- Un achat confirmé porte le fournisseur, le montant du bon de commande et, s’il est écrit, le montant de la facture reçue. L’écart est la différence de ces deux centimes. L’encours et le délai de paiement sont confirmés sur la fiche fournisseur.
- Une réclamation confirmée et un retour confirmé portent un type fermé, une date, un client et un état. Le nombre du paquet filtre ces fiches. Le texte affiché est la note déjà enregistrée.
- La rentabilité d’un dossier sépare quatre nombres : ventes de matériel confirmées, prestations vendues, coûts d’achat du dossier et heures déjà enregistrées. Le stock lit la quantité et le coût déjà écrits. Une réception close sans intervention à venir, et une désignation achetée absente du devis et des pièces constatées, sont des listes. Aucune facture n’est créée.
- Un brouillon de relance ou de cotation recopie les noms, références, montants et dates déjà enregistrés. Sans référence et sans date de facture, la relance n’est pas rédigée. Rien n’est envoyé.
- La trésorerie de la semaine liste les factures dont la date écrite plus le délai confirmé tombe dans la semaine, et les encaissements dont la date est déjà écrite. Aucune pénalité n’est calculée. Aucun rapprochement bancaire n’est enregistré.

Le modèle de langage ne reçoit pas ces formules à exécuter.

## Dossier et pièces

`/projets/[id]` charge le client lié, la livraison, les lignes et les pièces de vente. Le client, le produit et le fournisseur se choisissent dans le répertoire. Une ligne de dossier pointe vers un `Product`. Elle n’en crée pas un autre.

La livraison est saisie sur le dossier, puis recopiée sur les pièces. Elle ne devient pas un bon de livraison numéroté.

La filiation des pièces produites est fermée. Un devis n’a pas de parent. Une commande client a pour parent un devis. Une commande fournisseur a pour parent une commande client. Les colonnes sont sur `SaleDocument`.

Établir un devis copie les lignes choisies. Un devis en cours devient une commande client, ou un devis non abouti. Une commande client ouvre une commande fournisseur par fournisseur nommé. Confirmer les chiffres date la confirmation. Reprendre les chiffres retire cette date.

Une livraison, une facture ou un avoir se rattache par `NotedPiece`. La référence est recopiée. L’application ne l’invente pas. Une facture constatée peut suivre une livraison. Un avoir suit une facture. Une seule parente : la commande, ou la pièce constatée. Confirmer une pièce lue ne crée pas de `SaleDocument`. Le détail des écritures par type de fichier est dans la [modélisation](modelisation.md), section Pièce lue par l’assistant.

L’écran `/projets/[id]/facture` réimprime la dernière commande client et la référence déjà saisie sur l’étape Facturation. Il n’écrit ni facture ni numéro. L’en-tête vient de `CompanyProfile`. Le logo est servi par `GET /api/entreprise/logo`.

Le parcours commercial est `ProjectStep`. Les neuf clés, l’ordre et les preuves sont dans `src/domain/trade-workflow.ts`. Une situation `fait` exige la référence déjà portée sur la pièce. L’avertissement d’ordre est indicatif. `asksTradeWorkflow` répond avant la consultation des fiches. Si un seul projet est nommé, la réponse décrit la prochaine preuve.

## Journal

Deux tables, une liste.

- `RecordEvent` trace la création, la mise à jour et la suppression d’un client, d’un fournisseur, d’un produit ou d’un projet. Le résumé ne cite que les champs qui changent. Une mise à jour sans différence n’écrit pas de ligne. Pas de clé étrangère : la ligne reste si la fiche est supprimée.
- `ProjectEvent` trace une action du dossier : ouverture, devis, commande, livraison, pièce rattachée. L’auteur n’y est pas stocké. L’écran affiche Application.

`/evenements` réunit les deux, de la plus récente à la plus ancienne. Le filtre et les cases sont dans les [écrans](ecrans.md). Supprimer les lignes cochées retire la trace. La fiche, le projet et les pièces restent. Les autres écrans renvoient vers cette liste.

## Assistant

Les règles du catalogue s’exécutent avant le modèle. L’ordre est dans l’[orchestration](orchestration.md). Le modèle ne dispose que d’outils de lecture, au plus trois pas. Une écriture de fiche attend une confirmation. `DocumentMemory` retient une correction de projet, de type ou de fournisseur pour le nom d’une pièce. Elle ne modifie pas le répertoire. Un fil est une `Conversation`. Sa limite de messages est `THREAD_MESSAGE_LIMIT`, dans `src/domain/thread.ts`. Le chargement garde les derniers messages et compte ceux qu’il masque. Dans un dossier, `ProjectAssistant` choisit le fil affiché : le plus récent du dossier, un fil rouvert par `loadThreadAction`, ou un fil neuf. Un fil neuf est rattaché au dossier par son premier message. Les faits de page et de zone sont calculés à la lecture. Aucune table ne les conserve : la formulation est dans la [modélisation](modelisation.md).

## Interface

Les jetons visuels sont dans `src/app/globals.css`. On y trouve :

- le fond, deux surfaces, la bordure, le texte principal et secondaire ;
- l’accent `primary`, avec sa teinte douce ;
- les états succès, avertissement, information, erreur et proposition, chacun avec sa teinte douce ;
- le rayon ;
- la largeur du menu, la largeur de l’assistant et la hauteur de la barre.

Tailwind les expose en classes : `bg-surface`, `bg-surface-2`, `text-success`, `bg-proposal-soft`, `w-sidebar`, `h-topbar`. Un composant ne porte pas de couleur arbitraire.

Les primitives sont celles de shadcn sur Base UI, dans `src/components/ui`. Trois s’y ajoutent pour l’écran de référence :

- `StatusBadge` associe une situation à une teinte ;
- `StatCard` montre un repère chiffré ;
- `EmptyState` annonce une liste vide.

Le menu `…` d’une ligne est `RowMenu`. L’écran de référence est le dossier. Son en-tête et ses onglets sont `ProjectHeader` et `ProjectTabs`. La synthèse est `ProjectOverview`, qui lit `projectDocumentRows` et les totaux de `pricing.ts`, sans recalculer.

Dans l’assistant, une proposition s’affiche dans `AssistantProposalCard`, avec l’état à confirmer, confirmée ou sans suite. Une réponse d’action enregistrée garde sa propre marque. L’état confirmée se lit dans le fil : une confirmation, puis une réponse d’action.

La fenêtre ne défile pas. `AppShell` fixe le menu et la barre. Dans un dossier, le layout ouvre trois zones : le menu, le cadre métier et l’assistant. Le cadre métier ne défile que dans son volet. Les volets s’adaptent à la largeur de leur cadre par requêtes de conteneur, pas à celle de la fenêtre.

## Recherche et lecture

L’index est `KnowledgeChunk`, dans PostgreSQL. La recherche mélange les mots, les vecteurs et, s’il répond, le reranker. Un PDF qui a déjà une couche de texte est lu sans modèle de mise en page. Docling ne sert que si cette couche manque, ou pour un document Word, un tableur, une présentation ou une image. Le budget GPU, la file et les trois rôles de modèle sont dans [Recherche et modèles](recherche.md).

## Hors de ces chapitres

Les demandes encore absentes du chemin livré sont dans l’[écart](ecart.md). Les tables encore absentes sont dans la [modélisation](modelisation.md), section Cible encore non construite. L’état de chaque demande est sur [Réalisations](realisations.md).
