# Modélisation des données

PostgreSQL conserve toutes les informations métier. Le schéma de référence est `prisma/schema.prisma`. Les identifiants sont des `cuid`, sauf les deux lignes de réglage dont l’identifiant est `local`. Les montants écrits sur une pièce ou un article restent des chaînes. Les centimes des lignes de dossier et de pièce de vente viennent de `src/domain/pricing.ts`.

Cette page liste chaque modèle, ses champs utiles, ses liens et ce que l’application calcule sans le stocker.

## Carte

```
Client 1 ── * Project
Organization 1 ── 0..1 Client
Organization 1 ── 0..1 Supplier
Client 1 ── * Contact
Client 1 ── * Address
Supplier 1 ── * Contact
Supplier 1 ── * Address
Supplier 1 ── * Product
Product 1 ── * QuoteLine
Product 1 ── * ProjectLine
Product 1 ── * SupplierOffer * ── 0..1 Supplier
SupplierOffer * ── 0..1 StoredFile
Project 1 ── * ProjectStep
Project 1 ── * ProjectEvent
Project 1 ── * ProjectLine
Project 1 ── * SaleDocument 1 ── * SaleDocumentLine
Project 1 ── * Quote 1 ── * QuoteLine
Project 1 ── * Conversation 1 ── * ConversationMessage
Conversation 1 ── 0..1 AssistantTask
InboxItem 1 ── * StoredFile
StoredFile 1 ── * Quote
StoredFile 1 ── * DocumentProposal
StoredFile 1 ── * Demand

Sans clé étrangère : AppSetting, CompanyProfile, DocumentMemory,
CatalogProposal, ClientProposal, RecordEvent, KnowledgeChunk
```

Une suppression en cascade retire les enfants. Un lien `SetNull` laisse la fiche et vide la référence : client d’un projet, fournisseur d’un produit, pièce d’un devis reçu, projet d’un devis reçu ou d’une conversation, produit d’une ligne de dossier, fichier d’une demande. Supprimer un produit retire ses `QuoteLine`. Supprimer un fichier retire ses `DocumentProposal`. Supprimer une boîte retire ses `StoredFile`.

## Réglages

### AppSetting

Une seule ligne, `id` = `local`.

- `serverUrl`, `apiKey`, `chatModel`, `embedModel`, `rerankModel` : adresse et modèles Ollama du poste.
- `updatedAt`.

### CompanyProfile

Une seule ligne, `id` = `local`. En-tête des pièces.

- `legalName`, `address`, `postalCode`, `city`, `country`, `email`, `phone`, `siren`, `vatNumber`.
- `logoPath`, `logoMime` : fichier du logo, servi par `GET /api/entreprise/logo`.
- `updatedAt`.

## Répertoire

Le contact principal d’un client reste recopié dans `contactName`, `contactRole`, `email` et `phone`. Les autres personnes sont des `Contact`. L’adresse du siège reste dans `address`, `postalCode`, `city` et `country`. Les autres lieux sont des `Address`. Un client et un fournisseur du même nom partagent une `Organization`. Les deux fiches restent distinctes.

### Organization

Tiers unique, identifié par `nameKey`.

- `name` reprend le nom de la fiche rattachée.
- Au plus un `Client` et un `Supplier`. Retirer une fiche laisse l’autre. Si plus aucune fiche n’est rattachée, l’organisation est retirée.
- `createdAt`.

### Client

`nameKey` est unique. `name` est le libellé affiché.

- `kind` : `particulier`, `entreprise`, ou vide.
- Identité : `civility`, `tradeName`, `legalForm`, `country`, `postalCode`, `city`, `address`.
- Immatriculation : `siren`, `siret`, `vatNumber`.
- Interlocuteur : `contactName`, `contactRole`, `email`, `phone`.
- `notes`, `reference`, `sector`, `currency`.
- `createdAt`, `updatedAt`.
- Lien : un client a plusieurs `Project`, plusieurs `Contact` et plusieurs `Address`. Retirer le client vide `Project.clientId` et retire ses contacts et ses adresses.

### Supplier

`nameKey` est unique.

- `name`, `siren`, `siret`, `vatNumber`, `legalForm`, `country`, `postalCode`, `city`, `email`, `phone`, `address`, `notes`.
- `createdAt`, `updatedAt`.
- Lien : un fournisseur a plusieurs `Product`, plusieurs `Contact` et plusieurs `Address`. Retirer le fournisseur vide `Product.supplierId` et retire ses contacts et ses adresses.

### Contact

Personne rattachée à un client ou à un fournisseur, pas aux deux.

- `clientId` ou `supplierId`. La suppression de la fiche retire ses contacts.
- `firstName`, `lastName`, `role`, `email`, `phone`.
- `isPrimary` : le contact recopié sur la fiche. Les autres restent à `false`.
- `createdAt`.

### Address

Lieu rattaché à un client ou à un fournisseur, pas aux deux. L’adresse de livraison d’un dossier reste sur `Project`.

- `clientId` ou `supplierId`. La suppression de la fiche retire ses adresses.
- `kind` : `siege`, `facturation`, `livraison` ou `autre`.
- `line`, `postalCode`, `city`, `country`.
- `isPrimary` : le siège recopié sur la fiche. Une adresse ajoutée ensuite reste à `false`.
- `createdAt`.

### Product

Article produit ou service. `nameKey` est unique. Le catalogue est unique : une ligne de dossier pointe vers un produit, elle n’en crée pas un second.

- `name`, `reference`, `unit` (défaut `u`), `description`.
- `kind` : `produit` ou `service`.
- `source` : origine de la fiche. Valeurs écrites par l’application : `manuel`, `assistant`, `devis`, `fiche`, ou le type de la pièce d’origine.
- `statedPrice`, `currency`, `vatNote`, `costStated` : textes saisis. `costStated` reprend le prix écrit de la dernière `SupplierOffer`. Le modèle ne les recalcule pas.
- `stockQty` : entier facultatif.
- `sourceNote` : note d’origine, au plus 500 caractères à la validation.
- `sourceUrl` : lien `http` ou `https` du fournisseur, au plus 500 caractères. Vide si aucune adresse.
- `supplierId` vers `Supplier`.
- `createdAt`, `updatedAt`.
- Liens : plusieurs `QuoteLine` (suppression du produit en cascade) et plusieurs `ProjectLine` (la ligne de dossier reste, le produit est vidé).

Le document source d’un article n’est pas une colonne. Il se lit par `QuoteLine` → `Quote.fileId` → `StoredFile`, ou par `SupplierOffer.sourceFileId`, servi par `GET /api/pieces/[id]`. Sans devis reçu, la fiche montre `sourceNote` ou `sourceUrl`.

### SupplierOffer

Offre d’un fournisseur pour un produit. Un produit en a plusieurs. Deux prix du même fournisseur restent deux lignes.

- `productId` vers `Product`, suppression du produit en cascade.
- `supplierId` vers `Supplier`, vide si le fournisseur disparaît. `supplierName` garde le nom au moment de l’offre.
- `supplierReference`.
- `statedCost` : prix écrit, preuve. `unitCostCents` : ce même montant en centimes quand la lecture est sans ambiguïté, sinon vide. Les lignes ne sont pas additionnées.
- `currency`, `sourceUrl`.
- `sourceFileId` vers `StoredFile`.
- `createdAt` : date de l’offre. Il n’y a pas de durée de validité en colonne.

La fiche produit continue d’exposer le dernier coût pour les dossiers déjà branchés sur `Product.costStated`. La comparaison se fait sur les offres.

## Dossier

### Project

- `name`, `primaryClient`, `nextAction`, `purpose`, `reference`, `sector`.
- `status` : texte libre, défaut `À qualifier`. Ce n’est pas une liste fermée en base.
- `currency` défaut `EUR`, `budgetStated` texte, `lead`.
- `clientId` vers `Client`.
- `tradeKey` défaut `achat-revente-technologies`.
- Livraison, toutes en texte : `deliveryRecipient`, `deliveryAddress`, `deliveryPostalCode`, `deliveryCity`, `deliveryCountry`, `deliveryContact`, `deliveryPhone`, `deliverySlot`, `deliveryMode`, `deliveryNote`.
- `createdAt`.
- Enfants : `ProjectEvent`, `Quote`, `Conversation`, `ProjectLine`, `SaleDocument`, `ProjectStep`.

### ProjectStep

Une ligne par étape et par projet. Couple unique `(projectId, stepKey)`.

- `stepKey` : `demande`, `offre`, `engagement`, `confirmation`, `preparation`, `expedition`, `livraison`, `reception`, `facturation`. L’ordre et les preuves sont dans `src/domain/trade-workflow.ts`.
- `status` : `a_faire`, `en_cours`, `fait`. Défaut `a_faire`.
- `proofRef`, `proofNote`, `recordedAt`.
- L’application exige une référence d’au moins deux caractères pour passer à `fait`. La base ne porte pas cette règle.
- Une étape `fait` n’est pas un bon de livraison numéroté.

### ProjectEvent

Actualité du dossier. Distincte de `RecordEvent`.

- `kind`, `body`.
- `fileId` : identifiant de fichier en texte, sans clé étrangère.
- `createdAt`.
- Suppression du projet en cascade.

### ProjectLine

Ligne chiffrée du dossier.

- `productId` facultatif vers `Product`.
- `kind` défaut `produit`, `name`, `supplierName`.
- `quantity` entier, défaut 1.
- `costCents` entier facultatif. Absent, le prix de vente reste « non indiqué ».
- `markupPercent` défaut 30, `discountPercent` défaut 0, entiers de 0 à 99 à l’écran.
- `confirmedAt` quand les chiffres sont confirmés.
- `createdAt`, `updatedAt`.
- Suppression du projet en cascade.

Le prix de vente et la marge sont calculés à la lecture par `quoteFromTargetMarkup`. Ils ne sont pas des colonnes.

## Pièces de vente du dossier

### SaleDocument

Pièce établie dans le dossier. Suppression du projet en cascade.

- `kind` : `devis`, `commande_client`, `commande_fournisseur`.
- `status` : `en_cours`, `brouillon`, `non_abouti`, `transforme`. Défaut `en_cours`.
- `title`, `supplierName`, `sourceId` (texte recopié), `confirmedAt`.
- `parentId` vers un autre `SaleDocument`. La suppression du parent vide le lien. Un devis n’a pas de parent. Une commande client a pour parent un devis. Une commande fournisseur a pour parent une commande client. Aucune facture n’est créée ni numérotée.
- Enfants `NotedPiece` : une livraison, une facture ou un avoir rattaché, sans devenir une pièce de vente.
- `createdAt`, `updatedAt`.
- Enfants : `SaleDocumentLine`.

Aucune colonne de numéro. L’écran `/projets/[id]/facture` réimprime la dernière commande client et la référence de preuve de l’étape Facturation. Il n’écrit ni facture ni numéro.

### SaleDocumentLine

- `kind` défaut `produit`, `name`, `supplierName`.
- `quantity` entier, défaut 1.
- `costCents`, `saleUnitCents` : entiers facultatifs, en centimes.
- `markupPercent` défaut 30, `discountPercent` défaut 0.
- `createdAt`.
- Suppression du document en cascade.

### NotedPiece

Pièce constatée, rattachée à une commande ou à une autre pièce constatée. Ce n’est pas une facture émise.

- `kind` : `livraison`, `facture`, `avoir`.
- `reference` : texte recopié sur la pièce. L’application ne l’invente pas et n’attribue pas de numéro.
- `projectId` vers `Project`.
- `saleParentId` vers `SaleDocument`, pour une livraison ou une facture rattachée à une commande client ou fournisseur.
- `pieceParentId` vers une autre `NotedPiece`. Une facture peut suivre une livraison. Un avoir suit une facture.
- Une seule parente : soit la commande, soit la pièce constatée.
- `createdAt`.
- La suppression du dossier, de la commande ou de la pièce parente emporte les pièces rattachées.

## Fichiers et lectures

### InboxItem

Note déposée dans la boîte.

- `body`, `createdAt`.
- Enfants : `StoredFile`, supprimés avec la note.
- Une note n’est pas classée dans un projet sans une action explicite.

### StoredFile

Fichier reçu. Le binaire est sur le disque, chemin `storagePath`, sous `data/pieces`.

- `inboxItemId` facultatif vers `InboxItem`.
- `originalName`, `mimeType`, `sizeBytes`.
- `extractedText` : texte lu, vide si la lecture n’a rien donné.
- `kind` : `rfq`, `devis`, `commande`, `facture`, `tarif`, `avoir`, `livraison`, `contrat`, `fiche`, `document`, `autre`. Défaut `autre`. Le mot `facture` qualifie une pièce lue. Il ne crée pas une facture émise.
- `enrichment`, `contentHash`.
- `createdAt`.
- Liens : `Quote` (la pièce reste, le lien est vidé), `DocumentProposal` (cascade), `Demand` (lien vidé).

### Demand

Demande ouverte à partir d’une pièce.

- `title`, `reference`, `clientName`, `supplierName`.
- `status` défaut `ouverte`. L’application écrit aussi `offre reçue`.
- `fileId` vers `StoredFile`.
- `createdAt`, `updatedAt`.

### Quote

Devis ou offre reçue, pas une pièce de vente du dossier. Les totaux sont recopiés tels qu’ils sont écrits.

- `title`, `issuedOn`, `supplierName`, `versionLabel`.
- `fingerprint` unique et facultatif, pour reconnaître la même offre.
- `fileId` vers `StoredFile`, `projectId` vers `Project`.
- `clientName`, `currency`, `vatZone`, `vatMention`.
- `statedTotalHt`, `statedVat`, `statedTotalTtc`, `conditions` : textes recopiés.
- `statedTotalHtCents`, `statedVatCents`, `statedTotalTtcCents` : le premier montant de chaque texte, en centimes entiers. Un texte sans montant laisse la colonne vide. Ces entiers ne sont pas une somme des lignes.
- La confirmation d’un devis ou d’un tarif recopie ces textes depuis la pièce. `vatZone` reste vide : la zone n’est pas déduite. Un total absent reste vide. Les lignes ne sont pas additionnées.
- `createdAt`.
- Enfants : `QuoteLine`.

### QuoteLine

- `quoteId` vers `Quote`, `productId` vers `Product`. Les deux suppressions sont en cascade.
- `statedPrice`, `conditions`, `quantity` : textes.
- `statedPriceCents` : le premier montant de `statedPrice`, en centimes. Vide si le texte n’a pas de montant.

## Propositions

Tant que le statut est `en_attente`, rien n’est écrit dans le répertoire ni dans le dossier. Les outils du modèle sont en lecture seule.

### DocumentProposal

Proposition tirée d’un fichier.

- `status` : `en_attente`, `confirmee`, `ecartee`. Défaut `en_attente`.
- `fileId` vers `StoredFile`.
- `kind`, `title`, `summary`.
- `payload` : brouillon `DocumentProposalDraft` (`kind`, `title`, `summary`, `fields`, `actions`, `sources`).
- `modelVersion` : `lecture` pour une pièce relue sans modèle.
- `confidence` : un nombre entre 0 et 1 par champ recopié. Un champ vide n’a pas de score. Les montants ne sont pas additionnés.
- `validatedAt` : date de la confirmation ou du rejet. Tant qu’elle est vide, rien n’est écrit.
- `createdAt`.

### CatalogProposal

Commande de catalogue encore à confirmer.

- `status` : `en_attente`, `remplacee`, `confirmee`, `rejetee`.
- `payload` : `CatalogCommand` (`create_client`, `update_client`, `create_supplier`, `update_supplier`, `create_product`, `update_product`, `create_project`, `record_quote`).
- `modelVersion` : `regle`. `confidence` et `validatedAt` comme sur `DocumentProposal`.
- `createdAt`.

### ClientProposal

Fiche client encore à confirmer.

- `status` : `en_attente`, `remplacee`, `confirmee`.
- `payload` : `ClientDraft` (mode `create` ou `update`, `kind`, `scope`, identité, adresse, immatriculation, contact, `notes`, `missing`).
- `modelVersion` : `regle`. `confidence` et `validatedAt` comme sur `DocumentProposal`.
- `createdAt`.

## Assistant

### Conversation

Fil de discussion.

- `title`, `projectId` vers `Project` (lien vidé si le projet disparaît).
- `createdAt`, `updatedAt`.
- Enfants : `ConversationMessage`. Au plus une `AssistantTask`.

### ConversationMessage

- `role` : `user` ou `assistant`.
- `content`, `source` (origine de la réponse : règle, dossier, action, proposition, Ollama).
- `steps` : liste de textes du parcours, JSON.
- `proposal` : champs `{ label, value }` et, le cas échéant, la carte de compréhension.
- `sources` : liste `{ label, title }`.
- `modelVersion` : `saisie` pour l’utilisateur, le nom du modèle pour une réponse Ollama, `regle` pour une réponse déjà reconnue.
- `confidence` : champs de la proposition, entre 0 et 1. Vide s’il n’y a pas de proposition.
- `validatedAt` reste vide : la validation d’une écriture est celle de la proposition, pas celle du message.
- `createdAt`.

### AssistantTask

Une tâche par fil. `conversationId` est unique. Suppression de la conversation en cascade.

- `payload` : `StoredTask`.
- `intent`, `action`, `request`, `field`, `question`, `proposed`.
- `status` dans le JSON : `suspendue` ou `prete`.
- `steps` : `intention`, `champs`, `simulation`, `ecriture`. L’écriture reste `en_attente` dans ce parcours.
- `overrides` : `projet`, `type`, `societe`.
- `valeurs`, `attachments`, `view`.
- `updatedAt` sur la ligne.

### DocumentMemory

Correction retenue pour un nom de fichier, jamais pour une règle du répertoire.

- `documentKey` unique : le nom du fichier seul, sans dossier.
- `projet`, `type`, `societe`.
- `updatedAt`.
- Une autre pièce ne reçoit pas ces valeurs.

## Recherche et journal

### KnowledgeChunk

Index de recherche dans PostgreSQL. Une ligne par source. Couple unique `(sourceType, sourceId)`.

- `sourceType` : `client`, `supplier`, `product`, `project`, `quote`, `piece`, `demand`, `inbox`.
- `title`, `summary`, `body`, `contentHash`.
- `embedding` : tableau de nombres, JSON, modèle d’embedding configuré (bge-m3 par défaut côté Ollama).
- `updatedAt`.
- Pas de seconde base vectorielle.

### RecordEvent

Journal des créations, mises à jour et suppressions de `Client`, `Supplier`, `Product` et `Project`. Pas de clé étrangère : la ligne reste si la fiche est supprimée.

- `entityType` : `client`, `supplier`, `product`, `project`.
- `entityId`, `entityName`.
- `action` : `création`, `mise à jour`, `suppression`.
- `summary` : champs changés, forme `ancien → nouveau`. Une mise à jour sans différence n’écrit pas de ligne.
- `source` : `assistant`, `formulaire`, ou `application`.
- `actor` défaut `J Smith`.
- `createdAt`.

## Fichiers hors tables

- `data/pieces` : binaires des `StoredFile`.
- `data/entreprise` : logo de `CompanyProfile`.
- `data/docling` : modèles de lecture de mise en page. Ce ne sont pas des fiches métier.

## Pièce lue par l’assistant

`readOfferFile` qualifie `StoredFile.kind`. Confirmer une `DocumentProposal` écrit seulement les tables de ce type. Cette confirmation ne crée pas de `SaleDocument`, ne remplit pas `Project`, et n’attribue pas de numéro.

- `autre` : le fichier seul. Aucune proposition.
- `rfq` : `Demand` au statut `ouverte`, plus le client ou le fournisseur s’ils manquent au répertoire.
- `devis` et `tarif` : `Quote` et `QuoteLine`. L’article reçoit `costStated`, `currency` et `source` (`devis` ou `tarif`). La quantité écrite va dans `QuoteLine.quantity`. Une `Demand` du même fournisseur passe à `offre reçue`.
- `fiche` : `Product` si la référence manque, `source` `fiche`. Aucun prix n’est inventé.
- `commande`, `facture`, `avoir`, `livraison`, `contrat` et `document` : un `Product` manquant, `source` égal au type, `costStated` égal au prix écrit sur la ligne. Pas de `Quote`. Le total imprimé reste dans `StoredFile.enrichment` et dans le texte extrait. Une facture lue ou un avoir lu ne devient pas un titre émis.

Les faits de page et de zone affichés dans le fil sont calculés à la lecture. Ils ne sont pas enregistrés.

## Avancement du lot

9 sur 9, soit 100 %.

| Point | État |
| --- | --- |
| Offre fournisseur distincte du produit | Fait |
| Identité du fournisseur alignée sur le client | Fait |
| Plusieurs interlocuteurs | Fait |
| Plusieurs adresses | Fait |
| Centimes à côté du texte, sans addition | Fait |
| Organisation unique, client et fournisseur | Fait |
| Pièce commerciale reliée à sa parente, sans numéro de facture | Fait |
| Comparaison de l’historique de prix | Fait |
| Confiance, version du modèle et validation | Fait |

## Cible encore non construite

La livraison, la facture et l’avoir se rattachent par `NotedPiece`. L’application n’émet toujours pas de facture et n’attribue pas de numéro. Les points qui suivent ne sont pas encore des tables.

Priorité haute, pas encore faites :

- Validité de trente jours d’une offre fournisseur.
- Contrôle des doublons de contacts et d’adresses.
- Rôles et notifications.

À terme, trois couches restent séparées. La vérité métier est confirmée. La preuve est le fichier et le texte extrait. L’interprétation de l’assistant est une proposition, jamais une fiche implicite.

## Informations calculées, absentes des tables

- Les faits de page et de zone (`readDocumentFacts` dans `src/domain/document-facts.ts`) sont produits à la lecture du texte extrait. Aucune table ne les conserve. Le message de l’utilisateur n’est pas un argument de cette lecture.
- Le prix de vente, la marge et les totaux de dossier sont calculés par `src/domain/pricing.ts` à partir des centimes déjà stockés.
- L’application n’attribue pas de numéro de facture ni d’avoir. Une `NotedPiece` recopie la référence déjà écrite. Elle n’enregistre pas de relevé bancaire.
- La validité de trente jours d’une offre fournisseur, les rôles et les notifications ne sont pas des tables. L’historique de prix est la suite des `SupplierOffer`. `Quote.versionLabel` et `Quote.fingerprint` identifient une offre reçue, sans durée de validité en colonne.
