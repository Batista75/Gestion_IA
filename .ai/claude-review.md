# LOT-V3-007 — Revue Claude : validation finale de la conception consolidée

Outil : Claude (revue indépendante, lecture seule)
Baseline : BASELINE-8 — 4794328 — LOT-V3-006 validé
Objet : spécification consolidée de `.ai/cursor-report.md`, en réponse au complément de `.ai/task.md`.

Aucun fichier source modifié. Aucun commit, aucun push. Suite de tests non relancée.

Fichiers lus : `AGENTS.md`, `.ai/project-state.md`, `.ai/task.md`, `.ai/cursor-report.md`, `.ai/claude-review.md` (précédente), `src/domain/structured-plan.ts`, `src/domain/conversation-turn.ts`, `src/domain/task-path.ts`, `tests/structured-plan.test.ts`. Le code source n’a pas changé depuis la revue précédente.

Vérifications exécutées sur une copie locale, sans écriture dans le dépôt : `PROJECT_CREATE`, `structuredPlanEligible`, `parseStructuredPlan` et `translateStructuredPlan` actuels sur les phrases client + projet (MAJOR-B).

---

## 1. Dernier MAJOR (fiche client en attente) — RÉSOLU

Section H de la spécification :

- règle `structuredShape ∈ {supplier, product, service} → new_intent` dans `classifyPendingTurn`, **avant** `isDraftCorrection` ;
- placée après `CONFIRM` et `REJECT`. Ces deux motifs sont des phrases entières (`/^(oui|…|je confirme|…)$/`), une phrase « Ajoute … comme fournisseur » ne peut pas les satisfaire. Ordre correct ;
- « Ajoute ACME comme fournisseur, son email est contact@acme.fr » et « …, email : contact@acme.fr » → `new_intent`, `revisesPendingDraft` faux, fiche client inchangée ;
- « son email est nouveau@dupont.fr » → forme `null` → reste `correction` ;
- `conversation-turn.ts` en MUST MODIFY, quatre tests obligatoires dans `tests/conversation-turn.test.ts`.

Le MAJOR-A de la revue précédente est fermé.

---

## 2. Cohérence des autres corrections

| Point | Statut |
|---|---|
| Matrice forme → ActionType (supplier, product, service) | OK |
| Rôles explicites `comme client|fournisseur|produit` prioritaires sur la forme service | OK pour supplier/product/service ; **casse le couple client + projet**, voir MAJOR-B |
| Service = `CREATE_PRODUCT` + `kind = service` imposé serveur, `kind` modèle seulement contrôlé | OK |
| Famille uniquement par `famille <valeur>`, omission limitée au marqueur | OK |
| Mots `OUTSIDE_V0` bloquants pour toutes les formes (étape 1) | OK |
| Détecteurs montant / SIREN / SIRET, téléphone qui ignore les séquences SIREN/SIRET | OK, une collision avec `reference`, voir MINOR-1 |
| Ancrage `reference` / `unit` par égalité exacte de segment | OK |
| `already` typé `client` / `supplier` / `product` | OK |
| `contact-differs` fournisseur, sans `update_supplier` | OK |
| Parseurs déterministes prioritaires (`Ajoute le fournisseur ACME`, `Ajoute le produit Switch X`) | OK |
| Garde-fou d’enrichissement client sur supplier/product/service | OK |
| Task suspendue (`Ajoute le service Audit réseau`) | OK |
| Carte : kind et family visibles | OK |
| Aucune migration Prisma | OK |
| Pas de prix, coût, TVA, UPDATE, `supplierName` en V1 ; clés interdites dans le JSON | OK |
| `Ajoute Service Premium` client / `Ajoute le Service Premium` service, documenté | OK |
| Liste de fichiers MUST / MAY / NO CHANGE | OK |

---

## 3. Findings

### MAJOR-B — La nouvelle `structuredShape` casse le couple client + projet déjà livré

**Où :** section A, étapes 2 et 4, et matrice B.

La forme `client+project` est définie comme « `PROJECT_CREATE` et, dans la même phrase, une création de client ». Or `PROJECT_CREATE` exige un verbe (`ouvre`, `crée`, `nouveau`) **directement** suivi de `dossier|projet|affaire`. Et l’étape 2 (`comme client` → `client`) est évaluée avant l’étape 4.

Résultats exécutés :

| Phrase | `PROJECT_CREATE` | Aujourd’hui (`eligible`, traduction de [CREATE_CLIENT, CREATE_PROJECT]) | Avec la spécification |
|---|---|---|---|
| Nouveau client Dupont. Dossier Toiture pour Dupont. | **false** | true, `business` | étape 4 échoue → forme `client` → la matrice n’accepte qu’un `CREATE_CLIENT` → **clarify** |
| Ajoute Dupont comme client et ouvre le dossier Toiture pour Dupont | true | true, `business` | étape 2 rend `client` avant l’étape 4 → **clarify** |
| Crée le client Dupont et ouvre le dossier Toiture pour Dupont | true | `business` | `client+project`, OK |

La première phrase est exactement la constante `folder` de `tests/structured-plan.test.ts`. Les tests existants « client et projet nouveaux deviennent un plan métier » et « client existant et projet deviennent seulement create_project » tomberaient, ou devraient être réécrits.

**Conséquence :** régression d’un comportement livré (couple client + projet → `BusinessPlan` ou `create_project`), hors du périmètre du lot.

**Correction de conception :**

- conserver pour la famille client / projet la reconnaissance actuelle, sans la redécouper : une seule forme `client-or-project` (ou les trois formes actuelles) acceptée quand `CLIENT_CREATE` ou `PROJECT_CREATE` reconnaît la phrase, comme aujourd’hui ;
- pour cette forme, la matrice reste la logique actuelle de `translateStructuredPlan` (un client, un projet, ou le couple client puis projet vérifié par `projectRolesMatch`) ;
- le rôle explicite `comme client` sert seulement à empêcher la forme `service` ; il ne restreint pas le plan à un seul `CREATE_CLIENT` ;
- ajouter aux tests de non-régression les deux phrases du tableau ci-dessus, avec le résultat `business`.

### MINOR-1 — Une référence produit de 9 ou 14 chiffres est prise pour un SIREN/SIRET

Section M : « une séquence d’exactement 9 chiffres » ou « 14 chiffres » → SIREN/SIRET → `omitted`. Section D : `référence 123456` est explicitement accepté. Une référence de 9 chiffres (`référence 123456789`) sera refusée comme SIREN omis.

Correction : pour les formes `product` et `service`, ne détecter le SIREN/SIRET que sur le mot `siren` / `siret` ; ou exclure du détecteur la valeur qui suit le marqueur `référence`. Ajouter un test.

### MINOR-2 — Deux rôles explicites dans la même phrase

« Ajoute ACME comme client et comme fournisseur » : l’ordre de l’étape 2 rend `supplier` sans signaler l’ambiguïté. Recommandation : deux rôles différents → `null` (ou `clarify`). Test à ajouter.

### Hors lot, pour mémoire

Avec une fiche client en attente, une phrase de forme `client` qui porte un champ (« Ajoute Martin comme client, son email est … ») reste classée `correction` de la fiche en attente. C’est le comportement actuel, non modifié par le lot. À noter au backlog.

---

## 4. Synthèse

Le dernier MAJOR (fiche client en attente) est résolu, et les corrections demandées sont cohérentes entre elles pour fournisseur, produit et service. En revanche, la redéfinition des formes client / projet dans `structuredShape` casse le couple client + projet déjà livré, sur la phrase de référence des tests actuels et sur « … comme client et ouvre le dossier … ». La correction est locale (garder la reconnaissance client / projet actuelle et limiter `comme client` à l’exclusion de la forme service), mais elle doit être écrite dans la spécification avant l’implémentation.

---

## Verdict

CORRECTIONS DE CONCEPTION
