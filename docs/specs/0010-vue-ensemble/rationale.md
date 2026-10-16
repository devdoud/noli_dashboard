# 0010. Vue d'ensemble : raisonnement

## Context

L'accueil du dashboard est aujourd'hui une page provisoire : trois cartes qui décrivent ce que fait l'outil, sans aucun chiffre. Les 1 à 3 admins qui gèrent le contenu n'ont aucun moyen de voir d'un coup d'œil où en est le catalogue, et surtout quelles vidéos d'épisodes restent à traiter. Pour le savoir, il faut ouvrir les séries une par une.

L'API ne sait rien compter aujourd'hui. Les épisodes sont rangés à l'intérieur de chaque série (tableau `episodes` d'un document MongoDB), et l'état d'une vidéo (`ready`, `pending`, `error`, `legacy`, `none`) n'est pas stocké : il est calculé à la volée par `adminVideoStatus` à partir de quatre champs de l'épisode. La liste admin des séries (spec 0009) ne renvoie pas les épisodes, pour rester légère.

Le scope demande que chaque chiffre mène à « la liste concernée ». Il n'existe pas de liste de tous les épisodes ; la seule liste est celle des séries, avec ses filtres dans l'adresse (spec 0009). Le catalogue compte quelques centaines de séries au plus à court terme.

## Options considered

### Option 1: Calcul dans le navigateur

Le dashboard parcourt toutes les pages de la liste des séries, puis la fiche de chacune pour lire ses épisodes, et compte lui même.

**Pros**:
- Aucun changement backend, rien à redéployer côté API.

**Cons**:
- Une requête par série à chaque visite de l'accueil : lent, lourd, et pire à mesure que le catalogue grandit.
- La règle « vidéo prête » serait recopiée dans le dashboard, loin de `adminVideoStatus`.
- Ne donne pas de moyen de filtrer la liste des séries sur les vidéos à traiter.

### Option 2: Route de stats + filtre sur la liste existante (choisie)

Une route admin `GET /series/admin/stats` compte tout en une agrégation MongoDB ; la route `GET /series/admin` gagne un filtre `video=todo` et un compte par ligne. L'accueil affiche les chiffres et renvoie vers la liste filtrée.

**Pros**:
- Une seule requête pour l'accueil, exacte quelle que soit la taille du catalogue.
- Réutilise la liste, l'adresse et les filtres de la spec 0009 comme « liste concernée ».
- Le filtre sert aussi en dehors de l'accueil.

**Cons**:
- Changement backend et ordre de déploiement imposé.
- La règle « vidéo prête » s'écrit aussi en expressions MongoDB, à garder d'accord avec `adminVideoStatus` par un test.

### Option 3: Route de stats + nouvelle page des épisodes à traiter

Comme l'option 2, mais la tuile mène à une nouvelle page qui liste les épisodes à traiter (série, saison, numéro, état), avec sa propre route API paginée.

**Pros**:
- Va directement à l'épisode, sans repasser par la fiche de la série.

**Cons**:
- Une page, une route API et une pagination de plus pour 1 à 3 admins.
- Les épisodes se gèrent déjà dans la fiche de la série ; la nouvelle page renverrait de toute façon vers elle.

### Option 4: Compteurs stockés

Chaque série garde un compteur d'épisodes à traiter, mis à jour à chaque changement d'épisode ou de vidéo (y compris les retours de Cloudflare).

**Pros**:
- Lecture instantanée, même pour un très gros catalogue.

**Cons**:
- Chaque chemin d'écriture (ajout, suppression, envoi, webhook, expiration d'un envoi) doit penser à mettre le compteur à jour ; un oubli le rend faux sans bruit.
- Demande une migration pour remplir les compteurs existants. Optimise un problème de vitesse qui n'existe pas.

## Rationale

Le besoin est un petit tableau de bord interne pour quelques admins et un catalogue de quelques centaines de séries. Compter à la lecture, côté backend, en une agrégation, est la solution la plus simple qui reste exacte : rien n'est stocké, donc rien ne peut se désynchroniser (contrairement à l'option 4), et une seule requête suffit (contrairement à l'option 1).

Pour la « liste concernée », l'engineer a choisi de réutiliser la liste des séries avec un nouveau filtre plutôt qu'une page d'épisodes (option 3). Le filtre s'appuie sur tout ce que la spec 0009 a déjà construit (adresse, historique, compte, « Effacer les filtres ») et l'admin finit de toute façon dans la fiche de la série pour traiter un épisode. Le compte par ligne (« 3 vidéos à traiter ») dit où commencer sans ajouter de page.

La définition « tout sauf Prête » (choix de l'engineer) compte aussi les envois en cours et les anciens liens collés : ce sont soit du travail à suivre, soit des migrations à faire. La ligne de détail par état évite de mélanger ces cas dans un seul nombre opaque.

Pour la fraîcheur, la clé de cache des stats est rangée sous le préfixe des listes de séries, que toutes les actions d'écriture invalident déjà. C'est moins pur qu'une clé à part, mais cela évite de modifier une dizaine d'appels d'invalidation et de risquer d'en oublier un ; le second choix (une clé `['series', 'stats']` ajoutée à chaque invalidation) reste possible si la structure des clés change.

Le risque principal est l'écart entre `adminVideoStatus` et sa copie en expressions MongoDB. Il est tenu par un test de parité qui fait passer chaque combinaison de champs par les deux règles.
