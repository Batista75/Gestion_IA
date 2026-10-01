# Conception corrigée LOT-V3-007

Conception seulement. Aucun fichier source. Aucune migration. Aucun commit.

Baseline fonctionnelle : `BASELINE-8 — 4794328 — LOT-V3-006 validé` (`479432872e5148efbb475df2ff1ff57d9042a866`).

Cette version remplace la conception précédente. Elle intègre les quatre findings MAJOR de la revue Claude, et les MINOR qui changent le contrat.

Le modèle ne choisit pas le kind. Il ne écrit pas. Le serveur déduit la forme, valide le plan, ouvre une `CatalogProposal`, et n’écrit qu’après confirmation.

## A. structuredShape

Nouvelle fonction déterministe dans `src/domain/structured-plan.ts` :

```text
structuredShape(text) →
  client | project | client+project | supplier | product | service | null
```

Elle ne lit que des formes fermées. Premier motif gagnant, dans cet ordre :

1. `service` — début de création `ajoute|crée|créer|création`, puis un déterminant `le|la|un|une`, puis le mot `service` ou `prestation`, puis un nom.
2. `supplier` — un verbe de création et le tour exact `comme fournisseur` ou `comme fournisseurs`.
3. `product` — un verbe de création et le tour exact `comme produit` ou `comme produits`.
4. `client+project` — la forme de dossier actuelle (`PROJECT_CREATE`) et, dans la même phrase, une création de client déjà reconnue.
5. `project` — `PROJECT_CREATE` seul.
6. `client` — la création client actuelle (`CLIENT_CREATE`), seulement si aucun mot de `OUTSIDE_V0` n’est présent.
7. `null`.

`structuredPlanEligible` devient :

```text
phrase non vide
et pas une question, une négation, ni un verbe de modification ou de suppression
et structuredShape ≠ null
```

`OUTSIDE_V0` conserve contrat, intervention, équipement, réclamation, retour, catalogue, article, et aussi `fournisseur` et `produit`. Ces deux derniers mots ne bloquent plus les seules formes `comme fournisseur` et `comme produit`, parce que ces formes sont reconnues avant le blocage. Hors de ces formes, `fournisseur` et `produit` restent bloquants : `Ajoute le fournisseur ACME` n’est pas une forme StructuredPlan.

`translateStructuredPlan` commence par `structuredShape`. La forme `null`, ou un `ActionType` qui n’est pas celui de la matrice, donne `clarify`. La route, déjà, transforme un plan éligible non accepté en blocage. Aucune autre création n’est ouverte.

Les branches aujourd’hui implicites deviennent explicites. `anchored`, `planNamesAreLabels`, `findOmittedStructuredFields` et `resolutionName` traitent `CREATE_SUPPLIER` et `CREATE_PRODUCT` par leur type. Tout ce qui n’est pas `CREATE_CLIENT` ne sera plus lu comme un `CREATE_PROJECT`.

## B. Matrice forme → ActionType

| Forme | Action acceptée | Kind écrit par le serveur |
| --- | --- | --- |
| `client` | un seul `CREATE_CLIENT` | inchangé |
| `project` | un seul `CREATE_PROJECT` | inchangé |
| `client+project` | `CREATE_CLIENT` puis `CREATE_PROJECT`, même nom | inchangé, seul couple conservé |
| `supplier` | un seul `CREATE_SUPPLIER` | aucun kind |
| `product` | un seul `CREATE_PRODUCT` | `produit` |
| `service` | un seul `CREATE_PRODUCT` | `service` |
| autre combinaison | `clarify`, puis blocage | rien |

Le champ `kind` du JSON, s’il est présent, doit être égal à la valeur du serveur. S’il est absent, le serveur le pose. S’il diffère, `clarify`. Le guide Ollama dit de ne pas envoyer `kind`.

`Ajoute le fournisseur ACME` et `Ajoute le produit Switch X` restent devant, dans `parseCatalogCommand`, appelés par `answerDirectly` avant StructuredPlan. Ils ne deviennent pas des formes `supplier` ou `product`.

`Ajoute ACME comme fournisseur` est `supplier`.

`Ajoute Service Premium` n’a pas de déterminant devant `Service`. La forme est `client`, comme aujourd’hui. Ce n’est pas un service.

## C. Règles supplier

Forme : verbe de création et `comme fournisseur`.

Args autorisés : `name`, `email`, `phone`, `address`. Mêmes limites que le client structuré. `siren` et `notes` restent vides dans le `PartyInput`.

Ancrage : `expressionAnchored` sur le nom, `emailAnchored`, `phoneAnchored`, `addressAnchored`.

Omission : un e-mail, un téléphone ou une adresse reconnus dans la phrase et absents du plan → `omitted`. Un SIREN, un SIRET ou un montant reconnu → `omitted` aussi, parce que le plan ne les porte pas.

Traduction : `create_supplier`. `supplierName` n’existe pas sur cette commande.

## D. Règles product

Forme : verbe de création et `comme produit`.

Args autorisés : `name`, `reference`, `unit`, `description`, `family`.

`kind` forcé à `produit`. `supplierName` vide, pour que `ensureSupplier` ne crée pas de fournisseur. Unité absente : `validateProduct` pose déjà `u`.

`family` seulement par le marqueur de la section F.

Omission : marqueur `famille` présent et famille absente ou différente ; montant, SIREN ou SIRET reconnu. Une référence, une unité ou une description ne sont pas devinées : elles ne sont acceptées que si la valeur du plan est ancrée. Leur absence, sans marqueur dédié déjà parsé, ne bloque pas.

## E. Règles service

Forme fermée :

```text
ajoute | crée | créer | création
+ le | la | un | une
+ service | prestation
+ nom
```

Action : un seul `CREATE_PRODUCT`. `kind` forcé à `service`.

`Ajoute le service Audit réseau` → nom `Audit réseau`.
`Ajoute une prestation Audit réseau` → nom `Audit réseau`, `kind` `service`. Le mot `prestation` ne pose pas `family`.

`Ajoute Service Premium` ne matche pas : pas de déterminant. Forme `client`.

Mêmes args produit, même ancrage, même omission, même `supplierName` vide.

## F. Famille

La famille n’est lue que sur le marqueur explicite :

```text
famille réseau
famille prestation
famille serveur
```

Le mot qui suit `famille`, plié sans accent, doit être exactement une valeur de `PRODUCT_FAMILIES` : `serveur`, `poste`, `portable`, `reseau`, `prestation`, `autre`. Une valeur hors liste, ou plusieurs marqueurs, donne `clarify`.

Un mot de cette liste dans le nom n’est ni une famille ni un champ omis.

| Phrase | Famille |
| --- | --- |
| Ajoute une prestation Audit réseau | aucune. `réseau` reste dans le nom. |
| Ajoute le service Audit réseau | aucune. |
| Ajoute Serveur Dell R750 comme produit | aucune. |
| Ajoute Switch X200 comme produit, famille réseau | `reseau`. |
| Ajoute une prestation Audit réseau, famille prestation | `prestation`, en plus du `kind` `service`. |

Omission : le marqueur est dans la phrase et `family` manque, ou ne reprend pas cette valeur. Pas d’autre détection.

## G. Enrichissement client

`asksToEnrichRecord` rend vrai dès qu’un verbe (`ajoute`) et un sujet (`email`) sont présents. `explicitClientCreation` ne connaît que les créations de client. Donc aujourd’hui :

```text
Ajoute ACME comme fournisseur, email contact@acme.fr
```

est un enrichissement. Si le client ACME existe, `proposeChangeFromMessage` propose de modifier ce client. `answerDirectly` fait cet appel avant StructuredPlan.

Garde-fou à ajouter dans `asksToEnrichRecord` et `enrichmentOwnsTurn` :

```text
structuredShape ∈ { supplier, product, service } → false
```

C’est le helper catalogue équivalent demandé. On n’exclut pas la forme `client` entière : elle contient le verbe `ajoute`, qui est aussi celui de `Ajoute le téléphone de Martin`. Exclure toute forme non nulle fermerait ces enrichissements.

Cas obligatoire. Client ACME déjà en base. Phrase `Ajoute ACME comme fournisseur, email contact@acme.fr`.

- `enrichmentOwnsTurn` faux ;
- aucune proposition de mise à jour du client ;
- forme `supplier` ;
- StructuredPlan `CREATE_SUPPLIER`, e-mail ancré.

`src/domain/client-file.ts` est MUST MODIFY. Le test vit dans `tests/client-file.test.ts`.

## H. Conversation pending

`isIndependentIntent` (`src/domain/conversation-turn.ts`) rend `new_intent` dès que `structuredPlanEligible` est vrai. Aujourd’hui `Ajoute ACME comme fournisseur` n’est pas éligible (`outsideStructuredPlan`), donc ce n’est pas une nouvelle intention : le fil peut la garder contre la fiche client en attente.

Après le lot, la phrase est éligible. `classifyPendingTurn` rend `new_intent`. `revisesPendingDraft` ne s’applique qu’à une correction. La fiche client en attente n’est pas révisée. La route continue jusqu’à StructuredPlan fournisseur.

Test dans `tests/conversation-turn.test.ts` : une proposition client en attente et `Ajoute ACME comme fournisseur` → `new_intent`, pas une correction de brouillon.

## I. Task suspendue

`resumeKind` (`src/domain/task-path.ts`) rend déjà `null` si `NEW_WRITE` voit `ajoute`, et aussi si `structuredPlanEligible` est vrai. Le second verrou n’est pas encore vrai pour `Ajoute le service Audit réseau`, parce que la phrase est aujourd’hui éligible comme client générique via `ajoute`, ce qui la rend déjà éligible. Le changement utile est le classement : la phrase doit être `service`, pas `client`.

Attendu : `structuredShape` = `service`, `resumeKind` = `null`, `resumeSuspendedTask` = `null`. Le parcours suspendu ne reprend pas. La phrase part en StructuredPlan.

Test dans `tests/task-path.test.ts`.

## J. Ancrage / nom

Helpers repris : `expressionAnchored`, `emailAnchored`, `phoneAnchored`, `addressAnchored`, `plainLabel`.

Règle ajoutée, sur le nom de chaque forme : le nom ne contient pas le mot `comme`, et ne commence ni ne finit par le mot de rôle de la forme (`fournisseur`, `produit`, `service`, `prestation`, et `client` pour la forme client).

| Plan | Résultat |
| --- | --- |
| `name = ACME` pour `comme fournisseur` | accepté |
| `name = ACME comme fournisseur` | refusé |
| `name = ACME France` si `France` est absent | refusé par `expressionAnchored` |
| `name = Audit réseau` après `le service` | accepté |
| `name = service Audit réseau` | refusé |
| `name = Switch X200 Pro` si `Pro` est absent | refusé |

Limite connue, inchangée : `expressionAnchored` exige trois caractères utiles. `Ajoute HP comme fournisseur` et `Ajoute 3M comme fournisseur` sont refusés par StructuredPlan. `Ajoute le fournisseur HP` reste la voie déterministe.

L’adresse coupée au mot `à` dans une rue reste la limite déjà connue. Ce lot ne la corrige pas.

## K. Existing entities

`already` porte le type :

```text
{ kind: "already", entity: "client" | "supplier" | "product", name }
```

Lecture dans `answerFromStructuredPlan`, par `nameKey` :

- client ou projet : `prisma.client`, comme aujourd’hui ;
- fournisseur : `prisma.supplier` ;
- produit ou service : `prisma.product`.

`CREATE` et fiche de même nom : réponse `already`, aucune `CatalogProposal`, aucune mise à jour. Messages distincts : le client, le fournisseur, ou le produit existe déjà. Un service existant est un produit de `kind` `service` ; la phrase dit « le produit ».

Fournisseur existant dont l’e-mail, le téléphone ou l’adresse du plan diffère : `contact-differs`, même champs que le client, `withProject` faux. Rien n’est écrit. Pas d’`update_supplier`.

La voie déterministe `Ajoute le fournisseur ACME` n’est pas réécrite. Si ACME existe, elle ouvre encore une proposition ; la confirmation répond que le fournisseur existe déjà et ne crée pas une deuxième fiche.

## L. Carte

MUST. `commandFields` dans `src/domain/catalog.ts` affiche, pour `create_product` et `update_product`, les valeurs présentes :

- kind `produit` → libellé Produit ;
- kind `service` → libellé Service ;
- `family` non vide → libellé de `familyLabel`.

L’utilisateur voit qu’il confirme un produit ou un service, et la famille seulement si le marqueur `famille` l’a posée.

`openCatalogProposal` et `createProduct` ne changent pas. Le `kind` et la `family` sont déjà des champs de `ProductInput`.

## M. Tests

`tests/structured-plan.test.ts`

- `comme fournisseur` → `supplier`, un `CREATE_SUPPLIER`, nom `ACME` ;
- e-mail et adresse ancrés acceptés ; `ACME France`, e-mail inventé, `ACME comme fournisseur` refusés ;
- e-mail présent et absent du plan → `omitted` ;
- `CREATE_CLIENT` sur une forme `supplier` → `clarify` ;
- `comme produit` → `CREATE_PRODUCT`, kind serveur `produit` ;
- `famille réseau` → `reseau` ; `famille serveurs` → refus ;
- `Serveur Dell R750 comme produit` sans marqueur → pas de famille, pas d’omission ;
- kind modèle `service` sur une forme `product` → `clarify` ;
- montant ou `costStated` inventé → refus ; `150 €` dans la phrase → `omitted` ;
- fournisseur ou produit de même `nameKey` → `already` du bon type ;
- fournisseur existant, e-mail différent → `contact-differs`, pas d’update ;
- `ajoute|crée + déterminant + service|prestation + nom` → kind `service`, nom sans le rôle ;
- `Audit réseau` ne pose pas la famille `reseau` ;
- `Ajoute Service Premium` → forme `client` ;
- `ajouter un fournisseur Quincaillerie Durand` reste `parseCatalogCommand`, forme StructuredPlan `null`.

`tests/client-file.test.ts`

- client ACME existant, `Ajoute ACME comme fournisseur, email contact@acme.fr` → `asksToEnrichRecord` et `enrichmentOwnsTurn` faux.

`tests/conversation-turn.test.ts`

- fiche client en attente, `Ajoute ACME comme fournisseur` → `new_intent`.

`tests/task-path.test.ts`

- parcours suspendu, `Ajoute le service Audit réseau` → `resumeKind` null, forme `service`.

`tests/catalog-command.test.ts`

- `Ajoute le fournisseur ACME` et `Ajoute le produit Switch X` restent des commandes déterministes.

## N. Recette future

1. `Ajoute ACME comme fournisseur` — StructuredPlan, une `CatalogProposal` fournisseur, nom `ACME`.
2. `Ajoute ACME comme fournisseur, email contact@acme.fr` — même proposition, e-mail affiché. Pas de fiche client.
3. Client ACME déjà en base, même phrase que 2 — aucune mise à jour du client. Proposition fournisseur. Si le fournisseur ACME existe aussi, avec un autre e-mail : `contact-differs`, aucune proposition.
4. `Ajoute Switch X200 comme produit` — `CREATE_PRODUCT`, kind produit, pas de famille.
5. `Ajoute Switch X200 comme produit, famille réseau` — famille `reseau` visible sur la carte.
6. `Ajoute le service Audit réseau` — kind service, nom `Audit réseau`, famille vide, carte « Service ».
7. `Ajoute une prestation Audit réseau` — kind service, famille vide. `réseau` reste dans le nom.
8. `Ajoute Service Premium` — création client possible, pas un service.
9. `Ajoute une prestation Audit réseau à 150 €` — refus, montant non porté. Aucune proposition.
10. `Ajoute ACME comme fournisseur` alors que le fournisseur ACME existe, sans contact nouveau — « le fournisseur existe déjà », aucune proposition. `Ajoute Switch X200 comme produit` alors que le produit existe — « le produit existe déjà ». La forme déterministe `Ajoute le fournisseur ACME`, elle, ouvre encore sa proposition actuelle.

Hors recette StructuredPlan, à ne pas attendre comme un succès de plan : `Le fournisseur s’appelle ACME, son téléphone est 06 12 34 56 78`. Pas de verbe de création. `understandIntent` y voit un changement. Refus de plan.

L’ancrage `Switch X200 Pro` se prouve en test unitaire sur `Ajoute Switch X200 comme produit`, pas par la phrase déterministe `Ajoute le produit Switch X200`.

## O. Fichiers

MUST MODIFY

- `src/domain/structured-plan.ts`
- `src/app/api/assistant/route.ts`
- `src/domain/client-file.ts`
- `src/domain/catalog.ts`
- `tests/structured-plan.test.ts`
- `tests/client-file.test.ts`
- `docs/manuel-utilisateur.md`

MAY MODIFY

- `src/domain/conversation-turn.ts`
- `tests/conversation-turn.test.ts`
- `src/domain/task-path.ts`
- `tests/task-path.test.ts`
- `tests/catalog-command.test.ts`
- `docs/technique/docs/orchestration.md`

`conversation-turn.ts` et `task-path.ts` peuvent ne pas changer de code si `structuredPlanEligible` suffit. Les tests de non-régression, eux, sont obligatoires.

NO CHANGE

- `prisma/schema.prisma`
- `prisma/migrations`
- `src/lib/catalog-store.ts`
- `src/lib/catalog-proposals.ts`
- `src/domain/pricing.ts`
- `src/lib/business-records.ts`

## P. Périmètre final

IN

- `CREATE_SUPPLIER`
- `CREATE_PRODUCT`
- service par `CREATE_PRODUCT` et `kind` `service` imposé par `structuredShape`
- nom
- fournisseur : e-mail, téléphone, adresse
- produit : référence, unité, description, famille explicite `famille <valeur>`
- `already` typé avant proposition
- `contact-differs` fournisseur, sans mise à jour
- une seule action fournisseur ou produit
- carte kind et family
- garde-fou d’enrichissement sur les formes `supplier`, `product`, `service`
- parseurs déterministes devant StructuredPlan

OUT

- `CREATE_SERVICE`
- `UPDATE_SUPPLIER`, `UPDATE_PRODUCT`
- prix, coût, TVA
- `supplierName`
- fournisseur et produit dans le même plan
- référence entre actions
- SIREN porté par le plan
- création cachée de fournisseur
- famille déduite d’un mot du nom
- migration Prisma
- correction de l’adresse coupée au mot `à`
- noms de moins de trois caractères utiles par StructuredPlan

## Verdict

GO IMPLEMENTATION LOT-V3-007
