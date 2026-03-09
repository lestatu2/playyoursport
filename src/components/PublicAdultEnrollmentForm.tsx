import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createUser,
  getUsers,
  type PublicSession,
} from '../lib/auth'
import { getEnrollmentById, getPackages, type SportPackage } from '../lib/package-catalog'
import { createPublicEnrollment } from '../lib/public-enrollments'
import {
  createPublicClientRecord,
  findPublicClientByTaxCode,
  getPublicClients,
  updatePublicClientValidationStatus,
} from '../lib/public-customer-records'
import {
  createPublicDirectAthleteRecord,
  getPublicDirectAthletes,
  updatePublicDirectAthleteValidationStatus,
} from '../lib/public-direct-athletes'
import { computeItalianTaxCode, findBirthPlaceCodeByName } from '../lib/tax-code'
import { getAvailablePaymentMethodsForCompany, type PaymentMethodCode } from '../lib/payment-methods'
import { getProjectSettings, getProjectSettingsChangedEventName } from '../lib/project-settings'
import { getAgeFromBirthDate } from '../lib/date-utils'
import { upsertCoverageFromEnrollmentPurchase } from '../lib/athlete-enrollment-coverages'
import SignaturePadField from './SignaturePadField'

type PublicAdultEnrollmentFormProps = {
  packageItem: SportPackage
  session: PublicSession | null
  onClose: () => void
  onCompleted?: (message: string) => void
}

type AdultDraft = {
  firstName: string
  lastName: string
  email: string
  phone: string
  birthDate: string
  gender: 'M' | 'F'
  birthPlace: string
  residenceAddress: string
  taxCode: string
  login: string
  password: string
  selectedPaymentMethodCode: PaymentMethodCode | ''
  consentEnrollmentAccepted: boolean
  consentInformationAccepted: boolean
  consentDataProcessingAccepted: boolean
  consentDataProcessingSignatureDataUrl: string
  enrollmentConfirmationSignatureDataUrl: string
  privacyAccepted: boolean
}

const EMPTY_DRAFT: AdultDraft = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  birthDate: '',
  gender: 'M',
  birthPlace: '',
  residenceAddress: '',
  taxCode: '',
  login: '',
  password: '',
  selectedPaymentMethodCode: '',
  consentEnrollmentAccepted: false,
  consentInformationAccepted: false,
  consentDataProcessingAccepted: false,
  consentDataProcessingSignatureDataUrl: '',
  enrollmentConfirmationSignatureDataUrl: '',
  privacyAccepted: false,
}

function normalizeLoginChunk(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function buildAutoLogin(firstName: string, lastName: string, existingLogins: Set<string>): string {
  const first = normalizeLoginChunk(firstName) || 'utente'
  const last = normalizeLoginChunk(lastName) || 'utente'
  const base = `${first}.${last}`
  if (!existingLogins.has(base)) {
    return base
  }
  let counter = 2
  while (existingLogins.has(`${base}${counter}`)) {
    counter += 1
  }
  return `${base}${counter}`
}

function PublicAdultEnrollmentForm({ packageItem, session, onClose, onCompleted }: PublicAdultEnrollmentFormProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<AdultDraft>(EMPTY_DRAFT)
  const [paymentCurrency, setPaymentCurrency] = useState(() => getProjectSettings().paymentCurrency || 'EUR')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  const canonicalPackage = useMemo(() => getPackages().find((item) => item.id === packageItem.id) ?? packageItem, [packageItem])
  const isFirstPaymentOnSite = useMemo(() => {
    const value = (canonicalPackage as { firstPaymentOnSite?: unknown }).firstPaymentOnSite
    return value === true || value === 'true' || value === 1 || value === '1'
  }, [canonicalPackage])
  const availablePaymentMethods = useMemo(() => {
    if (isFirstPaymentOnSite) {
      return [{ code: 'onsite_pos' as const, details: '' }]
    }
    return getAvailablePaymentMethodsForCompany(canonicalPackage.companyId)
  }, [canonicalPackage.companyId, isFirstPaymentOnSite])
  const packageCost = canonicalPackage.priceAmount ?? 0
  const enrollmentCost = canonicalPackage.enrollmentPrice ?? 0
  const orderGrandTotal = packageCost + enrollmentCost

  const formatAmount = useMemo(
    () => (value: number) => {
      try {
        return new Intl.NumberFormat('it-IT', {
          style: 'currency',
          currency: paymentCurrency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value)
      } catch {
        return `${value.toFixed(2)} ${paymentCurrency}`
      }
    },
    [paymentCurrency],
  )

  useEffect(() => {
    const settingsEvent = getProjectSettingsChangedEventName()
    const handleSettingsChange = () => {
      const settings = getProjectSettings()
      setPaymentCurrency(settings.paymentCurrency || 'EUR')
    }
    window.addEventListener(settingsEvent, handleSettingsChange)
    return () => window.removeEventListener(settingsEvent, handleSettingsChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    const updateTaxCode = async () => {
      const code = await findBirthPlaceCodeByName(draft.birthPlace)
      if (cancelled || !code) {
        return
      }
      const computed = computeItalianTaxCode({
        firstName: draft.firstName,
        lastName: draft.lastName,
        birthDate: draft.birthDate,
        gender: draft.gender,
        birthPlaceCode: code,
      })
      if (!computed) {
        return
      }
      setDraft((prev) => (prev.taxCode === computed ? prev : { ...prev, taxCode: computed }))
    }
    void updateTaxCode()
    return () => {
      cancelled = true
    }
  }, [draft.birthDate, draft.birthPlace, draft.firstName, draft.gender, draft.lastName])

  useEffect(() => {
    const existingLogins = new Set(getUsers().map((user) => user.login.toLowerCase()))
    if (draft.login) {
      existingLogins.delete(draft.login.toLowerCase())
    }
    const nextLogin = buildAutoLogin(draft.firstName, draft.lastName, existingLogins)
    setDraft((prev) => (prev.login === nextLogin ? prev : { ...prev, login: nextLogin }))
  }, [draft.firstName, draft.lastName, draft.login])

  useEffect(() => {
    if (availablePaymentMethods.length === 0) {
      if (draft.selectedPaymentMethodCode) {
        setDraft((prev) => ({ ...prev, selectedPaymentMethodCode: '' }))
      }
      return
    }
    const availableCodes = new Set(availablePaymentMethods.map((item) => item.code))
    if (draft.selectedPaymentMethodCode && availableCodes.has(draft.selectedPaymentMethodCode)) {
      return
    }
    setDraft((prev) => ({ ...prev, selectedPaymentMethodCode: availablePaymentMethods[0]?.code ?? '' }))
  }, [availablePaymentMethods, draft.selectedPaymentMethodCode])

  useEffect(() => {
    if (!session) {
      return
    }
    const existingClient = getPublicClients().find((item) => item.userId === session.userId) ?? null
    if (!existingClient) {
      return
    }
    setDraft((prev) => ({
      ...prev,
      firstName: existingClient.parentFirstName,
      lastName: existingClient.parentLastName,
      email: existingClient.parentEmail,
      phone: existingClient.parentPhone,
      birthDate: existingClient.parentBirthDate,
      birthPlace: existingClient.parentBirthPlace,
      gender: existingClient.parentGender === 'F' ? 'F' : 'M',
      residenceAddress: existingClient.residenceAddress,
      taxCode: existingClient.parentTaxCode,
    }))
  }, [session])

  const validate = (): boolean => {
    if (
      !draft.firstName.trim() ||
      !draft.lastName.trim() ||
      !draft.email.trim() ||
      !draft.phone.trim() ||
      !draft.birthDate.trim() ||
      !draft.birthPlace.trim() ||
      !draft.residenceAddress.trim() ||
      !draft.taxCode.trim()
    ) {
      setError(t('clients.createRequired'))
      return false
    }
    if (!session && !draft.password.trim()) {
      setError(t('public.youthWizard.errors.parentRequired'))
      return false
    }
    if (!draft.selectedPaymentMethodCode) {
      setError(t('public.youthWizard.errors.paymentMethodRequired'))
      return false
    }
    const age = getAgeFromBirthDate(draft.birthDate)
    if (age === null || age < canonicalPackage.ageMin || age > canonicalPackage.ageMax) {
      setError(t('public.youthWizard.errors.ageNotCompatible', { ageLabel: `${canonicalPackage.ageMin}-${canonicalPackage.ageMax}` }))
      return false
    }
    if (!draft.consentEnrollmentAccepted || !draft.consentInformationAccepted || !draft.consentDataProcessingAccepted) {
      setError(t('public.youthWizard.errors.dataProcessingConsentRequired'))
      return false
    }
    if (!draft.consentDataProcessingSignatureDataUrl || !draft.enrollmentConfirmationSignatureDataUrl) {
      setError(t('public.youthWizard.errors.enrollmentSignatureRequired'))
      return false
    }
    return true
  }

  const submit = async () => {
    setError('')
    if (!validate()) {
      return
    }
    setIsSubmitting(true)
    try {
      let userId = session?.userId ?? null
      if (!userId) {
        const created = createUser({
          role: 'client',
          firstName: draft.firstName,
          lastName: draft.lastName,
          avatarUrl: '',
          email: draft.email,
          login: draft.login,
          password: draft.password,
          age: null,
          sector: '',
          profession: '',
          permissions: [],
        })
        if (!created.ok) {
          setError(t('public.youthWizard.errors.registerInvalid'))
          return
        }
        userId = created.user.id
      }

      const existingClientByUser = getPublicClients().find((item) => item.userId === userId) ?? null
      const existingClientByTaxCode = findPublicClientByTaxCode(draft.taxCode)
      const existingClient = existingClientByUser ?? existingClientByTaxCode
      const clientRecord = existingClient ?? createPublicClientRecord({
        userId,
        avatarUrl: '',
        parentFirstName: draft.firstName,
        parentLastName: draft.lastName,
        parentEmail: draft.email,
        parentPhone: draft.phone,
        parentSecondaryPhone: '',
        parentBirthDate: draft.birthDate,
        parentBirthPlace: draft.birthPlace,
        parentRole: 'genitore',
        parentGender: draft.gender,
        parentTaxCode: draft.taxCode,
        residenceAddress: draft.residenceAddress,
        consentEnrollmentAccepted: draft.consentEnrollmentAccepted,
        consentInformationAccepted: draft.consentInformationAccepted,
        consentDataProcessingAccepted: draft.consentDataProcessingAccepted,
        consentDataProcessingSignatureDataUrl: draft.consentDataProcessingSignatureDataUrl,
        enrollmentConfirmationSignatureDataUrl: draft.enrollmentConfirmationSignatureDataUrl,
        parentTaxCodeImageDataUrl: '',
        parentIdentityDocumentImageDataUrl: '',
        privacyPolicySigned: draft.privacyAccepted,
      })
      updatePublicClientValidationStatus(clientRecord.id, 'validated')

      const existingDirectByClient = getPublicDirectAthletes().find((item) => item.clientId === clientRecord.id) ?? null
      const existingDirectByTaxCode = getPublicDirectAthletes().find(
        (item) => item.taxCode.trim().toUpperCase() === draft.taxCode.trim().toUpperCase(),
      ) ?? null
      const existingDirect = existingDirectByClient ?? existingDirectByTaxCode
      const directAthlete = existingDirect ?? createPublicDirectAthleteRecord({
        userId,
        clientId: clientRecord.id,
        packageId: canonicalPackage.id,
        avatarUrl: '',
        firstName: draft.firstName,
        lastName: draft.lastName,
        birthDate: draft.birthDate,
        gender: draft.gender,
        birthPlace: draft.birthPlace,
        residenceAddress: draft.residenceAddress,
        taxCode: draft.taxCode,
        email: draft.email,
        phone: draft.phone,
      })
      updatePublicDirectAthleteValidationStatus(directAthlete.id, 'validated')

      const packageEnrollment = getEnrollmentById(canonicalPackage.enrollmentId)
      if (packageEnrollment) {
        upsertCoverageFromEnrollmentPurchase({
          athleteKey: `direct-${directAthlete.id}`,
          packageItem: canonicalPackage,
          enrollment: packageEnrollment,
        })
      }

      const birthYear = Number.parseInt(draft.birthDate.slice(0, 4), 10)
      createPublicEnrollment({
        packageId: canonicalPackage.id,
        purchaserUserId: userId,
        audience: 'adult',
        participantFirstName: draft.firstName.trim(),
        participantLastName: draft.lastName.trim(),
        participantBirthYear: Number.isInteger(birthYear) ? birthYear : null,
        parentFirstName: draft.firstName.trim(),
        parentLastName: draft.lastName.trim(),
        parentEmail: draft.email.trim().toLowerCase(),
        selectedGroupId: '',
        selectedSchedulePreferenceIds: [],
        selectedAdditionalServiceIds: [],
        selectedPaymentMethodCode: draft.selectedPaymentMethodCode,
        privacyAccepted: draft.privacyAccepted,
      })

      setIsCompleted(true)
      onCompleted?.(t('public.youthWizard.success.completed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isCompleted) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
        <div className="rounded-lg border border-success/30 bg-success/10 p-4">
          <h4 className="text-lg font-semibold text-success">{t('public.youthWizard.postSubmit.title')}</h4>
          <p className="mt-1 text-sm">{t('public.youthWizard.postSubmit.subtitle')}</p>
        </div>
        <div className="rounded-lg border border-base-300 p-4">
          <h5 className="font-semibold">{canonicalPackage.name}</h5>
          <p className="mt-2 text-sm opacity-80">{t('public.youthWizard.summary.packageCost')}: {formatAmount(packageCost)}</p>
          <p className="text-sm opacity-80">{t('public.youthWizard.summary.enrollmentCost')}: {formatAmount(enrollmentCost)}</p>
          <p className="mt-2 rounded bg-primary/15 px-3 py-2 text-base font-semibold text-primary">
            {t('public.youthWizard.summary.grandTotal')}: {formatAmount(orderGrandTotal)}
          </p>
        </div>
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('public.common.close')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-6">
      <h3 className="text-lg font-semibold">{canonicalPackage.name}</h3>
      <div className="rounded-lg border border-base-300 p-4">
        <h4 className="font-semibold">{t('clients.createAsAthlete')}</h4>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('clients.parentFirstName')}</span>
            <input className="input input-bordered w-full" value={draft.firstName} onChange={(event) => setDraft((prev) => ({ ...prev, firstName: event.target.value }))} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('clients.parentLastName')}</span>
            <input className="input input-bordered w-full" value={draft.lastName} onChange={(event) => setDraft((prev) => ({ ...prev, lastName: event.target.value }))} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('clients.email')}</span>
            <input className="input input-bordered w-full" type="email" value={draft.email} onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('clients.phone')}</span>
            <input className="input input-bordered w-full" value={draft.phone} onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('clients.birthDate')}</span>
            <input type="date" className="input input-bordered w-full" value={draft.birthDate} onChange={(event) => setDraft((prev) => ({ ...prev, birthDate: event.target.value }))} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('clients.gender')}</span>
            <select className="select select-bordered w-full" value={draft.gender} onChange={(event) => setDraft((prev) => ({ ...prev, gender: event.target.value as 'M' | 'F' }))}>
              <option value="M">{t('clients.genderMale')}</option>
              <option value="F">{t('clients.genderFemale')}</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('clients.birthPlace')}</span>
            <input className="input input-bordered w-full" value={draft.birthPlace} onChange={(event) => setDraft((prev) => ({ ...prev, birthPlace: event.target.value }))} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('clients.taxCode')}</span>
            <input className="input input-bordered w-full" value={draft.taxCode} readOnly />
          </label>
          <label className="form-control md:col-span-2">
            <span className="label-text mb-1 text-xs">{t('clients.residence')}</span>
            <input className="input input-bordered w-full" value={draft.residenceAddress} onChange={(event) => setDraft((prev) => ({ ...prev, residenceAddress: event.target.value }))} />
          </label>
          {!session ? (
            <>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('public.youthWizard.parent.login')}</span>
                <input className="input input-bordered w-full" value={draft.login} onChange={(event) => setDraft((prev) => ({ ...prev, login: event.target.value }))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('public.youthWizard.parent.password')}</span>
                <input type="password" className="input input-bordered w-full" value={draft.password} onChange={(event) => setDraft((prev) => ({ ...prev, password: event.target.value }))} />
              </label>
            </>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-base-300 p-4">
        <h4 className="font-semibold">{t('clients.paymentMethod')}</h4>
        <div className="mt-3">
          <select
            className="select select-bordered w-full"
            value={draft.selectedPaymentMethodCode}
            onChange={(event) => setDraft((prev) => ({ ...prev, selectedPaymentMethodCode: event.target.value as PaymentMethodCode | '' }))}
          >
            {availablePaymentMethods.map((method) => (
              <option key={method.code} value={method.code}>
                {t(`utility.paymentMethods.methods.${method.code}.label`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-base-300 p-4 space-y-3">
        <label className="label cursor-pointer justify-start gap-2">
          <input type="checkbox" className="checkbox checkbox-primary" checked={draft.consentEnrollmentAccepted} onChange={(event) => setDraft((prev) => ({ ...prev, consentEnrollmentAccepted: event.target.checked }))} />
          <span className="label-text">{t('public.youthWizard.consents.enrollmentLabel')}</span>
        </label>
        <label className="label cursor-pointer justify-start gap-2">
          <input type="checkbox" className="checkbox checkbox-primary" checked={draft.consentInformationAccepted} onChange={(event) => setDraft((prev) => ({ ...prev, consentInformationAccepted: event.target.checked }))} />
          <span className="label-text">{t('public.youthWizard.consents.informationLabel')}</span>
        </label>
        <label className="label cursor-pointer justify-start gap-2">
          <input type="checkbox" className="checkbox checkbox-primary" checked={draft.consentDataProcessingAccepted} onChange={(event) => setDraft((prev) => ({ ...prev, consentDataProcessingAccepted: event.target.checked }))} />
          <span className="label-text">{t('public.youthWizard.consents.dataProcessingLabel')}</span>
        </label>
        <label className="label cursor-pointer justify-start gap-2">
          <input type="checkbox" className="checkbox checkbox-primary" checked={draft.privacyAccepted} onChange={(event) => setDraft((prev) => ({ ...prev, privacyAccepted: event.target.checked }))} />
          <span className="label-text">{t('public.youthWizard.consents.privacyLabel')}</span>
        </label>
        <SignaturePadField
          label={t('public.youthWizard.consents.dataProcessingSignatureLabel')}
          value={draft.consentDataProcessingSignatureDataUrl}
          onChange={(value) => setDraft((prev) => ({ ...prev, consentDataProcessingSignatureDataUrl: value }))}
        />
        <SignaturePadField
          label={t('public.youthWizard.consents.enrollmentSignatureLabel')}
          value={draft.enrollmentConfirmationSignatureDataUrl}
          onChange={(value) => setDraft((prev) => ({ ...prev, enrollmentConfirmationSignatureDataUrl: value }))}
        />
      </div>

      {error ? <p className="rounded-lg bg-error/15 px-3 py-2 text-sm text-error">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
          {t('public.common.close')}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={isSubmitting}>
          {t('public.youthWizard.actions.submit')}
        </button>
      </div>
    </div>
  )
}

export default PublicAdultEnrollmentForm
