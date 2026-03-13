import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
                {t('openDay.public.modal.reuseDescription')}
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-ghost" onClick={handleClose}>
                {t('dataTable.close')}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setReuseAcknowledged(true)}>
                {t('openDay.public.modal.proceed')}
              </button>
            </div>
          </div>
        ) : showMinorChoiceGate ? (
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-6 p-6">
            <div className="rounded-lg border border-base-300 p-5">
              <h3 className="text-lg font-semibold">{t('openDay.public.modal.selectMinorTitle')}</h3>
              <p className="mt-2 text-sm opacity-80">
                {t('openDay.public.modal.selectMinorDescription')}
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
                      <p className="text-sm opacity-70">{t('openDay.public.modal.birthDateLabel', { date: minor.subtitle })}</p>
                      <p className="text-xs opacity-60">
                        {t('openDay.public.modal.dataSourceLabel', {
                          source:
                            minor.source === 'prospect'
                              ? t('openDay.public.modal.dataSourceProspect')
                              : t('openDay.public.modal.dataSourceClient'),
                        })}
                      </p>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-base-300 p-4 text-sm opacity-80">
                {t('openDay.public.modal.noExistingMinors')}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-ghost" onClick={handleClose}>
                {t('dataTable.close')}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setMinorMode('new')
                  setSelectedExistingMinorId(null)
                }}
              >
                {t('openDay.public.modal.newMinor')}
              </button>
              {existingMinorOptions.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={selectedExistingMinorId === null}
                  onClick={() => setMinorMode('existing')}
                >
                  {t('openDay.public.modal.proceedSelectedMinor')}
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
