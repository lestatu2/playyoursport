import { Link, useParams } from 'react-router-dom'
import PublicSiteHeader from '../components/PublicSiteHeader'
import { clearPublicSession, type PublicSession } from '../lib/auth'
import { getPackages } from '../lib/package-catalog'
import { getSubscriptionCtaLabel, resolvePublicPackageImage } from '../lib/public-content'

type PublicPackageDetailPageProps = {
  session: PublicSession | null
  onLogout: () => void
}

function PublicPackageDetailPage({ session, onLogout }: PublicPackageDetailPageProps) {
  const { packageId } = useParams<{ packageId: string }>()
  const item = getPackages().find((pkg) => pkg.id === packageId)

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
                <Link to="/" className="btn btn-primary btn-sm mt-2">
                  {getSubscriptionCtaLabel(item)}
                </Link>
              </div>
            </article>
            <Link to="/pacchetti" className="btn btn-outline btn-sm">
              Torna all'archivio
            </Link>
          </>
        )}
      </section>
    </main>
  )
}

export default PublicPackageDetailPage
