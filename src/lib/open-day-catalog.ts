import mockOpenDays from '../data/mock-open-days.json'
import { readJsonArray, writeJsonValue } from './storage'

const OPEN_DAY_PRODUCTS_KEY = 'pys_open_day_products'
const OPEN_DAY_EDITIONS_KEY = 'pys_open_day_editions'
const OPEN_DAY_GROUPS_KEY = 'pys_open_day_groups'
const OPEN_DAY_SESSIONS_KEY = 'pys_open_day_sessions'
const OPEN_DAY_CATALOG_CHANGED_EVENT = 'pys-open-day-catalog-changed'

export type OpenDayAudience = 'adult' | 'youth'
export type OpenDayStatus = 'draft' | 'published' | 'archived'
export type OpenDayDurationType = 'single-event' | 'period'
export type OpenDayGroupGender = 'male' | 'female' | 'mixed'

export type OpenDayProduct = {
  id: string
  code: string
  name: string
  categoryId: string
  audience: OpenDayAudience
  description: string
  disclaimer: string
  ageMin: number
  ageMax: number
  status: OpenDayStatus
}

export type OpenDayEdition = {
  id: string
  productId: string
  editionYear: number
  status: OpenDayStatus
  durationType: OpenDayDurationType
  eventDate: string
  periodStartDate: string
  periodEndDate: string
}

export type OpenDayGroup = {
  id: string
  openDayEditionId: string
  title: string
  gender: OpenDayGroupGender
  birthYearMin: number
  birthYearMax: number
  fieldId: string
  capacity: number | null
  isActive: boolean
}

export type OpenDaySession = {
  id: string
  groupId: string
  date: string
  startTime: string
  endTime: string
  capacity: number | null
  isActive: boolean
}

export type SaveOpenDaySessionPayload = {
  id: string
  date: string
  startTime: string
  endTime: string
  capacity: number | null
  isActive: boolean
}

export type SaveOpenDayGroupPayload = {
  id: string
  title: string
  gender: OpenDayGroupGender
  birthYearMin: number
  birthYearMax: number
  fieldId: string
  capacity: number | null
  isActive: boolean
  sessions: SaveOpenDaySessionPayload[]
}

type MockOpenDayCatalog = {
  products?: OpenDayProduct[]
  editions?: OpenDayEdition[]
  groups?: OpenDayGroup[]
  sessions?: OpenDaySession[]
}

export type SaveOpenDayPayload = {
  code: string
  name: string
  categoryId: string
  audience: OpenDayAudience
  description: string
  disclaimer: string
  ageMin: number
  ageMax: number
  productStatus: OpenDayStatus
  editionYear: number
  editionStatus: OpenDayStatus
  durationType: OpenDayDurationType
  eventDate: string
  periodStartDate: string
  periodEndDate: string
  groups: SaveOpenDayGroupPayload[]
}

export type SaveOpenDayResult =
  | { ok: true; product: OpenDayProduct; edition: OpenDayEdition }
  | {
      ok: false
      error:
        | 'invalid'
        | 'duplicateCode'
        | 'duplicateEditionYear'
        | 'productNotFound'
        | 'editionNotFound'
    }

function emitOpenDayCatalogChanged(): void {
  window.dispatchEvent(new Event(OPEN_DAY_CATALOG_CHANGED_EVENT))
}

function normalizeStatus(status: string): OpenDayStatus {
  return status === 'published' || status === 'archived' ? status : 'draft'
}

function normalizeAudience(audience: string): OpenDayAudience {
  return audience === 'adult' ? 'adult' : 'youth'
}

function normalizeDurationType(durationType: string): OpenDayDurationType {
  return durationType === 'period' ? 'period' : 'single-event'
}

function normalizeGroupGender(gender: string): OpenDayGroupGender {
  return gender === 'female' ? 'female' : gender === 'mixed' ? 'mixed' : 'male'
}

function normalizeProducts(items: OpenDayProduct[]): OpenDayProduct[] {
  return items.map((item) => ({
    ...item,
    id: item.id.trim(),
    code: item.code.trim(),
    name: item.name.trim(),
    categoryId: item.categoryId.trim(),
    audience: normalizeAudience(item.audience),
    description: item.description ?? '',
    disclaimer: item.disclaimer ?? '',
    ageMin: Number.isFinite(item.ageMin) ? Math.trunc(item.ageMin) : 0,
    ageMax: Number.isFinite(item.ageMax) ? Math.trunc(item.ageMax) : 99,
    status: normalizeStatus(item.status),
  }))
}

function normalizeEditions(items: OpenDayEdition[]): OpenDayEdition[] {
  return items.map((item) => ({
    ...item,
    id: item.id.trim(),
    productId: item.productId.trim(),
    editionYear: Number.isFinite(item.editionYear) ? Math.trunc(item.editionYear) : new Date().getFullYear(),
    status: normalizeStatus(item.status),
    durationType: normalizeDurationType(item.durationType),
    eventDate: item.eventDate ?? '',
    periodStartDate: item.periodStartDate ?? '',
    periodEndDate: item.periodEndDate ?? '',
  }))
}

function normalizeGroups(items: OpenDayGroup[]): OpenDayGroup[] {
  return items.map((item) => ({
    ...item,
    id: item.id.trim(),
    openDayEditionId: item.openDayEditionId.trim(),
    title: item.title.trim(),
    gender: normalizeGroupGender(item.gender),
    birthYearMin: Number.isFinite(item.birthYearMin) ? Math.trunc(item.birthYearMin) : new Date().getFullYear(),
    birthYearMax: Number.isFinite(item.birthYearMax) ? Math.trunc(item.birthYearMax) : new Date().getFullYear(),
    fieldId: item.fieldId.trim(),
    capacity: Number.isFinite(item.capacity) ? Math.trunc(Number(item.capacity)) : null,
    isActive: item.isActive ?? true,
  }))
}

function normalizeSessions(items: OpenDaySession[]): OpenDaySession[] {
  return items.map((item) => ({
    ...item,
    id: item.id.trim(),
    groupId: item.groupId.trim(),
    date: item.date ?? '',
    startTime: item.startTime ?? '',
    endTime: item.endTime ?? '',
    capacity: Number.isFinite(item.capacity) ? Math.trunc(Number(item.capacity)) : null,
    isActive: item.isActive ?? true,
  }))
}

function getDefaults(): MockOpenDayCatalog {
  return mockOpenDays as MockOpenDayCatalog
}

export function getOpenDayCatalogChangedEventName(): string {
  return OPEN_DAY_CATALOG_CHANGED_EVENT
}

export function getOpenDayProducts(): OpenDayProduct[] {
  const stored = readJsonArray<OpenDayProduct>(OPEN_DAY_PRODUCTS_KEY)
  const seeds = normalizeProducts(getDefaults().products ?? [])
  return stored.length > 0 ? normalizeProducts(stored) : seeds
}

export function getOpenDayEditions(): OpenDayEdition[] {
  const stored = readJsonArray<OpenDayEdition>(OPEN_DAY_EDITIONS_KEY)
  const seeds = normalizeEditions(getDefaults().editions ?? [])
  return stored.length > 0 ? normalizeEditions(stored) : seeds
}

export function getOpenDayGroups(): OpenDayGroup[] {
  const stored = readJsonArray<OpenDayGroup>(OPEN_DAY_GROUPS_KEY)
  const seeds = normalizeGroups(getDefaults().groups ?? [])
  return stored.length > 0 ? normalizeGroups(stored) : seeds
}

export function getOpenDaySessions(): OpenDaySession[] {
  const stored = readJsonArray<OpenDaySession>(OPEN_DAY_SESSIONS_KEY)
  const seeds = normalizeSessions(getDefaults().sessions ?? [])
  return stored.length > 0 ? normalizeSessions(stored) : seeds
}

export function setOpenDayProducts(items: OpenDayProduct[]): void {
  writeJsonValue(OPEN_DAY_PRODUCTS_KEY, normalizeProducts(items))
  emitOpenDayCatalogChanged()
}

export function setOpenDayEditions(items: OpenDayEdition[]): void {
  writeJsonValue(OPEN_DAY_EDITIONS_KEY, normalizeEditions(items))
  emitOpenDayCatalogChanged()
}

export function setOpenDayGroups(items: OpenDayGroup[]): void {
  writeJsonValue(OPEN_DAY_GROUPS_KEY, normalizeGroups(items))
  emitOpenDayCatalogChanged()
}

export function setOpenDaySessions(items: OpenDaySession[]): void {
  writeJsonValue(OPEN_DAY_SESSIONS_KEY, normalizeSessions(items))
  emitOpenDayCatalogChanged()
}

function normalizePayload(payload: SaveOpenDayPayload): SaveOpenDayPayload {
  return {
    ...payload,
    code: payload.code.trim(),
    name: payload.name.trim(),
    categoryId: payload.categoryId.trim(),
    description: payload.description.trim(),
    disclaimer: payload.disclaimer.trim(),
    ageMin: Number.isFinite(payload.ageMin) ? Math.trunc(payload.ageMin) : 0,
    ageMax: Number.isFinite(payload.ageMax) ? Math.trunc(payload.ageMax) : 99,
    productStatus: normalizeStatus(payload.productStatus),
    editionYear: Number.isFinite(payload.editionYear) ? Math.trunc(payload.editionYear) : new Date().getFullYear(),
    editionStatus: normalizeStatus(payload.editionStatus),
    durationType: normalizeDurationType(payload.durationType),
    eventDate: payload.eventDate.trim(),
    periodStartDate: payload.periodStartDate.trim(),
    periodEndDate: payload.periodEndDate.trim(),
    groups: payload.groups.map((group) => ({
      id: group.id.trim(),
      title: group.title.trim(),
      gender: normalizeGroupGender(group.gender),
      birthYearMin: Number.isFinite(group.birthYearMin) ? Math.trunc(group.birthYearMin) : new Date().getFullYear(),
      birthYearMax: Number.isFinite(group.birthYearMax) ? Math.trunc(group.birthYearMax) : new Date().getFullYear(),
      fieldId: group.fieldId.trim(),
      capacity: Number.isFinite(group.capacity) ? Math.trunc(Number(group.capacity)) : null,
      isActive: group.isActive ?? true,
      sessions: group.sessions.map((session) => ({
        id: session.id.trim(),
        date: session.date.trim(),
        startTime: session.startTime.trim(),
        endTime: session.endTime.trim(),
        capacity: Number.isFinite(session.capacity) ? Math.trunc(Number(session.capacity)) : null,
        isActive: session.isActive ?? true,
      })),
    })),
  }
}

function validatePayload(payload: SaveOpenDayPayload): SaveOpenDayResult | null {
  if (
    !payload.code ||
    !payload.name ||
    !payload.categoryId ||
    payload.ageMin < 0 ||
    payload.ageMax < payload.ageMin
  ) {
    return { ok: false, error: 'invalid' }
  }
  if (payload.durationType === 'single-event' && !payload.eventDate) {
    return { ok: false, error: 'invalid' }
  }
  if (payload.durationType === 'period' && (!payload.periodStartDate || !payload.periodEndDate)) {
    return { ok: false, error: 'invalid' }
  }
  for (const group of payload.groups) {
    if (!group.title || !group.fieldId || group.birthYearMax < group.birthYearMin || group.sessions.length === 0) {
      return { ok: false, error: 'invalid' }
    }
    for (const session of group.sessions) {
      if (!session.date || !session.startTime || !session.endTime) {
        return { ok: false, error: 'invalid' }
      }
    }
  }
  return null
}

function nextProductId(): string {
  return `open-day-product-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nextEditionId(): string {
  return `open-day-edition-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nextGroupId(): string {
  return `open-day-group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nextSessionId(): string {
  return `open-day-session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createOpenDay(payload: SaveOpenDayPayload): SaveOpenDayResult {
  const normalized = normalizePayload(payload)
  const invalid = validatePayload(normalized)
  if (invalid) {
    return invalid
  }
  const products = getOpenDayProducts()
  if (products.some((item) => item.code.toLowerCase() === normalized.code.toLowerCase())) {
    return { ok: false, error: 'duplicateCode' }
  }
  const product: OpenDayProduct = {
    id: nextProductId(),
    code: normalized.code,
    name: normalized.name,
    categoryId: normalized.categoryId,
    audience: normalized.audience,
    description: normalized.description,
    disclaimer: normalized.disclaimer,
    ageMin: normalized.ageMin,
    ageMax: normalized.ageMax,
    status: normalized.productStatus,
  }
  const edition: OpenDayEdition = {
    id: nextEditionId(),
    productId: product.id,
    editionYear: normalized.editionYear,
    status: normalized.editionStatus,
    durationType: normalized.durationType,
    eventDate: normalized.eventDate,
    periodStartDate: normalized.periodStartDate,
    periodEndDate: normalized.periodEndDate,
  }
  const groups: OpenDayGroup[] = normalized.groups.map((group) => {
    const groupId = group.id || nextGroupId()
    return {
      id: groupId,
      openDayEditionId: edition.id,
      title: group.title,
      gender: group.gender,
      birthYearMin: group.birthYearMin,
      birthYearMax: group.birthYearMax,
      fieldId: group.fieldId,
      capacity: group.capacity,
      isActive: group.isActive,
    }
  })
  const sessions: OpenDaySession[] = normalized.groups.flatMap((group, groupIndex) => {
    const groupId = groups[groupIndex]?.id ?? nextGroupId()
    return group.sessions.map((session) => ({
      id: session.id || nextSessionId(),
      groupId,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      capacity: session.capacity,
      isActive: session.isActive,
    }))
  })
  setOpenDayProducts([...products, product])
  setOpenDayEditions([...getOpenDayEditions(), edition])
  setOpenDayGroups([...getOpenDayGroups(), ...groups])
  setOpenDaySessions([...getOpenDaySessions(), ...sessions])
  return { ok: true, product, edition }
}

export function updateOpenDay(productId: string, editionId: string, payload: SaveOpenDayPayload): SaveOpenDayResult {
  const normalized = normalizePayload(payload)
  const invalid = validatePayload(normalized)
  if (invalid) {
    return invalid
  }
  const products = getOpenDayProducts()
  const editions = getOpenDayEditions()
  const currentProduct = products.find((item) => item.id === productId) ?? null
  const currentEdition = editions.find((item) => item.id === editionId) ?? null
  if (!currentProduct) {
    return { ok: false, error: 'productNotFound' }
  }
  if (!currentEdition || currentEdition.productId !== productId) {
    return { ok: false, error: 'editionNotFound' }
  }
  if (products.some((item) => item.id !== productId && item.code.toLowerCase() === normalized.code.toLowerCase())) {
    return { ok: false, error: 'duplicateCode' }
  }
  if (
    editions.some(
      (item) => item.id !== editionId && item.productId === productId && item.editionYear === normalized.editionYear,
    )
  ) {
    return { ok: false, error: 'duplicateEditionYear' }
  }
  const product: OpenDayProduct = {
    ...currentProduct,
    code: normalized.code,
    name: normalized.name,
    categoryId: normalized.categoryId,
    audience: normalized.audience,
    description: normalized.description,
    disclaimer: normalized.disclaimer,
    ageMin: normalized.ageMin,
    ageMax: normalized.ageMax,
    status: normalized.productStatus,
  }
  const edition: OpenDayEdition = {
    ...currentEdition,
    editionYear: normalized.editionYear,
    status: normalized.editionStatus,
    durationType: normalized.durationType,
    eventDate: normalized.eventDate,
    periodStartDate: normalized.periodStartDate,
    periodEndDate: normalized.periodEndDate,
  }
  const persistedGroups = getOpenDayGroups()
  const persistedSessions = getOpenDaySessions()
  const existingGroupsById = new Map(
    persistedGroups
      .filter((item) => item.openDayEditionId === editionId)
      .map((item) => [item.id, item] as const),
  )
  const groups: OpenDayGroup[] = normalized.groups.map((group) => {
    const groupId = group.id && existingGroupsById.has(group.id) ? group.id : nextGroupId()
    return {
      id: groupId,
      openDayEditionId: editionId,
      title: group.title,
      gender: group.gender,
      birthYearMin: group.birthYearMin,
      birthYearMax: group.birthYearMax,
      fieldId: group.fieldId,
      capacity: group.capacity,
      isActive: group.isActive,
    }
  })
  const sessions: OpenDaySession[] = normalized.groups.flatMap((group, groupIndex) => {
    const groupId = groups[groupIndex]?.id ?? nextGroupId()
    return group.sessions.map((session) => ({
      id: session.id || nextSessionId(),
      groupId,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      capacity: session.capacity,
      isActive: session.isActive,
    }))
  })
  setOpenDayProducts(products.map((item) => (item.id === productId ? product : item)))
  setOpenDayEditions(editions.map((item) => (item.id === editionId ? edition : item)))
  setOpenDayGroups([
    ...persistedGroups.filter((item) => item.openDayEditionId !== editionId),
    ...groups,
  ])
  setOpenDaySessions([
    ...persistedSessions.filter((item) => !existingGroupsById.has(item.groupId)),
    ...sessions,
  ])
  return { ok: true, product, edition }
}

export function removeOpenDay(productId: string, editionId: string): boolean {
  const products = getOpenDayProducts()
  const editions = getOpenDayEditions()
  const groups = getOpenDayGroups()
  const sessions = getOpenDaySessions()
  const targetEdition = editions.find((item) => item.id === editionId && item.productId === productId) ?? null
  if (!targetEdition) {
    return false
  }
  const editionGroupIds = new Set(groups.filter((item) => item.openDayEditionId === editionId).map((item) => item.id))
  const nextEditions = editions.filter((item) => item.id !== editionId)
  setOpenDayEditions(nextEditions)
  setOpenDayGroups(groups.filter((item) => item.openDayEditionId !== editionId))
  setOpenDaySessions(sessions.filter((item) => !editionGroupIds.has(item.groupId)))
  if (!nextEditions.some((item) => item.productId === productId)) {
    setOpenDayProducts(products.filter((item) => item.id !== productId))
  }
  return true
}
