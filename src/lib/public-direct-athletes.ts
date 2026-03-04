import mockDirectAthletes from '../data/mock-direct-athletes.json'
import type { PublicValidationStatus } from './public-customer-records'

const PUBLIC_DIRECT_ATHLETES_KEY = 'pys_public_direct_athletes'

export type PublicDirectAthleteRecord = {
  id: string
  userId: number
  clientId: number | null
  packageId: string
  firstName: string
  lastName: string
  birthDate: string
  birthPlace: string
  residenceAddress: string
  taxCode: string
  email: string
  phone: string
  medicalCertificateImageDataUrl: string
  medicalCertificateExpiryDate: string
  validationStatus: PublicValidationStatus
  createdAt: string
}

function normalize(items: PublicDirectAthleteRecord[]): PublicDirectAthleteRecord[] {
  return items.map((item) => ({
    ...item,
    clientId: Number.isFinite(item.clientId) ? Number(item.clientId) : null,
    medicalCertificateImageDataUrl: item.medicalCertificateImageDataUrl ?? '',
    medicalCertificateExpiryDate: item.medicalCertificateExpiryDate ?? '',
    validationStatus: item.validationStatus === 'validated' ? 'validated' : 'not_validated',
  }))
}

function readStorage(): PublicDirectAthleteRecord[] | null {
  try {
    const raw = localStorage.getItem(PUBLIC_DIRECT_ATHLETES_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as PublicDirectAthleteRecord[]
    if (!Array.isArray(parsed)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStorage(items: PublicDirectAthleteRecord[]): void {
  localStorage.setItem(PUBLIC_DIRECT_ATHLETES_KEY, JSON.stringify(items))
}

export function getPublicDirectAthletes(): PublicDirectAthleteRecord[] {
  const stored = readStorage()
  if (stored) {
    return normalize(stored)
  }
  return normalize(mockDirectAthletes as PublicDirectAthleteRecord[])
}

export function updatePublicDirectAthleteRecord(
  id: string,
  payload: Pick<
    PublicDirectAthleteRecord,
    | 'firstName'
    | 'lastName'
    | 'birthDate'
    | 'birthPlace'
    | 'residenceAddress'
    | 'taxCode'
    | 'email'
    | 'phone'
    | 'medicalCertificateImageDataUrl'
    | 'medicalCertificateExpiryDate'
  >,
): PublicDirectAthleteRecord | null {
  const all = getPublicDirectAthletes()
  const current = all.find((item) => item.id === id) ?? null
  if (!current) {
    return null
  }
  const updated: PublicDirectAthleteRecord = {
    ...current,
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    birthDate: payload.birthDate.trim(),
    birthPlace: payload.birthPlace.trim(),
    residenceAddress: payload.residenceAddress.trim(),
    taxCode: payload.taxCode.trim().toUpperCase(),
    email: payload.email.trim().toLowerCase(),
    phone: payload.phone.trim(),
    medicalCertificateImageDataUrl: payload.medicalCertificateImageDataUrl,
    medicalCertificateExpiryDate: payload.medicalCertificateExpiryDate.trim(),
  }
  writeStorage(all.map((item) => (item.id === id ? updated : item)))
  return updated
}

export function updatePublicDirectAthleteValidationStatus(
  id: string,
  validationStatus: PublicValidationStatus,
): PublicDirectAthleteRecord | null {
  const all = getPublicDirectAthletes()
  const current = all.find((item) => item.id === id) ?? null
  if (!current) {
    return null
  }
  const updated: PublicDirectAthleteRecord = { ...current, validationStatus }
  writeStorage(all.map((item) => (item.id === id ? updated : item)))
  return updated
}
