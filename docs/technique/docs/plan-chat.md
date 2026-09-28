# Plan des questions au chat

Ce chapitre est le plan de développement. Il sert à suivre les évolutions qui permettent au chat de répondre à des questions d’analyse, de recherche et de rédaction. Les questions citées sont des exemples. Elles ne forment pas un catalogue figé : une phrase nouvelle de la même famille emprunte le même chemin.

Les contraintes déjà écrites ne sont pas recopiées ici. Les modèles et le budget GPU sont dans [Recherche et modèles](recherche.md). L’ordre actuel des règles est dans l’[orchestration](orchestration.md). Le prix et la marge unitaire sont dans le [DCT](dct.md). Les tables absentes déjà nommées sont dans la [modélisation](modelisation.md). L’encaissement et le rapprochement bancaire restent dans l’[écart](ecart.md).

## Effet des petits modèles

Le modèle de conversation est un 14B quantifié, avec un contexte court, une température basse, et une file GPU qui décharge embeddings et reranker avant de lui parler. Il tient une intention fermée et une reformulation courte. Il ne tient pas une suite d’outils qui additionne des lignes.

Conséquences pour ce plan :

- Une question d’analyse devient une intention fermée, puis une fonction de `src/domain`. Le modèle ne reçoit pas les lignes à additionner.
- La fonction rend un paquet : période, filtres, mesures, lignes citées, sources, et ce qui manque. L’écran affiche ce paquet. Les chiffres visibles viennent du paquet.
- Si une phrase d’accompagnement est demandée, un seul appel reçoit le paquet, rien d’autre. Un contrôle refuse la phrase si elle introduit un montant, une date, une référence ou un pourcentage absent du paquet. Le repli est le texte du paquet, sans modèle.
- Une recherche de pièce (procès-verbal, procédure constructeur) passe par l’index et le reranker déjà en place. Sans passage retenu, la réponse le dit. Le modèle n’invente pas un numéro de téléphone.
- Aucun quatrième modèle. Le classifieur JSON déjà borné peut gagner des intentions. Il ne gagne pas d’outil d’écriture ni de boucle libre.
- La lecture d’une pièce recopie le montant écrit et n’additionne pas les lignes. Une mesure de pilotage est une autre fonction : elle additionne des centimes déjà enregistrés sur des lignes confirmées, et le paquet nomme cette fonction.

Les outils de lecture actuels (`search_records`, `search_client_agreements`, `get_product_info`, trois pas) restent pour une consultation de fiche. Une moyenne, un classement de prix ou un délai ne passent pas par ces trois pas.

## Familles

Chaque exemple est rattaché à une famille. Le lot qui suit construit la famille, pas la phrase.

### Mesures sur des lignes déjà chiffrées

Exemples : marge brute moyenne sur la revente de serveurs et de postes le mois dernier ; meilleur tarif grossiste pour une référence ; devis en attente dont le prix grossiste a monté depuis l’émission ; volume d’achat cumulé chez un constructeur sur le semestre.

Déjà là : `quoteFromTargetMarkup` dans `src/domain/pricing.ts`, `compareOffers` dans `src/domain/supplier-offer.ts`, les centimes de `QuoteLine`, `SaleDocumentLine` et `SupplierOffer`.

Il manque une famille de produit fermée (serveur, poste, portable, réseau, prestation, autre), recopiée sur la ligne de vente au moment de la confirmation. `SaleDocumentLine` ne pointe pas vers `Product` : sans ce lien, un filtre « serveurs et postes » ne peut pas être honnête. La période s’appuie sur `confirmedAt`, pas sur une date lue dans une phrase.

### Dernière configuration vendue

Exemple : configuration et options de la dernière commande du client Y.

Le premier rendu est la liste des lignes de la dernière commande client confirmée. Les options distinctes du matériel (extension de garantie, masterisation) demandent une ligne liée, de type option, rattachée à la ligne matériel. Tant que cette ligne n’existe pas, le paquet le dit au lieu d’inventer une configuration.

### Recherche de preuve

Exemples : procès-verbal de recette signé chez le client Y ; procédure et coordonnées du support constructeur pour une garantie.

Le procès-verbal est un document déjà classable. La réponse cite le fichier indexé et le dossier. La procédure constructeur est un passage de connaissance : elle n’est répondue que si le texte a été déposé et indexé.

### Devis composé

Exemple : devis pour le client X, 10 portables, préparation en atelier, installation sur site.

`prépare un devis pour …` existe. Ce lot l’étend à plusieurs lignes dont la quantité et le type (matériel ou prestation) sont extraits comme des champs, puis résolus dans le répertoire. Le prix reste celui de `pricing.ts`. Le modèle peut proposer le titre. Il ne propose pas les montants.

### Contrats récurrents

Exemples : contrats de maintenance, d’infogérance ou de location qui arrivent à échéance dans 30 jours ; montant récurrent mensuel de l’infogérance et de l’entretien.

Il faut un contrat confirmé : client, type fermé, début, fin, périodicité, montant écrit en centimes. Le montant mensuel est une fonction du domaine à partir de ce montant et de la périodicité. Le modèle ne l’estime pas. L’échéance à 30 jours est une comparaison de dates.

### Temps et taux

Exemples : taux horaire ou journalier moyen facturé pour l’intégration réseau ce trimestre ; heures d’assistance ou d’intervention du mois pas encore facturées ; récapitulatif de tickets et d’heures pour recharger le forfait du client X ; délai moyen d’intervention sur site pour les pannes sous contrat sur trois mois.

Il faut une intervention confirmée : client, dossier, date, durée, type fermé, taux écrit en centimes, lien facultatif vers la pièce qui l’a facturée, et pour le délai la date de demande et la date d’arrivée. La moyenne et le « pas encore facturé » sont des fonctions. Un ticket de support est la même intervention, avec un numéro déjà écrit, recopié.

### Parc et garanties

Exemples : extension de garantie J+1 ou 4 h sur le matériel acheté l’an dernier ; parc de serveurs ou de postes de plus de 5 ans.

Il faut un équipement installé confirmé : client, produit ou désignation, date d’installation, niveau de garantie fermé. L’âge et le filtre « acheté l’an dernier » sont des comparaisons de dates.

### Suivi d’achat

Exemples : écart entre le bon de commande et la facture du grossiste ; reliquat avec date d’expédition dépassée ; relance pour les numéros de suivi d’une livraison directe ; grossistes avec encours et paiement à 60 jours ; montant de sous-traitance depuis le début de l’année.

La commande fournisseur existe. Il manque, sur une ligne d’achat confirmée : le centime de la facture reçue (recopié, pas recalculé), l’état de reliquat, la date d’expédition annoncée, le suivi, et le mode de livraison (chez nous ou chez le client). L’écart est l’égalité ou la différence de deux centimes déjà stockés. L’encours et le délai de paiement sont des champs confirmés du fournisseur, pas une phrase libre dans les notes. La sous-traitance est une ligne dont la famille est sous-traitance, sommée par la fonction de mesure.

### Réclamations et retours

Exemples : résumé des réclamations du mois pour panne au déballage ou retard de livraison ; demandes de retour et remplacements sous garantie en cours.

Il faut une réclamation confirmée et un retour confirmé, avec type fermé, date, client, état. Le résumé du modèle ne porte que les textes déjà enregistrés. Le nombre et le filtre viennent du paquet.

### Rentabilité, stock, planification

Exemples : rentabilité réelle d’un projet ; valeur du stock atelier et part déjà réservée ; matériel réceptionné sans intervention planifiée ; matériel acheté pour un chantier et encore absent du devis ou de la facture constatée.

La rentabilité additionne des centimes déjà sur le dossier : ventes de matériel confirmées, prestations vendues, coûts d’achat et heures enregistrées. Le paquet sépare ces quatre nombres. Le stock utilise `Product.stockQty` et les quantités des dossiers ouverts ; la part réservée est cette somme, écrite par la fonction. « Réceptionné » et « intervention planifiée » s’appuient sur le suivi d’achat et sur une date d’intervention. « Répercuté » compare les références achetées aux lignes du devis et aux pièces constatées du même dossier. Le paquet liste les références manquantes. Il ne fabrique pas de facture.

### Brouillons

Exemples : e-mail de relance pour une facture en retard de 15 jours ; relance de tracking au grossiste ; demande de cotation spéciale auprès d’un constructeur.

Le brouillon est un texte. Les noms, références, montants et dates sont copiés du paquet. Le contrôle de chiffres est celui du paquet de réponse. Rien n’est envoyé. Une relance de facture n’existe que si la référence et la date ont été enregistrées : l’application continue de ne pas émettre de facture ni de numéro.

### Trésorerie de la semaine

Exemple : échéances grossistes à payer et encaissements clients attendus cette semaine.

Ce lot reste le dernier. Il ne crée pas d’encaissement ni de rapprochement bancaire, déjà écartés. Il ne calcule pas de pénalité. Il liste des dates et des montants déjà écrits sur des pièces confirmées, plus un délai de paiement confirmé sur la fiche. Sans ces dates, le paquet dit ce qui manque.

## Chemin d’une question

1. Les règles déjà en service s’exécutent d’abord, dans l’ordre de l’orchestration.
2. Sinon, la phrase est une intention de famille, ou une question de fiche comme aujourd’hui.
3. S’il manque le client, la période ou la référence, une seule question est posée. Rien n’est calculé.
4. Le résolveur lit PostgreSQL par Prisma et appelle la fonction de domaine. Pas de SQL libre pour le modèle.
5. Le paquet est affiché. La phrase du modèle est facultative et contrôlée.
6. Une écriture (contrat, intervention, équipement, réclamation) reste une proposition à confirmer.

## Lots

Chaque lot se termine par une fonction de domaine testée sans modèle, une question exemple qui affiche le paquet, et une phrase du manuel. Les colonnes nouvelles sont décrites dans la modélisation au moment où le lot les crée. L’état ci-dessous est mis à jour quand le lot est livré. Ce n’est pas le tableau de Réalisations, ni le lot de modélisation déjà clos.

Avancement du chantier : 2 sur 11, soit 18 %. Seul un lot marqué livré compte.

1. **Paquet et garde-fou.** Type du paquet, affichage, contrôle des chiffres dans une phrase. Aucune moyenne métier. État : livré.
2. **Mesures sur l’existant.** Famille de produit, lien produit sur la ligne de vente, marge moyenne, classement d’offres, devis en attente face à une offre plus récente, dernière commande, recherche du procès-verbal indexé. État : livré.
3. **Devis à plusieurs lignes.** Quantités et prestations nommées dans `prépare un devis pour …`, prix par la bibliothèque déjà en place. État : pas commencé.
4. **Contrats.** Échéance à 30 jours et montant récurrent mensuel. État : pas commencé.
5. **Temps.** Taux moyen, heures non facturées, récapitulatif de forfait, délai moyen d’intervention. État : pas commencé.
6. **Parc.** Garanties souscrites et matériel de plus de cinq ans. État : pas commencé.
7. **Achats.** Écart de centimes, reliquat, suivi, volume par constructeur, encours et délai, sous-traitance. État : pas commencé.
8. **Réclamations et retours.** Liste filtrée et résumé borné au texte enregistré. État : pas commencé.
9. **Dossier.** Rentabilité, stock réservé, réception sans intervention, matériel acheté non repris. Dépend des lots temps et achats. État : pas commencé.
10. **Brouillons.** Relance, tracking, cotation spéciale. Le contrôle de chiffres du lot 1 est requis. Rien n’est envoyé. État : pas commencé.
11. **Dates de trésorerie.** Liste de la semaine à partir de dates et de montants déjà écrits. Sans banque et sans pénalité. État : pas commencé.

Les deux premiers lots répondent dans le chat. Le paquet précède la mesure : un chiffre dit hors du paquet est retenu.
