export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function dateOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export function isClosedDatedItem(
  input: { durationType: string; periodEndDate?: string; eventDate?: string },
  today: Date,
): boolean {
  if (input.durationType === 'period') {
    const end = parseIsoDate(input.periodEndDate || '')
    return Boolean(end && dateOnly(end) < today)
  }
  const eventDate = parseIsoDate(input.eventDate || '')
  return Boolean(eventDate && dateOnly(eventDate) < today)
}
