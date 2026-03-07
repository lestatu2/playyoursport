import { useMemo, useState } from 'react'
import PublicSiteHeader from '../components/PublicSiteHeader'
import { clearPublicSession, type PublicSession } from '../lib/auth'
import { getCurrentPublicPackageEditions } from '../lib/public-content'
import { Link } from 'react-router-dom'
import { getSubscriptionCtaLabel, resolvePublicPackageImage } from '../lib/public-content'
import PublicEnrollmentModal from '../components/PublicEnrollmentModal'
import type { SportPackage } from '../lib/package-catalog'

type PublicPackagesPageProps = {
  session: PublicSession | null
  onLogin: (session: PublicSession) => void
  onLogout: () => void
}

function PublicPackagesPage({ session, onLogin: _onLogin, onLogout }: PublicPackagesPageProps) {
  const packages = getCurrentPublicPackageEditions()
  const [guestYouthPackageId, setGuestYouthPackageId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const guestYouthPackage = useMemo(
    () => packages.find((item) => item.id === guestYouthPackageId) ?? null,
    [guestYouthPackageId, packages],
  )

  const openProductAction = (item: SportPackage) => {
    setGuestYouthPackageId(item.id)
    setError('')
  }

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
          <h1 className="text-3xl font-semibold">Pacchetti</h1>
          <p className="text-sm opacity-70">Archivio delle edizioni correnti attive.</p>
          {error ? <p className="mt-3 rounded-lg bg-error/15 px-3 py-2 text-sm text-error">{error}</p> : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((item) => (
            <article
              key={item.id}
              className="relative overflow-hidden rounded-lg border border-base-300 shadow-sm"
              style={{
                backgroundImage: `linear-gradient(to bottom, rgba(10,15,20,.72), rgba(10,15,20,.58)), url(${resolvePublicPackageImage(item)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="space-y-2 p-4 text-white">
                <p className="text-xs uppercase tracking-wide opacity-90">{item.audience === 'youth' ? 'Ragazzi' : 'Adulti'}</p>
                <h2 className="mt-1 text-lg font-semibold">{item.name}</h2>
                <p className="text-sm opacity-90">Edizione {item.editionYear}</p>
                <p className="mt-2 text-sm line-clamp-3">{item.disclaimer || item.description}</p>
                <p className="mt-3 text-sm font-medium">Prezzo: {item.priceAmount}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/pacchetti/${item.id}`} className="btn btn-outline btn-sm">
                    Vai al dettaglio
                  </Link>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => openProductAction(item)}>
                    {getSubscriptionCtaLabel(item)}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <PublicEnrollmentModal
        packageItem={guestYouthPackage}
        isOpen={Boolean(guestYouthPackage)}
        session={session}
        onClose={() => setGuestYouthPackageId(null)}
      />
    </main>
  )
}

export default PublicPackagesPage
