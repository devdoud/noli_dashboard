# 0004. Connexion admin et liste des séries : raisonnement

## Context

Les fondations sont en place : la session et le client API (spec 0002), et le design system (spec 0003). Pourtant, le dashboard ne fait encore rien d'utile : aucune page de connexion, aucune donnée affichée. C'est la première tranche verticale du scope (Tracer Bullet). Elle doit prouver que le navigateur, le dashboard hébergé, l'API de production et sa base communiquent vraiment.

Les contraintes viennent des briques existantes. La session expose `useSession()`, `login()` et un contrat de redirection `/connexion?retour=…`. L'API renvoie la liste des séries paginée (`GET /series`, 50 par page au plus), sans liste réservée aux admins. Le CORS du backend se règle par `CORS_ORIGINS`, et la CSP du site autorise déjà `https://api.nollli.com` et les images Cloudinary. Les admins sont 1 à 3, sur ordinateur surtout.

## Options considered

### Option 1 : garde par composant de route, formulaire Mantine et Zod, liste par TanStack Query

Un composant `RequireSession` en route de mise en page lit l'état de session et redirige. La connexion utilise `@mantine/form` validé par Zod, et la liste un `useQuery` sur `apiRequest`.

**Pros**:
- Réutilise exactement les briques des specs 0002 et 0003.
- Le chargement pendant la reprise de session se gère au même endroit que la redirection.
- `keepPreviousData` garde les lignes pendant un changement de page, ce que `DataTable` sait afficher.

**Cons**:
- Une dépendance de plus (`@mantine/form`), même si elle est prévue depuis la spec 0001.

### Option 2 : chargeurs de données de React Router

Les `loader` du routeur vérifient la session et chargent la liste avant l'affichage.

**Pros**:
- Données prêtes avant le rendu, redirection dans le loader.

**Cons**:
- Double avec TanStack Query (cache, réessais, annulation) déjà décidé pour tout le dashboard.
- La reprise de session asynchrone (`restoring`) s'exprime mal dans un loader.

### Option 3 : formulaire maison sans bibliothèque

État React et validation à la main pour la connexion.

**Pros**:
- Aucune dépendance.

**Cons**:
- Les formulaires des fonctionnalités 6 à 9 réécriraient la même mécanique ; `applyFieldErrors` (spec 0002) vise justement l'interface de `@mantine/form`.

## Rationale

La session et les données ont déjà leur maison : `useSession()` pour l'une, TanStack Query avec `apiRequest` pour les autres. Une garde en composant de route lit le premier, et la liste utilise le second, sans introduire un troisième mécanisme (les loaders). Le premier formulaire du dashboard est le bon moment pour installer `@mantine/form` avec Zod, comme prévu par la spec 0001 : les fonctionnalités suivantes en dépendent.

Arriver sur la liste des séries après la connexion, plutôt que sur une Vue d'ensemble encore provisoire, donne tout de suite de la valeur. La page dans l'adresse rend le rechargement et le bouton retour naturels. La relecture croisée (un autre modèle) a fait préciser : le masquage du message de fin de session, `noValidate` et `autoFocus`, le schéma Zod exact avec le `schemaResolver` intégré, une seule navigation après connexion, un `safeReturnPath` plus strict, l'absence de `retour` après une déconnexion, la lecture stricte de `?page`, le recadrage sans entrée d'historique, un schéma de liste tolérant, et l'ordre exact des étapes de mise en ligne. La vérification sur l'API de production a montré que `GET /series` n'a pas de maximum pour `limit` et qu'une page au delà de la fin renvoie une liste vide avec le vrai total.

La mise en ligne fait partie de la tranche, parce que le scope demande de prouver le circuit de production, et que c'est là que se cachent les vrais risques : CORS, CSP et variables d'environnement.
