```
# Complément après revalidation Claude — obligatoire avant implémentation

La revalidation Claude conclut encore :

CORRECTIONS DE CONCEPTION

Les corrections suivantes complètent et remplacent les points correspondants de la conception précédente.

## MAJOR-A — fiche client en attente

Dans `src/domain/conversation-turn.ts`, une forme catalogue reconnue doit devenir une nouvelle intention AVANT toute détection de correction de fiche client.

Règle obligatoire :

structuredShape ∈ { supplier, product, service }
→ new_intent

Cette règle doit être évaluée avant `isDraftCorrection`.

Cas obligatoires :

Une ClientProposal est en attente.

Message :

`Ajoute ACME comme fournisseur, son email est contact@acme.fr`

Attendu :

- `new_intent`
- jamais `correction`
- aucune modification de la ClientProposal en attente
- passage vers StructuredPlan fournisseur

Même attendu pour :

`Ajoute ACME comme fournisseur, email : contact@acme.fr`

Une vraie correction seule :

`son email est nouveau@dupont.fr`

doit rester :

`correction`

`src/domain/conversation-turn.ts` devient MUST MODIFY.

`tests/conversation-turn.test.ts` devient obligatoire.

## Priorité des rôles explicites

Un rôle explicite avec `comme ...` l'emporte sur la forme service.

Exemples :

`Ajoute le Service Plus comme client`
→ forme client

`Ajoute la prestation X comme produit`
→ forme product

La forme `service` ne doit pas gagner si un rôle explicite
`comme client`, `comme fournisseur` ou `comme produit`
est présent.

Ajouter ces cas aux tests StructuredPlan.

## OUTSIDE_V0

Les mots hors périmètre suivants restent bloquants pour toutes les formes StructuredPlan :

- contrat
- intervention
- équipement
- réclamation
- retour
- catalogue
- article

Exemples à bloquer :

`Ajoute ACME comme fournisseur pour le contrat Dupont`

`Ajoute Switch X200 comme produit pour le contrat Dupont`

## Détection SIREN / SIRET / montant

Définir explicitement les détecteurs d'omission.

Montant :

- nombre accompagné de `€`
- `EUR`
- `euro`
- `euros`
- `$`
- `USD`

SIREN / SIRET :

- mot `siren` ou `siret`
- ou séquence de 9 chiffres
- ou séquence de 14 chiffres

Une séquence reconnue comme SIREN/SIRET ne doit pas être reclassée comme téléphone.

Ces champs restent OUT V1 :
leur présence dans la phrase provoque `omitted`.

## Référence et unité produit

Ne pas utiliser la règle des trois caractères utiles pour :

- `reference`
- `unit`

Autoriser leur ancrage par égalité exacte de segment dans le message.

Exemples valides :

`référence 123456`

`unité u`

`unité m2`

Le nom du produit reste soumis à `expressionAnchored`.

## Règle Service Premium

Documenter explicitement :

`Ajoute Service Premium`
→ forme client

`Ajoute le Service Premium`
→ forme service

Cette distinction doit être couverte par les tests et le manuel utilisateur.

## Fichiers à retenir

MUST MODIFY :

- `src/domain/structured-plan.ts`
- `src/app/api/assistant/route.ts`
- `src/domain/client-file.ts`
- `src/domain/conversation-turn.ts`
- `src/domain/catalog.ts`
- `tests/structured-plan.test.ts`
- `tests/client-file.test.ts`
- `tests/conversation-turn.test.ts`
- `docs/manuel-utilisateur.md`

MAY MODIFY / tests obligatoires :

- `src/domain/task-path.ts`
- `tests/task-path.test.ts`
- `tests/catalog-command.test.ts`
- `docs/technique/docs/orchestration.md`

NO CHANGE :

- `prisma/schema.prisma`
- `prisma/migrations`
- `src/lib/catalog-store.ts`
- `src/lib/catalog-proposals.ts`
- `src/domain/pricing.ts`
- `src/lib/business-records.ts`

## Rapport attendu

Réécrire `.ai/cursor-report.md`.

Le verdict final doit être exactement :

GO IMPLEMENTATION LOT-V3-007

ou

CONCEPTION ENCORE INCOMPLÈTE

Ne modifier aucun fichier source.
```


---

# Complément final après validation Claude — préserver client + projet

La validation finale Claude conclut encore :

CORRECTIONS DE CONCEPTION

Le dernier point bloquant concerne la non-régression du couple client + projet déjà livré.

## MAJOR-B — préserver la logique actuelle client / projet

La nouvelle fonction `structuredShape` ne doit pas redéfinir de manière restrictive la famille client / projet.

Conserver la reconnaissance actuelle pour les créations client, projet et client+projet.

Principe obligatoire :

- les nouvelles formes `supplier`, `product`, `service` sont ajoutées ;
- la logique actuelle client / projet reste compatible avec les comportements BASELINE-8 ;
- `comme client` sert à empêcher une mauvaise classification en `service`, mais ne doit pas limiter le plan à un seul `CREATE_CLIENT`.

La traduction client / projet conserve donc la logique actuelle de `translateStructuredPlan` :

- CREATE_CLIENT seul ;
- CREATE_PROJECT seul ;
- CREATE_CLIENT puis CREATE_PROJECT ;
- validation du couple via `projectRolesMatch` ;
- comportement existant pour client déjà présent + nouveau projet.

Cas de non-régression obligatoires :

`Nouveau client Dupont. Dossier Toiture pour Dupont.`

Attendu :
- comportement `business` inchangé ;
- création client + projet possible ;
- aucune régression vers `clarify`.

`Ajoute Dupont comme client et ouvre le dossier Toiture pour Dupont`

Attendu :
- comportement `business` inchangé ;
- `comme client` ne doit pas forcer un plan CREATE_CLIENT seul.

`Crée le client Dupont et ouvre le dossier Toiture pour Dupont`

Attendu :
- comportement `business` inchangé.

Ajouter ces cas aux tests de non-régression StructuredPlan.

## Référence produit numérique

Une référence produit de 9 ou 14 chiffres ne doit pas être confondue avec un SIREN ou un SIRET.

Pour les formes `product` et `service` :

- si une séquence suit explicitement le marqueur `référence`, elle est traitée comme référence ;
- elle ne doit pas être classée SIREN/SIRET uniquement à cause de sa longueur.

Exemple :

`Ajoute Switch X comme produit, référence 123456789`

Attendu :
- référence acceptée ;
- pas de `omitted` SIREN.

Ajouter un test.

## Rôles explicites multiples

Deux rôles différents dans la même phrase sont ambigus.

Exemple :

`Ajoute ACME comme client et comme fournisseur`

Attendu :

- aucune création ;
- `clarify` ou forme `null` ;
- jamais choix arbitraire d'un rôle.

Ajouter un test.

## Hors lot

Conserver au backlog :

avec une ClientProposal en attente,
`Ajoute Martin comme client, son email est ...`
peut encore être interprété comme correction de la fiche en attente.

Ne pas corriger ce comportement dans LOT-V3-007.

## Rapport attendu

Réécrire `.ai/cursor-report.md` avec la spécification consolidée finale.

Le verdict doit être exactement :

GO IMPLEMENTATION LOT-V3-007

ou

CONCEPTION ENCORE INCOMPLÈTE

Ne modifier aucun fichier source.
