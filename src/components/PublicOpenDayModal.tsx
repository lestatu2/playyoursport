import { useMemo, useState } from 'react'
import type { PublicSession } from '../lib/auth'
import type { OpenDayEdition, OpenDayProduct } from '../lib/open-day-catalog'
import { resolveOpenDayScenario } from '../lib/open-day-scenarios'
import { getOpenDayMinorAthletesByProspectId, getOpenDayProspectByUserId } from '../lib/open-day-records'
import { getPublicClients, getPublicMinors } from '../lib/public-customer-records'
import PublicOpenDayForm from './PublicOpenDayForm'

type PublicOpenDayModalProps = {
  product: OpenDayProduct | null
  edition: OpenDayEdition | null
  isOpen: boolean
  session: PublicSession | null
  onClose: () => void
  onCompleted?: (message: string) => void
}

type ExistingMinorOption = {
  id: string
  title: string
  subtitle: string
  source: 'prospect' | 'client'
}

function PublicOpenDayModal({ product, edition, isOpen, session, onClose, onCompleted: _onCompleted }: PublicOpenDayModalProps) {
  const scenarioConfig = useMemo(
    () => resolveOpenDayScenario({ product, edition, session }),
    [edition, product, session],
  )
  const [reuseAcknowledged, setReuseAcknowledged] = useState(false)
  const [minorMode, setMinorMode] = useState<'existing' | 'new' | null>(null)
  const [selectedExistingMinorId, setSelectedExistingMinorId] = useState<string | null>(null)

  const existingMinorOptions = useMemo<ExistingMinorOption[]>(() => {
    if (!session || !scenarioConfig.canSelectExistingMinor) {
      return []
    }
    if (session.role === 'prospect') {
      const prospect = getOpenDayProspectByUserId(session.userId)
      if (!prospect) {
        return []
      }
      return getOpenDayMinorAthletesByProspectId(prospect.id).map((minor) => ({
        id: `prospect-minor-${minor.id}`,
        title: `${minor.firstName} ${minor.lastName}`.trim(),
        subtitle: minor.birthDate || '-',
        source: 'prospect',
      }))
    }
    if (session.role === 'client') {
      const clientIds = new Set(getPublicClients().filter((item) => item.userId === session.userId).map((item) => item.id))
      return getPublicMinors()
        .filter((item) => clientIds.has(item.clientId))
        .map((minor) => ({
          id: `client-minor-${minor.id}`,
          title: `${minor.firstName} ${minor.lastName}`.trim(),
          subtitle: minor.birthDate || '-',
          source: 'client',
        }))
    }
    return []
  }, [scenarioConfig.canSelectExistingMinor, session])

  const handleClose = () => {
    setReuseAcknowledged(false)
    setMinorMode(null)
    setSelectedExistingMinorId(null)
    onClose()
  }

  const showReuseGate = scenarioConfig.shouldPromptForExistingDataReuse && !reuseAcknowledged
  const showMinorChoiceGate = scenarioConfig.canSelectExistingMinor && reuseAcknowledged && minorMode === null

  if (!isOpen || !product || !edition) {
    return null
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box h-screen w-screen max-w-none rounded-none p-0">
        {showReuseGate ? (
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center gap-6 p-6">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-5">
              <h3 className="text-lg font-semibold">Dati gia presenti</h3>
              <p className="mt-2 text-sm leading-relaxed">
                Per questo open day il sistema ha rilevato che il tuo profilo e gia presente. Procedendo potremo riutilizzare i dati gia disponibili senza richiederli di nuovo dove non necessario.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-ghost" onClick={handleClose}>
                Chiudi
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setReuseAcknowledged(true)}>
                Procedi
              </button>
            </div>
          </div>
        ) : showMinorChoiceGate ? (
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-6 p-6">
            <div className="rounded-lg border border-base-300 p-5">
              <h3 className="text-lg font-semibold">Seleziona il minore</h3>
              <p className="mt-2 text-sm opacity-80">
                Puoi iscrivere un minore gia presente nel tuo profilo oppure registrarne un altro nuovo per questo open day.
              </p>
            </div>
            {existingMinorOptions.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {existingMinorOptions.map((minor) => {
                  const isSelected = selectedExistingMinorId === minor.id
                  return (
                    <button
                      key={minor.id}
                      type="button"
                      className={`rounded-lg border p-4 text-left transition ${
                        isSelected ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary/40'
                      }`}
                      onClick={() => setSelectedExistingMinorId(minor.id)}
                    >
                      <p className="font-semibold">{minor.title}</p>
                      <p className="text-sm opacity-70">Data nascita: {minor.subtitle}</p>
                      <p className="text-xs opacity-60">
                        Origine dati: {minor.source === 'prospect' ? 'Open Day prospect' : 'Cliente'}
                      </p>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-base-300 p-4 text-sm opacity-80">
                Non ci sono minori gia presenti associati al profilo corrente.
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-ghost" onClick={handleClose}>
                Chiudi
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setMinorMode('new')
                  setSelectedExistingMinorId(null)
                }}
              >
                Nuovo minore
              </button>
              {existingMinorOptions.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={selectedExistingMinorId === null}
                  onClick={() => setMinorMode('existing')}
                >
                  Procedi con minore selezionato
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <PublicOpenDayForm
            product={product}
            edition={edition}
            session={session}
            scenarioConfig={scenarioConfig}
            selectedExistingMinorToken={minorMode === 'existing' ? selectedExistingMinorId : null}
            onClose={handleClose}
            onCompleted={_onCompleted}
          />
        )}
      </div>
      <button type="button" className="modal-backdrop" onClick={handleClose} />
    </dialog>
  )
}

export default PublicOpenDayModal
