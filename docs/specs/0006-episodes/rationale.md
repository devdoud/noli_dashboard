# 0006. Épisodes d'une série : raisonnement

## Context

La fiche série est en ligne (spec 0005) : on crée, modifie et supprime une série, mais ses épisodes ne se gèrent encore que par Swagger. La fonctionnalité 7 du scope demande d'ajouter, modifier et supprimer des épisodes rangés par saison, avec un lien vidéo collé, et de voir l'état de chaque vidéo.

Le backend fournit déjà les routes : `POST /series/:id/episodes`, `PATCH` et `DELETE` sur `/series/:id/episodes/:saison/:numéro`, et les épisodes arrivent triés dans la fiche admin, avec l'état de leur vidéo (`ready`, `pending`, `error`, `legacy`, `none`) et l'accès gratuit calculé. Chaque écriture renvoie la série admin complète. Trois limites comptent : la saison et le numéro sont figés après la création (ils identifient l'épisode dans l'adresse), un doublon renvoie un `400` et non un `409`, et le lien vidéo ne peut être donné qu'à la création. La durée est en secondes, et la date de sortie vaut la date du jour si elle manque. Donner un lien à un épisode le rend jouable et met en file une annonce aux abonnés (spec 0008 du backend), qui ne s'annule pas ; un épisode sans vidéo jouable n'est ni gratuit ni premium pour le backend. La relecture croisée a relevé ces deux effets, et l'engineer a choisi de les rendre visibles (confirmation « Publier l'épisode ? », accès « Non visible »).

L'hébergement vidéo (envoi et import vers Cloudflare) est reporté dans le scope, et les vignettes d'épisode relèvent de la fonctionnalité 8. Les admins sont 1 à 3, et une série compte quelques dizaines d'épisodes.

## Options considered

### Option 1 : section sur la fiche, fenêtre de formulaire, cache remplacé par la réponse

Une section « Épisodes » sous le formulaire de la fiche, un tableau par saison, une fenêtre pour ajouter et modifier. Chaque écriture pose la série renvoyée dans le cache de la fiche. Un petit changement du backend rend le lien collé modifiable.

**Pros**:
- Tout le contenu d'une série au même endroit, sans nouvelle adresse.
- Pas de requête de plus : la réponse de chaque écriture met à jour le tableau, l'aperçu et les accès gratuits.
- Corriger un lien ne détruit pas l'historique des spectateurs.

**Cons**:
- La fiche s'allonge.
- Un changement de backend de plus à livrer et déployer.

### Option 2 : page dédiée aux épisodes

Une adresse `/series/:id/episodes` avec la liste et les formulaires.

**Pros**:
- Plus de place, la fiche reste courte.

**Cons**:
- Une navigation de plus pour une tâche fréquente, et la fiche ne montre plus l'état du contenu.

### Option 3 : aucun changement backend, correction d'un lien par suppression et recréation

On garde les routes telles quelles ; un lien faux se corrige en supprimant l'épisode puis en le recréant.

**Pros**:
- Rien à déployer côté API.

**Cons**:
- La suppression efface l'historique de visionnage de l'épisode : corriger une faute de frappe dans un lien coûterait l'historique des spectateurs.

## Rationale

La section sur la fiche suit ce que la spec 0005 avait préparé et ce que l'engineer a choisi : un admin voit et règle tout le contenu d'une série au même endroit. Remplacer le cache par la réponse de chaque écriture vient du backend, qui renvoie déjà la série complète, avec `isFree` recalculé : c'est la source la plus juste, sans calcul local. Le petit changement du backend évite de payer une correction de lien par la perte de l'historique des spectateurs, et il reste limité aux liens collés pour ne pas empiéter sur l'hébergement vidéo, reporté.

La confirmation simple pour un épisode, plutôt que le titre retapé d'une série, suit le poids de l'action : un épisode est plus petit et se recrée. Les limites (titre 100, description 1 000, durée en minutes et secondes) sont des règles d'affichage. Le lien `https` est exigé en modification par le backend (prérequis) et seulement par le dashboard à la création, où le backend accepte encore tout texte. La date est envoyée à midi UTC et affichée en UTC, pour que le tableau et la fenêtre montrent toujours le même jour.
