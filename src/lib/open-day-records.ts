import mockOpenDayRecords from '../data/mock-open-day-records.json'
import { readJsonArray, writeJsonValue } from './storage'

const OPEN_DAY_PROSPECTS_KEY = 'pys_open_day_prospects'
const OPEN_DAY_ADULT_ATHLETES_KEY = 'pys_open_day_adult_athletes'
const OPEN_DAY_MINOR_ATHLETES_KEY = 'pys_open_day_minor_athletes'
const OPEN_DAY_PARTICIPATIONS_KEY = 'pys_open_day_participations'
const OPEN_DAY_RECORDS_CHANGED_EVENT = 'pys-open-day-records-changed'

type MockOpenDayRecords = {
  prospects?: OpenDayProspect[]
  adultAthletes?: OpenDayAdultAthlete[]
  minorAthletes?: OpenDayMinorAthlete[]
  participations?: OpenDayParticipation[]
}

export type OpenDayProspectRole = 'self' | 'parent' | 'guardian' | 'holder_of_parental_responsibility'
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
  gender?: 'M' | 'F'
  role: OpenDayProspectRole
  createdAt: string
}

export type OpenDayMinorAthlete = {
  id: number
  prospectId: number
  linkedMinorId: number | null
  firstName: string
  lastName: string
  birthDate: string
  gender?: 'M' | 'F'
  createdAt: string
}

export type OpenDayAdultAthlete = {
  id: number
  prospectId: number
  linkedDirectAthleteId: string | null
  firstName: string
  lastName: string
  birthDate: string
  gender?: 'M' | 'F'
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

function normalizeParticipationStatus(status: string): OpenDayParticipationStatus {
  if (status === 'confirmed' || status === 'attended' || status === 'cancelled') {
    return status
  }
  return 'registered'
}

function emitOpenDayRecordsChanged(): void {
  window.dispatchEvent(new Event(OPEN_DAY_RECORDS_CHANGED_EVENT))
}

export function getOpenDayRecordsChangedEventName(): string {
  return OPEN_DAY_RECORDS_CHANGED_EVENT
}

export function getOpenDayProspects(): OpenDayProspect[] {
  const stored = readJsonArray<OpenDayProspect>(OPEN_DAY_PROSPECTS_KEY)
  const seeds = ((mockOpenDayRecords as MockOpenDayRecords).prospects ?? [])
  const items = stored.length > 0 ? stored : seeds
  return items.map((item) => ({
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
    gender: item.gender === 'F' ? 'F' : item.gender === 'M' ? 'M' : undefined,
    role: normalizeRole(item.role),
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
  const stored = readJsonArray<OpenDayMinorAthlete>(OPEN_DAY_MINOR_ATHLETES_KEY)
  const seeds = ((mockOpenDayRecords as MockOpenDayRecords).minorAthletes ?? [])
  const items = stored.length > 0 ? stored : seeds
  return items.map((item) => ({
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
  const stored = readJsonArray<OpenDayAdultAthlete>(OPEN_DAY_ADULT_ATHLETES_KEY)
  const seeds = ((mockOpenDayRecords as MockOpenDayRecords).adultAthletes ?? [])
  const items = stored.length > 0 ? stored : seeds
  return items.map((item) => ({
    ...item,
    id: Number(item.id),
    prospectId: Number(item.prospectId),
    linkedDirectAthleteId: item.linkedDirectAthleteId?.trim() || null,
    email: item.email.trim().toLowerCase(),
    gender: item.gender === 'F' ? 'F' : item.gender === 'M' ? 'M' : undefined,
    createdAt: item.createdAt ?? new Date().toISOString(),
  }))
}

export function getOpenDayParticipations(): OpenDayParticipation[] {
  const stored = readJsonArray<OpenDayParticipation>(OPEN_DAY_PARTICIPATIONS_KEY)
  const seeds = ((mockOpenDayRecords as MockOpenDayRecords).participations ?? [])
  const items = stored.length > 0 ? stored : seeds
  return items.map((item) => ({
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
  payload: Omit<OpenDayProspect, 'id' | 'createdAt'>,
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
    gender: payload.gender === 'F' ? 'F' : payload.gender === 'M' ? 'M' : undefined,
    role: normalizeRole(payload.role),
    createdAt: new Date().toISOString(),
  }
  writeJsonValue(OPEN_DAY_PROSPECTS_KEY, [...all, next])
  emitOpenDayRecordsChanged()
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
  emitOpenDayRecordsChanged()
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
  emitOpenDayRecordsChanged()
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
  emitOpenDayRecordsChanged()
  return next
}

export function updateOpenDayProspect(
  prospectId: number,
  payload: Partial<
    Pick<
      OpenDayProspect,
      | 'firstName'
      | 'lastName'
      | 'email'
      | 'phone'
      | 'secondaryPhone'
      | 'birthDate'
      | 'gender'
      | 'role'
    >
  >,
): OpenDayProspect | null {
  const all = getOpenDayProspects()
  const current = all.find((item) => item.id === prospectId) ?? null
  if (!current) {
    return null
  }
  const next: OpenDayProspect = {
    ...current,
    firstName: payload.firstName?.trim() ?? current.firstName,
    lastName: payload.lastName?.trim() ?? current.lastName,
    email: payload.email?.trim().toLowerCase() ?? current.email,
    phone: payload.phone?.trim() ?? current.phone,
    secondaryPhone: payload.secondaryPhone?.trim() ?? current.secondaryPhone,
    birthDate: payload.birthDate?.trim() ?? current.birthDate,
    gender: payload.gender === 'F' ? 'F' : payload.gender === 'M' ? 'M' : current.gender,
    role: payload.role ? normalizeRole(payload.role) : current.role,
  }
  writeJsonValue(
    OPEN_DAY_PROSPECTS_KEY,
    all.map((item) => (item.id === prospectId ? next : item)),
  )
  emitOpenDayRecordsChanged()
  return next
}

export function updateOpenDayMinorAthlete(
  athleteId: number,
  payload: Partial<
    Pick<OpenDayMinorAthlete, 'firstName' | 'lastName' | 'birthDate' | 'gender'>
  >,
): OpenDayMinorAthlete | null {
  const all = getOpenDayMinorAthletes()
  const current = all.find((item) => item.id === athleteId) ?? null
  if (!current) {
    return null
  }
  const next: OpenDayMinorAthlete = {
    ...current,
    firstName: payload.firstName?.trim() ?? current.firstName,
    lastName: payload.lastName?.trim() ?? current.lastName,
    birthDate: payload.birthDate?.trim() ?? current.birthDate,
    gender: payload.gender === 'F' ? 'F' : payload.gender === 'M' ? 'M' : current.gender,
  }
  writeJsonValue(
    OPEN_DAY_MINOR_ATHLETES_KEY,
    all.map((item) => (item.id === athleteId ? next : item)),
  )
  emitOpenDayRecordsChanged()
  return next
}

export function updateOpenDayAdultAthlete(
  athleteId: number,
  payload: Partial<
    Pick<OpenDayAdultAthlete, 'firstName' | 'lastName' | 'birthDate' | 'gender' | 'email' | 'phone'>
  >,
): OpenDayAdultAthlete | null {
  const all = getOpenDayAdultAthletes()
  const current = all.find((item) => item.id === athleteId) ?? null
  if (!current) {
    return null
  }
  const next: OpenDayAdultAthlete = {
    ...current,
    firstName: payload.firstName?.trim() ?? current.firstName,
    lastName: payload.lastName?.trim() ?? current.lastName,
    birthDate: payload.birthDate?.trim() ?? current.birthDate,
    gender: payload.gender === 'F' ? 'F' : payload.gender === 'M' ? 'M' : current.gender,
    email: payload.email?.trim().toLowerCase() ?? current.email,
    phone: payload.phone?.trim() ?? current.phone,
  }
  writeJsonValue(
    OPEN_DAY_ADULT_ATHLETES_KEY,
    all.map((item) => (item.id === athleteId ? next : item)),
  )
  emitOpenDayRecordsChanged()
  return next
}

export function updateOpenDayParticipation(
  participationId: string,
  payload: Partial<
    Pick<
      OpenDayParticipation,
      | 'selectedSessionIds'
      | 'consentEnrollmentAccepted'
      | 'consentInformationAccepted'
      | 'consentDataProcessingAccepted'
      | 'consentDataProcessingSignatureDataUrl'
      | 'enrollmentConfirmationSignatureDataUrl'
      | 'status'
    >
  >,
): OpenDayParticipation | null {
  const all = getOpenDayParticipations()
  const current = all.find((item) => item.id === participationId) ?? null
  if (!current) {
    return null
  }
  const next: OpenDayParticipation = {
    ...current,
    selectedSessionIds: payload.selectedSessionIds
      ? payload.selectedSessionIds.map((item) => item.trim()).filter(Boolean)
      : current.selectedSessionIds,
    consentEnrollmentAccepted: payload.consentEnrollmentAccepted ?? current.consentEnrollmentAccepted,
    consentInformationAccepted: payload.consentInformationAccepted ?? current.consentInformationAccepted,
    consentDataProcessingAccepted: payload.consentDataProcessingAccepted ?? current.consentDataProcessingAccepted,
    consentDataProcessingSignatureDataUrl:
      payload.consentDataProcessingSignatureDataUrl ?? current.consentDataProcessingSignatureDataUrl,
    enrollmentConfirmationSignatureDataUrl:
      payload.enrollmentConfirmationSignatureDataUrl ?? current.enrollmentConfirmationSignatureDataUrl,
    status: payload.status ? normalizeParticipationStatus(payload.status) : current.status,
  }
  writeJsonValue(
    OPEN_DAY_PARTICIPATIONS_KEY,
    all.map((item) => (item.id === participationId ? next : item)),
  )
  emitOpenDayRecordsChanged()
  return next
}

export function removeOpenDayParticipation(participationId: string): boolean {
  const all = getOpenDayParticipations()
  if (!all.some((item) => item.id === participationId)) {
    return false
  }
  writeJsonValue(
    OPEN_DAY_PARTICIPATIONS_KEY,
    all.filter((item) => item.id !== participationId),
  )
  emitOpenDayRecordsChanged()
  return true
}
