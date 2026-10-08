# Noli Dashboard · fiche de passation

Ce dossier accueille le **dashboard d'administration de Noli** (une application web), séparé du backend et de l'app mobile. Cette fiche donne à une nouvelle session Claude le contexte nécessaire pour démarrer. Elle ne contient aucun secret.

## Le produit

Noli est une plateforme de streaming de séries pour l'Afrique de l'Ouest francophone : une app mobile Flutter (`../noli_app`) et une API NestJS + MongoDB (`../noli-backend`), hébergée sur Render.

Le dashboard sert aux **admins** à gérer le contenu sans passer par Swagger ni la base de données :
- **séries** : créer, modifier, supprimer, réglages premium (série payante, nombre d'épisodes gratuits) ;
- **épisodes** : ajouter, modifier, supprimer, coller un lien vidéo ;
- **images** : couverture, bannière, vignette d'épisode, image de catégorie (envoi de fichier) ;
- **catégories** : créer, modifier, masquer, réordonner, supprimer ;
- **plus tard** : vidéos Cloudflare Stream (en pause côté backend, répond `503`), abonnés et revenus (feature 5 du backend, pas encore construite), notification de test.

## L'API à utiliser

- **Production (Render)** : `https://<service>.onrender.com`. Demander l'URL exacte à l'utilisateur.
- **Local** : `http://localhost:3000`, avec `npm run start:dev` dans `../noli-backend`.
- **Documentation** :
  - `../noli-backend/docs/api-reference.md`, en français : la section **9. Routes admin** liste toutes les routes du dashboard ; les sections 1 à 3 donnent les règles générales et la connexion ;
  - `../noli-backend/docs/openapi.json`, le contrat complet, utilisable pour générer un client typé ;
  - Swagger en ligne sur `/api/docs`.
- **Authentification** :
  - `POST /auth/login` avec `{ email, password }` renvoie `{ accessToken, refreshToken, user: { role, … } }` ;
  - `POST /auth/refresh` avec `{ refreshToken }` renvoie un nouvel `accessToken` ;
  - envoyer l'en-tête `Authorization: Bearer <accessToken>` ;
  - seul `user.role === 'admin'` a accès au dashboard ; un autre compte reçoit `403` sur les routes admin.
- **Compte de développement** : un compte démo admin existe dans la base de développement (identifiants dans `../noli-backend/docs/api-reference.md`, section 11). Ne jamais l'utiliser en production.
- **Images** : `multipart/form-data`, champ `file`, JPEG, PNG ou WebP, 5 Mo au plus. Limite de 10 appels images toutes les 10 minutes par admin (`429`).
- **Pagination** : paramètres `page` et `limit` ; réponses de la forme `{ total, page, limit, … }`.
- **Langue** : interface en **français**.
- **CORS** : le backend n'active pas encore CORS. Un dashboard web servi depuis un autre domaine sera bloqué par le navigateur. Il faudra ajouter `app.enableCors({ origin: [...] })` dans `../noli-backend/src/main.ts`, côté backend.

## Ce qui reste à décider (dans la nouvelle session)

La pile technique n'est pas choisie : framework web, bibliothèque d'interface, hébergement (par exemple Render Static Site, Vercel ou Netlify), gestion des tokens. C'est le rôle de `/architect`. Rien ne doit être installé avant cette décision.

## Comment démarrer

Dans une nouvelle session Claude Code ouverte **dans ce dossier** :
1. `/scope` : décrire le dashboard en une ou deux phrases pour obtenir le plan (fonctionnalités, ordre, niveau d'exigence).
2. `/architect stack & architecture` : choisir la pile.
3. `/develop scaffold`, puis feature par feature.

Le workflow du projet (`/scope`, `/architect`, `/develop`, `/check`, `/test`, `/document`) est le même que pour le backend.

## Règles reprises du backend

- Ne jamais commiter de secret. Créer `.gitignore` en **UTF-8** avec `node_modules/`, `dist/`, `.env` et `.env.*` (un `.gitignore` en UTF-16 avait laissé passer `.env` côté backend).
- Les clés et les URL privées vont dans `.env` (non commité), et dans les variables de l'hébergeur.
- Communication avec l'utilisateur en français.
