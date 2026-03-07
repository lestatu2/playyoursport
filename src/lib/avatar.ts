import type { MockUser } from './auth'
import type { PublicClientRecord, PublicMinorRecord } from './public-customer-records'
import type { PublicDirectAthleteRecord } from './public-direct-athletes'

export const DICEBEAR_STYLE_OPTIONS = [
  'adventurer',
  'adventurer-neutral',
  'avataaars',
  'avataaars-neutral',
  'big-ears',
  'big-ears-neutral',
  'big-smile',
  'bottts',
  'bottts-neutral',
  'croodles',
  'croodles-neutral',
  'fun-emoji',
  'icons',
  'identicon',
  'initials',
  'lorelei',
  'lorelei-neutral',
  'micah',
  'miniavs',
  'notionists',
  'notionists-neutral',
  'open-peeps',
  'personas',
  'pixel-art',
  'pixel-art-neutral',
  'rings',
  'shapes',
  'thumbs',
] as const

const HUMAN_STYLES = new Set<string>([
  'adventurer',
  'avataaars',
  'big-ears',
  'big-smile',
  'lorelei',
  'miniavs',
  'notionists',
  'open-peeps',
  'personas',
  'thumbs',
])

type AvatarGender = 'M' | 'F'

type DiceBearInput = {
  style: string
  seed: string
  gender?: AvatarGender | null
}

export function buildDiceBearAvatarUrl(input: DiceBearInput): string {
  const requestedStyle = input.style.trim() || 'initials'
  const safeStyle = DICEBEAR_STYLE_OPTIONS.includes(requestedStyle as (typeof DICEBEAR_STYLE_OPTIONS)[number])
    ? requestedStyle
    : 'initials'
  const safeSeed = input.seed.trim() || 'avatar'
  const params = new URLSearchParams({ seed: safeSeed })
  if (input.gender && HUMAN_STYLES.has(safeStyle)) {
    params.set('gender', input.gender === 'F' ? 'female' : 'male')
  }
  return `https://api.dicebear.com/9.x/${encodeURIComponent(safeStyle)}/svg?${params.toString()}`
}

export function resolveUserAvatarUrl(user: MockUser, dicebearStyle: string): string {
  if (user.avatarUrl.trim()) {
    return user.avatarUrl
  }
  const seed = `user-${user.id}`
  return buildDiceBearAvatarUrl({ style: dicebearStyle, seed })
}

export function resolveClientAvatarUrl(client: PublicClientRecord, dicebearStyle: string): string {
  if (client.avatarUrl.trim()) {
    return client.avatarUrl
  }
  const seed = `client-${client.id}`
  return buildDiceBearAvatarUrl({ style: dicebearStyle, seed, gender: client.parentGender ?? null })
}

export function resolveMinorAvatarUrl(
  minor: PublicMinorRecord,
  dicebearStyle: string,
  linkedClient?: PublicClientRecord | null,
): string {
  if (minor.avatarUrl.trim()) {
    return minor.avatarUrl
  }
  const seed = `minor-${minor.id}`
  return buildDiceBearAvatarUrl({ style: dicebearStyle, seed, gender: minor.gender ?? linkedClient?.parentGender ?? null })
}

export function resolveDirectAthleteAvatarUrl(
  direct: PublicDirectAthleteRecord,
  dicebearStyle: string,
  linkedClient?: PublicClientRecord | null,
): string {
  if (direct.avatarUrl.trim()) {
    return direct.avatarUrl
  }
  if (linkedClient) {
    return resolveClientAvatarUrl(linkedClient, dicebearStyle)
  }
  const seed = `direct-${direct.id}`
  return buildDiceBearAvatarUrl({ style: dicebearStyle, seed, gender: direct.gender ?? null })
}
