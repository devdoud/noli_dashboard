/** Détail repliable d'une erreur : le texte d'origine du backend (spec 0002, AC-10). */
import { Code, Text } from '@mantine/core'

export function ErrorDetails({ details }: { readonly details: string }) {
  return (
    <details>
      <Text component="summary" size="xs" c="dimmed" style={{ cursor: 'pointer' }}>
        Détails
      </Text>
      <Code block mt={4}>
        {details}
      </Code>
    </details>
  )
}
