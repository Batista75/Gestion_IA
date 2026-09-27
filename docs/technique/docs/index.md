# Spécification technique

Ce site décrit le socle qui tourne. Les demandes sont dans `docs/fonctionnel`. Le PDF d’origine, `docs/specifications-gestion-ia.pdf`, est conservé, il n’est plus la base de revue. Le manuel dit ce que l’on fait à l’écran. Ici, c’est le fonctionnement.

Les états fait ou pas fait sont sur [Réalisations](realisations.md), le même tableau que le site fonctionnel et que Plus.

## Socle

Application Next.js, React et TypeScript, sur le réseau local. PostgreSQL est sur la même machine. Ollama est sur le PC hôte du réseau, par défaut `http://192.168.1.5:11434`. En NAT VirtualBox, l’adresse de repli est `http://10.0.2.2:11434`. Aucun service d’IA public n’est appelé.

L’accueil sert l’assistant. Le port de développement est `3847`.

Les prix, la TVA et les numéros de pièce ne sont pas calculés par le modèle. Les formules de prix de vente sont dans `src/domain/pricing.ts`. Un montant écrit par l’utilisateur est conservé tel quel.

## Lecture

- [Orchestration](orchestration.md)
- [Devis hybride](devis-hybride.md)
- [Recherche et modèles](recherche.md)
- [Données et projet](donnees.md)
- [Modélisation des données](modelisation.md)
- [Écrans](ecrans.md)
- [Écart](ecart.md)
- [Réalisations](realisations.md)
