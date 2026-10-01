# LOT-V3-007 — Revue Claude : conception corrigée

Outil : Claude (revue indépendante, lecture seule)
Baseline : BASELINE-8 — 4794328 — LOT-V3-006 validé
Objet : conception corrigée de Cursor dans `.ai/cursor-report.md`, en réponse à `.ai/task.md` (correction des quatre MAJOR de la revue précédente).

Aucun fichier source modifié. Aucun commit, aucun push. Suite de tests non relancée.

Fichiers lus : `AGENTS.md`, `.ai/project-state.md`, `.ai/task.md`, `.ai/cursor-report.md`, `.ai/claude-review.md` (précédente), `src/domain/structured-plan.ts`, `src/domain/catalog.ts`, `src/domain/client-file.ts`, `src/domain/conversation-turn.ts`, `src/domain/task-path.ts`, `src/domain/knowledge.ts`, `src/domain/intent-catalog.ts`, `src/app/api/assistant/route.ts`. Le code source n’a pas changé depuis la revue précédente.

Vérification exécutée sur une copie locale, sans écriture dans le dépôt : `classifyPendingTurn`, `readFieldFocus`, `understandIntent`, `identifyClient` et `decideFree` actuels, sur les phrases du lot (tableau en MAJOR-A).

---

## 1. Les quatre MAJOR précédents

### MAJOR-1 — Forme déterministe ↔ ActionType : RÉSOLU

- `structuredShape(text)` rend `client | project | client+project | supplier | product | service | null`, sur des formes fermées, dans un ordre fixe.
- `structuredPlanEligible` = refus actuels (question, négation, modification) + forme non nulle.
- `translateStructuredPlan` commence par la forme. Matrice stricte : `supplier` → un seul `CREATE_SUPPLIER` ; `product` → un seul `CREATE_PRODUCT`, kind `produit` ; `service` → un seul `CREATE_PRODUCT`, kind `service`. Toute autre combinaison → `clarify`, puis blocage par la route. Un `CREATE_CLIENT` rendu par Ollama sur une forme `supplier` ne peut plus devenir `create_client`.
- Kind imposé par le serveur. Un `kind` envoyé par le modèle doit être égal, sinon `clarify`. Le guide demande de ne pas l’envoyer.
- `fournisseur` et `produit` restent bloquants hors des formes `comme fournisseur` / `comme produit`. Le test existant « un fournisseur ou un produit ne devient pas un client » garde son sens.
- Branches implicites (`anchored`, `planNamesAreLabels`, `findOmittedStructuredFields`, `resolutionName`) rendues explicites par type.

Réserve mineure sur l’ordre des formes : voir MINOR-1.

### MAJOR-2 — Famille par marqueur explicite : RÉSOLU

- Famille lue seulement sur `famille <valeur>`, valeur exacte de `PRODUCT_FAMILIES` après pli ; hors liste ou plusieurs marqueurs → `clarify`.
- Omission limitée à ce marqueur.
- Un mot de famille dans le nom n’est ni famille ni omission (`Audit réseau`, `Serveur Dell R750`).
- La forme `prestation` fixe `kind = service`, pas `family = prestation`.

### MAJOR-3 — Enrichissement client : RÉSOLU pour `enrichmentOwnsTurn`

- Garde-fou dans `asksToEnrichRecord` et `enrichmentOwnsTurn` : `structuredShape ∈ {supplier, product, service}` → faux.
- Choix justifié de ne pas exclure la forme `client` entière (« Ajoute le téléphone de Martin » doit rester un enrichissement).
- Cas obligatoire (client ACME existant + « Ajoute ACME comme fournisseur, email contact@acme.fr ») couvert par un test dans `tests/client-file.test.ts`.
- `client-file.ts` en MUST MODIFY.

Il reste cependant un second chemin de capture côté client, dans la fiche en attente : voir MAJOR-A.

### MAJOR-4 — Consommateurs de `structuredPlanEligible` : PARTIELLEMENT RÉSOLU

- `conversation-turn.ts`, `task-path.ts`, `client-file.ts` sont intégrés, avec des tests de non-régression obligatoires. Bon.
- Task suspendue (section I) : l’analyse est juste. `NEW_WRITE` et l’éligibilité ferment déjà la reprise ; le lot change seulement le classement en `service`.
- Conversation pending (section H) : l’analyse est **incomplète**. Elle suppose que l’éligibilité suffit à rendre `new_intent`. C’est faux dès que la phrase porte un champ avec marqueur. Voir MAJOR-A.

---

## 2. Points complémentaires

| Point | Statut |
|---|---|
| `CREATE_SUPPLIER` et `CREATE_PRODUCT` seulement | OK |
| Service = `CREATE_PRODUCT` + `kind = service` imposé par le serveur | OK |
| Parseurs déterministes prioritaires (`Ajoute le fournisseur ACME` reste `parseCatalogCommand`) | OK |
| Pas de prix, coût, TVA, UPDATE, `supplierName` en V1 ; montant écrit → `omitted` | OK |
| Aucune migration Prisma (`Product.kind`, `Product.family`, `Supplier` existent) | OK |
| Carte `create_product` / `update_product` avec kind et family (MUST, `commandFields`) | OK |
| `already` typé `client` / `supplier` / `product`, lecture par `nameKey` dans la bonne table | OK |
| `contact-differs` fournisseur, sans `update_supplier` | OK |
| Une seule action fournisseur ou produit par plan | OK |
| Nom sans `comme` ni mot de rôle en tête ou en fin | OK |
| Recette corrigée (phrases 3 et 9 de l’ancienne liste retirées ou corrigées) | OK |

---

## 3. Findings

### MAJOR-A — Une fiche client en attente capte encore une création fournisseur avec champ

**Où :** `src/domain/conversation-turn.ts`, `classifyPendingTurn`. Route : `answerDirectly`, bloc `if (pending)`, avant StructuredPlan.

`classifyPendingTurn` teste `isDraftCorrection` **avant** `isIndependentIntent`. L’éligibilité StructuredPlan n’est jamais consultée si la phrase ressemble à une correction de champ.

Résultats actuels, exécutés :

| Phrase | `classifyPendingTurn` | `readFieldFocus` |
|---|---|---|
| Ajoute ACME comme fournisseur | unknown | null |
| Ajoute ACME comme fournisseur, email contact@acme.fr | unknown | null |
| Ajoute ACME comme fournisseur, **son email est** contact@acme.fr | **correction** | draft, contact@acme.fr |
| Ajoute ACME comme fournisseur, **email :** contact@acme.fr | **correction** | draft, contact@acme.fr |
| Ajoute ACME comme fournisseur, téléphone 06 12 34 56 78 | unknown | null |
| Ajoute le service Audit réseau | new_intent | null |

**Scénario :** une `ClientProposal` est en attente (par exemple Dupont). L’utilisateur écrit « Ajoute ACME comme fournisseur, son email est contact@acme.fr ». `enrichmentOwnsTurn` est bien faux grâce au nouveau garde-fou, mais `pending` est vrai, `classifyPendingTurn` rend `correction`, `revisesPendingDraft` est vrai, et la route appelle `reviseDraft` sur la fiche client en attente puis `openClientProposal`.

**Conséquence :** la fiche client en attente reçoit l’e-mail du fournisseur et une nouvelle proposition client remplace la précédente. Aucun fournisseur n’est proposé. Rien n’est écrit avant confirmation, mais c’est exactement le cas que `.ai/task.md` exclut (« Pas une correction de la fiche client en attente »), et la section H affirme à tort que la phrase devient `new_intent`.

**Correction de conception :**

- dans `classifyPendingTurn` (ou en tête de `isDraftCorrection`), `structuredShape ∈ {supplier, product, service}` → `new_intent`, avant le test de correction ;
- `src/domain/conversation-turn.ts` passe de MAY à **MUST MODIFY** ;
- tests dans `tests/conversation-turn.test.ts` : fiche client en attente + « Ajoute ACME comme fournisseur, son email est contact@acme.fr » et « …, email : contact@acme.fr » → `new_intent`, pas `correction` ; et une vraie correction (« son email est … » seul) reste `correction`.

### MINOR-1 — Ordre des formes : `service` avant `comme client`

`service` est testé en premier. « Ajoute le Service Plus comme client » (déterminant + `Service`) devient une forme `service`. Le modèle rendra `CREATE_CLIENT`, la matrice répondra `clarify`, et la phrase sera bloquée alors qu’elle est cliente aujourd’hui. Même ambiguïté pour « Ajoute la prestation X comme produit ».

Correction : un tour explicite `comme client|fournisseur|produit` l’emporte sur la forme `service`, ou la forme `service` exclut la présence d’un `comme <rôle>`. Ajouter les deux phrases aux tests.

### MINOR-2 — Mots hors V0 dans les formes catalogue

La conception dit que `client` exige l’absence de mot `OUTSIDE_V0`, mais ne dit pas si `supplier`, `product`, `service` le doivent aussi (« Ajoute ACME comme fournisseur de contrats », « Ajoute Switch X200 comme produit pour le contrat Dupont »). Préciser la règle. Recommandation : les autres mots `OUTSIDE_V0` (contrat, intervention, équipement, réclamation, retour, catalogue, article) restent bloquants pour toutes les formes.

### MINOR-3 — Détecteurs d’omission non définis

« Montant reconnu » et « SIREN ou SIRET reconnu » n’ont pas de détecteur écrit. Un SIRET de 14 chiffres est aussi vu par `phoneCandidates` (au moins 10 chiffres), donc détecté comme téléphone omis. Définir les deux détecteurs (montant : `€`, `EUR`, `euro(s)`, `$`, `USD` à côté d’un nombre ; SIREN/SIRET : mot `siren` / `siret` ou 9/14 chiffres groupés) et exclure leurs chiffres de la détection de téléphone.

### MINOR-4 — Ancrage des args produit courts

`expressionAnchored` exige trois caractères utiles dont une lettre. Une unité (`u`, `m2`) ou une référence entièrement numérique (`123456`) ne s’ancre jamais : le plan sera refusé si le modèle la porte. Soit documenter la limite, soit ancrer ces deux champs par égalité de segment sans la règle des trois caractères.

### MINOR-5 — `Ajoute le Service Premium`

Avec déterminant, « Ajoute le Service Premium » devient une forme `service`, alors que « Ajoute Service Premium » est `client`. Le comportement est cohérent avec la règle, mais il doit être écrit dans la recette et le manuel pour ne pas surprendre.

---

## 4. Fichiers — liste à retenir

**MUST MODIFY**

- `src/domain/structured-plan.ts`
- `src/app/api/assistant/route.ts`
- `src/domain/client-file.ts`
- `src/domain/conversation-turn.ts` (MAJOR-A, au lieu de MAY)
- `src/domain/catalog.ts`
- `tests/structured-plan.test.ts`
- `tests/client-file.test.ts`
- `tests/conversation-turn.test.ts`
- `docs/manuel-utilisateur.md`

**MAY MODIFY / tests obligatoires**

- `src/domain/task-path.ts`, `tests/task-path.test.ts`
- `tests/catalog-command.test.ts`
- `docs/technique/docs/orchestration.md`

**NO CHANGE**

- `prisma/schema.prisma`, `prisma/migrations`
- `src/lib/catalog-store.ts`
- `src/lib/catalog-proposals.ts`
- `src/domain/pricing.ts`
- `src/lib/business-records.ts`

---

## 5. Synthèse

Trois MAJOR sur quatre sont résolus, et les points complémentaires sont conformes. Le quatrième (consommateurs de l’éligibilité) laisse un trou concret et reproduit : avec une fiche client en attente, une création fournisseur, produit ou service qui porte un champ avec marqueur (« son email est », « email : ») est traitée comme une correction de la fiche client. La correction est petite (forme catalogue → `new_intent` avant le test de correction, `conversation-turn.ts` en MUST, deux tests), mais elle doit figurer dans la conception avant l’implémentation.

---

## Verdict

CORRECTIONS DE CONCEPTION
