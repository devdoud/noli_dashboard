# Verify: Connexion admin et liste des séries · spec 0004 · updated 2026-10-14
_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

En local : `npm run dev` avec l'API locale (`VITE_API_BASE_URL=http://localhost:3000`) et un compte admin de démonstration. En ligne : `https://admin.nollli.com` avec votre compte admin de production, saisi par vous seulement.

## UI / manual
- [x] Ouvrir `/connexion` → carte centrée « Noli », « Espace d'administration », champs Email et Mot de passe, bouton « Se connecter », pas de menu ; le focus est dans Email ; l'onglet dit « Connexion · Noli Admin » → AC-1
- [x] Cliquer l'œil du mot de passe (souris puis clavier) → le texte apparaît, le bouton s'appelle « Masquer le mot de passe » → AC-1
- [x] Envoyer le formulaire vide, puis avec `pas-un-email` → « Adresse email invalide. » et « Mot de passe requis. » sous les champs, aucune requête dans l'onglet Réseau, aucune bulle du navigateur → AC-2
- [x] Taper l'email avec des espaces autour → la requête `POST /auth/login` contient l'email sans espaces → AC-2 (valeur : email envoyé)
- [x] Mauvais mot de passe → « Email ou mot de passe incorrect. » dans la carte, pas de session (aucune clé `noli.admin.refreshToken` dans sessionStorage) → AC-4 (valeur : message d'erreur)
- [x] Compte non admin (local, `demo.free@noli.test`) → « Ce compte n'a pas accès au tableau de bord. », pas de session → AC-4
- [x] Double clic rapide sur « Se connecter » → une seule requête `POST /auth/login`, bouton en chargement « Connexion en cours » → AC-4
- [x] Sans session, ouvrir `/series?page=2` → adresse `/connexion?retour=%2Fseries%3Fpage%3D2` ; après connexion, arrivée sur `/series?page=2` → AC-3, AC-5 (valeurs : adresse de retour, destination)
- [x] Sans session, ouvrir `/connexion?retour=//evil.com` puis se connecter → arrivée sur `/series` → AC-3
- [x] Recharger une page protégée avec une session ouverte → bref chargement plein écran, puis la page (jamais la connexion) → AC-5
- [x] Ouvrir `/nimporte-quoi` sans session → redirection vers la connexion → AC-5
- [x] Session ouverte, ouvrir `/connexion` → redirection vers `/series` → AC-7
- [x] Sur `/series?page=2`, cliquer « Se déconnecter » → adresse `/connexion` sans `retour`, aucun message → AC-6 (valeur : retour après déconnexion)
- [x] Forcer l'expiration (effacer sessionStorage puis provoquer un 401, ou attendre l'expiration) → la connexion affiche « Votre session a expiré, reconnectez vous. » en indigo, garde `retour` ; le message disparaît au premier envoi → AC-6 (valeur : message de fin de session)
- [x] `/series` → titre « Séries », description, tableau aux 7 colonnes, 20 lignes au plus, résumé « 1 à N sur T » → AC-8 (valeurs : lignes et total, taille de page)
- [x] Vérifier une ligne contre `GET /series` : vignette ou bloc par défaut, catégories séparées par des virgules ou « — », « En cours » / « Terminée » / « — », « Premium » + « N gratuits » ou « Gratuit », épisodes à droite, note « 8,4 (120) » ou « — » si aucun vote, date en français → AC-8 (valeurs : colonnes)
- [x] Mode clair et mode sombre : badges entiers (pas de « … »), textes lisibles → AC-8
- [x] Avec plus de 20 séries : « Page suivante » → `?page=2`, nouvelle requête `page=2&limit=20`, retour en haut, « Page 2 sur N » annoncé ; le bouton Retour du navigateur revient à la page 1 → AC-9 (valeur : page demandée)
- [x] Ouvrir `/series?page=abc`, `?page=0`, `?page=99999` → page 1 → AC-9
- [x] Ouvrir `/series?page=99` → l'adresse devient la dernière page, sans état vide visible, sans entrée d'historique en plus → AC-9 (valeur : dernière page)
- [x] Couper le réseau puis ouvrir `/series` → `ErrorState` avec « Réessayer » ; rétablir puis cliquer → la liste arrive → AC-10
- [ ] Ouvrir `/series` avec une API en erreur, puis cliquer « Réessayer » avec une réponse lente → l'erreur et « Réessayer » restent affichés (pas de squelettes) jusqu'à la réponse, puis la liste arrive → AC-10
- [x] Base sans série → « Aucune série pour le moment » → AC-10
- [x] Changer de page avec un réseau lent → anciennes lignes grisées jusqu'à l'arrivée des nouvelles → AC-10
- [x] Le menu montre « Vue d'ensemble » et « Séries » ; « Séries » est active sur `/series?page=2` → AC-11
- [x] Sur `https://admin.nollli.com`, vous connecter avec votre compte admin de production → la liste des séries de production s'affiche, aucune erreur CORS ni CSP dans la console → AC-12 (valeurs : adresse de l'API, compte de production, origine autorisée)

## Commands
- [x] `curl -i -X OPTIONS https://api.nollli.com/auth/login -H "Origin: https://admin.nollli.com" -H "Access-Control-Request-Method: POST"` → `Access-Control-Allow-Origin: https://admin.nollli.com` → AC-12
- [x] `curl -sI https://admin.nollli.com/series` → `200` et l'en tête `Content-Security-Policy` avec `connect-src 'self' https://api.nollli.com` → AC-12
- [x] `npx vitest run` → toute la suite passe → AC-1 à AC-11
- [x] `npm run build` → build sans erreur, sans la vitrine `/dev/composants` → AC-5

## Acceptance-criteria coverage
- AC-1 : carte, focus, œil du mot de passe · AC-2 : validation, email nettoyé · AC-3 : retour sûr et refusé · AC-4 : 401, non admin, double clic · AC-5 : garde, chargement, 404 protégée · AC-6 : expiration et déconnexion · AC-7 : déjà connecté · AC-8 : colonnes, contrastes · AC-9 : page dans l'adresse, valeurs invalides, recadrage · AC-10 : erreur, vide, lignes grisées · AC-11 : menu · AC-12 : connexion réelle en ligne, `curl` CORS et CSP

## Notes
- Les couvertures des séries de démonstration en production sont sur `picsum.photos`, bloquées par la CSP (Cloudinary seulement) : elles affichent le bloc par défaut. C'est voulu (décision du 2026-10-14) ; les vraies couvertures viendront de Cloudinary avec la fonctionnalité 8.
- Déjà contrôlé pendant `/develop` (2026-10-14) : le site en ligne redirige `/series?page=2` vers la connexion avec `retour`, et une connexion avec une adresse inventée reçoit « Email ou mot de passe incorrect. » de l'API de production (CORS ouvert, pas d'erreur CSP).
- `/check verify` du 2026-10-14 : PASS sur le build de production servi en local (API locale, comptes de démonstration) et en ligne. La pagination, l'état vide et les erreurs ont été exercés avec des réponses `GET /series` interceptées dans le navigateur (la base locale n'a que 12 séries). AC-12 : connexion réelle faite par l'engineer sur `https://admin.nollli.com`, liste de production visible.
- En développement seulement, le `StrictMode` de React envoie une première requête annulée (`ERR_ABORTED`) à chaque montage de la liste ; le build de production n'en envoie qu'une.
