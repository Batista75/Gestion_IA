# Manuel utilisateur

Ce manuel décrit Gestion IA tel qu’il s’utilise aujourd’hui. Il est affiché dans l’application. La spécification du produit visé est un document à part : [Spécification fonctionnelle (PDF)](/documentation/specification).

Dernière mise à jour : 26 septembre 2026, avec l’assistant sur l’accueil et les propositions de pièces.

## Ouvrir l’application

Sur la machine Ubuntu, ouvrez [l’accueil](/). L’adresse locale est `http://127.0.0.1:3847`.

Huit entrées restent en place : Accueil, Répertoire, Projets, Ventes, Achats, Banque, Pilotage et Plus. L’assistant est sur l’accueil. Les listes Clients, Fournisseurs et Produits sont dans Répertoire. Le manuel se trouve dans l’en-tête et dans Plus.

Les données restent sur cette machine. L’assistant envoie le texte à Ollama sur le PC hôte du réseau local, pas à un service d’IA public.

## Accueil

**Nouvelle information** sert à déposer un texte, des fichiers, ou les deux. Le commentaire est facultatif dès qu’un fichier est joint. Le bouton **Déposer pour analyse** conserve la pièce et prépare une proposition.

Tous les fichiers sont conservés, jusqu’à 8 fichiers de 20 Mo. Un texte, un tableau, un document Word ou un PDF dont le texte peut être lu est indexé. Si le texte ne peut pas être extrait, le fichier est quand même enregistré. Le téléchargement se fait depuis le nom du fichier.

L’assistant reconnaît le type sur la première ligne ou le nom du fichier : demande de prix (RFQ), devis, commande, facture, tarif, avoir, bon de livraison, contrat. Il relève le client, le fournisseur et les produits, puis les compare aux fiches déjà enregistrées. **À valider** montre la proposition : créer un client, un fournisseur ou un produit, ouvrir une demande, ajouter une version de devis, ou marquer une demande comme offre reçue.

**Confirmer** écrit ces fiches. **Écarter** laisse le fichier dans À classer. Rien n’est écrit avant confirmation, et aucun projet n’est créé.

Un devis ou un tarif confirmé ajoute une version : numéro, date, fournisseur, prix indiqué et conditions. Une version déjà enregistrée n’est pas dupliquée. Une facture, une commande ou un avoir peut créer une fiche manquante, sans devenir une version de devis. Les prix restent ceux écrits dans la pièce. Ils ne sont pas calculés et ils ne sont pas additionnés.

Sans fichier, une information trop courte, moins de 3 caractères, n’est pas enregistrée.

L’**Assistant**, plus bas sur le même écran, reprend la conversation : questions sur les fiches, exemples de clients, confirmation d’une fiche décrite en phrase. Le bandeau Ollama est dans ce bloc.

**Projets récents** reprend les six derniers dossiers. **Tous les projets** ouvre la liste complète.

## Répertoire

Le menu **Répertoire** ouvre les trois listes. Chaque liste reste un écran : [Clients](/clients), [Fournisseurs](/fournisseurs), [Produits](/produits).

## Clients

La [vue Clients](/clients) distingue un **particulier** et une **entreprise**, en **France** ou à l’**international**. Une fiche sans type affiche **Non qualifié**. Une fiche créée depuis une pièce confirmée porte le nom relevé et une note « à compléter ».

**Nouveau client** enregistre dès que vous validez le formulaire. Renseignez le type, le nom ou la raison sociale, le pays, l’adresse, un e-mail ou un téléphone. Pour une entreprise française, le SIREN permet de déduire le numéro de TVA. Pour une entreprise étrangère, indiquez l’identifiant fiscal. Le contact et sa fonction servent au dossier commercial.

**Modifier** met à jour la fiche tout de suite. La recherche porte sur le nom, l’e-mail et le SIREN. Un compte déjà présent n’est pas dupliqué.

Créer un projet ne crée plus la fiche client. Le dossier s’ouvre, et la fiche attend une proposition confirmée.

## Fournisseurs

La [vue Fournisseurs](/fournisseurs) suit le même principe. **Achats** y renvoie. La commande, la réception et la facture fournisseur ne se saisissent pas encore.

## Produits

La [vue Produits](/produits) montre tout le catalogue :

- **Saisie manuelle** : nom, référence, unité, fournisseur, description. Un fournisseur inconnu est créé.
- **Issu d’un devis** : titre du devis et un produit par ligne, ou un fichier confirmé depuis l’accueil. Chaque confirmation de devis ajoute une version : prix indiqué et conditions. Une version ne remplace pas la précédente.
- **Saisi par l’assistant** : quand vous lui demandez d’ajouter un produit.

Les filtres **Tous**, **Issus d’un devis**, **Saisis par l’assistant** et **Saisie manuelle** limitent la liste. Une fiche peut porter à la fois une saisie et plusieurs devis. La carte **Versions de devis** liste chaque prix et chaque condition, sans les fusionner.

## Projets

**Nouveau dossier** demande :

- **Nom du projet**, au moins 2 caractères
- **Client principal**, au moins 2 caractères
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

L’assistant est sur [l’accueil](/#assistant). Il reconnaît l’intention, relit les fiches déjà enregistrées, puis agit. Il n’émet pas de facture et ne calcule pas un prix. Une question de prix de vente reçoit la règle métier et renvoie vers Ventes.

Il distingue quatre demandes :

- **Consulter** : `que sait-on de Marie Dupont`, `cherche Holzwerk`. La réponse reprend uniquement les fiches trouvées. S’il n’y en a pas, il le dit et n’invente rien.
- **Lister** : `liste des clients`, `quels fournisseurs`. La liste vient du répertoire.
- **Corriger une fiche connue** : `le téléphone de Holzwerk Müller GmbH est le +49 89 000111`. Il retrouve la fiche, garde les autres champs, et propose la mise à jour.
- **Créer ou mettre à jour** avec une phrase explicite, comme ci-dessous.

Pour un client, il commence par l’analyse de l’action demandée (création ou mise à jour), puis sépare le nom, la forme, l’adresse, le pays et les identifiants. Un bloc collé sur plusieurs lignes est lu de la même façon. Exemple : `ajoute le client : Grid Solutions Oy`, puis la rue, le code postal, la ville, le pays, le Business ID et le VAT ID. La proposition affiche **Action demandée** et **Analyse**. Rien n’est écrit tant que vous n’avez pas confirmé. Les champs encore absents, comme l’e-mail ou le contact, sont listés à part.

- **Confirmer**, ou écrire `Je confirme.`, enregistre la fiche.
- `non` laisse la proposition en attente et demande la correction.
- Un commentaire, par exemple `le téléphone est le 06 98 76 54 32`, produit une nouvelle proposition.
- Un nouveau texte commençant par `Nouveau client` remplace la proposition en cours.

Quatre exemples sont proposés dans le bloc Assistant de l’accueil :

- Particulier en France : Mme Marie Dupont, 14 rue des Lilas, 75011 Paris.
- Particulier à l’international : M. John Miller, Londres, Royaume-Uni.
- Entreprise française : Menuiserie Lambert SAS, enseigne Atelier Lambert, SIREN 732829320, TVA déduite FR44732829320, contact Paul Lambert.
- Entreprise internationale : Holzwerk Müller GmbH, Allemagne, TVA DE136695976, contact Anna Müller.

Les autres phrases sont exécutées sans passer par le modèle :

- `ajouter un fournisseur Quincaillerie Durand`
- `créer produit Vis à bois, référence VIS-01, fournisseur Quincaillerie Durand`
- `créer projet Atlas, client Atelier Nord`
- `devis Offre mars, produit Vis à bois, référence VIS-01, produit Charnière`

`créer client Atelier Nord, email contact@atelier.fr` et `mettre à jour le client Atelier Nord, adresse 12 rue des Lilas, Paris` ouvrent une proposition, ils n’enregistrent pas tout seuls.

Une demande plus libre est transmise à Ollama avec les extraits des fiches les plus proches, y compris les pièces jointes et chaque version de devis. Le modèle peut relancer une recherche. Seuls les champs présents dans votre message ou dans une fiche retrouvée sont proposés. `que sait-on de Vis à bois` reprend toutes les versions enregistrées, avec le prix indiqué et les conditions de chacune. Une note de l’accueil reste « À classer » : elle ne devient un projet que si vous le demandez.

Le bandeau **Inférence sur le PC hôte** indique si Ollama répond et l’adresse utilisée, par défaut `http://192.168.1.5:11434`. Le budget prévu est un utilisateur, 16 Go de mémoire graphique et 32 Go de RAM. L’index `nomic-embed-text` se charge, puis se décharge. Ensuite seulement le modèle de conversation, limité à 4 096 jetons. `qwen-dgfip-multisec-2ep:latest` ou `qwen2.5:7b` conviennent. Un modèle 14B, Mixtral ou `bge-m3` ne doit pas rester chargé en même temps. Sans `nomic-embed-text`, la recherche dans les fiches continue par les mots, et elle fonctionne même si Ollama ne répond pas.

La conversation n’est pas enregistrée. **Effacer** la retire de l’écran.

Si le badge indique **Ollama injoignable**, le PC hôte doit faire écouter Ollama sur le port `11434`, et le pare-feu Windows doit autoriser ce port depuis le réseau local. Dans une VM VirtualBox en NAT, l’adresse peut être `http://10.0.2.2:11434`.

## Achats, Banque et Pilotage

Ces trois écrans décrivent le comportement prévu. Ils ne saisissent pas encore de pièce, de relevé ou d’indicateur.

- **Achats** séparera l’offre, la commande, la réception, la facture et le paiement. Ces montants ne s’additionnent pas.
- **Banque** préparera un rapprochement à confirmer. Aucun paiement n’est lancé depuis l’application.
- **Pilotage** montrera le prévu, l’engagé, le facturé et le payé quand ces montants existeront. Tant qu’ils n’existent pas, aucun chiffre n’est inventé.

## Plus

**Plus** ouvre les vues Clients, Fournisseurs et Produits, ce manuel et la spécification. Les versions de devis d’un produit, avec le prix indiqué et les conditions, sont sur la vue Produits. L’historique des prix de vente calculés, les exports, la sauvegarde et le connecteur de facturation électronique ne sont pas encore disponibles.

## Ce que vous ne pouvez pas faire ici

- numéroter ou émettre une facture, un avoir ou une commande
- faire calculer un montant par l’assistant
- rattacher une note de l’accueil à un projet : il faut créer le dossier, à la main ou en le demandant à l’assistant
- lancer un paiement ou une transmission vers une plateforme agréée
