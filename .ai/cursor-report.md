# LOT-V3-006 — Rapport Cursor

## Correction appliquée

Les deux findings MAJOR sont traités sans migration et sans changement Prisma.

Une confirmation ne fait plus l’écriture métier tant que la ligne est encore seulement relue `en_attente`. Elle la réclame d’abord. Un rejet ne peut plus écraser une ligne déjà réclamée : il ne part que de `en_attente`.

Les rejets du texte libre (contrat, intervention, équipement, achat, encours, réclamation, retour, catalogue, client) utilisent le même `updateMany` conditionnel. Si le compte n’est pas 1, rien n’est annoncé comme annulé.

`confirmCatalogProposalById` passe par `applyCatalogProposal`, qui enveloppe `applyCatalogCommand` dans `withChangeSource("assistant")`.

L’état visuel reconnaît `Confirmer cette proposition.` comme une confirmation, et `Rejeter cette proposition.` comme un rejet. Les types de retour intervention et équipement utilisent `ProposalCard`.

BusinessPlanProposal n’a pas été réécrit. Son claim `en_attente` → `en_cours` avant `applyBusinessPlan` est inchangé.

## Mécanisme de claim

`runClaimedConfirmation` dans `src/domain/proposal-scope.ts` :

1. `updateMany` où `id`, `conversationId` et `status = en_attente`, vers `en_cours`.
2. Si `count !== 1`, aucune écriture métier.
3. Sinon l’écriture métier.
4. Succès : `en_cours` → `confirmee`, avec `validatedAt`.
5. Refus ou exception : `en_cours` → `echec`, sans retour à `en_attente`.

Le rejet est un `updateMany` sur `status = en_attente` uniquement. Un claim déjà passé à `en_cours` le fait échouer. Un rejet gagné d’abord empêche le claim.

## Types protégés

- ClientProposal
- CatalogProposal
- contrat
- intervention
- équipement
- achat
- encours fournisseur
- réclamation
- retour

BusinessPlanProposal reste sur son claim existant.

## Tests ajoutés

- deux confirmations concurrentes ClientProposal et CatalogProposal : une seule écriture, un seul historique, statut `confirmee` ;
- rejet puis confirmation : aucune écriture ;
- confirmation puis rejet : le rejet échoue, une seule écriture, statut `confirmee` ;
- échec : une tentative, statut `echec`, second essai sans écriture ;
- chaque type ci-dessus appelle `runClaimedConfirmation` et ne rejette plus par `update` inconditionnel ;
- le catalogue confirme sous `withChangeSource("assistant")` ;
- le plan parlé réclame `en_cours` avant `applyBusinessPlan` et refuse si `count !== 1` ;
- `Confirmer cette proposition.` marque la carte confirmée, `Rejeter cette proposition.` la laisse sans suite ;
- mauvais identifiant, mauvais fil et mauvais type restent refusés par `selectProposalTarget`.

## Total tests

371 tests, 0 échec.

## TypeScript

`tsc --noEmit` passe.

## Lint

0 erreur. 4 avertissements déjà présents.

## Build

`npm run build` passe, Next.js 16.3.6.

## git diff --check

Passe.

## Risques résiduels

La course est prouvée sur le claim partagé, avec un passage synchrone `en_attente` → `en_cours`, équivalent au `count === 1`. Elle n’a pas été rejouée en deux transactions PostgreSQL. Une vérification de références (client introuvable, proposition illisible) reste avant le claim : la ligne demeure `en_attente`, aucune écriture n’a commencé. Le plan parlé n’a pas été modifié.

## Verdict

PRÊT POUR REVUE CLAUDE CIBLÉE
