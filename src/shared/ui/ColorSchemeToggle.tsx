/** Bouton clair ou sombre de l'en tête ; le choix est retenu par Mantine dans localStorage (spec 0003, AC-2). */
import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { IconMoon, IconSun } from '@tabler/icons-react'

export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme()
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const next = computed === 'dark' ? 'light' : 'dark'

  return (
    <ActionIcon
      variant="default"
      size="lg"
      aria-label={next === 'light' ? 'Passer en mode clair' : 'Passer en mode sombre'}
      onClick={() => {
        setColorScheme(next)
      }}
    >
      {computed === 'dark' ? (
        <IconSun size={18} aria-hidden="true" />
      ) : (
        <IconMoon size={18} aria-hidden="true" />
      )}
    </ActionIcon>
  )
}
