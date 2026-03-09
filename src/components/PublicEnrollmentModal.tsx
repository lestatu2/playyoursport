import { useMemo, useState } from 'react'
import type { PublicSession } from '../lib/auth'
import { getPackages, type SportPackage } from '../lib/package-catalog'
import { getPublicClients, getPublicMinors } from '../lib/public-customer-records'
import { getPublicEnrollmentsByUser } from '../lib/public-enrollments'
import { getAthleteActivities } from '../lib/athlete-activities'
import PublicEnrollmentForm from './PublicEnrollmentForm'

export type EnrollmentScenario =
  | 'guest_youth_minor_new'
  | 'subscriber_youth_minor_new'
  | 'client_youth_minor_same_minor_new_package'
  | 'client_youth_minor_existing_minor_new_package'
  | 'client_youth_minor_new_minor'
  | 'guest_adult_self_new'
  | 'subscriber_adult_self_new'
  | 'client_adult_self_repeat_or_new'
  | 'unsupported'

type PublicEnrollmentModalProps = {
  packageItem: SportPackage | null
  isOpen: boolean
  session: PublicSession | null
  onClose: () => void
  onCompleted?: (message: string) => void
}

function resolveScenario(packageItem: SportPackage | null, session: PublicSession | null): EnrollmentScenario {
  if (!packageItem) {
    return 'unsupported'
  }
  if (!session) {
    return packageItem.audience === 'youth' ? 'guest_youth_minor_new' : 'guest_adult_self_new'
  }

  if (session.role === 'subscribers') {
    return packageItem.audience === 'youth' ? 'subscriber_youth_minor_new' : 'subscriber_adult_self_new'
  }

  if (session.role === 'client') {
    if (packageItem.audience === 'adult') {
      return 'client_adult_self_repeat_or_new'
    }
    const userEnrollments = getPublicEnrollmentsByUser(session.userId)
    const hasSamePackageYouthEnrollment = userEnrollments.some(
      (item) => item.audience === 'youth' && item.packageId === packageItem.id,
    )
    const clientIds = new Set(getPublicClients().filter((item) => item.userId === session.userId).map((item) => item.id))
    const hasAnyMinor = getPublicMinors().some((item) => clientIds.has(item.clientId))
    if (hasSamePackageYouthEnrollment) {
      return hasAnyMinor ? 'client_youth_minor_same_minor_new_package' : 'client_youth_minor_new_minor'
    }
    return hasAnyMinor ? 'client_youth_minor_existing_minor_new_package' : 'client_youth_minor_new_minor'
  }

  return 'unsupported'
}

function PublicEnrollmentModal({ packageItem, isOpen, session, onClose, onCompleted }: PublicEnrollmentModalProps) {
  const scenario = useMemo(() => resolveScenario(packageItem, session), [packageItem, session])
  const [acceptedDisclaimerPackageId, setAcceptedDisclaimerPackageId] = useState<string | null>(null)
  const [selectedExistingMinorId, setSelectedExistingMinorId] = useState<number | null>(null)
  const [minorPurchaseMode, setMinorPurchaseMode] = useState<'existing' | 'new' | null>(null)
  const canonicalPackage = useMemo(() => {
    if (!packageItem?.id) {
      return null
    }
    return getPackages().find((item) => item.id === packageItem.id) ?? packageItem
  }, [packageItem])
  const hasScheduleStep = Boolean(canonicalPackage?.userSelectableSchedule === true)
  const linkedMinors = useMemo(() => {
    if (!session || session.role !== 'client') {
      return []
    }
    const clientIds = new Set(getPublicClients().filter((item) => item.userId === session.userId).map((item) => item.id))
    return getPublicMinors().filter((item) => clientIds.has(item.clientId))
  }, [session])
  const minorsWithCurrentPackage = useMemo(() => {
    if (!packageItem) {
      return new Set<number>()
    }
    const athleteKeysWithPackage = new Set(
      getAthleteActivities()
        .filter((activity) => activity.type === 'minor' && activity.packageId === packageItem.id)
        .map((activity) => activity.athleteKey),
    )
    const ids = new Set<number>()
    linkedMinors.forEach((minor) => {
      if (athleteKeysWithPackage.has(`minor-${minor.id}`)) {
        ids.add(minor.id)
      }
    })
    return ids
  }, [linkedMinors, packageItem])
  const minorsWithoutCurrentPackage = useMemo(
    () => linkedMinors.filter((minor) => !minorsWithCurrentPackage.has(minor.id)),
    [linkedMinors, minorsWithCurrentPackage],
  )
  const enabledStepIds = useMemo(() => {
    if (
      scenario === 'guest_adult_self_new' ||
      scenario === 'subscriber_adult_self_new' ||
      scenario === 'client_adult_self_repeat_or_new'
    ) {
      return (hasScheduleStep ? [2, 3, 4, 5, 6] : [2, 3, 4, 5]) as Array<1 | 2 | 3 | 4 | 5 | 6>
    }
    if (scenario === 'guest_youth_minor_new') {
      return (hasScheduleStep ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]) as Array<1 | 2 | 3 | 4 | 5 | 6>
    }
    if (scenario === 'client_youth_minor_same_minor_new_package') {
      if (minorPurchaseMode === 'existing') {
        return (hasScheduleStep ? [3, 4, 5, 6] : [3, 4, 5]) as Array<1 | 2 | 3 | 4 | 5 | 6>
      }
      return (hasScheduleStep ? [1, 3, 4, 5, 6] : [1, 3, 4, 5]) as Array<1 | 2 | 3 | 4 | 5 | 6>
    }
    if (scenario === 'client_youth_minor_existing_minor_new_package') {
      if (minorPurchaseMode === 'new') {
        return (hasScheduleStep ? [1, 3, 4, 5, 6] : [1, 3, 4, 5]) as Array<1 | 2 | 3 | 4 | 5 | 6>
      }
      return (hasScheduleStep ? [3, 4, 5, 6] : [3, 4, 5]) as Array<1 | 2 | 3 | 4 | 5 | 6>
    }
    return (hasScheduleStep ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]) as Array<1 | 2 | 3 | 4 | 5 | 6>
  }, [hasScheduleStep, minorPurchaseMode, scenario])
  const showExistingPackageDisclaimer = scenario === 'client_youth_minor_same_minor_new_package'
  const showExistingMinorSelector = scenario === 'client_youth_minor_existing_minor_new_package'
  const isDisclaimerAcceptedForCurrentPackage = acceptedDisclaimerPackageId === packageItem?.id
  const requiresMinorSelectionGate =
    showExistingMinorSelector || (showExistingPackageDisclaimer && isDisclaimerAcceptedForCurrentPackage)
  const selectedMinorForScenario = useMemo(
    () => minorsWithoutCurrentPackage.find((item) => item.id === selectedExistingMinorId) ?? null,
    [minorsWithoutCurrentPackage, selectedExistingMinorId],
  )
  const handleClose = () => {
    setAcceptedDisclaimerPackageId(null)
    setSelectedExistingMinorId(null)
    setMinorPurchaseMode(null)
    onClose()
  }

  if (!isOpen || !packageItem) {
    return null
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box h-screen w-screen max-w-none rounded-none p-0">
        {showExistingPackageDisclaimer && !isDisclaimerAcceptedForCurrentPackage ? (
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center gap-6 p-6">
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-5">
              <h3 className="text-lg font-semibold">Acquisto gia presente</h3>
              <p className="mt-2 text-sm leading-relaxed">
                Hai gia acquistato questo pacchetto per un minore collegato al tuo profilo. Se vuoi acquistarlo per un altro minore, puoi procedere.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-ghost" onClick={handleClose}>
                Chiudi
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setAcceptedDisclaimerPackageId(packageItem.id)
                  setMinorPurchaseMode(null)
                  setSelectedExistingMinorId(null)
                }}
              >
                Procedi
              </button>
            </div>
          </div>
        ) : requiresMinorSelectionGate && !minorPurchaseMode ? (
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-6 p-6">
            <div className="rounded-lg border border-base-300 p-5">
              <h3 className="text-lg font-semibold">Seleziona il minore</h3>
              <p className="mt-2 text-sm opacity-80">
                Hai gia acquistato questo pacchetto per almeno un minore collegato. Puoi acquistarlo per un altro minore collegato oppure per un ulteriore nuovo minore.
              </p>
            </div>
            {minorsWithoutCurrentPackage.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {minorsWithoutCurrentPackage.map((minor) => {
                const isSelected = selectedExistingMinorId === minor.id
                return (
                  <button
                    key={minor.id}
                    type="button"
                    className={`rounded-lg border p-4 text-left transition ${isSelected ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary/40'}`}
                    onClick={() => setSelectedExistingMinorId(minor.id)}
                  >
                    <p className="font-semibold">{minor.firstName} {minor.lastName}</p>
                    <p className="text-sm opacity-70">Data nascita: {minor.birthDate || '-'}</p>
                    <p className="text-sm opacity-70">Codice fiscale: {minor.taxCode || '-'}</p>
                  </button>
                )
              })}
              </div>
            ) : (
              <div className="rounded-lg border border-base-300 p-4 text-sm opacity-80">
                Non ci sono altri minori collegati disponibili per questo pacchetto.
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
                  setMinorPurchaseMode('new')
                  setSelectedExistingMinorId(null)
                }}
              >
                Acquista per nuovo minore
              </button>
              {minorsWithoutCurrentPackage.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={selectedExistingMinorId === null}
                  onClick={() => setMinorPurchaseMode('existing')}
                >
                  Procedi per minore selezionato
                </button>
              ) : null}
            </div>
          </div>
        ) : requiresMinorSelectionGate && minorPurchaseMode === 'existing' && !selectedMinorForScenario ? (
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center gap-6 p-6">
            <div className="rounded-lg border border-error/40 bg-error/10 p-5">
              <p className="text-sm">Selezione minore non valida per questo pacchetto. Riprova.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setMinorPurchaseMode(null)
                  setSelectedExistingMinorId(null)
                }}
              >
                Torna alla selezione
              </button>
            </div>
          </div>
        ) : (
          <PublicEnrollmentForm
            packageItem={packageItem}
            isOpen={isOpen}
            session={session}
            onClose={handleClose}
            onCompleted={onCompleted}
            enabledStepIds={enabledStepIds}
            selectedExistingMinorId={
              requiresMinorSelectionGate && minorPurchaseMode === 'existing' ? selectedExistingMinorId : null
            }
          />
        )}
      </div>
      <button type="button" className="modal-backdrop" onClick={handleClose} />
    </dialog>
  )
}

export default PublicEnrollmentModal
