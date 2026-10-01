# LOT-V3-007 — Revue Claude : validation de la spécification consolidée finale

Outil : Claude (revue indépendante, lecture seule)
Baseline : BASELINE-8 — 4794328 — LOT-V3-006 validé
Objet : spécification consolidée finale de `.ai/cursor-report.md`, en réponse au « Complément final après validation Claude — préserver client + projet » de `.ai/task.md`.

Aucun fichier source modifié. Aucun commit, aucun push. Suite de tests non relancée.

Fichiers lus : `AGENTS.md`, `.ai/project-state.md`, `.ai/task.md`, `.ai/cursor-report.md`, `.ai/claude-review.md` (précédente). Code de référence déjà lu lors des revues précédentes et inchangé depuis : `src/domain/structured-plan.ts`, `src/domain/conversation-turn.ts`, `src/domain/client-file.ts`, `src/domain/task-path.ts`, `tests/structured-plan.test.ts`.

Comportement actuel déjà exécuté (revue précédente, copie locale) : avec un plan `[CREATE_CLIENT Dupont, CREATE_PROJECT Toiture/Dupont]` et aucun client connu, `Nouveau client Dupont. Dossier Toiture pour Dupont.` et `Ajoute Dupont comme client et ouvre le dossier Toiture pour Dupont` sont éligibles et traduits en `business`. `PROJECT_CREATE` est faux sur la première phrase, vrai sur la deuxième et sur `Crée le client Dupont et ouvre le dossier Toiture pour Dupont`.

---

## 1. MAJOR-B (couple client + projet) — RÉSOLU sans régression

La spécification ne redécoupe plus le client et le projet. Elle remplace les formes `client`, `project` et `client+project` par une seule famille `client-or-project`, reconnue par la règle actuelle `CLIENT_CREATE ou PROJECT_CREATE`, et traduite par la logique actuelle de `translateStructuredPlan`.

| Exigence | Section | Statut |
|---|---|---|
| Logique client / projet de BASELINE-8 conservée | A étape 5, B | OK |
| `CREATE_CLIENT` seul (inconnu → `create_client`, connu → `already` ou `contact-differs`) | B.1 | OK |
| `CREATE_PROJECT` seul (`unknown-client` ou `create_project`) | B.2 | OK |
| `CREATE_CLIENT` puis `CREATE_PROJECT`, même `nameKey` | B.3 | OK |
| `projectRolesMatch` reste le contrôle du couple et du projet seul | B | OK |
| Client existant + nouveau projet → `create_project` seulement, ou `contact-differs` avec `withProject` vrai | B.3, K | OK |
| `comme client` sert seulement à écarter la forme service | A étapes 4 et 5, B | OK |
| Branches `CREATE_CLIENT` / `CREATE_PROJECT` de `anchored`, `planNamesAreLabels`, `findOmittedStructuredFields`, `resolutionName` inchangées | A | OK |
| Les tests existants « client et projet nouveaux deviennent un plan métier » et « client existant et projet deviennent seulement create_project » restent verts sans réécriture | O | OK |

Déroulé des trois phrases de non-régression avec l’ordre de la section A :

| Phrase | Étape 1 | Étape 2 | Étapes 3–4 | Étape 5 | Traduction attendue |
|---|---|---|---|---|---|
| Nouveau client Dupont. Dossier Toiture pour Dupont. | aucun mot bloquant | aucun rôle | ni rôle catalogue, ni service | `CLIENT_CREATE` vrai → `client-or-project` | logique actuelle → `business` |
| Ajoute Dupont comme client et ouvre le dossier Toiture pour Dupont | aucun | un seul rôle (`client`) | pas de rôle catalogue ; service écarté par le rôle | `client-or-project` | logique actuelle → `business` |
| Crée le client Dupont et ouvre le dossier Toiture pour Dupont | aucun | aucun | ni rôle, ni service (`le client`, pas `le service`) | `client-or-project` | logique actuelle → `business` |

Les trois résultats correspondent au comportement actuel. L’échec de `PROJECT_CREATE` sur la première phrase n’a plus d’effet, ce qui était la cause du MAJOR-B.

Pour la famille `client-or-project`, l’éligibilité reste équivalente à l’actuelle : mots bloquants (contrat, intervention, équipement, réclamation, retour, catalogue, article, et `fournisseur` / `produit` hors formes catalogue), puis `CLIENT_CREATE ou PROJECT_CREATE`. Les seules phrases qui quittent cette famille sont celles que le lot vise : `ajoute|crée + déterminant + service|prestation` (devenues `service`) et les tours `comme fournisseur` / `comme produit` (jusqu’ici inéligibles).

Les détecteurs nouveaux (montant, SIREN/SIRET) ne s’appliquent qu’aux formes `supplier`, `product`, `service`. La famille `client-or-project` garde sa détection d’omission actuelle (e-mail, téléphone, adresse). Pas d’effet de bord sur le client.

---

## 2. Points demandés en complément

### Référence numérique — RÉSOLU

Section M : pour `product` et `service`, la séquence qui suit le marqueur `référence` est une référence, pas un SIREN/SIRET, même à 9 ou 14 chiffres. `phoneCandidates` l’ignore aussi. Le mot `siren` / `siret` dans la phrase produit toujours `omitted`. Une séquence de 9 ou 14 chiffres hors `référence` reste un SIREN/SIRET. Sur une forme `supplier` (pas d’arg `reference`), la règle générale s’applique, ce qui est cohérent. Test prévu : `Ajoute Switch X comme produit, référence 123456789`.

### Deux rôles explicites différents — RÉSOLU

Section A étape 2 : deux familles de rôle différentes (`client`, `supplier`, `product`) → `null`, aucune création, aucun choix. La même famille répétée compte pour une seule. Test prévu : `Ajoute ACME comme client et comme fournisseur` → `null`. Cette phrase est déjà inéligible aujourd’hui (mot `fournisseur`) : aucune régression.

---

## 3. Cohérence des corrections déjà validées

| Point | Statut |
|---|---|
| Forme catalogue → `new_intent` avant `isDraftCorrection`, après `CONFIRM`/`REJECT` (phrases entières) | OK, inchangé |
| `son email est …` / `email : …` sur une forme fournisseur ne corrigent plus la fiche en attente ; correction seule reste `correction` | OK |
| Matrice supplier / product / service, `kind` imposé serveur, `kind` modèle seulement contrôlé | OK |
| Rôle explicite prioritaire sur la forme service ; `Service Premium` avec / sans déterminant documenté | OK |
| Famille uniquement par `famille <valeur>` | OK |
| Mots `OUTSIDE_V0` bloquants pour toutes les formes | OK |
| Détecteurs montant / SIREN / SIRET distincts du téléphone | OK |
| Ancrage `reference` / `unit` par égalité de segment | OK |
| Garde-fou d’enrichissement client sur supplier / product / service | OK |
| `already` typé, message client actuel conservé | OK |
| `contact-differs` fournisseur sans `update_supplier` | OK |
| Parseurs déterministes prioritaires | OK |
| Task suspendue | OK |
| Carte kind et family | OK |
| Aucune migration Prisma | OK |
| Pas de prix, coût, TVA, UPDATE, `supplierName` ; clés interdites dans le JSON | OK |
| Fichiers MUST / MAY / NO CHANGE | OK |
| Hors lot noté (`Ajoute Martin comme client, son email est …` avec fiche en attente) | OK, au backlog |

---

## 4. Findings

Aucun CRITICAL. Aucun MAJOR.

### MINOR-1 — Variantes du marqueur `référence`

La spécification écrit `référence`. Préciser à l’implémentation que le marqueur est lu après pli (`reference`, `Référence`) et indiquer si `réf` / `ref` sont acceptés. Sinon `reference 123456789` sans accent redevient un SIREN omis.

### MINOR-2 — Déterminants de la forme service

La forme service accepte `le|la|un|une`. `Création d’un service Audit réseau` et `Crée un nouveau service Audit réseau` ne la satisfont pas et restent dans la famille `client-or-project`, comme aujourd’hui. Ce n’est pas une régression, mais `d’un|d’une` (et éventuellement `nouveau|nouvelle` après le déterminant) peuvent être ajoutés, ou la limite documentée avec `Service Premium`.

### Rappel d’implémentation (non bloquant)

Les ordres de la section A et de la section H sont des contrats. Les tests listés en O doivent les fixer explicitement, en particulier :

- les trois phrases client + projet → `business` ;
- `Ajoute le Service Plus comme client` → `client-or-project` ;
- `Ajoute ACME comme client et comme fournisseur` → `null` ;
- les quatre cas de `tests/conversation-turn.test.ts`.

---

## 5. Synthèse

Le MAJOR-B est résolu : la famille client / projet reprend exactement la reconnaissance et la traduction de BASELINE-8, `projectRolesMatch` reste le contrôle du couple, et `comme client` ne sert plus qu’à écarter la forme service. Les trois phrases de non-régression gardent leur résultat `business`. Les deux compléments (référence numérique, rôles multiples) sont spécifiés et testés. Les corrections validées lors des revues précédentes restent cohérentes entre elles. Les deux points restants sont mineurs et peuvent être traités pendant l’implémentation.

---

## Verdict

GO IMPLEMENTATION LOT-V3-007
