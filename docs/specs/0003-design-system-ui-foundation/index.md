# 0003. Design system et fondation de l'interface

**Date**: 2026-10-13
**Status**: Proposed

## Summary

Le dashboard reprend l'identité de l'app mobile Noli (ambre safran, indigo, fond très sombre, polices Bricolage Grotesque et Plus Jakarta Sans, logo), adaptée à un outil d'administration en mode clair et en mode sombre. Cette spec fixe le thème Mantine, la mise en page (menu latéral, en tête) et une petite boîte de composants communs : tableau paginé, en tête de page, états vide et chargement, confirmation de suppression, notification de succès, formatage des dates et durées. Tous les écrans suivants s'appuient dessus, donc ils auront le même aspect sans rien réinventer. Une page vitrine, présente seulement en développement, montre chaque composant dans ses états.

## Requirements

**User stories**:
- En tant qu'admin, je veux un dashboard qui ressemble à Noli et reste lisible en clair comme en sombre, pour travailler longtemps sans fatigue.
- En tant qu'admin, je veux retrouver la même navigation, les mêmes tableaux et les mêmes confirmations partout, pour ne pas réapprendre chaque écran.
- En tant qu'admin sur téléphone, je veux pouvoir ouvrir le menu et lire un tableau, pour une correction rapide.
- En tant que développeur d'une fonctionnalité, je veux des composants prêts (tableau, en tête, confirmation…), pour construire un écran sans refaire la mise en page.

**Acceptance criteria**:
- **AC-1**: Le thème Mantine utilise l'ambre `#F5A623` comme couleur principale et l'indigo `#6C5CE7` comme couleur secondaire ; le mode sombre utilise le fond `#0B0C10` et les surfaces `#13141B` / `#1C1D26` de l'app mobile.
- **AC-2**: Le mode de couleurs suit le réglage du système au premier chargement ; un bouton dans l'en tête bascule clair ou sombre, et le choix est retenu au rechargement (`localStorage`, clé `noli-admin-color-scheme`). Le bon mode est appliqué avant le premier affichage (pas de clignotement), sans script en ligne (la CSP `script-src 'self'` reste inchangée).
- **AC-3**: Les titres utilisent Bricolage Grotesque, le texte Plus Jakarta Sans, servies par le dashboard lui même (aucune requête vers un autre domaine, la CSP `font-src 'self'` reste inchangée).
- **AC-4**: Tout texte respecte un contraste d'au moins 4,5:1 et tout élément d'interface porteur de sens (bordure de champ, icône seule, focus, bouton plein) d'au moins 3:1 sur son fond, en mode clair et en mode sombre ; les contrastes réellement mesurés sont notés dans `design.md`.
- **AC-5**: La mise en page a un en tête (logo, « Admin », bouton de thème, et quand la session est `authenticated` l'email de l'admin et un bouton « Se déconnecter ») et un menu latéral ; sous 768 px de large, l'email est masqué, le menu se replie derrière un bouton ☰ accessible (`aria-label`, `aria-expanded`, `aria-controls`), se ferme après un choix ou avec Échap, et rend alors le focus au bouton ☰.
- **AC-6**: Le menu affiche, dans cet ordre, Vue d'ensemble, Séries, Catégories, Outils ; une entrée dont l'écran n'est pas encore construit est masquée ; l'entrée de la page courante (et de ses sous pages) est marquée `aria-current="page"`, « Vue d'ensemble » seulement sur `/`.
- **AC-7**: Tout élément interactif est atteignable au clavier dans un ordre logique, avec un focus visible ; un lien d'évitement « Aller au contenu » est le premier élément atteint par Tab et met le focus sur le contenu principal ; le titre de l'onglet (`document.title`) suit la page.
- **AC-8**: `DataTable` affiche des lignes et une pagination pilotée par le serveur, selon l'ordre de priorité de la section « DataTable » ; le tableau a une légende accessible et défile horizontalement sur petit écran sans casser la page.
- **AC-9**: `confirmDanger` ouvre une boîte de dialogue qui nomme l'élément et ses conséquences, avec « Annuler » (focus par défaut) et « Supprimer » en rouge ; Échap, un clic à l'extérieur ou Annuler renvoient `false`, Supprimer renvoie `true`, la promesse ne se résout qu'une fois ; le focus revient sur le bouton qui l'a ouverte.
- **AC-10**: `notifySuccess` affiche une notification courte (4 s) en français, avec une icône de coche et un liseré vert, annoncée aux lecteurs d'écran.
- **AC-11**: `formatDate`, `formatDateTime` et `formatDuration` suivent exactement la table « Formatage ».
- **AC-12**: `PageHeader` affiche le titre de la page (un seul `h1` par page), une description facultative et une zone d'actions alignée à droite (sous le titre sur téléphone).
- **AC-13**: La page vitrine `/dev/composants` montre chaque composant dans ses états (normal, chargement, vide, erreur) ; elle n'existe qu'en développement et son code n'est pas présent dans le build de production.
- **AC-14**: `design.md` à la racine décrit les couleurs (avec les contrastes mesurés), la typographie, les espacements, la densité, la mise en page et chaque composant commun avec son usage.
- **AC-15**: Une adresse inconnue sous la mise en page affiche une page « Page introuvable » en français avec un lien vers la Vue d'ensemble.

## Decision

**Chosen option**: Option 1 : thème Mantine sur l'identité de l'app mobile, clair et sombre, composants maison minces au dessus de Mantine

Un thème Mantine unique (`src/shared/ui/theme.ts`) porte la marque Noli dans les deux modes ; une mise en page `AppLayout` et une douzaine de composants minces, écrits au dessus de Mantine dans `src/shared/ui/`, servent tous les écrans.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`)

## Rationale

Le raisonnement et les options comparées sont dans [rationale.md](rationale.md).

## Feature design

### Source du design

L'identité vient de l'app mobile `../noli_app` : `lib/core/theme/app_theme.dart` (couleurs `NColors`), `assets/google_fonts/` (polices TTF, licence OFL), `assets/images/noli_logo.png` (logo, une icône sur sa propre tuile sombre). C'est la référence ; une couleur absente de cette source se dérive d'elle par les règles ci dessous, jamais d'une autre marque. L'app n'a pas de mode clair : toutes les couleurs du mode clair sont dérivées ici.

### Couleurs

**Palettes de marque** (10 nuances Mantine chacune, la couleur source en nuance 6) :
- Nuances 0 à 5 : la source mélangée au blanc, dans cet ordre : 90 %, 75 %, 60 %, 45 %, 30 %, 15 % de blanc.
- Nuances 7 à 9 : la source mélangée au noir, à 15 %, 30 % et 45 % de noir.
- `noliAmber` (source `#F5A623`), `noliIndigo` (source `#6C5CE7`), `noliRed` (source `#FF4D6D`), `noliOrange` (source `#FF9500`).
- `/develop` calcule les valeurs hexadécimales par cette règle et les note dans `design.md`.

**Rôles par mode** :

| Rôle | Mode sombre | Mode clair | Source |
|---|---|---|---|
| Fond de page | `#0B0C10` | `#F7F7F9` | sombre : `NColors.canvas` ; clair : dérivé |
| Surface (cartes, menu, tableaux, champs) | `#13141B` | `#FFFFFF` | sombre : `NColors.surface` |
| Surface relevée (survol, en tête de tableau) | `#1C1D26` | `#F0F1F5` | sombre : `NColors.surfaceHigh` |
| Séparateur décoratif (cartes, lignes de tableau) | `rgba(255,255,255,0.08)` | `#E4E5EB` | sombre : `NColors.borderMid` |
| Bordure de champ (doit atteindre 3:1) | `#6B6E85` | `#8A8D9F` | dérivé, ≈ 3,7:1 et ≈ 3,3:1 |
| Texte principal | `#F8F9FA` | `#13141B` | sombre : `NColors.textPrimary` |
| Texte secondaire | `#A0A3BD` | `#5B5E73` | sombre : `NColors.textMeta` |
| Bouton principal plein | `noliAmber` 6, texte `#0B0C10` | `noliAmber` 6, texte `#0B0C10` | marque |
| Texte ambre (lien, libellé actif) | `noliAmber` 6 | `noliAmber` 9 (≈ 5,9:1 sur blanc) | marque, dérivé |
| Bouton danger plein (« Supprimer ») | `noliRed` 8, texte blanc (≈ 5,9:1) | `noliRed` 8, texte blanc | dérivé |
| Texte d'erreur | `noliRed` 6 (≈ 5,7:1 sur `#13141B`) | `noliRed` 8 | marque, dérivé |
| Succès (liseré, icône) | `green` 6 de Mantine | `green` 7 de Mantine | Mantine, faute de vert dans la source |

**Réglages du thème Mantine** :
- `primaryColor: 'noliAmber'`, `primaryShade: { light: 6, dark: 6 }`, `autoContrast: true`, `black: '#0B0C10'` (texte sombre choisi par `autoContrast` sur l'ambre).
- `colors.dark` remplacé, de `dark[0]` à `dark[9]` : `#F8F9FA`, `#C9CAD6`, `#A0A3BD`, `#7E8197`, `#6B6E85`, `#2B2C37`, `#1C1D26`, `#13141B`, `#0F1015`, `#0B0C10`.
- `cssVariablesResolver` : `--mantine-color-body` vaut `#0B0C10` en sombre et `#F7F7F9` en clair ; les variables de texte secondaire, de bordure de champ et de lien ambre prennent les valeurs de la table ci dessus.
- Les couleurs de lien et de `NavLink` actif utilisent la variable « texte ambre », jamais `noliAmber` 6 directement en mode clair.
- `defaultRadius: 'md'`, `focusRing: 'auto'`.
- `components` : `Table` en `verticalSpacing: 'xs'` ; `Button`, `TextInput`, `Select`, `Textarea`, `NumberInput` en `size: 'sm'` ; `Notification` avec `withBorder`.
- Taille de base 14 px (`fontSizes.md`).

### Mode de couleurs sans clignotement (AC-2)

- `MantineProvider` reçoit `colorSchemeManager={localStorageColorSchemeManager({ key: 'noli-admin-color-scheme' })}` et `defaultColorScheme="auto"`.
- Le script en ligne `ColorSchemeScript` de Mantine serait bloqué par la CSP (`script-src 'self'`). À la place, un petit fichier `public/color-scheme.js`, chargé par `<script src="/color-scheme.js"></script>` dans le `<head>` de `index.html`, fait la même chose avant le rendu :
  - il lit `localStorage['noli-admin-color-scheme']` (dans un `try`) ;
  - si la valeur vaut `auto` ou manque, il choisit selon `matchMedia('(prefers-color-scheme: dark)')` ;
  - il pose `data-mantine-color-scheme` sur `<html>`.
- La CSP reste inchangée.

### Typographie

| Famille | Graisses | Fichiers sources (`../noli_app/assets/google_fonts/`) | Usage |
|---|---|---|---|
| Bricolage Grotesque | 700, 800 | `BricolageGrotesque-Bold.ttf`, `BricolageGrotesque-ExtraBold.ttf` | titres `h1` à `h4`, « Admin » |
| Plus Jakarta Sans | 400, 500, 600, 700 | `PlusJakartaSans-Regular.ttf`, `-Medium.ttf`, `-SemiBold.ttf`, `-Bold.ttf` | texte, tableaux, formulaires |

- Conversion en `woff2`, une fois, et commit des fichiers convertis dans `src/shared/ui/fonts/`, avec les deux licences OFL.
- `@font-face` dans `src/shared/ui/fonts.css`, importé par `providers.tsx`, avec `font-display: swap`.
- Polices de secours `system-ui, -apple-system, 'Segoe UI', sans-serif`.
- Préchargement dans `index.html` de `PlusJakartaSans-Regular` et `BricolageGrotesque-Bold` (`<link rel="preload" as="font" type="font/woff2" crossorigin>`).
- Thème : `fontFamily` Plus Jakarta Sans, `headings.fontFamily` Bricolage Grotesque, `headings.fontWeight` 700.

### Fournisseurs

- `ThemeProviders` (déjà utilisé par l'écran « Configuration invalide ») porte le thème, le gestionnaire de mode, `ModalsProvider` et `Notifications`. La position des notifications passe en `bottom-right`, pour ne pas couvrir l'en tête.
- L'écran « Configuration invalide » profite donc du thème, sans `AppLayout` : il n'a ni session ni routeur.
- `@mantine/modals` n'importe sa propre feuille de style que si le paquet en fournit une ; sinon les styles de `@mantine/core` suffisent.

### Mise en page (`AppLayout`)

- `AppShell` de Mantine : en tête de 56 px, menu latéral de 240 px, point de rupture `sm` (768 px), menu replié sous ce point (`navbar.collapsed.mobile`).
- En tête, de gauche à droite :
  - le bouton ☰ (`Burger`), affiché seulement sous `sm` ;
  - le logo, suivi de « Admin » ;
  - un espace, puis le bouton de thème ;
  - puis, **seulement si** `useSession().status === 'authenticated'`, l'email de l'admin (masqué sous `sm`) et le bouton « Se déconnecter ».
- Pendant `restoring` et `anonymous`, l'en tête n'affiche rien qui concerne la session.
- Bouton de thème : `ActionIcon` avec une icône soleil ou lune, et un `aria-label` « Passer en mode clair » ou « Passer en mode sombre ».
- Logo : `public/noli-logo.png`, affiché en 28 × 28 px avec `width` et `height` fixés, `alt=""` (il est décoratif, puisque « Admin » le suit). Le favicon devient `public/favicon.png` (le même logo réduit à 64 × 64 px), et `public/favicon.svg` est retiré.
- « Se déconnecter » appelle `logout()` (spec 0002), sans navigation ici : la redirection vers la connexion appartient à la garde de routes de la fonctionnalité 5. Son nom accessible reste « Se déconnecter » quand l'email est masqué.
- Menu latéral :
  - liens `NavLink` de Mantine rendus avec le `NavLink` de React Router (`component`), qui pose `aria-current="page"` ; `end` est réglé pour `/` seulement, si bien que Séries reste active sur `/series/123` ;
  - liste de configuration `navItems` (libellé, chemin, icône, `ready`) ; une entrée avec `ready: false` est masquée ;
  - au départ : Vue d'ensemble `/` (`IconLayoutDashboard`, `ready: true`), Séries `/series` (`IconMovie`, `ready: false`), Catégories `/categories` (`IconCategory`, `ready: false`), Outils `/outils` (`IconTool`, `ready: false`). Chaque fonctionnalité passe sa propre entrée à `ready: true` quand son écran existe.
- Menu sur téléphone :
  - le `Burger` porte `aria-controls` vers l'`id` du menu ;
  - le menu se ferme au choix d'une entrée et avec Échap, en rendant le focus au `Burger` ;
  - fermé, ses liens ne sont pas atteignables par Tab (masqués, pas seulement déplacés) ;
  - pas de piège à focus : c'est un panneau, pas une boîte de dialogue.
- Lien d'évitement « Aller au contenu », visible au focus, vers `<main id="contenu" tabIndex={-1}>`.
- `AppLayout` est une route de mise en page (React Router, `Outlet`). La protection des routes reste à la fonctionnalité 5.
- Routes enfants au départ :
  - `/` : `HomePage` réécrite avec `PageHeader` (« Vue d'ensemble »), avec un texte provisoire jusqu'à la fonctionnalité 11 ;
  - `*` : `NotFoundPage` (« Page introuvable » et un lien vers `/`) ;
  - en développement seulement, `/dev/composants`.
- `document.title` vaut `"<titre de la page> · Noli Admin"`. Il est posé par un hook `usePageTitle(title)`, appelé par `PageHeader`.

### Composants communs (`src/shared/ui/`)

| Composant | Rôle et interface | AC |
|---|---|---|
| `theme.ts` | Thème Mantine (couleurs, `colors.dark`, `cssVariablesResolver`, polices, rayon, tailles, `autoContrast`, `black`) | AC-1, AC-3, AC-4 |
| `ColorSchemeToggle` | Bouton clair ou sombre (`useMantineColorScheme`, `useComputedColorScheme`) | AC-2 |
| `AppLayout`, `navItems.ts` | Mise en page décrite plus haut | AC-5, AC-6, AC-7 |
| `PageHeader` | `title`, `description?`, `actions?` ; un seul `h1`, appelle `usePageTitle` | AC-7, AC-12 |
| `NotFoundPage` | Page 404 sous la mise en page | AC-15 |
| `DataTable<T>` | Voir la section « DataTable » | AC-8 |
| `EmptyState` | `icon?`, `title`, `description?`, `action?` | AC-8 |
| `TableSkeleton` | `columns`, `rows` (défaut 5) : lignes de `Skeleton` Mantine | AC-8 |
| `ErrorState` | Déjà livré (spec 0002), réutilisé tel quel | AC-8 |
| `confirmDanger(options)` | Voir la section « confirmDanger » | AC-9 |
| `notifySuccess(message)` | `notifications.show({ color: 'green', icon: <IconCheck />, message, autoClose: 4000 })` ; le texte garde la couleur de texte normale (seuls le liseré et l'icône sont verts) ; les notifications Mantine sont déjà des zones annoncées | AC-10 |
| `format.ts` | Voir la section « Formatage » | AC-11 |

La vitrine n'est **pas** dans `src/shared/` : elle vit dans `src/app/dev/DevComponentsPage.tsx`.

Règle : un écran n'importe que Mantine et ces composants ; une couleur, une police ou une taille en dur dans un écran est un défaut de revue.

### DataTable

- **Interface** :
  - `caption` : légende du tableau, masquée visuellement (`VisuallyHidden`), lue par les lecteurs d'écran ;
  - `columns: readonly { key, header, render(row), width? }[]`, où `width` suit la propriété CSS (`'30%'`, `120`) ;
  - `rows: readonly T[] | undefined`, avec `getRowKey(row)` ;
  - `total`, `page`, `pageSize`, `onPageChange(page)`, `isLoading`, `error`, `onRetry`, `empty: { title, description?, action? }`.
- **Ordre de priorité** de l'affichage :
  1. `error` présent : `ErrorState` avec « Réessayer » (`onRetry`) ;
  2. sinon, `isLoading` sans `rows` : `TableSkeleton` à la forme des colonnes ;
  3. sinon, `rows` vide (ou `total` à 0) : `EmptyState`, sans pagination ;
  4. sinon, les lignes. Si `isLoading` arrive avec des `rows` déjà présentes (rechargement, changement de page), les lignes restent, grisées (`opacity`, `aria-busy="true"` sur le tableau).
- **Pagination** :
  - `Pagination` de Mantine sous le tableau, masquée s'il n'y a qu'une page ;
  - libellés français : `aria-label` « Pagination », boutons « Page précédente » et « Page suivante », « Aller à la page N » ;
  - un résumé « 1 à 20 sur 134 » à gauche ;
  - la taille de page est fixée par l'écran appelant, sans sélecteur ;
  - si `page` dépasse le nombre de pages (après une suppression), `DataTable` appelle `onPageChange(dernière page)`.
- **Ligne cliquable** : pas d'`onRowClick` sur `tr` (une ligne n'est pas focalisable). L'écran rend un vrai lien (`Anchor` avec le `Link` de React Router) dans la cellule voulue, en général le titre.
- **Petit écran** : `Table.ScrollContainer` (défilement horizontal, `minWidth` 640 px). Pas d'en tête collant.

### confirmDanger

- Signature : `confirmDanger({ title, message, confirmLabel = 'Supprimer' }): Promise<boolean>`.
- Construit sur `modals.openConfirmModal`, dans une promesse résolue **une seule fois** (un drapeau ignore le second appel) :
  - `onConfirm` résout `true` ;
  - `onCancel` et `onClose` résolvent `false`, ce qui couvre Annuler, Échap et le clic à l'extérieur.
- `labels: { confirm: confirmLabel, cancel: 'Annuler' }` ;
- `confirmProps: { color: 'noliRed' }`, en nuance 8 avec un texte blanc ;
- `cancelProps: { 'data-autofocus': true }` ;
- `closeOnClickOutside: true` ;
- `centered: true`.
- Le focus revient au déclencheur grâce à `returnFocus` du piège à focus de Mantine (actif par défaut).
- L'écran appelant fait la suppression après `true`, puis appelle `notifySuccess` ou `notifyError` (spec 0002).

### Formatage (`format.ts`)

Fonctions pures, langue `fr-FR`, fuseau du navigateur. Valeur absente (`undefined`, `null`, chaîne vide, date invalide, nombre négatif ou non fini) → « — ».

| Fonction | Entrée | Sortie |
|---|---|---|
| `formatDate` | `'2026-10-13T14:05:00.000Z'` | « 13 oct. 2026 » (`Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })`) |
| `formatDateTime` | même entrée | « 13 oct. 2026, 14:05 » en heure locale (`hour: '2-digit', minute: '2-digit'`, sortie de `Intl`) |
| `formatDuration` | secondes : `0` à `59` | « moins d'1 min » (sauf `0` → « — ») |
| `formatDuration` | `1500` | « 25 min » |
| `formatDuration` | `3600` | « 1 h 00 » |
| `formatDuration` | `3900` | « 1 h 05 » |
| `formatDuration` | `7260` | « 2 h 01 » |

`formatDuration` est écrit à la main (pas `Intl`) : minutes arrondies à l'inférieur, minutes sur deux chiffres après « h ».

### Vitrine (`/dev/composants`)

- La route est ajoutée par décomposition : `...(import.meta.env.DEV ? [{ path: 'dev/composants', lazy: () => import('@/app/dev/DevComponentsPage') }] : [])`. Vite remplace `import.meta.env.DEV` par `false` au build, ce qui retire la branche et le morceau de code chargé à la demande.
- Elle montre chaque composant dans ses états, en clair et en sombre (via le bouton de thème).
- Vérification : après `npm run build`, aucun fichier de `dist/` ne contient la chaîne `DevComponentsPage` ni le titre de la vitrine. Les tests tournent avec `DEV` à `true`.

### Data model sketch

Pas de données serveur. État local au navigateur :

| Élément | Où | Forme |
|---|---|---|
| Mode de couleurs choisi | `localStorage['noli-admin-color-scheme']` (géré par Mantine, lu par `public/color-scheme.js`) | `'light' \| 'dark' \| 'auto'` |
| Menu ouvert sur petit écran | état React de `AppLayout` (`useDisclosure`) | `boolean` |
| Liste du menu | constante `navItems` dans `src/shared/ui/navItems.ts` | `readonly { label, to, icon, ready }[]` |

### API surface

Aucun appel au backend. Interface exposée aux fonctionnalités : les composants ci dessus, plus `AppLayout` monté dans `src/app/routes.tsx` comme route parente.

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| Thème | couleurs de marque | `NColors` de `../noli_app/lib/core/theme/app_theme.dart` |
| Thème | nuances des palettes | règle de mélange au blanc et au noir de la section « Couleurs » |
| Thème | couleurs du mode clair et bordures de champ | table « Rôles par mode » |
| Thème | polices | fichiers de `../noli_app/assets/google_fonts/`, convertis en woff2 |
| Mode au premier chargement | clair ou sombre | `localStorage['noli-admin-color-scheme']`, sinon `prefers-color-scheme` (`public/color-scheme.js` puis Mantine) |
| En tête | email de l'admin | `useSession().user.email` (spec 0002), seulement si `status === 'authenticated'` |
| En tête | déconnexion | `logout()` (spec 0002) |
| Menu | entrées visibles et ordre | `navItems` (`ready: true` seulement) |
| Menu | entrée active | `NavLink` de React Router (`end` pour `/`) |
| Titre de l'onglet | texte | `title` de `PageHeader` + « · Noli Admin » |
| `DataTable` | lignes, total, page, taille de page | props de l'écran appelant (lues dans la réponse paginée de l'API : `total`, `page`, `limit`) |
| `DataTable` | résumé « 1 à 20 sur 134 » | calculé depuis `page`, `pageSize`, `total` |
| `confirmDanger` | nom de l'élément et conséquences | `title` et `message` fournis par l'écran appelant |
| `formatDate`, `formatDateTime` | date affichée | chaîne ISO de l'API, fuseau du navigateur |
| `formatDuration` | durée affichée | `duration` de l'API, **en secondes** (référence API, section 2) |
| Logo et favicon | images | `../noli_app/assets/images/noli_logo.png`, copié et réduit |

### Key invariants

- Aucun écran ne fixe de couleur, police ou taille en dur : tout passe par le thème.
- L'ambre `#F5A623` n'est jamais une couleur de texte sur fond clair.
- Aucun texte blanc sur `noliRed` 6.
- Une seule balise `h1` par page, portée par `PageHeader`.
- Le code de la vitrine n'est jamais présent dans le build de production.
- Aucune ressource (police, image, script) n'est chargée depuis un autre domaine, et aucun script en ligne n'est ajouté.

### Security model

Pas de donnée sensible. Le mode de couleurs en `localStorage` n'est pas une donnée personnelle. L'email de l'admin vient de la session (spec 0002) et n'est affiché que dans l'en tête. La CSP de la spec 0001 reste inchangée (`script-src 'self'`, `font-src 'self'`, `img-src 'self'`).

### Configuration required

- Nouvelles dépendances : `@mantine/modals` (même version que `@mantine/core`, `^9.7.1`) et `@tabler/icons-react` (prévue par la spec 0001).
- Conversion des polices en woff2 : faite une fois, avec un outil lancé à la demande (par exemple `npx ttf2woff2`), sans dépendance ajoutée au projet.
- Aucune variable d'environnement.

### Critical test scenarios

- Thème : en mode sombre, le fond de page vaut `#0B0C10` ; un bouton principal ambre a un texte `#0B0C10` ; le bouton danger utilise `noliRed` 8, vérifie **AC-1**, **AC-4**.
- Bascule : un clic sur le bouton de thème change le mode et écrit `localStorage['noli-admin-color-scheme']` ; `public/color-scheme.js` applique `data-mantine-color-scheme` selon la valeur enregistrée, ou selon `matchMedia` pour `auto`, vérifie **AC-2**.
- En tête : pendant `restoring` ou `anonymous`, ni email ni « Se déconnecter » ; une fois `authenticated`, l'email et le bouton s'affichent, et un clic appelle `logout()`, vérifie **AC-5**.
- Menu : seules les entrées `ready` apparaissent, dans l'ordre ; `aria-current="page"` est sur « Vue d'ensemble » à `/` et sur « Séries » à `/series/123` ; sous 768 px, ☰ ouvre le menu, et Échap le ferme en rendant le focus à ☰, vérifie **AC-5**, **AC-6**.
- Clavier : le premier Tab atteint « Aller au contenu », qui met le focus sur `main` ; `document.title` suit la page, vérifie **AC-7**.
- `DataTable` : erreur avant tout, squelettes au premier chargement, `EmptyState` à 0, lignes grisées au rechargement, résumé « 1 à 20 sur 134 », « Page suivante » donne `onPageChange(2)`, page au delà de la fin ramenée à la dernière, vérifie **AC-8**.
- `confirmDanger` : Annuler a le focus ; Échap, un clic extérieur et Annuler renvoient `false` ; Supprimer renvoie `true` ; un seul résultat même si la fermeture suit la confirmation ; le focus revient au déclencheur, vérifie **AC-9**.
- `notifySuccess` : icône de coche, message français, fermeture à 4 s, vérifie **AC-10**.
- Formatage : chaque ligne de la table « Formatage », plus `undefined`, `null`, une valeur négative et une date invalide donnent « — », vérifie **AC-11**.
- 404 : `/inconnu` affiche « Page introuvable » et un lien vers `/`, vérifie **AC-15**.
- Production : après le build, `dist/` ne contient pas `DevComponentsPage`, vérifie **AC-13**.

## Build plan

Ordonné en Tracer Bullet : d'abord un fil mince visible de bout en bout (thème, polices, mode sans clignotement, mise en page avec le vrai en tête et la vraie session, vitrine), puis on épaissit avec les composants.

1. Installer `@mantine/modals` et `@tabler/icons-react` ; convertir et copier les polices (avec licences), copier le logo et produire le favicon PNG ; `fonts.css`, préchargement dans `index.html`, satisfies **AC-3**
2. `theme.ts` : palettes par la règle de mélange, `colors.dark`, `cssVariablesResolver`, polices, réglages ; `ThemeProviders` avec le gestionnaire de mode, `ModalsProvider` et `Notifications` en bas à droite, satisfies **AC-1**, **AC-3**, **AC-4**
3. `public/color-scheme.js` chargé dans `index.html`, puis `ColorSchemeToggle`, satisfies **AC-2**
4. `navItems`, `AppLayout` (en tête avec session et déconnexion, menu et ☰, lien d'évitement, `main#contenu`), `PageHeader` et `usePageTitle`, `HomePage` réécrite, `NotFoundPage`, montés dans `routes.tsx`, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-12**, **AC-15**
5. Vitrine `/dev/composants` (chargement différé, développement seulement), avec les composants déjà prêts, satisfies **AC-13**
6. `EmptyState`, `TableSkeleton`, `DataTable` ajoutés à la vitrine, satisfies **AC-8**
7. `confirmDanger`, `notifySuccess` ajoutés à la vitrine, satisfies **AC-9**, **AC-10**
8. `format.ts`, satisfies **AC-11**
9. Mesure des contrastes dans les deux modes (bouton plein, texte ambre, texte d'erreur, bordure de champ, texte secondaire, focus), ajustement des nuances si besoin, satisfies **AC-4**
10. `design.md` à la racine (palettes en hexadécimal, contrastes mesurés, typographie, espacements, densité, mise en page, composants), satisfies **AC-14**

## Consequences

**Positive**:
- Le dashboard ressemble à Noli dès le premier écran, en clair comme en sombre.
- Chaque fonctionnalité construit ses écrans avec les mêmes briques : moins de code, aspect cohérent, accessibilité acquise une fois.
- La vitrine permet de vérifier les composants avant les vrais écrans.
- La CSP stricte de la spec 0001 reste intacte.

**Negative / tradeoffs**:
- Deux modes de couleurs à garder lisibles : chaque nouvelle couleur doit être vérifiée dans les deux.
- Les polices locales ajoutent du poids au premier chargement (réduit par le woff2 et mis en cache ensuite).
- `DataTable` maison couvre la pagination serveur mais pas le tri ni la sélection multiple ; il faudra l'étendre si un écran en a besoin.
- Les couleurs du mode clair ne viennent pas de la charte de l'app : elles deviennent la référence du dashboard via `design.md`.
- `public/color-scheme.js` double une petite partie de la logique de Mantine ; il faut garder la même clé des deux côtés.

**Neutral**:
- `@mantine/modals` rejoint les paquets Mantine ; `@tabler/icons-react` était déjà prévu par la spec 0001.
- La fonctionnalité 5 branche sa garde de routes autour d'`AppLayout` et passe ses entrées de menu à `ready: true`.

## Follow-up

- [ ] Fonctionnalité 5 : protéger les routes enfants d'`AppLayout`, rediriger après `logout()` et passer « Séries » à `ready: true`.
- [ ] Si l'app mobile change sa charte (`NColors`), reporter le changement dans `theme.ts` et `design.md`.
- [ ] `/sync` : ajouter à `AGENTS.md` la règle « pas de couleur, police ou taille en dur dans un écran » et le lien vers `design.md`.
