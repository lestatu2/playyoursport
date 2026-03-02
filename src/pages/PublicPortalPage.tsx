import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import {
  clearPublicSession,
  convertSubscriberToClient,
  loginPublicWithEmailPassword,
  registerSubscriberPublic,
  type PublicSession,
} from '../lib/auth'
import { getHomepageSliderPackages, getSubscriptionCtaLabel, resolvePublicPackageImage } from '../lib/public-content'
import { createPublicEnrollment, getPublicEnrollmentsByUser } from '../lib/public-enrollments'
import PublicSiteHeader from '../components/PublicSiteHeader'
import type { SportPackage } from '../lib/package-catalog'

type PublicPortalPageProps = {
  session: PublicSession | null
  onLogin: (session: PublicSession) => void
  onLogout: () => void
}

type PurchaseDraft = {
  participantFirstName: string
  participantLastName: string
  participantBirthYear: string
  parentFirstName: string
  parentLastName: string
  parentEmail: string
  selectedGroupId: string
  privacyAccepted: boolean
}

const EMPTY_PURCHASE_DRAFT: PurchaseDraft = {
  participantFirstName: '',
  participantLastName: '',
  participantBirthYear: '',
  parentFirstName: '',
  parentLastName: '',
  parentEmail: '',
  selectedGroupId: '',
  privacyAccepted: false,
}

function PublicPortalPage({ session, onLogin, onLogout }: PublicPortalPageProps) {
  const [slides] = useState<SportPackage[]>(() => getHomepageSliderPackages())
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [login, setLogin] = useState('')
  const [authError, setAuthError] = useState('')
  const [activePackageId, setActivePackageId] = useState<string | null>(null)
  const [purchaseDraft, setPurchaseDraft] = useState<PurchaseDraft>(EMPTY_PURCHASE_DRAFT)
  const [purchaseError, setPurchaseError] = useState('')
  const [message, setMessage] = useState('')

  const enrollments = useMemo(() => (session ? getPublicEnrollmentsByUser(session.userId) : []), [session])
  const activePackage = useMemo(() => slides.find((item) => item.id === activePackageId) ?? null, [activePackageId, slides])

  const submitAuth = () => {
    setAuthError('')
    setMessage('')
    if (authMode === 'login') {
      const result = loginPublicWithEmailPassword(email, password)
      if (!result.ok) {
        setAuthError(result.errorKey === 'roleNotAllowed' ? 'Accesso riservato a subscriber/client.' : 'Credenziali non valide.')
        return
      }
      onLogin(result.session)
      return
    }
    const created = registerSubscriberPublic({ firstName, lastName, email, login, password })
    if (!created.ok) {
      setAuthError('Registrazione non valida o utenza già esistente.')
      return
    }
    const logged = loginPublicWithEmailPassword(email, password)
    if (!logged.ok) {
      setAuthError('Registrazione completata, ma login automatico fallito.')
      return
    }
    onLogin(logged.session)
  }

  const openPurchase = (item: SportPackage) => {
    if (!session) {
      setAuthError('Per acquistare devi prima accedere o registrarti.')
      return
    }
    setActivePackageId(item.id)
    setPurchaseError('')
    setPurchaseDraft({
      ...EMPTY_PURCHASE_DRAFT,
      parentEmail: session.email,
    })
  }

  const closePurchase = () => {
    setActivePackageId(null)
    setPurchaseError('')
    setPurchaseDraft(EMPTY_PURCHASE_DRAFT)
  }

  const submitPurchase = () => {
    if (!session || !activePackage) {
      return
    }
    const isYouth = activePackage.audience === 'youth'
    if (isYouth) {
      if (
        !purchaseDraft.participantFirstName.trim() ||
        !purchaseDraft.participantLastName.trim() ||
        !purchaseDraft.participantBirthYear.trim() ||
        !purchaseDraft.parentFirstName.trim() ||
        !purchaseDraft.parentLastName.trim() ||
        !purchaseDraft.parentEmail.trim()
      ) {
        setPurchaseError('Compila i dati del ragazzo e del genitore.')
        return
      }
    } else if (!purchaseDraft.parentFirstName.trim() || !purchaseDraft.parentLastName.trim() || !purchaseDraft.parentEmail.trim()) {
      setPurchaseError('Compila i dati dell’acquirente.')
      return
    }
    if (!purchaseDraft.privacyAccepted) {
      setPurchaseError('Devi accettare privacy e termini per procedere.')
      return
    }

    createPublicEnrollment({
      packageId: activePackage.id,
      purchaserUserId: session.userId,
      audience: activePackage.audience,
      participantFirstName: isYouth ? purchaseDraft.participantFirstName.trim() : purchaseDraft.parentFirstName.trim(),
      participantLastName: isYouth ? purchaseDraft.participantLastName.trim() : purchaseDraft.parentLastName.trim(),
      participantBirthYear: isYouth ? Number(purchaseDraft.participantBirthYear) : null,
      parentFirstName: purchaseDraft.parentFirstName.trim(),
      parentLastName: purchaseDraft.parentLastName.trim(),
      parentEmail: purchaseDraft.parentEmail.trim().toLowerCase(),
      selectedGroupId: purchaseDraft.selectedGroupId,
      privacyAccepted: true,
    })

    if (session.role === 'subscribers') {
      const converted = convertSubscriberToClient(session.userId)
      if (converted.ok) {
        onLogin(converted.session)
      }
    }
    closePurchase()
    setMessage('Acquisto/registrazione completato.')
  }

  return (
    <main className="min-h-screen bg-base-200">
      <div className="relative bg-transparent">
        <PublicSiteHeader
          transparent
          overlay
          session={session}
          onLogout={() => {
            clearPublicSession()
            onLogout()
          }}
        />

        <section className="relative z-10 h-screen text-white">
          <div className="h-full">
            <Swiper
              modules={[Autoplay, Pagination]}
              className="h-full"
              slidesPerView={1}
              spaceBetween={0}
              autoplay={{ delay: 4500, disableOnInteraction: false }}
              pagination={{ clickable: true }}
            >
              {slides.map((item) => (
                <SwiperSlide key={item.id}>
                  <article
                    className="relative h-screen overflow-hidden bg-cover bg-center"
                    style={{
                      backgroundImage: `linear-gradient(to right, rgba(10,15,20,.82), rgba(10,15,20,.35)), url(${resolvePublicPackageImage(item)})`,
                    }}
                  >
                    <div className="absolute inset-0 mx-auto flex max-w-6xl items-end px-4 pb-16 pt-28 md:pb-20">
                      <div>
                        <p className="text-xs uppercase tracking-widest opacity-80">PlayYourSport</p>
                        <p className="text-xs uppercase tracking-wider text-white/80">{item.audience === 'youth' ? 'Ragazzi' : 'Adulti'}</p>
                        <h2 className="mt-2 max-w-3xl text-4xl font-bold text-white md:text-5xl">{item.name}</h2>
                        <p className="mt-3 max-w-2xl text-sm text-white/90">{item.disclaimer || item.description}</p>
                        <div className="mt-6 flex flex-wrap gap-2">
                          <Link to={`/pacchetti/${item.id}`} className="btn btn-primary btn-sm">
                            Vai al dettaglio
                          </Link>
                          <button type="button" className="btn btn-outline btn-sm text-white" onClick={() => openPurchase(item)}>
                            {getSubscriptionCtaLabel(item)}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </section>
      </div>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title">Offerte in evidenza</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {slides.map((item) => (
                  <article key={`card-${item.id}`} className="rounded-lg border border-base-300 p-3">
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm opacity-70">{item.editionYear}</p>
                    <p className="mt-1 text-sm">Prezzo: {item.priceAmount}</p>
                    <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => openPurchase(item)}>
                      {getSubscriptionCtaLabel(item)}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title">Accesso portale</h2>
              {session ? (
                <div className="space-y-2 text-sm">
                  <p>
                    Accesso effettuato come <strong>{session.role}</strong>
                  </p>
                  <p>{session.name}</p>
                  <p className="opacity-70">{session.email}</p>
                </div>
              ) : (
                <>
                  <div className="tabs tabs-boxed">
                    <button type="button" className={`tab ${authMode === 'login' ? 'tab-active' : ''}`} onClick={() => setAuthMode('login')}>
                      Login
                    </button>
                    <button type="button" className={`tab ${authMode === 'register' ? 'tab-active' : ''}`} onClick={() => setAuthMode('register')}>
                      Registrazione
                    </button>
                  </div>
                  {authMode === 'register' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input className="input input-bordered w-full" placeholder="Nome" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                      <input className="input input-bordered w-full" placeholder="Cognome" value={lastName} onChange={(event) => setLastName(event.target.value)} />
                      <input className="input input-bordered w-full sm:col-span-2" placeholder="Login" value={login} onChange={(event) => setLogin(event.target.value)} />
                    </div>
                  )}
                  <div className="space-y-3">
                    <input className="input input-bordered w-full" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
                    <input className="input input-bordered w-full" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
                  </div>
                  {authError ? <p className="rounded-lg bg-error/15 px-3 py-2 text-sm text-error">{authError}</p> : null}
                  <button type="button" className="btn btn-primary w-full" onClick={submitAuth}>
                    {authMode === 'login' ? 'Accedi' : 'Registrati come subscriber'}
                  </button>
                </>
              )}
            </div>
          </div>

          {session ? (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <h2 className="card-title">Le tue iscrizioni</h2>
                {enrollments.length === 0 ? (
                  <p className="text-sm opacity-70">Nessuna iscrizione ancora.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {enrollments.map((item) => (
                      <li key={item.id} className="rounded border border-base-300 p-2">
                        {item.audience === 'youth' ? `${item.participantFirstName} ${item.participantLastName}` : 'Adulto'} - {item.createdAt.slice(0, 10)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </aside>
      </section>

      {activePackage && session && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-3xl space-y-4">
            <h3 className="text-lg font-semibold">Acquisto: {activePackage.name}</h3>
            {activePackage.audience === 'youth' ? (
              <>
                <div className="space-y-2 rounded-lg border border-base-300 p-3">
                  <p className="text-sm font-medium">1) Dati ragazzo</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input className="input input-bordered w-full" placeholder="Nome ragazzo" value={purchaseDraft.participantFirstName} onChange={(event) => setPurchaseDraft((prev) => ({ ...prev, participantFirstName: event.target.value }))} />
                    <input className="input input-bordered w-full" placeholder="Cognome ragazzo" value={purchaseDraft.participantLastName} onChange={(event) => setPurchaseDraft((prev) => ({ ...prev, participantLastName: event.target.value }))} />
                    <input className="input input-bordered w-full" type="number" min={1900} max={2100} placeholder="Anno nascita" value={purchaseDraft.participantBirthYear} onChange={(event) => setPurchaseDraft((prev) => ({ ...prev, participantBirthYear: event.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-base-300 p-3">
                  <p className="text-sm font-medium">2) Dati genitore</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input className="input input-bordered w-full" placeholder="Nome genitore" value={purchaseDraft.parentFirstName} onChange={(event) => setPurchaseDraft((prev) => ({ ...prev, parentFirstName: event.target.value }))} />
                    <input className="input input-bordered w-full" placeholder="Cognome genitore" value={purchaseDraft.parentLastName} onChange={(event) => setPurchaseDraft((prev) => ({ ...prev, parentLastName: event.target.value }))} />
                    <input className="input input-bordered w-full" type="email" placeholder="Email genitore" value={purchaseDraft.parentEmail} onChange={(event) => setPurchaseDraft((prev) => ({ ...prev, parentEmail: event.target.value }))} />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2 rounded-lg border border-base-300 p-3">
                <p className="text-sm font-medium">Dati acquirente</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <input className="input input-bordered w-full" placeholder="Nome" value={purchaseDraft.parentFirstName} onChange={(event) => setPurchaseDraft((prev) => ({ ...prev, parentFirstName: event.target.value }))} />
                  <input className="input input-bordered w-full" placeholder="Cognome" value={purchaseDraft.parentLastName} onChange={(event) => setPurchaseDraft((prev) => ({ ...prev, parentLastName: event.target.value }))} />
                  <input className="input input-bordered w-full" type="email" placeholder="Email" value={purchaseDraft.parentEmail} onChange={(event) => setPurchaseDraft((prev) => ({ ...prev, parentEmail: event.target.value }))} />
                </div>
              </div>
            )}

            <div className="space-y-2 rounded-lg border border-base-300 p-3">
              <p className="text-sm font-medium">3) Scelte prodotto</p>
              <select className="select select-bordered w-full" value={purchaseDraft.selectedGroupId} onChange={(event) => setPurchaseDraft((prev) => ({ ...prev, selectedGroupId: event.target.value }))}>
                <option value="">Seleziona gruppo (opzionale)</option>
                {activePackage.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.title}
                  </option>
                ))}
              </select>
            </div>

            <label className="label cursor-pointer justify-start gap-2">
              <input type="checkbox" className="checkbox checkbox-primary" checked={purchaseDraft.privacyAccepted} onChange={(event) => setPurchaseDraft((prev) => ({ ...prev, privacyAccepted: event.target.checked }))} />
              <span className="label-text">4) Accetto privacy e termini</span>
            </label>

            {purchaseError ? <p className="rounded-lg bg-error/15 px-3 py-2 text-sm text-error">{purchaseError}</p> : null}
            {message ? <p className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success">{message}</p> : null}
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={closePurchase}>Annulla</button>
              <button type="button" className="btn btn-primary" onClick={submitPurchase}>Procedi all'acquisto</button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closePurchase} />
        </dialog>
      )}
    </main>
  )
}

export default PublicPortalPage
