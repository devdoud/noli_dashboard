/** Écran affiché quand la configuration est invalide ; l'API n'est jamais appelée (spec 0002, AC-2). */
import { Code, Container, List, Text, Title } from '@mantine/core'

interface ConfigErrorScreenProps {
  readonly variable: string
  readonly reason: string
}

export function ConfigErrorScreen({ variable, reason }: ConfigErrorScreenProps) {
  return (
    <Container size="sm" py="xl">
      <Title order={1}>Configuration invalide</Title>
      <Text mt="md">
        La variable <Code>{variable}</Code> est incorrecte. {reason}
      </Text>
      <List mt="md" size="sm">
        <List.Item>
          En local : copiez <Code>.env.example</Code> en <Code>.env.local</Code> et indiquez
          l&apos;adresse de l&apos;API.
        </List.Item>
        <List.Item>
          Sur Render : renseignez la variable dans les réglages du site, puis redéployez.
        </List.Item>
      </List>
    </Container>
  )
}
