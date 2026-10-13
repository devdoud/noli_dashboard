---
name: noli-admin-design-system
source: noli_app (lib/core/theme/app_theme.dart, assets/google_fonts, assets/images/noli_logo.png)
character: "L'univers de Noli, une plateforme de séries : un fond presque noir de salle de cinéma, un ambre safran chaud qui signale l'action, un indigo royal en appui. Le dashboard garde cette chaleur en sombre et la traduit en clair pour les longues séances de saisie, avec des titres francs en Bricolage Grotesque et un texte net en Plus Jakarta Sans."
tokens: "les valeurs vivent dans src/shared/ui/theme.ts (thème Mantine et variables par mode) et src/shared/ui/global.css (polices, focus, bordures de champ) ; ce fichier les explique"
contrast: "mesuré dans le navigateur sur la vitrine, en clair et en sombre : tout texte ≥ 4,5:1, toute bordure de champ ≥ 3:1 (détail plus bas)"
spec: "docs/specs/0003-design-system-ui-foundation/index.md"
---

# Design system du dashboard Noli

## Build mandate

Chaque écran sort comme une surface produit complète et professionnelle, jamais un formulaire seul sur une page vide. Il porte :
- la marque (le texte « Noli » dans l'en tête) ;
- un vrai titre et une description en français, écrits pour l'admin ;
- une mise en page hiérarchisée ;
- tous ses états : chargement, vide, erreur ;
- des actions claires.

Un écran n'utilise que Mantine et les composants de `src/shared/ui/`. Une couleur, une police ou une taille écrite en dur dans un écran est un défaut de revue.

## Character & direction

- **Sombre, fidèle à l'app :**
  - fond de page `#0B0C10` ;
  - surfaces `#13141B` et `#1C1D26` ;
  - séparateurs blancs à 8 %.
- **Clair, pour travailler longtemps :**
  - fond `#F7F7F9` et surfaces blanches ;
  - les mêmes accents, assombris quand ils deviennent du texte.
- **Ambre safran `#F5A623` :**
  - c'est la couleur de l'action (bouton principal, lien, entrée de menu active, focus) ;
  - en mode clair, jamais en texte : on utilise l'ambre 9 `#875B13` ;
  - jamais en simple décoration.
- **Indigo royal `#6C5CE7` :** couleur d'appui, rare (une action secondaire mise en avant, un badge d'information).
- **Rouge `#FF4D6D` :**
  - réservé aux erreurs et aux suppressions ;
  - le bouton danger utilise le rouge 8 `#B3364C` avec un texte blanc.
- **Marque dans l'en tête :** le seul texte « Noli », en Bricolage Grotesque, sans image de logo.

## Couleurs

**Palettes Mantine** (`theme.ts`) :
- la source est en nuance 6 ;
- les nuances 0 à 5 la mélangent au blanc (90 %, 75 %, 60 %, 45 %, 30 %, 15 %) ;
- les nuances 7 à 9 la mélangent au noir (15 %, 30 %, 45 %).

| Palette | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| `noliAmber` | `#FEF6E9` | `#FDE9C8` | `#FBDBA7` | `#FACE86` | `#F8C165` | `#F7B344` | `#F5A623` | `#D08D1E` | `#AC7419` | `#875B13` |
| `noliIndigo` | `#F0EFFD` | `#DAD6F9` | `#C4BEF5` | `#AEA5F2` | `#988DEE` | `#8274EB` | `#6C5CE7` | `#5C4EC4` | `#4C40A2` | `#3B337F` |
| `noliRed` | `#FFEDF0` | `#FFD3DB` | `#FFB8C5` | `#FF9DAF` | `#FF8299` | `#FF6883` | `#FF4D6D` | `#D9415D` | `#B3364C` | `#8C2A3C` |
| `noliOrange` | `#FFF4E6` | `#FFE5BF` | `#FFD599` | `#FFC573` | `#FFB54D` | `#FFA526` | `#FF9500` | `#D97F00` | `#B36800` | `#8C5200` |
| `dark` (remplacée) | `#F8F9FA` | `#C9CAD6` | `#A0A3BD` | `#7E8197` | `#6B6E85` | `#2B2C37` | `#1C1D26` | `#13141B` | `#0F1015` | `#0B0C10` |

**Rôles par mode** (variables posées par `cssVariablesResolver`) :

| Rôle | Sombre | Clair |
|---|---|---|
| Fond de page | `#0B0C10` | `#F7F7F9` |
| Surface | `#13141B` | `#FFFFFF` |
| Texte principal | `#F8F9FA` | `#13141B` |
| Texte secondaire (`dimmed`) | `#A0A3BD` | `#5B5E73` |
| Séparateur décoratif (`default-border`) | blanc 8 % | `#E4E5EB` |
| Bordure de champ (`--noli-color-field-border`) | `#6B6E85` | `#8A8D9F` |
| Lien, entrée active, focus | ambre 6 | ambre 9 |
| Texte d'erreur | rouge 6 | rouge 8 (rouge 9 sur fond rose d'alerte) |
| Succès | vert de Mantine (liseré et icône seulement) | idem |

## Contrastes mesurés (AC-4)

Mesurés le 2026-10-13 dans Chromium, sur `/dev/composants` (puis `/` pour le menu), avec les fonds semi transparents composés. Les textes de contenu reposent sur la surface (`#13141B` en sombre, blanc en clair), pas sur le fond de page.

| Élément | Clair | Sombre |
|---|---|---|
| Titre `h1` | 17,16:1 | 18,54:1 |
| Texte secondaire | 5,96:1 | 7,88:1 |
| Bouton principal (texte `#0B0C10` sur ambre) | 9,64:1 | 9,64:1 |
| Bouton léger | 5,00:1 | 11,93:1 |
| Bouton secondaire | 19,55:1 | 16,76:1 |
| Bouton indigo (texte blanc) | 4,86:1 | 4,86:1 |
| Bouton danger (texte blanc sur rouge 8) | 5,92:1 | 5,92:1 |
| Lien, lien de tableau | 5,94:1 | 9,06:1 |
| Badge Premium | 5,00:1 | 11,93:1 |
| Résumé de pagination | 6,38:1 | 7,41:1 |
| Titre de l'alerte d'erreur, bouton Réessayer | 6,21:1 | 13,43:1 |
| Message de l'alerte | 14,51:1 | 15,15:1 |
| Message d'erreur sous un champ | 5,92:1 | 5,71:1 |
| Entrée de menu active | 5,00:1 | 11,93:1 |
| Libellé de champ | 18,36:1 | 17,42:1 |
| Bordure de champ (min 3:1) | 3,29:1 | 3,67:1 |

Toute nouvelle couleur doit être mesurée dans les deux modes avant d'être utilisée. Les accents les plus fragiles sont la bordure de champ en clair (3,29:1) et le texte blanc sur indigo (4,86:1) : ne pas les éclaircir.

## Typographie

- **Titres** (`h1` à `h4`, « Noli » dans l'en tête) : Bricolage Grotesque, graisses 700 et 800.
- **Texte, tableaux, formulaires :** Plus Jakarta Sans, graisses 400, 500, 600 et 700.
- **Fichiers :** woff2 dans `public/fonts/`, avec leurs licences OFL. Les deux fichiers principaux sont préchargés dans `index.html`, avec `font-display: swap` et `system-ui` en secours.
- **Tailles :**
  - taille de base 14 px, en densité compacte ;
  - le `h1` de page s'affiche à la taille `h2` de Mantine, et un titre de section en `h4`.

## Espacements, densité, formes

- **Espacements :** l'échelle de Mantine (`xs` à `xl`), jamais de valeur en pixels dans un écran.
- **Tailles des composants :** compactes, avec les tableaux en `verticalSpacing="xs"` et les boutons et champs en `sm`.
- **Rayon :** `md` (8 px) par défaut, `xl` pour les pastilles d'icône.
- **Relief :** des bordures fines, pas d'ombres. Les cartes sont des `Paper withBorder`.
- **Mouvement :** les transitions par défaut de Mantine, coupées quand le système demande moins d'animations (`prefers-reduced-motion`).

## Composition patterns

- **Mise en page (`AppLayout`) :**
  - un en tête de 56 px, avec ☰ (sur téléphone), le texte « Noli », le bouton de thème, et quand la session est ouverte l'email de l'admin et « Se déconnecter » ;
  - un menu latéral de 240 px, replié derrière ☰ sous 768 px ;
  - un contenu principal `main#contenu`.
- **Une page :**
  1. `PageHeader` : le titre (seul `h1`), la description, et les actions à droite ;
  2. des sections en `Paper withBorder`, chacune avec un titre `h2` ;
  3. le contenu.
- **Liste :** `PageHeader` avec l'action « Nouveau… », puis `DataTable` dans un `Paper`. Le titre de chaque ligne est un lien vers la fiche.
- **Fiche (détail) :** `PageHeader` avec les actions (modifier, supprimer), puis des sections groupées.
- **Menu :** `navItems.ts`, avec les entrées Vue d'ensemble, Séries, Catégories et Outils. Une entrée n'apparaît qu'avec `ready: true`.

## Component & usage rules

| Composant | Usage |
|---|---|
| `PageHeader` | Toujours en haut de page. Il pose le titre de l'onglet. |
| `DataTable` | Toute liste paginée par le serveur. Ordre des états : erreur, squelettes, vide, lignes (grisées pendant un rechargement). La taille de page est fixée par l'écran. |
| `EmptyState` | Une liste vide ou une absence de contenu : un titre, une phrase utile et une action. |
| `TableSkeleton` | Le premier chargement d'un tableau (utilisé par `DataTable`). |
| `ErrorState` | Une erreur de chargement dans la page, avec « Réessayer ». |
| `confirmDanger` | Avant toute suppression. Il nomme l'élément et ses conséquences ; Annuler a le focus. |
| `notifySuccess` / `notifyError` | Le retour d'une action. Les notifications apparaissent en bas à droite. |
| `formatDate`, `formatDateTime`, `formatDuration` | Toute date ou durée affichée. `duration` est en secondes. |
| `ColorSchemeToggle` | Uniquement dans l'en tête. |

- **À faire :**
  - un seul bouton principal (ambre plein) par zone ;
  - les autres boutons en `light` ou `default` ;
  - le rouge réservé au danger.
- **À ne pas faire :**
  - de l'ambre en texte sur fond clair ;
  - un texte blanc sur rouge 6 ;
  - un `tr` cliquable (mettre un vrai lien dans une cellule) ;
  - un `h1` hors de `PageHeader`.

## Responsive & accessibility direction

- **Petit écran :**
  - sous 768 px, le menu se replie : ☰ porte `aria-expanded` et `aria-controls`, Échap le ferme et rend le focus ;
  - fermé, le menu est `inert` ;
  - l'email de l'en tête est masqué, et « Se déconnecter » devient une icône qui garde son nom accessible.
- **Tableaux :** ils défilent horizontalement (largeur minimale 640 px) sans casser la page.
- **Clavier :**
  - le premier Tab atteint « Aller au contenu » ;
  - le focus est toujours visible (anneau ambre, ambre 9 en clair).
- **Icônes :** décoratives par défaut (`aria-hidden`). Un bouton qui n'a qu'une icône porte un `aria-label` en français.
- **Vitrine :** `/dev/composants`, en développement seulement, montre chaque composant dans ses états. Elle sert de référence visuelle et de banc de vérification.
