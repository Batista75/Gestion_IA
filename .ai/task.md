# LOT-V3-007 — Audit StructuredPlan fournisseur / produit / service

## OUTIL DESTINATAIRE

CURSOR

## MODE

AUDIT EN LECTURE SEULE

Ne modifie aucun fichier.
Ne commit pas.
Ne push pas.
Ne crée aucune migration.
Ne modifie pas Prisma.
Ne modifie pas PostgreSQL.

## Baseline

BASELINE-8 — 4794328 — LOT-V3-006 validé

SHA complet :

479432872e5148efbb475df2ff1ff57d9042a866

Le HEAD technique peut contenir des commits `.ai/` postérieurs.
La baseline fonctionnelle reste celle-ci.

---

# 1. Objectif du lot

Étendre StructuredPlan au-delà de :

- CREATE_CLIENT
- CREATE_PROJECT

pour préparer la prise en charge de :

- CREATE_SUPPLIER
- CREATE_PRODUCT
- CREATE_SERVICE

sans transformer StructuredPlan en planner générique.

Le principe reste :

Utilisateur
→ compréhension IA
→ StructuredPlan strict
→ validation serveur
→ CatalogProposal
→ confirmation
→ écriture métier

Le modèle ne doit jamais écrire directement.

---

# 2. Questions à trancher

L’audit doit déterminer :

1. quels ActionTypes existent déjà ;
2. quels CatalogCommand existent déjà ;
3. quelles créations fournisseur / produit / service existent déjà côté métier ;
4. quels parsers déterministes les couvrent déjà ;
5. quels champs sont obligatoires ;
6. quels champs peuvent être omis ;
7. quels champs doivent être ancrés dans le message utilisateur ;
8. quelles ambiguïtés de routage risquent d’intercepter StructuredPlan ;
9. comment traduire proprement StructuredPlan vers CatalogProposal ;
10. s’il faut réellement trois ActionTypes ou seulement deux selon le modèle de données actuel.

---

# 3. StructuredPlan actuel

Inspecter notamment :

- `src/domain/structured-plan.ts`
- validateurs associés
- tests StructuredPlan
- helpers d’ancrage
- `plainLabel`
- détection des champs omis
- limites de nombre d’actions
- types d’actions autorisés aujourd’hui

Produire la structure exacte du contrat actuel.

---

# 4. CREATE_CLIENT et CREATE_PROJECT comme références

Documenter précisément :

```text
message utilisateur
→ sortie Ollama
→ parseStructuredPlan
→ validation/ancrage
→ traduction
→ Proposal
```

Identifier les fonctions exactes.

Nous voulons réutiliser le même modèle, pas créer un deuxième mécanisme.

---

# 5. Fournisseur

Chercher :

- modèle Supplier ;
- Organization éventuelle ;
- CatalogCommand fournisseur ;
- parser de création fournisseur ;
- `createParty` ou helper équivalent ;
- données minimales ;
- `nameKey` ;
- adresse ;
- contact ;
- téléphone ;
- email ;
- SIRET / VAT / identifiants si présents ;
- notes ;
- encours / délai éventuels.

Répondre :

## Champs obligatoires minimum

## Champs facultatifs

## Contraintes d’unicité

## Normalisations

## Règles existantes

## Risques de duplication

---

# 6. Produit

Chercher :

- modèle Product ;
- CatalogCommand produit ;
- parser actuel ;
- famille/catégorie ;
- fournisseur éventuel ;
- coût ;
- prix ;
- référence fournisseur ;
- unité ;
- description ;
- nameKey ou autre contrainte.

Répondre :

## Champs obligatoires minimum

## Champs facultatifs

## Contraintes d’unicité

## Champs financiers sensibles

## Champs que le modèle ne doit jamais inventer

---

# 7. Service

Déterminer d’abord si l’application possède réellement :

```text
Service
```

comme entité distincte.

Si oui :
- documenter son modèle et ses commandes.

Si non :
- déterminer comment les services sont représentés aujourd’hui :
  - Product avec famille/type ;
  - CatalogItem ;
  - autre entité.

NE PAS inventer une nouvelle entité.

Donner un verdict :

`SERVICE ENTITÉ DISTINCTE`

ou

`SERVICE REPRÉSENTÉ PAR ...`

---

# 8. CatalogCommand

Lister les commandes actuelles liées à :

- create_supplier
- update_supplier
- create_product
- update_product
- éventuel service

Pour chaque commande :

| Commande | Champs | Validation | Écriture métier | Proposal actuelle |
|---|---|---|---|---|

---

# 9. Parsers déterministes

Identifier tous les chemins qui peuvent déjà reconnaître des formulations comme :

```text
Ajoute le fournisseur ACME
Crée un fournisseur ACME
Ajoute le produit Switch X
Ajoute une prestation Audit réseau
```

Chercher notamment :

- `parseCatalogCommand`
- `identifyClient`
- helpers de catalogue
- route assistant
- `answerDirectly`
- priorité des parsers

Important :

StructuredPlan ne doit pas être ajouté derrière un parser trop permissif qui capte déjà la phrase.

---

# 10. Ordre de routage

Cartographier l’ordre actuel de traitement d’une phrase naturelle :

```text
read
update
deterministic parser
StructuredPlan
clarification
```

ou l’ordre réel.

Identifier précisément où doivent passer :

```text
Ajoute le fournisseur ACME
Ajoute le produit Switch X
Ajoute le service Audit réseau
```

---

# 11. Ancrage fournisseur

Proposer la règle d’ancrage minimale.

Exemple :

Utilisateur :

```text
Ajoute le fournisseur ACME, email contact@acme.fr
```

Le modèle ne peut pas proposer :

```text
name = ACME France
```

si `ACME France` n’apparaît pas.

Même règle pour :

- email ;
- téléphone ;
- adresse ;
- identifiants.

Réutiliser les helpers existants si possible.

---

# 12. Ancrage produit

Exemples :

Utilisateur :

```text
Ajoute le produit Switch X200
```

Plan acceptable :

```text
name = Switch X200
```

Plan interdit :

```text
name = Switch X200 Pro
```

si `Pro` n’est pas présent.

Pour les prix/coûts :

le modèle ne doit jamais produire un montant absent du texte.

Identifier les validateurs existants réutilisables.

---

# 13. Service

Si le service est un produit catégorisé, définir ce que StructuredPlan devrait produire.

Exemple possible :

```text
CREATE_PRODUCT
name = Audit réseau
family = prestation
```

Seulement si cela correspond réellement au modèle métier.

Ne rien inventer.

---

# 14. Champs omis

Pour chaque type, déterminer les champs explicitement détectables dans le message mais omis par Ollama.

Exemple fournisseur :

```text
Ajoute ACME comme fournisseur, email contact@acme.fr
```

si le plan contient seulement :

```text
name = ACME
```

le serveur doit-il refuser pour champ omis ?

Documenter les règles existantes et proposer les extensions minimales.

---

# 15. Références existantes

Pour fournisseur / produit, analyser le comportement si une entité du même nom existe déjà.

Ne pas transformer CREATE en UPDATE silencieusement.

Attendu probable :

```text
CREATE + exact existing
→ clarification / refus / commande existante
```

Documenter le comportement actuel et recommander la règle.

---

# 16. Multi-actions

Évaluer si V1 doit autoriser :

```text
CREATE_SUPPLIER
+
CREATE_PRODUCT
```

dans un même StructuredPlan.

Exemple :

```text
Ajoute le fournisseur ACME et le produit Switch X fourni par ACME
```

Ne pas supposer que c’est nécessaire.

Classer :

`IN V1`

ou

`OUT V1`

avec justification.

---

# 17. Références entre actions

Si un produit peut référencer un fournisseur :

- le plan peut-il référencer une action précédente ?
- ou cela nécessiterait-il un identifiant inventé/interne ?

Rappel :

les IDs ne doivent pas venir du modèle.

Si le lien nécessite une résolution complexe, recommander de le laisser OUT V1.

---

# 18. Limites V1

Proposer un périmètre minimal robuste.

Exemple possible :

```text
CREATE_SUPPLIER
- nom
- email
- téléphone
- adresse

CREATE_PRODUCT
- nom
- famille/type
- référence
```

mais uniquement si le code actuel le justifie.

---

# 19. UPDATE

Ne pas implémenter UPDATE dans cet audit.

Mais déterminer si :

- UPDATE_SUPPLIER
- UPDATE_PRODUCT

existent déjà côté CatalogCommand.

Classer :

`OUT LOT-V3-007`

sauf nécessité architecturale démontrée.

---

# 20. Prix et coûts

Inspecter les règles métier existantes.

Rappel :

les montants doivent rester déterministes.

Déterminer si StructuredPlan V1 doit accepter :

```text
coût = 100 €
prix = 150 €
```

lorsqu’ils sont explicitement fournis.

Ou s’il vaut mieux les laisser OUT V1.

Donner une recommandation.

---

# 21. Risques de collision sémantique

Tester mentalement :

```text
Ajoute Orange comme fournisseur
Ajoute Paris comme produit
Ajoute Service Premium
```

Éviter qu’un mot soit interprété comme :

- client existant ;
- ville ;
- fournisseur ;
- nom de projet.

Identifier les protections déjà disponibles.

---

# 22. Sortie Ollama

Proposer le JSON minimal attendu pour chaque nouveau type.

Exemple conceptuel seulement :

```json
{
  "actions": [
    {
      "type": "CREATE_SUPPLIER",
      "args": {
        "name": "ACME"
      }
    }
  ],
  "missing": []
}
```

Ne pas implémenter.

---

# 23. Validation serveur

Proposer précisément :

- clés autorisées ;
- clés interdites ;
- limites de longueur ;
- valeurs fermées ;
- règles d’ancrage ;
- règles d’omission ;
- nombre maximal d’actions.

---

# 24. Traduction vers CatalogProposal

Pour chaque type, indiquer :

```text
StructuredPlan
→ CatalogCommand
→ CatalogProposal
```

avec les fonctions existantes à réutiliser.

---

# 25. Tests à prévoir

Proposer au minimum :

## Supplier

- création simple ;
- email ancré ;
- adresse ancrée ;
- champ inventé refusé ;
- fournisseur existant ;
- champ présent mais omis.

## Product

- création simple ;
- famille valide ;
- famille inventée ;
- montant absent inventé ;
- produit existant.

## Service

Selon le modèle réellement trouvé.

---

# 26. Recette réelle future

Proposer 5 à 10 phrases utilisateur réalistes pour la future recette PostgreSQL/Ollama.

Inclure :

- formulations naturelles ;
- formulation courte ;
- ambiguïté ;
- entité déjà existante ;
- champ facultatif ;
- champ non supporté.

---

# 27. Impact fichiers

Lister les fichiers probablement concernés lors de l’implémentation.

Classer :

- MUST MODIFY
- MAY MODIFY
- NO CHANGE

---

# 28. Migration

Déterminer explicitement si une migration Prisma est nécessaire.

Préférence :

`AUCUNE MIGRATION`

si les entités existent déjà.

---

# 29. Périmètre recommandé

Donner :

## MUST LOT-V3-007

## SHOULD LOT-V3-007

## OUT

Éviter un lot trop large.

---

# 30. Estimation

Donner :

- complexité ;
- risque ;
- nombre d’itérations ;
- besoin ou non de Claude avant implémentation ;
- besoin ou non d’une recette Ollama réelle.

---

# 31. Contrôles techniques

En lecture seule, exécuter si possible :

```bash
npm test
./node_modules/.bin/tsc --noEmit
npm run lint
git diff --check
```

Ne pas lancer de commande qui modifie le dépôt.

---

# 32. Rapport attendu

Écrire le rapport dans :

`.ai/cursor-report.md`

Structure :

## A. Baseline

## B. StructuredPlan actuel

## C. Référence CREATE_CLIENT / CREATE_PROJECT

## D. Fournisseur

## E. Produit

## F. Service

## G. CatalogCommand

## H. Parsers déterministes

## I. Ordre de routage

## J. Ancrage fournisseur

## K. Ancrage produit

## L. Champs omis

## M. Entités existantes

## N. Multi-actions

## O. Références inter-actions

## P. UPDATE

## Q. Prix / coûts

## R. Risques sémantiques

## S. JSON cible

## T. Validation serveur

## U. Traduction Proposal

## V. Tests

## W. Recette future

## X. Fichiers impactés

## Y. Migration

## Z. MUST / SHOULD / OUT

## AA. Estimation

## AB. Contrôles techniques

## Verdict

Une seule valeur :

`GO CONCEPTION LOT-V3-007`

ou

`AUDIT INSUFFISANT`

Aucune modification.
