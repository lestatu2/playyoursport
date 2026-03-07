import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2 } from 'lucide-react'
import {
  createUser,
  getUsers,
  type PublicSession,
} from '../lib/auth'
import { getAdditionalServices, getCompanies, getEnrollmentById, getGroups, getPackages, type AdditionalService, type PackageGroup, type SportPackage } from '../lib/package-catalog'
import { createPublicEnrollment } from '../lib/public-enrollments'
import { upsertCoverageFromEnrollmentPurchase } from '../lib/athlete-enrollment-coverages'
import {
  createPublicClientRecord,
  createPublicMinorRecord,
  findPublicClientByTaxCode,
  findPublicMinorByTaxCode,
  type ParentRole,
} from '../lib/public-customer-records'
import { getProjectSettings, getProjectSettingsChangedEventName } from '../lib/project-settings'
import { computeItalianTaxCode, findBirthPlaceCodeByName } from '../lib/tax-code'
import { getAvailablePaymentMethodsForCompany, type PaymentMethodCode } from '../lib/payment-methods'
import { getAgeFromBirthDate } from '../lib/date-utils'
import { readFileAsDataUrl } from '../lib/file-utils'
import { initializeGooglePlacesAutocomplete } from '../lib/google-places'
import SignaturePadField from './SignaturePadField'

const GOOGLE_PLACES_SCRIPT_ID = 'pys-google-places-script'

type YouthDraft = {
  minorFirstName: string
  minorLastName: string
  minorBirthDate: string
  minorBirthPlace: string
  minorGender: 'M' | 'F'
  minorResidenceAddress: string
  minorTaxCode: string
  parentFirstName: string
  parentLastName: string
  parentEmail: string
  parentPhone: string
  parentSecondaryPhone: string
  parentBirthDate: string
  parentBirthPlace: string
  parentRole: ParentRole
  parentGender: 'M' | 'F'
  parentResidenceAddress: string
  parentTaxCode: string
  consentEnrollmentAccepted: boolean
  consentInformationAccepted: boolean
  consentDataProcessingAccepted: boolean
  consentDataProcessingSignatureDataUrl: string
  enrollmentConfirmationSignatureDataUrl: string
  selectedFixedServiceIds: string[]
  selectedVariableServiceIds: string[]
  selectedSchedulePreferenceIds: string[]
  selectedPaymentMethodCode: PaymentMethodCode | ''
  login: string
  password: string
  privacyAccepted: boolean
}

type SubmissionSummary = {
  packageName: string
  packageCost: number
  enrollmentCost: number
  additionalServicesTotal: number
  grandTotal: number
  hasVariableServices: boolean
  firstPaymentOnSite: boolean
}

type StepId = 1 | 2 | 3 | 4 | 5 | 6

type GroupGenderMatch = 'male' | 'female' | 'mixed'

type SchedulePreferenceOption = {
  id: string
  groupId: string
  scheduleId: string
  weekday: number
  time: string
  groupTitle: string
}

type SchedulePreferenceGroup = {
  groupId: string
  groupTitle: string
  options: SchedulePreferenceOption[]
}

function detectGroupGender(group: Pick<PackageGroup, 'id' | 'title'>): GroupGenderMatch {
  const haystack = `${group.id} ${group.title}`.toLowerCase()
  if (haystack.includes('mixed') || haystack.includes('misto') || haystack.includes('mista')) {
    return 'mixed'
  }
  if (haystack.includes('female') || haystack.includes('femmin') || haystack.includes('ragazze')) {
    return 'female'
  }
  return 'male'
}

function isGroupGenderCompatibleWithMinor(groupGender: GroupGenderMatch, minorGender: 'M' | 'F'): boolean {
  if (groupGender === 'mixed') {
    return true
  }
  if (minorGender === 'F') {
    return groupGender === 'female'
  }
  return groupGender === 'male'
}

const EMPTY_DRAFT: YouthDraft = {
  minorFirstName: '',
  minorLastName: '',
  minorBirthDate: '',
  minorBirthPlace: '',
  minorGender: 'M',
  minorResidenceAddress: '',
  minorTaxCode: '',
  parentFirstName: '',
  parentLastName: '',
  parentEmail: '',
  parentPhone: '',
  parentSecondaryPhone: '',
  parentBirthDate: '',
  parentBirthPlace: '',
  parentRole: 'genitore',
  parentGender: 'F',
  parentResidenceAddress: '',
  parentTaxCode: '',
  consentEnrollmentAccepted: false,
  consentInformationAccepted: false,
  consentDataProcessingAccepted: false,
  consentDataProcessingSignatureDataUrl: '',
  enrollmentConfirmationSignatureDataUrl: '',
  selectedFixedServiceIds: [],
  selectedVariableServiceIds: [],
  selectedSchedulePreferenceIds: [],
  selectedPaymentMethodCode: '',
  login: '',
  password: '',
  privacyAccepted: false,
}

type PublicEnrollmentFormProps = {
  packageItem: SportPackage | null
  isOpen: boolean
  session: PublicSession | null
  onClose: () => void
  onCompleted?: (message: string) => void
  enabledStepIds?: StepId[]
}

function normalizeLoginChunk(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function monthInitialFromBirthDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'X'
  }
  const initials = ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D']
  return initials[parsed.getMonth()] ?? 'X'
}

function buildAutoLogin(firstName: string, lastName: string, birthDate: string, existingLogins: Set<string>): string {
  const first = normalizeLoginChunk(firstName) || 'utente'
  const last = normalizeLoginChunk(lastName) || 'utente'
  const base = `${first}.${last}`
  if (!existingLogins.has(base)) {
    return base
  }
  const parsed = new Date(birthDate)
  const yy = Number.isNaN(parsed.getTime()) ? '' : String(parsed.getFullYear()).slice(-2)
  const withYear = `${base}${yy}`
  if (yy && !existingLogins.has(withYear)) {
    return withYear
  }
  const withMonthInitial = `${withYear || base}${monthInitialFromBirthDate(birthDate)}`
  if (!existingLogins.has(withMonthInitial)) {
    return withMonthInitial
  }
  let counter = 2
  while (existingLogins.has(`${withMonthInitial}${counter}`)) {
    counter += 1
  }
  return `${withMonthInitial}${counter}`
}

function PublicEnrollmentForm({
  packageItem,
  isOpen,
  session,
  onClose,
  onCompleted,
  enabledStepIds,
}: PublicEnrollmentFormProps) {
  const { t } = useTranslation()
  const isDevMode = import.meta.env.DEV
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<YouthDraft>(EMPTY_DRAFT)
  const [minorTaxCodeFile, setMinorTaxCodeFile] = useState<File | null>(null)
  const [parentTaxCodeFile, setParentTaxCodeFile] = useState<File | null>(null)
  const [parentIdentityFile, setParentIdentityFile] = useState<File | null>(null)
  const [openPaymentDescriptionCode, setOpenPaymentDescriptionCode] = useState<PaymentMethodCode | null>(null)
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState(() => getProjectSettings().googleMapsApiKey || '')
  const [paymentCurrency, setPaymentCurrency] = useState(() => getProjectSettings().paymentCurrency || 'EUR')
  const [submissionSummary, setSubmissionSummary] = useState<SubmissionSummary | null>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const canonicalPackage = useMemo(() => {
    if (!packageItem?.id) {
      return null
    }
    return getPackages().find((item) => item.id === packageItem.id) ?? packageItem
  }, [packageItem])
  const hasScheduleStep = Boolean(
    (canonicalPackage?.userSelectableSchedule ?? packageItem?.userSelectableSchedule) === true,
  )
  const activeStepIds = useMemo<StepId[]>(() => {
    const fallback: StepId[] = hasScheduleStep ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]
    if (!enabledStepIds || enabledStepIds.length === 0) {
      return fallback
    }
    const unique = Array.from(new Set(enabledStepIds)).filter(
      (value): value is StepId => value >= 1 && value <= (hasScheduleStep ? 6 : 5),
    )
    return unique.length > 0 ? unique : fallback
  }, [enabledStepIds, hasScheduleStep])
  const minorBirthPlaceRef = useRef<HTMLInputElement | null>(null)
  const minorResidenceRef = useRef<HTMLInputElement | null>(null)
  const parentBirthPlaceRef = useRef<HTMLInputElement | null>(null)
  const parentResidenceRef = useRef<HTMLInputElement | null>(null)
  const minorBirthPlaceInitializedRef = useRef(false)
  const minorResidenceInitializedRef = useRef(false)
  const parentBirthPlaceInitializedRef = useRef(false)
  const parentResidenceInitializedRef = useRef(false)

  const packageAgeLabel = useMemo(() => {
    if (!packageItem) {
      return ''
    }
    return `${packageItem.ageMin}-${packageItem.ageMax} anni`
  }, [packageItem])
  const company = useMemo(
    () => getCompanies().find((item) => item.id === packageItem?.companyId) ?? null,
    [packageItem?.companyId],
  )
  const additionalServicesById = useMemo(
    () => new Map(getAdditionalServices().map((service) => [service.id, service])),
    [],
  )
  const utilityGroupGenderById = useMemo(() => {
    const map = new Map<string, GroupGenderMatch>()
    getGroups().forEach((group) => {
      const gender: GroupGenderMatch =
        group.gender === 'mixed' ? 'mixed' : group.gender === 'female' ? 'female' : 'male'
      map.set(group.id, gender)
    })
    return map
  }, [])
  const packageFixedServices = useMemo(() => {
    if (!packageItem) {
      return [] as AdditionalService[]
    }
    return packageItem.additionalFixedServices
      .filter((selection) => selection.isActive)
      .map((selection) => additionalServicesById.get(selection.serviceId))
      .filter((service): service is AdditionalService => Boolean(service))
  }, [additionalServicesById, packageItem])
  const packageVariableServices = useMemo(() => {
    if (!packageItem) {
      return [] as AdditionalService[]
    }
    return packageItem.additionalVariableServices
      .filter((selection) => selection.isActive)
      .map((selection) => additionalServicesById.get(selection.serviceId))
      .filter((service): service is AdditionalService => Boolean(service))
  }, [additionalServicesById, packageItem])
  const isFirstPaymentOnSite = useMemo(() => {
    const value =
      (canonicalPackage as { firstPaymentOnSite?: unknown } | null)?.firstPaymentOnSite ??
      (packageItem as { firstPaymentOnSite?: unknown } | null)?.firstPaymentOnSite
    return value === true || value === 'true' || value === 1 || value === '1'
  }, [canonicalPackage, packageItem])
  const availablePaymentMethods = useMemo(() => {
    const companyId = canonicalPackage?.companyId ?? packageItem?.companyId ?? ''
    if (!companyId) {
      return []
    }
    if (isFirstPaymentOnSite) {
      return [{ code: 'onsite_pos' as const, details: '' }]
    }
    return getAvailablePaymentMethodsForCompany(companyId)
  }, [canonicalPackage?.companyId, isFirstPaymentOnSite, packageItem?.companyId])
  const paymentMethodsForRender = useMemo(() => {
    if (!isFirstPaymentOnSite) {
      return availablePaymentMethods
    }
    const onsite = availablePaymentMethods.find((method) => method.code === 'onsite_pos')
    return onsite ? [onsite] : [{ code: 'onsite_pos' as const, details: '' }]
  }, [availablePaymentMethods, isFirstPaymentOnSite])
  const selectedAdditionalServicesTotal = useMemo(() => {
    const selectedIds = [...draft.selectedFixedServiceIds, ...draft.selectedVariableServiceIds]
    return selectedIds.reduce((sum, id) => {
      const price = additionalServicesById.get(id)?.price
      return sum + (typeof price === 'number' ? price : 0)
    }, 0)
  }, [additionalServicesById, draft.selectedFixedServiceIds, draft.selectedVariableServiceIds])
  const packageCost = packageItem?.priceAmount ?? 0
  const enrollmentCost = packageItem?.enrollmentPrice ?? 0
  const orderGrandTotal = packageCost + enrollmentCost + selectedAdditionalServicesTotal
  const consentsStepId: StepId = hasScheduleStep ? 5 : 4
  const confirmStepId: StepId = hasScheduleStep ? 6 : 5
  const schedulePreferenceOptions = useMemo<SchedulePreferenceOption[]>(() => {
    const sourcePackage = canonicalPackage ?? packageItem
    if (!sourcePackage?.userSelectableSchedule) {
      return []
    }
    const unique = new Map<string, SchedulePreferenceOption>()
    sourcePackage.groups.forEach((group) => {
      const groupGender = utilityGroupGenderById.get(group.id) ?? detectGroupGender(group)
      if (!isGroupGenderCompatibleWithMinor(groupGender, draft.minorGender)) {
        return
      }
      group.schedules.forEach((schedule) => {
        const scheduleId = schedule.id?.trim() || `${group.id}-${schedule.weekday}-${schedule.time}`
        const optionId = `${group.id}::${scheduleId}`
        if (!unique.has(optionId)) {
          unique.set(optionId, {
            id: optionId,
            groupId: group.id,
            scheduleId,
            weekday: schedule.weekday,
            time: schedule.time,
            groupTitle: group.title,
          })
        }
      })
    })
    return Array.from(unique.values())
  }, [canonicalPackage, draft.minorGender, packageItem, utilityGroupGenderById])
  const schedulePreferenceGroups = useMemo<SchedulePreferenceGroup[]>(() => {
    const byGroup = new Map<string, SchedulePreferenceGroup>()
    schedulePreferenceOptions.forEach((option) => {
      const current = byGroup.get(option.groupId)
      if (!current) {
        byGroup.set(option.groupId, {
          groupId: option.groupId,
          groupTitle: option.groupTitle,
          options: [option],
        })
        return
      }
      current.options.push(option)
    })
    return Array.from(byGroup.values())
  }, [schedulePreferenceOptions])

  useEffect(() => {
    const settingsEvent = getProjectSettingsChangedEventName()
    const handleSettingsChange = () => {
      const settings = getProjectSettings()
      setGoogleMapsApiKey(settings.googleMapsApiKey || '')
      setPaymentCurrency(settings.paymentCurrency || 'EUR')
    }
    window.addEventListener(settingsEvent, handleSettingsChange)
    return () => window.removeEventListener(settingsEvent, handleSettingsChange)
  }, [])

  const formatAmount = useCallback(
    (value: number) => {
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
    let cancelled = false
    const updateMinorTaxCode = async () => {
      const code = await findBirthPlaceCodeByName(draft.minorBirthPlace)
      if (cancelled || !code) {
        return
      }
      const computed = computeItalianTaxCode({
        firstName: draft.minorFirstName,
        lastName: draft.minorLastName,
        birthDate: draft.minorBirthDate,
        gender: draft.minorGender,
        birthPlaceCode: code,
      })
      if (!computed) {
        return
      }
      setDraft((prev) => (prev.minorTaxCode === computed ? prev : { ...prev, minorTaxCode: computed }))
    }
    void updateMinorTaxCode()
    return () => {
      cancelled = true
    }
  }, [draft.minorBirthDate, draft.minorBirthPlace, draft.minorFirstName, draft.minorGender, draft.minorLastName])

  useEffect(() => {
    let cancelled = false
    const updateParentTaxCode = async () => {
      const code = await findBirthPlaceCodeByName(draft.parentBirthPlace)
      if (cancelled || !code) {
        return
      }
      const computed = computeItalianTaxCode({
        firstName: draft.parentFirstName,
        lastName: draft.parentLastName,
        birthDate: draft.parentBirthDate,
        gender: draft.parentGender,
        birthPlaceCode: code,
      })
      if (!computed) {
        return
      }
      setDraft((prev) => (prev.parentTaxCode === computed ? prev : { ...prev, parentTaxCode: computed }))
    }
    void updateParentTaxCode()
    return () => {
      cancelled = true
    }
  }, [draft.parentBirthDate, draft.parentBirthPlace, draft.parentFirstName, draft.parentGender, draft.parentLastName])

  useEffect(() => {
    const existingLogins = new Set(getUsers().map((user) => user.login.toLowerCase()))
    if (draft.login) {
      existingLogins.delete(draft.login.toLowerCase())
    }
    const nextLogin = buildAutoLogin(draft.parentFirstName, draft.parentLastName, draft.parentBirthDate, existingLogins)
    setDraft((prev) => (prev.login === nextLogin ? prev : { ...prev, login: nextLogin }))
  }, [draft.login, draft.parentBirthDate, draft.parentFirstName, draft.parentLastName])

  useEffect(() => {
    if (paymentMethodsForRender.length === 0) {
      if (draft.selectedPaymentMethodCode) {
        setDraft((prev) => ({ ...prev, selectedPaymentMethodCode: '' }))
      }
      return
    }
    const availableCodes = new Set(paymentMethodsForRender.map((item) => item.code))
    if (draft.selectedPaymentMethodCode && availableCodes.has(draft.selectedPaymentMethodCode)) {
      return
    }
    setDraft((prev) => ({
      ...prev,
      selectedPaymentMethodCode: paymentMethodsForRender[0]?.code ?? '',
    }))
  }, [draft.selectedPaymentMethodCode, paymentMethodsForRender])

  useEffect(() => {
    if (draft.selectedSchedulePreferenceIds.length === 0) {
      return
    }
    const validIds = new Set(schedulePreferenceOptions.map((item) => item.id))
    const filtered = draft.selectedSchedulePreferenceIds.filter((id) => validIds.has(id))
    if (filtered.length === draft.selectedSchedulePreferenceIds.length) {
      return
    }
    setDraft((prev) => ({ ...prev, selectedSchedulePreferenceIds: filtered }))
  }, [draft.selectedSchedulePreferenceIds, schedulePreferenceOptions])

  const initializeAutocomplete = useCallback(
    (
      inputElement: HTMLInputElement | null,
      initializedRef: { current: boolean },
      types: string[],
      onPlaceResolved: (value: string) => void,
    ) => {
      initializeGooglePlacesAutocomplete({
        isOpen,
        initializedRef,
        inputElement,
        apiKey: googleMapsApiKey,
        scriptId: GOOGLE_PLACES_SCRIPT_ID,
        types,
        onPlaceResolved,
      })
    },
    [googleMapsApiKey, isOpen],
  )

  const initializeMinorBirthPlaceAutocomplete = useCallback(() => {
    initializeAutocomplete(minorBirthPlaceRef.current, minorBirthPlaceInitializedRef, ['(cities)'], (value) =>
      setDraft((prev) => ({ ...prev, minorBirthPlace: value })),
    )
  }, [initializeAutocomplete])

  const initializeMinorResidenceAutocomplete = useCallback(() => {
    initializeAutocomplete(minorResidenceRef.current, minorResidenceInitializedRef, ['address'], (value) =>
      setDraft((prev) => ({ ...prev, minorResidenceAddress: value })),
    )
  }, [initializeAutocomplete])

  const initializeParentBirthPlaceAutocomplete = useCallback(() => {
    initializeAutocomplete(parentBirthPlaceRef.current, parentBirthPlaceInitializedRef, ['(cities)'], (value) =>
      setDraft((prev) => ({ ...prev, parentBirthPlace: value })),
    )
  }, [initializeAutocomplete])

  const initializeParentResidenceAutocomplete = useCallback(() => {
    initializeAutocomplete(parentResidenceRef.current, parentResidenceInitializedRef, ['address'], (value) =>
      setDraft((prev) => ({ ...prev, parentResidenceAddress: value })),
    )
  }, [initializeAutocomplete])

  useEffect(() => {
    if (!activeStepIds.includes(step as StepId)) {
      setStep(activeStepIds[0] ?? 1)
    }
  }, [activeStepIds, step])

  if (!isOpen || !packageItem) {
    return null
  }

  const resetAndClose = () => {
    setStep(1)
    setDraft(EMPTY_DRAFT)
    setSubmissionSummary(null)
    setMinorTaxCodeFile(null)
    setParentTaxCodeFile(null)
    setParentIdentityFile(null)
    minorBirthPlaceInitializedRef.current = false
    minorResidenceInitializedRef.current = false
    parentBirthPlaceInitializedRef.current = false
    parentResidenceInitializedRef.current = false
    setError('')
    onClose()
  }

  const validateStepOne = (): boolean => {
    if (
      !draft.minorFirstName.trim() ||
      !draft.minorLastName.trim() ||
      !draft.minorBirthDate.trim() ||
      !draft.minorBirthPlace.trim() ||
      !draft.minorResidenceAddress.trim() ||
      !draft.minorTaxCode.trim()
    ) {
      setError(t('public.youthWizard.errors.minorRequired'))
      return false
    }
    if (!minorTaxCodeFile) {
      setError(t('public.youthWizard.errors.minorTaxCodePhotoRequired'))
      return false
    }
    const age = getAgeFromBirthDate(draft.minorBirthDate)
    if (age === null || age < packageItem.ageMin || age > packageItem.ageMax) {
      setError(t('public.youthWizard.errors.ageNotCompatible', { ageLabel: packageAgeLabel }))
      return false
    }
    if (findPublicMinorByTaxCode(draft.minorTaxCode)) {
      setError(t('public.youthWizard.errors.minorTaxCodeDuplicate'))
      return false
    }
    return true
  }

  const validateStepTwo = (): boolean => {
    if (
      !draft.parentFirstName.trim() ||
      !draft.parentLastName.trim() ||
      !draft.parentEmail.trim() ||
      !draft.parentPhone.trim() ||
      !draft.parentBirthDate.trim() ||
      !draft.parentBirthPlace.trim() ||
      !draft.parentResidenceAddress.trim() ||
      !draft.parentTaxCode.trim() ||
      !draft.password.trim()
    ) {
      setError(t('public.youthWizard.errors.parentRequired'))
      return false
    }
    if (!parentTaxCodeFile) {
      setError(t('public.youthWizard.errors.parentTaxCodePhotoRequired'))
      return false
    }
    if (!parentIdentityFile) {
      setError(t('public.youthWizard.errors.parentIdentityRequired'))
      return false
    }
    if (findPublicClientByTaxCode(draft.parentTaxCode)) {
      setError(t('public.youthWizard.errors.parentTaxCodeDuplicate'))
      return false
    }
    return true
  }

  const validateScheduleStep = (): boolean => {
    if (!hasScheduleStep) {
      return true
    }
    if (schedulePreferenceOptions.length === 0) {
      return true
    }
    if (draft.selectedSchedulePreferenceIds.length === 0) {
      setError(t('public.youthWizard.errors.scheduleRequired'))
      return false
    }
    return true
  }

  const validateConsentsStep = (): boolean => {
    if (!draft.consentEnrollmentAccepted) {
      setError(t('public.youthWizard.errors.enrollmentConsentRequired'))
      return false
    }
    if (!draft.consentInformationAccepted) {
      setError(t('public.youthWizard.errors.informationConsentRequired'))
      return false
    }
    if (!draft.consentDataProcessingAccepted) {
      setError(t('public.youthWizard.errors.dataProcessingConsentRequired'))
      return false
    }
    if (!draft.consentDataProcessingSignatureDataUrl) {
      setError(t('public.youthWizard.errors.dataProcessingSignatureRequired'))
      return false
    }
    if (!draft.enrollmentConfirmationSignatureDataUrl) {
      setError(t('public.youthWizard.errors.enrollmentSignatureRequired'))
      return false
    }
    return true
  }

  const toggleFixedService = (serviceId: string, checked: boolean) => {
    setDraft((prev) => ({
      ...prev,
      selectedFixedServiceIds: checked
        ? [...prev.selectedFixedServiceIds, serviceId]
        : prev.selectedFixedServiceIds.filter((id) => id !== serviceId),
    }))
  }

  const toggleVariableService = (serviceId: string, checked: boolean) => {
    setDraft((prev) => ({
      ...prev,
      selectedVariableServiceIds: checked
        ? [...prev.selectedVariableServiceIds, serviceId]
        : prev.selectedVariableServiceIds.filter((id) => id !== serviceId),
    }))
  }

  const toggleSchedulePreference = (scheduleOptionId: string, checked: boolean) => {
    setDraft((prev) => ({
      ...prev,
      selectedSchedulePreferenceIds: checked
        ? [...prev.selectedSchedulePreferenceIds, scheduleOptionId]
        : prev.selectedSchedulePreferenceIds.filter((id) => id !== scheduleOptionId),
    }))
  }

  const nextStep = () => {
    setError('')
    if (step === 1 && !validateStepOne()) {
      return
    }
    if (step === 2 && !validateStepTwo()) {
      return
    }
    if (hasScheduleStep && step === 4 && !validateScheduleStep()) {
      return
    }
    if (step === consentsStepId && !validateConsentsStep()) {
      return
    }
    const currentIndex = activeStepIds.findIndex((item) => item === step)
    const next = currentIndex >= 0 ? activeStepIds[currentIndex + 1] : activeStepIds[0]
    if (next) {
      setStep(next)
    }
  }

  const previousStep = () => {
    setError('')
    const currentIndex = activeStepIds.findIndex((item) => item === step)
    const previous = currentIndex > 0 ? activeStepIds[currentIndex - 1] : activeStepIds[0]
    if (previous) {
      setStep(previous)
    }
  }

  const goToStep = (targetStep: number) => {
    if (!isDevMode || isSubmitting) {
      return
    }
    if (!activeStepIds.includes(targetStep as StepId)) {
      return
    }
    setError('')
    setStep(targetStep)
  }

  const submit = async () => {
    setError('')
    if (session) {
      setError(t('public.common.scenarioUnavailableLogged'))
      return
    }
    if (!draft.selectedPaymentMethodCode) {
      setError(t('public.youthWizard.errors.paymentMethodRequired'))
      return
    }
    if (activeStepIds.includes(1) && !validateStepOne()) {
      return
    }
    if (activeStepIds.includes(2) && !validateStepTwo()) {
      return
    }
    if (activeStepIds.includes(4) && !validateScheduleStep()) {
      return
    }
    if (activeStepIds.includes(consentsStepId) && !validateConsentsStep()) {
      return
    }

    if (activeStepIds.includes(1) && !minorTaxCodeFile) {
      setError(t('public.youthWizard.errors.minorTaxCodePhotoRequired'))
      return
    }
    if (activeStepIds.includes(2) && !parentTaxCodeFile) {
      setError(t('public.youthWizard.errors.parentTaxCodePhotoRequired'))
      return
    }
    if (activeStepIds.includes(2) && !parentIdentityFile) {
      setError(t('public.youthWizard.errors.parentIdentityRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      let minorTaxCodeImageDataUrl = ''
      let parentTaxCodeImageDataUrl = ''
      let parentIdentityDocumentImageDataUrl = ''

      if (activeStepIds.includes(1) && minorTaxCodeFile) {
        try {
          minorTaxCodeImageDataUrl = await readFileAsDataUrl(minorTaxCodeFile)
        } catch {
          setError(t('public.youthWizard.errors.documentUploadMinorTaxCode'))
          return
        }
      }
      if (activeStepIds.includes(2) && parentTaxCodeFile) {
        try {
          parentTaxCodeImageDataUrl = await readFileAsDataUrl(parentTaxCodeFile)
        } catch {
          setError(t('public.youthWizard.errors.documentUploadParentTaxCode'))
          return
        }
      }
      if (activeStepIds.includes(2) && parentIdentityFile) {
        try {
          parentIdentityDocumentImageDataUrl = await readFileAsDataUrl(parentIdentityFile)
        } catch {
          setError(t('public.youthWizard.errors.documentUploadParentIdentity'))
          return
        }
      }

      if (
        (activeStepIds.includes(1) && !minorTaxCodeImageDataUrl) ||
        (activeStepIds.includes(2) && !parentTaxCodeImageDataUrl) ||
        (activeStepIds.includes(2) && !parentIdentityDocumentImageDataUrl)
      ) {
        setError(t('public.youthWizard.errors.documentUpload'))
        return
      }

      const created = createUser({
        role: 'client',
        firstName: draft.parentFirstName,
        lastName: draft.parentLastName,
        avatarUrl: '',
        email: draft.parentEmail,
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
      const createdUserId = created.user.id

      const clientRecord = createPublicClientRecord({
        userId: createdUserId,
        parentFirstName: draft.parentFirstName,
        parentLastName: draft.parentLastName,
        parentEmail: draft.parentEmail,
        parentPhone: draft.parentPhone,
        parentSecondaryPhone: draft.parentSecondaryPhone,
        parentBirthDate: draft.parentBirthDate,
        parentBirthPlace: draft.parentBirthPlace,
        parentRole: draft.parentRole,
        parentTaxCode: draft.parentTaxCode,
        residenceAddress: draft.parentResidenceAddress,
        consentEnrollmentAccepted: draft.consentEnrollmentAccepted,
        consentInformationAccepted: draft.consentInformationAccepted,
        consentDataProcessingAccepted: draft.consentDataProcessingAccepted,
        consentDataProcessingSignatureDataUrl: draft.consentDataProcessingSignatureDataUrl,
        enrollmentConfirmationSignatureDataUrl: draft.enrollmentConfirmationSignatureDataUrl,
        parentTaxCodeImageDataUrl,
        parentIdentityDocumentImageDataUrl,
        privacyPolicySigned: draft.privacyAccepted,
      })

      const createdMinor = createPublicMinorRecord({
        clientId: clientRecord.id,
        packageId: packageItem.id,
        firstName: draft.minorFirstName,
        lastName: draft.minorLastName,
        birthDate: draft.minorBirthDate,
        birthPlace: draft.minorBirthPlace,
        residenceAddress: draft.minorResidenceAddress,
        taxCode: draft.minorTaxCode,
        taxCodeImageDataUrl: minorTaxCodeImageDataUrl,
      })
      const packageEnrollment = getEnrollmentById(packageItem.enrollmentId)
      if (packageEnrollment) {
        upsertCoverageFromEnrollmentPurchase({
          athleteKey: `minor-${createdMinor.id}`,
          packageItem,
          enrollment: packageEnrollment,
        })
      }

      const minorBirthYear = Number.parseInt(draft.minorBirthDate.slice(0, 4), 10)

      createPublicEnrollment({
        packageId: packageItem.id,
        purchaserUserId: createdUserId,
        audience: 'youth',
        participantFirstName: draft.minorFirstName.trim(),
        participantLastName: draft.minorLastName.trim(),
        participantBirthYear: Number.isInteger(minorBirthYear) ? minorBirthYear : null,
        parentFirstName: draft.parentFirstName.trim(),
        parentLastName: draft.parentLastName.trim(),
        parentEmail: draft.parentEmail.trim().toLowerCase(),
        selectedGroupId: '',
        selectedSchedulePreferenceIds: draft.selectedSchedulePreferenceIds,
        selectedAdditionalServiceIds: [...draft.selectedFixedServiceIds, ...draft.selectedVariableServiceIds],
        selectedPaymentMethodCode: draft.selectedPaymentMethodCode,
        privacyAccepted: true,
      })

      setSubmissionSummary({
        packageName: packageItem.name,
        packageCost,
        enrollmentCost,
        additionalServicesTotal: selectedAdditionalServicesTotal,
        grandTotal: orderGrandTotal,
        hasVariableServices: draft.selectedVariableServiceIds.length > 0,
        firstPaymentOnSite: packageItem.firstPaymentOnSite,
      })
      onCompleted?.(t('public.youthWizard.success.completed'))
    } catch {
      setError(t('public.youthWizard.errors.documentUpload'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
          {submissionSummary ? (
            <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
              <div className="rounded-lg border border-success/30 bg-success/10 p-4">
                <h4 className="text-lg font-semibold text-success">{t('public.youthWizard.postSubmit.title')}</h4>
                <p className="mt-1 text-sm">{t('public.youthWizard.postSubmit.subtitle')}</p>
              </div>

              <div className="rounded-lg border border-base-300 p-4">
                <h5 className="font-semibold">{t('public.youthWizard.postSubmit.summaryTitle')}</h5>
                <p className="mt-2 text-sm">{submissionSummary.packageName}</p>
                <p className="text-sm opacity-80">{t('public.youthWizard.summary.packageCost')}: {formatAmount(submissionSummary.packageCost)}</p>
                <p className="text-sm opacity-80">{t('public.youthWizard.summary.enrollmentCost')}: {formatAmount(submissionSummary.enrollmentCost)}</p>
                <p className="text-sm opacity-80">
                  {t('public.youthWizard.summary.additionalServicesTotal')}: {formatAmount(submissionSummary.additionalServicesTotal)}
                </p>
                <p className="mt-2 rounded bg-primary/15 px-3 py-2 text-base font-semibold text-primary">
                  {t('public.youthWizard.summary.grandTotal')}: {formatAmount(submissionSummary.grandTotal)}
                </p>
              </div>

              <div className="rounded-lg border border-base-300 p-4 text-sm leading-relaxed">
                <p>{t('public.youthWizard.postSubmit.verificationNotice')}</p>
                <p className="mt-2">{t('public.youthWizard.postSubmit.activationNotice')}</p>
                {submissionSummary.firstPaymentOnSite ? (
                  <p className="mt-2">{t('public.youthWizard.postSubmit.firstPaymentOnSite')}</p>
                ) : (
                  <p className="mt-2">{t('public.youthWizard.postSubmit.paymentMethodsNotice')}</p>
                )}
                <p className="mt-2 text-warning">{t('public.youthWizard.postSubmit.variableServicesNotice')}</p>
                {submissionSummary.hasVariableServices ? (
                  <p className="mt-2 text-warning">{t('public.youthWizard.postSubmit.variableServicesGuaranteedNotice')}</p>
                ) : null}
              </div>

              <div className="flex justify-end">
                <button type="button" className="btn btn-primary" onClick={resetAndClose}>
                  {t('public.common.close')}
                </button>
              </div>
            </div>
          ) : (
            <>
          <div className="border-b border-base-300 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide opacity-70">{t('public.youthWizard.title')}</p>
                <h3 className="text-xl font-semibold">{packageItem.name}</h3>
                <p className="text-sm opacity-70">{t('public.youthWizard.ageRange', { ageLabel: packageAgeLabel })}</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={resetAndClose}>
                {t('public.common.close')}
              </button>
            </div>
            <ul className="steps mt-4 w-full">
              {activeStepIds.map((stepId) => (
                <li
                  key={stepId}
                  className={`step ${step >= stepId ? 'step-primary' : ''} ${isDevMode ? 'cursor-pointer' : ''}`}
                  onClick={() => goToStep(stepId)}
                >
                  {!hasScheduleStep
                    ? stepId === 1
                      ? t('public.youthWizard.steps.minor')
                      : stepId === 2
                        ? t('public.youthWizard.steps.parent')
                        : stepId === 3
                          ? t('public.youthWizard.steps.services')
                          : stepId === 4
                            ? t('public.youthWizard.steps.consents')
                            : t('public.youthWizard.steps.confirm')
                    : stepId === 1
                      ? t('public.youthWizard.steps.minor')
                      : stepId === 2
                        ? t('public.youthWizard.steps.parent')
                        : stepId === 3
                          ? t('public.youthWizard.steps.services')
                          : stepId === 4
                            ? t('public.youthWizard.steps.schedule')
                            : stepId === 5
                              ? t('public.youthWizard.steps.consents')
                              : t('public.youthWizard.steps.confirm')}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {step === 1 && (
              <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.minorFirstName')}</span>
                  <input className="input input-bordered w-full" placeholder={t('public.youthWizard.fields.minorFirstName')} value={draft.minorFirstName} onChange={(event) => setDraft((prev) => ({ ...prev, minorFirstName: event.target.value }))} />
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.minorLastName')}</span>
                  <input className="input input-bordered w-full" placeholder={t('public.youthWizard.fields.minorLastName')} value={draft.minorLastName} onChange={(event) => setDraft((prev) => ({ ...prev, minorLastName: event.target.value }))} />
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.minorBirthDate')}</span>
                  <input className="input input-bordered w-full" type="date" value={draft.minorBirthDate} onChange={(event) => setDraft((prev) => ({ ...prev, minorBirthDate: event.target.value }))} />
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.minorGender')}</span>
                  <select className="select select-bordered w-full" value={draft.minorGender} onChange={(event) => setDraft((prev) => ({ ...prev, minorGender: event.target.value === 'F' ? 'F' : 'M' }))}>
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                </label>
                <label className="form-control md:col-span-2">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.minorBirthPlace')}</span>
                  <input
                    ref={minorBirthPlaceRef}
                    className="input input-bordered w-full"
                    placeholder={t('public.youthWizard.fields.minorBirthPlace')}
                    value={draft.minorBirthPlace}
                    onFocus={initializeMinorBirthPlaceAutocomplete}
                    onChange={(event) => setDraft((prev) => ({ ...prev, minorBirthPlace: event.target.value }))}
                  />
                </label>
                <label className="form-control md:col-span-2">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.minorResidenceAddress')}</span>
                  <input
                    ref={minorResidenceRef}
                    className="input input-bordered w-full"
                    placeholder={t('public.youthWizard.fields.minorResidenceAddress')}
                    value={draft.minorResidenceAddress}
                    onFocus={initializeMinorResidenceAutocomplete}
                    onChange={(event) => setDraft((prev) => ({ ...prev, minorResidenceAddress: event.target.value }))}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.minorTaxCode')}</span>
                  <input className="input input-bordered w-full" placeholder={t('public.youthWizard.fields.minorTaxCode')} value={draft.minorTaxCode} readOnly />
                </label>
                <div className="form-control w-full">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.minorTaxCodePhoto')}</span>
                  <input className="file-input file-input-bordered w-full" type="file" accept="image/*,.pdf" onChange={(event) => setMinorTaxCodeFile(event.target.files?.[0] ?? null)} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.parentFirstName')}</span>
                  <input className="input input-bordered w-full" placeholder={t('public.youthWizard.fields.parentFirstName')} value={draft.parentFirstName} onChange={(event) => setDraft((prev) => ({ ...prev, parentFirstName: event.target.value }))} />
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.parentLastName')}</span>
                  <input className="input input-bordered w-full" placeholder={t('public.youthWizard.fields.parentLastName')} value={draft.parentLastName} onChange={(event) => setDraft((prev) => ({ ...prev, parentLastName: event.target.value }))} />
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.parentEmail')}</span>
                  <input className="input input-bordered w-full" type="email" placeholder={t('public.youthWizard.fields.parentEmail')} value={draft.parentEmail} onChange={(event) => setDraft((prev) => ({ ...prev, parentEmail: event.target.value }))} />
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.parentPhone')}</span>
                  <input className="input input-bordered w-full" placeholder={t('public.youthWizard.placeholders.parentPhone')} value={draft.parentPhone} onChange={(event) => setDraft((prev) => ({ ...prev, parentPhone: event.target.value }))} />
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.parentSecondaryPhone')}</span>
                  <input className="input input-bordered w-full" placeholder={t('public.youthWizard.placeholders.parentSecondaryPhone')} value={draft.parentSecondaryPhone} onChange={(event) => setDraft((prev) => ({ ...prev, parentSecondaryPhone: event.target.value }))} />
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.parentBirthDate')}</span>
                  <input className="input input-bordered w-full" type="date" value={draft.parentBirthDate} onChange={(event) => setDraft((prev) => ({ ...prev, parentBirthDate: event.target.value }))} />
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.parentGender')}</span>
                  <select className="select select-bordered w-full" value={draft.parentGender} onChange={(event) => setDraft((prev) => ({ ...prev, parentGender: event.target.value === 'M' ? 'M' : 'F' }))}>
                    <option value="F">F</option>
                    <option value="M">M</option>
                  </select>
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">Ruolo firmatario</span>
                  <select
                    className="select select-bordered w-full"
                    value={draft.parentRole}
                    onChange={(event) => setDraft((prev) => ({ ...prev, parentRole: event.target.value as ParentRole }))}
                  >
                    <option value="genitore">Genitore</option>
                    <option value="tutore">Tutore</option>
                    <option value="esercente_responsabilita">Esercente responsabilita</option>
                  </select>
                </label>
                <label className="form-control md:col-span-2">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.parentBirthPlace')}</span>
                  <input
                    ref={parentBirthPlaceRef}
                    className="input input-bordered w-full"
                    placeholder={t('public.youthWizard.fields.parentBirthPlace')}
                    value={draft.parentBirthPlace}
                    onFocus={initializeParentBirthPlaceAutocomplete}
                    onChange={(event) => setDraft((prev) => ({ ...prev, parentBirthPlace: event.target.value }))}
                  />
                </label>
                <label className="form-control md:col-span-2">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.parentResidenceAddress')}</span>
                  <input
                    ref={parentResidenceRef}
                    className="input input-bordered w-full"
                    placeholder={t('public.youthWizard.fields.parentResidenceAddress')}
                    value={draft.parentResidenceAddress}
                    onFocus={initializeParentResidenceAutocomplete}
                    onChange={(event) => setDraft((prev) => ({ ...prev, parentResidenceAddress: event.target.value }))}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.parentTaxCode')}</span>
                  <input className="input input-bordered w-full" placeholder={t('public.youthWizard.fields.parentTaxCode')} value={draft.parentTaxCode} readOnly />
                </label>
                <div className="form-control w-full">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.parentTaxCodePhoto')}</span>
                  <input className="file-input file-input-bordered w-full" type="file" accept="image/*,.pdf" onChange={(event) => setParentTaxCodeFile(event.target.files?.[0] ?? null)} />
                </div>
                <div className="form-control md:col-span-2">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.parentIdentityDocument')}</span>
                  <input className="file-input file-input-bordered w-full" type="file" accept="image/*,.pdf" onChange={(event) => setParentIdentityFile(event.target.files?.[0] ?? null)} />
                </div>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.loginAuto')}</span>
                  <input className="input input-bordered w-full" placeholder={t('public.youthWizard.fields.login')} value={draft.login} readOnly />
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('public.youthWizard.fields.password')}</span>
                  <input className="input input-bordered w-full" type="password" placeholder={t('public.youthWizard.fields.password')} value={draft.password} onChange={(event) => setDraft((prev) => ({ ...prev, password: event.target.value }))} />
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="mx-auto max-w-6xl space-y-4">
                <div className="rounded-lg border border-base-300 p-3">
                  <p className="text-sm font-medium">{t('public.youthWizard.services.fixedTitle')}</p>
                  {packageFixedServices.length === 0 ? (
                    <p className="mt-2 text-sm opacity-70">{t('public.youthWizard.services.fixedEmpty')}</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {packageFixedServices.map((service) => (
                        <div key={`fixed-${service.id}`} className="rounded border border-base-300">
                          <label className="label cursor-pointer justify-between px-3 py-2">
                            <span className="label-text">
                              {service.title} - {t('public.youthWizard.services.price', { price: formatAmount(service.price ?? 0) })}
                            </span>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-primary"
                              checked={draft.selectedFixedServiceIds.includes(service.id)}
                              onChange={(event) => toggleFixedService(service.id, event.target.checked)}
                            />
                          </label>
                          <div tabIndex={0} className="collapse collapse-arrow border-t border-base-300 bg-base-100">
                            <div className="collapse-title py-2 text-sm font-medium">{t('public.youthWizard.services.descriptionTitle')}</div>
                            <div className="collapse-content text-sm leading-relaxed">
                              {service.description?.trim() || t('public.youthWizard.services.descriptionEmpty')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-base-300 p-3">
                  <p className="text-sm font-medium">{t('public.youthWizard.services.variableTitle')}</p>
                  {packageVariableServices.length === 0 ? (
                    <p className="mt-2 text-sm opacity-70">{t('public.youthWizard.services.variableEmpty')}</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {packageVariableServices.map((service) => (
                        <div key={`variable-${service.id}`} className="rounded border border-base-300">
                          <label className="label cursor-pointer justify-between px-3 py-2">
                            <span className="label-text">{service.title}</span>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-primary"
                              checked={draft.selectedVariableServiceIds.includes(service.id)}
                              onChange={(event) => toggleVariableService(service.id, event.target.checked)}
                            />
                          </label>
                          <div tabIndex={0} className="collapse collapse-arrow border-t border-base-300 bg-base-100">
                            <div className="collapse-title py-2 text-sm font-medium">{t('public.youthWizard.services.descriptionTitle')}</div>
                            <div className="collapse-content text-sm leading-relaxed">
                              {service.description?.trim() || t('public.youthWizard.services.descriptionEmpty')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {hasScheduleStep && step === 4 && (
              <div className="mx-auto max-w-6xl space-y-4">
                <div className="rounded-lg border border-base-300 p-3">
                  <p className="text-sm font-medium">{t('public.youthWizard.schedule.title')}</p>
                  <p className="mt-1 text-xs opacity-70">{t('public.youthWizard.schedule.subtitle')}</p>
                  {schedulePreferenceGroups.length === 0 ? (
                    <p className="mt-3 text-sm opacity-70">{t('public.youthWizard.schedule.empty')}</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {schedulePreferenceGroups.map((group) => (
                        <div key={group.groupId} className="rounded border border-base-300 p-3">
                          <p className="text-sm font-semibold">{group.groupTitle}</p>
                          <div className="mt-2 space-y-2">
                            {group.options.map((option) => (
                              <label key={option.id} className="label cursor-pointer justify-start gap-3 rounded border border-base-300 px-3 py-2">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-primary checkbox-sm"
                                  checked={draft.selectedSchedulePreferenceIds.includes(option.id)}
                                  onChange={(event) => toggleSchedulePreference(option.id, event.target.checked)}
                                />
                                <span className="label-text text-sm">
                                  {t(`public.youthWizard.schedule.weekdays.${option.weekday}`)} ore {option.time}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === consentsStepId && (
              <div className="mx-auto max-w-6xl space-y-4">
                <div className="space-y-2 rounded-lg border border-base-300 p-3">
                  <label className="label cursor-pointer justify-start gap-2">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={draft.consentEnrollmentAccepted}
                      onChange={(event) => setDraft((prev) => ({ ...prev, consentEnrollmentAccepted: event.target.checked }))}
                    />
                    <span className="label-text">{t('public.youthWizard.consents.enrollmentCheck')}</span>
                  </label>
                  <div tabIndex={0} className="collapse collapse-arrow border border-base-300 bg-base-100">
                    <div className="collapse-title text-sm font-medium">{t('public.youthWizard.consents.enrollmentTextTitle')}</div>
                    <div className="collapse-content text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: company?.consentMinors || `<p>${t('public.youthWizard.consents.emptyConsentText')}</p>` }} />
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-base-300 p-3">
                  <label className="label cursor-pointer justify-start gap-2">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={draft.consentInformationAccepted}
                      onChange={(event) => setDraft((prev) => ({ ...prev, consentInformationAccepted: event.target.checked }))}
                    />
                    <span className="label-text">{t('public.youthWizard.consents.informationCheck')}</span>
                  </label>
                  <div tabIndex={0} className="collapse collapse-arrow border border-base-300 bg-base-100">
                    <div className="collapse-title text-sm font-medium">{t('public.youthWizard.consents.informationTextTitle')}</div>
                    <div className="collapse-content text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: company?.consentInformationNotice || `<p>${t('public.youthWizard.consents.emptyInformationText')}</p>` }} />
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-base-300 p-3">
                  <label className="label cursor-pointer justify-start gap-2">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={draft.consentDataProcessingAccepted}
                      onChange={(event) => setDraft((prev) => ({ ...prev, consentDataProcessingAccepted: event.target.checked }))}
                    />
                    <span className="label-text">{t('public.youthWizard.consents.dataProcessingCheck')}</span>
                  </label>
                  <div tabIndex={0} className="collapse collapse-arrow border border-base-300 bg-base-100">
                    <div className="collapse-title text-sm font-medium">{t('public.youthWizard.consents.dataProcessingTextTitle')}</div>
                    <div className="collapse-content text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: company?.consentDataProcessing || `<p>${t('public.youthWizard.consents.emptyConsentText')}</p>` }} />
                  </div>
                  <SignaturePadField
                    label={t('public.youthWizard.consents.dataProcessingSignature')}
                    value={draft.consentDataProcessingSignatureDataUrl}
                    onChange={(value) => setDraft((prev) => ({ ...prev, consentDataProcessingSignatureDataUrl: value }))}
                  />
                </div>

                <SignaturePadField
                  label={t('public.youthWizard.consents.enrollmentSignature')}
                  value={draft.enrollmentConfirmationSignatureDataUrl}
                  onChange={(value) => setDraft((prev) => ({ ...prev, enrollmentConfirmationSignatureDataUrl: value }))}
                />
              </div>
            )}

            {step === confirmStepId && (
              <div className="mx-auto max-w-6xl space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-base-300 p-4">
                    <h4 className="font-semibold">{t('public.youthWizard.summary.minorTitle')}</h4>
                    <p className="text-sm">{draft.minorFirstName} {draft.minorLastName}</p>
                    <p className="text-sm opacity-70">{t('public.youthWizard.summary.birthDate')}: {draft.minorBirthDate}</p>
                    <p className="text-sm opacity-70">{t('public.youthWizard.summary.birthPlace')}: {draft.minorBirthPlace}</p>
                    <p className="text-sm opacity-70">{t('public.youthWizard.summary.residence')}: {draft.minorResidenceAddress}</p>
                    <p className="text-sm opacity-70">{t('public.youthWizard.summary.taxCode')}: {draft.minorTaxCode}</p>
                    <p className="flex items-center gap-2 text-sm opacity-70">
                      <span>{t('public.youthWizard.summary.taxCodePhoto')}:</span>
                      {minorTaxCodeFile ? (
                        <CheckCircle2 className="h-4 w-4 text-success" aria-label={t('public.youthWizard.summary.uploaded')} />
                      ) : (
                        <span>-</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border border-base-300 p-4">
                    <h4 className="font-semibold">{t('public.youthWizard.summary.parentTitle')}</h4>
                    <p className="text-sm">{draft.parentFirstName} {draft.parentLastName}</p>
                    <p className="text-sm opacity-70">{draft.parentEmail}</p>
                    <p className="text-sm opacity-70">{t('public.youthWizard.summary.phone')}: {draft.parentPhone}</p>
                    <p className="text-sm opacity-70">{t('public.youthWizard.summary.secondaryPhone')}: {draft.parentSecondaryPhone || '-'}</p>
                    <p className="text-sm opacity-70">{t('public.youthWizard.summary.birthDate')}: {draft.parentBirthDate}</p>
                    <p className="text-sm opacity-70">{t('public.youthWizard.summary.birthPlace')}: {draft.parentBirthPlace}</p>
                    <p className="text-sm opacity-70">{t('public.youthWizard.summary.residence')}: {draft.parentResidenceAddress}</p>
                    <p className="text-sm opacity-70">{t('public.youthWizard.summary.taxCode')}: {draft.parentTaxCode}</p>
                    <p className="flex items-center gap-2 text-sm opacity-70">
                      <span>{t('public.youthWizard.summary.taxCodePhoto')}:</span>
                      {parentTaxCodeFile ? (
                        <CheckCircle2 className="h-4 w-4 text-success" aria-label={t('public.youthWizard.summary.uploaded')} />
                      ) : (
                        <span>-</span>
                      )}
                    </p>
                    <p className="flex items-center gap-2 text-sm opacity-70">
                      <span>{t('public.youthWizard.summary.identityDocument')}:</span>
                      {parentIdentityFile ? (
                        <CheckCircle2 className="h-4 w-4 text-success" aria-label={t('public.youthWizard.summary.uploaded')} />
                      ) : (
                        <span>-</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-base-300 p-4">
                  <h4 className="font-semibold">{t('public.youthWizard.summary.selectedServices')}</h4>
                  {draft.selectedFixedServiceIds.length === 0 && draft.selectedVariableServiceIds.length === 0 ? (
                    <p className="text-sm opacity-70">{t('public.youthWizard.summary.noServicesSelected')}</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {draft.selectedFixedServiceIds.map((id) => (
                        <li key={`summary-fixed-${id}`}>
                          {t('public.youthWizard.summary.fixed')}: {additionalServicesById.get(id)?.title ?? id} -{' '}
                          {t('public.youthWizard.services.price', { price: formatAmount(additionalServicesById.get(id)?.price ?? 0) })}
                        </li>
                      ))}
                      {draft.selectedVariableServiceIds.map((id) => (
                        <li key={`summary-variable-${id}`}>{t('public.youthWizard.summary.variable')}: {additionalServicesById.get(id)?.title ?? id}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {hasScheduleStep ? (
                  <div className="rounded-lg border border-base-300 p-4">
                    <h4 className="font-semibold">{t('public.youthWizard.summary.selectedSchedules')}</h4>
                    {draft.selectedSchedulePreferenceIds.length === 0 ? (
                      <p className="text-sm opacity-70">{t('public.youthWizard.summary.noSchedulesSelected')}</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {draft.selectedSchedulePreferenceIds.map((id) => {
                          const option = schedulePreferenceOptions.find((item) => item.id === id)
                          if (!option) {
                            return null
                          }
                          return (
                            <li key={`summary-schedule-${id}`}>
                              {option.groupTitle} - {t(`public.youthWizard.schedule.weekdays.${option.weekday}`)} ore {option.time}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
                <div className="rounded-lg border border-base-300 p-4">
                  <h4 className="font-semibold">{t('public.youthWizard.payment.title')}</h4>
                  {paymentMethodsForRender.length === 0 ? (
                    <p className="text-sm opacity-70">{t('public.youthWizard.payment.empty')}</p>
                  ) : (
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                      {paymentMethodsForRender.map((method) => (
                        <div key={method.code} className="rounded border border-base-300">
                          <label className="label min-h-14 cursor-pointer justify-between px-3 py-2">
                            <span className="label-text">
                              <span className="block font-medium">
                                {t(`utility.paymentMethods.methods.${method.code}.label`)}
                              </span>
                            </span>
                            <input
                              type="radio"
                              name="payment-method"
                              className="radio radio-primary radio-sm"
                              checked={draft.selectedPaymentMethodCode === method.code}
                              onChange={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  selectedPaymentMethodCode: method.code,
                                }))
                              }
                            />
                          </label>
                          <div
                            className={`collapse collapse-arrow border-t border-base-300 bg-base-100 ${
                              openPaymentDescriptionCode === method.code ? 'collapse-open' : ''
                            }`}
                          >
                            <button
                              type="button"
                              className="collapse-title py-2 text-left text-sm font-medium"
                              onClick={() =>
                                setOpenPaymentDescriptionCode((prev) => (prev === method.code ? null : method.code))
                              }
                            >
                              {t('utility.paymentMethods.methodDescriptionTitle')}
                            </button>
                            <div className="collapse-content text-sm leading-relaxed">
                              {t(`utility.paymentMethods.methods.${method.code}.help`)}
                              {method.code === 'bank_transfer' && method.details ? (
                                <p className="mt-1 text-xs opacity-70">
                                  {t('public.youthWizard.payment.iban')}: {method.details}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-base-300 p-4">
                  <p className="text-sm opacity-80">{t('public.youthWizard.summary.packageCost')}: {formatAmount(packageCost)}</p>
                  <p className="text-sm opacity-80">{t('public.youthWizard.summary.enrollmentCost')}: {formatAmount(enrollmentCost)}</p>
                  <p className="text-sm opacity-80">
                    {t('public.youthWizard.summary.additionalServicesTotal')}: {formatAmount(selectedAdditionalServicesTotal)}
                  </p>
                  <p className="mt-3 rounded bg-primary/15 px-3 py-2 text-base font-semibold text-primary">
                    {t('public.youthWizard.summary.grandTotal')}: {formatAmount(orderGrandTotal)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-base-300 p-4">
            {error ? <p className="mb-3 rounded-lg bg-error/15 px-3 py-2 text-sm text-error">{error}</p> : null}
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={previousStep}
                disabled={step === (activeStepIds[0] ?? 1) || isSubmitting}
              >
                {t('public.common.back')}
              </button>
              {step !== (activeStepIds[activeStepIds.length - 1] ?? confirmStepId) ? (
                <button type="button" className="btn btn-primary" onClick={nextStep}>
                  {t('public.common.continue')}
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={isSubmitting}>
                  {isSubmitting ? t('public.youthWizard.submitting') : t('public.youthWizard.submit')}
                </button>
              )}
            </div>
          </div>
            </>
          )}
    </div>
  )
}

export default PublicEnrollmentForm
