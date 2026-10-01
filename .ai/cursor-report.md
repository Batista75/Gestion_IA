# Recette PostgreSQL LOT-V3-006

Baseline fonctionnelle : `BASELINE-7 — 70418dd — LOT-V3-005 validé`.
LOT-V3-006 reste non commité. Aucun fichier source n’a été modifié pendant la recette. Aucune migration. Aucun commit. Aucun push.

Les confirmations et les rejets sont des `POST /api/assistant` réels, deux requêtes lancées ensemble sur le même `proposalId`, contre PostgreSQL `gestion_ia`. Le serveur est `next start` du build courant, sur `127.0.0.1:3847`.

## A. Git initial

- HEAD : `1a452bcee2d4ecd8e9de7057f4c7b23cdf00bf82`
- origin/main : `1a452bcee2d4ecd8e9de7057f4c7b23cdf00bf82`
- `git diff --check` : PASS

HEAD technique et `origin/main` portent les commits de handoff `.ai/`. La baseline fonctionnelle reste `70418ddc58da96cfb8a8a35095cb37b147d2f10f`.

Fichiers LOT-V3-006 non commités :

- `docs/manuel-utilisateur.md`
- `docs/technique/docs/modelisation.md`
- `docs/technique/docs/orchestration.md`
- `src/app/api/assistant/route.ts`
- `src/components/assistant-chat.tsx`
- `src/domain/proposal-scope.ts`
- `src/lib/assistant-stream.ts`
- `src/lib/business-plan-proposals.ts`
- `src/lib/catalog-proposals.ts`
- `src/lib/claim-reply.ts`
- `src/lib/client-proposals.ts`
- `src/lib/contract-reply.ts`
- `src/lib/conversations.ts`
- `src/lib/equipment-reply.ts`
- `src/lib/intervention-reply.ts`
- `src/lib/purchase-reply.ts`
- `tests/proposal-scope.test.ts`

`.ai/` est déjà dans HEAD. Aucun fichier `.ai/` n’apparaissait dans `git status --short` au départ. Ce rapport est le seul fichier écrit par la recette.

## B. Snapshot

Préfixe `RECETTE-V3-006`. Aucune ligne de ce préfixe avant la recette.

| Table | Avant |
| --- | ---: |
| Client | 7 |
| Project | 5 |
| Conversation | 20 |
| ClientProposal | 14 |
| CatalogProposal | 1 |
| BusinessPlanProposal | 4 |
| ContractProposal | 0 |
| InterventionProposal | 0 |
| InstalledEquipmentProposal | 0 |
| PurchaseFollowUpProposal | 0 |
| SupplierTermsProposal | 0 |
| ClaimProposal | 0 |
| ReturnRequestProposal | 0 |
| Contact | 6 |
| Address | 2 |
| Quote | 3 |
| Contract | 0 |
| Intervention | 0 |
| InstalledEquipment | 0 |
| PurchaseFollowUp | 0 |
| Claim | 0 |
| ReturnRequest | 0 |
| Supplier | 7 |
| Organization | 7 |
| Product | 12 |
| QuoteLine | 15 |
| ProjectEvent | 26 |
| RecordEvent | 45 |
| ConversationMessage | 82 |
| SupplierOffer | 15 |

## C. Validations initiales

- `npm test` : 371 tests, 0 échec
- `tsc --noEmit` : PASS
- `npm run lint` : 0 erreur, 4 avertissements déjà présents (`catalog-actions.ts`, `commercial-sheet.tsx`, `company-form.tsx`, `commercial-board.ts`)
- `npm run build` : PASS (Next.js 16.3.6)
- `git diff --check` : PASS

Prisma `migrate status` : 43 migrations, schéma à jour, base `gestion_ia` sur `127.0.0.1:5432`. Aucune migration LOT-V3-006. Les statuts `en_cours` et `echec` sont des chaînes, déjà portées par la colonne `status`.

## D. Client concurrence

Client existant `RECETTE-V3-006 Client`, sans contact principal, sans adresse principale. `ClientProposal` de mise à jour (contact Ada Recette, adresse 12 rue de la Recette, 75011 Paris).

Deux confirmations simultanées. Les deux répondent HTTP 200. Une réponse est un enregistrement, l’autre une règle métier (claim perdu).

- statut final : `confirmee`
- 1 contact principal
- 1 adresse principale
- 1 événement `RecordEvent` « mise à jour » (pays, ville, adresse, code postal, contact, fonction, e-mail, téléphone)
- aucune erreur 500

## E. Project concurrence

`CatalogProposal` `create_project`, nom `RECETTE-V3-006 Projet`. Deux confirmations simultanées, HTTP 200.

- 1 `Project`
- statut `confirmee`
- la seconde perd le claim

## F. Quote concurrence

`CatalogProposal` `record_quote`, titre `RECETTE-V3-006 Quote`, produit `RECETTE-V3-006 Article`. Deux confirmations simultanées, HTTP 200.

- 1 `Quote`
- 1 `Product`
- statut `confirmee`
- aucun doublon

## G. Contrat

`ContractProposal` valide (maintenance, mensuel, 1 200,00 € sur la période, 2026). Deux confirmations simultanées, HTTP 200.

- 1 `Contract`
- statut `confirmee`

## H. Intervention

`InterventionProposal` sur le dossier `RECETTE-V3-006 Dossier` rattaché au client. Deux confirmations simultanées, HTTP 200.

- 1 `Intervention`
- statut `confirmee`

## I. Équipement

`InstalledEquipmentProposal`, désignation `RECETTE-V3-006 Equipement`. Deux confirmations simultanées, HTTP 200.

- 1 `InstalledEquipment`
- statut `confirmee`

## J. Achat

`PurchaseFollowUpProposal`, désignation `RECETTE-V3-006 Achat`. Deux confirmations simultanées, HTTP 200.

- 1 `PurchaseFollowUp`
- statut `confirmee`

## K. Encours

`SupplierTermsProposal` sur `RECETTE-V3-006 Fournisseur` : encours 1 500,00 €, délai 30 jours. Deux confirmations simultanées, HTTP 200.

- statut `confirmee`
- colonnes fournisseur : `outstandingCents` 150000, `paymentDays` 30
- `RecordEvent` du fournisseur : 0 avant, 0 après

Le journal n’enregistre pas l’encours ni le délai : ces colonnes sont absentes des libellés d’historique fournisseur. L’application logique est unique, et l’historique n’est pas dupliqué. L’achat du scénario J reste à une seule ligne.

## L. Réclamation

`ClaimProposal`, note `RECETTE-V3-006 reclamation`. Deux confirmations simultanées, HTTP 200.

- 1 `Claim`
- statut `confirmee`

## M. Retour

`ReturnRequestProposal`, note `RECETTE-V3-006 retour`. Deux confirmations simultanées, HTTP 200.

- 1 `ReturnRequest`
- statut `confirmee`

## N. Confirm vs reject

`CatalogProposal` `create_project` `RECETTE-V3-006 CourseK`. Confirmation et rejet structurés lancés ensemble, HTTP 200.

Issue observée : la confirmation gagne.

- statut `confirmee`
- 1 projet
- le rejet est refusé (règle métier)
- l’état interdit (donnée métier présente et proposition `rejetee`) est absent

## O. Bouton vs texte libre

Même type de proposition, nom `RECETTE-V3-006 CourseL`. Action structurée `confirm` et texte `Rejette.` lancés ensemble, HTTP 200.

Issue observée : la confirmation gagne.

- statut `confirmee`
- 1 projet
- le texte libre répond « Il n’y a pas de fiche en attente. »
- l’état interdit est absent
- aucune seconde proposition n’est ouverte

## P. Échec après claim

`CatalogProposal` de devis créée avec un produit valide `RECETTE-V3-006 Article M`. Après création, le nom du produit dans le payload est remplacé par `x`, trop court pour l’écriture. La confirmation HTTP 200 aboutit à `echec`. Aucun devis, aucun produit. Le second clic HTTP 200 laisse `echec` et ne réécrit rien.

`echec` n’est écrit que depuis `en_cours`. Le statut au repos est `echec`. Aucune proposition de recette n’est restée `en_cours`.

## Q. BusinessPlan

`BusinessPlanProposal` avec le client `RECETTE-V3-006 Plan`. Deux confirmations simultanées, HTTP 200.

- 1 client créé
- 1 événement « création »
- statut `confirmee`
- la seconde perd le claim

## R. Ciblage par ID

Dans le même fil : `ClientProposal` A et `CatalogProposal` B (`RECETTE-V3-006 CibleB`), toutes deux `en_attente`.

Confirmation de A par son identifiant : A passe à `confirmee`, B reste `en_attente`. Rejet de B par son identifiant : B passe à `rejetee`, A reste `confirmee`. Le projet `RECETTE-V3-006 CibleB` n’existe pas. HTTP 200.

## S. Isolation inter-conversation

`CatalogProposal` `RECETTE-V3-006 Isole` dans le fil B. Confirmation depuis le fil A avec le même identifiant. HTTP 200.

- aucun projet
- la proposition reste `en_attente`
- aucun repli vers une autre proposition

## T. Nettoyage

Suppressions dans l’ordre des clés étrangères : lignes de devis, devis, achats, offres, produits, interventions, équipements, réclamations, retours, contrats, projets (événements de dossier en cascade), contacts, adresses, événements `RecordEvent` du préfixe, clients, fournisseurs, organisations, propositions des fils `recette-v3-006-*`, conversations (messages en cascade).

Compteurs après nettoyage : identiques au snapshot, écart vide. Aucune ligne `RECETTE-V3-006` restante sur les clients, projets, fournisseurs, produits, devis, organisations, événements, conversations, messages et propositions.

Le contrôle d’historique suivant a recréé une `CatalogProposal` confirmée. La suppression du fil a mis `conversationId` à nul (contrainte `SetNull`) et a laissé la proposition. Cette ligne a été supprimée ensuite. Le recomptage complet retrouve le snapshot, et le préfixe est absent.

Les historiques de recette étaient supprimables. Aucun événement hors préfixe n’a été retiré : le compteur `RecordEvent` est revenu à 45.

## U. Validations finales

- `npm test` : 371 tests, 0 échec
- `tsc --noEmit` : PASS
- `npm run lint` : 0 erreur, 4 avertissements déjà présents
- `npm run build` : PASS
- `git diff --check` : PASS

## V. Risques résiduels

Historique d’écran. Une carte a été déposée dans le fil, puis confirmée par le bouton. Le rechargement suit l’ordre de `loadConversation` (`createdAt` descendant, puis inversion). L’ordre lu est : carte, message « Confirmer cette proposition. », réponse assistant de source `action`. L’état calculé est `confirmee`. La carte n’est pas « sans suite ». Le navigateur n’a pas été ouvert ; la lecture est celle des messages stockés.

Backlog, non corrigé pendant la recette :

- reprise des propositions restées `en_cours`
- erreur de `markConfirmed` après l’écriture métier
- messages d’échec plus précis
- `createProposalLedger` dans le domaine
- tests complets de la route
- `rejectBusinessPlanProposal` en texte libre ne vérifie pas le `count`

## Verdict

GO COMMIT
