/**
 * Entrées du menu latéral (spec 0003, AC-6), dans l'ordre d'affichage.
 * Une fonctionnalité passe son entrée à `ready: true` quand son écran existe.
 */
import {
  IconCategory,
  IconLayoutDashboard,
  IconMovie,
  IconTool,
  type IconProps,
} from '@tabler/icons-react'
import type { ComponentType } from 'react'

export interface NavItem {
  readonly label: string
  readonly to: string
  readonly icon: ComponentType<IconProps>
  readonly ready: boolean
}

export const navItems: readonly NavItem[] = [
  { label: "Vue d'ensemble", to: '/', icon: IconLayoutDashboard, ready: true },
  { label: 'Séries', to: '/series', icon: IconMovie, ready: true },
  { label: 'Catégories', to: '/categories', icon: IconCategory, ready: false },
  { label: 'Outils', to: '/outils', icon: IconTool, ready: false },
]

export function visibleNavItems(items: readonly NavItem[] = navItems): readonly NavItem[] {
  return items.filter((item) => item.ready)
}
