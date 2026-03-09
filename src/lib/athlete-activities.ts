import { getPublicClients, getPublicMinors } from './public-customer-records'
import { getPublicDirectAthletes } from './public-direct-athletes'

const ATHLETE_ACTIVITIES_KEY = 'pys_athlete_activities'
const PUBLIC_ENROLLMENTS_KEY = 'pys_public_enrollments'

export type AthleteActivityRecord = {
  key: string
  athleteKey: string
  type: 'minor' | 'direct_user'
  athleteId: string
  packageId: string
  selectedPaymentMethodCode: string
  createdAt: string
}

type CreateAthleteActivityInput = {
  athleteKey: string
  type: 'minor' | 'direct_user'
  athleteId: string
  packageId: string
  selectedPaymentMethodCode?: string
  createdAt?: string
}

function readStorage(): AthleteActivityRecord[] {
  try {
    const raw = localStorage.getItem(ATHLETE_ACTIVITIES_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as AthleteActivityRecord[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(
      (item) =>
        item &&
        item.key?.trim() &&
        item.athleteKey?.trim() &&
        item.packageId?.trim(),
    )
  } catch {
    return []
  }
}

function writeStorage(items: AthleteActivityRecord[]): void {
  localStorage.setItem(ATHLETE_ACTIVITIES_KEY, JSON.stringify(items))
}

function canonicalPairKey(athleteKey: string, packageId: string): string {
  return `${athleteKey}::${packageId}`
}

function buildPrimaryPackageByAthleteKey(): Map<string, string> {
  const map = new Map<string, string>()
  getPublicMinors().forEach((minor) => {
    map.set(`minor-${minor.id}`, minor.packageId)
  })
  getPublicDirectAthletes().forEach((athlete) => {
    map.set(`direct-${athlete.id}`, athlete.packageId)
  })
  return map
}

type PublicEnrollmentSeed = {
  packageId: string
  purchaserUserId: number
  audience: 'adult' | 'youth'
  participantFirstName: string
  participantLastName: string
  selectedPaymentMethodCode?: string
  createdAt?: string
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

function readPublicEnrollmentsForSeed(): PublicEnrollmentSeed[] {
  try {
    const raw = localStorage.getItem(PUBLIC_ENROLLMENTS_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as PublicEnrollmentSeed[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(
      (item) =>
        item &&
        item.packageId?.trim() &&
        item.participantFirstName?.trim() &&
        item.participantLastName?.trim() &&
        (item.audience === 'youth' || item.audience === 'adult'),
    )
  } catch {
    return []
  }
}

function seedFromProfiles(): AthleteActivityRecord[] {
  const minorItems = getPublicMinors().map((minor) => ({
    key: `minor-${minor.id}`,
    athleteKey: `minor-${minor.id}`,
    type: 'minor' as const,
    athleteId: String(minor.id),
    packageId: minor.packageId,
    selectedPaymentMethodCode: minor.selectedPaymentMethodCode ?? '',
    createdAt: minor.createdAt,
  }))
  const directItems = getPublicDirectAthletes().map((athlete) => ({
    key: `direct-${athlete.id}`,
    athleteKey: `direct-${athlete.id}`,
    type: 'direct_user' as const,
    athleteId: athlete.id,
    packageId: athlete.packageId,
    selectedPaymentMethodCode: '',
    createdAt: athlete.createdAt,
  }))
  const clientsByUserId = new Map(getPublicClients().map((client) => [client.userId, client]))
  const enrollments = readPublicEnrollmentsForSeed()
  const enrollmentItems: AthleteActivityRecord[] = []
  for (const enrollment of enrollments) {
    if (enrollment.audience === 'youth') {
      const client = clientsByUserId.get(enrollment.purchaserUserId) ?? null
      if (!client) {
        continue
      }
      const minorCandidates = getPublicMinors().filter(
        (minor) =>
          minor.clientId === client.id &&
          normalizeName(minor.firstName) === normalizeName(enrollment.participantFirstName) &&
          normalizeName(minor.lastName) === normalizeName(enrollment.participantLastName),
      )
      if (minorCandidates.length !== 1) {
        continue
      }
      const minor = minorCandidates[0]
      const athleteKey = `minor-${minor.id}`
      const activityKey = enrollment.packageId === minor.packageId ? athleteKey : `${athleteKey}::${enrollment.packageId}`
      enrollmentItems.push({
        key: activityKey,
        athleteKey,
        type: 'minor',
        athleteId: String(minor.id),
        packageId: enrollment.packageId,
        selectedPaymentMethodCode: enrollment.selectedPaymentMethodCode?.trim() ?? '',
        createdAt: enrollment.createdAt ?? minor.createdAt,
      })
      continue
    }

    const directCandidates = getPublicDirectAthletes().filter(
      (athlete) =>
        athlete.userId === enrollment.purchaserUserId &&
        normalizeName(athlete.firstName) === normalizeName(enrollment.participantFirstName) &&
        normalizeName(athlete.lastName) === normalizeName(enrollment.participantLastName),
    )
    if (directCandidates.length !== 1) {
      continue
    }
    const direct = directCandidates[0]
    const athleteKey = `direct-${direct.id}`
    const activityKey = enrollment.packageId === direct.packageId ? athleteKey : `${athleteKey}::${enrollment.packageId}`
    enrollmentItems.push({
      key: activityKey,
      athleteKey,
      type: 'direct_user',
      athleteId: direct.id,
      packageId: enrollment.packageId,
      selectedPaymentMethodCode: enrollment.selectedPaymentMethodCode?.trim() ?? '',
      createdAt: enrollment.createdAt ?? direct.createdAt,
    })
  }

  return [...minorItems, ...directItems, ...enrollmentItems]
}

function normalizeAndMerge(records: AthleteActivityRecord[]): AthleteActivityRecord[] {
  const primaryPackageByAthleteKey = buildPrimaryPackageByAthleteKey()
  const byCanonical = new Map<string, AthleteActivityRecord>()
  for (const item of records) {
    const athleteKey = item.athleteKey?.trim()
    const packageId = item.packageId?.trim()
    if (!athleteKey || !packageId) {
      continue
    }
    const primaryPackageId = primaryPackageByAthleteKey.get(athleteKey) ?? null
    const normalizedKey = primaryPackageId === packageId ? athleteKey : `${athleteKey}::${packageId}`
    const canonical = canonicalPairKey(athleteKey, packageId)
    if (!byCanonical.has(canonical)) {
      byCanonical.set(canonical, {
        key: normalizedKey,
        athleteKey,
        type: item.type === 'direct_user' ? 'direct_user' : 'minor',
        athleteId: item.athleteId?.trim() || athleteKey.replace(/^minor-|^direct-/, ''),
        packageId,
        selectedPaymentMethodCode: item.selectedPaymentMethodCode?.trim() ?? '',
        createdAt: item.createdAt || new Date().toISOString(),
      })
    }
  }
  return Array.from(byCanonical.values())
}

export function getAthleteActivities(): AthleteActivityRecord[] {
  const stored = normalizeAndMerge(readStorage())
  const seeds = normalizeAndMerge(seedFromProfiles())
  const merged = normalizeAndMerge([...stored, ...seeds])
  if (merged.length !== stored.length) {
    writeStorage(merged)
  }
  return merged
}

export function createAthleteActivity(input: CreateAthleteActivityInput): AthleteActivityRecord {
  const all = getAthleteActivities()
  const existing = all.find(
    (item) => item.athleteKey === input.athleteKey && item.packageId === input.packageId,
  )
  if (existing) {
    return existing
  }

  const hasPrimary = all.some((item) => item.athleteKey === input.athleteKey && item.key === input.athleteKey)
  const key = hasPrimary ? `${input.athleteKey}::${input.packageId}` : input.athleteKey
  const next: AthleteActivityRecord = {
    key,
    athleteKey: input.athleteKey,
    type: input.type,
    athleteId: input.athleteId,
    packageId: input.packageId,
    selectedPaymentMethodCode: input.selectedPaymentMethodCode?.trim() ?? '',
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
  writeStorage([...all, next])
  return next
}

export function getAthleteActivitiesByAthleteKey(athleteKey: string): AthleteActivityRecord[] {
  return getAthleteActivities().filter((item) => item.athleteKey === athleteKey)
}
