# LOT-V3-007 — Revue Claude : revalidation du correctif MAJOR-1

Outil : Claude (revue indépendante, lecture seule)
Baseline : BASELINE-8 — 4794328 — LOT-V3-006 validé
Objet : correctif MAJOR-1 décrit dans `.ai/cursor-report.md` (forme `service` reconnue au milieu d’une phrase).

Aucun fichier source modifié. Aucun commit, aucun push. Pas de `git diff` disponible sur le poste dans cette session : les fichiers modifiés depuis la revue précédente ont été identifiés par leur date de modification, puis comparés à la copie de la revue précédente.

---

## 1. Périmètre du correctif

Fichiers modifiés depuis la revue précédente :

| Fichier | Changement |
|---|---|
| `src/domain/structured-plan.ts` | une ligne : `SERVICE_SHAPE` |
| `tests/structured-plan.test.ts` | deux tests ajoutés en fin de fichier |
| `.ai/cursor-report.md` | rapport du correctif |

Aucun autre fichier de `src/`, `tests/`, `docs/` ou `prisma/` n’a changé. Les fichiers NO CHANGE et les migrations restent intacts.

Diff de code, complet :

```
- /\b(?:ajout(?:e|er|ez|ons)?|cr[ée]e[rz]?|cr[ée]er|cr[ée]ation)\s+(?:le|la|un|une)\s+(?:service|prestation)\s+\S/i
+ /^(?:ajout(?:e|er|ez|ons)?|cr[ée]e[rz]?|cr[ée]er|cr[ée]ation)\s+(?:le|la|un|une)\s+(?:service|prestation)\s+\S/i
```

`structuredShape` applique ce motif sur `text.trim()` : l’ancrage `^` vise bien le début de la phrase, espaces de tête ignorés.

---

## 2. Vérifications exécutées

Fonctions réelles du working tree, appelées sur une copie locale.

### Les deux phrases du MAJOR-1

| Phrase | Forme | Traduction |
|---|---|---|
| Ouvre le dossier Toiture pour Dupont et ajoute le service pose | `client-or-project` | `CREATE_PROJECT` avec client connu → `catalog` (`create_project`) ; un plan `CREATE_PRODUCT pose` → `clarify` |
| Nouveau client Dupont, ajoute une prestation Audit | `client-or-project` | `CREATE_CLIENT` → `catalog` (`create_client`) ; un plan `CREATE_PRODUCT Audit` → `clarify` |

Les deux phrases restent dans la famille client / projet, comme en BASELINE-8, et ne peuvent plus ouvrir de proposition de service.

### Formes service simples

| Phrase | Forme | Traduction |
|---|---|---|
| Ajoute le service Audit réseau | `service` | `create_product`, kind `service` |
| Ajoute une prestation Audit réseau | `service` | `create_product`, kind `service` |
| (espaces en tête) Ajoute le service Audit réseau | `service` | — |
| Crée un service Maintenance | `service` | — |
| Ajoute le Service Premium | `service` | — |

### Non-régression du reste du lot

| Phrase | Forme |
|---|---|
| Ajoute Service Premium | `client-or-project` |
| Ajoute le Service Plus comme client | `client-or-project` |
| Ajoute la prestation X comme produit | `product` |
| Ajoute ACME comme fournisseur | `supplier` |
| Ajoute Switch X200 comme produit | `product` |
| Ajoute ACME comme client et comme fournisseur | `null` |
| Ajoute ACME comme fournisseur pour le contrat Dupont | `null` |
| Ajoute le fournisseur ACME | `null` (parseur déterministe) |
| Nouveau client Dupont. Dossier Toiture pour Dupont. | `client-or-project`, couple → `business` |
| Ajoute Dupont comme client et ouvre le dossier Toiture pour Dupont | `client-or-project`, couple → `business` |
| Crée le client Dupont et ouvre le dossier Toiture pour Dupont | `client-or-project`, couple → `business` |

Fiche en attente : `Ajoute le service Audit réseau, son email est …` et `Ajoute ACME comme fournisseur, son email est …` → `new_intent` ; `son email est nouveau@dupont.fr` → `correction`. Inchangé.

---

## 3. Tests

Tests ajoutés, présents dans `tests/structured-plan.test.ts` :

- « ouvre le dossier puis ajoute le service reste client ou projet » ;
- « nouveau client puis ajoute une prestation reste client ou projet ».

Rejoués par Claude sur une copie locale :

- `tests/structured-plan.test.ts` : 91 tests, 0 échec, les deux nouveaux tests passent ;
- liste complète de `npm test` : **393 tests, 393 succès, 0 échec** (391 + 2), identique au rapport Cursor.

`tsc --noEmit` et le lint n’ont pas été rejoués ici (pas de `node_modules`) : résultats repris du rapport Cursor (succès ; 0 erreur, 4 avertissements déjà présents).

---

## 4. Anomalies

CRITICAL : aucune.

MAJOR : aucune. Le MAJOR-1 est résolu.

MINOR, inchangés et non bloquants (non traités par ce correctif, comme annoncé par Cursor) :

- MINOR-1 : `classifyPendingTurn` lit la forme sans les refus d’éligibilité (négation, question) ;
- MINOR-2 : une forme `null` continue sur la traduction client / projet dans `translateStructuredPlan` ; la route ne présente un plan que si l’éligibilité est vraie ;
- MINOR-3 : un contact écrit dans une phrase produit / service n’est pas signalé comme omis ;
- MINOR-4 : limites documentées (`réf` / `ref`, `Création d’un service`, noms de moins de trois caractères utiles, adresse coupée au mot « à », fiche en attente + `Ajoute Martin comme client, son email est …`).

À reporter au backlog de `.ai/project-state.md`.

---

## 5. Conclusion

Le correctif est limité à l’ancrage de `SERVICE_SHAPE` en début de phrase. Les deux phrases signalées restent dans la famille client / projet, les formes service simples fonctionnent, aucune autre forme ne change, les deux tests demandés sont présents et la suite complète est verte (393/393). La recette PostgreSQL / Ollama listée dans le rapport d’implémentation reste à exécuter avant la clôture du lot.

---

## Verdict

GO VALIDATION LOT-V3-007
