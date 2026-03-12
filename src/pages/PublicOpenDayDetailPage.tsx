import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PublicSiteHeader from '../components/PublicSiteHeader'
import PublicOpenDayModal from '../components/PublicOpenDayModal'
import { clearPublicSession, type PublicSession } from '../lib/auth'
import { getOpenDayEditions, getOpenDayProducts } from '../lib/open-day-catalog'
import { getCurrentPublicOpenDayEditions, getOpenDayCtaLabel, resolvePublicOpenDayImage } from '../lib/public-content'

type PublicOpenDayDetailPageProps = {
  session: PublicSession | null
  onLogin: (session: PublicSession) => void
  onLogout: () => void
}

function PublicOpenDayDetailPage({ session, onLogin: _onLogin, onLogout }: PublicOpenDayDetailPageProps) {
  const { editionId } = useParams<{ editionId: string }>()
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  const publicItem = useMemo(
    () => getCurrentPublicOpenDayEditions().find((item) => item.editionId === editionId) ?? null,
    [editionId],
  )
  const product = useMemo(
    () => (publicItem ? getOpenDayProducts().find((item) => item.id === publicItem.id) ?? null : null),
    [publicItem],
  )
  const edition = useMemo(
    () => (publicItem ? getOpenDayEditions().find((item) => item.id === publicItem.editionId) ?? null : null),
    [publicItem],
  )

  return (
    <main className="min-h-screen bg-base-200">
      <PublicSiteHeader
        session={session}
        onLogout={() => {
          clearPublicSession()
          onLogout()
        }}
      />
      <section className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        {!publicItem || !product || !edition ? (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h1 className="text-2xl font-semibold">Open day non trovato</h1>
              <Link to="/open-day" className="btn btn-primary btn-sm mt-2 w-fit">
                Torna agli open day
              </Link>
            </div>
          </div>
        ) : (
          <>
            <article className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
              <img src={resolvePublicOpenDayImage(publicItem)} alt={publicItem.name} className="h-64 w-full object-cover" />
              <div className="space-y-3 p-5">
                <p className="text-xs uppercase tracking-wide opacity-70">
                  {publicItem.audience === 'youth' ? 'Minori' : 'Adulti'} - Edizione {publicItem.editionYear}
                </p>
                <h1 className="text-3xl font-bold">{publicItem.name}</h1>
                <p className="text-sm opacity-80">{publicItem.disclaimer || publicItem.description}</p>
                <p className="text-sm font-medium">
                  {publicItem.durationType === 'single-event'
                    ? `Data evento: ${publicItem.eventDate || '-'}`
                    : `Periodo: ${publicItem.periodStartDate || '-'} - ${publicItem.periodEndDate || '-'}`
                  }
                </p>
                <p className="text-sm font-medium">Età consentita: {publicItem.ageMin}-{publicItem.ageMax}</p>
                <button type="button" className="btn btn-primary btn-sm mt-2" onClick={() => setIsWizardOpen(true)}>
                  {getOpenDayCtaLabel()}
                </button>
              </div>
            </article>
            <Link to="/open-day" className="btn btn-outline btn-sm">
              Torna all'archivio
            </Link>
          </>
        )}
      </section>

      <PublicOpenDayModal
        product={product}
        edition={edition}
        isOpen={isWizardOpen && Boolean(product && edition)}
        session={session}
        onClose={() => setIsWizardOpen(false)}
      />
    </main>
  )
}

export default PublicOpenDayDetailPage
