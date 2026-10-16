# Verify: recherche et filtres · spec 0009 · updated 2026-10-16
_Steps derived from spec 0009 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Essais réels sur l'API locale branchée sur la base `noli_dev` (compte `demo.admin@noli.test`), puis contrôle en production en lecture seule.

## UI / manual
- [ ] Ouvrir `/series` → au dessus du tableau : « Rechercher un titre », « Catégorie » (« Toutes les catégories »), « Accès » (Toutes cochée) ; pas de « Effacer les filtres » → AC-1
- [ ] Taper « MARIAGE A » d'une traite → une seule requête `GET /series/admin?…q=MARIAGE+A` 300 ms après la dernière frappe, « Mariage à Niamey » seule ligne, « 1 série trouvée », adresse `/series?q=MARIAGE+A` → AC-2, AC-3, AC-4
- [ ] Taper « m » seul → aide « 2 caractères au moins » sous le champ, aucune requête filtrée, liste complète → AC-2
- [ ] Taper « (.* » → aucune erreur, « Aucune série ne correspond à ces filtres. » avec « Effacer les filtres » → AC-2, AC-7
- [ ] Depuis `/series?page=2` (catalogue de plus de 20 séries), taper une recherche puis la compléter → une entrée d'historique au premier envoi, remplacée ensuite ; retour arrière → `/series?page=2`, champ vide → AC-4
- [ ] Taper un texte puis cliquer « Premium » avant 300 ms → l'adresse garde le texte et `acces=premium` → AC-4
- [ ] Choisir une catégorie puis « Gratuites » → deux entrées d'historique, page 1, requête avec `categoryId` et `premium=false`, compte juste → AC-1, AC-3, AC-4
- [ ] Masquer une catégorie dans `/categories` (sur `noli_dev`), revenir à `/series` → elle est proposée « Nom (masquée) », la choisir liste ses séries ; dans les lignes, la catégorie s'affiche « (masquée) » en texte secondaire ; la remettre visible ensuite → AC-1, AC-9
- [ ] Ouvrir une série depuis une liste filtrée puis « Retour aux séries » → mêmes filtres et même page → AC-4
- [ ] Recharger une liste filtrée, ou coller son adresse dans un nouvel onglet → même liste → AC-4
- [ ] Ouvrir `/series?q=x&acces=vip&categorie=65a1b2c3d4e5f6a7b8c9d0ff` → adresse `/series` sans nouvelle entrée, liste complète, jamais « Aucune série » entre temps → AC-5
- [ ] Ouvrir `/series?acces=gratuites&page=3` (peu de résultats) → dernière page, filtre gardé, sans nouvelle entrée → AC-6
- [ ] « Effacer les filtres » → adresse `/series`, focus dans « Rechercher un titre », résumé « 1 à 20 sur N » revenu → AC-6, AC-10
- [ ] Couper l'API pendant une liste filtrée → état d'erreur avec « Réessayer », barre de filtres toujours là et modifiable → AC-8
- [ ] Faire échouer `/categories/all` (outils du navigateur, blocage de la requête) → « Catégorie » désactivé avec « Catégories indisponibles », recherche et accès marchent → AC-8
- [ ] Au clavier seul : Tab jusqu'à chaque filtre, flèches dans « Accès », recherche dans « Catégorie », focus visible partout ; un lecteur d'écran annonce « N séries trouvées » après chaque filtre → AC-10
- [ ] Largeur 375 px → filtres empilés, pas de défilement horizontal de la page → AC-1
- [ ] Production (lecture seule, après mise en ligne de l'API puis du dashboard) : une recherche, un filtre de catégorie, un filtre d'accès sur https://admin.nollli.com → AC-12

## Commands
- [ ] `GET /series/admin` sans jeton → `401` ; jeton d'un non admin → `403` → AC-11
- [ ] `GET /series/admin?limit=51`, `?q=a`, `?categoryId=drame`, `?premium=oui` → `400` → AC-11
- [ ] `GET /series/admin?q=mariage a niamey` et `?q=MARIAGE À NIAMEY` → « Mariage à Niamey » ; `?q=(.*` → `200` → AC-2, AC-11
- [ ] `GET /series/admin?categoryId=<catégorie masquée>` → ses séries, catégories avec `isVisible: false` → AC-9, AC-11
- [ ] `GET /series?limit=2` (route publique) → forme inchangée, sans catégorie masquée → AC-11
- [ ] `npx jest src/series` dans `noli-backend` → vert → AC-11
- [ ] `npx vitest run` dans le dashboard → vert

## Value sourcing
- [ ] Filtres affichés : changer l'adresse à la main (`?q=lagune&acces=gratuites`) → le champ et le choix d'accès suivent l'adresse
- [ ] Requête : chaque requête de l'onglet réseau porte exactement `page`, `limit=20` et les filtres de l'adresse (`categorie` → `categoryId`, `acces=premium` → `premium=true`, `gratuites` → `false`)
- [ ] Liste et total : comparer le compte affiché au `data.total` de la réponse, pour un filtre combiné (par exemple Thriller + Premium = 4 sur `noli_dev`)
- [ ] Recherche sans accents : « comedie » et « COMÉDIE » trouvent la même série
- [ ] Choix de catégorie : les options suivent l'ordre de `/categories/all`, les masquées suffixées
- [ ] Résumé sans filtre : « 1 à 20 sur N » avec N = total sans filtre
- [ ] Catégories d'une ligne : identiques à `series.categories` de la réponse admin, masquées comprises
- [ ] Retour depuis une fiche : l'état `from` contient l'adresse filtrée complète
- [ ] Catégorie invalide : retirée seulement une fois `/categories/all` chargé ; si `/categories/all` échoue, gardée

## Acceptance-criteria coverage
- AC-1 … barre, libellés, écran étroit · AC-2 … recherche, « m », caractères spéciaux · AC-3 … requêtes et page 1 · AC-4 … adresse, historique, retour, partage · AC-5 … adresse invalide · AC-6 … compte, effacement, page hors limites · AC-7 … aucun résultat · AC-8 … erreurs liste et catégories · AC-9 … catégories masquées · AC-10 … clavier, annonce, focus · AC-11 … commandes de la route · AC-12 … production
