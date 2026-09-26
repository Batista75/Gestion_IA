# Manuel utilisateur

Ce manuel décrit Gestion IA tel qu’il s’utilise aujourd’hui. Il est affiché dans l’application. La spécification du produit visé est un document à part : [Spécification fonctionnelle (PDF)](/documentation/specification).

Dernière mise à jour : 26 septembre 2026.

## Ouvrir l’application

Sur la machine Ubuntu, ouvrez [l’accueil](/). L’adresse locale est `http://127.0.0.1:3847`.

Huit entrées restent en place : Accueil, Assistant, Projets, Ventes, Achats, Banque, Pilotage et Plus. Le manuel se trouve dans l’en-tête et dans Plus.

Les données restent sur cette machine. L’assistant envoie le texte à Ollama sur le PC hôte du réseau local, pas à un service d’IA public.

## Accueil

**Nouvelle information** sert à déposer un texte : une instruction, une description de pièce, un besoin. Le bouton **Enregistrer dans À classer** ajoute la note à la liste « À classer ». Le message de confirmation est : « Enregistré dans « À classer ». Aucun projet n’a été créé. »

Une information trop courte, moins de 3 caractères, n’est pas enregistrée.

**À valider** est vide. Les propositions de prix, de tiers ou de rapprochement n’apparaissent pas encore.

**Projets récents** reprend les six derniers dossiers. **Tous les projets** ouvre la liste complète.

## Projets

**Nouveau dossier** demande :

- **Nom du projet**, au moins 2 caractères
- **Client principal**, au moins 2 caractères
- **Prochaine action**, facultative. Si vous la laissez vide, l’application retient « Qualifier le besoin »

**Créer le dossier** ouvre le projet avec le statut **À qualifier**. La date d’ouverture s’affiche dans la liste. Créer un projet est une action explicite : une note de l’accueil ne le fait pas.

## Ventes

**Aide à l’établissement du prix** calcule trois montants hors taxes à partir du coût direct, du taux de marque visé et de la remise client. Ce n’est pas un devis émis : il n’y a ni numéro, ni TVA, ni envoi.

Les taux s’écrivent en pour cent. Une marque de 30 % se saisit `30`, pas `0,30`. La marque et la remise doivent rester strictement inférieures à 100 %.

Formules, sur le prix net HT :

- prix net = coût / (1 − taux de marque)
- prix affiché = coût / [(1 − taux de marque) × (1 − remise)]

Exemple de la spécification : coût `700`, marque `30`, remise `10`. Le prix affiché est 1 111,11 € HT, le prix net 1 000,00 € HT, la marge directe 300,00 € HT.

## Assistant

L’assistant prépare et explique. Il ne classe pas une pièce, n’émet pas de facture et ne calcule pas un prix. Une question chiffrée de prix, de TVA ou de marge reçoit la règle métier et renvoie vers Ventes.

Le bandeau **Inférence sur le PC hôte** indique si Ollama répond et l’adresse utilisée, par défaut `http://192.168.1.5:11434`. Choisissez un modèle de conversation. `qwen-dgfip-multisec-2ep:latest` convient. Les modèles d’embedding, comme `bge-m3` ou `nomic-embed-text`, ne répondent pas au chat.

La conversation n’est pas enregistrée. **Effacer** la retire de l’écran.

Si le badge indique **Ollama injoignable**, le PC hôte doit faire écouter Ollama sur le port `11434`, et le pare-feu Windows doit autoriser ce port depuis le réseau local. Dans une VM VirtualBox en NAT, l’adresse peut être `http://10.0.2.2:11434`.

## Achats, Banque et Pilotage

Ces trois écrans décrivent le comportement prévu. Ils ne saisissent pas encore de pièce, de relevé ou d’indicateur.

- **Achats** séparera l’offre, la commande, la réception, la facture et le paiement. Ces montants ne s’additionnent pas.
- **Banque** préparera un rapprochement à confirmer. Aucun paiement n’est lancé depuis l’application.
- **Pilotage** montrera le prévu, l’engagé, le facturé et le payé quand ces montants existeront. Tant qu’ils n’existent pas, aucun chiffre n’est inventé.

## Plus

**Plus** ouvre ce manuel et la spécification. Les clients, le catalogue, les exports, la sauvegarde et le connecteur de facturation électronique ne sont pas encore disponibles.

## Ce que vous ne pouvez pas faire ici

- numéroter ou émettre une facture, un avoir ou une commande
- faire calculer un montant par l’assistant
- rattacher une information à un projet sans créer vous-même le dossier
- lancer un paiement ou une transmission vers une plateforme agréée
