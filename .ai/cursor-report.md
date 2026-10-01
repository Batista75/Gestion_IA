# Audit LOT-V3-007 — StructuredPlan fournisseur / produit / service

Lecture seule. Aucun fichier source, aucune migration, aucun commit.

## A. Baseline

Baseline fonctionnelle : `BASELINE-8 — 4794328 — LOT-V3-006 validé`.

SHA : `479432872e5148efbb475df2ff1ff57d9042a866`.

HEAD technique : `b2b0c48` — `chore: prépare l'audit LOT-V3-007`. Commit `.ai/` seulement. La baseline fonctionnelle reste `4794328`.

Arbre de travail propre avant ce rapport.

## B. StructuredPlan actuel

Contrat dans `src/domain/structured-plan.ts`.

```text
StructuredPlan
  source: "ollama"
  actions: 1 ou 2
  missing: au plus 4 textes, 120 caractères
  confidence?: au plus 8, champs name | clientName | email | phone | address, valeur 0 à 1
  explanation?: au plus 300 caractères
```

Actions autorisées, et elles seules :

```text
CREATE_CLIENT
  args: name (2 à 120)
        email? (120, forme e-mail)
        phone? (40)
        address? (200)

CREATE_PROJECT
  args: name (2 à 120)
        clientName (2 à 120)
```

Clés de plan : `source`, `actions`, `missing`, `confidence`, `explanation`.
Clés d’action : `type`, `args`.
Toute autre clé d’argument est refusée.
Clés interdites partout : `id`, `clientId`, `supplierId`, `projectId`, `productId`, `conversationId`, `inboxItemId`, `fileId`, `fileIds`, `quoteId`, `demandId`, `storedFileId`, `proposalId`.

JSON brut : 4 000 caractères maximum. `parseStructuredPlan` exige un objet JSON, puis l’ancrage dans le message.

`plainLabel` (`src/domain/catalog.ts`) : 2 à 120 caractères, au moins une lettre, sans `.!?,:;`, sans mot de proposition en minuscules (`qui`, `que`, `dont`, `pour`, `avec`, `son`, `sa`, `ses`, `leur`, `habite`, `telephone`, `email`, `e-mail`).

Éligibilité actuelle, `structuredPlanEligible` :

- refuse question, négation, et verbes de modification ou de suppression ;
- refuse `outsideStructuredPlan` : le mot fournisseur, produit, article, contrat, intervention, équipement, réclamation, retour ou catalogue ;
- accepte une création client (`crée`, `ajoute`, `nouveau client`) ou une création de dossier (`ouvre` / `crée` un dossier, projet ou affaire, avec `pour`, `chez` ou `client`).

Le guide Ollama, `structuredPlanGuide`, n’autorise que `CREATE_CLIENT` et `CREATE_PROJECT`. Il interdit d’inventer un mail, un téléphone, une adresse, un montant, une TVA ou un identifiant.

## C. Référence CREATE_CLIENT / CREATE_PROJECT

Chaîne réelle :

```text
message
→ answerDirectly (src/app/api/assistant/route.ts)
→ si rien n’a répondu : decideFree puis structuredPlanGate
→ readStructuredPlan (src/lib/structured-plan-read.ts) envoie structuredPlanGuide à Ollama
→ parseStructuredPlan
→ ancrage : expressionAnchored, emailAnchored, phoneAnchored, addressAnchored
→ resolutionName puis lecture Client par nameKey
→ translateStructuredPlan
→ openCatalogProposal ou openBusinessPlanProposal
→ CatalogProposal ou BusinessPlanProposal
→ confirmation humaine
→ applyCatalogCommand / applyBusinessPlan
```

Fonctions à réutiliser telles quelles : `parseStructuredPlan`, `valueAnchored`, `expressionAnchored`, `detectStructuredContactHints`, `findOmittedStructuredFields`, `plainLabel`, `nameKey`, `openCatalogProposal`, `presentCommand`.

Traductions actuelles :

| Plan | Issue |
| --- | --- |
| `CREATE_CLIENT` seul, client inconnu | `create_client` |
| `CREATE_CLIENT` seul, même nom et mêmes contacts | `already`, aucune proposition |
| `CREATE_CLIENT` seul, contact différent | `contact-differs`, aucune mise à jour |
| e-mail, téléphone ou adresse présents dans le message et absents du plan | `omitted`, refus |
| `CREATE_PROJECT` seul, client connu, rôles ancrés | `create_project`, prochaine action fixe « Qualifier le besoin » |
| `CREATE_PROJECT` seul, client inconnu | `unknown-client`, aucun dossier |
| `CREATE_CLIENT` puis `CREATE_PROJECT`, même nom, client déjà là | `create_project` seulement |
| `CREATE_CLIENT` puis `CREATE_PROJECT`, client absent, sans téléphone ni adresse | `BusinessPlan` (client + projet) |
| tout autre couple | `clarify` |

`CREATE_CLIENT` force `siren` et `notes` à vide. Le modèle ne les porte pas.

## D. Fournisseur

Il existe un modèle `Supplier`. `Organization` relie un client et un fournisseur du même `nameKey`. `createParty("supplier", …)` dans `src/lib/catalog-store.ts` crée la fiche, le contact principal, l’adresse principale et l’organisation.

`CatalogCommand` : `create_supplier` et `update_supplier`, payload `PartyInput` (`name`, `siren`, `email`, `phone`, `address`, `notes`).

Le parseur déterministe `parseCatalogCommand` couvre déjà la forme stricte `ajoute|crée|ouvre` + `fournisseur` + nom, avec des champs étiquetés après virgule (`email`, `téléphone`, `adresse`, `siren`, `siret`, `notes`).

### Champs obligatoires minimum

`name`, 2 à 120 caractères, `plainLabel`, ancré dans le message.

### Champs facultatifs

Pour ce lot, les mêmes que le client structuré : `email`, `phone`, `address`, seulement s’ils sont écrits.

`siren` / `siret`, `notes`, le nom de contact séparé, l’encours et le délai existent sur la fiche ou sur `SupplierTermsProposal`. Ils restent hors du plan V1.

### Contraintes d’unicité

`Supplier.nameKey` est unique. `nameKey` met en minuscules, retire les accents et ramène les espaces. Un second fournisseur du même nom n’est pas créé : `createParty` répond que le fournisseur existe déjà, avec `ok: true`, sans deuxième ligne.

Le même nom qu’un client partage l’`Organization`. La fiche fournisseur reste distincte.

### Normalisations

`validateParty` : nom trimé, e-mail contrôlé, téléphone coupé à 30 caractères, adresse coupée à 300, SIREN 9 chiffres ou SIRET 14. L’adresse structurée s’arrête au premier mot « à » dans la rue : limite déjà connue, conservée.

### Règles existantes

La confirmation passe par `CatalogProposal`, puis `applyCatalogCommand` → `createParty`. Le modèle n’écrit pas.

### Risques de duplication

La voie déterministe ouvre la proposition même si le nom existe. Le doublon n’est vu qu’à la confirmation, et la proposition devient `confirmee` alors qu’aucune fiche nouvelle n’est écrite. La voie StructuredPlan client, elle, refuse avant la proposition (`already`). Le fournisseur structuré doit suivre ce refus préalable, sur `Supplier.nameKey`. Aucune bascule silencieuse vers `update_supplier`.

## E. Produit

Modèle `Product`. `nameKey` unique. `kind` vaut `produit` ou `service`. `family` est une liste fermée : `serveur`, `poste`, `portable`, `reseau`, `prestation`, `autre` (`readProductFamily`).

`CatalogCommand` : `create_product` et `update_product`, payload `ProductInput`.

### Champs obligatoires minimum

`name`, 2 à 120, `plainLabel`, ancré. L’unité vide devient `u` dans `validateProduct`. Le plan peut omettre l’unité.

### Champs facultatifs

`reference` (60), `unit` (20), `description` (1 000), `family` si le mot du message est dans la liste fermée, `kind` à `service` seulement si le message dit service ou prestation.

`supplierName` existe. Le laisser vide en V1 : `ensureSupplier` crée le fournisseur manquant pendant l’écriture du produit.

### Contraintes d’unicité

`Product.nameKey`. `createProduct` répond que le produit est déjà au catalogue, `ok: true`, sans deuxième ligne. Même recommandation que le fournisseur : refus `already` avant la proposition. `saveArticle` rapproche aussi par référence ; le plan V1 ne doit pas transformer une référence existante en mise à jour.

### Champs financiers sensibles

`costStated`, `currency`, `statedPrice`, `vatNote`, `sourceUrl`. `validateProduct` recopie `costStated` tel quel et n’accepte comme devise que `EUR` ou `USD`. Aucun calcul de `pricing.ts`.

### Champs que le modèle ne doit jamais inventer

Montant, devise, TVA, URL, identifiant, fournisseur non écrit, famille hors liste, suffixe de nom (`Pro`, `France`).

## F. Service

Verdict : `SERVICE REPRÉSENTÉ PAR Product.kind = "service"`.

Aucune entité `Service`. Aucune commande `create_service`.

Deux représentations déjà là :

- `Product.kind = "service"` quand un tableau métier a un en-tête `id service` (`saveArticle`) ;
- `Product.family = "prestation"` dans la liste fermée des familles, distincte du `kind`.

`CREATE_SERVICE` n’est pas un troisième ActionType. Une phrase de service ou de prestation devient `CREATE_PRODUCT` avec `kind: "service"`. La famille `prestation` n’est posée que si ce mot, ou un mot de la liste, est ancré.

## G. CatalogCommand

| Commande | Champs | Validation | Écriture métier | Proposal actuelle |
| --- | --- | --- | --- | --- |
| `create_supplier` | `PartyInput` | `plainLabel` puis `validateParty` | `createParty("supplier")` | `CatalogProposal` via `openCatalogProposal` |
| `update_supplier` | `PartyInput`, nom = cible | `patchParty` : champs vides conservent l’existant | `updatePartyById` | même proposition catalogue |
| `create_product` | `ProductInput` | `plainLabel` puis `validateProduct` | `createProduct` ; `ensureSupplier` si un nom de fournisseur est fourni | `CatalogProposal` |
| `update_product` | `ProductInput`, nom = cible | `patchProduct` | `updateProductById` | `CatalogProposal` |
| service | aucun type dédié | `kind === "service"` dans `validateProduct` | colonne `Product.kind` | aucune commande propre |

`presentCommand` affiche pour un produit le nom, la référence, l’unité et le fournisseur. Il n’affiche ni `kind` ni `family`.

## H. Parsers déterministes

`parseCatalogCommand` reconnaît, en tête de phrase :

```text
ajoute | crée | ouvre | création
+ un | une | le | la | du | compte
+ client | fournisseur | produit | projet
+ reste
```

Mesures sur les phrases de l’audit :

| Phrase | Commande | StructuredPlan éligible |
| --- | --- | --- |
| Ajoute le fournisseur ACME | `create_supplier`, nom ACME | non |
| Crée un fournisseur ACME | `create_supplier`, nom ACME | non |
| Ajoute le fournisseur ACME, email contact@acme.fr | `create_supplier`, e-mail repris | non |
| Ajoute ACME comme fournisseur, email contact@acme.fr | aucune | non (`outsideStructuredPlan`) |
| Ajoute le produit Switch X | `create_product`, nom Switch X | non |
| Ajoute le produit Switch X200 | `create_product` | non |
| Ajoute une prestation Audit réseau | aucune | oui, traité comme une création client possible |
| Ajoute le service Audit réseau | aucune | oui, même collision |
| Ajoute Orange comme fournisseur | aucune | non |
| Ajoute Paris comme produit | aucune | non |
| Ajoute Service Premium | aucune | oui |

`identifyClient` ignore une phrase qui commence par `ajoute` / `crée` / `ouvre` sans le mot client (`isOtherCatalogCommand`). Ces phrases ne deviennent pas une fiche client par ce parseur.

`parseBusinessBrief` ne lit un service que dans un tableau `id service` / `SRV-`. Une phrase naturelle ne l’alimente pas.

Le mot `fournisseur` ou `produit` dans `OUTSIDE_V0` empêche StructuredPlan d’atteindre les formes naturelles « comme fournisseur » et « comme produit ». En même temps, l’absence de ces mots laisse « prestation », « service » et « Ajoute Service Premium » entrer dans le plan client.

## I. Ordre de routage

Ordre réel de `POST /api/assistant` :

```text
action de carte par identifiant
→ parcours suspendu
→ answerDirectly
    tableau métier
    mesures, contrat, intervention, équipement, brouillon, achat, réclamation, dossier, trésorerie
    règle d’argent
    « Je confirme. » / « Rejette. »
    devis hybride
    parseCatalogCommand
    intention de lecture
    enrichissement client
    proposition client
    toute autre CatalogProposal
→ decideFree
→ structuredPlanEligible && structuredPlanGate
→ si le plan est éligible et Ollama ne rend pas un plan valide : blocage, sans repli vers le modèle de conversation
→ sinon le modèle de conversation
```

`decideFree` sur « ajoute » renvoie `execution: "absente"` et `id: null`. La porte StructuredPlan reste ouverte, car elle ne se ferme que si `id` est rempli.

Destination recommandée, en gardant le parseur strict devant :

| Phrase | Chemin |
| --- | --- |
| Ajoute le fournisseur ACME | reste `parseCatalogCommand` → `CatalogProposal`. StructuredPlan ne la voit pas. |
| Ajoute le produit Switch X | reste `create_product`. |
| Ajoute ACME comme fournisseur | nouveau StructuredPlan `CREATE_SUPPLIER`, une fois le mot retiré du blocage aveugle et la forme « comme fournisseur » exigée. |
| Ajoute le service Audit réseau | StructuredPlan `CREATE_PRODUCT`, `kind: "service"`. Aujourd’hui la phrase est éligible comme client : ce classement doit cesser. |
| Ajoute une prestation Audit réseau | même produit de kind `service`, famille `prestation` parce que le mot est ancré. |

## J. Ancrage fournisseur

Réutiliser `expressionAnchored`, `emailAnchored`, `phoneAnchored`, `addressAnchored`, `plainLabel`.

```text
Ajoute le fournisseur ACME, email contact@acme.fr
```

est déjà une commande déterministe. Le cas StructuredPlan est :

```text
Ajoute ACME comme fournisseur, email contact@acme.fr
```

Accepté : `name = ACME`, `email = contact@acme.fr`.
Refusé : `name = ACME France`, un e-mail, un téléphone, une adresse ou un SIREN absent du texte.

Le nom doit être un segment de mots entier. Trois lettres utiles minimum, comme l’ancrage actuel.

## K. Ancrage produit

```text
Ajoute le produit Switch X200
```

Accepté : `name = Switch X200`.
Refusé : `name = Switch X200 Pro`.

Famille : le mot du message, plié sans accent, doit être exactement une valeur de `PRODUCT_FAMILIES`. `réseau` peut devenir `reseau`. `réseaux professionnels` est refusé.

Montant : aucun validateur d’ancrage monétaire dans StructuredPlan. `validateProduct` recopie une chaîne, il ne prouve pas qu’elle était dans le message. V1 ne porte pas le montant.

## L. Champs omis

Règle actuelle, clients seulement : un e-mail, un téléphone ou une adresse reconnus dans le message et absents de tous les `CREATE_CLIENT` donnent `kind: "omitted"`. La route refuse, rien n’est proposé.

Extensions minimales :

- fournisseur : les mêmes trois champs, sur `CREATE_SUPPLIER` ;
- produit : une famille de la liste fermée présente dans le message et absente du plan est un champ omis ;
- un montant reconnu (`€`, `EUR`, `euro`) dans une phrase de création est un champ omis en V1, puisque le plan ne le porte pas ;
- un SIREN ou un SIRET écrit et non porté par le plan est un champ omis, pour la même raison.

```text
Ajoute ACME comme fournisseur, email contact@acme.fr
```

avec seulement `name = ACME` : refus pour e-mail omis. Même mécanique que le client.

## M. Entités existantes

Comportement actuel à la confirmation :

- fournisseur de même `nameKey` : pas de deuxième fiche, résumé « existe déjà », proposition quand même confirmée ;
- produit de même `nameKey` : même schéma ;
- client StructuredPlan : refus avant proposition, pas de `update_client`.

Règle recommandée pour les nouveaux plans : `CREATE` + nom exact déjà en base → réponse `already`, aucune proposition, aucune mise à jour. Le parseur déterministe existant n’est pas à réécrire dans ce lot.

## N. Multi-actions

`OUT V1`.

`ACTION_MAX` vaut 2, et le seul couple traduit est `CREATE_CLIENT` puis `CREATE_PROJECT`. Une `CatalogProposal` porte une seule `CatalogCommand`. `BusinessPlan` a des clients, des articles, des projets et des devis, pas de fournisseur. « Ajoute le fournisseur ACME et le produit Switch X » demanderait deux propositions ou une commande nouvelle. Une action par plan en V1.

Le couple client + projet déjà livré reste inchangé.

## O. Références inter-actions

`OUT V1`.

`Product.supplierName` est un nom, pas un identifiant. Le modèle ne doit pas produire d’id. À l’écriture, `ensureSupplier` crée le fournisseur s’il manque. Lier le produit à l’action fournisseur précédente réintroduirait cette création cachée. V1 laisse `supplierName` vide.

## P. UPDATE

`update_supplier` et `update_product` existent, avec le parseur « mettre à jour le fournisseur|produit … ».

`OUT LOT-V3-007`.

Le plan structuré n’a pas d’`UPDATE_*`. Une phrase de modification reste sur `OPPOSITE` / le parseur déterministe. Aucune nécessité d’ouvrir l’update pour faire tenir la création.

## Q. Prix / coûts

Recommandation : `OUT V1`.

Les montants restent des chaînes recopiées (`costStated`, `statedPrice`). StructuredPlan interdit déjà d’inventer un montant, et aucun ancrage monétaire n’existe. Les accepter demanderait un détecteur, une preuve d’ancrage et un affichage sur la carte. Un prix écrit dans la phrase V1 doit provoquer un refus de champ omis, pour qu’il ne disparaisse pas en silence.

## R. Risques sémantiques

| Phrase | Protection actuelle | Règle du lot |
| --- | --- | --- |
| Ajoute Orange comme fournisseur | parseur strict muet ; StructuredPlan bloqué par le mot fournisseur ; `identifyClient` ne s’applique pas | `CREATE_SUPPLIER`, nom `Orange` seulement s’il est ancré. Pas de ville, pas de client. |
| Ajoute Paris comme produit | même blocage par le mot produit | `CREATE_PRODUCT`, nom `Paris`. L’adresse exige une rue numérotée : `Paris` seul n’est pas une adresse. |
| Ajoute Service Premium | éligible au plan client, car « ajoute » sans mot interdit | rester une création client possible. Le mot Service dans le nom ne suffit pas à poser `kind: "service"`. |
| Ajoute le service Audit réseau | éligible au plan client aujourd’hui | doit devenir `CREATE_PRODUCT` / `kind: "service"`, et cesser d’être un client. |
| Ajoute le fournisseur ACME | `create_supplier` déjà | le parseur strict reste devant. Ne pas ouvrir un second mécanisme. |

`bareNameQuestion` ne s’applique pas quand le verbe est `ajoute` ou `crée`. Un homonyme déjà au répertoire ne détourne pas ces phrases vers une consultation.

## S. JSON cible

Fournisseur :

```json
{
  "actions": [
    {
      "type": "CREATE_SUPPLIER",
      "args": { "name": "ACME", "email": "contact@acme.fr" }
    }
  ],
  "missing": []
}
```

Produit :

```json
{
  "actions": [
    {
      "type": "CREATE_PRODUCT",
      "args": { "name": "Switch X200", "family": "reseau" }
    }
  ],
  "missing": []
}
```

Service, même type :

```json
{
  "actions": [
    {
      "type": "CREATE_PRODUCT",
      "args": { "name": "Audit réseau", "kind": "service", "family": "prestation" }
    }
  ],
  "missing": []
}
```

`family` et `kind` sont absents quand le message ne les porte pas. `email`, `phone`, `address` aussi.

## T. Validation serveur

Clés autorisées en plus de l’existant :

- action `CREATE_SUPPLIER`, args `name`, `email`, `phone`, `address` ;
- action `CREATE_PRODUCT`, args `name`, `reference`, `unit`, `description`, `family`, `kind`.

Clés interdites : la liste actuelle, plus `costStated`, `statedPrice`, `currency`, `vatNote`, `sourceUrl`, `supplierId`, `supplierName` dans le plan V1.

Limites : nom 2–120, e-mail 120 et forme e-mail, téléphone 40 et au moins 10 chiffres pour l’ancrage, adresse 200, référence 60, unité 20, description 1 000.

Valeurs fermées : `kind` vide ou `service` ; `family` vide ou une valeur de `PRODUCT_FAMILIES` après pli.

Ancrage : chaque valeur non vide est un segment du message. La famille et le kind `service` exigent le mot correspondant.

Omission : e-mail, téléphone, adresse, famille fermée, montant, SIREN/SIRET détectés et absents du plan → refus.

Actions : au plus 2, et le seul couple reste client puis projet. Un plan fournisseur ou produit contient une seule action.

`plainLabel` reste obligatoire sur les noms.

## U. Traduction Proposal

```text
CREATE_SUPPLIER
→ CatalogCommand create_supplier (PartyInput, siren et notes vides)
→ translateStructuredPlan, kind catalog
→ openCatalogProposal
→ confirmation
→ createParty("supplier")

CREATE_PRODUCT
→ CatalogCommand create_product (supplierName vide, kind produit ou service, family ou "")
→ openCatalogProposal
→ confirmation
→ createProduct
```

Avant d’ouvrir : `prisma.supplier.findUnique({ where: { nameKey } })` ou `product.findUnique`. Trouvé → même issue que `already` du client, adaptée au libellé fournisseur ou produit.

`resolutionName` et la lecture unique du client dans `answerFromStructuredPlan` doivent connaître ces deux noms. `openCatalogProposal` et `applyCatalogCommand` restent les fonctions d’enregistrement.

La carte produit devrait montrer `kind` et `family` quand ils sont remplis (`commandFields`). Sinon l’utilisateur confirme un produit sans voir qu’il sera un service.

## V. Tests

### Supplier

- « ACME comme fournisseur » → `CREATE_SUPPLIER`, nom ACME ;
- e-mail `contact@acme.fr` ancré, accepté ;
- adresse « 12 rue de la Gare, Paris » ancrée, acceptée ;
- `ACME France` ou un e-mail inventé, refusé ;
- fournisseur de même `nameKey` déjà connu → `already`, pas d’`update_supplier` ;
- e-mail présent dans la phrase et absent du plan → `omitted`.

### Product

- « Switch X200 » → nom exact ;
- famille `reseau` si le message dit réseau ;
- famille `serveurs professionnels` refusée ;
- `costStated` ou `100 €` absent du texte, refusé ; un euro écrit dans la phrase et absent du plan, `omitted` ;
- produit de même `nameKey` → `already`.

### Service

- « Ajoute le service Audit réseau » → `CREATE_PRODUCT`, `kind: "service"`, nom `Audit réseau`, et la phrase n’est plus éligible comme client ;
- « prestation Audit réseau » → `kind: "service"` et `family: "prestation"` ;
- « Ajoute Service Premium » sans rôle service/produit/fournisseur → pas de `kind: "service"`.

Garder les tests : `parseCatalogCommand("ajouter un fournisseur Quincaillerie Durand")` reste `create_supplier`, et cette phrase ne passe pas par Ollama.

## W. Recette future

1. `Ajoute le fournisseur ACME` — forme courte déjà déterministe, une proposition, pas d’appel utile à StructuredPlan.
2. `Ajoute ACME comme fournisseur, email contact@acme.fr` — plan, nom et e-mail ancrés.
3. `Le fournisseur s’appelle ACME, son téléphone est 06 12 34 56 78` — formulation naturelle.
4. `Ajoute Orange comme fournisseur` — nom court, homonyme possible.
5. `Ajoute le produit Switch X200` — déterministe.
6. `Ajoute Switch X200 comme produit, famille réseau` — plan, famille fermée.
7. `Ajoute le service Audit réseau` — `kind: "service"`.
8. `Ajoute une prestation Audit réseau à 150 €` — refus : montant non porté.
9. `Ajoute le fournisseur ACME` alors qu’ACME existe — refus, fiche inchangée.
10. `Ajoute le produit Switch X200 Pro` alors que le message dit seulement Switch X200 — ancrage refusé.

## X. Fichiers impactés

MUST MODIFY

- `src/domain/structured-plan.ts`
- `src/app/api/assistant/route.ts`
- `tests/structured-plan.test.ts`

MAY MODIFY

- `src/domain/catalog.ts` (`commandFields`, pour montrer kind et family)
- `docs/manuel-utilisateur.md`
- `docs/technique/docs/orchestration.md`
- `tests/catalog-command.test.ts` (frontière parseur / plan)

NO CHANGE

- `prisma/schema.prisma` et `prisma/migrations`
- `src/domain/pricing.ts`
- `src/lib/catalog-store.ts` tant que `supplierName` reste vide et que `create_supplier` / `create_product` restent les écritures
- `src/lib/catalog-proposals.ts` (`openCatalogProposal` accepte déjà ces commandes)
- `src/lib/business-records.ts`

## Y. Migration

`AUCUNE MIGRATION`.

`Supplier`, `Product`, `Product.kind` et `Product.family` existent. Les statuts de proposition aussi.

## Z. MUST / SHOULD / OUT

### MUST LOT-V3-007

- Deux ActionTypes : `CREATE_SUPPLIER`, `CREATE_PRODUCT`.
- Le service est `CREATE_PRODUCT` avec `kind: "service"`.
- Ancrage des noms et des contacts par les helpers actuels.
- Refus si un contact, une famille fermée, un montant ou un SIREN écrit est omis.
- Refus `already` avant proposition. Pas de UPDATE silencieux.
- Le parseur `ajoute|crée … fournisseur|produit` reste devant StructuredPlan.
- « le service » et « une prestation » ne sont plus des créations client.
- Une seule action fournisseur ou produit par plan.
- `supplierName` vide. Pas de montant.

### SHOULD LOT-V3-007

- Afficher kind et family sur la carte de proposition.
- Famille `prestation` quand le mot est ancré.
- Tests de frontière avec `parseCatalogCommand`.

### OUT

- `CREATE_SERVICE` comme type propre.
- `UPDATE_SUPPLIER`, `UPDATE_PRODUCT`.
- Couple fournisseur + produit.
- Lien produit → fournisseur, et toute création de fournisseur par `ensureSupplier` depuis ce plan.
- Prix, coût, TVA, URL, notes, encours, délai.
- SIREN porté par le plan.
- Correction de l’adresse coupée au mot « à ».
- Réécriture du parseur déterministe.

## AA. Estimation

Complexité moyenne. Le métier et les commandes existent. Le travail est le contrat, l’éligibilité et la traduction.

Risque moyen. Le point sensible est le routage : « ajoute » ouvre déjà StructuredPlan, et `OUTSIDE_V0` bloque toute la phrase qui contient fournisseur ou produit, y compris les formes naturelles à couvrir.

Une itération d’implémentation, puis une revue Claude avant le code : les collisions de la section H changent le classement de phrases déjà éligibles.

Recette Ollama réelle ensuite. L’ancrage se teste sans modèle ; le classement des phrases naturelles non.

## AB. Contrôles techniques

- `npm test` : 371 tests, 0 échec
- `tsc --noEmit` : PASS
- `npm run lint` : 0 erreur, 4 avertissements déjà présents
- `git diff --check` : PASS

## Verdict

GO CONCEPTION LOT-V3-007
