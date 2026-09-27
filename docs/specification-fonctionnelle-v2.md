# Spécification fonctionnelle cible — Gestion IA V2

Ce document est la cible. Il ne décrit pas tout le socle déjà en service. Le [manuel](/manuel) dit ce qui fonctionne aujourd’hui. La [spécification technique](/documentation/technique) décrit le moteur livré.

Le premier écran de cette cible est en place : l’accueil demande ce qu’il faut faire, liste ce qui attend une confirmation, montre les projets récents et les alertes calculées à partir des fiches. Le menu regroupe Accueil, Projets, Ventes, Achats, Référentiels, Finance, Pilotage et Administration. Les listes techniques ne sont plus au premier niveau.

## Vision

L’utilisateur fournit une information, un document ou une intention. L’application comprend ce qui est fourni, le rattache au bon contexte, propose les actions, puis n’exécute qu’après validation lorsque le risque l’exige.

Ce n’est pas un ERP auquel on ajoute un chatbot. C’est un assistant métier avec un modèle de données professionnel.

## Principes

Le projet est l’unité centrale : clients, contacts, besoins, produits et services, devis, commandes, achats, fournisseurs, livraisons, factures, documents, activité, échéances et situation financière.

L’assistant est le point d’entrée : texte, fichier, devis, facture, commande ou information libre.

Toute action significative de l’IA est explicable, traçable, réversible autant que possible, et confirmée quand le risque l’exige.

Le modèle n’est pas la source de vérité. Les chiffres, statuts, montants et relations sont en base. L’IA comprend, extrait, rapproche, suggère et explique. Le moteur calcule, valide, enregistre, contrôle et fait changer les statuts.

## Navigation

Accueil, Projets, Ventes, Achats, Référentiels, Finance, Pilotage, Administration.

La recherche globale est dans la barre du haut. Les historiques de lignes, les regroupements et les textes ne sont plus des entrées de premier niveau.

## Accueil

Quatre zones.

L’assistant, en haut : « Que souhaitez-vous faire ? », texte et pièces jointes.

À traiter : propositions à confirmer, corriger, consulter dans la source, ou ignorer.

Projets récents, en cartes : nom, client, statut, montant des devis chiffrés, coûts, marge, prochaine action. Un montant absent reste « non indiqué ».

Alertes issues des fiches : confirmations en attente, notes hors projet, devis brouillons.

## Assistant

L’assistant est sur l’accueil. Une question sur un projet ouvert doit pouvoir s’appuyer sur ce projet sans que l’utilisateur répète tout le contexte. Cette lecture automatique du projet de la page n’est pas encore généralisée aux autres écrans.

Le traitement d’un message ou d’un document suit : réception, classement, extraction, rapprochement, contrôles, proposition, validation, exécution, journal, suggestion suivante.

Les pièces se classent notamment en devis client ou fournisseur, commande, facture, bon de livraison, demande de prix, document technique, contrat ou information libre.

L’extraction vise le tiers, la référence, la date, les produits, les services, les quantités, les prix, la devise, les conditions, la validité, les délais, le projet, les adresses et les contacts. Les montants écrits restent ceux de la pièce.

Chaque donnée extraite doit garder sa source. L’interface montre trois niveaux de confiance : élevée, moyenne, faible. Le score interne peut rester en base. Ces deux points ne sont pas encore généralisés.

## Projets et fiche

La liste des projets existe. Les filtres de statut, de client et de montant, ainsi que les statuts contrôlés (à qualifier, en préparation, en négociation, gagné, en exécution, livré, à facturer, clôturé, perdu, suspendu), sont la cible.

La fiche projet doit réunir synthèse, activité, ventes, achats, produits et services, documents, exécution et finance. Aujourd’hui, le dossier porte déjà l’activité, les pièces de vente et les produits. Les onglets complets restent à construire.

## Référentiels

Clients et fournisseurs ont une liste et une fiche. La cible ajoute les contacts séparés, le contrôle des doublons, et, pour un fournisseur, le catalogue, les prix, les devis, les commandes et les factures.

Un article est un produit ou un service : référence, désignation, famille, unité, description, fournisseur, coût unitaire écrit, devise, date de saisie. La cible sépare ensuite le produit des offres fournisseur : fournisseur, référence fournisseur, prix, devise, quantité minimale, remise, port, délai, date et validité. Un prix sans durée explicite sera valable 30 jours, durée configurable. Un prix historique n’est pas écrasé.

## Ventes et achats

Ventes : devis, puis commandes, livraisons, factures et avoirs. Le devis client peut déjà être préparé en brouillon. Les statuts envoyé, consulté, accepté, refusé et expiré, ainsi que le versioning d’un devis envoyé, sont la cible.

Achats : besoin, consultation, devis fournisseur, comparaison, commande, réception, facture, paiement. Le dépôt d’un devis fournisseur propose déjà une confirmation avant d’écrire les fiches.

## Documents et finance

Les documents se filtrent par type, projet, tiers, date et statut. Une pièce nouvelle reste à traiter tant qu’elle n’est pas confirmée.

Finance : facturation, échéances, banque, journaux. « À facturer » n’est pas « impayé ». Le rapprochement bancaire reste une proposition, jamais une décision automatique.

## Pilotage

Le tableau de bord donne la vision immédiate. L’analyse compare deux périodes. Une question de marge est traduite en indicateurs, calculée en SQL, puis expliquée. Le modèle ne calcule pas les totaux dans son texte.

## Recherche, notifications, administration

La recherche groupe les résultats par catégorie. Les notifications, les rôles, les règles automatiques et le journal distinguant action humaine, proposition d’IA et action validée sont la cible. Le journal actuel trace déjà les changements de fiche, avec l’auteur.

## Règles déjà posées

Un devis brouillon n’est pas envoyé. Une facture n’est pas émise ni numérotée par l’application. Le modèle n’a pas d’accès SQL libre : il appelle des outils métier. Les montants viennent du moteur de prix ou du texte écrit sur la pièce.

## Lots

1. Projet, clients, fournisseurs, produits, offres fournisseur, documents.
2. Assistant, classement, extraction, rapprochement, validation, traçabilité.
3. Devis, commandes, livraisons, consultations, achats.
4. Factures, échéances, banque, rapprochement.
5. Tableaux de bord, analyses, suggestions, automatisations.

Le succès se mesure ainsi : la plupart des tâches partent d’un document déposé, d’une question, ou d’un projet ouvert.
