const PUBLIC_ENROLLMENTS_KEY = 'pys_public_enrollments'

export type PublicEnrollment = {
  id: string
  packageId: string
  purchaserUserId: number
  audience: 'adult' | 'youth'
  participantFirstName: string
  participantLastName: string
  participantBirthYear: number | null
  parentFirstName: string
  parentLastName: string
  parentEmail: string
  selectedGroupId: string
  privacyAccepted: boolean
  createdAt: string
}

function readEnrollments(): PublicEnrollment[] {
  try {
    const raw = localStorage.getItem(PUBLIC_ENROLLMENTS_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as PublicEnrollment[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeEnrollments(items: PublicEnrollment[]): void {
  localStorage.setItem(PUBLIC_ENROLLMENTS_KEY, JSON.stringify(items))
}

export function getPublicEnrollmentsByUser(userId: number): PublicEnrollment[] {
  return readEnrollments().filter((item) => item.purchaserUserId === userId)
}

export function createPublicEnrollment(
  payload: Omit<PublicEnrollment, 'id' | 'createdAt'>,
): PublicEnrollment {
  const next: PublicEnrollment = {
    ...payload,
    id: `enr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  }
  const current = readEnrollments()
  writeEnrollments([...current, next])
  return next
}
