# Gestion IA — État du projet

## Baseline fonctionnelle

BASELINE-10 — LOT-V3-008 — c0562d37682236f5d45f4d60bb4254d65becb512

SHA :
c0562d37682236f5d45f4d60bb4254d65becb512

411 tests, 0 échec. Typecheck réussi. Lint : 0 erreur, 4 avertissements préexistants. Recette PostgreSQL + Ollama réelle réussie.

## HEAD technique

HEAD technique : voir origin/main

La baseline fonctionnelle reste indépendante des commits documentaires ultérieurs.

## Lot clos

LOT-V3-008 validé.

Lecture structurée d’une situation métier ajoutée.
`Project` reste l’objet représentant l’affaire.
`SituationReading` est séparé de `StructuredPlan`.
Le gate est déterministe et conservateur avant l’appel Ollama.
Le modèle extrait uniquement des mentions `{kind,text}`.
Les positions, le rattachement `Project` et `knownEntities` sont calculés côté serveur.
États `current`, `matched`, `ambiguous`, `unresolved`.
`current` provient uniquement du contexte de page, jamais de `Conversation.projectId`.
Aucune écriture métier n’est issue d’une lecture.
Aucune carte confirmable.
Persistance dans le JSON existant du message, sans migration.
Comportement de panne Ollama validé.
411 tests réussis. Typecheck réussi.
Lint : 0 erreur, 4 avertissements préexistants.
Recette PostgreSQL + Ollama réelle réussie.
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
- absence de test dédié à `structuredPlanGuide` ;
- faux positifs du gate : `J'ai proposé un devis...`, `Analyse le devis...`, acompte ou montant reçu ;
- variantes d’interrogation ou d’ordre encore non couvertes (`peux tu`, `analyse`, `vérifie`, `regarde`, `traduis`, etc.) ;
- bord de mot avec trait d’union, par exemple `Dupont` dans `Dupont-Martin`, à sécuriser avant qu’un `projectId` de SituationReading serve à une écriture ;
- traduction UI des états et des types encore partiellement technique ;
- mentions Ollama vides pouvant produire un libellé de provenance maladroit ;
- doublons de mentions éventuels ;
- formulation documentaire `phrase et des extraits` à corriger ;
- faux négatifs tels que `J'ai bien reçu le devis`, `Proposition reçue de...`, `ClimPro a envoyé son devis...` ;
- `Ajoute Nom comme client` ne capture pas le tour suivant comme `Ajoute client Nom` ;
- drapeaux `answeredDirectly`, `structuredPlanAnswered`, `deterministicSheet` devenus sans effet réel dans `situationReadingTurn` ;
- hydration warning observé sur `src/app/page.tsx`, non causé par ce lot.

## Règle de travail

ChatGPT = architecture / arbitrage
Cursor = implémentation principale
Claude Code = revue indépendante ciblée
GitHub = source de vérité

Un seul outil modifie le code à la fois.
