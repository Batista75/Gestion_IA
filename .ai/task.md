# LOT-V3-006 — Correction concurrence Proposal

## OUTIL DESTINATAIRE

CURSOR

## Mode

CORRECTION CIBLÉE

Ne pas commit.
Ne pas push.
Ne pas créer de migration.
Ne pas modifier Prisma.

## Objectif

Corriger les deux findings MAJOR issus de la revue Claude.

### MAJOR-1

Deux confirmations simultanées peuvent actuellement exécuter deux fois l'écriture métier pour plusieurs types de Proposal.

### MAJOR-2

Une confirmation et un rejet simultanés peuvent aboutir à :

- donnée métier écrite ;
- Proposal au statut rejetee.

## Principe obligatoire

Avant toute écriture métier d'une Proposal confirmée :

en_attente
→ claim atomique
→ en_cours
→ écriture métier
→ confirmee

En cas d'erreur :

en_cours
→ echec

Le claim doit utiliser un update conditionnel sur :

- id ;
- conversationId ;
- status = en_attente.

Il doit vérifier que count === 1.

Sinon :
aucune écriture métier.

## Types concernés

- ClientProposal
- CatalogProposal
- contrat
- intervention
- équipement
- achat
- encours fournisseur
- réclamation
- retour

BusinessPlanProposal est déjà protégé et ne doit pas être régressé.

## Rejet

Le rejet doit uniquement réussir depuis :

status = en_attente

Si la confirmation a déjà obtenu le claim en_cours, le rejet échoue.

Si le rejet gagne d'abord, la confirmation ne peut plus obtenir le claim.

Corriger également les rejets texte libre historiques qui mettent à jour le statut sans condition en_attente.

## Corrections mineures demandées

- confirmCatalogProposalById doit conserver withChangeSource("assistant")
- l'état visuel doit reconnaître :
  - "Confirmer cette proposition."
  - "Rejeter cette proposition."
- utiliser ProposalCard pour les types de retour intervention / équipement si applicable simplement.

## Tests obligatoires

Ajouter des tests couvrant réellement :

1. deux confirmations concurrentes ClientProposal ;
2. deux confirmations concurrentes CatalogProposal ;
3. confirm + reject concurrents ;
4. absence de double création métier ;
5. absence de double historique ;
6. contrat/intervention/équipement/achat/encours/réclamation/retour protégés ;
7. BusinessPlan non régressé ;
8. mauvais ID / mauvais fil / mauvais type toujours refusés.

## Validation

Exécuter :

npm test
./node_modules/.bin/tsc --noEmit
npm run lint
npm run build
git diff --check

## Compte rendu

À la fin, écrire le rapport complet dans :

.ai/cursor-report.md

Le rapport doit contenir :

- correction appliquée ;
- mécanisme de claim ;
- types protégés ;
- tests ajoutés ;
- total tests ;
- TypeScript ;
- lint ;
- build ;
- git diff --check ;
- risques résiduels ;
- verdict.

Verdict attendu :

PRÊT POUR REVUE CLAUDE CIBLÉE

ou

CORRECTIONS NÉCESSAIRES

Ne pas commit.
