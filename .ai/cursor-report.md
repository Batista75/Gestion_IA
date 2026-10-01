# Audit de `.ai/task.md`

`.ai/task.md` décrit la correction de concurrence LOT-V3-006 (MAJOR-1 et MAJOR-2). Cette correction est déjà dans la baseline fonctionnelle. Aucun fichier source n’a été modifié pour cet audit. Aucun commit. Aucun push.

## Baseline

BASELINE-8 — `4794328` — LOT-V3-006 validé.

SHA : `479432872e5148efbb475df2ff1ff57d9042a866`.

HEAD technique : `b69bb5b1f43939c9eb48476869128980133574a4` (`chore: actualise le point de reprise BASELINE-8`). Commit `.ai/` seulement. La baseline fonctionnelle reste `4794328`.

## Correction demandée

Déjà appliquée dans `4794328`, message `feat: sécurise les actions de proposition par identifiant`.

## Mécanisme de claim

`runClaimedConfirmation` dans `src/domain/proposal-scope.ts`.

```text
en_attente
→ updateMany où id + conversationId + status = en_attente
→ count === 1, sinon aucune écriture
→ en_cours
→ écriture métier
→ confirmee
```

Erreur ou écriture non réussie : `en_cours` → `echec`. Pas de retour à `en_attente`.

Le rejet, bouton et texte libre, ne réussit que par `updateMany` où `status = en_attente` et `count === 1`. Un claim déjà pris refuse le rejet. Un rejet déjà pris refuse la confirmation.

## Types protégés

| Type | Claim avant écriture | Rejet conditionnel |
| --- | --- | --- |
| ClientProposal | oui | oui |
| CatalogProposal | oui, `withChangeSource("assistant")` autour de `applyCatalogCommand` | oui |
| Contrat | oui | oui |
| Intervention | oui | oui |
| Équipement | oui | oui |
| Achat | oui | oui |
| Encours fournisseur | oui | oui |
| Réclamation | oui | oui |
| Retour | oui | oui |
| BusinessPlanProposal | oui, `en_cours` et `count !== 1` avant `applyBusinessPlan` | bouton : `count === 1` ; texte libre : `updateMany` sur `en_attente` sans lecture du `count` |

Les fichiers client, catalogue, contrat, intervention, équipement, achat et réclamation ne contiennent pas `Proposal.update(`. Le plan parlé met à jour par `id` après le claim, comportement conservé.

Les boutons envoient « Confirmer cette proposition. » et « Rejeter cette proposition. ». `proposalFollowUpState` les reconnaît. Intervention et équipement exposent une `ProposalCard`.

## Tests présents

Dans `tests/proposal-scope.test.ts` :

1. deux confirmations concurrentes, libellées client et catalogue, une seule écriture ;
2. confirmation et rejet : rejet d’abord, puis confirmation pendant l’écriture ;
3. une seule écriture et un seul historique sur le filet `createProposalLedger` ;
4. échec → `echec`, second essai perdu, zéro écriture ;
5. lecture des sources : `runClaimedConfirmation`, `en_cours`, `en_attente`, pas de `Proposal.update(` ;
6. plan parlé : claim avant `applyBusinessPlan`, `claimed.count !== 1` ;
7. mauvais identifiant, autre type, autre fil, proposition déjà tranchée : `selectProposalTarget` ;
8. textes des boutons.

Ces courses sont prouvées sur le filet en mémoire. La course PostgreSQL réelle a été faite à la recette du lot, déjà close.

## Validation de cet audit

- `npm test` : 371 tests, 0 échec
- `tsc --noEmit` : PASS
- `npm run lint` : 0 erreur, 4 avertissements déjà présents
- `npm run build` : PASS
- `git diff --check` : PASS

## Risques résiduels

Déjà notés au point de reprise, hors de cette tâche :

- une proposition peut rester `en_cours` si le processus s’arrête après le claim ;
- une erreur de `markConfirmed` après une écriture réussie ;
- messages d’échec encore génériques ;
- `createProposalLedger` vit dans le domaine, pour les tests ;
- pas de test HTTP complet de la route ;
- `rejectBusinessPlanProposal` en texte libre ne vérifie pas `count`.

## Verdict

Les exigences de `.ai/task.md` sont déjà satisfaites par BASELINE-8. Aucune correction nouvelle.
