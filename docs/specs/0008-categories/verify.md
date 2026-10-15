# Verify: gestion des catégories · spec 0008 · mis à jour le 2026-10-15
_Étapes tirées des critères de la spec 0008. `/check verify` les exécute ; `/test` fige les durables._

**Prérequis** : l'API locale (`noli-backend/.env`, `MONGODB_URI`) pointe sur une base **séparée de la production**, avec quelques catégories et au moins une série. Sans cela, ne faites que les étapes en lecture seule (1, 13, 14, 16).

## UI / manuel
- [x] 1. Menu « Catégories » → `/categories` : titre, « N catégories », tableau dans l'ordre d'affichage (rang, miniature ou icône, nom et description, `/adresse`, interrupteur, actions), badge « Masquée » sur une catégorie masquée → AC-1
- [x] 2. « Nouvelle catégorie », nom « Comédie romantique » → aperçu « Adresse : /comedie-romantique » ; « Créer la catégorie » → « Catégorie créée. », ligne en fin de tableau → AC-2
- [x] 3. Créer « », « !!! », « All », puis le nom d'une catégorie existante écrit sans accent → messages de l'AC-3 sous Nom, focus sur Nom, aucun appel réseau → AC-3
- [x] 4. « Modifier » une catégorie : « Enregistrer » inactif ; changer le nom et vider la description → `PATCH` avec `{ name, description: null }`, « Catégorie modifiée. », fenêtre fermée → AC-4
- [x] 5. « Modifier l'adresse » : avertissement affiché ; « Comedie Romantique » → message de format ; « order » → « Cette adresse est réservée. » ; l'adresse d'une autre catégorie → « Adresse déjà utilisée par « … ». » ; une adresse libre → envoyée ; « Annuler » referme le champ → AC-5
- [x] 6. Désactiver « Visible » → « Masquer « … » ? », « Masquer » → badge « Masquée », « Catégorie masquée. » ; la réactiver → « Catégorie affichée. » sans question → AC-6
- [x] 7. « Descendre » la première catégorie → bandeau « Ordre modifié », autres actions bloquées avec la raison, annonce de la position ; « Annuler » → ordre d'origine sans appel ; recommencer puis « Enregistrer l'ordre » → un `PUT /categories/order` avec tous les identifiants, « Ordre enregistré. » → AC-7
- [x] 8. Supprimer une catégorie sans série → confirmation, « Catégorie supprimée. » ; supprimer une catégorie utilisée → « Suppression impossible » avec le nombre de séries, « Masquer plutôt » → masquée → AC-8
- [x] 9. Dans « Modifier », partie « Image » : envoyer une image carrée de 400 × 400 au moins → « Image mise à jour. », miniature dans le tableau ; une image de 300 × 300 → refus avant envoi ; « Retirer l'image » → confirmation, « Image retirée. » → AC-9
- [x] 10. Après une création, ouvrir « Nouvelle série » : la catégorie créée est proposée sans recharger → AC-10
- [x] 11. Fenêtre modifiée + Échap → « Abandonner les changements ? » ; ordre en cours + clic sur « Séries » → « Quitter sans enregistrer ? » → AC-11
- [x] 12. Au clavier seul : déplacer une catégorie (le focus reste sur le bouton), enregistrer l'ordre, ouvrir et fermer la fenêtre ; lecteur d'écran : noms « Monter « … » », « Visible : … », annonce de position → AC-12
- [x] 13. Largeur de 390 px : le tableau défile dans son cadre, la page n'a pas de défilement horizontal → AC-13
- [x] 14. Production, lecture seule : la page liste les catégories masquées comprises, avec leurs miniatures → AC-14

## Value sourcing
- [x] 15. La forme du nom suit la règle du backend : « Ça va » → `/ca-va`, « Œuvre » → `/uvre` (aperçu de création) → AC-2, AC-3
- [x] 16. Le rang affiché suit l'ordre du serveur, pas `displayOrder` brut (les rangs vont de 1 à N sans trou) → AC-1
- [x] 17. Le nombre de séries de « Suppression impossible » est celui renvoyé par le backend (`seriesCount`) → AC-8

## Commandes
- [x] `npm run typecheck` → aucune erreur
- [x] `npx vitest run src/features/categories src/shared` → tous les tests passent → AC-1 à AC-12

## Couverture des critères
- AC-1 : 1, 16 · AC-2 : 2, 15 · AC-3 : 3, 15 · AC-4 : 4 · AC-5 : 5 · AC-6 : 6 · AC-7 : 7 · AC-8 : 8, 17 · AC-9 : 9 · AC-10 : 10 · AC-11 : 11 · AC-12 : 12 · AC-13 : 13 · AC-14 : 14
