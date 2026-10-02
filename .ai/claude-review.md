# LOT-V3-009 — Revue Claude : implémentation

Outil : Claude (revue indépendante, lecture seule)
Baseline : BASELINE-10 — LOT-V3-008 — c0562d37682236f5d45f4d60bb4254d65becb512
Objet : working tree du lot, contre `.ai/task.md` validé et la réserve R-1.

Aucun fichier source modifié. Aucun commit, aucun push. Seul ce fichier est réécrit.

Fichiers lus : `AGENTS.md`, `.ai/project-state.md`, `.ai/task.md`, `.ai/cursor-report.md`, `src/domain/business-context.ts`, `tests/business-context.test.ts`, les diffs de `src/app/api/assistant/route.ts`, `src/lib/conversations.ts`, `src/lib/assistant-stream.ts`, `src/components/assistant-chat.tsx`, `package.json`, `docs/manuel-utilisateur.md`, `docs/technique/docs/orchestration.md`.

Vérifications exécutées sur une copie locale, sans écriture dans le dépôt :

- `npm test` complet ;
- 48 phrases passées dans `buildBusinessContext` réel, avec les ancres réelles de `anchorMentions` ;
- 24 cas de résolution, 4 états de dossier, 16 phrases d’événement, panne, 13 cas de relecture du JSON ;
- 48 mutations du domaine et 8 mutations de la route, de l’écran et de la persistance, pour mesurer ce que les 29 tests détectent.

---

## 1. Verdict global

Le code implémente la conception validée et la réserve R-1. Aucun constat CRITICAL ni MAJOR. La persistance est sûre : aucun lecteur ne peut prendre `businessContext` pour une proposition ou une correction. Cinq constats MINOR, dont deux sur les tests.

**GO VALIDATION REELLE LOT-V3-009**

---

## 2. Constats CRITICAL

Aucun.

## 3. Constats MAJOR

Aucun. R-1 est tenu : dans S17, `5 500 € HT` n’est pas lié à `MSZ-AP35`.

---

## 4. Constats MINOR

### m-1 — Règles non isolées par les tests

Le code est conforme sur chaque point (exécuté directement). Les tests passent encore si la règle est retirée :

| Règle | Pourquoi le test ne la prouve pas |
|---|---|
| `GAP_MAX = 24` | aucun cas à la limite ; 10 ou 40 passent aussi |
| chiffre dans l’intervalle | S17 est aussi bloqué par `et` |
| `,` seule, `;` seul | seul `:` est testé |
| `ou`, `puis` | seul `et` est testé |
| autre ancre dans l’intervalle | S21 est aussi bloqué par `et` |
| plusieurs paires pour une quantité | aucun cas |
| mention sans fiche d’indice `supplier` comme cible | aucune valeur voisine dans S8 |
| deux indices comme cible | aucune valeur voisine |
| relecture avec une situation invalide | seules l’absence de clé et une clé en trop sont testées |
| `contentRead` à la relecture | aucun cas |

Une ligne de test chacune suffit. Exemples exécutés et conformes : intervalle de 24 caractères lié, de 25 non lié ; `4 unités Atlas MSZ-AP25` sans `et`, non lié ; `MSZ-AP25 pour 4 unités de MSZ-AP35`, `relation_not_deterministic`.

### m-2 — Garde-fous de persistance et d’écran partiels

- `storedMessage` n’est pas exercé. L’assertion sur les clés racine porte sur un objet écrit à la main dans le test. Un contexte étalé à la racine dans `conversations.ts` ne fait échouer aucun test (mutation exécutée). Le code actuel est correct ; la preuve réelle est le JSON en base, à la recette.
- Le test « pas de bouton » ne lit que `BusinessContextCard`. Un bouton ajouté dans `EntityLines` passe (mutation exécutée).

### m-3 — Limite de R-1 : item omis dont le nom n’a pas de chiffre

Exécuté : `ClimPro propose 2 pompes Atlantic et 3 unités MSZ-AP35 pour 5 500 € HT`, le modèle omet `pompes Atlantic` et rend `2 pompes`. Aucun chiffre n’est hors ancre. Le montant est lié à `MSZ-AP35`. R-1 tel qu’écrit est respecté. Piste pour un lot suivant : ne pas lier un montant quand la région retenue contient une quantité non reliée.

### m-4 — Même extrait rendu comme quantité et comme montant

Exécuté : le modèle rend `3 600 €` avec les deux types. Les deux ancres sont identiques, donc sans chevauchement. Deux relations sont créées vers le même item.

### m-5 — Écran

Une fiche connue s’affiche `ClimPro — ClimPro`, sans dire client ou fournisseur. Ni `documents`, ni `evidenceText` ne sont affichés. La conception ne l’exige pas.

---

## 5. Relations quantité / montant

| Contrôle | Constat exécuté |
|---|---|
| `GAP_MAX = 24` | conforme : 24 lié, 25 non lié |
| recherche dans les deux sens | conforme : `MSZ-AP25 pour 5 unités` et `900 € le MSZ-AP25` liés |
| autre ancre dans l’intervalle | bloquée : acteur, document, mention ambiguë |
| `,` `;` `:` | bloqués, chacun |
| `et`, `ou`, `puis` | bloqués, mots entiers, quelle que soit la casse ; `pour` et `etc` ne bloquent pas |
| chiffre dans l’intervalle | bloqué |
| répétition | aucune relation, `repeated_anchor` |
| chevauchement | aucune relation, `overlapping_anchor` |
| saut au-dessus d’une mention cross-family | aucun, avec ou sans `et` |
| aucun calcul | conforme : extraits et références d’ancre seulement |

Scénarios rejoués sur les phrases de `.ai/task.md` :

| | Résultat |
|---|---|
| S1 | `4 unités` et `3 600 € HT` liés à `MSZ-AP25` |
| S3 | `4 unités` et `4 200 € HT` liés à `XZ-999`, `unknown_entity` |
| S4 | montant non lié, `relation_not_deterministic` ; `2` et `3` sont des ancres répétées |
| S4 avec `2 unités`, `3 unités` | quantités liées, montant non lié |
| S5 | `900 €` lié à `MSZ-AP25`, `1 200 €` lié à `MSZ-AP35` |
| S17 | aucune relation ; montant `relation_not_deterministic` |
| S18 | aucune relation, `repeated_anchor` |
| S19 | aucune relation, `unlinked_quantity` |
| S20 | `900 €` lié à `MSZ-AP25` |
| S21 | aucune relation, `unlinked_quantity` |

**R-1.** Trois variantes de S17 exécutées : le modèle rend `2`, `MSZ-AP35` et le montant ; seulement `MSZ-AP35` et le montant ; ou `2 unités`, `3 unités`, `MSZ-AP35` et le montant. Dans les trois, `5 500 € HT` n’est pas lié. Retirer la condition fait échouer un test.

**Segment divergent.** `MSZ-AP25 : 3 600 € le MSZ-AP35` : la paire désigne `MSZ-AP35`, le segment `MSZ-AP25`. Aucune relation, `relation_not_deterministic`. Même résultat pour `900 € le MSZ-AP25 et 1 200 € le MSZ-AP35` (second montant) et pour un montant entre deux items admissibles. Les deux mutations « paire seule » et « segment seul » font échouer un test.

## 6. Ancres

| Contrôle | Constat exécuté |
|---|---|
| texte présent une seule fois | conforme, compte des sous-chaînes |
| `slice(start, end) === text` | vérifié, avec la première occurrence |
| valeur prise dans une référence produit | `5` dans `MSZ-AP25` : aucune relation, ni pour la quantité ni pour le produit |
| quantité qui englobe l’item | aucune relation |
| montant partiellement recouvert | `3 600` sur `3 600 € HT` : le montant n’est plus lié, la quantité `4 unités` le reste |
| indices multiples sur la même ancre | une seule mention, indices dans un ordre fixe, `model_hint_ambiguity`, pas de vue sans fiche, jamais cible |

L’ordre du modèle ne choisit pas l’indice : `product` puis `supplier` et `supplier` puis `product` donnent le même résultat.

## 7. Résolution

Les neuf croisements indice × table donnent tous une résolution : l’indice ne filtre jamais.

| Cas | Constat exécuté |
|---|---|
| fiche unique, indice conforme | `resolved`, `conflict` faux |
| fiche unique, indice contraire | `resolved` sur la fiche, `conflict` vrai, `role_conflict`, vue selon la fiche |
| indice `supplier`, seule fiche `Product` | `resolved`, famille `product`, vue `item`, `conflict` vrai |
| indice `product`, fiche de nature `service` | `entityType` `service`, `conflict` faux |
| Client + Supplier | `cross_family`, deux candidats, vue nulle |
| Supplier + Product, Client + Product, trois tables | `cross_family`, vue nulle |
| deux lignes d’une famille | `same_family`, vue de la famille |
| deux Supplier et un Client | `cross_family` |
| aucune fiche | `unresolved`, vue selon l’indice unique |
| nom proche (`Atlas SARL`) | `unresolved` |

Aucun `entityId` dans une résolution ambiguë ou inconnue.

## 8. Project

`projectContext` est le même objet que celui de la lecture, pour les quatre états. Un clone fait échouer quatre tests. `business-context.ts` n’importe pas `matchProjectContext` et ne reçoit pas la liste des dossiers. `answerFromSituation` ne lit pas `prisma.conversation`.

Une mention égale au nom du dossier est écartée des entités (`matched`, `current`, `ambiguous`). Une mention prise dans ce nom, comme `Dupont` dans `Climatisation Dupont`, reste une entité si une fiche porte ce nom : conforme à la conception, à observer en recette.

## 9. Event / documents

| Phrase | Résultat exécuté |
|---|---|
| `J'ai reçu le devis…` | `quote_received`, `devis` |
| `J'ai reçu l'offre…` | `offer_received`, `offre` |
| `Nous avons reçu le tarif…` | `price_received`, `tarif` |
| `J'ai reçu le chiffrage…` | `commercial_proposal`, `chiffrage` |
| `J'ai reçu la proposition…` | `commercial_proposal`, `proposition` |
| `ClimPro propose 4 unités…` | `commercial_proposal`, `propose` |
| `ClimPro propose un devis…` | `commercial_proposal`, `propose` |
| `…son tarif pour notre devis` | `unknown`, `null`, deux documents |
| `Dupont m'a envoyé 500 € d'acompte` | `unknown`, `null` |

`evidenceText` est une tranche exacte dans les 16 phrases, y compris `DEVIS`, `dévis` et `proposé`. `documents` vient du texte seul : une mention `document` du modèle sans rapport n’y entre pas.

## 10. Persistance

La colonne n’est lue que dans `presentConversation`, par cinq fonctions. Aucun autre consommateur, aucune logique « colonne non nulle ».

| Lecteur, sur `{ situation, businessContext }` | Résultat exécuté |
|---|---|
| `readStoredProposalCard` | `null` |
| `cardMayAct` | `false` |
| `readUnderstanding` | `null` |
| `readPacket` | `null` |
| `readStoredSituation` | lecture intacte |
| `readStoredBusinessContext` | contexte identique à l’objet écrit |

`readStoredBusinessContext` rend `null` : sans situation, avec une situation invalide ou nulle, avec une clé racine en plus (`fields`, `action`), avec `actors` ou `fields` dans le contexte, avec `contentRead` vrai, avec un événement hors liste.

`storedMessage` écrit exactement les deux clés pour un tour de lecture. Les messages de LOT-V3-008, à une seule clé `situation`, gardent leur carte de lecture et n’affichent pas de contexte. Réserve : m-2.

## 11. Panne Ollama

Exécuté sans mentions : dossier `matched`, événement `quote_received`, document `devis`, deux fichiers recopiés, `contentRead` faux ; `entities`, `quantities`, `amounts`, `relations` et `issues` vides ; provenance `{ origin: "none" }`. Aucun second modèle : `answerFromSituation` n’a qu’un appel, celui de la lecture.

## 12. UI

| Contrôle | Constat |
|---|---|
| titre `Contexte métier` | présent |
| bouton d’action | aucun dans le bloc et ses fonctions |
| `AssistantProposalCard` | non utilisé |
| connu / inconnu / conflit / cross-family | quatre formulations distinctes, plus l’homonyme |
| indices présentés comme hypothèses | `lu comme fournisseur par le modèle`, `indice du modèle : … ; fiche : …` |
| `aucune fiche de ce nom` | présent |
| `Nature détectée d’après les mots du message` | présent |
| `Contenu du fichier non utilisé pour ce contexte` | présent, seulement s’il y a un fichier |
| identifiant métier | aucun affiché |

Les vues filtrent `entities` par `view`. Une relation vers un item sans fiche porte `mention du modèle`. Les valeurs sans relation sont listées à part, sans les mots prix ou total. L’écran n’a pas été rejoué dans un navigateur, ni par Cursor ni par cette revue.

## 13. Architecture

Inchangés, vérifiés par empreinte : `src/domain/situation-reading.ts`, donc `situationModelGuide()` ; `src/lib/situation-reading-read.ts` ; `src/domain/structured-plan.ts` ; `src/domain/pricing.ts` ; `prisma/schema.prisma` ; `tests/situation-reading.test.ts`. `linkConversation` est absent du diff. Aucune migration nouvelle.

`business-context.ts` importe `catalog.ts` et `situation-reading.ts`, rien d’autre. `answerFromSituation` : un seul `readSituationMentions`, pas de `chatWithOllama`, `streamModel`, `modelInterpretation` ni `prisma.conversation`. Les fiches sont chargées une fois et servent aux deux projections.

Fichiers modifiés : les neuf annoncés, aucun autre.

## 14. Tests

| Commande | Résultat |
|---|---|
| `npm test` | relancé ici : 440 tests, 440 réussites, 0 échec |
| `./node_modules/.bin/tsc --noEmit` | non relancé ici : le registre de paquets de mon environnement refuse les dépendances (403). Vérification partielle : `business-context.ts` et ses imports passent en mode strict avec un compilateur local d’une autre version. Résultat Cursor : succès ; `tsconfig.tsbuildinfo` est postérieur à la dernière source |
| `npm run lint` | non relancé ici, même raison. Résultat Cursor : 0 erreur, 4 avertissements déjà présents |

| À prouver | Constat |
|---|---|
| S4 montant non lié | oui |
| R-1 | oui, la mutation fait échouer S17 |
| ancre répétée | oui |
| chevauchement | oui |
| segment divergent | oui, dans les deux sens |
| cross-family sans vue | oui |
| indice `supplier`, fiche `Product` | oui |
| `projectContext` recopié | oui, par identité d’objet |
| persistance sûre | oui pour les lecteurs ; partiel pour l’écriture (m-2) |
| absence de second appel | oui : second appel, `chatWithOllama` et `prisma.conversation` détectés |

32 mutations du domaine sur 48 sont détectées. Deux des 16 autres sont équivalentes ; les autres sont dans m-1. Le test d’ordre de LOT-V3-008 détecte toujours un gate déplacé.

Les tests S4 et S5 utilisent `2 unités`, `3 unités`, `1 unité`. Les phrases exactes de `.ai/task.md` ont été rejouées ici et sont conformes.

## 15. Points de recette réelle

PostgreSQL et Ollama réels. Compter `Project`, `Client`, `Supplier`, `Product`, `Quote` et les tables de propositions avant et après.

1. S1 depuis l’accueil : deux cartes, item avec quantité et montant, aucun bouton. En base, clés racine du message : `situation` et `businessContext`, rien d’autre.
2. Rechargement et réouverture du fil : mêmes cartes. Un fil de LOT-V3-008 garde sa carte de lecture, sans contexte.
3. Fournisseur et produit inconnus : `lu comme … par le modèle — aucune fiche de ce nom`. Aucune fiche créée.
4. Nom présent comme client et fournisseur : ligne sous `Mentions sans famille`, aucun rôle choisi.
5. `Notre client ClimPro nous a envoyé son devis` : noter l’indice rendu par le modèle ; s’il est `client`, ligne de conflit.
6. S4 et S5 avec le modèle réel : noter les extraits rendus (chiffre seul ou avec unité). Le montant de S4 n’est jamais lié.
7. Trois produits avec quantité et prix : plus de 8 mentions, contexte partiel.
8. Ollama coupé : dossier, nature, `Mentions non lues par le modèle`, un seul message, moins de 30 s.
9. Page d’un dossier : `Dossier ouvert`. Fragment depuis l’accueil, deux tours : `Aucun rattachement`, dans les deux cartes.
10. Fichier non reconnu : `Contenu du fichier non utilisé pour ce contexte`. Devis PDF reconnu : « La pièce a été analysée », pas de contexte.
11. Après un contexte, `Je confirme.` ne confirme rien. Une proposition fournisseur ouverte avant reste confirmable.
12. Cas à observer sans attendre de correction : `2 pompes Atlantic et 3 unités MSZ-AP35 pour 5 500 € HT` (m-3) ; `J'ai proposé un devis à Dupont pour 3 600 €` (nature `proposition commerciale`) ; `Dupont` pris dans le nom du dossier.
13. Relancer `tsc --noEmit` et `npm run lint` sur la machine, et vérifier le rendu dans le navigateur.

## 16. Verdict final

GO VALIDATION REELLE LOT-V3-009
