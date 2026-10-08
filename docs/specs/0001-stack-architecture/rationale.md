# 0001. Pile du dashboard : raisonnement

## Context

Noli a déjà un backend NestJS + MongoDB sur Render et une app mobile Flutter. Aujourd'hui, gérer le contenu (séries, épisodes, images, catégories) passe par Swagger ou directement par la base, ce qui est lent et risqué. Il faut un outil web d'administration, en français, pour 1 à 3 admins internes, utilisé surtout sur ordinateur et lisible sur téléphone.

Les forces en jeu : l'API existe et est documentée (`openapi.json`, routes admin en section 9 de la référence de l'API), donc le dashboard ne possède aucune donnée et ne fait qu'appeler l'API. L'authentification est déjà définie par le backend : JWT d'accès et refresh token renvoyés dans le corps de la réponse, sans cookie, et le refresh token n'est pas renouvelé à chaque usage. Le backend n'active pas encore CORS. L'équipe est très petite, déjà à l'aise en TypeScript et avec npm, et héberge déjà sur Render. Il n'y a pas de date ferme, et il faut éviter des coûts ou des services à faire tourner en plus.

Sans décision, chaque fonctionnalité du scope choisirait ses propres outils, et les écrans d'administration finiraient incohérents et coûteux à maintenir.

## Options considered

### Option 1 : SPA React + Vite + Mantine, sur Render Static Site

Une application monopage en TypeScript strict, construite avec Vite, avec React, la bibliothèque de composants Mantine, React Router, TanStack Query et Mantine form + Zod. Elle est servie comme site statique par Render, à côté de l'API.

**Pros**:
- Rien à faire tourner : des fichiers statiques, gratuits, en HTTPS.
- Mantine fournit déjà tableaux, formulaires, modales, notifications et zone de dépôt de fichiers.
- Une seule pile TypeScript avec le backend, un seul fournisseur d'hébergement.
- Vous gardez la main sur chaque écran, y compris les cas particuliers (épisodes par saison, images avec contrôle des dimensions, réordonner les catégories).

**Cons**:
- Il faut construire soi même les écrans de liste et de formulaire, qu'un framework admin génère.
- Les tokens vivent dans le navigateur, ce qui les expose à un script injecté.

### Option 2 : Framework admin Refine (sur React)

Refine fournit la structure d'un back office (fournisseur de données, routes CRUD, authentification) au dessus de React, avec une bibliothèque d'interface au choix.

**Pros**:
- Listes, fiches et formulaires CRUD standard très vite en place.
- Modèle de fournisseur d'authentification déjà pensé.

**Cons**:
- Vos routes ne sont pas du CRUD pur : épisodes imbriqués par saison et numéro, images en multipart avec limite de débit, réordonnancement des catégories, réglages premium. Chaque écart demande d'adapter le framework.
- Une couche d'abstraction en plus à apprendre et à suivre dans ses mises à jour.

### Option 3 : Framework avec rendu serveur (type Next.js) et shadcn/ui + Tailwind

Un serveur Node rend les pages ; il peut garder les tokens dans des cookies httpOnly en servant d'intermédiaire vers l'API.

**Pros**:
- Les tokens peuvent rester côté serveur, hors de portée d'un script injecté.
- Composants shadcn/ui copiés dans le code, très personnalisables.

**Cons**:
- Un service Node de plus à héberger et à surveiller, pour un outil de 1 à 3 personnes.
- SEO et rendu serveur n'apportent rien derrière une connexion.
- shadcn/ui demande d'assembler plus de pièces que Mantine.

### Option 4 : SPA Vue + Vite

Même architecture que l'option 1, avec Vue à la place de React.

**Pros**:
- Plus simple à apprendre pour certains.
- Build statique identique, même hébergement.

**Cons**:
- Écosystème de composants admin et d'Agent Skills plus petit.
- Aucun avantage particulier pour ce projet face à React.

## Rationale

L'API existe déjà et porte toutes les données et toute la sécurité : le dashboard n'est qu'un client. Pour 1 à 3 admins derrière une connexion, un rendu serveur (option 3) ajoute un service à faire tourner sans rien apporter de mesurable, sauf la protection des tokens en cookie, qui demanderait de toute façon de modifier le backend. Une SPA statique sur Render garde un seul fournisseur et un coût nul.

Entre construire les écrans et utiliser un framework admin (option 2), les routes de Noli sont assez particulières (épisodes imbriqués, images multipart avec contrôle des dimensions et limite de débit, ordre des catégories, réglages premium) pour que l'adaptation d'un framework coûte autant que les écrans eux mêmes. Mantine apporte la majeure partie du gain (tableaux, formulaires, modales, dépôt de fichiers) sans imposer de modèle. React plutôt que Vue (option 4) parce que c'est l'écosystème le plus large et celui que couvrent les Agent Skills installés.

Pour les tokens, le backend renvoie les deux dans le corps, ne renouvelle pas le refresh token et n'a aucune route pour le révoquer. Garder le token d'accès en mémoire seulement limite son exposition. Le refresh token va dans `sessionStorage` plutôt que `localStorage` : il survit au rechargement, mais disparaît à la fermeture du navigateur. Comme un token volé ne peut pas être révoqué, raccourcir sa présence vaut bien une connexion de plus par session, pour un outil qui peut supprimer du contenu de production. (Choix initial `localStorage`, changé après la relecture croisée.) Le risque restant (un script injecté) est réduit par une politique de sécurité de contenu stricte sur Render et par le fait que React échappe le texte par défaut. Le passage à un cookie httpOnly reste possible plus tard, côté backend, si l'équipe grandit.

Pour joindre l'API, CORS côté backend a été préféré à un proxy par réécriture Render (`/api/*` vers l'API) : le proxy supprimerait CORS, mais ajoute une étape sur chaque appel et dépend d'un support de destination externe non vérifié. Activer CORS est une petite modification connue du backend.

## Evidence: état des outils au 2026-10-08

Vérification rapide faite pendant la conversation (un sous agent, recherche web limitée). Majeures relevées : React 19, React Router 8, TanStack Query 5, Vitest 5, Mantine stable et activement maintenu, shadcn/ui CLI v4, Refine 5, React Admin maintenu par Marmelab. L'hébergement (Render Static Site, Cloudflare, Netlify, Vercel) n'a pas été vérifié faute de budget de recherche. Certaines versions renvoyées semblaient dépassées : à revérifier au scaffold.

## References

**Project sources**:
- `../noli-backend/AGENTS.md` : TypeScript, Node.js, npm.
- `../noli-backend/docs/api-reference.md` : authentification (sections 1 à 3) et routes admin (section 9).
- `HANDOFF.md` : CORS absent côté backend, règle du `.gitignore` en UTF-8.
- `docs/scope/scope.md` : fonctionnalités 1 à 12, approche Tracer Bullet, niveau Beta.
- Agent Skills installés : `vercel-react-best-practices`, `mantine-form`, `mantine-combobox`, `tanstack-query`, `vitest`.

**Practices & standards**:
- Une technologie éprouvée plutôt qu'une nouvelle.
- Pas de rendu serveur pour une application interne derrière connexion.
- Token d'accès en mémoire et politique de sécurité de contenu pour limiter l'impact d'un XSS (script injecté).

**Links** (vérifiés pendant la conversation):
- React Router, versions publiées : https://github.com/remix-run/react-router/releases
- Vitest, versions publiées : https://github.com/vitest-dev/vitest/releases
- React Admin (Marmelab) : http://marmelab.com/react-admin/
