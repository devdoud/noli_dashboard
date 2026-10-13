import { Button, Paper } from '@mantine/core'
import { IconMapOff } from '@tabler/icons-react'
import { Link } from 'react-router'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PageHeader } from '@/shared/ui/PageHeader'

// Adresse inconnue sous la mise en page (spec 0003, AC-15).
export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page introuvable" />
      <Paper withBorder p="lg">
        <EmptyState
          icon={<IconMapOff size={24} />}
          title="Cette page n'existe pas"
          description="L'adresse est peut être mal saisie, ou la page a été déplacée."
          action={
            <Button component={Link} to="/">
              Retour à la vue d'ensemble
            </Button>
          }
        />
      </Paper>
    </>
  )
}
