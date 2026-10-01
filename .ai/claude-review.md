# LOT-V3-007 — Revue Claude : contrôle final après recette réelle

Outil : Claude (revue indépendante, lecture seule)
Baseline : BASELINE-8 — 4794328 — LOT-V3-006 validé
Objet : working tree après la recette PostgreSQL / Ollama consignée dans `.ai/cursor-report.md`, et modification de `structuredPlanGuide` faite pendant cette recette.

Aucun fichier source modifié. Aucun commit, aucun push. Pas de `git diff` disponible sur le poste dans cette session : les changements ont été identifiés par date de modification, puis comparés à la copie relue lors de la revalidation du MAJOR-1.

---

## 1. Working tree depuis la revalidation précédente

Parcours de `src/` (complet), `tests/`, `docs/`, `prisma/`, `scripts/` et de la racine.

| Fichier | Constat |
|---|---|
| `src/domain/structured-plan.ts` | **seul fichier source modifié** (36 751 → 37 384 octets) |
| `.ai/cursor-report.md` | section « Validation réelle PostgreSQL / Ollama » ajoutée |
| `next-env.d.ts`, `tsconfig.tsbuildinfo` | régénérés par Next / `tsc`, tous deux ignorés par `.gitignore` |

Aucun autre fichier de `src/`, `tests/`, `docs/`, `prisma/` ou `scripts/` n’a changé pendant la recette. Les fichiers NO CHANGE (`prisma/schema.prisma`, migrations, `src/lib/catalog-store.ts`, `src/lib/catalog-proposals.ts`, `src/domain/pricing.ts`, `src/lib/business-records.ts`) sont intacts. Aucune migration ajoutée.

---

## 2. Modification de `structuredPlanGuide`

Diff complet de `src/domain/structured-plan.ts` : une ligne du guide remplacée par cinq. Rien d’autre dans le fichier.

```
- "actions contient CREATE_CLIENT, CREATE_PROJECT, CREATE_SUPPLIER ou CREATE_PRODUCT.",
+ "Chaque action a les clés type et args. type vaut CREATE_CLIENT, CREATE_PROJECT, CREATE_SUPPLIER ou CREATE_PRODUCT.",
+ "L'objet contient toujours actions et missing. missing vaut [] si rien ne manque.",
+ "name reprend le libellé complet tel qu'il est écrit, préfixe compris, sans les mots service, prestation, fournisseur, produit, client ni dossier.",
+ "Exemple : « Ajoute le service Audit réseau » donne {"actions":[{"type":"CREATE_PRODUCT","args":{"name":"Audit réseau"}}],"missing":[]}.",
+ "N'envoie pas reference, unit, description ni family si le mot référence, unité, description ou famille n'est pas écrit. Un montant, un euro ou un prix n'est recopié dans aucun champ.",
```

`structuredPlanGuide()` n’est utilisé que par `src/lib/structured-plan-read.ts`, comme message système envoyé à Ollama. C’est une consigne au modèle, pas une règle serveur.

| Question | Réponse |
|---|---|
| Le parseur est-il relâché ? | Non. `parseStructuredPlan`, `readPlan`, `readAction`, les ensembles de clés, `FORBIDDEN` et `anchored` sont identiques. |
| Le contrat JSON serveur change-t-il ? | Non. Clés de plan, clés d’action, args autorisés, limites et `ACTION_MAX` inchangés. Le guide décrit le contrat existant (`type` + `args`, `missing` obligatoire). |
| Une validation déterministe est-elle contournée ? | Non. Forme, matrice, ancrage, omission, `already`, `contact-differs` s’appliquent après le guide, comme avant. |
| Nouvelle capacité hors lot ? | Non. Mêmes quatre types, pas de prix, pas d’UPDATE, pas de `supplierName`, `kind` toujours interdit au modèle (« N’envoie pas kind » conservé). |
| Conforme à la spécification consolidée ? | Oui sur le contrat (section N). Deux effets de bord mineurs sur le nom, voir MINOR-1 et MINOR-2. |
| Régression client / projet, supplier, product, service ? | Aucune côté serveur (voir section 3). |

L’exemple donné dans le guide est accepté par le serveur tel quel (`create_product`, kind `service`).

---

## 3. Vérifications exécutées

Fonctions réelles du working tree, appelées sur une copie locale.

### Parseur toujours strict

Message : `Ajoute le service Audit réseau`.

| Sortie du modèle | Résultat |
|---|---|
| clé `action` au lieu de `type` | refusé au parsing |
| `missing` absent | refusé au parsing |
| clé en trop dans l’action | refusé au parsing |
| type `CREATE_SERVICE` | refusé au parsing |
| `costStated`, `supplierName`, `id` dans les args | refusé au parsing |
| nom `service Audit réseau` | refusé au parsing |
| exemple du guide | `catalog` (`create_product`, kind `service`) |

Les deux sorties qui bloquaient la recette (`action`, `missing` absent) restent refusées : le correctif a bien porté sur la consigne, pas sur le parseur.

### Non-régression

- Formes : `supplier`, `product`, `service`, `client-or-project`, `null` identiques à la revalidation précédente sur les 19 phrases de contrôle.
- Couple client + projet (trois phrases) : `business`.
- Phrases du MAJOR-1 : `client-or-project` ; un plan produit dessus → `clarify`.
- Fiche en attente : `new_intent` pour les formes catalogue, `correction` pour la correction seule.

### Tests

Liste complète de `npm test`, rejouée par Claude sur une copie locale : **393 tests, 393 succès, 0 échec**. Identique au rapport Cursor.

`tsc --noEmit` non rejoué ici (pas de `node_modules`) : succès repris du rapport Cursor.

---

## 4. Recette réelle (rapport Cursor)

Non rejouable par Claude (PostgreSQL et Ollama locaux). Éléments pris en compte tels que consignés :

- application locale, PostgreSQL réel, Ollama réel (`qwen2.5-14b-instruct`), aucun mock ;
- confirmations et rejets par `proposalAction` avec l’identifiant de la proposition ;
- 14 scénarios OK : fournisseur, fournisseur avec e-mail, non-confusion avec un client existant, produit, famille explicite, service, prestation, `Service Premium` avec / sans déterminant, montant, entité existante, référence numérique, client + projet, fiche client en attente, nettoyage ;
- aucune écriture avant confirmation, aucun fournisseur caché (`supplierId` vide), provenance `ollama` ;
- nettoyage : comptes de tables identiques à l’avant-recette ;
- 393/393 tests, typecheck réussi.

Ces résultats sont cohérents avec le code relu : chaque comportement décrit correspond à une branche vérifiée dans les revues précédentes.

---

## 5. Anomalies

CRITICAL : aucune.

MAJOR : aucune.

### MINOR

**MINOR-1 — `Ajoute Service Premium` finit en clarification avec le modèle réel.**
Écart relevé par Cursor : le modèle émet `CREATE_PRODUCT`, la forme reste `client-or-project`, le serveur répond `clarify`, rien n’est écrit. Vérifié : `CREATE_PRODUCT` sur cette phrase → `clarify` ; `CREATE_CLIENT Service Premium` → `create_client`. Le serveur est conforme. Mais le manuel écrit « `Ajoute Service Premium` … reste une création de client », ce qui n’est plus ce que l’utilisateur observe avec ce modèle. À aligner : soit une phrase du manuel (« l’assistant demande une précision »), soit un exemple client dans le guide. Non bloquant : échec sûr, sans écriture.

**MINOR-2 — Le guide demande un nom « sans le mot service ».**
Pour `Ajoute le Service Premium`, la spécification attend le nom `Service Premium`. Avec la nouvelle consigne, le modèle peut rendre `Premium`. Les deux sont acceptés par le serveur (vérifié : `Service Premium` et `Premium` → `create_product`, kind `service`). Le nom apparaît sur la carte avant confirmation. Le rapport de recette ne dit pas quel nom a été proposé. Même effet possible pour un nom qui contient `Client` ou `Dossier` (« Dossier Médical SARL »). À observer lors d’une prochaine recette ; au besoin, préciser « sans le mot de rôle qui précède le nom ».

**MINOR-3 — Le guide n’est couvert par aucun test.**
Aucun test ne lit `structuredPlanGuide`. Un test court (présence de `type`, `args`, `missing`, des quatre types, de « N’envoie pas kind ») éviterait qu’une future réécriture du guide rebloque Ollama sans alerte.

**MINOR déjà connus, inchangés** (à reporter au backlog de `.ai/project-state.md`) :

- `classifyPendingTurn` lit la forme sans les refus d’éligibilité ;
- forme `null` traduite par la logique client / projet dans `translateStructuredPlan` ;
- contact écrit dans une phrase produit / service non signalé comme omis ;
- limites documentées : `réf` / `ref`, `Création d’un service`, noms de moins de trois caractères utiles, adresse coupée au mot « à », fiche en attente + `Ajoute Martin comme client, son email est …`.

---

## 6. Conclusion

La seule modification source introduite pendant la recette est le texte de `structuredPlanGuide`. Elle précise au modèle le contrat déjà imposé par le serveur et ne touche ni au parseur, ni aux validations, ni au périmètre. Les sorties fautives du modèle restent refusées. La suite complète est verte (393/393) et la recette réelle est consignée comme réussie, nettoyage compris. Les trois points mineurs relevés concernent la formulation du guide, le manuel et un test de garde ; aucun ne bloque le commit.

---

## Verdict

GO COMMIT LOT-V3-007
