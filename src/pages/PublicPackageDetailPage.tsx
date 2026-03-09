import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PublicSiteHeader from '../components/PublicSiteHeader'
import { clearPublicSession, type PublicSession } from '../lib/auth'
import { getPackages } from '../lib/package-catalog'
import { getSubscriptionCtaLabel, resolvePublicPackageImage } from '../lib/public-content'
import PublicEnrollmentModal from '../components/PublicEnrollmentModal'

type PublicPackageDetailPageProps = {
  session: PublicSession | null
  onLogin: (session: PublicSession) => void
  onLogout: () => void
}

function PublicPackageDetailPage({ session, onLogin: _onLogin, onLogout }: PublicPackageDetailPageProps) {
  const { packageId } = useParams<{ packageId: string }>()
  const item = getPackages().find((pkg) => pkg.id === packageId)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [error, setError] = useState('')

  const openProductAction = () => {
    if (item) {
      setIsWizardOpen(true)
      setError('')
    }
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
      <section className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        {!item ? (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h1 className="text-2xl font-semibold">Pacchetto non trovato</h1>
              <Link to="/pacchetti" className="btn btn-primary btn-sm mt-2 w-fit">
                Torna ai pacchetti
              </Link>
            </div>
          </div>
        ) : (
          <>
            <article className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
              <img src={resolvePublicPackageImage(item)} alt={item.name} className="h-64 w-full object-cover" />
              <div className="space-y-3 p-5">
                <p className="text-xs uppercase tracking-wide opacity-70">
                  {item.audience === 'youth' ? 'Ragazzi' : 'Adulti'} - Edizione {item.editionYear}
                </p>
                <h1 className="text-3xl font-bold">{item.name}</h1>
                <p className="text-sm opacity-80">{item.disclaimer || item.description}</p>
                <p className="text-lg font-semibold">Prezzo: {item.priceAmount}</p>
                {error ? <p className="rounded-lg bg-error/15 px-3 py-2 text-sm text-error">{error}</p> : null}
                <button type="button" className="btn btn-primary btn-sm mt-2" onClick={openProductAction}>
                  {getSubscriptionCtaLabel(item)}
                </button>
              </div>
            </article>
            <Link to="/pacchetti" className="btn btn-outline btn-sm">
              Torna all'archivio
            </Link>
          </>
        )}
      </section>
      <PublicEnrollmentModal
        packageItem={item ?? null}
        isOpen={isWizardOpen}
        session={session}
        onClose={() => setIsWizardOpen(false)}
      />
    </main>
  )
}

export default PublicPackageDetailPage
