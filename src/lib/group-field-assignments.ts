import type { SportPackage } from './package-catalog'
import { readJsonArray, writeJsonValue } from './storage'

const ASSIGNMENTS_KEY = 'pys_group_field_assignments'
const FINALIZATIONS_KEY = 'pys_group_field_assignment_finalizations'

export type AthleteAssignment = {
  athleteKey: string
  packageId: string
  groupId: string
  fieldId: string
  scheduleId: string
  updatedAt: string
  updatedByUserId: number
}

export type AssignmentFinalization = {
  packageId: string
  groupId: string
  finalizedAt: string
  finalizedByUserId: number
}

type AthleteSeed = {
  athleteKey: string
  birthDate: string
}

function writeJson<T>(key: string, items: T[]): void {
  writeJsonValue(key, items)
}

function nowIso(): string {
  return new Date().toISOString()
}

function ageFromBirthDate(birthDate: string): number | null {
  const parsed = new Date(birthDate)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  const now = new Date()
  let age = now.getFullYear() - parsed.getFullYear()
  const monthDelta = now.getMonth() - parsed.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < parsed.getDate())) {
    age -= 1
  }
  return age
}

function normalizeScheduleId(scheduleId: string): string {
  return scheduleId.trim() || '__none'
}

function buildDefaultAssignment(
  pkg: SportPackage,
  athlete: AthleteSeed,
  userId: number,
): AthleteAssignment | null {
  if (!pkg.groups.length) {
    return null
  }
  const age = ageFromBirthDate(athlete.birthDate)
  const compatibleByAge = pkg.groups.filter((group) => (
    age === null ? true : age >= pkg.ageMin && age <= pkg.ageMax && group.birthYearMin <= new Date().getFullYear() - age && group.birthYearMax >= new Date().getFullYear() - age
  ))
  const selectedGroup = compatibleByAge[0] ?? pkg.groups[0]
  if (!selectedGroup) {
    return null
  }
  const selectedSchedule = selectedGroup.schedules[0]?.id ?? '__none'
  return {
    athleteKey: athlete.athleteKey,
    packageId: pkg.id,
    groupId: selectedGroup.id,
    fieldId: selectedGroup.fieldId,
    scheduleId: normalizeScheduleId(selectedSchedule),
    updatedAt: nowIso(),
    updatedByUserId: userId,
  }
}

export function getAthleteAssignments(): AthleteAssignment[] {
  return readJsonArray<AthleteAssignment>(ASSIGNMENTS_KEY)
}

export function setAthleteAssignment(input: Omit<AthleteAssignment, 'updatedAt'>): AthleteAssignment {
  const all = getAthleteAssignments()
  const next: AthleteAssignment = {
    ...input,
    scheduleId: normalizeScheduleId(input.scheduleId),
    updatedAt: nowIso(),
  }
  const existingIndex = all.findIndex((item) => item.athleteKey === input.athleteKey && item.packageId === input.packageId)
  if (existingIndex >= 0) {
    const updated = [...all]
    updated[existingIndex] = next
    writeJson(ASSIGNMENTS_KEY, updated)
    return next
  }
  writeJson(ASSIGNMENTS_KEY, [...all, next])
  return next
}

export function ensureAssignmentsForPackage(
  pkg: SportPackage,
  athletes: AthleteSeed[],
  userId: number,
): AthleteAssignment[] {
  const all = getAthleteAssignments()
  const scoped = all.filter((item) => item.packageId === pkg.id)
  const missing = athletes.filter(
    (athlete) => !scoped.some((item) => item.athleteKey === athlete.athleteKey),
  )
  if (!missing.length) {
    return scoped
  }
  const defaults = missing
    .map((athlete) => buildDefaultAssignment(pkg, athlete, userId))
    .filter((item): item is AthleteAssignment => Boolean(item))
  if (!defaults.length) {
    return scoped
  }
  writeJson(ASSIGNMENTS_KEY, [...all, ...defaults])
  return [...scoped, ...defaults]
}

export function getAssignmentFinalizations(): AssignmentFinalization[] {
  return readJsonArray<AssignmentFinalization>(FINALIZATIONS_KEY)
}

export function getAssignmentFinalizationByGroup(packageId: string, groupId: string): AssignmentFinalization | null {
  return getAssignmentFinalizations().find((item) => item.packageId === packageId && item.groupId === groupId) ?? null
}

export function finalizeAssignmentGroup(packageId: string, groupId: string, userId: number): AssignmentFinalization {
  const all = getAssignmentFinalizations()
  const next: AssignmentFinalization = {
    packageId,
    groupId,
    finalizedAt: nowIso(),
    finalizedByUserId: userId,
  }
  const existingIndex = all.findIndex((item) => item.packageId === packageId && item.groupId === groupId)
  if (existingIndex >= 0) {
    const updated = [...all]
    updated[existingIndex] = next
    writeJson(FINALIZATIONS_KEY, updated)
    return next
  }
  writeJson(FINALIZATIONS_KEY, [...all, next])
  return next
}

export function clearAssignmentFinalizationByGroup(packageId: string, groupId: string): void {
  const all = getAssignmentFinalizations()
  writeJson(
    FINALIZATIONS_KEY,
    all.filter((item) => !(item.packageId === packageId && item.groupId === groupId)),
  )
}
