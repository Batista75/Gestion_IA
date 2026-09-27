# Demandes fonctionnelles

Ce site rassemble les demandes du produit. Le PDF du 26 septembre 2026, `docs/specifications-gestion-ia.pdf`, est conservé ; il n’est plus la base de revue. Le manuel d’utilisation reste `docs/manuel-utilisateur.md`. Le socle qui tourne est le site technique, dans `docs/technique`. La modélisation de ce qui est enregistré y est décrite, page Modélisation des données.

Les états fait ou pas fait sont sur la page [Réalisations](realisations.md). Cette page est produite depuis le tableau de l’application. Le fonctionnel, la technique et ce tableau portent les mêmes libellés.

## Principe

La demande passe par une chaîne. L’IA interprète. Les règles métier contrôlent la faisabilité et l’exécution.

Un message court ne part pas seul vers le modèle. La demande comprise réunit quatre sources : le message, les pièces jointes, le contexte de l’écran, le contexte métier.

Exemple. L’utilisateur écrit « Enregistre ça ». Le fichier est un devis fournisseur, l’écran est le projet ouvert, le fournisseur est reconnu. L’utilisateur ne confirme que les points encore incertains.

## Lecture

- [Chaîne](chaine.md) : de la pièce jusqu’à la mémoire du document.
- [Catalogue](catalogue.md) : intentions fermées, seuils, question unique, parcours borné.
- [Périmètre](perimetre.md) : écrans, ventes, achats, finance et ce qui reste hors socle.
- [Réalisations](realisations.md) : le même état que l’application.
