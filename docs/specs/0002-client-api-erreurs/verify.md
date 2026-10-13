# Verify: client API & erreurs · spec 0002 · updated 2026-10-08
_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Cette fonctionnalité n'a pas encore d'écran qui l'utilise (la page de connexion arrive avec la fonctionnalité 5). La vérification passe donc surtout par les tests contre une API simulée (MSW), plus quelques contrôles dans la vraie application. Les étapes marquées « avec la fonctionnalité 5 » sont à refaire de bout en bout quand la connexion existera.

## UI / manual
- [x] Renommer `.env.local`, lancer `npm run dev`, ouvrir `http://localhost:5173` → écran « Configuration invalide » qui nomme `VITE_API_BASE_URL`, et aucune requête dans l'onglet Réseau du navigateur → AC-2
- [x] Mettre `VITE_API_BASE_URL=ftp://exemple` dans `.env.local`, relancer → même écran, raison « adresse http:// ou https:// valide » → AC-2
- [x] Remettre `.env.local` (API locale, backend arrêté), recharger → l'application s'affiche ; dans l'onglet Réseau, aucune requête vers l'API tant qu'il n'y a pas de refresh token dans `sessionStorage` → AC-7
- [x] Dans `sessionStorage`, poser `noli.admin.refreshToken` avec une valeur fausse, backend local lancé, recharger → un appel `POST /auth/refresh` refusé, la clé disparaît, aucun message d'erreur à l'écran → AC-7
- [ ] Avec la fonctionnalité 5 : se connecter avec le compte démo admin → session ouverte, `sessionStorage` contient le refresh token, `localStorage` reste vide → AC-6, AC-15
- [ ] Avec la fonctionnalité 5 : se connecter avec `demo.free@noli.test` → « Ce compte n'a pas accès au tableau de bord. », `sessionStorage` vide → AC-6
- [ ] Avec la fonctionnalité 5 : connecté, ouvrir un second onglet sur le dashboard → connecté sans nouvelle saisie ; se déconnecter dans un onglet → l'autre passe à la connexion → AC-8
- [ ] Avec la fonctionnalité 5 : connecté, attendre plus de 15 minutes (expiration du token d'accès) puis charger une page → un seul `POST /auth/refresh`, la page se charge → AC-3
- [ ] Avec la fonctionnalité 5 : arrêter le backend pendant une session, déclencher une lecture → notification « Le serveur se réveille… » après 5 s sur l'API endormie de Render, ou « Impossible de joindre le serveur » en local → AC-9, AC-10

## Commands
- [x] `npx vitest run src/shared/config` → l'URL est validée et la barre finale retirée → AC-2
- [x] `npx vitest run src/shared/api/client.config.test.ts` → configuration invalide, erreur `config`, aucune requête → AC-2
- [x] `npx vitest run src/shared/api/client.test.ts` → URL et paramètres construits depuis `VITE_API_BASE_URL`, JSON envoyé, réponse vérifiée par Zod, `invalid-response` sans données dans la console, page HTML `503` gérée, `network`, `FormData` sans `Content-Type` fixé, corps vide, abandon par l'appelant, lenteur à 5 s, abandon à 70 s et 120 s → AC-1, AC-9, AC-10, AC-11, AC-14, AC-15
- [x] `npx vitest run src/shared/api/messages.test.ts` → chaque ligne de la table « Messages d'erreur », `seriesCount` présent ou absent, détails du backend, remplacements par code avant statut, aucune fuite du message d'une erreur inconnue → AC-10, AC-15
- [x] `npx vitest run src/shared/session` → login admin et non admin, 401 de connexion sans refresh, un seul refresh pour trois 401, rejeu sans refresh d'un token déjà remplacé, refresh refusé (tokens, cache, requêtes en cours, onglets), première raison gagnante, 403 avec ou sans code, reprise (succès, refresh refusé, profil non admin), onglets (aucune réponse, premier partage gagnant, partage et déconnexion sans rediffusion) → AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
- [x] `npx vitest run src/shared/query` → réessais : 2 sur réseau et 5xx, 1 sur timeout, 0 sur 4xx, fin de session, réponse invalide et abandon ; mutations jamais → AC-12
- [x] `npx vitest run src/shared/ui` → `ErrorState`, `notifyError` (silencieux pour abandon et fin de session), `applyFieldErrors` (400, 409, autres), notification de lenteur, écran de configuration → AC-2, AC-9, AC-13
- [x] `grep -rn "fetch(" src --include=*.ts --include=*.tsx | grep -v test` → une seule ligne, dans `src/shared/api/client.ts` → AC-1

## Value sourcing
- [ ] Adresse de l'API : changer `VITE_API_BASE_URL` dans `.env.local` (port différent), relancer → les requêtes partent vers la nouvelle adresse → AC-1
- [x] Refresh token : seulement dans `sessionStorage` (`noli.admin.refreshToken`), jamais dans `localStorage` ni dans une URL → AC-6, AC-15
- [x] Rôle à la connexion lu dans `user.role` de `POST /auth/login` ; à la reprise, dans `user.role` de `GET /auth/profile`, avec l'identifiant lu dans `_id` → AC-6, AC-7
- [x] Raison de fin : 401 sur refresh → `expired` avec message ; 403 sans code → `forbidden` avec message ; déconnexion → `logout` sans message → AC-4, AC-5
- [x] Nombre de séries du message `CATEGORY_IN_USE` lu dans `seriesCount` du corps 409, formulation de secours sans lui → AC-10
- [x] Délai : 120 s pour un `FormData`, 70 s sinon ; seuil de lenteur 5 s → AC-9

## Acceptance-criteria coverage
- AC-1 : client.test, grep `fetch(`, adresse de l'API · AC-2 : env.test, client.config.test, ui.test, écran manuel · AC-3 : session.test (refresh partagé, rejeu), manuel avec la fonctionnalité 5 · AC-4 : session.test (refresh refusé, première raison) · AC-5 : session.test (403 avec ou sans code) · AC-6 : session.test (login), manuel avec la fonctionnalité 5 · AC-7 : session.test (reprise), manuel `sessionStorage` · AC-8 : session.test (onglets), manuel avec la fonctionnalité 5 · AC-9 : client.test (lenteur, délais), ui.test (notification) · AC-10 : messages.test, client.test (HTML 503) · AC-11 : client.test (invalid-response) · AC-12 : queryClient.test · AC-13 : ui.test · AC-14 : client.test (FormData) · AC-15 : client.test (console), messages.test (erreur inconnue), session.test (localStorage vide)
