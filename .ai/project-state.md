# Gestion IA — État du projet

## Baseline fonctionnelle

BASELINE-11 — LOT-V3-009 — e99ec69294d0940a1fdf61ff91d61115ab566802

SHA :
e99ec69294d0940a1fdf61ff91d61115ab566802

440 tests, 0 échec. Typecheck réussi. Lint : 0 erreur, 4 avertissements préexistants. Recette PostgreSQL + Ollama réelle réussie. Aucune migration.

## HEAD technique

HEAD technique : voir origin/main

La baseline fonctionnelle reste indépendante des commits documentaires ultérieurs.

## Lot clos

LOT-V3-009 validé.

`BusinessContext` est construit après `SituationReading`.
Aucune écriture métier.
Aucun second appel Ollama.
La résolution `Client`, `Supplier` et `Product` est faite côté serveur.
Une ambiguïté `cross_family` ne choisit aucun rôle.
Une seule liste `entities`, et des `relations` séparées.
Une quantité ou un montant n’est associé que lorsque la relation est déterministe.
L’événement et les documents sont qualifiés lexicalement côté serveur.
Persistance sous `{ situation, businessContext }`.
Aucune carte confirmable.
Panne Ollama dégradée validée.
Recette réelle validée.
440 tests, 0 échec. Typecheck réussi.
Lint : 0 erreur, 4 avertissements préexistants.
Aucune migration.

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
- hydration warning observé sur `src/app/page.tsx`, non causé par ce lot ;
- découpage des mentions Ollama : le modèle rend souvent `4 unités XZ-999`, `2 unités MSZ-AP25` ou `fournisseur Atlas` au lieu de séparer la quantité, le nom du produit et le nom du tiers. Une fiche existante peut alors apparaître inconnue, la quantité être absorbée dans le nom, et une ambiguïté cross-family être masquée. Lot ultérieur de normalisation, sans rendre le modèle autoritaire ;
- rattachement de dossier par sous-chaîne : un `Project` `Test` est reconnu dans le produit `PAC-TEST` alors que `Climatisation Dupont` est aussi cité, et `projectContext` devient `ambiguous`. Même défaut que `Dupont` dans `Dupont-Martin`. À corriger avant tout lot qui écrirait à partir d’un `projectId` ;
- limite pratique de 8 mentions : une phrase riche peut être ramenée aux 8 premières mentions et perdre les suivantes. Le futur `ActionProposal` ne doit pas supposer que `BusinessContext` représente toute la phrase ;
- R-1 étendu : si un item omis ne laisse aucun chiffre hors ancre, un montant peut encore être lié à l’item restant, par exemple `2 pompes Atlantic et 3 unités MSZ-AP35 pour 5 500 € HT` quand `pompes Atlantic` est omis. Piste : ne pas lier un montant dont la région contient une quantité non reliée ;
- même extrait rendu à la fois comme quantité et comme montant : deux relations peuvent être créées. À durcir plus tard.

## Règle de travail

ChatGPT = architecture / arbitrage
Cursor = implémentation principale
Claude Code = revue indépendante ciblée
GitHub = source de vérité

Un seul outil modifie le code à la fois.
