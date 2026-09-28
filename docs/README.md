# Documentation

Deux sites, plus le manuel et le PDF conservé. Le fonctionnel, la technique et les réalisations portent les mêmes demandes et les mêmes états. Le tableau de Plus est la source de ces états.

## Demandes fonctionnelles

Répertoire `docs/fonctionnel`. Pages : chaîne, catalogue, périmètre, réalisations.

```bash
cd docs/fonctionnel
mkdocs serve -a 127.0.0.1:8765
```

Dans l’application : [Demandes fonctionnelles](/documentation/v2).

## Spécification technique

Répertoire `docs/technique`. Le [DAT](technique/docs/dat.md) tient l’architecture. Le [DCT](technique/docs/dct.md) tient la conception. Les chapitres ne répètent pas ces deux documents : orchestration, devis hybride, recherche, modélisation, écrans, écart, réalisations. La page données ne fait que renvoyer.

```bash
cd docs/technique
mkdocs serve -a 127.0.0.1:8766
```

Dans l’application : [Spécification technique](/documentation/technique).

Les fichiers `realisations.md` des deux sites sont produits par :

```bash
node --experimental-strip-types scripts/render-realisations.mjs
```

Un test refuse un écart avec `src/domain/v2-progress.ts`.

## Manuel et PDF

[Manuel utilisateur](manuel-utilisateur.md), affiché à l’écran Manuel. [PDF du 26 septembre 2026](specifications-gestion-ia.pdf), conservé, plus la base de revue.

## Instruction métier

[Achat et revente — technologies](../instructions/metiers/achat-revente-technologies.md). Dans l’application : [Instruction métier](/documentation/metier).
