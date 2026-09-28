# Modélisation des données

PostgreSQL conserve toutes les informations métier. Le schéma de référence est `prisma/schema.prisma`. Les identifiants sont des `cuid`, sauf les deux lignes de réglage dont l’identifiant est `local`. Les montants écrits sur une pièce ou un article restent des chaînes. Les centimes des lignes de dossier et de pièce de vente viennent de `src/domain/pricing.ts`.

Cette page liste chaque modèle, ses champs utiles, ses liens et ce que l’application calcule sans le stocker. L’architecture est le [DAT](dat.md). La conception est le [DCT](dct.md).

## Carte

```
Client 1 ── * Project
Client 1 ── * Contract
Client 1 ── * Intervention
Client 1 ── * InstalledEquipment
Product 1 ── * InstalledEquipment
Client 1 ── * Claim
Client 1 ── * ReturnRequest
Project 1 ── * Intervention
Organization 1 ── 0..1 Client
Organization 1 ── 0..1 Supplier
Client 1 ── * Contact
Client 1 ── * Address
Supplier 1 ── * Contact
Supplier 1 ── * Address
Supplier 1 ── * Product
Supplier 1 ── * PurchaseFollowUp
Project 1 ── * PurchaseFollowUp
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

Sans clé étrangère : Account, AppSetting, CompanyProfile, DocumentMemory,
CatalogProposal, ClientProposal, ContractProposal, InterventionProposal, InstalledEquipmentProposal, PurchaseFollowUpProposal, SupplierTermsProposal, ClaimProposal, ReturnRequestProposal, RecordEvent, KnowledgeChunk
```

Une suppression en cascade retire les enfants. Un lien `SetNull` laisse la fiche et vide la référence : client d’un projet, fournisseur d’un produit, pièce d’un devis reçu, projet d’un devis reçu ou d’une conversation, produit d’une ligne de dossier, produit d’un équipement installé, dossier d’un achat, fichier d’une demande. Supprimer un produit retire ses `QuoteLine`. Supprimer un fichier retire ses `DocumentProposal`. Supprimer une boîte retire ses `StoredFile`.

## Réglages

### AppSetting

Une seule ligne, `id` = `local`.

- `serverUrl`, `apiKey`, `chatModel`, `embedModel`, `rerankModel` : adresse et modèles Ollama du poste.
- `updatedAt`.

### Account

Compte d’accès. Le parcours de connexion, le cookie et le compte de développement sont dans le [DCT](dct.md).

- `email` unique, en minuscules.
- `firstName`, `lastName`. La marque affichée est l’initiale du prénom et le nom.
- `role` : `admin` ou `utilisateur`. Défaut `utilisateur`.
- `passwordHash` : empreinte scrypt.
- `createdAt`.

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
- Lien : un client a plusieurs `Project`, plusieurs `Contact`, plusieurs `Address`, plusieurs `Contract`, plusieurs `Intervention`, plusieurs `InstalledEquipment`, plusieurs `Claim` et plusieurs `ReturnRequest`. Retirer le client vide `Project.clientId` et retire ses contacts, ses adresses, ses contrats, ses interventions, ses équipements, ses réclamations et ses retours.

### Supplier

`nameKey` est unique.

- `name`, `siren`, `siret`, `vatNumber`, `legalForm`, `country`, `postalCode`, `city`, `email`, `phone`, `address`, `notes`.
- `outstandingCents` : encours confirmé, en centimes. Vide tant qu’il n’est pas confirmé.
- `paymentDays` : délai de paiement confirmé, en jours. Vide tant qu’il n’est pas confirmé.
- `createdAt`, `updatedAt`.
- Lien : un fournisseur a plusieurs `Product`, plusieurs `Contact`, plusieurs `Address` et plusieurs `PurchaseFollowUp`. Retirer le fournisseur vide `Product.supplierId` et retire ses contacts, ses adresses et ses achats. Retirer un dossier vide `PurchaseFollowUp.projectId`.

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
- `family` : catégorie fermée, `serveur`, `poste`, `portable`, `reseau`, `prestation`, `autre`, ou vide. Elle est recopiée sur la ligne de vente au moment du devis. Un `InstalledEquipment` peut pointer vers ce produit ; supprimer le produit vide `productId`.
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

Action du dossier. Distincte de `RecordEvent`. La réunion des deux journaux est dans le [DCT](dct.md).

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

Aucune colonne de numéro. La réimpression est décrite dans le [DCT](dct.md).

### SaleDocumentLine

- `kind` défaut `produit`, `name`, `supplierName`.
- `productId` vers `Product`, vidé si le produit est supprimé. `family` recopie la catégorie du produit au moment où la ligne est créée.
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

### ContractProposal

Contrat encore à confirmer. Confirmer crée le `Contract`. Rejeter n’écrit pas de contrat.

- `status` : `en_attente`, `remplacee`, `confirmee`, `rejetee`.
- `payload` : client, type fermé (`maintenance`, `infogerance`, `location`), début, fin, périodicité (`mensuel`, `trimestriel`, `semestriel`, `annuel`) et `amountCents` de la période.
- `modelVersion` : `regle`. `confidence` et `validatedAt` comme sur `DocumentProposal`.
- `createdAt`.

### Contract

Contrat confirmé. Le montant stocké est celui de la période, en centimes. Le montant mensuel n’est pas une colonne.

- `clientId` vers `Client`. Retirer le client retire ses contrats.
- `kind` : `maintenance`, `infogerance` ou `location`. L’entretien est enregistré comme `maintenance`.
- `startsOn`, `endsOn` : dates `YYYY-MM-DD`.
- `periodicity` : `mensuel`, `trimestriel`, `semestriel` ou `annuel`.
- `amountCents` : montant écrit de la période.
- `confirmedAt` : moment de la validation. Sans cette date, le contrat n’existe pas.
- `createdAt`.

### InterventionProposal

Intervention encore à confirmer. Confirmer crée l’`Intervention`. Rejeter n’écrit pas d’intervention.

- `status` : `en_attente`, `remplacee`, `confirmee`, `rejetee`.
- `payload` : client, dossier, type fermé (`assistance`, `intervention`, `integration`, `panne`), date, durée en minutes, unité de taux (`horaire` ou `journalier`), `rateCents`, ticket recopié, référence de pièce facturée, sur site, sous contrat, date de demande, date d’arrivée.
- `modelVersion` : `regle`. `confidence` et `validatedAt` comme sur `DocumentProposal`.
- `createdAt`.

### Intervention

Intervention confirmée. La durée et le taux sont stockés. Le taux moyen, le total d’heures et le délai moyen ne sont pas des colonnes.

- `clientId` vers `Client`, `projectId` vers `Project`. Retirer le client ou le dossier retire l’intervention.
- `kind` : `assistance`, `intervention`, `integration` ou `panne`.
- `occurredOn` : date `YYYY-MM-DD`.
- `durationMinutes` : durée entière, en minutes.
- `rateUnit` : `horaire` ou `journalier`. `rateCents` : taux écrit.
- `ticket` : numéro déjà écrit, recopié. Vide s’il n’y en a pas.
- `billedReference` : référence de la pièce qui a facturé l’intervention, recopiée. Vide si elle n’est pas facturée. Ce n’est pas un numéro attribué par l’application.
- `onSite`, `underContract`.
- `requestedOn`, `arrivedOn` : dates `YYYY-MM-DD`, vides si elles ne sont pas écrites.
- `confirmedAt` : moment de la validation.
- `createdAt`.

### InstalledEquipmentProposal

Équipement installé encore à confirmer. Confirmer crée l’`InstalledEquipment`. Rejeter n’écrit pas d’équipement.

- `status` : `en_attente`, `remplacee`, `confirmee`, `rejetee`.
- `payload` : client, produit facultatif, désignation, famille fermée (`serveur`, `poste`, `portable`, `reseau`, `prestation`, `autre`), date d’installation, niveau de garantie (`h4`, `j1`, `standard`, `aucune`).
- `modelVersion` : `regle`. `confidence` et `validatedAt` comme sur `DocumentProposal`.
- `createdAt`.

### InstalledEquipment

Équipement installé confirmé. L’âge et le filtre « acheté l’an dernier » ne sont pas des colonnes : ce sont des comparaisons de `installedOn`.

- `clientId` vers `Client`. Retirer le client retire l’équipement.
- `productId` vers `Product`, facultatif, vidé si le produit est supprimé.
- `designation` : texte écrit, ou le nom du produit retenu.
- `family` : la même liste fermée que `Product.family`.
- `installedOn` : date `YYYY-MM-DD`.
- `warranty` : `h4` (4 h), `j1` (J+1), `standard` ou `aucune`.
- `confirmedAt` : moment de la validation. Sans cette date, l’équipement n’existe pas.
- `createdAt`.

### PurchaseFollowUpProposal

Achat encore à confirmer. Confirmer crée le `PurchaseFollowUp`. Rejeter n’écrit pas d’achat.

- `status` : `en_attente`, `remplacee`, `confirmee`, `rejetee`.
- `payload` : fournisseur, désignation, famille (`serveur`, `poste`, `portable`, `reseau`, `prestation`, `autre`, `sous-traitance`), date de commande, `orderCents` du bon de commande, `invoiceCents` de la facture reçue ou vide, reliquat (`ouvert`, `partiel`, `clos`), date d’expédition, suivi recopié, livraison (`chez_nous` ou `chez_client`).
- `modelVersion` : `regle`. `confidence` et `validatedAt` comme sur `DocumentProposal`.
- `createdAt`.

### SupplierTermsProposal

Encours et délai encore à confirmer. Confirmer écrit `Supplier.outstandingCents` et `Supplier.paymentDays`. Rejeter ne change pas la fiche.

- `status` : `en_attente`, `remplacee`, `confirmee`, `rejetee`.
- `payload` : fournisseur, encours en centimes, délai en jours.
- `modelVersion` : `regle`. `confidence` et `validatedAt` comme sur `DocumentProposal`.
- `createdAt`.

### PurchaseFollowUp

Ligne d’achat confirmée. Le bon de commande et la facture reçue sont deux montants recopiés. L’écart, le volume et le total de sous-traitance ne sont pas des colonnes. Ce n’est pas un numéro de facture.

- `supplierId` vers `Supplier`. Retirer le fournisseur retire l’achat.
- `projectId` vers `Project`, facultatif. Retirer le dossier laisse l’achat et vide le lien. Sans ce lien, l’achat n’entre pas dans la rentabilité du dossier.
- `designation`, `family`. La sous-traitance est la famille `sous-traitance`.
- `orderedOn` : date `YYYY-MM-DD`.
- `orderCents` : montant écrit du bon de commande. `invoiceCents` : montant écrit de la facture reçue, vide si elle n’est pas écrite.
- `remainder` : `ouvert`, `partiel` ou `clos`.
- `shipsOn` : date d’expédition annoncée, vide si elle n’est pas écrite.
- `tracking` : numéro de suivi recopié. Vide s’il n’y en a pas.
- `delivery` : `chez_nous` ou `chez_client`.
- `confirmedAt` : moment de la validation.
- `createdAt`.

### ClaimProposal

Réclamation encore à confirmer. Confirmer crée le `Claim`. Rejeter n’écrit pas de réclamation.

- `status` : `en_attente`, `remplacee`, `confirmee`, `rejetee`.
- `payload` : client, type fermé (`deballage` ou `retard`), date, état (`ouverte`, `en_cours`, `closee`), texte recopié.
- `modelVersion` : `regle`. `confidence` et `validatedAt` comme sur `DocumentProposal`.
- `createdAt`.

### Claim

Réclamation confirmée. Le nombre du mois n’est pas une colonne : c’est un filtre sur `occurredOn` et sur le type. Le texte est `note`, déjà écrit. Ce n’est pas un numéro de facture.

- `clientId` vers `Client`. Retirer le client retire la réclamation.
- `kind` : `deballage` (panne au déballage) ou `retard` (retard de livraison).
- `occurredOn` : date `YYYY-MM-DD`.
- `status` : `ouverte`, `en_cours` ou `closee`.
- `note` : texte recopié de la phrase.
- `confirmedAt` : moment de la validation. Sans cette date, la réclamation n’existe pas.
- `createdAt`.

### ReturnRequestProposal

Retour encore à confirmer. Confirmer crée le `ReturnRequest`. Rejeter n’écrit pas de retour.

- `status` : `en_attente`, `remplacee`, `confirmee`, `rejetee`.
- `payload` : client, type fermé (`retour` ou `remplacement`), date, état (`en_cours` ou `clos`), sous garantie ou hors garantie, texte recopié.
- `modelVersion` : `regle`. `confidence` et `validatedAt` comme sur `DocumentProposal`.
- `createdAt`.

### ReturnRequest

Retour ou remplacement confirmé. La liste « en cours et sous garantie » n’est pas une colonne : c’est un filtre sur `status` et `underWarranty`. Le texte est `note`, déjà écrit.

- `clientId` vers `Client`. Retirer le client retire le retour.
- `kind` : `retour` ou `remplacement`.
- `occurredOn` : date `YYYY-MM-DD`.
- `status` : `en_cours` ou `clos`.
- `underWarranty` : vrai si la phrase dit sous garantie.
- `note` : texte recopié de la phrase.
- `confirmedAt` : moment de la validation.
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

Journal des créations, mises à jour et suppressions de `Client`, `Supplier`, `Product` et `Project`. Pas de clé étrangère : la ligne reste si la fiche est supprimée. L’écran qui filtre et supprime ces lignes est dans le [DCT](dct.md).

- `entityType` : `client`, `supplier`, `product`, `project`.
- `entityId`, `entityName`.
- `action` : `création`, `mise à jour`, `suppression`.
- `summary` : champs changés, forme `ancien → nouveau`. Une mise à jour sans différence n’écrit pas de ligne.
- `source` : `assistant`, `formulaire`, ou `application`.
- `actor` : marque de la personne connectée. Hors session, la marque par défaut reste `J Smith`.
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
- Le montant mensuel d’un contrat est calculé par `src/domain/contracts.ts` à partir de `Contract.amountCents` et de la périodicité. Il n’est pas stocké. Le total mensuel additionne ces montants déjà calculés. L’échéance à 30 jours compare `endsOn` à la date du jour.
- Le taux moyen, le total d’heures et le délai moyen d’une intervention sont calculés par `src/domain/interventions.ts` à partir des taux, des minutes et des dates déjà enregistrés. Ils ne sont pas stockés.
- L’âge d’un équipement et le filtre « acheté l’an dernier » sont calculés par `src/domain/equipment.ts` en comparant `InstalledEquipment.installedOn` à une date. Ils ne sont pas stockés. Le niveau de garantie est la valeur déjà enregistrée.
- L’écart d’un achat est calculé par `src/domain/purchases.ts` : facture reçue moins bon de commande, deux centimes déjà stockés. Le volume et le montant de sous-traitance additionnent des `orderCents` déjà enregistrés. Le retard d’expédition compare `shipsOn` à la date du jour. Aucun de ces résultats n’est stocké.
- Le nombre de réclamations du mois et le nombre de retours en cours sont des filtres de `src/domain/claims.ts` sur les fiches déjà confirmées. Ils ne sont pas stockés. Le texte affiché est `Claim.note` ou `ReturnRequest.note`, recopié, pas réécrit.
- La rentabilité d’un dossier, la valeur du stock, la part réservée, les réceptions sans intervention et les achats non repris sont calculés par `src/domain/dossier.ts`. Les quatre nombres de rentabilité additionnent des centimes déjà stockés. La valeur du stock multiplie `Product.stockQty` par le coût déjà écrit. La part réservée additionne les quantités des dossiers ouverts. Aucun de ces résultats n’est stocké. Aucune facture n’est créée.
- L’application n’attribue pas de numéro de facture ni d’avoir. Une `NotedPiece` recopie la référence déjà écrite. Elle n’enregistre pas de relevé bancaire.
- La validité de trente jours d’une offre fournisseur, les rôles et les notifications ne sont pas des tables. L’historique de prix est la suite des `SupplierOffer`. `Quote.versionLabel` et `Quote.fingerprint` identifient une offre reçue, sans durée de validité en colonne.
