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
| 3 | Client API & erreurs | Foundation | in-progress |
| 4 | Design system & UI foundation | Foundation | planned |
| 5 | Connexion admin et liste des séries | Slice 1 | planned |
| 6 | Fiche série | Slice 2 | planned |
| 7 | Épisodes | Slice 3 | planned |
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

### 3. Client API & erreurs · in-progress
Une seule façon d'appeler l'API pour tout le dashboard : client typé à partir de `openapi.json` ou écrit à la main, adresse de l'API par environnement, et traduction des erreurs en messages clairs.
**Done when:** chaque appel passe par ce client ; un `401` renouvelle le token une fois puis renvoie à la connexion ; `403`, `409`, `413`, `415`, `429` et `503` s'affichent en français compréhensible.
- [x] Design it (spec): `/architect client API & erreurs`
- [x] Build it: `/develop client API & erreurs`
   - [x] Client de base : configuration, `apiRequest`, `ApiError`, vérification Zod, table des messages (AC-1, AC-2, AC-10, AC-11, AC-14, AC-15)
   - [x] Session : login, logout, renouvellement partagé, fin de session, `403`, reprise au démarrage (AC-3 à AC-7)
   - [x] Onglets et réveil de l'API : partage entre onglets, délais, notification de lenteur (AC-8, AC-9)
   - [x] Intégration UI : règles de réessai, `ErrorState`, `notifyError`, `applyFieldErrors` (AC-12, AC-13)
- [ ] Verify it: `/check verify client API & erreurs`
- [ ] Test it: `/test client API & erreurs`
Spec [0002](../specs/0002-client-api-erreurs/index.md) · code in `src/shared/` (`api/`, `session/`, `query/`, `ui/`, `config/`)

### 4. Design system & UI foundation · needs a decision
Langage visuel, mise en page (menu latéral, en tête, contenu) et composants de base : tableau paginé, formulaire, boîte de confirmation, notification courte.
**Done when:** `design.md` couvre typographie, couleurs, espacements et composants ; les composants de base gèrent le clavier et le focus ; la mise en page reste lisible sur téléphone.
- [ ] Design it (spec): `/architect design system & UI foundation`

## Slice 1: Connexion admin et liste des séries

### 5. Connexion admin et liste des séries · needs a decision
Le premier fil complet, qui sert aussi de squelette : se connecter, vérifier le rôle admin, voir la liste paginée des séries. Il prouve que le dashboard, l'API et l'hébergement communiquent vraiment.
**Done when:** un admin se connecte et voit la liste paginée des séries ; un compte non admin est refusé avec un message clair ; la session survit à l'expiration du token d'accès ; la déconnexion marche ; le dashboard en ligne appelle l'API de production sans blocage CORS.
- [ ] Design it (spec): `/architect connexion admin et liste des séries`

## Slice 2: Fiche série

### 6. Fiche série · needs a decision
Créer, modifier et supprimer une série, et régler l'accès premium (série payante, nombre d'épisodes gratuits).
**Done when:** un admin crée une série avec au moins une catégorie, la modifie, change ses réglages premium et la supprime après confirmation ; un titre déjà pris affiche une erreur claire.
- [ ] Design it (spec): `/architect fiche série`

## Slice 3: Épisodes

### 7. Épisodes · needs a decision
Gérer les épisodes d'une série, rangés par saison, avec un lien vidéo collé et l'état de la vidéo visible.
**Done when:** un admin ajoute un épisode (saison, numéro, titre, durée, lien vidéo), le modifie et le supprime après confirmation ; un doublon saison et numéro est refusé clairement ; l'état de chaque vidéo (`ready`, `pending`, `error`, `legacy`, `none`) est affiché.
- [ ] Design it (spec): `/architect épisodes`

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
- **Vidéos hébergées**: envoyer ou importer une vidéo d'épisode vers l'hébergement vidéo · needs a decision (le backend répond `503` pour l'instant)
- **Abonnés et revenus**: suivre les abonnés premium et les paiements · needs a decision (la fonctionnalité 5 du backend n'existe pas encore)
- **Rôles et équipe éditoriale**: plusieurs niveaux d'accès (éditeur, admin) · needs a decision

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
