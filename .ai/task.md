# LOT-V3-007 — Correction de conception StructuredPlan

## OUTIL DESTINATAIRE

CURSOR

## MODE

CONCEPTION UNIQUEMENT

Ne modifie aucun fichier source.
Ne commit pas.
Ne push pas.
Ne crée aucune migration.
Ne modifie pas Prisma.
Ne modifie pas PostgreSQL.

## Baseline

BASELINE-8 — 4794328 — LOT-V3-006 validé.

La revue Claude LOT-V3-007 conclut :

CORRECTIONS DE CONCEPTION

## Objectif

Corriger uniquement la conception LOT-V3-007 à partir des quatre findings MAJOR de `.ai/claude-review.md`.

Ne pas implémenter.

## MAJOR-1 — Lier forme déterministe et ActionType

Concevoir une fonction unique, par exemple :

structuredShape(text)

qui retourne exactement :

client
project
client+project
supplier
product
service
null

à partir de formes fermées.

Minimum attendu :

supplier
→ "… comme fournisseur"
→ exactement CREATE_SUPPLIER

product
→ "… comme produit"
→ exactement CREATE_PRODUCT
→ kind forcé côté serveur à "produit"

service
→ "ajoute|crée + déterminant + service|prestation + nom"
→ exactement CREATE_PRODUCT
→ kind forcé côté serveur à "service"

Toute incohérence entre forme détectée et ActionType Ollama doit produire :

clarify / blocked

Jamais une autre création.

Le modèle ne choisit pas le kind final.

Le serveur le déduit de structuredShape.

Conserver les parseurs déterministes existants devant StructuredPlan.

`Ajoute le fournisseur ACME`
reste déterministe.

`Ajoute ACME comme fournisseur`
passe par StructuredPlan.

`Ajoute Service Premium`
ne doit pas devenir automatiquement un service.

## MAJOR-2 — Famille uniquement avec marqueur explicite

Ne plus inférer une famille parce qu’un mot du nom correspond à une valeur de PRODUCT_FAMILIES.

Exemples :

`Ajoute une prestation Audit réseau`

ne doit pas considérer `réseau` comme une famille.

`Ajoute Serveur Dell R750 comme produit`

ne doit pas considérer automatiquement `serveur` comme une famille.

La famille doit être portée uniquement par un marqueur explicite :

`famille réseau`
`famille prestation`
`famille serveur`

La détection d’omission ne porte également que sur ce marqueur explicite.

La forme :

`une prestation ...`

fixe seulement :

kind = service

Elle ne fixe pas automatiquement :

family = prestation

## MAJOR-3 — Empêcher l’enrichissement client de capturer une création catalogue

Analyser précisément :

enrichmentOwnsTurn
asksToEnrichRecord
explicitClientCreation

dans `client-file.ts`.

Le garde-fou doit exclure toute forme reconnue par :

structuredShape(text)

ou un helper catalogue dédié équivalent.

Cas obligatoire :

Client ACME déjà existant.

Message :

`Ajoute ACME comme fournisseur, email contact@acme.fr`

Attendu :

- aucune proposition de modification du client ACME ;
- StructuredPlan fournisseur ;
- jamais enrichissement client.

`src/domain/client-file.ts` devient MUST MODIFY lors de l’implémentation.

## MAJOR-4 — Consommateurs de structuredPlanEligible

Intégrer explicitement dans la conception :

src/domain/conversation-turn.ts
src/domain/task-path.ts
src/domain/client-file.ts

Décrire l’impact du nouvel élargissement de structuredPlanEligible.

Prévoir des tests de non-régression pour :

### Conversation pending

Une ClientProposal est en attente.

Utilisateur :

`Ajoute ACME comme fournisseur`

Attendu :

nouvelle intention StructuredPlan fournisseur.

Pas une correction de la fiche client en attente.

### Task suspendue

Un parcours est suspendu.

Utilisateur :

`Ajoute le service Audit réseau`

Attendu :

nouvelle intention StructuredPlan.

Pas reprise automatique du parcours.

### Client enrichment

Client ACME existant.

`Ajoute ACME comme fournisseur, email contact@acme.fr`

Attendu :

pas d’enrichissement client.

## Nom de l’entité

Ajouter une règle empêchant le rôle d’être absorbé dans le nom.

Refuser par exemple :

`name = "ACME comme fournisseur"`
`name = "service Audit réseau"`

Le nom attendu est :

`ACME`
`Audit réseau`

Réutiliser expressionAnchored et plainLabel, avec une règle supplémentaire de nettoyage/validation du rôle.

## Existing supplier / product

Conserver :

CREATE + entité existante
→ already
→ aucune CatalogProposal
→ aucune mise à jour silencieuse

Le type de already doit être explicite :

client
supplier
product

Pour un fournisseur existant avec email/téléphone différent :

prévoir l’équivalent de contact-differs.

Ne pas implémenter UPDATE.

## Carte de proposition

Passer à MUST :

la carte create_product doit afficher :

kind
family

quand ces valeurs existent.

L’utilisateur doit voir qu’il confirme :

produit

ou :

service

## Périmètre V1 confirmé

### IN

- CREATE_SUPPLIER
- CREATE_PRODUCT
- service via CREATE_PRODUCT + kind service
- nom
- fournisseur : email, téléphone, adresse
- produit : référence, unité, description, family explicite
- already avant proposition
- une seule action fournisseur ou produit

### OUT

- CREATE_SERVICE
- UPDATE_SUPPLIER
- UPDATE_PRODUCT
- prix
- coût
- TVA
- supplierName
- fournisseur + produit dans le même plan
- références entre actions
- SIREN porté par StructuredPlan
- création cachée de fournisseur
- migration Prisma

## Fichiers à retenir

### MUST MODIFY lors de l’implémentation

- src/domain/structured-plan.ts
- src/app/api/assistant/route.ts
- src/domain/client-file.ts
- src/domain/catalog.ts
- tests/structured-plan.test.ts
- tests/client-file.test.ts
- docs/manuel-utilisateur.md

### MAY MODIFY / tests obligatoires

- src/domain/conversation-turn.ts
- tests/conversation-turn.test.ts
- src/domain/task-path.ts
- tests/task-path.test.ts
- tests/catalog-command.test.ts
- docs/technique/docs/orchestration.md

### NO CHANGE

- prisma/schema.prisma
- prisma/migrations
- src/lib/catalog-store.ts
- src/lib/catalog-proposals.ts
- src/domain/pricing.ts
- src/lib/business-records.ts

## Recette future corrigée

Prévoir notamment :

1. Ajoute ACME comme fournisseur
2. Ajoute ACME comme fournisseur, email contact@acme.fr
3. client ACME déjà existant + phrase précédente
4. Ajoute Switch X200 comme produit
5. Ajoute Switch X200 comme produit, famille réseau
6. Ajoute le service Audit réseau
7. Ajoute une prestation Audit réseau
8. Ajoute Service Premium
9. Ajoute une prestation Audit réseau à 150 €
10. fournisseur/produit déjà existant

Attendus précis dans le rapport.

## Rapport attendu

Réécrire `.ai/cursor-report.md` avec une conception corrigée.

Structure minimale :

## A. structuredShape
## B. Matrice forme → ActionType
## C. Règles supplier
## D. Règles product
## E. Règles service
## F. Famille
## G. Enrichissement client
## H. Conversation pending
## I. Task suspendue
## J. Ancrage / nom
## K. Existing entities
## L. Carte
## M. Tests
## N. Recette future
## O. Fichiers
## P. Périmètre final
## Verdict

Une seule valeur :

GO IMPLEMENTATION LOT-V3-007

ou

CONCEPTION ENCORE INCOMPLÈTE

Ne modifier aucun fichier source.
