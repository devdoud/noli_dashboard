# 0005. Fiche série : raisonnement

## Context

La liste des séries est en ligne (spec 0004), mais rien ne permet encore de créer, corriger ou supprimer une série sans passer par Swagger. C'est la deuxième tranche du scope : elle doit rendre le catalogue gérable de bout en bout, sur la vraie API.

Le backend fournit déjà tout : `POST /series`, `GET /series/:id/admin`, `PATCH /series/:id` (tous les champs, y compris l'accès premium), `PATCH /series/:id/access` et `DELETE /series/:id`, réservés aux admins. Un titre déjà pris renvoie `409`, une série demande au moins une catégorie, et `GET /categories/all` liste aussi les catégories masquées. La suppression est lourde et définitive : elle efface les vidéos Cloudflare, les images, et l'historique de visionnage des spectateurs. En modification, le backend refuse `releaseYear: null`. La relecture croisée a aussi montré que la réponse admin d'une série retire ses catégories masquées (le peuplement filtre `isVisible: true`) : sans correction, une fiche ne pourrait ni montrer ni garder ces catégories. L'engineer a choisi un petit changement du backend, limité aux réponses admin, plutôt qu'une limite assumée dans le dashboard.

Les données de production imposent deux formats : les langues sont des codes ISO 639 (`fr`, `fon`, `ha`…), que l'app mobile affiche en majuscules, et les pays sont des noms français (« Bénin », « Côte d’Ivoire »). Les admins sont 1 à 3, surtout sur ordinateur, et la fiche accueillera plus tard les épisodes et les images.

## Options considered

### Option 1 : pages dédiées, formulaire unique toujours modifiable, `PATCH` des seuls champs modifiés

`/series/nouvelle` et `/series/:id`, un composant `SeriesForm` partagé, la section « Accès » dans le même formulaire, un seul `PATCH /series/:id` qui envoie uniquement les champs changés.

**Pros**:
- Une adresse par série : rechargement, partage et bouton retour naturels.
- Assez de place pour accueillir ensuite épisodes et images.
- Un seul bouton d'enregistrement ; un admin n'écrase que ce qu'il a changé.

**Cons**:
- Il faut calculer les champs modifiés (`toSeriesPatch`) et protéger les changements non enregistrés.

### Option 2 : fenêtre modale ou panneau latéral depuis la liste

Créer et modifier dans une modale ou un tiroir au dessus de la liste.

**Pros**:
- Rapide à construire, la liste reste visible.

**Cons**:
- Pas d'adresse propre : un rechargement perd le travail.
- Trop étroit quand la fiche recevra épisodes et images ; il faudrait tout déplacer plus tard.

### Option 3 : fiche en lecture avec un mode « Modifier », accès premium à part

La fiche s'affiche en lecture, « Modifier » ouvre le formulaire ; l'accès premium a son bloc et son bouton, envoyés par `PATCH /series/:id/access`.

**Pros**:
- Moins de risque de modification accidentelle ; l'accès se change sans toucher au reste.

**Cons**:
- Plus de clics pour une équipe de 1 à 3 admins qui corrige souvent.
- Deux boutons d'enregistrement sur la même page, deux états « modifié » à suivre.

## Rationale

Les pages dédiées gagnent parce que la fiche est appelée à grossir : les fonctionnalités 7 et 8 y ajouteront épisodes et images, ce qu'une modale ne peut pas porter. Le formulaire toujours modifiable, avec la section Accès incluse et un seul `PATCH`, colle au nombre d'admins et à la route du backend qui accepte déjà tous les champs ; envoyer seulement les champs modifiés est la défense la plus simple contre les écrasements, sans numéro de version côté backend.

La suppression retapant le titre vient du coût d'une erreur : en production, elle efface vidéos, images et historique sans retour possible. Les formats de langue et de pays suivent les données réelles et l'app mobile, pour ne pas créer deux écritures d'une même valeur. Les limites de texte (100 et 2 000 caractères) et l'année non effaçable sont des règles d'affichage et une contrainte du backend, notées dans le suivi. Comme le backend n'impose pas ces limites et que d'anciennes données peuvent les dépasser, seule une valeur modifiée est validée : une série ancienne reste toujours enregistrable.
