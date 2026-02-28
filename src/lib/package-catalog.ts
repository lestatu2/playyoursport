import mockPackages from '../data/mock-packages.json'

const PACKAGE_CATALOG_KEY = 'pys_package_catalog'
const PACKAGE_CATALOG_CHANGED_EVENT = 'pys-package-catalog-changed'

export type AudienceCode = 'adult' | 'youth'
export type PackageDurationType = 'single-event' | 'period'
export type PackagePaymentFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type PackageGroupSchedule = {
  id: string
  weekday: number
  time: string
}
export type PackageGroup = {
  id: string
  title: string
  birthYearMin: number
  birthYearMax: number
  fieldId: string
  schedules: PackageGroupSchedule[]
}
export type PackageGalleryImage = {
  id: string
  src: string
  caption: string
}

export type PackageCategory = {
  id: string
  kind: 'sport'
  code: string
  label: string
  icon: string
  isActive: boolean
  sortOrder: number
}

export type Company = {
  id: string
  title: string
  headquartersAddress: string
  googlePlaceId: string
  vatNumber: string
  iban: string
  paypalEnabled: boolean
  paypalClientId: string
  email: string
  consentMinors: string
  consentAdults: string
  consentInformationNotice: string
  consentDataProcessing: string
}

export type SportField = {
  id: string
  title: string
  categoryId: string
  description: string
}

export type EnrollmentType = {
  id: string
  title: string
  description: string
}

export type WhatsAppAvailabilitySlot = {
  id: string
  weekday: number
  startTime: string
  endTime: string
}

export type WhatsAppButtonStyle = {
  label: string
  backgroundColor: string
  textColor: string
}

export type WhatsAppAccount = {
  id: string
  title: string
  phoneNumber: string
  avatarUrl: string
  isActive: boolean
  alwaysAvailable: boolean
  availabilitySlots: WhatsAppAvailabilitySlot[]
  offlineMessage: string
  buttonStyle: WhatsAppButtonStyle
}

export type AdditionalServiceType = 'fixed' | 'variable'

export type AdditionalService = {
  id: string
  title: string
  type: AdditionalServiceType
  price: number | null
  isActive: boolean
  description: string
}

export type PackageAdditionalServiceSelection = {
  serviceId: string
  isActive: boolean
}

export type SportPackage = {
  id: string
  categoryId: string
  companyId: string
  enrollmentId: string
  enrollmentPrice: number
  trainerIds: number[]
  whatsappAccountIds: string[]
  additionalFixedServices: PackageAdditionalServiceSelection[]
  additionalVariableServices: PackageAdditionalServiceSelection[]
  audience: AudienceCode
  name: string
  description: string
  ageMin: number
  ageMax: number
  durationType: PackageDurationType
  eventDate: string
  eventTime: string
  periodStartDate: string
  periodEndDate: string
  gallery: PackageGalleryImage[]
  groups: PackageGroup[]
  recurringPaymentEnabled: boolean
  paymentFrequency: PackagePaymentFrequency
  priceAmount: number
  monthlyDueDay: number | null
  monthlyNextCycleOpenDay: number | null
  weeklyDueWeekday: number | null
  firstPaymentOnSite: boolean
  trainingAddress: string
  entriesCount: number | null
  userSelectableSchedule: boolean
  featuredImage: string
  isFeatured: boolean
  isDescriptive: boolean
  status: 'draft' | 'published' | 'archived'
}

type MockPackageCatalog = {
  sportCategories: PackageCategory[]
  fields: SportField[]
  enrollments: EnrollmentType[]
  whatsappAccounts: WhatsAppAccount[]
  additionalServices: AdditionalService[]
  companies: Company[]
  packages: SportPackage[]
}

type StoredPackageCatalog = Partial<{
  sportCategories: PackageCategory[]
  fields: SportField[]
  enrollments: EnrollmentType[]
  whatsappAccounts: WhatsAppAccount[]
  additionalServices: AdditionalService[]
  companies: Company[]
  packages: SportPackage[]
}>

export type SaveCategoryPayload = {
  code: string
  label: string
  icon: string
  isActive: boolean
}

export type SaveCategoryResult =
  | { ok: true; category: PackageCategory }
  | { ok: false; error: 'invalid' | 'duplicateCode' | 'notFound' | 'categoryInUse' }

export type SaveFieldPayload = {
  title: string
  categoryId: string
  description: string
}

export type SaveFieldResult =
  | { ok: true; field: SportField }
  | { ok: false; error: 'invalid' | 'categoryNotFound' | 'notFound' | 'fieldInUse' }

export type SaveEnrollmentPayload = {
  title: string
  description: string
}

export type SaveEnrollmentResult =
  | { ok: true; enrollment: EnrollmentType }
  | { ok: false; error: 'invalid' | 'notFound' }

export type SaveWhatsAppAccountPayload = {
  title: string
  phoneNumber: string
  avatarUrl: string
  isActive: boolean
  alwaysAvailable: boolean
  availabilitySlots: WhatsAppAvailabilitySlot[]
  offlineMessage: string
  buttonStyle: WhatsAppButtonStyle
}

export type SaveWhatsAppAccountResult =
  | { ok: true; account: WhatsAppAccount }
  | { ok: false; error: 'invalid' | 'notFound' }

export type SaveAdditionalServicePayload = {
  title: string
  type: AdditionalServiceType
  price: number | null
  isActive: boolean
  description: string
}

export type SaveAdditionalServiceResult =
  | { ok: true; service: AdditionalService }
  | { ok: false; error: 'invalid' | 'notFound' }

export type SaveCompanyPayload = {
  title: string
  headquartersAddress: string
  googlePlaceId: string
  vatNumber: string
  iban: string
  paypalEnabled: boolean
  paypalClientId: string
  email: string
  consentMinors: string
  consentAdults: string
  consentInformationNotice: string
  consentDataProcessing: string
}

export type SaveCompanyResult =
  | { ok: true; item: Company }
  | { ok: false; error: 'invalid' | 'invalidIban' | 'invalidEmail' | 'paypalClientIdRequired' }

export type UpdateCompanyResult =
  | { ok: true; item: Company }
  | {
      ok: false
      error: 'invalid' | 'invalidIban' | 'invalidEmail' | 'paypalClientIdRequired' | 'notFound'
    }

export type RemoveCompanyResult =
  | { ok: true; item: Company }
  | { ok: false; error: 'notFound' | 'companyInUse' }

export type SavePackagePayload = {
  name: string
  description: string
  categoryId: string
  companyId: string
  enrollmentId: string
  enrollmentPrice: number
  trainerIds: number[]
  whatsappAccountIds: string[]
  additionalFixedServices: PackageAdditionalServiceSelection[]
  additionalVariableServices: PackageAdditionalServiceSelection[]
  audience: AudienceCode
  ageMin: number
  ageMax: number
  durationType: PackageDurationType
  eventDate: string
  eventTime: string
  periodStartDate: string
  periodEndDate: string
  gallery: PackageGalleryImage[]
  groups: PackageGroup[]
  recurringPaymentEnabled: boolean
  paymentFrequency: PackagePaymentFrequency
  priceAmount: number
  monthlyDueDay: number | null
  monthlyNextCycleOpenDay: number | null
  weeklyDueWeekday: number | null
  firstPaymentOnSite: boolean
  trainingAddress: string
  entriesCount: number | null
  userSelectableSchedule: boolean
  featuredImage: string
  isFeatured: boolean
  isDescriptive: boolean
}

export type SavePackageResult =
  | { ok: true; item: SportPackage }
  | {
      ok: false
      error:
        | 'invalid'
        | 'invalidAgeRange'
        | 'invalidDuration'
        | 'invalidPayment'
        | 'invalidEnrollment'
        | 'invalidWhatsAppAccounts'
        | 'invalidAdditionalServices'
        | 'invalidGroups'
        | 'categoryNotFound'
        | 'companyNotFound'
    }

export type UpdatePackageResult =
  | { ok: true; item: SportPackage }
  | {
      ok: false
      error:
        | 'invalid'
        | 'invalidAgeRange'
        | 'invalidDuration'
        | 'invalidPayment'
        | 'invalidEnrollment'
        | 'invalidWhatsAppAccounts'
        | 'invalidAdditionalServices'
        | 'invalidGroups'
        | 'categoryNotFound'
        | 'companyNotFound'
        | 'notFound'
    }

export type RemovePackageResult = { ok: true; item: SportPackage } | { ok: false; error: 'notFound' }

const packageDefaults = mockPackages as MockPackageCatalog

const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29,
  BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28, EE: 20, EG: 29,
  ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28,
  HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20,
  LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19,
  MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29,
  RO: 24, RS: 22, SA: 24, SC: 31, SD: 18, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25,
  SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
}

function emitPackageCatalogChanged(): void {
  window.dispatchEvent(new Event(PACKAGE_CATALOG_CHANGED_EVENT))
}

function readStoredCatalog(): StoredPackageCatalog {
  try {
    const raw = localStorage.getItem(PACKAGE_CATALOG_KEY)
    return raw ? (JSON.parse(raw) as StoredPackageCatalog) : {}
  } catch {
    return {}
  }
}

function writeStoredCatalog(value: {
  sportCategories: PackageCategory[]
  fields: SportField[]
  enrollments: EnrollmentType[]
  whatsappAccounts: WhatsAppAccount[]
  additionalServices: AdditionalService[]
  companies: Company[]
  packages: SportPackage[]
}): void {
  localStorage.setItem(PACKAGE_CATALOG_KEY, JSON.stringify(value))
  emitPackageCatalogChanged()
}

function getStoredCatalog(): {
  sportCategories: PackageCategory[]
  fields: SportField[]
  enrollments: EnrollmentType[]
  whatsappAccounts: WhatsAppAccount[]
  additionalServices: AdditionalService[]
  companies: Company[]
  packages: SportPackage[]
} {
  const stored = readStoredCatalog()
  const baseCategories = stored.sportCategories ?? packageDefaults.sportCategories
  const baseFields = stored.fields ?? packageDefaults.fields ?? []
  const baseEnrollments = stored.enrollments ?? packageDefaults.enrollments ?? []
  const baseWhatsAppAccounts = stored.whatsappAccounts ?? packageDefaults.whatsappAccounts ?? []
  const baseAdditionalServices = stored.additionalServices ?? packageDefaults.additionalServices ?? []
  const baseCompanies = stored.companies ?? packageDefaults.companies ?? []
  const basePackages = stored.packages ?? packageDefaults.packages

  return {
    sportCategories: baseCategories.map((category) => ({
      ...category,
      icon: category.icon ?? '',
    })),
    fields: baseFields.map((field) => ({
      ...field,
      title: field.title ?? '',
      description: field.description ?? '',
      categoryId: field.categoryId ?? '',
    })),
    enrollments: baseEnrollments.map((enrollment) => ({
      ...enrollment,
      title: enrollment.title ?? '',
      description: enrollment.description ?? '',
    })),
    whatsappAccounts: baseWhatsAppAccounts.map((account) => ({
      id: account.id,
      title: account.title ?? '',
      phoneNumber: account.phoneNumber ?? '',
      avatarUrl: account.avatarUrl ?? '',
      isActive: account.isActive ?? true,
      alwaysAvailable: account.alwaysAvailable ?? true,
      availabilitySlots: normalizeWhatsAppAvailabilitySlots(account.availabilitySlots),
      offlineMessage: account.offlineMessage ?? '',
      buttonStyle: normalizeWhatsAppButtonStyle(account.buttonStyle),
    })),
    additionalServices: baseAdditionalServices.map((service) => ({
      ...service,
      title: service.title ?? '',
      type: service.type === 'variable' ? 'variable' : 'fixed',
      price:
        service.type === 'variable'
          ? null
          : Number.isFinite(service.price)
            ? Number(service.price)
            : 0,
      isActive: service.isActive ?? true,
      description: service.description ?? '',
    })),
    companies: baseCompanies.map((company) => ({
      ...company,
      headquartersAddress: company.headquartersAddress ?? '',
      googlePlaceId: company.googlePlaceId ?? '',
      vatNumber: company.vatNumber ?? '',
      iban: company.iban ?? '',
      paypalEnabled: company.paypalEnabled ?? false,
      paypalClientId: company.paypalClientId ?? '',
      email: company.email ?? '',
      consentMinors: company.consentMinors ?? '',
      consentAdults: company.consentAdults ?? '',
      consentInformationNotice: company.consentInformationNotice ?? '',
      consentDataProcessing: company.consentDataProcessing ?? '',
    })),
    packages: basePackages.map((item) => ({
      ...defaultAgeRangeByAudience(item.audience),
      ...normalizePackageDuration({
        durationType: item.durationType ?? 'single-event',
        eventDate: item.eventDate ?? '',
        eventTime: item.eventTime ?? '',
        periodStartDate: item.periodStartDate ?? '',
        periodEndDate: item.periodEndDate ?? '',
      }),
      ...normalizePackagePayment({
        recurringPaymentEnabled: item.recurringPaymentEnabled ?? false,
        paymentFrequency: item.paymentFrequency ?? 'monthly',
        priceAmount: item.priceAmount ?? 0,
        monthlyDueDay: item.monthlyDueDay ?? null,
        monthlyNextCycleOpenDay: item.monthlyNextCycleOpenDay ?? null,
        weeklyDueWeekday: item.weeklyDueWeekday ?? null,
        firstPaymentOnSite: item.firstPaymentOnSite ?? false,
      }),
      ...normalizePackageEntries({
        recurringPaymentEnabled: item.recurringPaymentEnabled ?? false,
        paymentFrequency: item.paymentFrequency ?? 'monthly',
        entriesCount: item.entriesCount ?? null,
      }),
      ...item,
      gallery: normalizePackageGallery(item.gallery),
      groups: normalizePackageGroups(item.groups),
      description: item.description ?? '',
      featuredImage: item.featuredImage ?? '',
      companyId: item.companyId ?? '',
      enrollmentId: item.enrollmentId ?? '',
      enrollmentPrice: Number.isFinite(item.enrollmentPrice) ? Number(item.enrollmentPrice) : 0,
      trainerIds: normalizePackageTrainers(item.trainerIds),
      whatsappAccountIds: normalizePackageWhatsAppAccountIds(item.whatsappAccountIds),
      additionalFixedServices: normalizePackageAdditionalServices(
        (item as { additionalFixedServices?: unknown }).additionalFixedServices ??
          (item as { additionalFixedServiceIds?: unknown }).additionalFixedServiceIds,
      ),
      additionalVariableServices: normalizePackageAdditionalServices(
        (item as { additionalVariableServices?: unknown }).additionalVariableServices ??
          (item as { additionalVariableServiceIds?: unknown }).additionalVariableServiceIds,
      ),
      ageMin: item.ageMin ?? defaultAgeRangeByAudience(item.audience).ageMin,
      ageMax: item.ageMax ?? defaultAgeRangeByAudience(item.audience).ageMax,
      isFeatured: item.isFeatured ?? false,
      isDescriptive: item.isDescriptive ?? false,
      trainingAddress: item.trainingAddress ?? '',
      entriesCount:
        item.entriesCount ??
        (item.recurringPaymentEnabled && item.paymentFrequency === 'daily' ? null : 1),
      userSelectableSchedule: item.userSelectableSchedule ?? false,
    })),
  }
}

function normalizeCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase()
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function normalizePhoneNumber(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  const startsWithPlus = trimmed.startsWith('+')
  const digitsOnly = trimmed.replace(/\D/g, '')
  return startsWithPlus ? `+${digitsOnly}` : digitsOnly
}

function isValidPhoneNumber(value: string): boolean {
  return /^\+?\d{7,15}$/.test(value)
}

function normalizeWhatsAppAvailabilitySlots(value: unknown): WhatsAppAvailabilitySlot[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item): WhatsAppAvailabilitySlot | null => {
      if (!item || typeof item !== 'object') {
        return null
      }
      const weekday = Number((item as { weekday?: unknown }).weekday)
      const startTime =
        typeof (item as { startTime?: unknown }).startTime === 'string'
          ? (item as { startTime: string }).startTime.trim()
          : ''
      const endTime =
        typeof (item as { endTime?: unknown }).endTime === 'string'
          ? (item as { endTime: string }).endTime.trim()
          : ''
      const id =
        typeof (item as { id?: unknown }).id === 'string' && (item as { id: string }).id.trim()
          ? (item as { id: string }).id.trim()
          : `wa-slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

      return {
        id,
        weekday: Number.isInteger(weekday) ? weekday : 1,
        startTime,
        endTime,
      }
    })
    .filter((slot): slot is WhatsAppAvailabilitySlot => Boolean(slot))
}

function normalizeWhatsAppButtonStyle(value: unknown): WhatsAppButtonStyle {
  const source = value && typeof value === 'object' ? (value as Partial<WhatsAppButtonStyle>) : {}
  return {
    label: typeof source.label === 'string' && source.label.trim() ? source.label.trim() : 'WhatsApp',
    backgroundColor:
      typeof source.backgroundColor === 'string' && source.backgroundColor.trim()
        ? source.backgroundColor.trim()
        : '#25D366',
    textColor:
      typeof source.textColor === 'string' && source.textColor.trim()
        ? source.textColor.trim()
        : '#ffffff',
  }
}

function isValidWhatsAppAvailabilitySlot(slot: WhatsAppAvailabilitySlot): boolean {
  return (
    Number.isInteger(slot.weekday) &&
    slot.weekday >= 0 &&
    slot.weekday <= 6 &&
    /^\d{2}:\d{2}$/.test(slot.startTime) &&
    /^\d{2}:\d{2}$/.test(slot.endTime) &&
    slot.startTime < slot.endTime
  )
}

function isValidIban(value: string): boolean {
  const iban = normalizeIban(value)
  if (!/^[A-Z]{2}[0-9A-Z]+$/.test(iban)) {
    return false
  }
  const country = iban.slice(0, 2)
  const expected = IBAN_LENGTHS[country]
  if (!expected || iban.length !== expected) {
    return false
  }
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`
  let remainder = 0
  for (const char of rearranged) {
    const expanded = /\d/.test(char) ? char : (char.charCodeAt(0) - 55).toString()
    for (const digit of expanded) {
      remainder = (remainder * 10 + Number(digit)) % 97
    }
  }
  return remainder === 1
}

function nextCategoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sport-${crypto.randomUUID()}`
  }
  return `sport-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nextCompanyId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `company-${crypto.randomUUID()}`
  }
  return `company-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nextFieldId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `field-${crypto.randomUUID()}`
  }
  return `field-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nextEnrollmentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `enrollment-${crypto.randomUUID()}`
  }
  return `enrollment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nextWhatsAppAccountId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `wa-${crypto.randomUUID()}`
  }
  return `wa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nextAdditionalServiceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `service-${crypto.randomUUID()}`
  }
  return `service-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nextPackageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `pkg-${crypto.randomUUID()}`
  }
  return `pkg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nextPackageGalleryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `gallery-${crypto.randomUUID()}`
  }
  return `gallery-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nextPackageGroupId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `group-${crypto.randomUUID()}`
  }
  return `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nextPackageGroupScheduleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `group-schedule-${crypto.randomUUID()}`
  }
  return `group-schedule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function defaultAgeRangeByAudience(audience: AudienceCode): { ageMin: number; ageMax: number } {
  if (audience === 'youth') {
    return { ageMin: 6, ageMax: 17 }
  }
  return { ageMin: 18, ageMax: 99 }
}

function isValidAgeRange(ageMin: number, ageMax: number): boolean {
  return Number.isInteger(ageMin) && Number.isInteger(ageMax) && ageMin >= 0 && ageMax >= ageMin && ageMax <= 120
}

function normalizePackageDuration(
  input: Pick<SportPackage, 'durationType' | 'eventDate' | 'eventTime' | 'periodStartDate' | 'periodEndDate'>,
): Pick<SportPackage, 'durationType' | 'eventDate' | 'eventTime' | 'periodStartDate' | 'periodEndDate'> {
  const durationType: PackageDurationType = input.durationType === 'period' ? 'period' : 'single-event'
  const eventDate = (input.eventDate ?? '').trim()
  const eventTime = (input.eventTime ?? '').trim()
  const periodStartDate = (input.periodStartDate ?? '').trim()
  const periodEndDate = (input.periodEndDate ?? '').trim()
  if (durationType === 'single-event') {
    return { durationType, eventDate, eventTime, periodStartDate: '', periodEndDate: '' }
  }
  return { durationType, eventDate: '', eventTime: '', periodStartDate, periodEndDate }
}

function isValidPackageDuration(
  input: Pick<SavePackagePayload, 'durationType' | 'eventDate' | 'eventTime' | 'periodStartDate' | 'periodEndDate'>,
): boolean {
  const normalized = normalizePackageDuration(input)
  if (normalized.durationType === 'single-event') {
    return Boolean(normalized.eventDate && normalized.eventTime)
  }
  return Boolean(
    normalized.periodStartDate &&
      normalized.periodEndDate &&
      normalized.periodStartDate <= normalized.periodEndDate,
  )
}

function normalizePackagePayment(
  input: Pick<
    SavePackagePayload,
    | 'recurringPaymentEnabled'
    | 'paymentFrequency'
    | 'priceAmount'
    | 'monthlyDueDay'
    | 'monthlyNextCycleOpenDay'
    | 'weeklyDueWeekday'
    | 'firstPaymentOnSite'
  >,
): Pick<
  SavePackagePayload,
  | 'recurringPaymentEnabled'
  | 'paymentFrequency'
  | 'priceAmount'
  | 'monthlyDueDay'
  | 'monthlyNextCycleOpenDay'
  | 'weeklyDueWeekday'
  | 'firstPaymentOnSite'
> {
  const recurringPaymentEnabled = Boolean(input.recurringPaymentEnabled)
  const allowedFrequencies: PackagePaymentFrequency[] = ['daily', 'weekly', 'monthly', 'yearly']
  const paymentFrequency: PackagePaymentFrequency = allowedFrequencies.includes(input.paymentFrequency)
    ? input.paymentFrequency
    : 'monthly'
  const priceAmount = Number.isFinite(input.priceAmount) ? Number(input.priceAmount) : NaN
  const monthlyDueDay = Number.isInteger(input.monthlyDueDay) ? Number(input.monthlyDueDay) : null
  const monthlyNextCycleOpenDay = Number.isInteger(input.monthlyNextCycleOpenDay)
    ? Number(input.monthlyNextCycleOpenDay)
    : null
  const weeklyDueWeekday = Number.isInteger(input.weeklyDueWeekday) ? Number(input.weeklyDueWeekday) : null
  const firstPaymentOnSite = Boolean(input.firstPaymentOnSite)

  if (!recurringPaymentEnabled) {
    return {
      recurringPaymentEnabled,
      paymentFrequency,
      priceAmount,
      monthlyDueDay: null,
      monthlyNextCycleOpenDay: null,
      weeklyDueWeekday: null,
      firstPaymentOnSite,
    }
  }

  return {
    recurringPaymentEnabled,
    paymentFrequency,
    priceAmount,
    monthlyDueDay: paymentFrequency === 'monthly' ? monthlyDueDay : null,
    monthlyNextCycleOpenDay: paymentFrequency === 'monthly' ? monthlyNextCycleOpenDay : null,
    weeklyDueWeekday: paymentFrequency === 'weekly' ? weeklyDueWeekday : null,
    firstPaymentOnSite,
  }
}

function isValidPackagePayment(
  input: Pick<
    SavePackagePayload,
    | 'recurringPaymentEnabled'
    | 'paymentFrequency'
    | 'priceAmount'
    | 'monthlyDueDay'
    | 'monthlyNextCycleOpenDay'
    | 'weeklyDueWeekday'
    | 'firstPaymentOnSite'
  >,
): boolean {
  const payment = normalizePackagePayment(input)
  if (!Number.isFinite(payment.priceAmount) || payment.priceAmount < 0) {
    return false
  }
  if (!payment.recurringPaymentEnabled) {
    return true
  }
  if (payment.paymentFrequency === 'monthly') {
    return (
      payment.monthlyDueDay !== null &&
      payment.monthlyDueDay >= 1 &&
      payment.monthlyDueDay <= 31 &&
      payment.monthlyNextCycleOpenDay !== null &&
      payment.monthlyNextCycleOpenDay >= 1 &&
      payment.monthlyNextCycleOpenDay <= 31
    )
  }
  if (payment.paymentFrequency === 'weekly') {
    return payment.weeklyDueWeekday !== null && payment.weeklyDueWeekday >= 0 && payment.weeklyDueWeekday <= 6
  }
  return true
}

function normalizePackageEntries(
  input: Pick<SavePackagePayload, 'recurringPaymentEnabled' | 'paymentFrequency' | 'entriesCount'>,
): Pick<SavePackagePayload, 'entriesCount'> {
  const entriesCount = Number.isFinite(input.entriesCount) ? Math.trunc(Number(input.entriesCount)) : null
  if (input.recurringPaymentEnabled && input.paymentFrequency === 'daily') {
    return { entriesCount: null }
  }
  return { entriesCount }
}

function isValidPackageEntries(
  input: Pick<SavePackagePayload, 'recurringPaymentEnabled' | 'paymentFrequency' | 'entriesCount'>,
): boolean {
  const normalized = normalizePackageEntries(input)
  if (normalized.entriesCount === null) {
    return input.recurringPaymentEnabled && input.paymentFrequency === 'daily'
  }
  if (!Number.isInteger(normalized.entriesCount) || normalized.entriesCount <= 0) {
    return false
  }
  if (!input.recurringPaymentEnabled) {
    return true
  }
  if (input.paymentFrequency === 'weekly') {
    return normalized.entriesCount <= 7
  }
  if (input.paymentFrequency === 'monthly') {
    return normalized.entriesCount <= 31
  }
  if (input.paymentFrequency === 'yearly') {
    return normalized.entriesCount <= 365
  }
  return false
}

function isValidPackageEnrollment(
  input: Pick<SavePackagePayload, 'enrollmentId' | 'enrollmentPrice'>,
  enrollments: EnrollmentType[],
): boolean {
  if (!input.enrollmentId.trim()) {
    return enrollments.length === 0
  }
  const exists = enrollments.some((item) => item.id === input.enrollmentId)
  return exists && Number.isFinite(input.enrollmentPrice) && input.enrollmentPrice >= 0
}

function normalizePackageTrainers(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return []
  }
  const ids = value
    .map((item) => Number(item))
    .filter((id) => Number.isInteger(id) && id > 0)
    .map((id) => Math.trunc(id))
  return Array.from(new Set(ids))
}

function normalizePackageWhatsAppAccountIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const ids = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((id) => id.length > 0)
  return Array.from(new Set(ids))
}

function normalizePackageAdditionalServices(value: unknown): PackageAdditionalServiceSelection[] {
  if (!Array.isArray(value)) {
    return []
  }

  const rawSelections = value
    .map((item): PackageAdditionalServiceSelection | null => {
      if (typeof item === 'string') {
        const serviceId = item.trim()
        return serviceId ? { serviceId, isActive: true } : null
      }
      if (!item || typeof item !== 'object') {
        return null
      }
      const serviceId =
        typeof (item as { serviceId?: unknown }).serviceId === 'string'
          ? (item as { serviceId: string }).serviceId.trim()
          : ''
      if (!serviceId) {
        return null
      }
      const isActive =
        typeof (item as { isActive?: unknown }).isActive === 'boolean'
          ? (item as { isActive: boolean }).isActive
          : true
      return { serviceId, isActive }
    })
    .filter((selection): selection is PackageAdditionalServiceSelection => Boolean(selection))

  const deduplicated = new Map<string, PackageAdditionalServiceSelection>()
  rawSelections.forEach((selection) => {
    deduplicated.set(selection.serviceId, selection)
  })
  return Array.from(deduplicated.values())
}

function isValidPackageAdditionalServices(
  input: Pick<SavePackagePayload, 'additionalFixedServices' | 'additionalVariableServices'>,
  additionalServices: AdditionalService[],
): boolean {
  const fixedSelections = normalizePackageAdditionalServices(input.additionalFixedServices)
  const variableSelections = normalizePackageAdditionalServices(input.additionalVariableServices)
  const additionalServiceById = new Map(additionalServices.map((service) => [service.id, service]))
  const fixedIds = fixedSelections.map((selection) => selection.serviceId)
  const variableIds = variableSelections.map((selection) => selection.serviceId)

  if (fixedIds.some((id) => variableIds.includes(id))) {
    return false
  }
  if (!fixedIds.every((id) => additionalServiceById.get(id)?.type === 'fixed')) {
    return false
  }
  return variableIds.every((id) => additionalServiceById.get(id)?.type === 'variable')
}

function isValidPackageWhatsAppAccounts(
  input: Pick<SavePackagePayload, 'whatsappAccountIds'>,
  whatsappAccounts: WhatsAppAccount[],
): boolean {
  const ids = normalizePackageWhatsAppAccountIds(input.whatsappAccountIds)
  const accountIds = new Set(whatsappAccounts.map((account) => account.id))
  return ids.every((id) => accountIds.has(id))
}

function normalizePackageGallery(value: unknown): PackageGalleryImage[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item): PackageGalleryImage | null => {
      if (!item || typeof item !== 'object') {
        return null
      }
      const src = typeof (item as { src?: unknown }).src === 'string' ? (item as { src: string }).src.trim() : ''
      if (!src) {
        return null
      }
      const caption =
        typeof (item as { caption?: unknown }).caption === 'string'
          ? (item as { caption: string }).caption.trim()
          : ''
      const id =
        typeof (item as { id?: unknown }).id === 'string' && (item as { id: string }).id.trim()
          ? (item as { id: string }).id.trim()
          : nextPackageGalleryId()
      return { id, src, caption }
    })
    .filter((item): item is PackageGalleryImage => Boolean(item))
}

function normalizePackageGroups(value: unknown): PackageGroup[] {
  if (!Array.isArray(value)) {
    return []
  }
  const currentYear = new Date().getFullYear()
  return value
    .map((item): PackageGroup | null => {
      if (!item || typeof item !== 'object') {
        return null
      }
      const title =
        typeof (item as { title?: unknown }).title === 'string'
          ? (item as { title: string }).title.trim()
          : ''
      const birthYearMinRaw = Number((item as { birthYearMin?: unknown }).birthYearMin)
      const birthYearMaxRaw = Number((item as { birthYearMax?: unknown }).birthYearMax)
      const legacyAgeMin = Number((item as { ageMin?: unknown }).ageMin)
      const legacyAgeMax = Number((item as { ageMax?: unknown }).ageMax)
      const schedulesRaw = (item as { schedules?: unknown }).schedules
      const schedules: PackageGroupSchedule[] = Array.isArray(schedulesRaw)
        ? schedulesRaw
            .map((schedule): PackageGroupSchedule | null => {
              if (!schedule || typeof schedule !== 'object') {
                return null
              }
              const weekday = Number((schedule as { weekday?: unknown }).weekday)
              const time =
                typeof (schedule as { time?: unknown }).time === 'string'
                  ? (schedule as { time: string }).time.trim()
                  : ''
              const scheduleId =
                typeof (schedule as { id?: unknown }).id === 'string' && (schedule as { id: string }).id.trim()
                  ? (schedule as { id: string }).id.trim()
                  : nextPackageGroupScheduleId()
              return {
                id: scheduleId,
                weekday: Number.isFinite(weekday) ? Math.trunc(weekday) : 1,
                time,
              }
            })
            .filter((schedule): schedule is PackageGroupSchedule => Boolean(schedule))
        : []
      const legacyWeekday = Number((item as { weekday?: unknown }).weekday)
      const legacyTime =
        typeof (item as { time?: unknown }).time === 'string'
          ? (item as { time: string }).time.trim()
          : ''
      const id =
        typeof (item as { id?: unknown }).id === 'string' && (item as { id: string }).id.trim()
          ? (item as { id: string }).id.trim()
          : nextPackageGroupId()
      const fieldId =
        typeof (item as { fieldId?: unknown }).fieldId === 'string'
          ? (item as { fieldId: string }).fieldId.trim()
          : ''
      const normalizedSchedules =
        schedules.length > 0
          ? schedules
          : [
              {
                id: nextPackageGroupScheduleId(),
                weekday: Number.isFinite(legacyWeekday) ? Math.trunc(legacyWeekday) : 1,
                time: legacyTime,
              },
            ]
      let birthYearMin = Number.isFinite(birthYearMinRaw) ? Math.trunc(birthYearMinRaw) : NaN
      let birthYearMax = Number.isFinite(birthYearMaxRaw) ? Math.trunc(birthYearMaxRaw) : NaN
      if (!Number.isFinite(birthYearMin) || !Number.isFinite(birthYearMax)) {
        if (Number.isFinite(legacyAgeMin) && Number.isFinite(legacyAgeMax)) {
          birthYearMin = currentYear - Math.trunc(legacyAgeMax)
          birthYearMax = currentYear - Math.trunc(legacyAgeMin)
        }
      }
      return {
        id,
        title,
        birthYearMin: Number.isFinite(birthYearMin) ? birthYearMin : currentYear - 12,
        birthYearMax: Number.isFinite(birthYearMax) ? birthYearMax : currentYear - 12,
        fieldId,
        schedules: normalizedSchedules,
      }
    })
    .filter((item): item is PackageGroup => Boolean(item))
}

function isValidPackageGroups(groups: PackageGroup[], fields: SportField[], packageCategoryId: string): boolean {
  return groups.every((group) => {
    const field = fields.find((item) => item.id === group.fieldId)
    return (
      Boolean(group.title.trim()) &&
      Boolean(group.fieldId) &&
      Boolean(field) &&
      field?.categoryId === packageCategoryId &&
      Number.isInteger(group.birthYearMin) &&
      Number.isInteger(group.birthYearMax) &&
      group.birthYearMin >= 1900 &&
      group.birthYearMax >= group.birthYearMin &&
      group.birthYearMax <= 2100 &&
      group.schedules.length > 0 &&
      group.schedules.every(
        (schedule) =>
          Number.isInteger(schedule.weekday) &&
          schedule.weekday >= 0 &&
          schedule.weekday <= 6 &&
          /^\d{2}:\d{2}$/.test(schedule.time),
      )
    )
  })
}

export function getPackageCatalogChangedEventName(): string {
  return PACKAGE_CATALOG_CHANGED_EVENT
}

export function getSportCategories(): PackageCategory[] {
  return [...getStoredCatalog().sportCategories].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getFields(): SportField[] {
  return getStoredCatalog().fields
}

export function getCompanies(): Company[] {
  return getStoredCatalog().companies
}

export function getEnrollments(): EnrollmentType[] {
  return getStoredCatalog().enrollments
}

export function getWhatsAppAccounts(): WhatsAppAccount[] {
  return getStoredCatalog().whatsappAccounts
}

export function getAdditionalServices(): AdditionalService[] {
  return getStoredCatalog().additionalServices
}

export function getPackages(): SportPackage[] {
  return getStoredCatalog().packages
}

export function createSportCategory(payload: SaveCategoryPayload): SaveCategoryResult {
  const normalizedCode = normalizeCode(payload.code)
  const label = payload.label.trim()
  const icon = payload.icon.trim()
  if (!normalizedCode || !label) {
    return { ok: false, error: 'invalid' }
  }

  const catalog = getStoredCatalog()
  const hasDuplicate = catalog.sportCategories.some((category) => category.code === normalizedCode)
  if (hasDuplicate) {
    return { ok: false, error: 'duplicateCode' }
  }

  const nextSortOrder = Math.max(0, ...catalog.sportCategories.map((category) => category.sortOrder)) + 1
  const category: PackageCategory = {
    id: nextCategoryId(),
    kind: 'sport',
    code: normalizedCode,
    label,
    icon,
    isActive: payload.isActive,
    sortOrder: nextSortOrder,
  }

  writeStoredCatalog({
    ...catalog,
    sportCategories: [...catalog.sportCategories, category],
  })

  return { ok: true, category }
}

export function updateSportCategory(id: string, payload: SaveCategoryPayload): SaveCategoryResult {
  const normalizedCode = normalizeCode(payload.code)
  const label = payload.label.trim()
  const icon = payload.icon.trim()
  if (!normalizedCode || !label) {
    return { ok: false, error: 'invalid' }
  }

  const catalog = getStoredCatalog()
  const current = catalog.sportCategories.find((category) => category.id === id)
  if (!current) {
    return { ok: false, error: 'notFound' }
  }

  const hasDuplicate = catalog.sportCategories.some(
    (category) => category.id !== id && category.code === normalizedCode,
  )
  if (hasDuplicate) {
    return { ok: false, error: 'duplicateCode' }
  }

  const updatedCategory: PackageCategory = {
    ...current,
    code: normalizedCode,
    label,
    icon,
    isActive: payload.isActive,
  }

  writeStoredCatalog({
    ...catalog,
    sportCategories: catalog.sportCategories.map((category) =>
      category.id === id ? updatedCategory : category,
    ),
  })

  return { ok: true, category: updatedCategory }
}

export function removeSportCategory(id: string): SaveCategoryResult {
  const catalog = getStoredCatalog()
  const target = catalog.sportCategories.find((category) => category.id === id)
  if (!target) {
    return { ok: false, error: 'notFound' }
  }

  const categoryInUse = catalog.packages.some((item) => item.categoryId === id)
  if (categoryInUse) {
    return { ok: false, error: 'categoryInUse' }
  }
  const categoryFieldInUse = catalog.fields.some((field) => field.categoryId === id)
  if (categoryFieldInUse) {
    return { ok: false, error: 'categoryInUse' }
  }

  writeStoredCatalog({
    ...catalog,
    sportCategories: catalog.sportCategories.filter((category) => category.id !== id),
  })

  return { ok: true, category: target }
}

export function createField(payload: SaveFieldPayload): SaveFieldResult {
  const title = payload.title.trim()
  const description = payload.description.trim()
  if (!title || !payload.categoryId || !description) {
    return { ok: false, error: 'invalid' }
  }
  const catalog = getStoredCatalog()
  const categoryExists = catalog.sportCategories.some((category) => category.id === payload.categoryId)
  if (!categoryExists) {
    return { ok: false, error: 'categoryNotFound' }
  }
  const field: SportField = {
    id: nextFieldId(),
    title,
    categoryId: payload.categoryId,
    description,
  }
  writeStoredCatalog({
    ...catalog,
    fields: [...catalog.fields, field],
  })
  return { ok: true, field }
}

export function updateField(id: string, payload: SaveFieldPayload): SaveFieldResult {
  const title = payload.title.trim()
  const description = payload.description.trim()
  if (!title || !payload.categoryId || !description) {
    return { ok: false, error: 'invalid' }
  }
  const catalog = getStoredCatalog()
  const current = catalog.fields.find((field) => field.id === id)
  if (!current) {
    return { ok: false, error: 'notFound' }
  }
  const categoryExists = catalog.sportCategories.some((category) => category.id === payload.categoryId)
  if (!categoryExists) {
    return { ok: false, error: 'categoryNotFound' }
  }
  const field: SportField = {
    ...current,
    title,
    categoryId: payload.categoryId,
    description,
  }
  writeStoredCatalog({
    ...catalog,
    fields: catalog.fields.map((item) => (item.id === id ? field : item)),
  })
  return { ok: true, field }
}

export function removeField(id: string): SaveFieldResult {
  const catalog = getStoredCatalog()
  const current = catalog.fields.find((field) => field.id === id)
  if (!current) {
    return { ok: false, error: 'notFound' }
  }
  const fieldInUse = catalog.packages.some((item) => item.groups.some((group) => group.fieldId === id))
  if (fieldInUse) {
    return { ok: false, error: 'fieldInUse' }
  }
  writeStoredCatalog({
    ...catalog,
    fields: catalog.fields.filter((field) => field.id !== id),
  })
  return { ok: true, field: current }
}

export function createEnrollment(payload: SaveEnrollmentPayload): SaveEnrollmentResult {
  const title = payload.title.trim()
  const description = payload.description.trim()
  if (!title || !description) {
    return { ok: false, error: 'invalid' }
  }

  const catalog = getStoredCatalog()
  const enrollment: EnrollmentType = {
    id: nextEnrollmentId(),
    title,
    description,
  }

  writeStoredCatalog({
    ...catalog,
    enrollments: [...catalog.enrollments, enrollment],
  })

  return { ok: true, enrollment }
}

export function updateEnrollment(id: string, payload: SaveEnrollmentPayload): SaveEnrollmentResult {
  const title = payload.title.trim()
  const description = payload.description.trim()
  if (!title || !description) {
    return { ok: false, error: 'invalid' }
  }

  const catalog = getStoredCatalog()
  const current = catalog.enrollments.find((item) => item.id === id)
  if (!current) {
    return { ok: false, error: 'notFound' }
  }

  const enrollment: EnrollmentType = {
    ...current,
    title,
    description,
  }

  writeStoredCatalog({
    ...catalog,
    enrollments: catalog.enrollments.map((item) => (item.id === id ? enrollment : item)),
  })

  return { ok: true, enrollment }
}

export function removeEnrollment(id: string): SaveEnrollmentResult {
  const catalog = getStoredCatalog()
  const current = catalog.enrollments.find((item) => item.id === id)
  if (!current) {
    return { ok: false, error: 'notFound' }
  }

  writeStoredCatalog({
    ...catalog,
    enrollments: catalog.enrollments.filter((item) => item.id !== id),
  })

  return { ok: true, enrollment: current }
}

type NormalizedWhatsAppAccountPayload = {
  title: string
  phoneNumber: string
  avatarUrl: string
  isActive: boolean
  alwaysAvailable: boolean
  availabilitySlots: WhatsAppAvailabilitySlot[]
  offlineMessage: string
  buttonStyle: WhatsAppButtonStyle
}

function normalizeAndValidateWhatsAppAccountPayload(
  payload: SaveWhatsAppAccountPayload,
): { ok: true; data: NormalizedWhatsAppAccountPayload } | { ok: false; error: 'invalid' } {
  const title = payload.title.trim()
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber)
  const avatarUrl = payload.avatarUrl.trim()
  const isActive = Boolean(payload.isActive)
  const alwaysAvailable = Boolean(payload.alwaysAvailable)
  const availabilitySlots = normalizeWhatsAppAvailabilitySlots(payload.availabilitySlots)
  const offlineMessage = payload.offlineMessage.trim()
  const buttonStyle = normalizeWhatsAppButtonStyle(payload.buttonStyle)

  if (!title || !phoneNumber || !isValidPhoneNumber(phoneNumber) || !buttonStyle.label) {
    return { ok: false, error: 'invalid' }
  }
  if (!alwaysAvailable && availabilitySlots.length === 0) {
    return { ok: false, error: 'invalid' }
  }
  if (!alwaysAvailable && !availabilitySlots.every((slot) => isValidWhatsAppAvailabilitySlot(slot))) {
    return { ok: false, error: 'invalid' }
  }

  return {
    ok: true,
    data: {
      title,
      phoneNumber,
      avatarUrl,
      isActive,
      alwaysAvailable,
      availabilitySlots: alwaysAvailable ? [] : availabilitySlots,
      offlineMessage,
      buttonStyle,
    },
  }
}

export function createWhatsAppAccount(payload: SaveWhatsAppAccountPayload): SaveWhatsAppAccountResult {
  const normalized = normalizeAndValidateWhatsAppAccountPayload(payload)
  if (!normalized.ok) {
    return normalized
  }

  const catalog = getStoredCatalog()
  const account: WhatsAppAccount = {
    id: nextWhatsAppAccountId(),
    ...normalized.data,
  }

  writeStoredCatalog({
    ...catalog,
    whatsappAccounts: [...catalog.whatsappAccounts, account],
  })

  return { ok: true, account }
}

export function updateWhatsAppAccount(id: string, payload: SaveWhatsAppAccountPayload): SaveWhatsAppAccountResult {
  const normalized = normalizeAndValidateWhatsAppAccountPayload(payload)
  if (!normalized.ok) {
    return normalized
  }

  const catalog = getStoredCatalog()
  const current = catalog.whatsappAccounts.find((item) => item.id === id)
  if (!current) {
    return { ok: false, error: 'notFound' }
  }

  const account: WhatsAppAccount = {
    ...current,
    ...normalized.data,
  }

  writeStoredCatalog({
    ...catalog,
    whatsappAccounts: catalog.whatsappAccounts.map((item) => (item.id === id ? account : item)),
  })

  return { ok: true, account }
}

export function removeWhatsAppAccount(id: string): SaveWhatsAppAccountResult {
  const catalog = getStoredCatalog()
  const current = catalog.whatsappAccounts.find((item) => item.id === id)
  if (!current) {
    return { ok: false, error: 'notFound' }
  }

  writeStoredCatalog({
    ...catalog,
    whatsappAccounts: catalog.whatsappAccounts.filter((item) => item.id !== id),
    packages: catalog.packages.map((item) => ({
      ...item,
      whatsappAccountIds: item.whatsappAccountIds.filter((accountId) => accountId !== id),
    })),
  })

  return { ok: true, account: current }
}

type NormalizedAdditionalServicePayload = {
  title: string
  description: string
  type: AdditionalServiceType
  price: number | null
  isActive: boolean
}

function normalizeAndValidateAdditionalServicePayload(
  payload: SaveAdditionalServicePayload,
): { ok: true; data: NormalizedAdditionalServicePayload } | { ok: false; error: 'invalid' } {
  const title = payload.title.trim()
  const description = payload.description.trim()
  const type: AdditionalServiceType = payload.type === 'variable' ? 'variable' : 'fixed'
  const parsedPrice = Number.isFinite(payload.price) ? Number(payload.price) : NaN
  if (!title || !description) {
    return { ok: false, error: 'invalid' }
  }
  if (type === 'fixed' && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
    return { ok: false, error: 'invalid' }
  }
  return {
    ok: true,
    data: {
      title,
      description,
      type,
      price: type === 'fixed' ? parsedPrice : null,
      isActive: Boolean(payload.isActive),
    },
  }
}

export function createAdditionalService(payload: SaveAdditionalServicePayload): SaveAdditionalServiceResult {
  const normalized = normalizeAndValidateAdditionalServicePayload(payload)
  if (!normalized.ok) {
    return normalized
  }

  const catalog = getStoredCatalog()
  const service: AdditionalService = {
    id: nextAdditionalServiceId(),
    ...normalized.data,
  }

  writeStoredCatalog({
    ...catalog,
    additionalServices: [...catalog.additionalServices, service],
  })

  return { ok: true, service }
}

export function updateAdditionalService(id: string, payload: SaveAdditionalServicePayload): SaveAdditionalServiceResult {
  const normalized = normalizeAndValidateAdditionalServicePayload(payload)
  if (!normalized.ok) {
    return normalized
  }

  const catalog = getStoredCatalog()
  const current = catalog.additionalServices.find((item) => item.id === id)
  if (!current) {
    return { ok: false, error: 'notFound' }
  }

  const service: AdditionalService = {
    ...current,
    ...normalized.data,
  }

  writeStoredCatalog({
    ...catalog,
    additionalServices: catalog.additionalServices.map((item) => (item.id === id ? service : item)),
  })

  return { ok: true, service }
}

export function removeAdditionalService(id: string): SaveAdditionalServiceResult {
  const catalog = getStoredCatalog()
  const current = catalog.additionalServices.find((item) => item.id === id)
  if (!current) {
    return { ok: false, error: 'notFound' }
  }

  writeStoredCatalog({
    ...catalog,
    additionalServices: catalog.additionalServices.filter((item) => item.id !== id),
  })

  return { ok: true, service: current }
}

type NormalizedCompanyPayload = {
  title: string
  headquartersAddress: string
  googlePlaceId: string
  vatNumber: string
  iban: string
  paypalEnabled: boolean
  paypalClientId: string
  email: string
  consentMinors: string
  consentAdults: string
  consentInformationNotice: string
  consentDataProcessing: string
}

type PreparedPackagePayload = {
  name: string
  description: string
  featuredImage: string
  duration: Pick<SportPackage, 'durationType' | 'eventDate' | 'eventTime' | 'periodStartDate' | 'periodEndDate'>
  gallery: PackageGalleryImage[]
  groups: PackageGroup[]
  payment: Pick<
    SavePackagePayload,
    | 'recurringPaymentEnabled'
    | 'paymentFrequency'
    | 'priceAmount'
    | 'monthlyDueDay'
    | 'monthlyNextCycleOpenDay'
    | 'weeklyDueWeekday'
    | 'firstPaymentOnSite'
  >
  packageEntries: Pick<SavePackagePayload, 'entriesCount'>
  trainerIds: number[]
  whatsappAccountIds: string[]
  additionalFixedServices: PackageAdditionalServiceSelection[]
  additionalVariableServices: PackageAdditionalServiceSelection[]
}

function normalizeAndValidateCompanyPayload(
  payload: SaveCompanyPayload,
): { ok: true; data: NormalizedCompanyPayload } | { ok: false; error: 'invalid' | 'invalidIban' | 'invalidEmail' | 'paypalClientIdRequired' } {
  const normalized: NormalizedCompanyPayload = {
    title: payload.title.trim(),
    headquartersAddress: payload.headquartersAddress.trim(),
    googlePlaceId: payload.googlePlaceId.trim(),
    vatNumber: payload.vatNumber.trim(),
    iban: normalizeIban(payload.iban),
    paypalEnabled: payload.paypalEnabled,
    paypalClientId: payload.paypalClientId.trim(),
    email: payload.email.trim(),
    consentMinors: payload.consentMinors,
    consentAdults: payload.consentAdults,
    consentInformationNotice: payload.consentInformationNotice,
    consentDataProcessing: payload.consentDataProcessing,
  }

  if (
    !normalized.title ||
    !normalized.headquartersAddress ||
    !normalized.googlePlaceId ||
    !normalized.vatNumber ||
    !normalized.iban ||
    !normalized.email ||
    !stripHtml(normalized.consentMinors) ||
    !stripHtml(normalized.consentAdults) ||
    !stripHtml(normalized.consentInformationNotice) ||
    !stripHtml(normalized.consentDataProcessing)
  ) {
    return { ok: false, error: 'invalid' }
  }
  if (!isValidIban(normalized.iban)) {
    return { ok: false, error: 'invalidIban' }
  }
  if (!isValidEmail(normalized.email)) {
    return { ok: false, error: 'invalidEmail' }
  }
  if (normalized.paypalEnabled && !normalized.paypalClientId) {
    return { ok: false, error: 'paypalClientIdRequired' }
  }

  return { ok: true, data: normalized }
}

function buildCompanyFromPayload(input: NormalizedCompanyPayload, current?: Company): Company {
  return {
    id: current?.id ?? nextCompanyId(),
    title: input.title,
    headquartersAddress: input.headquartersAddress,
    googlePlaceId: input.googlePlaceId,
    vatNumber: input.vatNumber,
    iban: input.iban,
    paypalEnabled: input.paypalEnabled,
    paypalClientId: input.paypalEnabled ? input.paypalClientId : '',
    email: input.email,
    consentMinors: input.consentMinors,
    consentAdults: input.consentAdults,
    consentInformationNotice: input.consentInformationNotice,
    consentDataProcessing: input.consentDataProcessing,
  }
}

function preparePackagePayload(payload: SavePackagePayload): PreparedPackagePayload {
  return {
    name: payload.name.trim(),
    description: payload.description.trim(),
    featuredImage: payload.featuredImage.trim(),
    duration: normalizePackageDuration(payload),
    gallery: normalizePackageGallery(payload.gallery),
    groups: normalizePackageGroups(payload.groups),
    payment: normalizePackagePayment(payload),
    packageEntries: normalizePackageEntries(payload),
    trainerIds: normalizePackageTrainers(payload.trainerIds),
    whatsappAccountIds: normalizePackageWhatsAppAccountIds(payload.whatsappAccountIds),
    additionalFixedServices: normalizePackageAdditionalServices(payload.additionalFixedServices),
    additionalVariableServices: normalizePackageAdditionalServices(payload.additionalVariableServices),
  }
}

function validatePreparedPackagePayload(
  payload: SavePackagePayload,
  prepared: PreparedPackagePayload,
  catalog: ReturnType<typeof getStoredCatalog>,
): Extract<SavePackageResult, { ok: false }>['error'] | null {
  if (!prepared.name || !prepared.description || !payload.categoryId || !payload.companyId) {
    return 'invalid'
  }
  if (!isValidAgeRange(payload.ageMin, payload.ageMax)) {
    return 'invalidAgeRange'
  }
  if (!isValidPackageDuration(payload)) {
    return 'invalidDuration'
  }
  if (!isValidPackagePayment(payload)) {
    return 'invalidPayment'
  }
  if (!isValidPackageEntries(payload)) {
    return 'invalidPayment'
  }
  if (!catalog.sportCategories.some((category) => category.id === payload.categoryId)) {
    return 'categoryNotFound'
  }
  if (!catalog.companies.some((company) => company.id === payload.companyId)) {
    return 'companyNotFound'
  }
  if (!isValidPackageEnrollment(payload, catalog.enrollments)) {
    return 'invalidEnrollment'
  }
  if (!isValidPackageWhatsAppAccounts(prepared, catalog.whatsappAccounts)) {
    return 'invalidWhatsAppAccounts'
  }
  if (!isValidPackageAdditionalServices(prepared, catalog.additionalServices)) {
    return 'invalidAdditionalServices'
  }
  if (!isValidPackageGroups(prepared.groups, catalog.fields, payload.categoryId)) {
    return 'invalidGroups'
  }
  return null
}

function buildSportPackageFromPayload(
  id: string,
  payload: SavePackagePayload,
  prepared: PreparedPackagePayload,
  current?: SportPackage,
): SportPackage {
  return {
    ...(current ?? { status: 'draft' as const }),
    id,
    name: prepared.name,
    description: prepared.description,
    enrollmentId: payload.enrollmentId.trim(),
    enrollmentPrice: Number(payload.enrollmentPrice),
    trainerIds: prepared.trainerIds,
    whatsappAccountIds: prepared.whatsappAccountIds,
    additionalFixedServices: prepared.additionalFixedServices,
    additionalVariableServices: prepared.additionalVariableServices,
    ageMin: payload.ageMin,
    ageMax: payload.ageMax,
    durationType: prepared.duration.durationType,
    eventDate: prepared.duration.eventDate,
    eventTime: prepared.duration.eventTime,
    periodStartDate: prepared.duration.periodStartDate,
    periodEndDate: prepared.duration.periodEndDate,
    gallery: prepared.gallery,
    groups: prepared.groups,
    recurringPaymentEnabled: prepared.payment.recurringPaymentEnabled,
    paymentFrequency: prepared.payment.paymentFrequency,
    priceAmount: prepared.payment.priceAmount,
    monthlyDueDay: prepared.payment.monthlyDueDay,
    monthlyNextCycleOpenDay: prepared.payment.monthlyNextCycleOpenDay,
    weeklyDueWeekday: prepared.payment.weeklyDueWeekday,
    firstPaymentOnSite: prepared.payment.firstPaymentOnSite,
    trainingAddress: payload.trainingAddress.trim(),
    entriesCount: prepared.packageEntries.entriesCount,
    userSelectableSchedule: payload.userSelectableSchedule,
    featuredImage: prepared.featuredImage,
    isFeatured: payload.isFeatured,
    isDescriptive: payload.isDescriptive,
    categoryId: payload.categoryId,
    companyId: payload.companyId,
    audience: payload.audience,
  }
}

export function createCompany(payload: SaveCompanyPayload): SaveCompanyResult {
  const validation = normalizeAndValidateCompanyPayload(payload)
  if (!validation.ok) {
    return validation
  }

  const catalog = getStoredCatalog()
  const item = buildCompanyFromPayload(validation.data)

  writeStoredCatalog({
    ...catalog,
    companies: [...catalog.companies, item],
  })

  return { ok: true, item }
}

export function updateCompany(id: string, payload: SaveCompanyPayload): UpdateCompanyResult {
  const validation = normalizeAndValidateCompanyPayload(payload)
  if (!validation.ok) {
    return validation
  }

  const catalog = getStoredCatalog()
  const current = catalog.companies.find((company) => company.id === id)
  if (!current) {
    return { ok: false, error: 'notFound' }
  }

  const item = buildCompanyFromPayload(validation.data, current)

  writeStoredCatalog({
    ...catalog,
    companies: catalog.companies.map((company) => (company.id === id ? item : company)),
  })

  return { ok: true, item }
}

export function removeCompany(id: string): RemoveCompanyResult {
  const catalog = getStoredCatalog()
  const target = catalog.companies.find((company) => company.id === id)
  if (!target) {
    return { ok: false, error: 'notFound' }
  }

  const companyInUse = catalog.packages.some((item) => item.companyId === id)
  if (companyInUse) {
    return { ok: false, error: 'companyInUse' }
  }

  writeStoredCatalog({
    ...catalog,
    companies: catalog.companies.filter((company) => company.id !== id),
  })

  return { ok: true, item: target }
}

export function createSportPackage(payload: SavePackagePayload): SavePackageResult {
  const prepared = preparePackagePayload(payload)
  const catalog = getStoredCatalog()
  const validationError = validatePreparedPackagePayload(payload, prepared, catalog)
  if (validationError) {
    return { ok: false, error: validationError }
  }

  const item = buildSportPackageFromPayload(nextPackageId(), payload, prepared)

  writeStoredCatalog({
    ...catalog,
    packages: [...catalog.packages, item],
  })

  return { ok: true, item }
}

export function updateSportPackage(id: string, payload: SavePackagePayload): UpdatePackageResult {
  const prepared = preparePackagePayload(payload)
  const catalog = getStoredCatalog()
  const validationError = validatePreparedPackagePayload(payload, prepared, catalog)
  if (validationError) {
    return { ok: false, error: validationError }
  }
  const current = catalog.packages.find((item) => item.id === id)
  if (!current) {
    return { ok: false, error: 'notFound' }
  }

  const item = buildSportPackageFromPayload(id, payload, prepared, current)

  writeStoredCatalog({
    ...catalog,
    packages: catalog.packages.map((existing) => (existing.id === id ? item : existing)),
  })

  return { ok: true, item }
}

export function removeSportPackage(id: string): RemovePackageResult {
  const catalog = getStoredCatalog()
  const target = catalog.packages.find((item) => item.id === id)
  if (!target) {
    return { ok: false, error: 'notFound' }
  }

  writeStoredCatalog({
    ...catalog,
    packages: catalog.packages.filter((item) => item.id !== id),
  })

  return { ok: true, item: target }
}
