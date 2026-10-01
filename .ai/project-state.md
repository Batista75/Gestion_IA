# Gestion IA — État du projet

## Baseline fonctionnelle

BASELINE-9 — LOT-V3-007 — 0a8d5b7a4b157e3aab94a6996d1df056a89e276f

SHA :
0a8d5b7a4b157e3aab94a6996d1df056a89e276f

393 tests, 0 échec. Typecheck réussi. Recette PostgreSQL + Ollama réelle réussie.

## HEAD technique

0a8d5b7 — feat: etend StructuredPlan aux fournisseurs produits et services

HEAD = origin/main.

## Lot clos

LOT-V3-007 validé.

StructuredPlan étendu aux fournisseurs, aux produits et aux services.
Un service est un `CREATE_PRODUCT` dont le serveur impose `kind=service`.
Le comportement client / projet est préservé.
Les propositions en attente et l’enrichissement client sont protégés.
Famille, montant, SIREN/SIRET et référence numérique sont détectés explicitement.
`already` et `contact-differs` ne mettent rien à jour implicitement.
Les cartes produit et service affichent la nature et la famille.
Aucune migration Prisma.

## Backlog résiduel

- reprise des propositions `en_cours` ;
- erreur `markConfirmed` après écriture ;
- messages d’échec plus précis ;
- `createProposalLedger` à sortir du domaine ;
- tests complets de route ;
- `rejectBusinessPlanProposal` texte libre sans contrôle du count ;
- `classifyPendingTurn` et les formes négatives ou interrogatives ;
- forme `null` encore traduite par la logique client / projet dans certains appels directs ;
- contacts présents dans une phrase produit ou service non signalés comme omis ;
- `réf` / `ref` non reconnus ;
- variantes `Création d’un service` / `Crée un nouveau service` ;
- noms StructuredPlan très courts ;
- adresse coupée au mot `à` ;
- fiche client en attente + nouvelle création client avec champ ;
- comportement réel `Ajoute Service Premium` qui peut mener à une clarification ;
- formulation du guide sur le mot de rôle dans le nom ;
- absence de test dédié à `structuredPlanGuide`.

## Règle de travail

ChatGPT = architecture / arbitrage
Cursor = implémentation principale
Claude Code = revue indépendante ciblée
GitHub = source de vérité

Un seul outil modifie le code à la fois.
