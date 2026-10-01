# LOT-V3-006 — Revue Claude ciblée : corrections de concurrence

Outil : Claude (revue indépendante, lecture seule)
Baseline : BASELINE-7 — 70418dd — LOT-V3-005 validé
Périmètre : corrections MAJOR-1 / MAJOR-2 et mineures demandées dans `.ai/task.md`, compte rendu `.ai/cursor-report.md`.

Aucun fichier du code n’a été modifié. Aucun commit, aucun push.

Limites de la revue : lecture des fichiers de l’arbre de travail actuel. Pas de `git diff` contre `70418dd` (pas de shell sur le poste dans cette session). Tests, `tsc`, lint et build non relancés : les chiffres cités sont ceux du rapport Cursor (371 tests, 0 échec).

Fichiers lus : `AGENTS.md`, `.ai/project-state.md`, `.ai/task.md`, `.ai/cursor-report.md`, `src/domain/proposal-scope.ts`, `src/lib/{client-proposals,catalog-proposals,contract-reply,intervention-reply,equipment-reply,purchase-reply,claim-reply,business-plan-proposals,change-source}.ts`, `src/components/assistant-chat.tsx`, `tests/proposal-scope.test.ts`.

---

## 1. `runClaimedConfirmation` : un seul claim gagne — OK

`src/domain/proposal-scope.ts` :

```
if (!(await claim())) return { status: "lost" };
try { write → succeeded ? markConfirmed : markFailed }
catch { markFailed }
```

Le helper ne fait rien de lui-même : la garantie repose sur le `claim` fourni par chaque type. Dans les 9 types, ce `claim` est :

```
prisma.<X>Proposal.updateMany({
  where: { id: row.id, conversationId, status: "en_attente" },
  data:  { status: "en_cours" },
}) → count === 1
```

Sous PostgreSQL (READ COMMITTED), deux UPDATE conditionnels sur la même ligne sont sérialisés par le verrou de ligne : le second réévalue `status = en_attente` après le commit du premier et touche 0 ligne. Une seule requête obtient `count === 1`. Aucune écriture métier n’a lieu avant ce point, et le perdant renvoie `lost` sans écrire.

Verdict : la garantie est réelle.

## 2. Claim avant l’écriture métier, par type — OK pour les 9

| Type | Fonction | Claim avant écriture | Écriture sous claim | confirmee / echec conditionnels `en_cours` |
|---|---|---|---|---|
| ClientProposal | `applyClientProposal` | oui | `saveClientDraft` | oui |
| CatalogProposal | `applyCatalogProposal` | oui | `applyCatalogCommand` | oui |
| Contrat | `applyContractProposal` | oui | `contract.create` | oui |
| Intervention | `applyInterventionProposal` | oui | `intervention.create` | oui |
| Équipement | `applyEquipmentProposal` | oui | `installedEquipment.create` | oui |
| Achat | `applyPurchaseProposal` | oui | `purchaseFollowUp.create` | oui |
| Encours fournisseur | `applySupplierTermsProposal` | oui | `supplier.update` | oui |
| Réclamation | `applyClaimProposal` | oui | `claim.create` | oui |
| Retour | `applyReturnProposal` | oui | `returnRequest.create` | oui |

Les contrôles faits avant le claim sont seulement des lectures : payload lisible, client/fournisseur/dossier existant, `conversationId` non nul. Si l’un échoue, la ligne reste `en_attente` et rien n’est écrit. Le `still` non atomique de la version précédente a disparu.

Le chemin texte (`confirmLatestWrite` → `confirm*Proposal` → mêmes `apply*`) passe par le même claim. Un bouton et un « Je confirme. » simultanés sont donc aussi protégés.

## 3. Aucune relecture d’une autre proposition — OK

Après sélection, les `apply*` ne travaillent que sur `row.id` et le `conversationId` de la ligne. Claim, `markConfirmed` et `markFailed` filtrent tous sur `id` + `conversationId`. Aucun appel à `currentProposal`, `pending*Proposal` ou `findFirst … orderBy createdAt desc` après le claim.

Seule lecture postérieure : `prisma.clientProposal.count({ status: en_attente, conversationId })` dans `applyClientProposal`, qui sert uniquement au texte « Une autre proposition reste en attente ». Elle ne déclenche aucune écriture.

## 4. Confirmation et rejet simultanés — OK

Tous les rejets par ID (`reject*ById`) font `updateMany({ id, conversationId, status: "en_attente" } → rejetee)` et exigent `count === 1`.

- Le rejet gagne : la ligne est `rejetee`, le claim de la confirmation touche 0 ligne, `lost`, aucune écriture.
- La confirmation gagne : la ligne est `en_cours`, le rejet touche 0 ligne et renvoie `UNAVAILABLE_PROPOSAL`. La ligne finit en `confirmee` ou `echec`.

La combinaison « donnée métier écrite + proposition `rejetee` » n’est plus atteignable.

## 5. Rejets texte libre conditionnels — OK

`rejectContractProposal`, `rejectInterventionProposal`, `rejectEquipmentProposal`, `rejectPurchaseProposal`, `rejectSupplierTermsProposal`, `rejectClaimProposal`, `rejectReturnProposal`, et les branches catalogue et client de `rejectLatestWrite` utilisent toutes `updateMany` avec `status: "en_attente"` et vérifient `count === 1`. Si le compte n’est pas 1, la réponse est `UNAVAILABLE_PROPOSAL` et aucune annulation n’est annoncée.

Il ne reste aucun `<X>Proposal.update({ where: { id } }, status: "rejetee")` inconditionnel dans `src/lib`.

## 6. Erreur après claim → `echec` — OK, deux réserves mineures

- Exception dans `write` : `catch` → `markFailed` → `en_cours` → `echec`.
- Résultat refusé (`saved.ok === false` pour client et catalogue, par exemple P2002 ou nom invalide) → `markFailed` → `echec`.
- Aucun retour à `en_attente`, donc pas de seconde exécution.

Réserves (voir MINOR-1 et MINOR-2) :

- si le processus s’arrête entre le claim et `markConfirmed`/`markFailed`, la ligne reste `en_cours` sans reprise automatique (même comportement que BusinessPlanProposal) ;
- si `markConfirmed` lève après une écriture réussie, la ligne passe à `echec` alors que la donnée est écrite.

## 7. BusinessPlanProposal — inchangé et sûr

`src/lib/business-plan-proposals.ts` a la même date de modification que lors de la revue précédente. Le claim `updateMany({ id, status: en_attente, conversationId } → en_cours)` avec `count !== 1` reste placé avant `applyBusinessPlan`, et le règlement `confirmee`/`echec` est inchangé. **SAFE.**

## 8. `withChangeSource("assistant")` pour CatalogProposal — OK

`applyCatalogProposal` : `write: () => withChangeSource("assistant", () => applyCatalogCommand(command))`. Le chemin par ID (`confirmCatalogProposalById` → `applyCatalogProposal`) et le chemin texte ont donc la même origine dans l’historique. Les autres types gardent leur `withChangeSource("assistant")` autour de l’écriture.

## 9. Les tests prouvent-ils réellement le claim ? — Partiellement

Ajouts dans `tests/proposal-scope.test.ts` :

- deux confirmations concurrentes, confirmation et rejet concurrents, échec → `echec` : exécutés contre `createProposalLedger`, un faux en mémoire. Ils prouvent la logique de `runClaimedConfirmation` et l’ordre claim → écriture, mais **pas** le `updateMany` réel de chaque type. Une erreur dans un `where` (par exemple `status` oublié) ne serait pas détectée. La boucle `client`/`catalog` exécute deux fois le même test sur le même faux, sans rien de propre à chaque type ;
- « chaque type réclame la ligne » : recherches de chaînes dans les sources (`runClaimedConfirmation`, `status: "en_cours"`, absence de `Proposal.update(`). Utile contre une régression grossière, mais ne prouve pas que le claim précède l’écriture dans chaque fonction ;
- BusinessPlan : ordre `en_cours` < `applyBusinessPlan` vérifié par position dans le fichier ;
- état visuel des boutons : `proposalFollowUpState` testé correctement.

Conclusion : les tests prouvent le helper, pas le claim PostgreSQL de chaque type. Par lecture du code, les 9 claims sont corrects. La preuve réelle doit venir de la recette PostgreSQL (scénarios ci-dessous). C’est cohérent avec le backlog « tests complets de route » de `.ai/project-state.md`.

---

## Findings

Aucun CRITICAL. Aucun MAJOR.

**MINOR-1 — Ligne bloquée `en_cours` après arrêt du processus**
- Fichiers : les 9 `apply*` (et BusinessPlan, à l’identique).
- Scénario : arrêt du serveur entre le claim et `markConfirmed`/`markFailed`.
- Conséquence : la proposition reste `en_cours`, n’est plus actionnable et n’est pas rejouée. Aucune double écriture.
- Correction minimale : aucune dans ce lot. À traiter avec la reprise ou l’expiration au backlog.

**MINOR-2 — `markConfirmed` en erreur après une écriture réussie**
- Fichier : `src/domain/proposal-scope.ts`, `runClaimedConfirmation`.
- Scénario : l’écriture métier réussit, puis l’UPDATE `en_cours → confirmee` lève une erreur.
- Conséquence : le `catch` passe la ligne à `echec` alors que la donnée est écrite. Aucune double écriture.
- Correction minimale : sortir `markConfirmed` du `try`, ou laisser la ligne `en_cours` dans ce cas précis.

**MINOR-3 — Message trompeur sur exception**
- Fichiers : `contract-reply`, `intervention-reply`, `equipment-reply`, `purchase-reply` (achat, encours), `claim-reply` (réclamation, retour).
- Scénario : `prisma.<X>.create` lève une erreur après le claim.
- Conséquence : la ligne passe bien à `echec`, mais l’utilisateur lit « Cette proposition n’est plus disponible… » au lieu d’un échec d’enregistrement.
- Correction minimale : distinguer `outcome.status === "failed"` (« L’enregistrement n’a pas abouti. ») de `lost`.

**MINOR-4 — Faux de test dans le code de production**
- Fichier : `src/domain/proposal-scope.ts`, `createProposalLedger`.
- Conséquence : du code de test est livré dans le domaine.
- Correction minimale : le déplacer dans `tests/`.

**MINOR-5 — Tests de concurrence sur un faux**
- Fichier : `tests/proposal-scope.test.ts`.
- Conséquence : le `where` réel de chaque claim n’est pas exécuté par les tests.
- Correction minimale : couvrir en recette PostgreSQL ; tests de route au backlog.

Hors lot, signalé seulement : `rejectBusinessPlanProposal` (texte libre) est conditionnel mais ne vérifie pas `count` et annonce « Rien n’est enregistré. » même s’il a perdu la course. Le fichier n’a pas été modifié dans ce lot et la donnée métier reste protégée par le claim du plan.

---

## Scénarios à rejouer en recette PostgreSQL

1. Deux POST `proposalAction confirm` simultanés sur la même ClientProposal (client existant sans contact principal) : un seul `ok`, un seul Contact et une seule Address principaux, statut `confirmee`.
2. Idem CatalogProposal `create_project` et `record_quote` : un seul Project, un seul Quote.
3. Idem contrat, intervention, équipement, achat, réclamation, retour : une seule ligne métier créée.
4. `confirm` et `reject` simultanés sur une même proposition : soit `rejetee` sans ligne métier, soit `confirmee` avec une ligne métier et un rejet refusé.
5. Bouton « Confirmer » et « Rejette. » tapé en même temps : même résultat que 4.
6. Erreur forcée pendant l’écriture (client introuvable supprimé après la proposition, ou contrainte violée) : statut `echec`, second clic refusé.
7. Plan métier : double confirmation, un seul `applyBusinessPlan`.

---

## Verdict

GO RECETTE POSTGRESQL
