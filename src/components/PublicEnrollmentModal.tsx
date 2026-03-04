import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { PublicSession } from '../lib/auth'
import { getPackages, type SportPackage } from '../lib/package-catalog'
import { getPublicClients, getPublicMinors } from '../lib/public-customer-records'
import { getPublicEnrollmentsByUser } from '../lib/public-enrollments'
import PublicEnrollmentForm from './PublicEnrollmentForm'

export type EnrollmentScenario =
  | 'guest_youth_minor_new'
  | 'subscriber_youth_minor_new'
  | 'client_youth_minor_same_minor_new_package'
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
    const hasYouthEnrollment = userEnrollments.some((item) => item.audience === 'youth')
    if (!hasYouthEnrollment) {
      return 'client_youth_minor_new_minor'
    }
    const clientIds = new Set(getPublicClients().filter((item) => item.userId === session.userId).map((item) => item.id))
    const hasAnyMinor = getPublicMinors().some((item) => clientIds.has(item.clientId))
    return hasAnyMinor ? 'client_youth_minor_same_minor_new_package' : 'client_youth_minor_new_minor'
  }

  return 'unsupported'
}

function PublicEnrollmentModal({ packageItem, isOpen, session, onClose, onCompleted }: PublicEnrollmentModalProps) {
  const { t } = useTranslation()
  const scenario = useMemo(() => resolveScenario(packageItem, session), [packageItem, session])
  const canonicalPackage = useMemo(() => {
    if (!packageItem?.id) {
      return null
    }
    return getPackages().find((item) => item.id === packageItem.id) ?? packageItem
  }, [packageItem])
  const hasScheduleStep = Boolean(canonicalPackage?.userSelectableSchedule === true)
  const enabledStepIds = useMemo(() => {
    if (scenario === 'guest_youth_minor_new') {
      return (hasScheduleStep ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]) as Array<1 | 2 | 3 | 4 | 5 | 6>
    }
    if (scenario === 'client_youth_minor_same_minor_new_package') {
      return (hasScheduleStep ? [3, 4, 5, 6] : [3, 4, 5]) as Array<1 | 2 | 3 | 4 | 5 | 6>
    }
    return (hasScheduleStep ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]) as Array<1 | 2 | 3 | 4 | 5 | 6>
  }, [hasScheduleStep, scenario])

  if (!isOpen || !packageItem) {
    return null
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box h-screen w-screen max-w-none rounded-none p-0">
        {packageItem.audience === 'youth' ? (
          <PublicEnrollmentForm
            packageItem={packageItem}
            isOpen={isOpen}
            session={session}
            onClose={onClose}
            onCompleted={onCompleted}
            enabledStepIds={enabledStepIds}
          />
        ) : (
          <div className="p-4">
            <p className="text-sm">{t('public.common.scenarioUnavailable')}</p>
            <div className="mt-3">
              <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
                {t('public.common.close')}
              </button>
            </div>
          </div>
        )}
      </div>
      <button type="button" className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}

export default PublicEnrollmentModal
