import PublicSiteHeader from '../components/PublicSiteHeader'
import { clearPublicSession, type PublicSession } from '../lib/auth'
import { getCurrentPublicPackageEditions } from '../lib/public-content'
import { Link } from 'react-router-dom'
import { getSubscriptionCtaLabel, resolvePublicPackageImage } from '../lib/public-content'

type PublicPackagesPageProps = {
  session: PublicSession | null
  onLogout: () => void
}

function PublicPackagesPage({ session, onLogout }: PublicPackagesPageProps) {
  const packages = getCurrentPublicPackageEditions()

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
                <Link to={`/pacchetti/${item.id}`} className="btn btn-primary btn-sm mt-3">
                  {getSubscriptionCtaLabel(item)}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default PublicPackagesPage
