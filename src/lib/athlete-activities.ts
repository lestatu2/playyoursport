import { getPublicMinors } from './public-customer-records'
import { getPublicDirectAthletes } from './public-direct-athletes'

const ATHLETE_ACTIVITIES_KEY = 'pys_athlete_activities'

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
        typeof item.key === 'string' &&
        typeof item.athleteKey === 'string' &&
        typeof item.packageId === 'string',
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
  return [...minorItems, ...directItems]
}

function normalizeAndMerge(records: AthleteActivityRecord[]): AthleteActivityRecord[] {
  const byCanonical = new Map<string, AthleteActivityRecord>()
  for (const item of records) {
    const athleteKey = item.athleteKey?.trim()
    const packageId = item.packageId?.trim()
    if (!athleteKey || !packageId) {
      continue
    }
    const canonical = canonicalPairKey(athleteKey, packageId)
    if (!byCanonical.has(canonical)) {
      byCanonical.set(canonical, {
        key: item.key?.trim() || canonical,
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
