import mockPublicClients from '../data/mock-public-clients.json'

const PUBLIC_CLIENTS_KEY = 'pys_public_clients'
const PUBLIC_MINORS_KEY = 'pys_public_minors'

export type PublicValidationStatus = 'not_validated' | 'validated'

export type PublicClientRecord = {
  id: number
  userId: number
  parentFirstName: string
  parentLastName: string
  parentEmail: string
  parentPhone: string
  parentSecondaryPhone: string
  parentBirthDate: string
  parentBirthPlace: string
  parentTaxCode: string
  residenceAddress: string
  consentEnrollmentAccepted: boolean
  consentInformationAccepted: boolean
  consentDataProcessingAccepted: boolean
  consentDataProcessingSignatureDataUrl: string
  enrollmentConfirmationSignatureDataUrl: string
  parentTaxCodeImageDataUrl: string
  parentIdentityDocumentImageDataUrl: string
  validationStatus: PublicValidationStatus
  createdAt: string
}

export type PublicMinorRecord = {
  id: number
  clientId: number
  packageId: string
  firstName: string
  lastName: string
  birthDate: string
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

function readJson<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeJson<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items))
}

function normalizeTaxCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

function nextId(items: Array<{ id: number }>): number {
  return Math.max(0, ...items.map((item) => item.id)) + 1
}

export function getPublicClients(): PublicClientRecord[] {
  const stored = readJson<PublicClientRecord>(PUBLIC_CLIENTS_KEY).map((item) => ({
    ...item,
    validationStatus: item.validationStatus === 'validated' ? 'validated' : 'not_validated',
  }))
  const seeds = (mockPublicClients as PublicClientRecord[]).map((item) => ({
    ...item,
    validationStatus: item.validationStatus === 'validated' ? 'validated' : 'not_validated',
  }))
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
  return readJson<PublicMinorRecord>(PUBLIC_MINORS_KEY).map((item) => ({
    ...item,
    medicalCertificateImageDataUrl: item.medicalCertificateImageDataUrl ?? '',
    medicalCertificateExpiryDate: item.medicalCertificateExpiryDate ?? '',
    selectedPaymentMethodCode: (item as { selectedPaymentMethodCode?: string }).selectedPaymentMethodCode ?? '',
    validationStatus: item.validationStatus === 'validated' ? 'validated' : 'not_validated',
  }))
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
  parentFirstName: string
  parentLastName: string
  parentEmail: string
  parentPhone: string
  parentSecondaryPhone: string
  parentBirthDate: string
  parentBirthPlace: string
  parentTaxCode: string
  residenceAddress: string
  consentEnrollmentAccepted: boolean
  consentInformationAccepted: boolean
  consentDataProcessingAccepted: boolean
  consentDataProcessingSignatureDataUrl: string
  enrollmentConfirmationSignatureDataUrl: string
  parentTaxCodeImageDataUrl: string
  parentIdentityDocumentImageDataUrl: string
}): PublicClientRecord {
  const all = getPublicClients()
  const next: PublicClientRecord = {
    id: nextId(all),
    userId: payload.userId,
    parentFirstName: payload.parentFirstName.trim(),
    parentLastName: payload.parentLastName.trim(),
    parentEmail: payload.parentEmail.trim().toLowerCase(),
    parentPhone: payload.parentPhone.trim(),
    parentSecondaryPhone: payload.parentSecondaryPhone.trim(),
    parentBirthDate: payload.parentBirthDate.trim(),
    parentBirthPlace: payload.parentBirthPlace.trim(),
    parentTaxCode: normalizeTaxCode(payload.parentTaxCode),
    residenceAddress: payload.residenceAddress.trim(),
    consentEnrollmentAccepted: payload.consentEnrollmentAccepted,
    consentInformationAccepted: payload.consentInformationAccepted,
    consentDataProcessingAccepted: payload.consentDataProcessingAccepted,
    consentDataProcessingSignatureDataUrl: payload.consentDataProcessingSignatureDataUrl,
    enrollmentConfirmationSignatureDataUrl: payload.enrollmentConfirmationSignatureDataUrl,
    parentTaxCodeImageDataUrl: payload.parentTaxCodeImageDataUrl,
    parentIdentityDocumentImageDataUrl: payload.parentIdentityDocumentImageDataUrl,
    validationStatus: 'not_validated',
    createdAt: new Date().toISOString(),
  }
  writeJson(PUBLIC_CLIENTS_KEY, [...all, next])
  return next
}

export function createPublicMinorRecord(payload: {
  clientId: number
  packageId: string
  firstName: string
  lastName: string
  birthDate: string
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
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    birthDate: payload.birthDate.trim(),
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
  writeJson(
    PUBLIC_CLIENTS_KEY,
    all.map((item) => (item.id === clientId ? updated : item)),
  )
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
    | 'parentTaxCode'
    | 'residenceAddress'
  >,
): PublicClientRecord | null {
  const all = getPublicClients()
  const current = all.find((item) => item.id === clientId) ?? null
  if (!current) {
    return null
  }
  const updated: PublicClientRecord = {
    ...current,
    parentFirstName: payload.parentFirstName.trim(),
    parentLastName: payload.parentLastName.trim(),
    parentEmail: payload.parentEmail.trim().toLowerCase(),
    parentPhone: payload.parentPhone.trim(),
    parentSecondaryPhone: payload.parentSecondaryPhone.trim(),
    parentBirthDate: payload.parentBirthDate.trim(),
    parentBirthPlace: payload.parentBirthPlace.trim(),
    parentTaxCode: normalizeTaxCode(payload.parentTaxCode),
    residenceAddress: payload.residenceAddress.trim(),
  }
  writeJson(
    PUBLIC_CLIENTS_KEY,
    all.map((item) => (item.id === clientId ? updated : item)),
  )
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
  writeJson(
    PUBLIC_MINORS_KEY,
    all.map((item) => (item.id === minorId ? updated : item)),
  )
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
    Partial<Pick<PublicMinorRecord, 'medicalCertificateImageDataUrl' | 'medicalCertificateExpiryDate'>>,
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
    medicalCertificateImageDataUrl: (payload.medicalCertificateImageDataUrl ?? current.medicalCertificateImageDataUrl).trim(),
    medicalCertificateExpiryDate: (payload.medicalCertificateExpiryDate ?? current.medicalCertificateExpiryDate).trim(),
  }
  writeJson(
    PUBLIC_MINORS_KEY,
    all.map((item) => (item.id === minorId ? updated : item)),
  )
  return updated
}
