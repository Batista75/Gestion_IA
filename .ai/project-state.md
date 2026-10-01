# Gestion IA — État du projet

## Baseline fonctionnelle

BASELINE-8 — 4794328 — LOT-V3-006 validé

SHA :
479432872e5148efbb475df2ff1ff57d9042a866

371 tests, 0 échec.

## HEAD technique

4794328 — feat: sécurise les actions de proposition par identifiant

HEAD = origin/main.

## Lot clos

LOT-V3-006 validé.

Confirmation et rejet par identifiant de la proposition affichée.
Le texte libre continue de viser la proposition en attente la plus récente.

Claim atomique :

en_attente → en_cours → confirmee/echec

avant l’écriture métier. Un second essai, ou un rejet après le claim, n’écrit pas.

Aucune migration.

## Backlog résiduel

- reprise des propositions `en_cours` ;
- erreur `markConfirmed` après écriture ;
- messages d’échec plus précis ;
- `createProposalLedger` à sortir du domaine ;
- tests complets de route ;
- `rejectBusinessPlanProposal` texte libre sans contrôle du count.

## Règle de travail

ChatGPT = architecture / arbitrage
Cursor = implémentation principale
Claude Code = revue indépendante ciblée
GitHub = source de vérité

Un seul outil modifie le code à la fois.
