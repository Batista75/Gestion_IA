# LOT-V3-009 — Construction d’un contexte métier exploitable à partir d’une SituationReading

Conception corrigée après revue. Aucune implémentation dans ce document.

Baseline de départ : `BASELINE-10 — LOT-V3-008 — c0562d37682236f5d45f4d60bb4254d65becb512`.

## 1. Objectif

À partir d’une phrase déjà passée par `SituationReading`, produire un `BusinessContext` inspectable. Il représente l’affaire, les tiers, l’événement commercial, les produits ou services, les quantités, les montants, les fichiers joints et les ambiguïtés. Chaque partie indique d’où elle vient.

Exemple :

`J'ai reçu le devis de ClimPro pour le chantier Climatisation Dupont : 4 unités MSZ-AP25 pour 3 600 € HT`

Chaîne visée, dont seule la troisième étape est le sujet de ce lot :

`UserText` → `SituationReading` → `BusinessContext` → futur `ActionProposal` → future validation → futur moteur métier.

`SituationReading` reste la lecture brute. `BusinessContext` est la consolidation. Il ne devient pas un planner. Il ne porte ni action, ni intention d’écriture.

`situationReply` reste inchangé. Le texte conversationnel ne résume pas le contexte. Seul le bloc d’écran l’affiche.

## 2. Périmètre

Le lot construit `BusinessContext` uniquement lorsqu’un `SituationReading` a été produit pour le tour. Il réutilise le gate, l’ordre de route et le rattachement de dossier déjà validés.

Le serveur résout les identités à partir des mentions ancrées et des lignes déjà en base. Pour chaque mention `client`, `supplier` ou `product`, il interroge les trois tables. Il qualifie l’événement et les documents à partir des mots de la phrase. Il relie une quantité ou un montant seulement par l’algorithme de la section 9.

L’écran montre ce contexte à côté de la lecture, sans bouton de confirmation.

## 3. Hors périmètre

- toute création ou modification de `Project`, `Client`, `Supplier`, `Product`, `Quote`, document métier ou proposition ;
- `ActionProposal` et le moteur métier ;
- un second appel Ollama ;
- élargir ou resserrer `situationReadingEligible` ;
- modifier `src/domain/situation-reading.ts`, `situationModelGuide()`, `src/lib/situation-reading-read.ts`, `src/domain/structured-plan.ts`, `linkConversation`, `src/domain/pricing.ts`, le schéma Prisma ou les migrations ;
- lire `extractedText`, le PDF ou l’image ;
- calculer un total, une TVA, un prix unitaire dérivé ou une conversion ;
- choisir un rôle `prospect` ou `partner` comme fiche ;
- corriger le trait d’union de `matchProjectContext` (`Dupont` dans `Dupont-Martin`) ;
- changer la limite de 8 mentions ;
- traduire les états anglais de la carte « Lecture de situation » déjà livrée.

`ClimPro intervient mardi sur le chantier Dupont` n’atteint pas le gate : la phrase n’a ni forme de réception commerciale, ni objet commercial requis. Ce lot ne construit pas de contexte pour elle, et ne change pas le gate pour la faire entrer.

## 4. Architecture proposée

Le tour reste celui de LOT-V3-008. Après `buildSituationReading`, une fonction pure `buildBusinessContext` lit la lecture, la phrase déjà portée par `source.userText`, et les lignes déjà chargées `{ id, name, table, productKind }`. Elle ne rappelle pas le modèle. Elle n’appelle pas `matchProjectContext`. Elle recopie `projectContext`.

La route charge une seule fois les `Client`, les `Supplier` et les `Product`. La sélection ajoute `id`, et `kind` pour `Product`. Ces lignes ne partent pas vers Ollama.

Le contrat de LOT-V3-008 reste celui de `DirectoryNameRow` : `{ kind, name }`, sans id. La route projette les mêmes lignes vers ce type pour `buildSituationReading`. Elle passe les lignes riches à `buildBusinessContext`. Les deux projections comparent le même `nameKey`. `knownEntities` n’est pas relu pour inventer des id.

`readSituationMentions` continue de n’envoyer que `situationModelGuide()` et `userText`. Le guide reste le texte de la baseline. Le `kind` reçu d’Ollama est recopié comme indice. Il ne filtre pas la charge des tables.

Le résultat voyage avec la lecture : même réponse, même source `regle-metier`, clé JSON `businessContext`.

`src/domain/situation-reading.ts` n’est pas modifié. La répétition et le chevauchement se jugent dans `business-context.ts`, à partir de `source.userText` et des ancres déjà calculées.

## 5. Frontières LLM / serveur

Le modèle de LOT-V3-008 peut extraire des mentions `{ kind, text }`. Ce lot ne lui demande rien de plus. Au plus 8 mentions : au-delà, `parseSituationModelOutput` rejette tout le tableau. Le contexte est alors le contexte partiel de la section 14, sans entité. Cette limite n’est pas relevée.

Le serveur :

- reprend les ancres `start` et `end` déjà calculées ; le modèle ne les fournit pas ;
- ne les utilise pour une relation qu’après l’étape `LinkableAnchor` de la section 9 ;
- pour chaque mention ancrée `client`, `supplier` ou `product`, cherche le même `nameKey` dans `Client`, dans `Supplier` et dans `Product` ;
- garde les `kind` du modèle comme indices, jamais comme limite de recherche et jamais comme preuve d’identité ;
- laisse un homonyme de domaine ou un nom présent dans plusieurs familles sans identifiant choisi ;
- qualifie l’événement et `documents` par les mots de la phrase, selon la section 11 ;
- relie quantité et montant par la section 9 ;
- copie les `fileIds` déjà connus ;
- conserve la provenance, y compris le nom du modèle quand l’origine des mentions est `ollama`.

`prospect` et `partner` ne sont pas des résolutions. Aucune table ne les porte.

Un second appel serait utile seulement pour une relation que les ancres admissibles ne peuvent pas trancher. Ce lot ne le fait pas. La relation incertaine reste non liée, avec `unlinked_quantity`, `unlinked_amount` ou `relation_not_deterministic`.

## 6. Contrat TypeScript proposé

Une seule liste stockée : `entities`. Le champ `view` dit si l’écran la range parmi les acteurs, parmi les items, ou dans aucune de ces vues. `actors` et `items` ne sont pas des tableaux du JSON. L’écran les dérive en filtrant `entities`.

`conflict` existe seulement sur une résolution `resolved`.

La famille est la table : `client`, `supplier` ou `product`. `service` n’est pas une famille. `service` est le `entityType` quand `Product.kind === "service"`. Tout autre `Product.kind`, y compris `produit`, donne `entityType` `product` et la famille `product`.

```ts
type ModelHint = "client" | "supplier" | "product";
type Family = "client" | "supplier" | "product";
type EntityType = "client" | "supplier" | "product" | "service";
type EntityView = "actor" | "item" | null;

type BusinessIssueReason =
  | "unknown_entity"
  | "duplicate_name"
  | "cross_family_ambiguity"
  | "role_conflict"
  | "unlinked_quantity"
  | "unlinked_amount"
  | "relation_not_deterministic"
  | "repeated_anchor"
  | "overlapping_anchor"
  | "model_hint_ambiguity";

type EntityCandidate = {
  family: Family;
  entityType: EntityType;
  entityId: string;
  entityName: string;
};

type EntityResolution =
  | {
      state: "resolved";
      family: Family;
      entityType: EntityType;
      entityId: string;
      entityName: string;
      conflict: boolean;
    }
  | {
      state: "ambiguous";
      scope: "same_family" | "cross_family";
      candidates: EntityCandidate[];
    }
  | { state: "unresolved" };

type BusinessEntityMention = {
  mentionText: string;
  start: number;
  end: number;
  modelHints: ModelHint[];
  resolution: EntityResolution;
  view: EntityView;
};

type AnchorRef = { start: number; end: number };

type BusinessRelation = {
  kind: "quantity_for_item" | "amount_for_item";
  valueAnchor: AnchorRef;
  entityAnchor: AnchorRef;
};

type BusinessEventKind =
  | "quote_received"
  | "offer_received"
  | "price_received"
  | "commercial_proposal"
  | "unknown";

type BusinessContext = {
  source: SituationReading["source"];
  projectContext: ProjectContext;
  event: { kind: BusinessEventKind; evidenceText: string | null };
  entities: BusinessEntityMention[];
  quantities: { text: string; start: number; end: number }[];
  amounts: { text: string; start: number; end: number }[];
  relations: BusinessRelation[];
  documents: { kind: "quote" | "offer" | "proposal" | "price"; mentionText: string }[];
  attachments: { fileIds: string[]; contentRead: false };
  issues: { reason: BusinessIssueReason; mentionText?: string; detail?: string }[];
  provenance: {
    mentions: { origin: "ollama"; model: string } | { origin: "none" };
    event: "server-rule";
    documents: "server-rule";
    resolution: "server-rule";
    projectContext: "server-rule";
  };
};
```

`contentRead` vaut toujours `false`. Aucun champ `actions`. Aucun `fields`. Aucune quantité et aucun montant ne sont stockés sur l’entité. `detail` est une phrase humaine facultative. `reason` est la valeur exploitable plus tard.

`text` d’une quantité ou d’un montant est la tranche exacte `userText.slice(start, end)`.

## 7. Modèle de résolution des entités

Toute mention ancrée dont le `kind` modèle est `client`, `supplier` ou `product` peut devenir une `BusinessEntityMention`. Le serveur cherche son `nameKey` dans `Client`, dans `Supplier` et dans `Product`. Les `kind` sont copiés dans `modelHints`. Ils ne retirent aucune table.

`start` et `end` sont ceux de `SituationReading`. Le modèle ne les envoie pas.

Avant la résolution, les mentions d’entité qui partagent la même ancre `[start, end)` forment une seule mention logique. Des indices identiques restent un seul indice. Des indices différents produisent `modelHints` de longueur supérieure à un, l’issue `model_hint_ambiguity`, et aucune vue hypothétique. L’ordre du modèle ne choisit pas l’indice.

Une mention dont le `nameKey` est égal à un nom déjà porté par `projectContext` ne devient pas une entité. `matched` et `current` portent `projectName`. `ambiguous` porte `projectNames`. `unresolved` n’écarte rien par ce motif. Aucun dossier n’est rechargé.

Les six cas, pour une mention qui reste :

1. Une seule ligne, une seule famille, un seul indice. Mention `supplier / ClimPro`, seule fiche `Supplier ClimPro` : `resolved`, famille `supplier`, `conflict` faux, `view` `actor`.
2. Un seul indice, une seule fiche, familles différentes. Mention `client / ClimPro`, seule fiche `Supplier ClimPro` : `modelHints` reste `["client"]`, résolution fournisseur, `conflict` vrai, issue `role_conflict`, `view` `actor` parce que la fiche est un fournisseur. L’indice n’est pas remplacé. L’indice `supplier` face à une seule fiche `Product` est le symétrique : `view` `item`, `conflict` vrai.
3. Lignes dans `Client` et `Supplier` : `ambiguous`, `scope` `cross_family`, un candidat par ligne, aucun `entityId` choisi, issue `cross_family_ambiguity`, `view` `null`. Ces deux fiches peuvent partager une `Organization`. L’ambiguïté porte sur le rôle, pas sur un choix d’organisation. Aucun rôle n’est pris.
4. Lignes dans une table de tiers et dans `Product`, ou dans les trois tables : même représentation, `scope` `cross_family`, tous les candidats, `view` `null`.
5. Deux lignes de la même famille remises à la fonction pure, par exemple deux `Supplier Dupont` : `ambiguous`, `scope` `same_family`, deux candidats, aucun `entityId` choisi, issue `duplicate_name`. Famille `supplier` ou `client` : `view` `actor`. Famille `product` : `view` `item`. `Client.nameKey`, `Supplier.nameKey` et `Product.nameKey` sont `@unique`. Ce cas est une défense de domaine. Il n’est pas un scénario de recette PostgreSQL.
6. Aucune ligne, un seul indice : `unresolved`, issue `unknown_entity`, aucun `entityId`. Rien n’est créé. Le serveur ne décide pas que la fiche existe. L’indice ouvre seulement une vue prudente : `client` ou `supplier` donne `view` `actor` ; `product` donne `view` `item`.

`conflict` n’est vrai que dans le cas 2. Un indice `product` et une ligne `Product` de nature `service` ne sont pas un conflit : la famille reste `product`. Un indice `client` ou `supplier` face à une seule ligne `Product` est un conflit, et `view` vaut `item`.

Une mention `unresolved` dont `modelHints` compte plusieurs indices a `view` `null`. Elle n’est pas une cible de lien. Une mention résolue dans ce même cas garde la vue de la fiche réelle, `conflict` faux, et n’est pas non plus une cible de lien.

`prospect` et `partner` ne sont pas des résolutions.

## 8. Gestion produits / services

La recherche d’une mention, même indicée `product`, lit aussi `Client` et `Supplier`. Une mention indicée `client` ou `supplier` lit aussi `Product`.

`Product.kind === "service"` donne `entityType` `service`. La famille reste `product`. Le mot « unités » ne décide pas de cette nature.

Une fiche produit unique donne `view` `item` comme fait de la base. Un produit absent des trois tables, avec un seul indice `product`, reste `unresolved` et garde `view` `item` comme mention non résolue. Rien n’est créé. Un acteur absent, indice unique `client` ou `supplier`, a `view` `actor` de la même façon.

Un nom présent dans `Product` et dans une table de tiers est le cas 4 : `view` `null`.

Deux lignes produit du même nom sont le cas 5, défense de domaine : `duplicate_name`, `view` `item`, aucun id choisi.

## 9. Ancres admissibles, quantités et montants

Le texte du montant et de la quantité reste l’extrait ancré. `src/domain/pricing.ts` n’est pas appelé. Aucun total, aucune multiplication, aucun prix unitaire ne sont produits.

La constante d’intervalle est `GAP_MAX = 24`. Elle compte les caractères de `userText` entre les deux ancres, bornes exclues.

### 9.1 LinkableAnchor

Une mention de `SituationReading` peut entrer dans une relation seulement si les trois conditions tiennent :

1. son `text` apparaît exactement une fois dans `userText` ;
2. `start` et `end` sont ceux de cette unique occurrence, et `userText.slice(start, end) === text` ;
3. l’intervalle `[start, end)` ne chevauche aucune autre mention ancrée d’un autre texte.

Le chevauchement est `start < otherEnd && otherStart < end`.

Si le texte apparaît plusieurs fois, la mention reste affichable dans `SituationReading`. Une mention d’entité peut rester dans `entities`. Elle n’est ni une valeur ni une cible de relation. Issue `repeated_anchor`.

Si deux ancres se chevauchent, aucune des deux n’entre dans une relation. Issue `overlapping_anchor`. Cela couvre :

- une quantité `5` dont l’ancre tombe dans `MSZ-AP25` ;
- une quantité `3 600` dont l’ancre tombe dans `3 600 € HT` ;
- une quantité `4 unités MSZ-AP25` qui englobe l’item.

Deux indices sur le même texte et la même ancre sont le regroupement de la section 7, pas un chevauchement. Issue `model_hint_ambiguity`. Cette mention n’est pas une cible de relation.

### 9.2 Cible admissible

Une cible de lien est une entité dont l’ancre est admissible et dont la résolution est :

- `resolved`, famille `product` (`entityType` `product` ou `service`), avec un seul indice modèle ;
- ou `unresolved`, avec exactement l’indice `product`.

Une entité `ambiguous`, une entité d’indice multiple, et un acteur ne sont pas des cibles. L’absence de fiche ne retire pas une relation dont les ancres sont admissibles. Elle ne crée pas d’identité.

### 9.3 Intervalle admissible

L’intervalle ouvert entre une valeur et une cible est admissible seulement si :

1. il ne contient aucune autre ancre de `SituationReading`, quel que soit son type ou son état ;
2. sa longueur est au plus `GAP_MAX` ;
3. il ne contient aucun chiffre ;
4. il ne contient aucun des caractères `,` `;` `:` ;
5. après minuscules et suppression des accents, il ne contient aucun des mots entiers `et`, `ou`, `puis`.

`pour`, `à`, `de` et `le` ne sont pas des connecteurs de cette liste.

### 9.4 Quantité

Une quantité admissible est confrontée à toutes les cibles admissibles, avant elle ou après elle. Une paire n’est retenue que si l’intervalle est admissible.

- une seule paire : relation `quantity_for_item` ;
- aucune paire : issue `unlinked_quantity` ;
- plusieurs paires : issue `relation_not_deterministic`, aucune relation.

Une quantité déjà frappée de `repeated_anchor` ou `overlapping_anchor` ne reçoit pas en plus `unlinked_quantity`.

### 9.5 Montant

Même recherche bidirectionnelle, avec la même issue `unlinked_amount` ou `relation_not_deterministic`.

S’y ajoute le segment local. Pour un montant M :

- la région gauche va de la fin du montant ancré précédent, ou du début de la phrase, jusqu’au début de M ;
- la région droite va de la fin de M jusqu’au début du montant ancré suivant, ou jusqu’à la fin de la phrase.

On compte les cibles admissibles dont l’ancre est entièrement dans la région, même si l’intervalle jusqu’à M n’est pas admissible.

- si la région gauche contient exactement une cible, et que la paire avec M a un intervalle admissible, le montant est lié à cette cible ;
- si la région gauche n’en contient aucune, la région droite est lue de la même façon ;
- si la région gauche en contient plusieurs, le montant n’est pas lié : `relation_not_deterministic` ;
- si la région retenue en contient une mais que l’intervalle n’est pas admissible, ou si aucune région n’en contient : `unlinked_amount` quand aucune paire n’existe, `relation_not_deterministic` quand plusieurs paires existeraient.

Aucune heuristique ne choisit le dernier produit placé avant le montant.

`2 MSZ-AP25 et 3 MSZ-AP35 pour 5 500 € HT` : la région gauche du seul montant contient deux items. `5 500 € HT` reste non lié, issue `relation_not_deterministic`.

`2 MSZ-AP25 à 900 € l'unité et 1 MSZ-AP35 à 1 200 €` : chaque région gauche contient une seule cible, et l’intervalle ` à ` est admissible. Chaque montant est lié. Les textes restent `900 €` et `1 200 €`. `l'unité` n’est pas un prix unitaire.

`900 € le MSZ-AP25` : la région gauche n’a pas d’item, la région droite en a un, l’intervalle ` le ` est admissible. Le montant est lié.

`MSZ-AP25 : 5 unités` : le `:` rend l’intervalle inadmissible. Aucune relation. Issue `unlinked_quantity`.

## 10. Gestion Project

`projectContext` est celui de `SituationReading`, recopié tel quel. `current` vient seulement de la page. `Conversation.projectId` n’est pas lu. `buildBusinessContext` ne reçoit pas la liste des dossiers.

`matched` nomme l’unique dossier dont le nom complet est dans la phrase. `ambiguous` ne choisit pas d’id. `unresolved` laisse le reste du contexte utilisable.

Le défaut du trait d’union est hérité. Ce lot ne s’en sert pour aucune écriture. Il doit être corrigé avant qu’un lot suivant écrive à partir de cet id.

## 11. Événement, documents et fichiers

### 11.1 Événement

L’événement est lexical. Il ne lit pas les mentions `document` du modèle. La provenance est `server-rule`. `evidenceText` est la tranche exacte du mot retenu, ou `null`.

La réception entrante est l’une des formes : `j'ai reçu`, `nous avons reçu`, `reçu de`, `reçu du`, `m'a envoyé`, `m'ont envoyé`, `nous a envoyé`, `nous ont envoyé`. Le verbe `propose` ou `proposent` n’est pas une réception entrante.

Les lemmes documentaires sont `devis`, `offre`, `proposition`, `chiffrage`, `tarif`, mots entiers sur le texte minuscule sans accent.

| Condition | `kind` | `evidenceText` |
| --- | --- | --- |
| deux lemmes documentaires ou plus | `unknown` | `null` |
| un seul lemme, et une réception entrante | la ligne du lemme ci-dessous | la tranche du lemme |
| aucun lemme, et `propose` ou `proposent` | `commercial_proposal` | la tranche du verbe |
| un seul lemme, sans réception entrante, avec `propose` ou `proposent` | `commercial_proposal` | la tranche du verbe |
| sinon | `unknown` | `null` |

Ligne du lemme, seulement dans la deuxième condition :

| Lemme | `kind` |
| --- | --- |
| `devis` | `quote_received` |
| `offre` | `offer_received` |
| `tarif` | `price_received` |
| `chiffrage` | `commercial_proposal` |
| `proposition` | `commercial_proposal` |

`J'ai reçu le devis` donne `quote_received`, evidence `devis`. `ClimPro propose 4 unités` donne `commercial_proposal`, evidence `propose`. `ClimPro propose un devis` donne `commercial_proposal`, evidence `propose`. `m'a envoyé son tarif pour notre devis` donne `unknown`.

Cette qualification n’est pas une vérité métier. L’écran dit `Nature détectée d’après les mots du message`. Le futur `ActionProposal` ne devra pas utiliser `event` seul comme preuve d’écriture. Les faux positifs déjà connus du gate restent des faux positifs : ce lot ne les reclasse pas et n’élargit pas le gate.

### 11.2 documents

Une seule source : le serveur, sur le texte. Les mentions `document` d’Ollama ne remplissent pas `documents`. Provenance `documents: "server-rule"`.

| Lemme | `documents[].kind` |
| --- | --- |
| `devis` | `quote` |
| `offre` | `offer` |
| `proposition` | `proposal` |
| `chiffrage` | `proposal` |
| `tarif` | `price` |

Une entrée par lemme, la première occurrence, `mentionText` égal à la tranche exacte. Deux lemmes distincts qui mènent au même `kind` restent deux entrées. Un lemme répété ne produit qu’une entrée. Cette liste ne décide pas de `event.kind` : les deux mots de `tarif` et `devis` restent visibles quand l’événement vaut `unknown`.

### 11.3 Fichiers

`attachments.fileIds` recopie `SituationReading.source.fileIds`. Ces identifiants viennent des `StoredFile` de l’entrée de dépôt du tour, et seulement si ce tour atteint `SituationReading`.

`answerDirectly` est appelé avant le gate. Une pièce déjà reconnue ouvre une `DocumentProposal` et répond « La pièce a été analysée ». Ce chemin ne produit pas de `BusinessContext`. L’ordre de route ne change pas. Le scénario fichier ne vise que l’entrée qui arrive vraiment à la lecture, par exemple un fichier non reconnu comme `DocumentProposal`.

`contentRead` reste faux. `extractedText`, le PDF et l’image ne sont pas lus. Le `kind` documentaire déjà stocké sur le fichier n’est pas interprété comme un devis reconnu. L’écran dit `contenu du fichier non utilisé pour ce contexte`.

## 12. Persistance

Même colonne JSON de `ConversationMessage`. Clé `businessContext`, sœur de `situation`. Pas de colonne nouvelle. Pas de migration.

```json
{ "situation": {}, "businessContext": {} }
```

Les clés de la racine d’un tour de lecture sont exactement `situation` et `businessContext`. Le contexte n’est pas étalé à la racine. Les clés réservées `fields`, `id`, `type`, `confirmable`, `action`, `understanding` et `packet` n’y apparaissent pas.

L’objet stocké n’a pas de `fields`. `readStoredProposalCard` reste `null`. `cardMayAct` reste faux. `readUnderstanding` reste `null`. `readPacket` reste `null`. `readStoredBusinessContext` rend le contexte quand `situation` est valide à côté, et `null` si la situation manque ou si la forme est incomplète.

## 13. UI

Bloc « Contexte métier », sous la lecture, sans `Button`, sans `AssistantProposalCard`, sans Confirmer, sans Rejeter, sans Préciser.

Afficher en français :

- l’affaire, avec les libellés déjà utilisés par `describeProjectContext` ;
- l’événement, précédé de `Nature détectée d’après les mots du message` ;
- une fiche unique : l’extrait et le nom de la fiche ;
- un homonyme de même famille : `Plusieurs fiches portent ce nom. Aucune n’est choisie.` ;
- une ambiguïté de familles : `Ce nom existe dans plusieurs familles. Aucun rôle n’est choisi.` ;
- un conflit : `indice du modèle : client ; fiche : fournisseur`, avec les deux côtés réels ;
- un acteur sans fiche : `Thermix — lu comme fournisseur par le modèle — aucune fiche de ce nom` ;
- un item sans fiche : `XZ-999 — lu comme produit par le modèle — aucune fiche de ce nom` ;
- une relation : l’extrait de la quantité ou du montant à côté de l’item, comme relation textuelle ; si l’item est `unresolved`, la relation reste marquée comme mention du modèle ;
- les quantités et montants sans relation, à part, sans les appeler prix ni total ;
- les issues, par les libellés : aucune fiche de ce nom ; plusieurs fiches du même nom ; nom présent dans plusieurs familles ; l’indice du modèle ne correspond pas à la fiche ; quantité non reliée ; montant non relié ; relation non déterministe ; texte répété, ancre non utilisable pour une relation ; ancres qui se chevauchent ; indices du modèle contradictoires sur la même mention ;
- les fichiers joints : `contenu du fichier non utilisé pour ce contexte` ;
- la provenance : nom du modèle quand les mentions viennent d’Ollama, sinon mentions absentes ; le reste par une règle du serveur.

Ne pas afficher d’identifiants, de score, de total calculé, ni un rôle prospect ou partenaire. Ne pas présenter `current` comme un dossier nommé autrement que par le libellé déjà livré. Ne pas présenter une fiche contradictoire comme une correction de la phrase. Ne pas écrire « fournisseur » ou « produit » comme un fait établi quand la vue vient seulement de l’indice.

## 14. Comportement en cas d’échec

Si Ollama est absent, en timeout, hors contrat, ou si le tableau dépasse 8 mentions, `SituationReading` a des mentions vides et `mentionProvenance.origin` vaut `none`. Le contexte est quand même construit :

- `projectContext` recopié ;
- `event` calculé depuis la phrase, avec `evidenceText` ;
- `documents` calculés depuis la phrase ;
- `attachments` recopié ;
- `entities` vide ;
- `quantities` vide ;
- `amounts` vide ;
- `relations` vide ;
- `issues` vide ;
- provenance des mentions `{ origin: "none" }`.

Pas de second modèle. Pas d’écriture. `situationReply` indique que le détail des mentions n’est pas disponible, comme aujourd’hui.

## 15. Scénarios S1 à S23

Les ancres supposées sont celles que `anchorMentions` produit quand le modèle rend les extraits cités, puis filtrées par `LinkableAnchor`.

### S1 — cas nominal

Phrase : `J'ai reçu le devis de ClimPro pour le chantier Climatisation Dupont : 4 unités MSZ-AP25 pour 3 600 € HT`.

Données : un `Project` `Climatisation Dupont`, un `Supplier` `ClimPro`, un `Product` `MSZ-AP25`.

Attendu : affaire `matched`. ClimPro cherché dans les trois tables, une seule fiche fournisseur, `resolved`, `view` `actor`. MSZ-AP25 cherché dans les trois tables, une seule fiche produit, `resolved`, `view` `item`. Quantité `4 unités` liée, montant `3 600 € HT` lié, par des `BusinessRelation`. Événement `quote_received`, evidence `devis`. Document `quote`. Aucune écriture. Si le modèle rend aussi `Climatisation Dupont` comme client, cette mention est écartée des entités parce que son `nameKey` est déjà celui du dossier.

### S2 — acteur ambigu

`J'ai reçu le devis de Dupont pour Climatisation Martin`. `Dupont` est à la fois client et fournisseur.

Une entité `ambiguous`, `scope` `cross_family`, candidats client et fournisseur, aucun id choisi, `view` `null`, issue `cross_family_ambiguity`. L’indice du modèle est conservé. Aucun rôle n’est choisi, même si les deux fiches partagent une organisation.

### S3 — produit inconnu

`ClimPro propose 4 unités XZ-999 pour 4 200 € HT`. `XZ-999` est absent. L’indice rendu est `product`.

`XZ-999` est cherché dans les trois tables. Entité `unresolved`, `modelHints` `["product"]`, `view` `item`, issue `unknown_entity`. Si les ancres sont admissibles et l’intervalle aussi, la quantité `4 unités` et le montant `4 200 € HT` ont chacun une relation vers cette mention. Aucun id. Aucune création. ClimPro est résolu s’il n’existe que comme fournisseur. Événement `commercial_proposal`, evidence `propose`.

### S4 — plusieurs produits, un montant

`ClimPro propose 2 MSZ-AP25 et 3 MSZ-AP35 pour 5 500 € HT`.

Si chaque quantité a une seule cible à intervalle admissible, elle est liée. La région gauche du montant contient deux items. `5 500 € HT` n’est pas lié, issue `relation_not_deterministic`. Aucune répartition. Aucun choix du dernier produit.

### S5 — plusieurs montants

`ClimPro propose 2 MSZ-AP25 à 900 € l'unité et 1 MSZ-AP35 à 1 200 €`.

Chaque région gauche contient une seule cible et l’intervalle ` à ` est admissible. Les deux montants sont liés. Les textes restent `900 €` et `1 200 €`. Aucun total, aucune multiplication, aucun prix unitaire.

### S6 — dossier ambigu

Deux `Project` nommés `Climatisation Dupont`. `projectContext.state` vaut `ambiguous`. Aucun id d’affaire. Le reste du contexte suit les autres règles.

### S7 — aucun dossier

`J'ai reçu le devis de ClimPro pour 4 unités MSZ-AP25`.

`projectContext` vaut `unresolved` hors d’une page de dossier, ou `current` si une page de dossier est ouverte. ClimPro, le produit et la quantité restent exploitables. La phrase ne contient pas de montant.

### S8 — acteur inconnu

`J'ai reçu le devis de Thermix pour le chantier Dupont`. `Thermix` n’existe pas. L’indice rendu est `supplier`.

`Thermix` est cherché dans les trois tables. Entité `unresolved`, indice `supplier`, `view` `actor`, issue `unknown_entity`. L’écran dit `lu comme fournisseur par le modèle` et `aucune fiche de ce nom`. Aucune fiche créée. Le dossier `Dupont` est celui déjà calculé par `matchProjectContext`.

### S9 — rôle contradictoire

`Notre client ClimPro nous a envoyé son devis`. `ClimPro` n’existe que comme fournisseur.

Le conflit n’existe que si l’indice rendu est `client`. Alors : `modelHints` `["client"]`, résolution `Supplier ClimPro`, `conflict` vrai, issue `role_conflict`, `view` `actor`. L’écran montre l’indice du modèle et la fiche. La phrase n’est pas réécrite.

### S10 — fichier joint

`J'ai reçu ce devis pour le chantier Dupont`, avec un fichier de l’entrée du tour.

Précondition : cette entrée atteint `SituationReading`. Une pièce reconnue, déjà traitée par `DocumentProposal` avant le gate, ne produit pas de contexte. L’ordre de route ne change pas.

Quand la lecture a lieu : `attachments.fileIds` contient cet id, `contentRead` est faux. L’écran dit que le contenu du fichier n’est pas utilisé pour ce contexte. L’événement peut être `quote_received` à cause de `reçu` et de `devis`. Le PDF n’est pas lu. Sans entrée de dépôt, `fileIds` reste vide.

### S11 — échec Ollama

Contexte partiel de la section 14. Dossier, événement lexical, documents lexicaux, fichiers. Entités, quantités, montants, relations et issues vides. Aucune écriture. Aucun second appel.

### S12 — hors gate

`ClimPro intervient mardi sur le chantier Dupont`.

Le gate refuse la phrase parce qu’elle n’a ni réception commerciale ni objet commercial requis. Aucun `BusinessContext`. Le tour suit les règles antérieures à LOT-V3-008. La frontière de ce lot est : seulement les tours qui produisent déjà une `SituationReading`.

### S13 — erreur de famille du modèle

Indice Ollama : `client / ClimPro`. Base : seulement `Supplier ClimPro`.

Attendu : recherche dans les trois tables, résolution `supplier`, `modelHints` `["client"]`, `conflict` vrai, issue `role_conflict`, `view` `actor`. Aucune écriture.

### S14 — ambiguïté inter-familles

Indice Ollama : `product / Atlas`. Base : `Supplier Atlas` et `Product Atlas`.

Attendu : les deux candidats, `scope` `cross_family`, aucun `entityId` choisi, issue `cross_family_ambiguity`, `view` `null`. L’indice `product` est conservé et ne départage pas. Atlas n’est pas une cible de lien.

### S15 — homonymes de la même famille

Deux lignes `Supplier Dupont` passées à la fonction pure. La mention cite `Dupont`.

Attendu : `scope` `same_family`, deux candidats, aucun id choisi, issue `duplicate_name`, `view` `actor`. Défense de domaine seulement. La base réelle refuse ce doublon par `nameKey @unique`.

### S16 — mention inconnue avec indice

Indice Ollama : `supplier / Thermix`. Aucune fiche Thermix dans les trois tables.

Attendu : mention, ancres et indice `supplier` conservés, `unresolved`, `view` `actor`, issue `unknown_entity`. L’écran dit qu’aucune fiche de ce nom n’existe. Aucun id. Aucune création.

### S17 — mention omise

Phrase de S4. Le modèle rend `2`, `MSZ-AP35` et `5 500 € HT`, et omet `MSZ-AP25` ainsi que `3`.

Attendu : aucune relation entre `2` et `MSZ-AP35`. L’intervalle contient des chiffres et le mot `et`. Aucun lien n’est déduit à travers la zone manquante.

### S18 — valeur répétée

`2 MSZ-AP25 à 900 € et 2 MSZ-AP35 à 900 €`.

Les deux `2` et les deux `900 €` ne sont pas des ancres de relation. Issue `repeated_anchor`. Aucune relation. `MSZ-AP25` et `MSZ-AP35` restent des entités si chacun n’apparaît qu’une fois.

### S19 — quantité après le produit

`MSZ-AP25 : 5 unités`.

Le `:` bloque l’intervalle. Aucune relation. Issue `unlinked_quantity` si la quantité est une ancre admissible. Le produit reste une entité s’il est résolu. La quantité peut se lier à un produit qui la précède quand l’intervalle est admissible : `MSZ-AP25 pour 5 unités` est ce cas.

### S20 — montant avant le produit

`900 € le MSZ-AP25`.

La région gauche ne contient pas d’item. La région droite en contient un. L’intervalle ` le ` est admissible. Relation `amount_for_item`. Le texte reste `900 €`. Aucun prix unitaire n’est déduit.

### S21 — mention ambiguë entre la valeur et la cible

`4 unités Atlas et MSZ-AP25`. Atlas est `cross_family`.

La quantité ne saute pas Atlas pour atteindre `MSZ-AP25`. L’ancre d’Atlas est dans l’intervalle, et le mot `et` aussi. Issue `unlinked_quantity`. Atlas a `view` `null`.

### S22 — indice supplier, seule fiche Product

Ollama : `supplier / Atlas`. Base : seulement `Product Atlas`.

Attendu : recherche dans les trois tables, résolution famille `product`, `view` `item`, `conflict` vrai, issue `role_conflict`. La vue suit la fiche. L’indice ne choisit pas la famille.

### S23 — mention égale au dossier

Project déjà présent dans `projectContext` : `Climatisation Dupont`. Ollama rend aussi `client / Climatisation Dupont`.

Attendu : cette mention n’est pas une entité. Pas d’acteur inconnu en double du dossier. `projectContext` reste la seule représentation de ce nom. Aucun rematch des dossiers.

## 16. Risques

- Surinterprétation : un second modèle inventerait des liens. Ce lot s’en passe. Un indice faux ne limite plus les tables. Le cas d’une seule fiche contradictoire reste visible par `conflict` et `role_conflict`.
- Classement prématuré : une ambiguïté `cross_family` avec `view` non nul ferait comme si la famille était tranchée. Le contrat l’interdit. Une vue `unresolved` reste une mention du modèle, avec `aucune fiche de ce nom`.
- Mauvaise association quantité / montant : l’intervalle admissible et le segment local laissent le texte non lié plutôt que de choisir le dernier produit ou de traverser une mention omise.
- Ancre héritée : la première occurrence de LOT-V3-008 reste affichable. Seule une ancre unique et sans chevauchement porte une relation.
- Faux rattachement d’acteur : l’égalité `nameKey`, l’absence de choix en cas d’homonyme, et l’écart des noms déjà portés par `projectContext` limitent le risque. Le trait d’union des dossiers reste ouvert.
- Homonymes : un id choisi serait une décision. Le contrat l’interdit. Le schéma les empêche déjà dans une même table.
- Duplication avec `SituationReading` : la lecture reste la source des extraits. Le texte de réponse ne la remplace pas. Le bloc de contexte ne stocke pas une seconde résolution.
- Dette de `route.ts` : une fonction pure et un appel. Les règles ne s’écrivent pas dans la route. Les lignes métier sont lues une fois.
- Surcharge Ollama et latence : aucun appel ajouté. L’échec reste celui de la lecture, au plus 20 secondes, déjà borné.
- JSON polymorphe : deux clés, `situation` et `businessContext`, sans `fields`. Un lecteur qui exige `fields` ignore le contexte.
- UI trop certaine : pas de score, pas de total, conflit affiché comme indice du modèle, fichiers marqués non utilisés pour ce contexte, événement présenté comme lecture des mots.
- Futur `ActionProposal` : il devra refuser `ambiguous`, `unresolved`, `conflict`, `cross_family_ambiguity`, `duplicate_name` et `model_hint_ambiguity` comme cibles d’écriture. Il ne tiendra pas `event` pour une preuve. Il ne réutilisera pas un `projectId` tant que le trait d’union n’est pas corrigé.
- Généralisation hors devis et offres : elle demanderait un autre gate. Ce lot ne l’ouvre pas.
- Huit mentions : une situation plus riche peut être rejetée en bloc et produire le contexte partiel.

## 17. Fichiers probablement impactés

- `src/domain/business-context.ts` (nouveau, pur) ;
- `src/app/api/assistant/route.ts` (appel après la lecture, sélection unique de `id` et de `Product.kind`) ;
- `src/lib/conversations.ts` et `src/lib/assistant-stream.ts` (clé `businessContext`) ;
- `src/components/assistant-chat.tsx` (bloc sans bouton) ;
- `tests/business-context.test.ts` ;
- `package.json` (le script `test` énumère les fichiers) ;
- `docs/manuel-utilisateur.md` ;
- `docs/technique/docs/orchestration.md` (une phrase : le contexte suit la lecture, sans second modèle).

Restent inchangés :

- `src/domain/situation-reading.ts`, y compris `situationModelGuide()` ;
- `src/lib/situation-reading-read.ts` ;
- `src/domain/structured-plan.ts` ;
- `src/domain/pricing.ts` ;
- `linkConversation` ;
- le schéma Prisma et les migrations.

`business-context.ts` n’importe ni `pricing`, ni un module de `src/lib`.

## 18. Stratégie de tests

Tests de domaine, sans base et sans Ollama, pour S1 à S23. Chaque mention `client`, `supplier` ou `product` est confrontée aux trois tables, sur les mêmes lignes que la projection `knownEntities`. S13 vérifie qu’un indice `client` trouve quand même le fournisseur et garde le conflit. S14 vérifie qu’Atlas fournisseur et produit ne reçoit pas de vue. S15 vérifie deux fournisseurs sans id, comme défense de domaine. S3 vérifie qu’un produit inconnu garde `view` `item`, avec quantité et montant liés lorsque les ancres sont admissibles. S16 vérifie que Thermix reste un acteur mentionné non résolu, sans id. S17 à S21 vérifient l’omission, la répétition, le deux-points, le montant avant l’item, et l’interdiction de sauter une mention ambiguë. S22 vérifie l’indice `supplier` face à une seule fiche produit. S23 vérifie l’écart du nom déjà porté par `projectContext`.

`projectContext` du contexte est le même objet de valeur que celui de la lecture, pour les quatre états. Tout texte de quantité ou de montant est une tranche exacte. Aucun nombre du contexte, hors `start` et `end`, n’est un montant calculé.

Persistance : un JSON dont les clés racine sont exactement `situation` et `businessContext` donne `readStoredProposalCard` `null`, `cardMayAct` faux, `readUnderstanding` `null`, `readPacket` `null`. `readStoredBusinessContext` rend le contexte, et `null` sans situation valide à côté.

Non-régression : le gate, StructuredPlan, la fiche déterministe, l’ordre de route et `situationModelGuide()` restent ceux de LOT-V3-008. `situationReply` n’est pas enrichi.

Tests de source :

- `answerFromSituation` contient un seul appel `readSituationMentions` ;
- ce corps ne contient ni `chatWithOllama`, ni `streamModel`, ni `modelInterpretation` ;
- ce corps ne lit pas `prisma.conversation` ;
- `business-context.ts` n’importe ni `pricing` ni `src/lib` ;
- le texte de `situationModelGuide()` est celui de la baseline.

Mutations à faire échouer :

- filtrer les tables par l’indice ;
- prendre le premier candidat ;
- lier le montant de S4 ;
- donner une vue à une mention `cross_family` ;
- accepter une ancre répétée comme relation.

Le bloc d’écran ne contient ni bouton ni carte de proposition.

## 19. Critères d’acceptation

- S1 à S11 et S13 à S23 produisent le contexte décrit, sans écriture ;
- S12 ne produit pas de contexte ;
- S10 n’est exigé que si l’entrée atteint la lecture ;
- S15 n’est pas une recette PostgreSQL ;
- toute mention `client`, `supplier` ou `product` est cherchée dans les trois tables ;
- l’indice du modèle ne retire aucune table et reste lisible comme indice ;
- une mention `unresolved` d’indice unique `product` a `view` `item` ;
- une mention `unresolved` d’indice unique `client` ou `supplier` a `view` `actor` ;
- un produit inconnu peut garder une relation de quantité et de montant ;
- un acteur inconnu reste visible comme mention du modèle, avec `aucune fiche de ce nom` ;
- une ambiguïté `cross_family` a `view` `null` et ne reçoit ni quantité ni montant ;
- une quantité ne saute pas une ancre placée entre elle et un item ;
- un montant dont la région gauche contient deux items n’est pas lié ;
- une ancre répétée ou chevauchante ne produit pas de relation ;
- deux indices sur la même ancre ne fondent pas une vue hypothétique ;
- aucun `entityId` n’est inventé pour une mention inconnue ou ambiguë ;
- `conflict` n’apparaît que sur `resolved` ;
- le JSON ne contient qu’une liste `entities`, des `relations`, et pas de copies `actors` ou `items` ;
- aucun second appel Ollama ;
- le modèle ne reçoit ni listes de fiches, ni dossiers, ni PDF, ni `start`, ni `end` ;
- `situationModelGuide()` est inchangé ;
- `projectContext` est recopié, et `Conversation.projectId` n’est pas lu ;
- `ambiguous` ne contient pas d’`entityId` choisi ;
- un conflit montre l’indice du modèle et la fiche, avec `role_conflict` ;
- chaque issue a une `BusinessIssueReason` ;
- un montant non unique n’est pas réparti ;
- `pricing.ts` n’est pas utilisé ;
- la racine JSON est exactement `situation` et `businessContext`, sans `fields` ;
- les quatre lecteurs de carte, de compréhension et de paquet restent vides sur ce JSON ;
- le bloc n’a aucun bouton ;
- panne Ollama : dossier, événement, documents et fichiers présents ; entités, quantités, montants, relations et issues vides ;
- `npm test`, typecheck et lint verts, sans migration.

## 20. Arbitrages retenus

Ces points sont fermés pour l’implémentation :

- aucun second appel Ollama ;
- pas de `confidence` ;
- pas de résolution `prospect` ou `partner` ;
- l’indice du modèle reste visible lorsqu’il contredit la fiche unique ; aucune règle serveur ne lit un rôle dans la phrase ;
- le `kind` Ollama ne limite pas les tables interrogées ;
- une ambiguïté entre familles a `view` `null` ;
- en l’absence de toute fiche, un indice unique ouvre seulement une vue hypothétique, sans id et sans création ;
- les ancres `start` et `end` viennent du serveur ;
- une relation n’utilise qu’une ancre unique, non chevauchante, à intervalle admissible ;
- le segment local empêche de lier le montant unique de deux items ;
- aucune répartition d’un montant ambigu ;
- les incertitudes portent un code `BusinessIssueReason` ;
- clé JSON `businessContext`, sœur de `situation` ;
- une seule liste `entities`, relations séparées, `conflict` seulement sur `resolved` ;
- aucun `fields`, aucun bouton d’action ;
- `situationReply` inchangé ;
- contenu de fichier non utilisé pour ce contexte ;
- défaut `Dupont-Martin` non corrigé dans ce lot ;
- S12 reste hors gate ;
- limite de 8 mentions inchangée ;
- aucune migration ;
- aucune écriture métier.

CONCEPTION LOT-V3-009 CORRIGEE APRES REVUE CLAUDE
