import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PublicSiteHeader from '../components/PublicSiteHeader'
import PublicOpenDayModal from '../components/PublicOpenDayModal'
import { clearPublicSession, type PublicSession } from '../lib/auth'
import {
  getCurrentPublicOpenDayEditions,
  getOpenDayCtaLabel,
  resolvePublicOpenDayImage,
  type PublicOpenDayEdition,
} from '../lib/public-content'
import { getOpenDayEditions, getOpenDayProducts } from '../lib/open-day-catalog'

type PublicOpenDaysPageProps = {
  session: PublicSession | null
  onLogin: (session: PublicSession) => void
  onLogout: () => void
}

function formatOpenDayWindow(item: PublicOpenDayEdition): string {
  if (item.durationType === 'single-event') {
    return item.eventDate || '-'
  }
  return `${item.periodStartDate || '-'} - ${item.periodEndDate || '-'}`
}

function PublicOpenDaysPage({ session, onLogin: _onLogin, onLogout }: PublicOpenDaysPageProps) {
  const openDays = getCurrentPublicOpenDayEditions()
  const [activeEditionId, setActiveEditionId] = useState<string | null>(null)

  const activeItem = useMemo(
    () => openDays.find((item) => item.editionId === activeEditionId) ?? null,
    [activeEditionId, openDays],
  )
  const activeProduct = useMemo(
    () => (activeItem ? getOpenDayProducts().find((item) => item.id === activeItem.id) ?? null : null),
    [activeItem],
  )
  const activeEdition = useMemo(
    () => (activeItem ? getOpenDayEditions().find((item) => item.id === activeItem.editionId) ?? null : null),
    [activeItem],
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
      <section className="mx-auto max-w-6xl space-y-4 px-4 py-8">
        <div>
          <h1 className="text-3xl font-semibold">Open Day</h1>
          <p className="text-sm opacity-70">Archivio delle edizioni open day pubblicate.</p>
        </div>

        {openDays.length === 0 ? (
          <div className="rounded-lg border border-base-300 bg-base-100 p-4 text-sm opacity-70">
            Nessun open day pubblicato al momento.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {openDays.map((item) => (
              <article
                key={item.editionId}
                className="relative overflow-hidden rounded-lg border border-base-300 shadow-sm"
                style={{
                  backgroundImage: `linear-gradient(to bottom, rgba(10,15,20,.72), rgba(10,15,20,.58)), url(${resolvePublicOpenDayImage(item)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="space-y-2 p-4 text-white">
                  <p className="text-xs uppercase tracking-wide opacity-90">{item.audience === 'youth' ? 'Minori' : 'Adulti'}</p>
                  <h2 className="text-lg font-semibold">{item.name}</h2>
                  <p className="text-sm opacity-90">Edizione {item.editionYear}</p>
                  <p className="text-sm opacity-90">{formatOpenDayWindow(item)}</p>
                  <p className="text-sm opacity-90">Età {item.ageMin}-{item.ageMax}</p>
                  <p className="line-clamp-3 text-sm">{item.disclaimer || item.description}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Link to={`/open-day/${item.editionId}`} className="btn btn-outline btn-sm">
                      Vai al dettaglio
                    </Link>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setActiveEditionId(item.editionId)}>
                      {getOpenDayCtaLabel()}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <PublicOpenDayModal
        product={activeProduct}
        edition={activeEdition}
        isOpen={Boolean(activeProduct && activeEdition)}
        session={session}
        onClose={() => setActiveEditionId(null)}
      />
    </main>
  )
}

export default PublicOpenDaysPage
