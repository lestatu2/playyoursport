const MONTH_CODES = ['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M', 'P', 'R', 'S', 'T'] as const
type BelfioreEntry = {
  name: string
  province: string | null
  country: string
  type: 'ITALY' | 'FOREIGN'
}
type ComuneEntry = {
  nome: string
  sigla: string
  codiceCatastale: string
}

const ODD_MAP: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
}

const EVEN_MAP: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
  K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19,
  U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
}

let belfioreCache: Record<string, BelfioreEntry> | null = null
let comuniCache: ComuneEntry[] | null = null

async function getBelfioreMap(): Promise<Record<string, BelfioreEntry>> {
  if (belfioreCache) {
    return belfioreCache
  }
  const module = await import('../data/cf/belfiore-map.json')
  belfioreCache = module.default as Record<string, BelfioreEntry>
  return belfioreCache
}

async function getComuniList(): Promise<ComuneEntry[]> {
  if (comuniCache) {
    return comuniCache
  }
  const module = await import('../data/cf/comuni.json')
  comuniCache = (module.default as ComuneEntry[]) ?? []
  return comuniCache
}

function normalizePlaceName(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '')
}

function extractPlaceTokens(value: string): string[] {
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  const first = parts[0] ?? ''
  const withoutProvince = first.replace(/\s+\([A-Za-z]{2}\)\s*$/, '').trim()
  return [withoutProvince, first, ...parts].filter((part) => part.length > 0)
}

function normalizeLetters(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z]/g, '')
}

function splitConsonantsAndVowels(value: string): { consonants: string[]; vowels: string[] } {
  const letters = normalizeLetters(value).split('')
  const consonants = letters.filter((char) => !'AEIOU'.includes(char))
  const vowels = letters.filter((char) => 'AEIOU'.includes(char))
  return { consonants, vowels }
}

function encodeSurname(value: string): string {
  const { consonants, vowels } = splitConsonantsAndVowels(value)
  return [...consonants, ...vowels, 'X', 'X', 'X'].slice(0, 3).join('')
}

function encodeName(value: string): string {
  const { consonants, vowels } = splitConsonantsAndVowels(value)
  if (consonants.length >= 4) {
    return [consonants[0], consonants[2], consonants[3]].join('')
  }
  return [...consonants, ...vowels, 'X', 'X', 'X'].slice(0, 3).join('')
}

function encodeDatePart(birthDate: string, gender: 'M' | 'F'): string | null {
  const parsed = new Date(birthDate)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  const year = String(parsed.getFullYear()).slice(-2)
  const monthIndex = parsed.getMonth()
  const monthCode = MONTH_CODES[monthIndex]
  if (!monthCode) {
    return null
  }
  const baseDay = parsed.getDate()
  const day = gender === 'F' ? baseDay + 40 : baseDay
  const dayCode = String(day).padStart(2, '0')
  return `${year}${monthCode}${dayCode}`
}

function computeControlChar(partial15: string): string {
  let total = 0
  for (let index = 0; index < partial15.length; index += 1) {
    const char = partial15[index]
    total += index % 2 === 0 ? ODD_MAP[char] ?? 0 : EVEN_MAP[char] ?? 0
  }
  return String.fromCharCode('A'.charCodeAt(0) + (total % 26))
}

export function computeItalianTaxCode(input: {
  firstName: string
  lastName: string
  birthDate: string
  gender: 'M' | 'F'
  birthPlaceCode: string
}): string | null {
  const placeCode = input.birthPlaceCode.trim().toUpperCase()
  if (!/^[A-Z][0-9]{3}$/.test(placeCode)) {
    return null
  }
  const surnameCode = encodeSurname(input.lastName)
  const nameCode = encodeName(input.firstName)
  const datePart = encodeDatePart(input.birthDate, input.gender)
  if (!datePart) {
    return null
  }
  const partial = `${surnameCode}${nameCode}${datePart}${placeCode}`
  const controlChar = computeControlChar(partial)
  return `${partial}${controlChar}`
}

export async function findBirthPlaceCodeByName(placeName: string): Promise<string | null> {
  const candidates = extractPlaceTokens(placeName)
  if (candidates.length === 0) {
    return null
  }
  const comuni = await getComuniList()
  for (const candidate of candidates) {
    const normalizedCandidate = normalizePlaceName(candidate)
    if (!normalizedCandidate) {
      continue
    }
    const exact = comuni.find((item) => normalizePlaceName(item.nome) === normalizedCandidate)
    if (exact) {
      return exact.codiceCatastale
    }
    const startsWith = comuni.find((item) => normalizePlaceName(item.nome).startsWith(normalizedCandidate))
    if (startsWith) {
      return startsWith.codiceCatastale
    }
    const contains = comuni.find((item) => normalizedCandidate.includes(normalizePlaceName(item.nome)))
    if (contains) {
      return contains.codiceCatastale
    }
  }

  const normalizedName = normalizePlaceName(placeName)
  if (!normalizedName) {
    return null
  }
  const map = await getBelfioreMap()
  for (const [code, entry] of Object.entries(map)) {
    if (entry.type !== 'ITALY') {
      continue
    }
    const normalizedEntry = normalizePlaceName(entry.name)
    if (normalizedEntry === normalizedName || normalizedEntry.startsWith(normalizedName)) {
      return code
    }
  }
  return null
}
