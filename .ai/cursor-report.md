# LOT-V3-007 — Spécification consolidée

Conception seulement. Aucun fichier source. Aucune migration. Aucun commit.

Baseline fonctionnelle : `BASELINE-8 — 4794328 — LOT-V3-006 validé` (`479432872e5148efbb475df2ff1ff57d9042a866`).

Ce document est la spécification complète du lot. Il reprend la conception déjà revue et le complément de revalidation Claude. L’implémentation s’y conforme seule.

Le modèle ne choisit pas le kind. Il n’écrit rien. Le serveur reconnaît la forme, valide le plan, ouvre une `CatalogProposal`, et n’écrit qu’après confirmation.

## A. structuredShape

Nouvelle fonction déterministe dans `src/domain/structured-plan.ts`.

```text
structuredShape(text) →
  client | project | client+project | supplier | product | service | null
```

Premier motif gagnant, dans cet ordre.

1. Mots bloquants, pour toutes les formes. Après pli sans accent, la présence d’un de ces mots rend `null` :

   `contrat`, `intervention`, `équipement`, `réclamation`, `retour`, `catalogue`, `article`.

   Exemples bloqués, donc inéligibles :

   - `Ajoute ACME comme fournisseur pour le contrat Dupont`
   - `Ajoute Switch X200 comme produit pour le contrat Dupont`

2. Rôle explicite, avant la forme service. Un verbe de création (`ajoute`, `crée`, `créer`, `création`, `ouvre`) et un tour exact :

   - `comme fournisseur` ou `comme fournisseurs` → `supplier`
   - `comme produit` ou `comme produits` → `product`
   - `comme client`, `comme clients` ou `comme cliente` → `client`

   Ce rôle l’emporte sur le motif service.

   - `Ajoute le Service Plus comme client` → `client`
   - `Ajoute la prestation X comme produit` → `product`
   - `Ajoute le Service Plus comme fournisseur` → `supplier`

3. Forme service, seulement si l’étape 2 n’a pas rendu de rôle. Début de création `ajoute|crée|créer|création`, puis un déterminant `le|la|un|une`, puis le mot `service` ou `prestation`, puis un nom.

4. `client+project` : la forme de dossier actuelle (`PROJECT_CREATE`) et, dans la même phrase, une création de client déjà reconnue.

5. `project` : `PROJECT_CREATE` seul.

6. `client` : la création client actuelle (`CLIENT_CREATE`). Les mots `fournisseur` et `produit` restent bloquants ici. `Ajoute le fournisseur ACME` et `Ajoute le produit Switch X` rendent donc `null`.

7. `null`.

`structuredPlanEligible` :

```text
phrase non vide
et pas une question, une négation, ni un verbe de modification ou de suppression
et structuredShape ≠ null
```

Les questions, négations et verbes de modification restent les refus actuels (`QUESTION`, `NEGATION`, `OPPOSITE`).

`translateStructuredPlan` commence par `structuredShape`. Une forme `null`, ou un `ActionType` hors matrice, donne `clarify`. La route transforme un plan éligible non accepté en blocage. Aucune autre création n’est ouverte.

`anchored`, `planNamesAreLabels`, `findOmittedStructuredFields` et `resolutionName` ont une branche explicite par type. Un plan qui n’est pas `CREATE_CLIENT` n’est plus lu comme un `CREATE_PROJECT`.

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

Le champ `kind` du JSON, s’il est présent, doit être égal à la valeur du serveur. S’il est absent, le serveur le pose. S’il diffère, `clarify`. Le guide Ollama demande de ne pas envoyer `kind`.

`parseCatalogCommand` reste dans `answerDirectly`, avant `decideFree` et StructuredPlan.

- `Ajoute le fournisseur ACME` reste `create_supplier` déterministe.
- `Ajoute le produit Switch X` reste `create_product` déterministe.
- `Ajoute ACME comme fournisseur` passe par StructuredPlan, forme `supplier`.

## C. Règles supplier

Forme : verbe de création et `comme fournisseur`.

Args autorisés : `name`, `email`, `phone`, `address`. Mêmes limites que le client structuré. `siren` et `notes` restent vides dans le `PartyInput`.

Ancrage : `expressionAnchored` sur le nom, `emailAnchored`, `phoneAnchored`, `addressAnchored`. Le téléphone est cherché après retrait des séquences SIREN et SIRET (section M).

Omission : e-mail, téléphone ou adresse reconnus dans la phrase et absents du plan. SIREN, SIRET ou montant reconnu : `omitted`, ces champs restent hors plan.

Traduction : `create_supplier`. `supplierName` n’existe pas sur cette commande.

## D. Règles product

Forme : verbe de création et `comme produit`.

Args autorisés : `name`, `reference`, `unit`, `description`, `family`.

`kind` forcé à `produit`. `supplierName` vide, pour que `ensureSupplier` ne crée pas de fournisseur. Unité absente : `validateProduct` pose déjà `u`.

Le nom reste soumis à `expressionAnchored`.

`reference` et `unit` ne suivent pas la règle des trois caractères utiles. Ils sont ancrés par égalité exacte du segment dans le message, après pli de casse et d’accents, entre bords de mot :

- `référence 123456` ancre `reference = 123456` ;
- `unité u` ancre `unit = u` ;
- `unité m2` ancre `unit = m2`.

Une référence ou une unité absente du message et présente dans le plan est refusée. Leur absence du plan, sans valeur écrite, ne bloque pas.

`description` reste ancrée par `expressionAnchored` lorsqu’elle est présente.

`family` seulement par le marqueur de la section F.

## E. Règles service

Forme fermée, après les rôles explicites de la section A :

```text
ajoute | crée | créer | création
+ le | la | un | une
+ service | prestation
+ nom
```

Action : un seul `CREATE_PRODUCT`. `kind` forcé à `service`.

- `Ajoute le service Audit réseau` → nom `Audit réseau`.
- `Ajoute une prestation Audit réseau` → nom `Audit réseau`, `kind` `service`. Le mot `prestation` ne pose pas `family`.
- `Ajoute le Service Premium` → forme `service`, nom `Service Premium`.
- `Ajoute Service Premium` → forme `client`. Pas de déterminant devant `Service`.

Cette distinction est écrite dans les tests et dans `docs/manuel-utilisateur.md`.

Mêmes args produit, même ancrage, même omission, même `supplierName` vide.

Un rôle `comme client`, `comme fournisseur` ou `comme produit` dans la même phrase empêche la forme `service` (section A, étape 2).

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

Omission : le marqueur est dans la phrase et `family` manque, ou ne reprend pas cette valeur.

## G. Enrichissement client

`asksToEnrichRecord` rend vrai dès qu’un verbe (`ajoute`) et un sujet (`email`) sont présents. `explicitClientCreation` ne connaît que les créations de client. Aujourd’hui, `Ajoute ACME comme fournisseur, email contact@acme.fr` est donc un enrichissement, et `answerDirectly` l’appelle avant StructuredPlan.

Garde-fou dans `asksToEnrichRecord` et `enrichmentOwnsTurn` :

```text
structuredShape ∈ { supplier, product, service } → false
```

La forme `client` entière n’est pas exclue. Elle contient le verbe `ajoute`, qui est aussi celui de `Ajoute le téléphone de Martin`.

Cas obligatoire. Client ACME déjà en base. Phrase `Ajoute ACME comme fournisseur, email contact@acme.fr`.

- `enrichmentOwnsTurn` faux ;
- aucune proposition de mise à jour du client ;
- forme `supplier` ;
- StructuredPlan `CREATE_SUPPLIER`, e-mail ancré.

`src/domain/client-file.ts` est MUST MODIFY. Le test vit dans `tests/client-file.test.ts`.

## H. Fiche client en attente

`classifyPendingTurn` teste aujourd’hui `isDraftCorrection` avant `isIndependentIntent`. Une phrase fournisseur qui porte un marqueur de champ est donc une correction, même si elle est éligible.

Résultats actuels, à changer :

| Phrase | Tour actuel |
| --- | --- |
| Ajoute ACME comme fournisseur, son email est contact@acme.fr | `correction` |
| Ajoute ACME comme fournisseur, email : contact@acme.fr | `correction` |
| son email est nouveau@dupont.fr | `correction` |

Règle obligatoire, dans `classifyPendingTurn`, après les confirmations et les rejets exacts, et avant `isDraftCorrection` :

```text
structuredShape ∈ { supplier, product, service } → new_intent
```

Les motifs `CONFIRM` et `REJECT`, phrases entières, restent devant. Une confirmation de la carte affichée ne devient pas une nouvelle intention.

Cas obligatoires. Une `ClientProposal` est en attente.

`Ajoute ACME comme fournisseur, son email est contact@acme.fr`

et

`Ajoute ACME comme fournisseur, email : contact@acme.fr`

Attendu :

- `new_intent` ;
- jamais `correction` ;
- `revisesPendingDraft` faux ;
- aucune modification de la `ClientProposal` en attente ;
- passage vers StructuredPlan fournisseur.

Une vraie correction seule, `son email est nouveau@dupont.fr`, reste `correction`. Sa forme est `null`.

`src/domain/conversation-turn.ts` est MUST MODIFY. `tests/conversation-turn.test.ts` est obligatoire.

`Ajoute ACME comme fournisseur` sans champ reste aussi `new_intent`, par l’éligibilité déjà lue dans `isIndependentIntent`.

## I. Task suspendue

`resumeKind` (`src/domain/task-path.ts`) rend `null` si `NEW_WRITE` voit `ajoute`, et aussi si `structuredPlanEligible` est vrai.

`Ajoute le service Audit réseau` doit être de forme `service`. `resumeKind` et `resumeSuspendedTask` rendent `null`. Le parcours suspendu ne reprend pas. La phrase part en StructuredPlan.

Test obligatoire dans `tests/task-path.test.ts`. Le fichier de domaine peut rester inchangé si l’éligibilité suffit.

## J. Ancrage / nom

Helpers repris : `expressionAnchored`, `emailAnchored`, `phoneAnchored`, `addressAnchored`, `plainLabel`.

Le nom de chaque forme ne contient pas le mot `comme`, et ne commence ni ne finit par le mot de rôle de la forme (`fournisseur`, `produit`, `service`, `prestation`, et `client` pour la forme client).

| Plan | Résultat |
| --- | --- |
| `name = ACME` pour `comme fournisseur` | accepté |
| `name = ACME comme fournisseur` | refusé |
| `name = ACME France` si `France` est absent | refusé par `expressionAnchored` |
| `name = Audit réseau` après `le service` | accepté |
| `name = service Audit réseau` | refusé |
| `name = Switch X200 Pro` si `Pro` est absent | refusé |
| `name = Service Premium` après `le Service` | accepté, forme `service` |

Limite connue : `expressionAnchored` exige trois caractères utiles et une lettre. `Ajoute HP comme fournisseur` et `Ajoute 3M comme fournisseur` sont refusés par StructuredPlan. `Ajoute le fournisseur HP` reste la voie déterministe. Cette limite ne s’applique pas à `reference` ni à `unit` (section D).

L’adresse coupée au mot `à` dans une rue reste la limite déjà connue. Ce lot ne la corrige pas.

## K. Existing entities

`already` porte le type :

```text
{ kind: "already", entity: "client" | "supplier" | "product", name }
```

Lecture dans `answerFromStructuredPlan`, par `nameKey` :

- client ou projet : `prisma.client` ;
- fournisseur : `prisma.supplier` ;
- produit ou service : `prisma.product`.

`CREATE` et fiche de même nom : réponse `already`, aucune `CatalogProposal`, aucune mise à jour.

Messages distincts : le client existe déjà, le fournisseur existe déjà, le produit existe déjà. Un service existant est un produit de `kind` `service` ; la phrase dit « le produit ».

Fournisseur existant dont l’e-mail, le téléphone ou l’adresse du plan diffère : `contact-differs`, mêmes champs que le client, `withProject` faux. Rien n’est écrit. Pas d’`update_supplier`.

La voie déterministe `Ajoute le fournisseur ACME` n’est pas réécrite. Si ACME existe, elle ouvre encore une proposition. La confirmation répond que le fournisseur existe déjà et ne crée pas une deuxième fiche.

## L. Carte

MUST. `commandFields` dans `src/domain/catalog.ts` affiche, pour `create_product` et `update_product`, les valeurs présentes :

- kind `produit` → libellé Produit ;
- kind `service` → libellé Service ;
- `family` non vide → libellé de `familyLabel`.

L’utilisateur voit qu’il confirme un produit ou un service, et la famille seulement si le marqueur `famille` l’a posée.

`openCatalogProposal` et `createProduct` ne changent pas. `kind` et `family` sont déjà des champs de `ProductInput`.

## M. Détecteurs d’omission

Montant. Un nombre accompagné de l’un de ces signes, avant ou après, avec ou sans espace :

`€`, `EUR`, `euro`, `euros`, `$`, `USD`.

Exemples reconnus : `150 €`, `150€`, `150 EUR`, `150 euros`, `$150`, `150 USD`.

Présence dans une phrase éligible fournisseur, produit ou service → `omitted`. Le plan ne porte ni `costStated`, ni `currency`, ni prix, ni TVA.

SIREN / SIRET. L’un de ces cas suffit :

- le mot `siren` ou `siret` ;
- une séquence d’exactement 9 chiffres ;
- une séquence d’exactement 14 chiffres.

Les chiffres d’une séquence peuvent être groupés par espaces ou par points, pourvu que le total soit exactement 9 ou exactement 14, et que la séquence ne soit pas un tronçon d’une suite plus longue. Un téléphone français de 10 chiffres (`06 12 34 56 78`) n’est ni un SIREN ni un SIRET.

Présence → `omitted`. Le plan ne porte pas le SIREN.

Téléphone. `phoneCandidates` ignore les séquences déjà classées SIREN ou SIRET. Une suite de 14 chiffres est un SIRET omis. Elle n’est pas un téléphone omis.

## N. Contrat JSON

Clés de plan inchangées : `source`, `actions`, `missing`, `confidence`, `explanation`. Clés d’action : `type`, `args`. Clés en trop : refus.

`CREATE_SUPPLIER.args` : `name`, et `email`, `phone`, `address` seulement s’ils sont écrits.

`CREATE_PRODUCT.args` : `name`, et `reference`, `unit`, `description`, `family` seulement s’ils sont écrits. `kind` est posé par le serveur.

Interdits dans le plan, en plus des identifiants déjà interdits (`id`, `clientId`, `supplierId`, `projectId`, `productId`, `conversationId`, `inboxItemId`, `fileId`, `fileIds`, `quoteId`, `demandId`, `storedFileId`, `proposalId`) :

`costStated`, `statedPrice`, `currency`, `vatNote`, `sourceUrl`, `supplierName`, `siren`, `siret`.

`structuredPlanGuide` annonce `CREATE_SUPPLIER` et `CREATE_PRODUCT` en plus des types client et projet. Il dit de ne pas envoyer `kind`, de ne pas inventer de contact, de famille, de montant ni d’identifiant, et de ne copier que ce qui est écrit.

`ACTION_MAX` reste 2 pour le seul couple client puis projet. Fournisseur, produit et service : exactement une action.

## O. Tests

`tests/structured-plan.test.ts`

- `comme fournisseur` → `supplier`, un `CREATE_SUPPLIER`, nom `ACME` ;
- e-mail et adresse ancrés acceptés ; `ACME France`, e-mail inventé, `ACME comme fournisseur` refusés ;
- e-mail présent et absent du plan → `omitted` ;
- `CREATE_CLIENT` sur une forme `supplier` → `clarify` ;
- `comme produit` → `CREATE_PRODUCT`, kind serveur `produit` ;
- `référence 123456`, `unité u`, `unité m2` ancrés sans la règle des trois caractères ;
- `famille réseau` → `reseau` ; `famille serveurs` → refus ;
- `Serveur Dell R750 comme produit` sans marqueur → pas de famille, pas d’omission ;
- kind modèle `service` sur une forme `product` → `clarify` ;
- `150 €`, `150 EUR`, `150 euros`, `$150` → `omitted` ; `costStated` dans le JSON → refus ;
- mot `siret`, 9 chiffres, 14 chiffres → `omitted` ; ces chiffres ne sont pas un téléphone ;
- `06 12 34 56 78` reste un téléphone ;
- fournisseur ou produit de même `nameKey` → `already` du bon type ;
- fournisseur existant, e-mail différent → `contact-differs`, pas d’update ;
- `ajoute|crée + déterminant + service|prestation + nom` → kind `service`, nom sans le rôle ;
- `Audit réseau` ne pose pas la famille `reseau` ;
- `Ajoute Service Premium` → `client` ;
- `Ajoute le Service Premium` → `service` ;
- `Ajoute le Service Plus comme client` → `client` ;
- `Ajoute la prestation X comme produit` → `product`, kind `produit` ;
- `Ajoute ACME comme fournisseur pour le contrat Dupont` → `null` ;
- `Ajoute Switch X200 comme produit pour le contrat Dupont` → `null` ;
- `ajouter un fournisseur Quincaillerie Durand` reste `parseCatalogCommand`, forme StructuredPlan `null`.

`tests/client-file.test.ts`

- client ACME existant, `Ajoute ACME comme fournisseur, email contact@acme.fr` → `asksToEnrichRecord` et `enrichmentOwnsTurn` faux.

`tests/conversation-turn.test.ts`

- fiche en attente, `Ajoute ACME comme fournisseur` → `new_intent` ;
- fiche en attente, `Ajoute ACME comme fournisseur, son email est contact@acme.fr` → `new_intent` ;
- fiche en attente, `Ajoute ACME comme fournisseur, email : contact@acme.fr` → `new_intent` ;
- `son email est nouveau@dupont.fr` → `correction`.

`tests/task-path.test.ts`

- parcours suspendu, `Ajoute le service Audit réseau` → `resumeKind` null, forme `service`.

`tests/catalog-command.test.ts`

- `Ajoute le fournisseur ACME` et `Ajoute le produit Switch X` restent des commandes déterministes.

## P. Recette future

1. `Ajoute ACME comme fournisseur` — StructuredPlan, une `CatalogProposal` fournisseur, nom `ACME`.
2. `Ajoute ACME comme fournisseur, email contact@acme.fr` — même proposition, e-mail affiché. Pas de fiche client.
3. Client ACME déjà en base, même phrase que 2 — aucune mise à jour du client. Proposition fournisseur. Si le fournisseur ACME existe aussi, avec un autre e-mail : `contact-differs`, aucune proposition.
4. `Ajoute Switch X200 comme produit` — `CREATE_PRODUCT`, kind produit, pas de famille.
5. `Ajoute Switch X200 comme produit, famille réseau` — famille `reseau` visible sur la carte.
6. `Ajoute le service Audit réseau` — kind service, nom `Audit réseau`, famille vide, carte « Service ».
7. `Ajoute une prestation Audit réseau` — kind service, famille vide. `réseau` reste dans le nom.
8. `Ajoute Service Premium` — forme client. `Ajoute le Service Premium` — forme service.
9. `Ajoute une prestation Audit réseau à 150 €` — refus, montant non porté. Aucune proposition.
10. `Ajoute ACME comme fournisseur` alors que le fournisseur ACME existe, sans contact nouveau — « le fournisseur existe déjà », aucune proposition. `Ajoute Switch X200 comme produit` alors que le produit existe — « le produit existe déjà ».

En plus, avec une fiche client en attente : `Ajoute ACME comme fournisseur, son email est contact@acme.fr` ouvre un fournisseur et laisse la fiche client inchangée.

Hors plan : `Le fournisseur s’appelle ACME, son téléphone est 06 12 34 56 78`. Pas de verbe de création.

L’ancrage `Switch X200 Pro` se prouve en test unitaire sur `Ajoute Switch X200 comme produit`.

## Q. Fichiers

MUST MODIFY

- `src/domain/structured-plan.ts`
- `src/app/api/assistant/route.ts`
- `src/domain/client-file.ts`
- `src/domain/conversation-turn.ts`
- `src/domain/catalog.ts`
- `tests/structured-plan.test.ts`
- `tests/client-file.test.ts`
- `tests/conversation-turn.test.ts`
- `docs/manuel-utilisateur.md`

MAY MODIFY

- `src/domain/task-path.ts`
- `tests/task-path.test.ts`
- `tests/catalog-command.test.ts`
- `docs/technique/docs/orchestration.md`

Les tests de `task-path` et de `catalog-command` sont obligatoires. Le code de `task-path.ts` ne change que si l’éligibilité ne suffit pas.

NO CHANGE

- `prisma/schema.prisma`
- `prisma/migrations`
- `src/lib/catalog-store.ts`
- `src/lib/catalog-proposals.ts`
- `src/domain/pricing.ts`
- `src/lib/business-records.ts`

## R. Périmètre final

IN

- `CREATE_SUPPLIER`
- `CREATE_PRODUCT`
- service par `CREATE_PRODUCT` et `kind` `service` imposé par `structuredShape`
- rôle explicite `comme client|fournisseur|produit` prioritaire sur la forme service
- nom
- fournisseur : e-mail, téléphone, adresse
- produit : référence, unité, description, famille explicite `famille <valeur>`
- ancrage de `reference` et `unit` par égalité de segment
- `already` typé avant proposition
- `contact-differs` fournisseur, sans mise à jour
- une seule action fournisseur ou produit
- carte kind et family
- garde-fou d’enrichissement sur les formes `supplier`, `product`, `service`
- forme catalogue classée `new_intent` avant la correction de fiche
- mots bloquants hors périmètre pour toutes les formes
- détecteurs de montant et de SIREN/SIRET, séparés du téléphone
- parseurs déterministes devant StructuredPlan
- manuel : `Ajoute Service Premium` est un client, `Ajoute le Service Premium` est un service

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
