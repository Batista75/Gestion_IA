# Données et projet

Chaque table, ses champs et ses liens sont dans [Modélisation des données](modelisation.md). Les paragraphes ci-dessous décrivent le journal, le dossier et la mémoire de pièce.

Chaque création, mise à jour et suppression d’un client, d’un fournisseur, d’un produit ou d’un projet écrit une ligne `RecordEvent` : type, identifiant, nom, action, résumé, source et horodatage. Le résumé ne cite que les champs qui changent, sous la forme `ancien → nouveau`. Un champ vide à l’origine est « non renseigné », un champ vidé est « retiré ». Une mise à jour sans différence n’écrit pas de ligne.

La source vient du contexte d’appel : `assistant` pour une confirmation, un dossier parlé ou une pièce confirmée ; `formulaire` pour les écrans ; sinon `application`. L’écriture est branchée sur le client Prisma. La rubrique `/evenements` réunit les lignes `RecordEvent` et `ProjectEvent`. Le filtre porte sur le texte, le type, une fiche ou un dossier. Supprimer les lignes cochées retire la trace. La fiche, le projet et les pièces restent. Les autres écrans renvoient vers cette rubrique.

L’auteur est l’initiale du prénom et le nom (`operatorMark` dans `src/domain/operator.ts`) de la personne connectée. `RecordEvent.actor` garde cette marque. Sans session, la marque par défaut reste J Smith. Le mot de passe est une empreinte scrypt sur `Account`.

## Vue projet

`/projets/[id]` charge le client lié (`Project.clientId`), le contexte du dossier, la livraison, les lignes `ProjectLine` et les documents `SaleDocument`. Le client, le produit et le fournisseur se choisissent dans les listes du répertoire. Le catalogue `Product` est unique : une ligne de dossier pointe vers un produit, elle n’en crée pas un autre. La livraison est saisie sur le dossier : destinataire, adresse, contact, créneau et mode. Elle est recopiée sur les pièces, sans devenir un bon de livraison numéroté. Une ligne porte un coût en centimes, un taux de marque et une remise, entiers de 0 à 99. Le prix de vente et la marge passent par `quoteFromTargetMarkup` dans `src/domain/pricing.ts`. Un coût absent laisse le prix non indiqué. Le total n’additionne que les lignes chiffrées.

Établir un devis copie les lignes sélectionnées. Un devis en cours devient une commande client, ou un devis non abouti. Une commande client ouvre une commande fournisseur par fournisseur nommé. Confirmer les chiffres écrit la date dans l’actualité du projet. Reprendre les chiffres retire cette confirmation. Aucun numéro de facture n’est attribué.

`/projets/[id]/documents/[documentId]` présente la pièce. Le devis et la commande client affichent le prix de vente HT. La commande fournisseur affiche le coût d’achat. `/projets/[id]/facture` reprend la dernière commande client et la référence saisie sur l’étape Facturation. Elle n’écrit pas de numéro. L’en-tête vient de `CompanyProfile` : raison sociale, coordonnées et logo dans `data/entreprise`. Le logo est servi par `GET /api/entreprise/logo`.

La fiche projet montre les produits et les devis dans la colonne principale, et le tableau des neuf étapes à droite sur un grand écran. Une seule étape est ouverte pour la saisie. Le parcours commercial est `ProjectStep`, une ligne par étape et par projet. Les neuf étapes, leurs actions et leurs preuves sont dans `src/domain/trade-workflow.ts` (`TRADE_STEPS`). Le fichier lu à l’écran et ajouté au prompt du modèle est `instructions/metiers/achat-revente-technologies.md`. Une situation « fait » exige une référence d’au moins deux caractères. L’avertissement d’ordre est indicatif : les étapes de remise et de réception attendent l’expédition, la facturation attend un bon de livraison ou un procès-verbal. `asksTradeWorkflow` répond avant la consultation des fiches. Si un seul projet est nommé, `listProjectSteps` et `projectTradeReply` décrivent la prochaine preuve.

## Mémoire de pièce

`DocumentMemory` garde, pour un nom de fichier, le projet, le type et la société corrigés. La clé est le nom seul, sans le dossier. Une autre pièce ne reçoit pas ces valeurs. Le répertoire des fournisseurs et des projets n’est pas modifié par cette écriture.
