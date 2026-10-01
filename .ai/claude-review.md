# LOT-V3-007 — Revue Claude ciblée : conception StructuredPlan fournisseur / produit / service

Outil : Claude (revue indépendante, lecture seule)
Baseline : BASELINE-8 — 4794328 — LOT-V3-006 validé
Objet : audit de conception de Cursor (`.ai/cursor-report.md`) en réponse à `.ai/task.md`.

Aucun fichier source modifié. Aucun commit, aucun push. Suite de tests non relancée.

Vérification exécutée (copie locale, sans écriture dans le dépôt) des prédicats actuels sur les phrases du lot :

| Phrase | `structuredPlanEligible` | `outsideStructuredPlan` | `parseCatalogCommand` | `asksToEnrichRecord` |
|---|---|---|---|---|
| Ajoute ACME comme fournisseur | false | true | null | false |
| Ajoute ACME comme fournisseur, email contact@acme.fr | false | true | null | **true** |
| Ajoute Switch X200 comme produit | false | true | null | false |
| Ajoute le service Audit réseau | **true** | false | null | false |
| Ajoute une prestation Audit réseau | **true** | false | null | false |
| Ajoute Service Premium | true | false | null | false |
| Ajoute le fournisseur ACME | false | true | create_supplier | false |

Ces résultats confirment le constat de Cursor en H, et le MAJOR-3 ci-dessous (`asksToEnrichRecord` vrai sur la forme fournisseur avec e-mail).

Fichiers lus : `AGENTS.md`, `.ai/project-state.md`, `.ai/task.md`, `.ai/cursor-report.md`, `src/domain/structured-plan.ts`, `src/domain/catalog.ts`, `src/domain/measures.ts`, `src/domain/client-file.ts`, `src/domain/conversation-turn.ts`, `src/domain/knowledge.ts`, `src/domain/intent-catalog.ts`, `src/lib/catalog-store.ts`, `src/lib/supplier-offers.ts`, `src/app/api/assistant/route.ts`, `prisma/schema.prisma`, `tests/structured-plan.test.ts`.

---

## Réponses aux 12 points

### 1. `CREATE_SUPPLIER` et `CREATE_PRODUCT` suffisent — OUI

`CatalogCommand` a déjà `create_supplier` (`PartyInput`) et `create_product` (`ProductInput`), écrits par `createParty("supplier")` et `createProduct`. Deux ActionTypes couvrent les trois besoins.

### 2. Pas de `CREATE_SERVICE` — OUI

Aucune entité `Service`, aucune commande `create_service`. Un troisième type ne ferait que dupliquer `CREATE_PRODUCT`.

### 3. `Product.kind = "service"` est la représentation actuelle — OUI

`schema.prisma` : `Product.kind String @default("produit")`. `ProductInput.kind?`, `validateProduct` ramène toute valeur à `service` ou `produit`, et `createProduct` l’écrit. `Product.family` est une autre colonne, liste fermée `PRODUCT_FAMILIES` (`serveur`, `poste`, `portable`, `reseau`, `prestation`, `autre`), lue par `readProductFamily` en égalité stricte après pli. Le verdict de Cursor, « service représenté par `Product.kind = "service"` », est exact.

### 4. Les parseurs déterministes restent prioritaires — OUI

`parseCatalogCommand` est appelé dans `answerDirectly`, avant `decideFree` et `structuredPlanGate`. Les formes `ajoute|crée|ouvre + (le|un|…) + fournisseur|produit + nom` restent déterministes, ne coûtent pas d’appel Ollama et ne changent pas de comportement. Garder cet ordre est correct.

### 5. Formes naturelles sans régression vers CREATE_CLIENT — NON EN L’ÉTAT (MAJOR-1, MAJOR-3)

Aujourd’hui, la seule chose qui empêche « Ajoute ClimPro comme fournisseur » de devenir un `create_client` est `outsideStructuredPlan`, testée deux fois : dans `structuredPlanEligible` **et** au début de `translateStructuredPlan`. Le test existant « un fournisseur ou un produit ne devient pas un client » repose sur le second appel : un plan `CREATE_CLIENT { name: "ClimPro" }` est accepté par `parseStructuredPlan` (le nom est ancré), puis la traduction répond `clarify` uniquement parce que le message contient `fournisseur`.

La conception retire `fournisseurs?` et `produits?` d’`OUTSIDE_V0` sans dire ce qui remplace ce verrou. Si Ollama rend `CREATE_CLIENT` pour « Ajoute ACME comme fournisseur », la traduction produira `create_client`. Voir MAJOR-1.

Second chemin, avant StructuredPlan : `enrichmentOwnsTurn` → `asksToEnrichRecord`. Voir MAJOR-3.

### 6. Règles `OUTSIDE_V0`, `structuredPlanEligible`, routage — insuffisamment précises (MAJOR-1, MAJOR-4)

- La règle « exiger la forme comme fournisseur » est la bonne direction, mais elle n’est pas écrite comme règle fermée, et rien ne relie la forme reconnue au type d’action accepté.
- La distinction « Ajoute le service Audit réseau » (produit service) / « Ajoute Service Premium » (client) n’est pas spécifiée. Il faut une forme déterministe : déterminant + `service|prestation` + nom.
- `structuredPlanEligible` est consommé hors de la route : `isIndependentIntent` (`conversation-turn.ts`), le refus de reprise d’un parcours suspendu (`task-path.ts`, l. 60) et `explicitClientCreation` (`client-file.ts`). Élargir l’éligibilité change ces trois comportements. Voir MAJOR-4.

### 7. Ancrage sans invention — OK pour nom et contacts, NON pour famille et kind (MAJOR-2)

- Nom : `expressionAnchored` (segment de mots entier, au moins 3 caractères utiles) + `plainLabel`. Bloque `ACME France` et `Switch X200 Pro`. OK.
- Email, téléphone, adresse : `emailAnchored`, `phoneAnchored`, `addressAnchored` réutilisables tels quels pour le fournisseur. OK.
- Famille : la règle d’omission proposée (« une famille de la liste présente dans le message et absente du plan est un champ omis ») détecte des mots qui font partie du **nom**. Voir MAJOR-2.
- Kind : laisser le modèle choisir `kind` puis vérifier un mot ne suffit pas. Le kind doit venir de la forme reconnue côté serveur. Voir MAJOR-1.
- Nom contenant le rôle : rien n’empêche `name = "ACME comme fournisseur"` ou `name = "service Audit réseau"`, qui sont ancrés et passent `plainLabel`. Voir MINOR-1.

### 8. Refus `already` avant `CatalogProposal` — cohérent, à compléter

Même logique que le client (`already` sans proposition, aucune bascule vers `update_*`). Deux ajustements :

- `answerFromStructuredPlan` lit seulement `prisma.client` et répond « Le client … existe déjà ». La lecture et le message doivent dépendre du type d’action (`supplier.findUnique` / `product.findUnique` par `nameKey`).
- Le client a aussi `contact-differs`. Un fournisseur existant avec un e-mail différent doit avoir la même réponse, sinon l’utilisateur lit « existe déjà » alors que son e-mail est ignoré. Voir MINOR-3.

### 9. Pas de prix, coût, `supplierName`, UPDATE en V1 — cohérent

- `supplierName` vide évite `ensureSupplier`, qui créerait un fournisseur caché à la confirmation. Bonne décision.
- Montants : aucun ancrage monétaire n’existe. Les laisser OUT et refuser un montant écrit (omission) est sûr.
- UPDATE : `update_supplier` / `update_product` existent déjà en déterministe. Les laisser OUT.

### 10. Une seule action fournisseur ou produit par plan — bon périmètre

Une `CatalogProposal` porte une `CatalogCommand`. `BusinessPlan` n’a pas de fournisseur. Lier produit et fournisseur exigerait une référence entre actions. Le couple client + projet reste le seul couple. OK.

### 11. Aucune migration Prisma — CONFIRMÉ

`Supplier`, `Product.kind`, `Product.family`, `CatalogProposal` et ses statuts existent.

### 12. Fichiers MUST / MAY / NO CHANGE — incomplets (MAJOR-4)

Voir la liste corrigée en fin de rapport.

---

## Findings

### MAJOR-1 — Aucun contrôle entre la forme de la phrase et le type d’action

**Où :** conception de `structuredPlanEligible`, `outsideStructuredPlan`, `translateStructuredPlan`.

**Scénario :** « Ajoute ACME comme fournisseur ». Le mot `fournisseur` n’est plus bloquant. Ollama rend `CREATE_CLIENT { name: "ACME" }`. Le nom est ancré, la traduction n’a plus de raison de répondre `clarify`.

**Conséquence :** proposition `create_client` pour une phrase fournisseur. Le test existant « un fournisseur ou un produit ne devient pas un client » tombera, ou sera réécrit pour passer. Même risque pour « Ajoute le service Audit réseau » rendu en `CREATE_CLIENT`, et pour un produit dont le modèle oublie `kind` (produit au lieu de service, sans erreur visible).

**Correction de conception :**

1. Une fonction déterministe unique, par exemple `structuredShape(text)`, qui rend `client | project | client+project | supplier | product | service | null` à partir de formes fermées :
   - `supplier` : `… comme fournisseur(s)` ;
   - `product` : `… comme produit(s)` ;
   - `service` : `ajoute|crée` + `le|un|une|la` + `service|prestation` + nom ;
   - `client` / `project` : formes actuelles.
2. `structuredPlanEligible` = forme reconnue (et les refus actuels question / négation / modification).
3. `translateStructuredPlan` exige que le type des actions corresponde à la forme : `supplier` → exactement un `CREATE_SUPPLIER` ; `product` → un `CREATE_PRODUCT`, `kind` forcé à `produit` ; `service` → un `CREATE_PRODUCT`, `kind` forcé à `service` par le serveur. Toute autre combinaison → `clarify`.
4. `OUTSIDE_V0` garde ses autres mots. Les mots `fournisseur` et `produit` restent bloquants hors des formes `comme fournisseur` / `comme produit`.
5. « Ajoute Service Premium » (pas de déterminant devant `Service`) reste une forme client, inchangée.

### MAJOR-2 — La règle d’omission de famille refuse des phrases légitimes

**Où :** sections K, L, T et S du rapport Cursor.

**Scénario :** « Ajoute une prestation Audit réseau ». Le message contient `prestation` et `réseau`, deux valeurs de `PRODUCT_FAMILIES`. Le plan ne peut porter qu’une famille. La règle « famille de la liste présente dans le message et absente du plan » déclare l’autre omise. Le JSON cible de Cursor pour ce cas (`family: "prestation"`) est donc refusé par sa propre règle. Même chose pour « Ajoute le service Audit réseau » (`réseau`), « Ajoute Serveur Dell R750 comme produit » (`serveur`), « Ajoute Poste HP 800 comme produit » (`poste`).

**Conséquence :** une part des phrases visées par le lot est refusée à coup sûr, ou le modèle est poussé à mettre une famille qui n’est qu’un mot du nom.

**Correction de conception :**

- la famille n’est lue que sur un marqueur explicite : `famille <valeur>` (ou `, famille <valeur>`) ;
- la règle d’omission porte seulement sur ce marqueur ;
- un mot de famille à l’intérieur du nom n’est ni une famille, ni un champ omis ;
- la forme `prestation` donne `kind: "service"`. Elle ne pose pas `family: "prestation"` d’office. Si le produit doit avoir cette famille, la phrase la dit (`famille prestation`). À défaut, documenter explicitement que la forme `prestation` pose aussi la famille, et exclure ce mot de la détection d’omission.

### MAJOR-3 — L’enrichissement client capte la forme fournisseur avec contact

**Où :** `src/domain/client-file.ts`, `asksToEnrichRecord` / `enrichmentOwnsTurn`, appelé dans `answerDirectly` avant StructuredPlan.

**Scénario :** « Ajoute ACME comme fournisseur, email contact@acme.fr ». `asksToEnrichRecord` voit un verbe (`ajoute`) et un sujet (`email`) et rend vrai. Le seul garde-fou est `explicitClientCreation`, qui ne connaît que les créations client. `enrichmentOwnsTurn` est vrai, `proposeChangeFromMessage` cherche un **client** nommé dans la phrase.

**Conséquence :** si un client ACME existe déjà (cas normal quand client et fournisseur partagent une `Organization`), la phrase ouvre une proposition de **mise à jour du client ACME** avec cet e-mail, au lieu d’un fournisseur. C’est la recette n° 2 proposée par Cursor.

**Correction de conception :** le garde-fou d’enrichissement doit aussi exclure une forme de création reconnue (`structuredShape(text) !== null`, ou un `explicitCatalogCreation`). `client-file.ts` passe en MUST MODIFY, avec un test : client ACME existant + « Ajoute ACME comme fournisseur, email … » ne propose pas de mise à jour client.

### MAJOR-4 — Consommateurs de `structuredPlanEligible` absents de la liste de fichiers

**Où :** section X du rapport Cursor.

`structuredPlanEligible` est appelé par :

- `src/domain/conversation-turn.ts` (`isIndependentIntent`) : avec une fiche client en attente, une phrase éligible devient `new_intent`, sinon `pendingClarification` la retient. Aujourd’hui « Ajoute ACME comme fournisseur » est retenue par la fiche en attente. Après le lot, elle partira vers StructuredPlan ;
- `src/domain/task-path.ts` (l. 60) : une phrase éligible ne reprend pas un parcours suspendu ;
- `src/domain/client-file.ts` (`explicitClientCreation`).

**Conséquence :** comportement modifié hors du périmètre annoncé, sans test de non-régression prévu.

**Correction de conception :** classer ces trois fichiers au moins en MAY MODIFY (`client-file.ts` en MUST, voir MAJOR-3), et prévoir des tests dans `tests/conversation-turn.test.ts`, `tests/task-path.test.ts`, `tests/client-file.test.ts` : fiche client en attente + phrase fournisseur, parcours suspendu + phrase service.

### MINOR-1 — Le nom peut contenir le mot de rôle

`expressionAnchored` accepte `ACME comme fournisseur` ou `service Audit réseau`, et `plainLabel` ne bloque ni `comme`, ni `fournisseur`, ni `service`. Ajouter une règle : le nom ne contient pas `comme`, ni le mot de rôle de la forme en tête ou en fin. Le cas existe déjà pour le client (`Dupont comme client`), sans test visible.

### MINOR-2 — Branches implicites dans `structured-plan.ts`

`anchored` et `planNamesAreLabels` traitent tout ce qui n’est pas `CREATE_CLIENT` comme un `CREATE_PROJECT` (`clientName`). `findOmittedStructuredFields` ne regarde que `CREATE_CLIENT`. `CONFIDENCE_FIELDS`, `PlanTranslation.already`, `ContactField`, `structuredPlanGuide` et `resolutionName` sont spécifiques au client. La conception doit demander des branches explicites par type, et un `already` qui porte le type (`client | supplier | product`).

### MINOR-3 — Fournisseur existant avec contact différent

Prévoir l’équivalent de `contact-differs` pour `CREATE_SUPPLIER`, sans mise à jour.

### MINOR-4 — La carte doit montrer le kind

`presentCommand` n’affiche ni `kind` ni `family`. Si « service » n’apparaît pas sur la carte, l’utilisateur confirme sans voir la différence. Passer « afficher kind et family » de SHOULD à MUST (`catalog.ts`, `commandFields`).

### MINOR-5 — Recette incohérente avec la conception

- n° 3 « Le fournisseur s’appelle ACME, son téléphone est … » : pas de verbe de création, donc non éligible, et `understandIntent` rend `change` (téléphone + est). Ce n’est pas un cas StructuredPlan. À retirer, ou à garder comme refus attendu.
- n° 9 « Ajoute le fournisseur ACME » alors qu’ACME existe : voie déterministe, qui ouvre une proposition (Cursor le dit en M). Le résultat attendu « refus » contredit « parseur non réécrit ». Attendu correct : proposition, puis « existe déjà » à la confirmation, aucune deuxième fiche.
- n° 10 : la phrase citée est déterministe (`le produit …`). Pour tester l’ancrage StructuredPlan, utiliser « Ajoute Switch X200 comme produit » avec un plan `Switch X200 Pro`, en test unitaire.
- Ajouter : client ACME existant + « Ajoute ACME comme fournisseur, email … » (MAJOR-3) ; « Ajoute une prestation Audit réseau » (MAJOR-2) ; « Ajoute Service Premium » reste client.

### MINOR-6 — Noms courts

`expressionAnchored` exige 3 caractères utiles. « Ajoute HP comme fournisseur » ou « Ajoute 3M comme fournisseur » seront refusés. À documenter comme limite connue (la voie déterministe « Ajoute le fournisseur HP » reste disponible).

---

## Fichiers — liste corrigée

**MUST MODIFY**

- `src/domain/structured-plan.ts` (forme, types, ancrage, omission, traduction, guide)
- `src/app/api/assistant/route.ts` (lecture `already` par type, messages, `publishBlocked`)
- `src/domain/client-file.ts` (garde-fou d’enrichissement, MAJOR-3)
- `src/domain/catalog.ts` (`commandFields` : kind et family sur la carte)
- `tests/structured-plan.test.ts`
- `tests/client-file.test.ts`
- `docs/manuel-utilisateur.md` (règle `AGENTS.md` : toute règle visible met à jour le manuel)

**MAY MODIFY (ou tests de non-régression obligatoires)**

- `src/domain/conversation-turn.ts` + `tests/conversation-turn.test.ts`
- `src/domain/task-path.ts` + `tests/task-path.test.ts`
- `tests/catalog-command.test.ts` (frontière parseur / plan)
- `docs/technique/docs/orchestration.md`

**NO CHANGE**

- `prisma/schema.prisma`, `prisma/migrations`
- `src/lib/catalog-store.ts`
- `src/lib/catalog-proposals.ts`
- `src/domain/pricing.ts`
- `src/lib/business-records.ts`

---

## Ce qui est validé

- deux ActionTypes, pas de `CREATE_SERVICE` ;
- service = `Product.kind = "service"` ;
- parseurs déterministes devant StructuredPlan ;
- ancrage du nom et des contacts par les helpers existants ;
- refus `already` avant proposition, sans UPDATE silencieux ;
- prix, coût, `supplierName`, UPDATE, multi-actions et liens entre actions OUT V1 ;
- aucune migration.

## Ce qui doit être corrigé dans la conception avant d’implémenter

1. MAJOR-1 : forme déterministe → type d’action attendu, kind fixé par le serveur.
2. MAJOR-2 : famille lue sur le seul marqueur `famille <valeur>`, omission limitée à ce marqueur.
3. MAJOR-3 : garde-fou d’enrichissement client étendu aux formes de création catalogue.
4. MAJOR-4 : consommateurs de `structuredPlanEligible` listés et testés.

---

## Verdict

CORRECTIONS DE CONCEPTION
