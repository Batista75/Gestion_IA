# LOT-V3-007 — Correctif MAJOR-1

La forme `service` était reconnue au milieu d’une phrase. `Ouvre le dossier Toiture pour Dupont et ajoute le service pose` et `Nouveau client Dupont, ajoute une prestation Audit` devenaient `service` au lieu de rester dans la famille client / projet.

## Correctif

Dans `src/domain/structured-plan.ts`, `SERVICE_SHAPE` est ancré au début de la phrase, après le `trim` déjà fait par `structuredShape`.

La forme reste :

`ajoute|crée|créer|création` + `le|la|un|une` + `service|prestation` + nom.

`Ajoute le service Audit réseau` et `Ajoute une prestation Audit réseau` restent des services. Une création de client ou de dossier qui cite un service plus loin reste `client-or-project`.

Les MINOR de la revue n’ont pas été traités.

## Tests ajoutés

`tests/structured-plan.test.ts`

1. `Ouvre le dossier Toiture pour Dupont et ajoute le service pose` → `client-or-project`, jamais `service`.
2. `Nouveau client Dupont, ajoute une prestation Audit` → `client-or-project`, jamais `service`.

## Résultats

Suite StructuredPlan : 91 tests, 0 échec.

`npm test` : 393 tests, 0 échec.

`./node_modules/.bin/tsc --noEmit` : succès.

`npm run lint` : 0 erreur, 4 avertissements déjà présents (`toState`, `dayKey`, deux balises `img`).

Aucun commit. Aucun push.

## Verdict

CORRECTION MAJOR-1 LOT-V3-007 TERMINE

## Validation réelle PostgreSQL / Ollama

Recette exécutée sur l’application locale (`127.0.0.1:3847`), PostgreSQL réel et Ollama réel (`http://192.168.1.5:11434`, modèle `richardyoung/qwen2.5-14b-instruct-abliterated:Q4_K_M`). Aucun mock. Les confirmations et les rejets passent par `proposalAction` avec l’identifiant de la proposition. Le préfixe des fiches de recette est `RecetteSept`. Le nettoyage a rendu les comptes de tables identiques à l’instant d’avant la recette. Aucune ligne de recette ne reste.

Le premier passage a été bloqué : le modèle renvoyait la clé `action` et omettait `missing`, donc le parseur refusait le plan et aucune fiche n’était proposée. Le guide de `structuredPlanGuide` a été précisé, sans élargir le parseur : clés `type` et `args`, `missing` toujours présent, nom complet sans le mot de rôle, exemple de service, montant jamais recopié. Après ce seul ajustement, la recette ci-dessous a réussi.

| Scénario | Résultat |
| --- | --- |
| Création fournisseur par StructuredPlan | OK. Fiche Fournisseur `RecetteSept Fournix`, aucune ligne avant confirmation, `modelVersion` `ollama`, statut `en_attente`, puis `confirmee` sur le même identifiant et fournisseur écrit. |
| Fournisseur avec e-mail | OK. E-mail affiché sur la fiche. Rejet `rejetee`. Aucun fournisseur écrit. |
| Non-confusion avec un client existant | OK. Le client `RecetteSept Partage` est confirmé, puis la même phrase « comme fournisseur » ouvre une fiche Fournisseur avec son e-mail. L’e-mail du client ne change pas. Le fournisseur est une ligne distincte. |
| Création produit | OK. Nature Produit, sans famille et sans fournisseur. Confirmation : `kind` `produit`, `supplierId` vide, nombre de fournisseurs inchangé, provenance `ollama`. |
| Produit avec famille explicite | OK. Famille Réseau affichée. Rejet : aucune ligne produit. |
| Création service | OK. Nature Service, sans famille. Confirmation : `kind` `service`, aucun fournisseur caché. |
| Prestation | OK. Nature Service, sans famille. Rejet : aucune ligne produit. |
| `Ajoute Service Premium` / `Ajoute le Service Premium` | OK. Sans déterminant : message de clarification client ou dossier, pas de fiche Service, aucune écriture. Avec déterminant : fiche Produit, nature Service, puis rejet, aucune écriture. |
| Montant écrit | OK. Aucune proposition. Réponse : le montant n’est pas pris en compte. Aucun produit créé. |
| Fournisseur ou produit déjà existant | OK. « existe déjà » pour les deux, sans nouvelle proposition, les comptes restent à une ligne. |
| Référence numérique | OK. Référence `123456789` sur la fiche, non lue comme un SIREN. Confirmation : référence enregistrée, aucun fournisseur caché. |
| Non-régression client + projet | OK. Plan d’affaire, provenance `ollama`, aucune écriture avant confirmation. Confirmation : client `RecetteSept Nestor` et dossier `RecetteSept Toiture`. Le couple Odile / Hangar est rejeté sans écriture. |
| Fiche client en attente + intention fournisseur | OK. La fiche client déterministe reste `en_attente` avec son e-mail. La phrase fournisseur ouvre une fiche Fournisseur distincte avec l’autre e-mail. Rejet des deux : aucune ligne client ni fournisseur. |
| Nettoyage | OK. Comptes de tables identiques à l’instant d’avant la recette. |

Écart relevé, sans échec de la recette : `Ajoute Service Premium` n’ouvre pas une fiche client. Le modèle émet `CREATE_PRODUCT`, la forme reste client ou projet, et le serveur clarifie sans écrire. La phrase avec déterminant ouvre bien la fiche service.

`npm test` : 393 tests, 0 échec.

`./node_modules/.bin/tsc --noEmit` : succès.

Aucun commit. Aucun push.

VALIDATION REELLE LOT-V3-007 OK
