# Gestion IA — État du projet

## Baseline fonctionnelle

BASELINE-7 — 70418dd — LOT-V3-005 validé

SHA :
70418ddc58da96cfb8a8a35095cb37b147d2f10f

## HEAD technique

db86439 — chore: ajoute le protocole de handoff IA

Ce commit ajoute uniquement le protocole .ai.
Il ne constitue pas une nouvelle baseline fonctionnelle.

## Lot actif

LOT-V3-006 — Confirmation et rejet par identifiant de Proposal

## État

CORRECTIONS AVANT RECETTE

L'implémentation du ciblage par ID est réalisée mais non commitée.

La revue Claude a validé :
- ciblage exact par ID ;
- isolation inter-conversation ;
- mauvais type refusé ;
- compatibilité historique ;
- AssistantTask ;
- texte libre ;
- propagation ID/type.

Elle a identifié deux blocages :
1. double exécution possible lors de confirmations concurrentes ;
2. course possible entre confirmation et rejet.

## Décision

Ajouter un claim atomique :

en_attente → en_cours

avant toute écriture métier des Proposal confirmées.

BusinessPlanProposal dispose déjà de ce mécanisme et sert de référence.

## Backlog après LOT-V3-006

- expiration AssistantTask ;
- tests complets de route ;
- StructuredPlan fournisseur ;
- StructuredPlan produit ;
- StructuredPlan service ;
- atomicité CatalogProposal généralisée ;
- transaction BusinessPlan ;
- adresse contenant le mot « à ».

## Règle de travail

ChatGPT = architecture / arbitrage
Cursor = implémentation principale
Claude Code = revue indépendante ciblée
GitHub = source de vérité

Un seul outil modifie le code à la fois.
