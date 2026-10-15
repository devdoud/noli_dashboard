# Scope: Noli Dashboard

Application web d'administration de Noli. Elle permet à 1 à 3 admins internes de gérer le contenu (séries, épisodes, images, catégories) directement sur l'API NestJS existante, sans passer par Swagger ni la base de données. Interface en français, pensée pour l'ordinateur et lisible sur téléphone.

**Build approach:** Tracer Bullet (chaque fonctionnalité est branchée de bout en bout sur la vraie API et utilisable dès qu'elle est finie ; on prouve d'abord que tout le circuit marche, puis on l'épaissit).
**Workflow:** Beta (après `/develop`, `/check verify` puis `/test`). C'est le niveau de rigueur par défaut du projet : l'outil est interne, mais il modifie et supprime le contenu de production. `/architect` est le premier arrêt conseillé pour une fonctionnalité qui demande une vraie décision, mais vous pouvez le sauter si vous savez déjà comment la construire. Chaque fonctionnalité peut porter son propre niveau (par exemple `· Alpha`).

_Ce sont des recommandations pour garder une construction ordonnée, pas des obligations. Sautez ce qui ne convient pas : si vous savez déjà construire une fonctionnalité, passez directement à `/develop`. C'est vous qui décidez quand une fonctionnalité est `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack & architecture | Foundation | done |
| 2 | Coding standards & tooling | Foundation | done |
| 3 | Client API & erreurs | Foundation | done |
| 4 | Design system & UI foundation | Foundation | done |
| 5 | Connexion admin et liste des séries | Slice 1 | done |
| 6 | Fiche série | Slice 2 | done |
| 7 | Épisodes | Slice 3 | in-progress |
| 8 | Images | Slice 4 | planned |
| 9 | Catégories | Slice 5 | planned |
| 10 | Recherche et filtres | Slice 6 | planned |
| 11 | Vue d'ensemble | Slice 7 | planned |
| 12 | Notification de test | Slice 8 | planned |

## Foundations

### 1. Stack & architecture · done
Choisir le framework web, la bibliothèque d'interface, l'hébergement et la façon de garder les tokens, puis créer un projet qui démarre. Rien ne s'installe avant cette décision.
**Done when:** la pile est notée dans une spec, le projet vide démarre en local et se construit sans erreur, et le `.gitignore` (en UTF-8) exclut `node_modules/`, `dist/`, `.env` et `.env.*`.
- [x] Decide the stack (spec): `/architect stack & architecture`
- [x] Scaffold from the decision: `/develop stack & architecture`
Spec [0001](../specs/0001-stack-architecture/index.md) · code in `./` (`src/app/`, config à la racine)

### 2. Coding standards & tooling · done
Noter les conventions à partir du vrai projet, puis installer lint, formatage et contrôles avant commit.
**Done when:** le `AGENTS.md` racine décrit la vraie pile, et lint, formatage et contrôles avant commit passent sans erreur.
- [x] Capture conventions + tooling choices: `/audit`
- [x] Install the tooling: `/develop tooling`
code in `eslint.config.js`, `.prettierrc.json`, `.husky/`, `.github/workflows/ci.yml`

### 3. Client API & erreurs · done
Une seule façon d'appeler l'API pour tout le dashboard : client typé à partir de `openapi.json` ou écrit à la main, adresse de l'API par environnement, et traduction des erreurs en messages clairs.
**Done when:** chaque appel passe par ce client ; un `401` renouvelle le token une fois puis renvoie à la connexion ; `403`, `409`, `413`, `415`, `429` et `503` s'affichent en français compréhensible.
- [x] Design it (spec): `/architect client API & erreurs`
- [x] Build it: `/develop client API & erreurs`
   - [x] Client de base : configuration, `apiRequest`, `ApiError`, vérification Zod, table des messages (AC-1, AC-2, AC-10, AC-11, AC-14, AC-15)
   - [x] Session : login, logout, renouvellement partagé, fin de session, `403`, reprise au démarrage (AC-3 à AC-7)
   - [x] Onglets et réveil de l'API : partage entre onglets, délais, notification de lenteur (AC-8, AC-9)
   - [x] Intégration UI : règles de réessai, `ErrorState`, `notifyError`, `applyFieldErrors` (AC-12, AC-13)
- [x] Verify it: `/check verify client API & erreurs`
- [x] Test it: `/test client API & erreurs`
Spec [0002](../specs/0002-client-api-erreurs/index.md) · code in `src/shared/` (`api/`, `session/`, `query/`, `ui/`, `config/`)

### 4. Design system & UI foundation · done
Langage visuel, mise en page (menu latéral, en tête, contenu) et composants de base : tableau paginé, formulaire, boîte de confirmation, notification courte.
**Done when:** `design.md` couvre typographie, couleurs, espacements et composants ; les composants de base gèrent le clavier et le focus ; la mise en page reste lisible sur téléphone.
- [x] Design it (spec): `/architect design system & UI foundation`
- [x] Build it: `/develop design system & UI foundation`
   - [x] Thème et identité : polices, logo, palettes, modes clair et sombre sans clignotement (AC-1 à AC-4)
   - [x] Mise en page : `AppLayout`, menu et ☰, en tête avec session, `PageHeader`, 404, vitrine (AC-5, AC-6, AC-7, AC-12, AC-13, AC-15)
   - [x] Composants : `DataTable`, `EmptyState`, `TableSkeleton`, `confirmDanger`, `notifySuccess`, formatage (AC-8 à AC-11)
   - [x] Contrastes mesurés et `design.md` (AC-4, AC-14)
- [x] Verify it: `/check verify design system & UI foundation`
- [x] Test it: `/test design system & UI foundation`
Spec [0003](../specs/0003-design-system-ui-foundation/index.md) · code in `src/shared/ui/`, `src/app/` (routes, pages, `dev/`), `public/` (polices, logo, `color-scheme.js`), `design.md`

## Slice 1: Connexion admin et liste des séries

### 5. Connexion admin et liste des séries · done
Le premier fil complet, qui sert aussi de squelette : se connecter, vérifier le rôle admin, voir la liste paginée des séries. Il prouve que le dashboard, l'API et l'hébergement communiquent vraiment.
**Done when:** un admin se connecte et voit la liste paginée des séries ; un compte non admin est refusé avec un message clair ; la session survit à l'expiration du token d'accès ; la déconnexion marche ; le dashboard en ligne appelle l'API de production sans blocage CORS.
- [x] Design it (spec): `/architect connexion admin et liste des séries`
- [x] Build it: `/develop connexion admin et liste des séries`
   - [x] Garde de routes et chargement plein écran, adresse de retour sûre (AC-3, AC-5)
   - [x] Page de connexion : formulaire, erreurs, message de fin de session, déjà connecté (AC-1, AC-2, AC-4, AC-6, AC-7)
   - [x] Liste des séries : colonnes, pagination dans l'adresse, états, entrée de menu (AC-8 à AC-11)
   - [x] Mise en ligne sur `admin.nollli.com` reliée à l'API de production (AC-12)
- [x] Verify it: `/check verify connexion admin et liste des séries`
- [x] Test it: `/test connexion admin et liste des séries`
Spec [0004](../specs/0004-connexion-liste-series/index.md) · code in `src/features/auth/`, `src/features/series/`, `src/shared/session/RequireSession.tsx`

## Slice 2: Fiche série

### 6. Fiche série · done
Créer, modifier et supprimer une série, et régler l'accès premium (série payante, nombre d'épisodes gratuits).
**Done when:** un admin crée une série avec au moins une catégorie, la modifie, change ses réglages premium et la supprime après confirmation ; un titre déjà pris affiche une erreur claire.
- [x] Design it (spec): `/architect fiche série`
- [x] Build it: `/develop fiche série`
   - [x] Prérequis backend : la réponse admin garde les catégories masquées, API redéployée (AC-9)
   - [x] Fiche et modification : lien depuis la liste, aperçu, formulaire, catégories, langues, pays, accès, erreurs (AC-1, AC-3, AC-5 à AC-11, AC-14)
   - [x] Création et protections : page de création, changements non enregistrés, suppression, accessibilité (AC-2 à AC-4, AC-12, AC-13, AC-15)
   - [x] Mise en ligne sur `admin.nollli.com`, contrôle en lecture seule (AC-16)
- [x] Verify it: `/check verify fiche série`
- [x] Test it: `/test fiche série`
Spec [0005](../specs/0005-fiche-serie/index.md) · code in `src/features/series/` (et `noli-backend`, `src/series/content-access.ts`)

## Slice 3: Épisodes

### 7. Épisodes · in-progress
Gérer les épisodes d'une série, rangés par saison, et leur donner leur vidéo en l'envoyant vers l'hébergement vidéo (ou en l'important depuis un lien), avec l'état de chaque vidéo visible.
**Done when:** un admin ajoute un épisode (saison, numéro, titre, durée), envoie son fichier vidéo et le voit passer à « Prête », le modifie et le supprime après confirmation ; un doublon saison et numéro est refusé clairement ; l'état de chaque vidéo (`ready`, `pending`, `error`, `legacy`, `none`) est affiché ; les anciens liens collés se migrent vers l'hébergement.
- [x] Design it (spec): `/architect épisodes`
- [x] Build it: `/develop épisodes`
   - [x] Prérequis backend : import du lien collé stocké (`fromPastedLink`), API redéployée (AC-8)
   - [x] Section et informations : tableaux par saison, états, accès, fenêtre d'ajout et de modification, doublon (AC-1 à AC-6, AC-11, AC-12)
   - [x] Vidéos : envoi simple et tus en arrière plan, vérification, import, migration, remplacement, retrait, publication (AC-4, AC-7 à AC-10, AC-13)
   - [x] Suppression, protections, erreurs, accessibilité, puis mise en ligne contrôlée en lecture seule (AC-14 à AC-18)
- [x] Verify it: `/check verify épisodes`
- [ ] Test it: `/test épisodes`
Spec [0006](../specs/0006-episodes/index.md) · Code `src/features/series/episodes/`

## Slice 4: Images

### 8. Images · needs a decision
Envoyer et retirer la couverture, la bannière et la vignette d'épisode, avec aperçu et contrôle du format avant l'envoi.
**Done when:** un admin envoie puis retire chaque image ; le format (JPEG, PNG, WebP), la taille (5 Mo) et les dimensions minimales sont vérifiés avant l'envoi ; la limite de 10 envois en 10 minutes s'affiche clairement.
- [ ] Design it (spec): `/architect images`

## Slice 5: Catégories

### 9. Catégories · needs a decision
Gérer toutes les catégories, masquées comprises : créer, modifier, masquer, réordonner, supprimer, et leur image carrée.
**Done when:** un admin crée, renomme, masque et réordonne les catégories et en change l'image ; supprimer une catégorie encore utilisée affiche pourquoi c'est refusé ; un nom trop proche d'un existant est refusé clairement.
- [ ] Design it (spec): `/architect catégories`

## Slice 6: Recherche et filtres

### 10. Recherche et filtres · needs a decision
Retrouver vite une série dans la liste, par titre, catégorie ou accès premium.
**Done when:** un admin filtre la liste par titre, catégorie et premium ; l'adresse de la page garde les filtres ; les cas « aucun résultat » et erreur s'affichent.
- [ ] Design it (spec): `/architect recherche et filtres`

## Slice 7: Vue d'ensemble

### 11. Vue d'ensemble · needs a decision
Une page d'accueil avec quelques chiffres utiles pour repérer le travail à faire.
**Done when:** la page d'accueil montre le nombre de séries, d'épisodes et d'épisodes sans vidéo prête, chacun menant à la liste concernée.
- [ ] Design it (spec): `/architect vue d'ensemble`

## Slice 8: Notification de test

### 12. Notification de test
Un bouton qui envoie un push de test sur les téléphones de l'admin connecté.
**Done when:** l'admin voit combien d'appareils ont reçu le test et combien ont échoué ; un serveur sans push configuré affiche un message clair.
- [ ] Build it: `/develop notification de test`

## Deferred
Hors de ce passage, gardé pour que le plan reste honnête.
- **Abonnés et revenus**: suivre les abonnés premium et les paiements · needs a decision (la fonctionnalité 5 du backend n'existe pas encore)
- **Rôles et équipe éditoriale**: plusieurs niveaux d'accès (éditeur, admin) · needs a decision
- **Année de sortie effaçable**: le backend accepte `releaseYear: null` en modification · from spec 0005
- **Journal d'audit des séries**: tracer créations et suppressions côté backend, si le nombre d'admins grandit · from spec 0005
- **Conflits d'écriture**: prévenir quand deux admins modifient la même série en même temps · from spec 0005
- **Déplacer un épisode**: changer sa saison ou son numéro sans perdre l'historique de visionnage · from spec 0006

## Legend

**La case de décision.** Chaque fonctionnalité en a exactement une, la sous tâche dont le libellé finit par `(spec)`. Son libellé varie (`Design it (spec)` en général, `Decide the stack (spec)` pour Stack & architecture), donc les skills la repèrent par ce suffixe `(spec)`, jamais par le libellé exact. Toutes les autres cases sont des cases d'exécution, et `/architect` n'en coche jamais.

**Cycle de vie d'une fonctionnalité** :

| État | Posé par | La fonctionnalité montre |
|---|---|---|
| `planned` · needs a decision | `/scope` | une case : `Design it (spec): /architect <feature>` |
| `in-progress` (conçue) | **`/architect` à la capture de la spec** | `Design it` cochée ; spec liée ; `Build it: /develop <feature>` + **2 à 5 jalons** ; les cases de fin du niveau (`Verify it` dès Alpha, `Test it` dès Beta, `Review it` + `Document it` en GA) |
| `in-progress` (en construction) | `/develop` | les jalons se cochent un par un ; lien vers le code ajouté |
| `in-progress` (vérifiée) | `/check verify` | `Build it` et ses jalons cochés ; `Verify it` cochée |
| `done` | **vous, quand vous le décidez** ; `/sync` réconcilie | cases lancées cochées, cases sautées marquées ; en Beta, le moment conseillé est après `/test` |

- **Prochaine étape** = la première case non cochée (toujours une commande ou un jalon suivi).
- **needs a decision** = lancer `/architect` d'abord ; sinon directement `/develop` (ou `/audit` pour les standards et l'outillage). La mention disparaît une fois la spec capturée.
- **Les tâches de construction détaillées vivent dans le `## Build plan` de la spec**, pas ici : le scope ne garde que les jalons.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (avant le workflow) et `dropped` (retiré du périmètre, gardé pour l'historique).
- **Mention d'approche** à côté d'un titre (par exemple `· Facade`) : remplace l'approche du projet pour cette fonctionnalité ; sans mention, elle hérite.
- **Mention de niveau** à côté d'un titre (par exemple `· GA`, `· Alpha`) : change la rigueur de cette seule fonctionnalité ; sans mention, elle suit le niveau du projet.
- **Workflow** (ligne d'en tête) : ce qui suit `/develop` par défaut. **Prototype** = rien ; **Alpha** = `/check verify` ; **Beta** = `/check verify` puis `/test` ; **GA** = ajoute `/check review` par un modèle neuf puis `/document`. Une fonctionnalité construite sur une décision non ratifiée (spec `Assumed`) reste signalée, sans bloquer `done`.
- **Ligne de liens** (`spec <n> · code in <path>`) : le lien de spec ajouté par `/architect`, le chemin du code par `/develop`.
