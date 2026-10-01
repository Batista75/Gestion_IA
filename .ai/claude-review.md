# LOT-V3-007 — Revue Claude : implémentation

Outil : Claude (revue indépendante, lecture seule)
Baseline : BASELINE-8 — 4794328 — LOT-V3-006 validé
Référence : spécification consolidée finale (version de `.ai/cursor-report.md` validée « GO IMPLEMENTATION LOT-V3-007 »), puis rapport d’implémentation actuel de `.ai/cursor-report.md`.

Aucun fichier source modifié. Aucun commit, aucun push. Pas de `git diff` disponible sur le poste dans cette session : les fichiers modifiés ont été identifiés par leur date de modification, puis relus.

---

## 1. Fichiers modifiés

Modifiés après la validation de la conception :

| Fichier | Statut attendu | Constat |
|---|---|---|
| `src/domain/structured-plan.ts` | MUST | modifié |
| `src/app/api/assistant/route.ts` | MUST | modifié |
| `src/domain/client-file.ts` | MUST | modifié |
| `src/domain/conversation-turn.ts` | MUST | modifié |
| `src/domain/catalog.ts` | MUST | modifié |
| `tests/structured-plan.test.ts` | MUST | modifié |
| `tests/client-file.test.ts` | MUST | modifié |
| `tests/conversation-turn.test.ts` | MUST | modifié |
| `docs/manuel-utilisateur.md` | MUST | modifié |
| `tests/task-path.test.ts` | MAY / test obligatoire | modifié |
| `tests/catalog-command.test.ts` | MAY / test obligatoire | modifié |
| `docs/technique/docs/orchestration.md` | MAY | modifié |
| `src/domain/task-path.ts` | MAY | **inchangé**, conforme (l’éligibilité suffit) |
| `tsconfig.tsbuildinfo` | — | artefact de `tsc`, ignoré par `.gitignore` |

**NO CHANGE respecté :** `prisma/schema.prisma`, `prisma/migrations/*`, `src/lib/catalog-store.ts`, `src/lib/catalog-proposals.ts`, `src/domain/pricing.ts`, `src/lib/business-records.ts` ont leurs dates antérieures au lot.

**Aucune migration Prisma.** Dernière migration : `20260930140000_entree_depot`, antérieure à BASELINE-8.

**Aucun fichier inattendu modifié.**

---

## 2. Tests

### Rejoués par Claude

Sur une copie locale du code (domaine, route, tests, documents lus par les tests), sans écriture dans le dépôt :

- liste complète de `npm test` (`node --experimental-strip-types --test …`) : **391 tests, 391 succès, 0 échec** ;
- suite ciblée (`structured-plan`, `client-file`, `conversation-turn`, `catalog-command`, `task-path`, `intent-catalog`) : 151 tests, 0 échec.

Le total correspond au rapport Cursor (391). `tsc --noEmit` et le lint n’ont pas été rejoués (dépendances `node_modules` non disponibles ici) : chiffres repris du rapport Cursor.

### Tests présents et vérifiés

- client + projet : `folder` (`Nouveau client Dupont. Dossier Toiture pour Dupont.`) → `business`, client connu → `create_project` ; `Ajoute Dupont comme client et ouvre le dossier Toiture pour Dupont` (l. 794) ; `Crée le client Dupont…` ;
- fiche en attente : `…, son email est contact@acme.fr` et `…, email : contact@acme.fr` → `new_intent` ; `son email est nouveau@dupont.fr` → `correction` (`tests/conversation-turn.test.ts` l. 468–475) ;
- parcours suspendu : `Ajoute le service Audit réseau` ne reprend pas (`tests/task-path.test.ts` l. 82) ;
- enrichissement : client ACME existant, phrase fournisseur avec e-mail → pas d’enrichissement (`tests/client-file.test.ts` l. 285) ;
- carte : `Nature : Service`, `Famille : Réseau` (`tests/catalog-command.test.ts` l. 172) ;
- parseurs déterministes : `Ajoute le fournisseur ACME`, `Ajoute le produit Switch X` restent des commandes, forme `null`.

---

## 3. Vérification fonctionnelle exécutée

Les fonctions réelles du working tree ont été appelées sur les phrases du lot (copie locale).

### Client / projet (non-régression)

| Cas | Résultat |
|---|---|
| `Nouveau client Dupont. Dossier Toiture pour Dupont.` | éligible, `client-or-project`, `business` ; client connu → `create_project` |
| `Ajoute Dupont comme client et ouvre le dossier Toiture pour Dupont` | idem |
| `Crée le client Dupont et ouvre le dossier Toiture pour Dupont` | idem |
| `CREATE_CLIENT` seul | `create_client` |
| `CREATE_PROJECT` seul, client inconnu / connu | `unknown-client` / `create_project` |

La reconnaissance `client-or-project` équivaut à l’ancienne éligibilité : `BLOCKING_SHAPE` + `PARTY_WORD` couvrent exactement les mots de `OUTSIDE_V0`. `projectRolesMatch` et la traduction de BASELINE-8 sont conservés.

### Fournisseur / produit / service

| Cas | Résultat |
|---|---|
| `Ajoute ACME comme fournisseur` + `CREATE_SUPPLIER ACME` | `create_supplier`, siren/notes vides |
| même phrase + `CREATE_CLIENT ACME` | `clarify` |
| nom `ACME comme fournisseur` | refus au parsing |
| e-mail écrit, absent du plan | `omitted [email]` |
| fournisseur existant, e-mail différent | `contact-differs`, pas d’update |
| fournisseur existant, pas de contact | `already` `supplier` |
| `123456789` hors référence / `siret 123 456 789 00012` | `omitted [siren]` |
| `téléphone 06 12 34 56 78` | conservé comme téléphone |
| `Ajoute Switch X200 comme produit` | `create_product`, kind `produit`, `supplierName` vide |
| kind modèle `service` sur forme produit | `clarify` |
| `Switch X200 Pro` non écrit | refus au parsing |
| `famille réseau` absente du plan / présente | `omitted [family]` / `family: reseau` |
| `famille serveurs` | `clarify` |
| `Serveur Dell R750 comme produit` | pas de famille, pas d’omission |
| `référence 123456789`, `reference 12345678901234` | référence acceptée, pas de SIREN |
| `unité m2` | accepté |
| `Ajoute le service Audit réseau` / `une prestation Audit réseau` | kind `service`, famille vide |
| nom `service Audit réseau` | refus |
| `… Audit réseau à 150 €` | `omitted [amount]` |
| `Ajoute le Service Premium` | service `Service Premium` |
| `Ajoute Service Premium` / `Ajoute le Service Plus comme client` | `client-or-project` |
| `Ajoute la prestation Audit comme produit` | `product`, kind `produit` |
| deux rôles | `null` |
| `… pour le contrat Dupont` | `null` |
| produit existant | `already` `product` |

### Routage

- `classifyPendingTurn` : forme supplier/product/service → `new_intent` avant `isDraftCorrection`, après `CONFIRM`/`REJECT`. Conforme.
- `asksToEnrichRecord` / `enrichmentOwnsTurn` : faux pour ces trois formes. Conforme.
- Route : lecture `supplier` / `product` / `client` selon la forme du message, message `already` typé, `contact-differs` libellé fournisseur.
- Écriture : `openCatalogProposal` (avec provenance) ouvre une `CatalogProposal` ; aucune écriture avant confirmation ; `supplierName` vide, donc pas de `ensureSupplier`. Pas de création silencieuse.

---

## 4. Anomalies

### CRITICAL

Aucune.

### MAJOR

**MAJOR-1 — La forme service n’est pas ancrée en début de phrase et capte des phrases client / projet**

- Fichier : `src/domain/structured-plan.ts`, constante `SERVICE_SHAPE`, fonction `structuredShape`.
- Spécification : « Forme service … **Début de création** `ajoute|crée|créer|création`, puis un déterminant… ».
- Implémentation : `SERVICE_SHAPE = /\b(?:ajout…|cr[ée]e…|…)\s+(?:le|la|un|une)\s+(?:service|prestation)\s+\S/i`, testée n’importe où dans la phrase, avant la famille client / projet.

Résultats exécutés :

| Phrase | BASELINE-8 | Implémentation |
|---|---|---|
| Ouvre le dossier Toiture pour Dupont et ajoute le service pose | éligible, client / projet | forme **`service`** |
| Nouveau client Dupont, ajoute une prestation Audit | éligible, client / projet | forme **`service`** |

Conséquence : une phrase de création de dossier ou de client qui contient en seconde partie « ajoute le service … » sort de la famille client / projet. La matrice n’accepte alors qu’un `CREATE_PRODUCT` : le dossier ou le client demandé tombe en `clarify`, ou une proposition de service (par exemple « pose ») est ouverte à la place. Rien n’est écrit sans confirmation, mais c’est une régression du comportement client / projet, que la spécification exigeait de conserver, et un écart avec le « début de création » écrit.

Correction minimale : ancrer la forme en tête (`/^\s*(?:ajout…|cr[ée]e…|…)\s+(?:le|la|un|une)\s+(?:service|prestation)\s+\S/i`), et ajouter les deux phrases ci-dessus aux tests de non-régression client / projet (attendu : `client-or-project`).

### MINOR

**MINOR-1 — `classifyPendingTurn` lit la forme sans les refus d’éligibilité.** `N'ajoute pas ACME comme fournisseur, son email est …` (négation) devient `new_intent` au lieu d’être traité comme aujourd’hui. Pas de capture client, pas d’écriture : effet limité. Option : utiliser `structuredPlanEligible(text) && shape ∈ {…}`.

**MINOR-2 — Écart documenté sur `translateStructuredPlan`.** Une forme `null` continue sur la traduction client / projet (pour garder les tests existants à messages courts). La route ne présente un plan que si l’éligibilité est vraie, et un plan fournisseur/produit sur forme `null` finit en `clarify`. Acceptable ; à garder en tête si `translateStructuredPlan` est appelé ailleurs.

**MINOR-3 — Contacts écrits dans une phrase produit / service.** Un e-mail, un téléphone ou une adresse écrits dans une phrase `comme produit` ne sont pas détectés comme omis et disparaissent de la proposition. Conforme à la spécification (section D), mais l’utilisateur ne le voit pas. À noter au backlog.

**MINOR-4 — Limites documentées et acceptées :** `réf` / `ref` non reconnus ; `Création d’un service` / `Crée un nouveau service` non reconnus ; noms de moins de trois caractères utiles ; adresse coupée au mot « à » ; fiche client en attente + `Ajoute Martin comme client, son email est …` (hors lot). Toutes figurent dans le rapport Cursor et dans le manuel.

---

## 5. Tests manquants

- Les deux phrases du MAJOR-1 (« … pour Dupont et ajoute le service … », « Nouveau client Dupont, ajoute une prestation … ») → attendu `client-or-project`.
- Fiche en attente + phrase catalogue négative ou interrogative (MINOR-1), si la règle est resserrée.

Les autres tests exigés par la spécification sont présents et passent.

---

## 6. Conclusion

L’implémentation est conforme à la spécification sur l’essentiel : fournisseur, produit et service ajoutés avec une matrice stricte, kind imposé par le serveur, rôles et ambiguïtés traités, garde-fous fiche en attente et enrichissement en place, famille par marqueur seul, montants et SIREN/SIRET omis, référence numérique distinguée, `already` et `contact-differs` sans mise à jour, carte avec nature et famille, parseurs déterministes devant, aucune migration, aucun fichier NO CHANGE touché, 391 tests verts rejoués.

Un écart bloque la validation : la forme service est reconnue au milieu de la phrase au lieu du début, ce qui détourne des phrases client / projet de BASELINE-8. La correction est d’une ligne, plus deux tests.

---

## Verdict

CORRECTIONS IMPLEMENTATION LOT-V3-007
