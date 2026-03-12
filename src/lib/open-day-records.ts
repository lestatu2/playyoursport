import { readJsonArray, writeJsonValue } from './storage'

const OPEN_DAY_PROSPECTS_KEY = 'pys_open_day_prospects'
const OPEN_DAY_ADULT_ATHLETES_KEY = 'pys_open_day_adult_athletes'
const OPEN_DAY_MINOR_ATHLETES_KEY = 'pys_open_day_minor_athletes'
const OPEN_DAY_PARTICIPATIONS_KEY = 'pys_open_day_participations'

export type OpenDayProspectRole = 'self' | 'parent' | 'guardian' | 'holder_of_parental_responsibility'
export type OpenDayValidationStatus = 'not_validated' | 'validated'
export type OpenDayParticipationStatus = 'registered' | 'confirmed' | 'attended' | 'cancelled'

export type OpenDayProspect = {
  id: number
  userId: number | null
  linkedClientId: number | null
  firstName: string
  lastName: string
  email: string
  phone: string
  secondaryPhone: string
  birthDate: string
  birthPlace: string
  gender?: 'M' | 'F'
  residenceAddress: string
  role: OpenDayProspectRole
  validationStatus: OpenDayValidationStatus
  createdAt: string
}

export type OpenDayMinorAthlete = {
  id: number
  prospectId: number
  linkedMinorId: number | null
  firstName: string
  lastName: string
  birthDate: string
  birthPlace: string
  gender?: 'M' | 'F'
  residenceAddress: string
  createdAt: string
}

export type OpenDayAdultAthlete = {
  id: number
  prospectId: number
  linkedDirectAthleteId: string | null
  firstName: string
  lastName: string
  birthDate: string
  birthPlace: string
  gender?: 'M' | 'F'
  residenceAddress: string
  email: string
  phone: string
  createdAt: string
}

export type OpenDayParticipation = {
  id: string
  openDayEditionId: string
  productId: string
  editionYear: number
  prospectId: number
  participantType: 'adult' | 'minor'
  adultAthleteId: number | null
  minorAthleteId: number | null
  selectedSessionIds: string[]
  consentEnrollmentAccepted: boolean
  consentInformationAccepted: boolean
  consentDataProcessingAccepted: boolean
  consentDataProcessingSignatureDataUrl: string
  enrollmentConfirmationSignatureDataUrl: string
  status: OpenDayParticipationStatus
  createdAt: string
}

function nextNumericId(items: Array<{ id: number }>): number {
  return Math.max(0, ...items.map((item) => item.id)) + 1
}

function normalizeRole(role: string): OpenDayProspectRole {
  if (role === 'self' || role === 'guardian' || role === 'holder_of_parental_responsibility') {
    return role
  }
  return 'parent'
}

function normalizeValidationStatus(status: string): OpenDayValidationStatus {
  return status === 'validated' ? 'validated' : 'not_validated'
}

function normalizeParticipationStatus(status: string): OpenDayParticipationStatus {
  if (status === 'confirmed' || status === 'attended' || status === 'cancelled') {
    return status
  }
  return 'registered'
}

export function getOpenDayProspects(): OpenDayProspect[] {
  return readJsonArray<OpenDayProspect>(OPEN_DAY_PROSPECTS_KEY).map((item) => ({
    ...item,
    id: Number(item.id),
    userId: Number.isFinite(item.userId) ? Number(item.userId) : null,
    linkedClientId: Number.isFinite(item.linkedClientId) ? Number(item.linkedClientId) : null,
    firstName: item.firstName.trim(),
    lastName: item.lastName.trim(),
    email: item.email.trim().toLowerCase(),
    phone: item.phone ?? '',
    secondaryPhone: item.secondaryPhone ?? '',
    birthDate: item.birthDate ?? '',
    birthPlace: item.birthPlace ?? '',
    gender: item.gender === 'F' ? 'F' : item.gender === 'M' ? 'M' : undefined,
    residenceAddress: item.residenceAddress ?? '',
    role: normalizeRole(item.role),
    validationStatus: normalizeValidationStatus(item.validationStatus),
    createdAt: item.createdAt ?? new Date().toISOString(),
  }))
}

export function getOpenDayProspectByUserId(userId: number): OpenDayProspect | null {
  return getOpenDayProspects().find((item) => item.userId === userId) ?? null
}

export function findOpenDayProspectByIdentity(payload: {
  email: string
  firstName: string
  lastName: string
  birthDate: string
}): OpenDayProspect | null {
  const normalizedEmail = payload.email.trim().toLowerCase()
  const normalizedFirstName = payload.firstName.trim().toLowerCase()
  const normalizedLastName = payload.lastName.trim().toLowerCase()
  const normalizedBirthDate = payload.birthDate.trim()
  if (!normalizedEmail || !normalizedFirstName || !normalizedLastName || !normalizedBirthDate) {
    return null
  }
  return (
    getOpenDayProspects().find(
      (item) =>
        item.email === normalizedEmail &&
        item.firstName.trim().toLowerCase() === normalizedFirstName &&
        item.lastName.trim().toLowerCase() === normalizedLastName &&
        item.birthDate === normalizedBirthDate,
    ) ?? null
  )
}

export function getOpenDayMinorAthletes(): OpenDayMinorAthlete[] {
  return readJsonArray<OpenDayMinorAthlete>(OPEN_DAY_MINOR_ATHLETES_KEY).map((item) => ({
    ...item,
    id: Number(item.id),
    prospectId: Number(item.prospectId),
    linkedMinorId: Number.isFinite(item.linkedMinorId) ? Number(item.linkedMinorId) : null,
    gender: item.gender === 'F' ? 'F' : item.gender === 'M' ? 'M' : undefined,
    createdAt: item.createdAt ?? new Date().toISOString(),
  }))
}

export function getOpenDayMinorAthletesByProspectId(prospectId: number): OpenDayMinorAthlete[] {
  return getOpenDayMinorAthletes().filter((item) => item.prospectId === prospectId)
}

export function findOpenDayMinorAthleteByIdentity(payload: {
  prospectId: number
  firstName: string
  lastName: string
  birthDate: string
}): OpenDayMinorAthlete | null {
  const normalizedFirstName = payload.firstName.trim().toLowerCase()
  const normalizedLastName = payload.lastName.trim().toLowerCase()
  const normalizedBirthDate = payload.birthDate.trim()
  return (
    getOpenDayMinorAthletes().find(
      (item) =>
        item.prospectId === payload.prospectId &&
        item.firstName.trim().toLowerCase() === normalizedFirstName &&
        item.lastName.trim().toLowerCase() === normalizedLastName &&
        item.birthDate === normalizedBirthDate,
    ) ?? null
  )
}

export function getOpenDayAdultAthletes(): OpenDayAdultAthlete[] {
  return readJsonArray<OpenDayAdultAthlete>(OPEN_DAY_ADULT_ATHLETES_KEY).map((item) => ({
    ...item,
    id: Number(item.id),
    prospectId: Number(item.prospectId),
    linkedDirectAthleteId: item.linkedDirectAthleteId?.trim() || null,
    email: item.email.trim().toLowerCase(),
    gender: item.gender === 'F' ? 'F' : item.gender === 'M' ? 'M' : undefined,
    createdAt: item.createdAt ?? new Date().toISOString(),
  }))
}

export function getOpenDayAdultAthletesByProspectId(prospectId: number): OpenDayAdultAthlete[] {
  return getOpenDayAdultAthletes().filter((item) => item.prospectId === prospectId)
}

export function getOpenDayParticipations(): OpenDayParticipation[] {
  return readJsonArray<OpenDayParticipation>(OPEN_DAY_PARTICIPATIONS_KEY).map((item) => ({
    ...item,
    prospectId: Number(item.prospectId),
    editionYear: Number.isFinite(item.editionYear) ? Math.trunc(Number(item.editionYear)) : new Date().getFullYear(),
    adultAthleteId: Number.isFinite(item.adultAthleteId) ? Number(item.adultAthleteId) : null,
    minorAthleteId: Number.isFinite(item.minorAthleteId) ? Number(item.minorAthleteId) : null,
    selectedSessionIds: Array.isArray(item.selectedSessionIds) ? item.selectedSessionIds.map((sessionId) => sessionId.trim()) : [],
    status: normalizeParticipationStatus(item.status),
    createdAt: item.createdAt ?? new Date().toISOString(),
  }))
}

export function getOpenDayParticipationsByProspectId(prospectId: number): OpenDayParticipation[] {
  return getOpenDayParticipations().filter((item) => item.prospectId === prospectId)
}

export function createOpenDayProspect(
  payload: Omit<OpenDayProspect, 'id' | 'createdAt' | 'validationStatus'> & {
    validationStatus?: OpenDayValidationStatus
  },
): OpenDayProspect {
  const all = getOpenDayProspects()
  const next: OpenDayProspect = {
    id: nextNumericId(all),
    userId: Number.isFinite(payload.userId) ? Number(payload.userId) : null,
    linkedClientId: Number.isFinite(payload.linkedClientId) ? Number(payload.linkedClientId) : null,
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    email: payload.email.trim().toLowerCase(),
    phone: payload.phone.trim(),
    secondaryPhone: payload.secondaryPhone.trim(),
    birthDate: payload.birthDate.trim(),
    birthPlace: payload.birthPlace.trim(),
    gender: payload.gender === 'F' ? 'F' : payload.gender === 'M' ? 'M' : undefined,
    residenceAddress: payload.residenceAddress.trim(),
    role: normalizeRole(payload.role),
    validationStatus: normalizeValidationStatus(payload.validationStatus ?? 'not_validated'),
    createdAt: new Date().toISOString(),
  }
  writeJsonValue(OPEN_DAY_PROSPECTS_KEY, [...all, next])
  return next
}

export function createOpenDayMinorAthlete(payload: Omit<OpenDayMinorAthlete, 'id' | 'createdAt'>): OpenDayMinorAthlete {
  const all = getOpenDayMinorAthletes()
  const next: OpenDayMinorAthlete = {
    ...payload,
    id: nextNumericId(all),
    linkedMinorId: Number.isFinite(payload.linkedMinorId) ? Number(payload.linkedMinorId) : null,
    createdAt: new Date().toISOString(),
  }
  writeJsonValue(OPEN_DAY_MINOR_ATHLETES_KEY, [...all, next])
  return next
}

export function createOpenDayAdultAthlete(payload: Omit<OpenDayAdultAthlete, 'id' | 'createdAt'>): OpenDayAdultAthlete {
  const all = getOpenDayAdultAthletes()
  const next: OpenDayAdultAthlete = {
    ...payload,
    id: nextNumericId(all),
    linkedDirectAthleteId: payload.linkedDirectAthleteId?.trim() || null,
    email: payload.email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
  }
  writeJsonValue(OPEN_DAY_ADULT_ATHLETES_KEY, [...all, next])
  return next
}

export function createOpenDayParticipation(
  payload: Omit<OpenDayParticipation, 'id' | 'createdAt' | 'status'> & { status?: OpenDayParticipationStatus },
): OpenDayParticipation {
  const all = getOpenDayParticipations()
  const next: OpenDayParticipation = {
    ...payload,
    id: `open-day-participation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    status: normalizeParticipationStatus(payload.status ?? 'registered'),
    createdAt: new Date().toISOString(),
  }
  writeJsonValue(OPEN_DAY_PARTICIPATIONS_KEY, [...all, next])
  return next
}
