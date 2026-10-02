# LOT-V3-009 — Validation réelle

Baseline officielle, inchangée tant que ce lot n’est pas commité :

`BASELINE-10 — LOT-V3-008 — c0562d37682236f5d45f4d60bb4254d65becb512`

LOT-V3-009 est implémenté et validé en recette réelle. BASELINE-11 n’est pas créée.

Aucun commit. Aucun push. Aucune migration.

## Validation technique

- `npm test` : 440 tests, 440 réussites, 0 échec ;
- `./node_modules/.bin/tsc --noEmit` : succès ;
- `npm run lint` : 0 erreur, 4 avertissements préexistants :
  - `toState` dans `src/app/catalog-actions.ts` ;
  - `<img>` dans `commercial-sheet.tsx` ;
  - `<img>` dans `company-form.tsx` ;
  - `dayKey` dans `src/lib/commercial-board.ts`.

## Recette PostgreSQL + Ollama

### S1 nominal

Données présentes : `Project` `Climatisation Dupont`, `Supplier` `ClimPro`, `Product` `MSZ-AP25`.

Phrase : `J'ai reçu le devis de ClimPro pour le chantier Climatisation Dupont : 4 unités MSZ-AP25 pour 3 600 € HT`.

Résultat : dossier `matched`. ClimPro connu comme supplier. MSZ-AP25 connu comme product. `4 unités` et `3 600 € HT` liés à l’item. Événement devis. Aucun bouton Confirmer, Rejeter ou Préciser.

### Persistance

Après F5 et réouverture du fil : la lecture de situation et le contexte métier restent. Dossier, fournisseur, produit, quantité et montant sont identiques.

### Confirmation

Dans le même fil, `Je confirme.` répond `Il n’y a pas de fiche en attente.` Le contexte métier ne devient pas une proposition confirmable.

### Entités inconnues

Phrase : `J'ai reçu le devis de Thermix pour 4 unités XZ-999 à 4 200 € HT`.

Thermix est inconnu. Le produit est inconnu. Aucun identifiant n’est inventé. Aucun `Supplier` Thermix, aucun `Product` XZ-999, aucun `Product` `4 unités XZ-999`. Contrôle SQL : 0 ligne pour les trois.

### Cross-family

Données : `Supplier` `Atlas` et `Product` `Atlas`.

Phrase : `Atlas m'a envoyé un devis pour le chantier Climatisation Dupont.`

Atlas apparaît dans `Mentions sans famille`, avec `Ce nom existe dans plusieurs familles. Aucun rôle n’est choisi.` Aucun rôle n’est pris.

### S4

Phrase : `ClimPro propose 2 unités MSZ-AP25 et 3 unités MSZ-AP35 pour 5 500 € HT`.

Le montant `5 500 € HT` n’est pas relié. La raison affichée est `relation non déterministe`. Aucun rattachement au dernier item.

### S5

Phrase : `ClimPro propose 2 unités MSZ-AP25 à 900 € et 1 unité MSZ-AP35 à 1 200 €`.

`900 €` est relié au premier item. `1 200 €` est relié au second. Aucun total n’est calculé.

### Situation riche

Avec quatre items et quatre montants : 8 mentions, quatre relations item/montant cohérentes, dossier `Climatisation Dupont` reconnu.

Avec cinq items : Ollama a retourné les 8 premières mentions. Le cinquième item a été omis. Le contexte reste partiel. La recette ne prouve pas un rejet total au-delà de 8 mentions : elle montre une troncature pratique du modèle à 8 mentions.

### Panne Ollama

Phrase : `J'ai reçu le devis de ClimPro pour le chantier Climatisation Dupont`, Ollama arrêté.

Dossier `matched`. Mentions absentes. Événement `devis` disponible. Aucun second modèle. Fonctionnement dégradé correct. La latence n’a pas été mesurée.

## Backlog issu de la recette

- Découpage des mentions : le modèle rend souvent `4 unités XZ-999`, `2 unités MSZ-AP25` ou `fournisseur Atlas` au lieu de séparer quantité, produit et tiers. Une fiche existante peut apparaître inconnue, la quantité peut être absorbée dans le nom, et une ambiguïté cross-family peut être masquée. À traiter par une normalisation ultérieure, sans rendre le modèle autoritaire.
- Rattachement de dossier par sous-chaîne : un `Project` `Test` est reconnu dans `PAC-TEST` alors que `Climatisation Dupont` est aussi cité, et `projectContext` devient `ambiguous` avec `Test` et `Climatisation Dupont`. Même défaut que `Dupont` dans `Dupont-Martin`. À corriger avant toute écriture à partir d’un `projectId`.
- Huit mentions : une phrase riche peut perdre les mentions suivantes. Le futur `ActionProposal` ne doit pas supposer que le contexte représente toute la phrase.
- R-1 étendu : si un item omis ne laisse aucun chiffre hors ancre, un montant peut encore être lié à l’item restant. Exemple : `2 pompes Atlantic et 3 unités MSZ-AP35 pour 5 500 € HT` quand `pompes Atlantic` est omis. Piste : ne pas lier un montant dont la région contient une quantité non reliée.
- Même extrait en quantité et en montant : deux relations peuvent être créées. À durcir plus tard.

## Clôture

Commit fonctionnel : `e99ec69294d0940a1fdf61ff91d61115ab566802`.

Baseline : `BASELINE-11 — LOT-V3-009`.

Ce SHA désigne le commit produit. Il ne désigne pas le futur commit documentaire.

BASELINE-11 — LOT-V3-009 — e99ec69294d0940a1fdf61ff91d61115ab566802
