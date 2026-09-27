# Manuel utilisateur

Ce manuel décrit Gestion IA tel qu’il s’utilise aujourd’hui. Il est affiché dans l’application. La spécification du produit visé est un document à part : [Spécification fonctionnelle (PDF)](/documentation/specification). Le fonctionnement du socle livré est dans la [spécification technique](/documentation/technique).

Dernière mise à jour : 27 septembre 2026. Le menu Configuration règle le serveur, les modèles et la clé d’API.

## Ouvrir l’application

Sur la machine Ubuntu, ouvrez [l’accueil](/). L’adresse locale est `http://127.0.0.1:3847`.

Le menu est à gauche, en cinq groupes.

- **Actions** : Accueil, Nouveau dossier, Aide au prix.
- **Suivi de devis** : le tableau des devis en attente, transformés ou non aboutis, leur liste, et les projets.
- **Liste** : Documents, Clients, Fournisseurs, Articles, Regroupements, Historiques lignes, Échéances impayées, Textes.
- **Pilotage** : Tableau de bord, Tableau d’analyse.
- **Comptabilité** : Journal des ventes, Achats, Banque.

La barre du haut porte le nom de l’entreprise, une recherche de documents, Configuration, le manuel et Plus. Sur un téléphone, **Menu** ouvre le rail. Chaque liste a une recherche, un nombre de lignes (10, 25, 50 ou 100), une pagination et, pour les tableaux commerciaux, un export CSV.

Les données restent sur cette machine. L’assistant envoie le texte à Ollama sur le PC hôte du réseau local, pas à un service d’IA public.

## Accueil

L’accueil est l’assistant, et il n’y en a qu’un. C’est l’expert de l’activité, en achat-revente ou en fourniture de services. Il suit le fil : demande de devis reçue, offre, commande, puis fourniture du produit ou du service dans un projet.

Le même bloc sert à écrire, à joindre des fichiers et à poser une question. Le bouton **Envoyer** lance la lecture. Jusqu’à 8 fichiers de 20 Mo. Docling, sur cette machine, lit un PDF, un document Word, un tableur, une présentation ou une image : les titres et les tableaux deviennent des extraits recherchables. Un texte simple est lu directement. Si Docling n’est pas disponible, un PDF ou un Word dont le texte peut être extrait reste indexé. Si aucun texte n’est lu, le fichier est quand même enregistré.

Le fil reste enregistré sur cette machine. En revenant à l’accueil, les derniers messages sont là. **Nouveau fil** en ouvre un autre, sans effacer le précédent. Si un message cite un seul projet déjà ouvert, le fil lui est associé. La pièce reçue, elle, n’y est pas rattachée.

Pendant la réponse, l’étape en cours s’affiche : lecture des fiches, règle métier, proposition à confirmer, ou recherche. Le texte arrive au fur et à mesure.

Il reconnaît le type sur la première ligne ou le nom du fichier : demande de prix (RFQ), devis, commande, facture, tarif, avoir, bon de livraison, contrat, fiche technique. Il situe l’étape dans le fil, relève le client, le fournisseur et les produits, et les compare aux fiches déjà enregistrées. Si le message cite un projet déjà ouvert, il le nomme. La pièce n’y est pas rattachée, et aucun projet n’est créé, tant que vous ne le demandez pas.

Une phrase explicite est enregistrée tout de suite. Exemple : `Créer le projet : Cartes et kits de développement pour le client grid solutions. Le projet consiste à fournir un kit de développement.` Le dossier s’ouvre, l’objet est repris, et l’actualité commence par cette ouverture. Si le client est déjà au répertoire, son nom est repris. Sinon la fiche client attend une description, puis une confirmation. Une fiche technique jointe au même envoi, par exemple un kit de développement, est rattachée à ce projet. Elle ne porte pas de prix si la fiche n’en indique pas.

Un tableau collé de clients, de produits, de services, de projets ou de devis est lu de la même façon. Les prix, les devises et les mentions de TVA sont conservés tels qu’ils sont écrits. Le contrôle des lignes confirme ou non les totaux indiqués, sans les remplacer. Un montant en dollars reste en dollars tant qu’un taux vers l’euro n’est pas indiqué. La marge brute d’une affaire n’est calculée que si un coût de revient est indiqué.

**À confirmer**, dans le même bloc, propose de créer un client, un fournisseur ou un produit, d’ouvrir une demande, d’ajouter une version de devis, ou de marquer une demande comme offre reçue. **Confirmer** écrit ces fiches. **Écarter** laisse le fichier dans Pièces reçues.

Un devis ou un tarif confirmé ajoute une version : numéro, date, fournisseur, prix indiqué et conditions. Un PDF qui contient déjà du texte est lu sur place, sans modèle : références, quantités et prix sont repris tels qu’ils sont écrits, y compris un montant en `EUR 2.170,00` ou `21 109.75`. Le total imprimé est conservé, il n’est pas recalculé. Un composant sans prix n’est pas transformé en ligne chiffrée. Un scan sans texte passe par Docling. Une version déjà enregistrée n’est pas dupliquée. Une facture, une commande ou un avoir peut créer une fiche manquante, sans devenir une version de devis. Les prix restent ceux écrits dans la pièce. Ils ne sont pas calculés et ils ne sont pas additionnés.

Sans fichier, un message trop court, moins de 3 caractères, n’est pas enregistré. Une fiche client, un fournisseur, un produit, un projet court ou un devis se confirme dans le fil, par **Confirmer** ou par `Je confirme.` `non` n’enregistre rien. L’adresse du serveur, les modèles et la clé d’API se règlent dans Configuration.

**Projets récents** reprend les six derniers dossiers. **Tous les projets** ouvre la liste complète.

**Pièces reçues** garde les notes et les fichiers. **Modifier ou supprimer** change la note, retire un document, ou supprime la note avec ses fichiers. Le fichier quitte cette machine.

## Configuration

Le menu **Configuration** commence par l’**entreprise** : raison sociale, adresse, e-mail, téléphone, SIREN, numéro de TVA et logo. Ces éléments s’impriment en tête des documents. Le logo est une image PNG, JPEG ou WebP d’au plus 2 Mo. **Retirer le logo** l’efface. Le même écran règle ensuite l’adresse du serveur d’inférence, le modèle de conversation, le modèle d’index et, si le serveur en demande une, la clé d’API.

L’adresse doit viser une machine du réseau local. Une adresse publique est refusée. La clé reste dans la base de cette machine : l’écran n’en montre que les quatre derniers caractères. La laisser vide conserve la clé déjà enregistrée. **Retirer la clé enregistrée** l’efface.

Trois listes reprennent les modèles annoncés par le serveur : **Modèle conversationnel**, **Modèle d’embeddings** et **Reranker**. **Automatique** choisit, s’ils sont installés, Qwen2.5-14B-Instruct quantifié Q4_K_M (souvent `qwen2.5:14b`), `bge-m3` et `bge-reranker-v2-m3`. Le bandeau indique si le serveur répond et quel modèle de chaque type sera utilisé. Le reranker relit les fiches candidates et ne garde que celles qui répondent à la question. Sans lui, le tri reste lexical et vectoriel. Le mot de passe de PostgreSQL n’apparaît pas ici.

## Répertoire

Le groupe **Liste** ouvre directement [Clients](/clients), [Fournisseurs](/fournisseurs) et [Articles](/produits). Le [répertoire](/repertoire) reste une porte d’entrée vers ces trois fiches.

## Clients

La [vue Clients](/clients) s’ouvre sur un tableau : nom, type, adresse, code postal, ville, téléphone, mail et fonction du contact. Elle distingue un **particulier** et une **entreprise**, en **France** ou à l’**international**. Une fiche sans type affiche **Non qualifié**. Une fiche créée depuis une pièce confirmée porte le nom relevé et une note « à compléter ».

**Nouveau client** enregistre dès que vous validez le formulaire. Renseignez le type, le nom ou la raison sociale, le pays, l’adresse, un e-mail ou un téléphone. Pour une entreprise française, le SIREN permet de déduire le numéro de TVA. Pour une entreprise étrangère, indiquez l’identifiant fiscal. Le contact et sa fonction servent au dossier commercial.

**Modifier** met à jour la fiche tout de suite. **Supprimer** retire le client après confirmation. La recherche porte sur le nom, l’e-mail et le SIREN. Un compte déjà présent n’est pas dupliqué.

**Modifications** liste chaque création, correction et suppression, avec la date, l’heure et l’origine : Assistant, Formulaire ou Application. La même trace apparaît sous la fiche concernée. Une entreprise déjà déclarée se complète depuis l’accueil, par exemple `ajoute un contact Anne Durand, directrice commerciale, chez Holzwerk Müller GmbH`. La proposition reprend la fiche connue, garde les champs non cités, et n’écrit qu’après confirmation. L’ancien contact, s’il y en avait un, reste dans cette liste.

Créer un projet ne crée plus la fiche client. Le dossier s’ouvre, et la fiche attend une proposition confirmée.

## Fournisseurs

La [vue Fournisseurs](/fournisseurs) s’ouvre sur un tableau : nom, e-mail, téléphone, adresse. Elle suit le même principe : créer, modifier, supprimer. Les produits liés restent au catalogue. **Achats** y renvoie. La commande, la réception et la facture fournisseur ne se saisissent pas encore. **Modifications** y date chaque changement, comme pour les clients.

## Produits

La [vue Articles](/produits) s’ouvre sur un tableau : référence, désignation, famille, prix indiqué, coût indiqué, unité et fournisseur. Ces prix restent ceux de la fiche. Le catalogue réunit :

- **Saisie manuelle** : nom, référence, unité, fournisseur, description. Un fournisseur inconnu est créé.
- **Issu d’un devis** : titre du devis et un produit par ligne, ou un fichier confirmé depuis l’accueil. Chaque confirmation de devis ajoute une version : prix indiqué et conditions. Une version ne remplace pas la précédente.
- **Saisi par l’assistant** : quand vous lui demandez d’ajouter un produit.

Les filtres **Tous**, **Issus d’un devis**, **Saisis par l’assistant** et **Saisie manuelle** limitent la liste. Une fiche peut porter à la fois une saisie et plusieurs devis. La carte **Versions de devis** liste chaque prix et chaque condition, sans les fusionner. **Supprimer le produit** retire la fiche et ses lignes. **Supprimer cette version** retire un devis et laisse le produit. **Modifications** date chaque création, correction et suppression de produit.

## Projets

**Ouvrir la vue** d’un dossier, ou son nom depuis l’accueil, montre le client, le contexte, puis les produits et services du projet. Le client se choisit dans la liste des fiches déjà au répertoire. Les produits et services se choisissent dans le catalogue, le même pour tous les dossiers. Le fournisseur d’une ligne se choisit dans la liste des fournisseurs. Chaque ligne porte une quantité, le coût du catalogue, un taux de marque modifiable et une remise. Le prix de vente HT et la marge sont calculés par la règle de prix, pas saisis à la main. Sans coût, le prix de vente reste non indiqué. **Actualiser les chiffres** enregistre la marge. **Confirmer les chiffres du dossier** fige cette lecture, avec la date et l’heure dans l’actualité.

Cochez une ou plusieurs lignes, donnez un titre, puis **Établir le devis**. Le devis reprend les chiffres de cet instant. Depuis un devis en cours : **Ouvrir la commande client**, ou **Marquer non abouti**. Les devis non aboutis restent dans leur liste, ils ne deviennent pas une commande. Depuis une commande client, **Établir la commande fournisseur** regroupe les lignes par fournisseur. Une ligne sans fournisseur attend un nom, dans le champ prévu ou sur la ligne. Sur un devis ou une commande encore en cours, la marque et le coût se réactualisent, puis **Confirmer les chiffres** les date. **Reprendre les chiffres** rouvre cette confirmation. Les montants de cette vue sont hors taxes.

**Livraison** précise le destinataire, l’adresse (elle peut différer de celle du client facturé), le mode (sur site, à distance, transporteur ou retrait), le contact, le téléphone, la date ou le créneau, et les consignes. **Enregistrer la livraison** les date dans l’actualité. Ces lignes figurent sur le devis, les commandes et la facture.

Sous le client et le contexte, des liens mènent au **parcours**, à la **livraison**, aux **produits et services**, aux **devis**, aux **commandes** et à l’**actualité**. Le parcours tient sur un tableau de neuf étapes. Chaque case montre la situation et la preuve : RFQ ou cahier des charges, devis ou offre avec CGV, bon de commande client, accusé de réception, ordre de service, bordereau ou ordre de mission, bon de livraison, procès-verbal de réception, puis facture et justificatif de paiement. Un clic ouvre le formulaire de cette étape. La situation est **À faire**, **En cours** ou **Preuve enregistrée**. Cette dernière exige la référence déjà portée sur la pièce. L’application n’émet pas la facture et ne lui donne pas de numéro. Une étape peut être enregistrée avant la précédente ; le formulaire signale alors les preuves encore absentes. Sur un grand écran, les produits, le devis et les commandes occupent la colonne principale et le parcours reste à droite. Sur un écran étroit, le parcours précède ces sections.

**Voir le document** ouvre le devis, la commande client ou la commande fournisseur comme une pièce : en-tête de l’entreprise, destinataire, lignes et total HT. **Voir la facture client** reprend la commande client la plus récente et les références déjà enregistrées (facture, bon de commande, bon de livraison, procès-verbal). L’application n’attribue pas de numéro de facture. **Imprimer** utilise l’impression du navigateur. La commande fournisseur montre le coût d’achat. Le devis, la commande client et la facture montrent le prix de vente HT, pas la marge. Le texte complet est l’[instruction métier](/documentation/metier).

Chaque dossier garde aussi une **actualité** : ouverture, objet, devis établi, commande, confirmation des chiffres, pièce rattachée, mise à jour. **Modifications** date à part les changements de la fiche projet : création, correction, suppression. **Modifier ou supprimer** change le nom, le client, le statut, l’objet et la prochaine action, retire un devis du catalogue rattaché au dossier, ou supprime le projet. Les devis retirés du catalogue restent au catalogue. Un devis de catalogue rattaché affiche la devise, les totaux indiqués et la mention de TVA. La conversion en euro et la marge brute de ces pièces restent absentes tant que le taux ou le coût de revient n’est pas indiqué.

**Nouveau dossier** demande :

- **Nom du projet**, au moins 2 caractères
- **Client**, choisi dans le répertoire
- **Prochaine action**, facultative. Si vous la laissez vide, l’application retient « Qualifier le besoin »

**Créer le dossier** ouvre le projet avec le statut **À qualifier**. La date d’ouverture s’affiche dans la liste. Créer un projet est une action explicite : une note de l’accueil ne le fait pas. Si le client n’est pas encore au répertoire, le projet est créé quand même et la fiche reste à qualifier avec l’assistant.

## Ventes

**Aide à l’établissement du prix** calcule trois montants hors taxes à partir du coût direct, du taux de marque visé et de la remise client. Ce n’est pas un devis émis : il n’y a ni numéro, ni TVA, ni envoi.

Les taux s’écrivent en pour cent. Une marque de 30 % se saisit `30`, pas `0,30`. La marque et la remise doivent rester strictement inférieures à 100 %.

Formules, sur le prix net HT :

- prix net = coût / (1 − taux de marque)
- prix affiché = coût / [(1 − taux de marque) × (1 − remise)]

Exemple de la spécification : coût `700`, marque `30`, remise `10`. Le prix affiché est 1 111,11 € HT, le prix net 1 000,00 € HT, la marge directe 300,00 € HT.

## Assistant

L’assistant est l’accueil, [au même endroit](/#assistant). Il reconnaît l’intention, relit les fiches déjà enregistrées, puis agit ou propose. Il n’émet pas de facture et ne calcule pas un prix. Une question de prix de vente reçoit la règle métier et renvoie vers Ventes.

Il distingue cinq demandes :

- **Consulter** : `que sait-on de Marie Dupont`, `cherche Holzwerk`. La réponse reprend uniquement les fiches trouvées. S’il n’y en a pas, il le dit et n’invente rien.
- **Lister** : `liste des clients`, `quels fournisseurs`. La liste vient du répertoire.
- **Nom seul déjà connu** : `Marie Dupont`. Il demande si vous voulez consulter la fiche ou la modifier. Il n’ouvre pas une création.
- **Corriger une fiche connue** : `le téléphone de Holzwerk Müller GmbH est le +49 89 000111`. Il retrouve la fiche, garde les autres champs, et propose la mise à jour.
- **Compléter une entreprise déjà déclarée** : `ajoute un contact Anne Durand, directrice commerciale, chez Holzwerk Müller GmbH` ou `ajoute une information sur Holzwerk Müller GmbH : livraison le mardi`. Il s’appuie sur la fiche enregistrée, conserve ce qui n’est pas cité, et propose la mise à jour. `ajoute un contact chez Holzwerk Müller GmbH`, sans nommer la personne, décrit la fiche et n’écrit rien.
- **Créer ou mettre à jour** avec une phrase explicite, comme ci-dessous.

Pour un client, il commence par l’analyse de l’action demandée (création ou mise à jour), puis sépare le nom, la forme, l’adresse, le pays et les identifiants. Un bloc collé sur plusieurs lignes est lu de la même façon. Exemple : `ajoute le client : Grid Solutions Oy`, puis la rue, le code postal, la ville, le pays, le Business ID et le VAT ID. La proposition affiche **Action demandée** et **Analyse**. Rien n’est écrit tant que vous n’avez pas confirmé. Les champs encore absents, comme l’e-mail ou le contact, sont listés à part.

- **Confirmer**, ou écrire `Je confirme.`, enregistre la fiche la plus récente encore en attente, client ou autre.
- `non` n’enregistre rien. Pour un client, la proposition reste affichée afin de la corriger. Pour un fournisseur, un produit, un projet ou un devis, elle est écartée.
- Un commentaire sur un client, par exemple `le téléphone est le 06 98 76 54 32`, produit une nouvelle proposition.
- Un nouveau texte commençant par `Nouveau client` remplace la proposition de client en cours.

Ces phrases préparent une fiche, sans l’enregistrer et sans passer par le modèle :

- `ajouter un fournisseur Quincaillerie Durand`
- `créer produit Vis à bois, référence VIS-01, fournisseur Quincaillerie Durand`
- `créer projet Atlas, client Atelier Nord`
- `devis Offre mars, produit Vis à bois, référence VIS-01, produit Charnière`

Deux cas s’enregistrent tout de suite, avant cette confirmation : la phrase parlée `Créer le projet : Cartes et kits de développement pour le client grid solutions. Le projet consiste à fournir un kit de développement.` et un tableau collé de clients, de produits, de services, de projets ou de devis.

`créer client Atelier Nord, email contact@atelier.fr` et `mettre à jour le client Atelier Nord, adresse 12 rue des Lilas, Paris` ouvrent une proposition, ils n’enregistrent pas tout seuls.

Une question sur le parcours commercial, la prochaine étape ou une preuve (RFQ, devis, bon de commande, accusé de réception, bon de livraison, procès-verbal, facture) est répondue d’après `instructions/metiers/achat-revente-technologies.md`, sans le modèle. Si un seul projet est nommé, la réponse lit les étapes déjà enregistrées sur sa fiche.

Une demande plus libre est transmise à Ollama avec les extraits des fiches les plus proches, y compris les passages des pièces jointes, l’actualité des projets et chaque version de devis. La recherche prend d’abord un lot large, par les mots et par les embeddings. Le reranker, s’il est installé, reclasse ce lot et écarte les fiches hors sujet avant de les donner au modèle de conversation. Le modèle peut relancer une recherche. S’il propose une fiche, l’outil ne l’écrit pas : le bouton **Confirmer** reste nécessaire. Seuls les champs présents dans votre message ou dans une fiche retrouvée sont proposés. `que sait-on de Vis à bois` reprend toutes les versions enregistrées, avec le prix indiqué et les conditions de chacune. Une pièce reçue seule reste hors projet. Elle entre dans l’actualité du dossier si le même envoi demande explicitement de créer le projet.

L’état du serveur, l’adresse et les trois modèles sont dans **Configuration**, pas sur l’accueil. Le budget prévu est un utilisateur, 16 Go de mémoire graphique et 32 Go de RAM. Les embeddings, puis le reranker, se chargent et se déchargent. Ensuite seulement le modèle de conversation, limité à 4 096 jetons. Sans `bge-m3`, l’index utilise `nomic-embed-text` s’il est là, sinon la recherche continue par les mots, même si Ollama ne répond pas.

Si Configuration indique **Serveur injoignable**, le PC hôte doit faire écouter Ollama sur le port `11434`, et le pare-feu Windows doit autoriser ce port depuis le réseau local. Dans une VM VirtualBox en NAT, l’adresse peut être `http://10.0.2.2:11434`.

## Listes commerciales

[Documents](/listes/documents) aligne les devis, les commandes et les devis reçus : type, date, référence du dossier, client ou fournisseur, projet, montant HT, situation. Le montant d’une pièce produite additionne les lignes qui ont un coût. Le total imprimé d’un devis reçu n’est pas recalculé.

[Suivi de devis](/suivi) présente trois colonnes : en attente, transformé en commande, non abouti. **Liste** ouvre le même ensemble en tableau.

[Regroupements](/listes/regroupements) classe les articles par fournisseur. Il n’y a pas de pack au prix modifié.

[Historique des lignes](/listes/lignes) reprend chaque ligne de devis ou de commande.

[Échéances](/listes/echeances) liste les commandes client. Sans référence sur l’étape Facturation, la ligne est « À facturer ». Le paiement reste « Non suivi » : l’application n’enregistre pas d’encaissement et ne calcule pas de pénalité.

[Textes](/listes/textes) montre les conditions déjà lues sur un devis, les descriptions d’articles et les consignes de livraison.

## Pilotage et journal

Le [tableau de bord](/pilotage) compte les devis en attente, les commandes client, le chiffre d’affaires HT de ces commandes et les projets. Il classe les articles par montant, par quantité et par marge, et les clients par montant. Les impayés sont le nombre de commandes sans référence de facture. Aucun coût journalier de retard n’est affiché.

Le [tableau d’analyse](/pilotage/analyse) compare deux périodes. Par défaut, le mois précédent et le mois en cours. Les lignes sont le chiffre d’affaires HT, le nombre de commandes, le nombre de devis et la marge HT. L’écart est la seconde période moins la première.

Le [journal des ventes](/comptabilite/journal) filtre par dates. La case **Ventes** affiche les devis et les commandes client, en HT. Les cases **Paiements**, **TVA sur encaissements** et **Paiements en attente** n’ajoutent pas de lignes : elles rappellent que ces montants ne sont pas tenus.

## Achats et Banque

Ces deux écrans décrivent le comportement prévu. Ils ne saisissent pas encore de pièce ni de relevé.

- **Achats** séparera l’offre, la commande, la réception, la facture et le paiement. Ces montants ne s’additionnent pas.
- **Banque** préparera un rapprochement à confirmer. Aucun paiement n’est lancé depuis l’application.

## Plus

**Plus** ouvre ce manuel, la spécification fonctionnelle et la spécification technique. Les versions de devis d’un produit, avec le prix indiqué et les conditions, sont sur la vue Produits. L’historique des prix de vente calculés, les exports, la sauvegarde et le connecteur de facturation électronique ne sont pas encore disponibles.

## Ce que vous ne pouvez pas faire ici

- numéroter ou émettre une facture, un avoir ou une commande
- faire calculer un montant par l’assistant
- rattacher une note de l’accueil à un projet : il faut créer le dossier, à la main ou en le demandant à l’assistant
- lancer un paiement ou une transmission vers une plateforme agréée
