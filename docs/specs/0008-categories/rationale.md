# 0008. Gestion des catégories : raisonnement

## Context

Le backend gère les catégories depuis sa spec 0003 : création, modification, visibilité, ordre, suppression et image, avec des garde fous (un nom ne peut pas reprendre la forme d'un autre à un accent ou une majuscule près, une catégorie utilisée ne peut pas être supprimée, l'ordre doit lister toutes les catégories). Aujourd'hui, ces actions ne se font que par Swagger ; le dashboard ne lit les catégories que pour les proposer dans le formulaire d'une série.

Les catégories sont peu nombreuses (une dizaine à une vingtaine), modifiées rarement, mais leurs erreurs se voient partout dans l'app : une catégorie masquée par erreur disparaît de l'étiquette de toutes ses séries, un mauvais ordre change la page d'accueil. Les messages du backend sont en anglais et ses refus arrivent après l'envoi. L'outil sert à 1 à 3 admins, en français, au clavier comme à la souris (WCAG AA).

Une contrainte d'organisation pèse aussi : la règle du projet interdit qu'une fonctionnalité en importe une autre, alors que l'emplacement d'image (spec 0007), la protection de la page (spec 0005) et la liste des catégories en cache vivent aujourd'hui dans la fonctionnalité Séries.

## Options considered

### Option 1 : liste avec fenêtre, ordre par boutons enregistré en un envoi

Une page de tableau dans l'ordre d'affichage ; création et modification dans une fenêtre ; ordre changé par « Monter » et « Descendre » puis enregistré par un bouton ; contrôles du nom et de l'adresse dans le navigateur.

**Pros**:
- Même schéma que les épisodes (tableau et fenêtre), déjà connu des admins.
- Les boutons d'ordre marchent au clavier sans bibliothèque.
- Un seul envoi d'ordre, protégé contre le départ sans enregistrer.

**Cons**:
- Déplacer loin dans une longue liste demande plusieurs clics.
- Un bandeau d'ordre en cours qui bloque les autres actions, à rendre clair.

### Option 2 : fiche dédiée par catégorie

Chaque catégorie a sa page, comme une série.

**Pros**:
- De la place pour grandir (statistiques, séries de la catégorie).

**Cons**:
- Beaucoup de navigation pour un objet de quatre champs et une image.

### Option 3 : glisser déposer avec enregistrement immédiat

On déplace une ligne à la souris, et chaque déplacement part aussitôt.

**Pros**:
- Le geste le plus naturel à la souris.

**Cons**:
- Une bibliothèque en plus et un travail réel pour le clavier.
- Un appel par déplacement, et des états intermédiaires visibles dans l'app pendant qu'on range.
- Un conflit d'ordre (autre admin) au milieu d'une série de déplacements est plus difficile à expliquer.

## Rationale

L'option 1 colle au volume réel (une vingtaine de catégories au plus) et aux exigences du projet. Les boutons d'ordre sont accessibles d'office, et l'enregistrement en un envoi respecte la règle du backend, qui veut la liste complète : bloquer les autres actions pendant un ordre en cours est la façon la plus simple de garantir que cette liste reste juste, et un `400` (autre admin) se rattrape en relisant la liste.

Refaire la règle `slugify` dans le navigateur coûte une dizaine de lignes et transforme un `409` anglais, découvert après l'envoi, en un message précis et immédiat qui nomme la catégorie en conflit ; le backend reste juge, et ses refus restent gérés pour le cas rare de deux admins simultanés. L'adresse est rarement à changer et casse les liens partagés : la montrer en lecture seule, modifiable derrière un bouton avec un avertissement, évite les accidents sans retirer la possibilité.

Proposer « Masquer plutôt » au refus de suppression répond au vrai besoin derrière la suppression (ne plus voir la catégorie dans l'app) sans imposer de retirer la catégorie de chaque série à la main. Enfin, déplacer les briques communes dans `src/shared/` est le prix de la règle d'organisation du projet ; c'est fait en premier, sans changement de comportement, pour que la suite de tests existante le couvre.
