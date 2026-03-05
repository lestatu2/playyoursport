import { getEnrollmentById, type EnrollmentType, type SportPackage } from './package-catalog'

const ATHLETE_ENROLLMENT_COVERAGES_KEY = 'pys_athlete_enrollment_coverages'

export type AthleteEnrollmentCoverage = {
  id: string
  athleteKey: string
  sourceEnrollmentId: string
  insuranceId: string
  sourcePackageId: string
  validFrom: string
  validTo: string
  purchasedAt: string
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

function dateOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function read(): AthleteEnrollmentCoverage[] {
  try {
    const raw = localStorage.getItem(ATHLETE_ENROLLMENT_COVERAGES_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as AthleteEnrollmentCoverage[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(items: AthleteEnrollmentCoverage[]): void {
  localStorage.setItem(ATHLETE_ENROLLMENT_COVERAGES_KEY, JSON.stringify(items))
}

function nextId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ath-enr-cov-${crypto.randomUUID()}`
  }
  return `ath-enr-cov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeCoverage(item: AthleteEnrollmentCoverage): AthleteEnrollmentCoverage | null {
  if (!item?.id || !item.athleteKey || !item.sourceEnrollmentId || !item.insuranceId || !item.sourcePackageId) {
    return null
  }
  const from = parseIsoDate(item.validFrom)
  const to = parseIsoDate(item.validTo)
  if (!from || !to || to < from) {
    return null
  }
  return {
    ...item,
    purchasedAt: item.purchasedAt || new Date().toISOString(),
  }
}

export function getAthleteEnrollmentCoverages(athleteKey: string): AthleteEnrollmentCoverage[] {
  return read()
    .map((item) => normalizeCoverage(item))
    .filter((item): item is AthleteEnrollmentCoverage => Boolean(item))
    .filter((item) => item.athleteKey === athleteKey)
    .sort((a, b) => b.validTo.localeCompare(a.validTo))
}

export function hasActiveCoverageForEnrollment(
  athleteKey: string,
  targetEnrollment: EnrollmentType,
  nowDate = new Date(),
  options?: { excludeSourcePackageId?: string },
): boolean {
  if (targetEnrollment.alwaysRequirePurchase) {
    return false
  }
  const today = dateOnly(nowDate)
  const coverages = getAthleteEnrollmentCoverages(athleteKey)
  return coverages.some((coverage) => {
    const sourceEnrollment = getEnrollmentById(coverage.sourceEnrollmentId)
    if (!sourceEnrollment) {
      return false
    }
    const validTo = parseIsoDate(coverage.validTo)
    if (!validTo) {
      return false
    }
    const isActive = dateOnly(validTo) >= today
    if (!isActive) {
      return false
    }
    if (options?.excludeSourcePackageId && coverage.sourcePackageId === options.excludeSourcePackageId) {
      return false
    }
    return sourceEnrollment.coveredEnrollmentIds.includes(targetEnrollment.id)
  })
}

function computeCoverageRange(packageItem: SportPackage, enrollment: EnrollmentType, nowDate = new Date()): { validFrom: string; validTo: string } {
  const nowIso = toIsoDate(nowDate)
  if (enrollment.validityMode === 'edition_period') {
    if (packageItem.durationType === 'period' && packageItem.periodEndDate) {
      return { validFrom: packageItem.periodStartDate || nowIso, validTo: packageItem.periodEndDate }
    }
    if (packageItem.eventDate) {
      return { validFrom: packageItem.eventDate, validTo: packageItem.eventDate }
    }
  }
  const from = dateOnly(nowDate)
  const to = new Date(from)
  to.setDate(to.getDate() + 364)
  return { validFrom: toIsoDate(from), validTo: toIsoDate(to) }
}

export function upsertCoverageFromEnrollmentPurchase(input: {
  athleteKey: string
  packageItem: SportPackage
  enrollment: EnrollmentType
  purchasedAt?: string
}): AthleteEnrollmentCoverage {
  const all = read()
    .map((item) => normalizeCoverage(item))
    .filter((item): item is AthleteEnrollmentCoverage => Boolean(item))
  const { validFrom, validTo } = computeCoverageRange(input.packageItem, input.enrollment, new Date())
  const existing = all.find(
    (item) =>
      item.athleteKey === input.athleteKey &&
      item.sourceEnrollmentId === input.enrollment.id &&
      item.sourcePackageId === input.packageItem.id &&
      item.validFrom === validFrom &&
      item.validTo === validTo,
  )
  const next: AthleteEnrollmentCoverage = existing ?? {
    id: nextId(),
    athleteKey: input.athleteKey,
    sourceEnrollmentId: input.enrollment.id,
    insuranceId: input.enrollment.insuranceId,
    sourcePackageId: input.packageItem.id,
    validFrom,
    validTo,
    purchasedAt: input.purchasedAt ?? new Date().toISOString(),
  }
  if (existing) {
    write(
      all.map((item) =>
        item.id === existing.id
          ? {
              ...item,
              insuranceId: input.enrollment.insuranceId,
              purchasedAt: input.purchasedAt ?? item.purchasedAt,
            }
          : item,
      ),
    )
    return next
  }
  write([...all, next])
  return next
}
