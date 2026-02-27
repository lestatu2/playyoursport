import mockAuth from '../data/mock-auth.json'

const SESSION_KEY = 'pys_auth_session'
const ROLE_LABELS_KEY = 'pys_role_labels'
const MANAGEMENT_ROLES = ['administrator', 'editor-admin', 'trainer'] as const

export type RoleDefinition = {
  key: string
  defaultLabel: string
  area: 'management' | 'frontend'
}

export type MockUser = {
  id: number
  name: string
  email: string
  password: string
  role: string
}

export type AuthSession = {
  userId: number
  name: string
  email: string
  role: string
  token: string
}

type LoginResult =
  | { ok: true; session: AuthSession }
  | { ok: false; errorKey: 'invalidCredentials' }

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const rawValue = localStorage.getItem(key)
    return rawValue ? (JSON.parse(rawValue) as T) : fallback
  } catch {
    return fallback
  }
}

export function getRoleDefinitions(): RoleDefinition[] {
  return mockAuth.roles as RoleDefinition[]
}

export function getUsers(): MockUser[] {
  return mockAuth.users as MockUser[]
}

export function isManagementRole(role: string): boolean {
  return MANAGEMENT_ROLES.includes(role as (typeof MANAGEMENT_ROLES)[number])
}

export function isAdministrator(role: string): boolean {
  return role === 'administrator'
}

export function getRoleLabels(): Record<string, string> {
  const defaults = Object.fromEntries(
    getRoleDefinitions().map((role) => [role.key, role.defaultLabel]),
  ) as Record<string, string>

  const overrides = readJsonStorage<Record<string, string>>(ROLE_LABELS_KEY, {})
  return { ...defaults, ...overrides }
}

export function setRoleLabel(roleKey: string, label: string): boolean {
  const normalizedLabel = label.trim()
  const role = getRoleDefinitions().find((item) => item.key === roleKey)
  if (!role || !normalizedLabel) {
    return false
  }

  const overrides = readJsonStorage<Record<string, string>>(ROLE_LABELS_KEY, {})
  overrides[roleKey] = normalizedLabel
  localStorage.setItem(ROLE_LABELS_KEY, JSON.stringify(overrides))
  return true
}

export function clearRoleLabelOverrides(): void {
  localStorage.removeItem(ROLE_LABELS_KEY)
}

export function getSession(): AuthSession | null {
  return readJsonStorage<AuthSession | null>(SESSION_KEY, null)
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

function createSession(user: MockUser): AuthSession {
  const session: AuthSession = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: `mock-${user.id}-${Date.now()}`,
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function loginWithEmailPassword(email: string, password: string): LoginResult {
  const normalizedEmail = email.trim().toLowerCase()
  const user = getUsers().find((item) => item.email.toLowerCase() === normalizedEmail)

  if (!user || user.password !== password) {
    return { ok: false, errorKey: 'invalidCredentials' }
  }

  return {
    ok: true,
    session: createSession(user),
  }
}
