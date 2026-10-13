import { Paper, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core'
import { IconCategory, IconMovie, IconPhoto } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { PageHeader } from '@/shared/ui/PageHeader'

// Vue d'ensemble provisoire : les vrais chiffres arrivent avec la fonctionnalité 11.

interface UpcomingCardProps {
  readonly icon: ReactNode
  readonly title: string
  readonly description: string
}

function UpcomingCard({ icon, title, description }: UpcomingCardProps) {
  return (
    <Paper withBorder p="md">
      <ThemeIcon variant="light" size="lg" mb="sm" aria-hidden="true">
        {icon}
      </ThemeIcon>
      <Title order={2} size="h5" mb={4}>
        {title}
      </Title>
      <Text size="sm" c="dimmed">
        {description}
      </Text>
    </Paper>
  )
}

export function HomePage() {
  return (
    <>
      <PageHeader
        title="Vue d'ensemble"
        description="Gérez le contenu de Noli : séries, épisodes, images et catégories."
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <UpcomingCard
          icon={<IconMovie size={20} />}
          title="Séries et épisodes"
          description="Créer une série, ajouter ses épisodes et régler l'accès premium."
        />
        <UpcomingCard
          icon={<IconPhoto size={20} />}
          title="Images"
          description="Envoyer les couvertures, bannières et vignettes d'épisode."
        />
        <UpcomingCard
          icon={<IconCategory size={20} />}
          title="Catégories"
          description="Organiser le catalogue : créer, masquer et réordonner les catégories."
        />
      </SimpleGrid>
    </>
  )
}
