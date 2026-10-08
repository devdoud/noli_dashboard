import { Container, Text, Title } from '@mantine/core'

// Page provisoire du scaffold : remplacée par la connexion et la liste des séries (fonctionnalité 5).
export function HomePage() {
  return (
    <Container size="sm" py="xl">
      <Title order={1}>Noli Admin</Title>
      <Text c="dimmed" mt="sm">
        Le tableau de bord est prêt à être construit.
      </Text>
    </Container>
  )
}
