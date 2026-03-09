import mockPublicClients from '../data/mock-public-clients.json'
import { readJsonArray, writeJsonValue } from './storage'

const PUBLIC_CLIENTS_KEY = 'pys_public_clients'
const PUBLIC_MINORS_KEY = 'pys_public_minors'
const PUBLIC_ENROLLMENTS_KEY = 'pys_public_enrollments'
const PUBLIC_MINOR_CLIENT_REPAIR_KEY = 'pys_public_minor_client_repair_v1'

export type PublicValidationStatus = 'not_validated' | 'validated'
export type ParentRole = 'genitore' | 'tutore' | 'esercente_responsabilita'

export type PublicClientRecord = {
  id: number
  userId: number
  avatarUrl: string
  parentFirstName: string
  parentLastName: string
  parentEmail: string
  parentPhone: string
  parentSecondaryPhone: string
  parentBirthDate: string
  parentBirthPlace: string
  parentRole: ParentRole
  parentGender?: 'M' | 'F'
  parentTaxCode: string
  residenceAddress: string
  consentEnrollmentAccepted: boolean
  consentInformationAccepted: boolean
  consentDataProcessingAccepted: boolean
  consentDataProcessingSignatureDataUrl: string
  enrollmentConfirmationSignatureDataUrl: string
  parentTaxCodeImageDataUrl: string
  parentIdentityDocumentImageDataUrl: string
  privacyPolicySigned: boolean
  validationStatus: PublicValidationStatus
  createdAt: string
}

export type PublicMinorRecord = {
  id: number
  clientId: number
  packageId: string
  avatarUrl: string
  firstName: string
  lastName: string
  birthDate: string
  gender?: 'M' | 'F'
  birthPlace: string
  residenceAddress: string
  taxCode: string
  taxCodeImageDataUrl: string
  medicalCertificateImageDataUrl: string
  medicalCertificateExpiryDate: string
  selectedPaymentMethodCode: string
  validationStatus: PublicValidationStatus
  createdAt: string
}

type ClientProfileInput = {
  parentFirstName: string
  parentLastName: string
  parentEmail: string
  parentPhone: string
  parentSecondaryPhone: string
  parentBirthDate: string
  parentBirthPlace: string
  parentRole: ParentRole
  parentTaxCode: string
  residenceAddress: string
}

type NormalizedClientProfileFields = Pick<
  PublicClientRecord,
  | 'parentFirstName'
  | 'parentLastName'
  | 'parentEmail'
  | 'parentPhone'
  | 'parentSecondaryPhone'
  | 'parentBirthDate'
  | 'parentBirthPlace'
  | 'parentRole'
  | 'parentTaxCode'
  | 'residenceAddress'
>

function writeJson<T>(key: string, items: T[]): void {
  writeJsonValue(key, items)
}

function normalizeTaxCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

function normalizeParentRole(role: string): ParentRole {
  if (role === 'tutore' || role === 'esercente_responsabilita') {
    return role
  }
  return 'genitore'
}

function normalizeClientValidationStatus(status: string): PublicValidationStatus {
  return status === 'validated' ? 'validated' : 'not_validated'
}

function normalizeClientRecord(item: PublicClientRecord): PublicClientRecord {
  return {
    ...item,
    avatarUrl: (item.avatarUrl ?? '').trim(),
    parentRole: normalizeParentRole(item.parentRole),
    parentGender: item.parentGender === 'F' ? 'F' : item.parentGender === 'M' ? 'M' : undefined,
    privacyPolicySigned: Boolean(item.privacyPolicySigned),
    validationStatus: normalizeClientValidationStatus(item.validationStatus),
  }
}

function normalizeClientProfileFields(input: ClientProfileInput): NormalizedClientProfileFields {
  return {
    parentFirstName: input.parentFirstName.trim(),
    parentLastName: input.parentLastName.trim(),
    parentEmail: input.parentEmail.trim().toLowerCase(),
    parentPhone: input.parentPhone.trim(),
    parentSecondaryPhone: input.parentSecondaryPhone.trim(),
    parentBirthDate: input.parentBirthDate.trim(),
    parentBirthPlace: input.parentBirthPlace.trim(),
    parentRole: normalizeParentRole(input.parentRole),
    parentTaxCode: normalizeTaxCode(input.parentTaxCode),
    residenceAddress: input.residenceAddress.trim(),
  }
}

function replaceItemById<T extends { id: number }>(items: T[], id: number, updated: T): T[] {
  return items.map((item) => (item.id === id ? updated : item))
}

type EnrollmentForRepair = {
  packageId: string
  purchaserUserId: number
  audience: 'adult' | 'youth'
  participantFirstName: string
  participantLastName: string
  participantBirthYear: number | null
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

function readEnrollmentsForRepair(): EnrollmentForRepair[] {
  try {
    const raw = localStorage.getItem(PUBLIC_ENROLLMENTS_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as EnrollmentForRepair[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item) => item?.audience === 'youth')
  } catch {
    return []
  }
}

function birthYearFromDate(value: string): number | null {
  const year = Number.parseInt(value.slice(0, 4), 10)
  return Number.isInteger(year) ? year : null
}

function repairMinorClientLinksIfNeeded(clients: PublicClientRecord[], minors: PublicMinorRecord[]): PublicMinorRecord[] {
  if (localStorage.getItem(PUBLIC_MINOR_CLIENT_REPAIR_KEY) === 'done') {
    return minors
  }

  const enrollments = readEnrollmentsForRepair()
  if (enrollments.length === 0 || minors.length === 0) {
    localStorage.setItem(PUBLIC_MINOR_CLIENT_REPAIR_KEY, 'done')
    return minors
  }

  let changed = false
  const repaired = minors.map((minor) => {
    const matches = enrollments.filter((enrollment) => {
      const sameName =
        normalizeName(enrollment.participantFirstName) === normalizeName(minor.firstName) &&
        normalizeName(enrollment.participantLastName) === normalizeName(minor.lastName)
      const samePackage = enrollment.packageId === minor.packageId
      const sameBirthYear =
        enrollment.participantBirthYear === null ||
        enrollment.participantBirthYear === birthYearFromDate(minor.birthDate)
      return sameName && samePackage && sameBirthYear
    })
    if (matches.length === 0) {
      return minor
    }
    const uniquePurchaserUserIds = Array.from(new Set(matches.map((item) => item.purchaserUserId)))
    if (uniquePurchaserUserIds.length !== 1) {
      return minor
    }
    const targetClient = clients.find((client) => client.userId === uniquePurchaserUserIds[0]) ?? null
    if (!targetClient || targetClient.id === minor.clientId) {
      return minor
    }
    changed = true
    return { ...minor, clientId: targetClient.id }
  })

  if (changed) {
    writeJson(PUBLIC_MINORS_KEY, repaired)
  }
  localStorage.setItem(PUBLIC_MINOR_CLIENT_REPAIR_KEY, 'done')
  return repaired
}

function nextId(items: Array<{ id: number }>): number {
  return Math.max(0, ...items.map((item) => item.id)) + 1
}

export function getPublicClients(): PublicClientRecord[] {
  const stored = readJsonArray<PublicClientRecord>(PUBLIC_CLIENTS_KEY).map(normalizeClientRecord)
  const seeds = (mockPublicClients as PublicClientRecord[]).map(normalizeClientRecord)
  if (stored.length === 0) {
    return seeds
  }
  const byTaxCode = new Map(stored.map((item) => [normalizeTaxCode(item.parentTaxCode), item]))
  const merged = [...stored]
  seeds.forEach((seed) => {
    const key = normalizeTaxCode(seed.parentTaxCode)
    if (!byTaxCode.has(key)) {
      merged.push(seed)
    }
  })
  return merged
}

export function getPublicMinors(): PublicMinorRecord[] {
  const normalized = readJsonArray<PublicMinorRecord>(PUBLIC_MINORS_KEY).map((item): PublicMinorRecord => {
    const normalizedGender: 'M' | 'F' | undefined =
      item.gender === 'F' ? 'F' : item.gender === 'M' ? 'M' : undefined
    const normalizedValidationStatus: PublicValidationStatus =
      item.validationStatus === 'validated' ? 'validated' : 'not_validated'
    return {
      ...item,
      avatarUrl: (item.avatarUrl ?? '').trim(),
      gender: normalizedGender,
      medicalCertificateImageDataUrl: item.medicalCertificateImageDataUrl ?? '',
      medicalCertificateExpiryDate: item.medicalCertificateExpiryDate ?? '',
      selectedPaymentMethodCode: (item as { selectedPaymentMethodCode?: string }).selectedPaymentMethodCode ?? '',
      validationStatus: normalizedValidationStatus,
    }
  })
  const clients = getPublicClients()
  return repairMinorClientLinksIfNeeded(clients, normalized)
}

export function findPublicClientByTaxCode(taxCode: string): PublicClientRecord | null {
  const normalized = normalizeTaxCode(taxCode)
  if (!normalized) {
    return null
  }
  return getPublicClients().find((item) => normalizeTaxCode(item.parentTaxCode) === normalized) ?? null
}

export function findPublicMinorByTaxCode(taxCode: string): PublicMinorRecord | null {
  const normalized = normalizeTaxCode(taxCode)
  if (!normalized) {
    return null
  }
  return getPublicMinors().find((item) => normalizeTaxCode(item.taxCode) === normalized) ?? null
}

export function createPublicClientRecord(payload: {
  userId: number
  avatarUrl?: string
  parentFirstName: string
  parentLastName: string
  parentEmail: string
  parentPhone: string
  parentSecondaryPhone: string
  parentBirthDate: string
  parentBirthPlace: string
  parentRole: ParentRole
  parentGender?: 'M' | 'F'
  parentTaxCode: string
  residenceAddress: string
  consentEnrollmentAccepted: boolean
  consentInformationAccepted: boolean
  consentDataProcessingAccepted: boolean
  consentDataProcessingSignatureDataUrl: string
  enrollmentConfirmationSignatureDataUrl: string
  parentTaxCodeImageDataUrl: string
  parentIdentityDocumentImageDataUrl: string
  privacyPolicySigned?: boolean
}): PublicClientRecord {
  const all = getPublicClients()
  const normalizedProfile = normalizeClientProfileFields(payload)
  const next: PublicClientRecord = {
    id: nextId(all),
    userId: payload.userId,
    avatarUrl: payload.avatarUrl?.trim() ?? '',
    ...normalizedProfile,
    parentGender: payload.parentGender === 'F' ? 'F' : payload.parentGender === 'M' ? 'M' : undefined,
    consentEnrollmentAccepted: payload.consentEnrollmentAccepted,
    consentInformationAccepted: payload.consentInformationAccepted,
    consentDataProcessingAccepted: payload.consentDataProcessingAccepted,
    consentDataProcessingSignatureDataUrl: payload.consentDataProcessingSignatureDataUrl,
    enrollmentConfirmationSignatureDataUrl: payload.enrollmentConfirmationSignatureDataUrl,
    parentTaxCodeImageDataUrl: payload.parentTaxCodeImageDataUrl,
    parentIdentityDocumentImageDataUrl: payload.parentIdentityDocumentImageDataUrl,
    privacyPolicySigned: Boolean(payload.privacyPolicySigned),
    validationStatus: 'not_validated',
    createdAt: new Date().toISOString(),
  }
  writeJson(PUBLIC_CLIENTS_KEY, [...all, next])
  return next
}

export function createPublicMinorRecord(payload: {
  clientId: number
  packageId: string
  avatarUrl?: string
  firstName: string
  lastName: string
  birthDate: string
  gender?: 'M' | 'F'
  birthPlace: string
  residenceAddress: string
  taxCode: string
  taxCodeImageDataUrl: string
  selectedPaymentMethodCode?: string
  medicalCertificateImageDataUrl?: string
  medicalCertificateExpiryDate?: string
}): PublicMinorRecord {
  const all = getPublicMinors()
  const next: PublicMinorRecord = {
    id: nextId(all),
    clientId: payload.clientId,
    packageId: payload.packageId,
    avatarUrl: payload.avatarUrl?.trim() ?? '',
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    birthDate: payload.birthDate.trim(),
    gender: payload.gender === 'F' ? 'F' : payload.gender === 'M' ? 'M' : undefined,
    birthPlace: payload.birthPlace.trim(),
    residenceAddress: payload.residenceAddress.trim(),
    taxCode: normalizeTaxCode(payload.taxCode),
    taxCodeImageDataUrl: payload.taxCodeImageDataUrl,
    selectedPaymentMethodCode: payload.selectedPaymentMethodCode?.trim() ?? '',
    medicalCertificateImageDataUrl: payload.medicalCertificateImageDataUrl?.trim() ?? '',
    medicalCertificateExpiryDate: payload.medicalCertificateExpiryDate?.trim() ?? '',
    validationStatus: 'not_validated',
    createdAt: new Date().toISOString(),
  }
  writeJson(PUBLIC_MINORS_KEY, [...all, next])
  return next
}

export function updatePublicClientValidationStatus(
  clientId: number,
  validationStatus: PublicValidationStatus,
): PublicClientRecord | null {
  const all = getPublicClients()
  const current = all.find((item) => item.id === clientId) ?? null
  if (!current) {
    return null
  }
  const updated: PublicClientRecord = { ...current, validationStatus }
  writeJson(PUBLIC_CLIENTS_KEY, replaceItemById(all, clientId, updated))
  return updated
}

export function updatePublicClientRecord(
  clientId: number,
  payload: Pick<
    PublicClientRecord,
    | 'parentFirstName'
    | 'parentLastName'
    | 'parentEmail'
    | 'parentPhone'
    | 'parentSecondaryPhone'
    | 'parentBirthDate'
    | 'parentBirthPlace'
    | 'parentRole'
    | 'parentTaxCode'
    | 'residenceAddress'
  > & Partial<Pick<PublicClientRecord, 'avatarUrl'>>,
): PublicClientRecord | null {
  const all = getPublicClients()
  const current = all.find((item) => item.id === clientId) ?? null
  if (!current) {
    return null
  }
  const normalizedProfile = normalizeClientProfileFields(payload)
  const updated: PublicClientRecord = {
    ...current,
    ...normalizedProfile,
    avatarUrl: (payload.avatarUrl ?? current.avatarUrl).trim(),
  }
  writeJson(PUBLIC_CLIENTS_KEY, replaceItemById(all, clientId, updated))
  return updated
}

export function updatePublicClientPrivacyPolicyStatus(
  clientId: number,
  privacyPolicySigned: boolean,
): PublicClientRecord | null {
  const all = getPublicClients()
  const current = all.find((item) => item.id === clientId) ?? null
  if (!current) {
    return null
  }
  const updated: PublicClientRecord = {
    ...current,
    privacyPolicySigned,
  }
  writeJson(PUBLIC_CLIENTS_KEY, replaceItemById(all, clientId, updated))
  return updated
}

export function updatePublicMinorValidationStatus(
  minorId: number,
  validationStatus: PublicValidationStatus,
): PublicMinorRecord | null {
  const all = getPublicMinors()
  const current = all.find((item) => item.id === minorId) ?? null
  if (!current) {
    return null
  }
  const updated: PublicMinorRecord = { ...current, validationStatus }
  writeJson(PUBLIC_MINORS_KEY, replaceItemById(all, minorId, updated))
  return updated
}

export function updatePublicMinorRecord(
  minorId: number,
  payload: Pick<
    PublicMinorRecord,
    | 'firstName'
    | 'lastName'
    | 'birthDate'
    | 'birthPlace'
    | 'residenceAddress'
    | 'taxCode'
  > &
    Partial<Pick<PublicMinorRecord, 'avatarUrl' | 'medicalCertificateImageDataUrl' | 'medicalCertificateExpiryDate'>>,
): PublicMinorRecord | null {
  const all = getPublicMinors()
  const current = all.find((item) => item.id === minorId) ?? null
  if (!current) {
    return null
  }
  const updated: PublicMinorRecord = {
    ...current,
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    birthDate: payload.birthDate.trim(),
    birthPlace: payload.birthPlace.trim(),
    residenceAddress: payload.residenceAddress.trim(),
    taxCode: normalizeTaxCode(payload.taxCode),
    avatarUrl: (payload.avatarUrl ?? current.avatarUrl).trim(),
    medicalCertificateImageDataUrl: (payload.medicalCertificateImageDataUrl ?? current.medicalCertificateImageDataUrl).trim(),
    medicalCertificateExpiryDate: (payload.medicalCertificateExpiryDate ?? current.medicalCertificateExpiryDate).trim(),
  }
  writeJson(PUBLIC_MINORS_KEY, replaceItemById(all, minorId, updated))
  return updated
}

export function removePublicClientRecord(
  clientId: number,
): { client: PublicClientRecord; removedMinors: PublicMinorRecord[] } | null {
  const allClients = getPublicClients()
  const currentClient = allClients.find((item) => item.id === clientId) ?? null
  if (!currentClient) {
    return null
  }
  const allMinors = getPublicMinors()
  const removedMinors = allMinors.filter((minor) => minor.clientId === clientId)
  writeJson(
    PUBLIC_CLIENTS_KEY,
    allClients.filter((item) => item.id !== clientId),
  )
  writeJson(
    PUBLIC_MINORS_KEY,
    allMinors.filter((minor) => minor.clientId !== clientId),
  )
  return { client: currentClient, removedMinors }
}
