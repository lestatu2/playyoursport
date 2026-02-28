import mockAuth from '../data/mock-auth.json'

const SESSION_KEY = 'pys_auth_session'
const ROLE_LABELS_KEY = 'pys_role_labels'
const USERS_KEY = 'pys_auth_users'
const USERS_CHANGED_EVENT = 'pys-auth-users-changed'

const MANAGEMENT_ROLES = ['super-administrator', 'administrator', 'editor-admin', 'trainer'] as const
const USERS_PAGE_ROLES = ['super-administrator', 'administrator', 'editor-admin'] as const
const ALL_ROLE_KEYS = [
  'super-administrator',
  'administrator',
  'editor-admin',
  'trainer',
  'subscribers',
  'client',
] as const

export type RoleKey = (typeof ALL_ROLE_KEYS)[number]

export type RoleDefinition = {
  key: RoleKey
  defaultLabel: string
  area: 'management' | 'frontend'
}

export type MockUser = {
  id: number
  role: RoleKey
  firstName: string
  lastName: string
  name: string
  email: string
  login: string
  password: string
  avatarUrl: string
  age: number | null
  sector: string
  profession: string
  permissions: string[]
}

export type AuthSession = {
  userId: number
  name: string
  email: string
  role: RoleKey
  token: string
}

export type SaveUserPayload = {
  role: RoleKey
  firstName: string
  lastName: string
  avatarUrl: string
  login: string
  password: string
  email: string
  age: number | null
  sector: string
  profession: string
  permissions: string[]
}

type LoginResult =
  | { ok: true; session: AuthSession }
  | { ok: false; errorKey: 'invalidCredentials' }

export type SaveUserResult =
  | { ok: true; user: MockUser }
  | {
      ok: false
      error:
        | 'invalid'
        | 'invalidEmail'
        | 'duplicateEmail'
        | 'duplicateLogin'
        | 'notFound'
        | 'notAllowedRole'
    }

type SaveUserError = Extract<SaveUserResult, { ok: false }>['error']

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const rawValue = localStorage.getItem(key)
    return rawValue ? (JSON.parse(rawValue) as T) : fallback
  } catch {
    return fallback
  }
}

function emitUsersChanged(): void {
  window.dispatchEvent(new Event(USERS_CHANGED_EVENT))
}

function writeUsers(users: MockUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
  emitUsersChanged()
}

function parseNameParts(value: string): { firstName: string; lastName: string } {
  const normalized = value.trim()
  if (!normalized) {
    return { firstName: '', lastName: '' }
  }
  const parts = normalized.split(/\s+/)
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  }
}

function normalizeRole(role: string): RoleKey {
  if (role === 'subscriber') {
    return 'subscribers'
  }
  return (ALL_ROLE_KEYS.includes(role as RoleKey) ? role : 'client') as RoleKey
}

function normalizeUser(input: Partial<MockUser> & { id: number }): MockUser {
  const role = normalizeRole(String(input.role ?? 'client'))
  const fallbackNames = parseNameParts(input.name ?? '')
  const firstName = String(input.firstName ?? fallbackNames.firstName).trim()
  const lastName = String(input.lastName ?? fallbackNames.lastName).trim()
  const name = `${firstName} ${lastName}`.trim()
  const email = String(input.email ?? '').trim().toLowerCase()
  const login = String(input.login ?? email).trim().toLowerCase()
  const password = String(input.password ?? '')
  const avatarUrl = String(input.avatarUrl ?? '')
  const age = Number.isFinite(input.age) ? Math.trunc(Number(input.age)) : null
  const sector = String(input.sector ?? '').trim()
  const profession = String(input.profession ?? '').trim()
  const permissions = Array.isArray(input.permissions)
    ? input.permissions.filter((item) => item.trim().length > 0)
    : []

  return {
    id: input.id,
    role,
    firstName,
    lastName,
    name,
    email,
    login,
    password,
    avatarUrl,
    age,
    sector,
    profession,
    permissions,
  }
}

function getMockUsers(): MockUser[] {
  const rawUsers = (mockAuth.users as Array<Partial<MockUser> & { id: number }>) ?? []
  return rawUsers.map((user) => normalizeUser(user))
}

function nextUserId(users: MockUser[]): number {
  return Math.max(0, ...users.map((user) => user.id)) + 1
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isAllowedRole(role: string): role is RoleKey {
  return ALL_ROLE_KEYS.includes(role as RoleKey)
}

function validatePayload(payload: SaveUserPayload): SaveUserError | null {
  if (
    !payload.firstName.trim() ||
    !payload.lastName.trim() ||
    !payload.login.trim() ||
    !payload.password.trim() ||
    !payload.email.trim() ||
    !isAllowedRole(payload.role)
  ) {
    return 'invalid'
  }
  if (!isValidEmail(payload.email)) {
    return 'invalidEmail'
  }
  if (payload.role === 'editor-admin') {
    if (!payload.sector.trim() || !payload.profession.trim()) {
      return 'invalid'
    }
  }
  if (payload.role === 'trainer') {
    if (!Number.isInteger(payload.age) || Number(payload.age) <= 0) {
      return 'invalid'
    }
  }
  return null
}

function normalizePayload(payload: SaveUserPayload): SaveUserPayload {
  return {
    ...payload,
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    avatarUrl: payload.avatarUrl.trim(),
    login: payload.login.trim().toLowerCase(),
    password: payload.password,
    email: payload.email.trim().toLowerCase(),
    age: payload.role === 'trainer' && Number.isInteger(payload.age) ? Number(payload.age) : null,
    sector: payload.role === 'editor-admin' ? payload.sector.trim() : '',
    profession: payload.role === 'editor-admin' ? payload.profession.trim() : '',
    permissions: payload.role === 'editor-admin' ? payload.permissions : [],
  }
}

export function getRoleDefinitions(): RoleDefinition[] {
  return (mockAuth.roles as RoleDefinition[]).map((role) => ({
    ...role,
    key: normalizeRole(role.key),
  }))
}

export function getUsersChangedEventName(): string {
  return USERS_CHANGED_EVENT
}

export function getUsers(): MockUser[] {
  const stored = readJsonStorage<MockUser[] | null>(USERS_KEY, null)
  if (!stored) {
    return getMockUsers()
  }
  return stored.map((item) => normalizeUser(item))
}

export function isManagementRole(role: string): boolean {
  return MANAGEMENT_ROLES.includes(role as (typeof MANAGEMENT_ROLES)[number])
}

export function canAccessUsersPage(role: string): boolean {
  return USERS_PAGE_ROLES.includes(role as (typeof USERS_PAGE_ROLES)[number])
}

export function canAccessPackages(role: string): boolean {
  return isManagementRole(role)
}

export function canAccessConfiguration(role: string): boolean {
  return role === 'super-administrator'
}

export function canAccessUtility(role: string): boolean {
  return role === 'super-administrator' || role === 'administrator'
}

export function canCreateRole(actorRole: string, targetRole: RoleKey): boolean {
  if (actorRole === 'super-administrator') {
    return true
  }
  if (actorRole === 'administrator') {
    return ['editor-admin', 'trainer', 'subscribers'].includes(targetRole)
  }
  if (actorRole === 'editor-admin') {
    return ['trainer', 'subscribers'].includes(targetRole)
  }
  return false
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

export function getSessionUser(): MockUser | null {
  const session = getSession()
  if (!session) {
    return null
  }
  return getUsers().find((user) => user.id === session.userId) ?? null
}

export function hasSessionPermission(permission: string): boolean {
  const user = getSessionUser()
  if (!user) {
    return false
  }
  if (user.role === 'super-administrator' || user.role === 'administrator') {
    return true
  }
  if (user.role !== 'editor-admin') {
    return false
  }
  return user.permissions.includes(permission)
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

function createSession(user: MockUser): AuthSession {
  const session: AuthSession = {
    userId: user.id,
    name: `${user.firstName} ${user.lastName}`.trim(),
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

export function createUser(payload: SaveUserPayload, actorRole?: string): SaveUserResult {
  const validationError = validatePayload(payload)
  if (validationError) {
    return { ok: false, error: validationError }
  }
  if (actorRole && !canCreateRole(actorRole, payload.role)) {
    return { ok: false, error: 'notAllowedRole' }
  }

  const normalized = normalizePayload(payload)
  const users = getUsers()
  const duplicateEmail = users.some((user) => user.email === normalized.email)
  if (duplicateEmail) {
    return { ok: false, error: 'duplicateEmail' }
  }
  const duplicateLogin = users.some((user) => user.login === normalized.login)
  if (duplicateLogin) {
    return { ok: false, error: 'duplicateLogin' }
  }

  const user: MockUser = normalizeUser({
    id: nextUserId(users),
    ...normalized,
  })
  writeUsers([...users, user])
  return { ok: true, user }
}

export function updateUser(id: number, payload: SaveUserPayload, actorRole?: string): SaveUserResult {
  const validationError = validatePayload(payload)
  if (validationError) {
    return { ok: false, error: validationError }
  }
  if (actorRole && !canCreateRole(actorRole, payload.role)) {
    return { ok: false, error: 'notAllowedRole' }
  }

  const normalized = normalizePayload(payload)
  const users = getUsers()
  const current = users.find((user) => user.id === id)
  if (!current) {
    return { ok: false, error: 'notFound' }
  }
  const duplicateEmail = users.some((user) => user.id !== id && user.email === normalized.email)
  if (duplicateEmail) {
    return { ok: false, error: 'duplicateEmail' }
  }
  const duplicateLogin = users.some((user) => user.id !== id && user.login === normalized.login)
  if (duplicateLogin) {
    return { ok: false, error: 'duplicateLogin' }
  }

  const user: MockUser = normalizeUser({
    ...current,
    ...normalized,
    id,
  })
  writeUsers(users.map((item) => (item.id === id ? user : item)))
  return { ok: true, user }
}

export function removeUser(id: number, actorRole?: string): SaveUserResult {
  const users = getUsers()
  const current = users.find((user) => user.id === id)
  if (!current) {
    return { ok: false, error: 'notFound' }
  }
  if (actorRole && !canCreateRole(actorRole, current.role)) {
    return { ok: false, error: 'notAllowedRole' }
  }
  writeUsers(users.filter((item) => item.id !== id))
  return { ok: true, user: current }
}
