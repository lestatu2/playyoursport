export function getAgeFromBirthDate(birthDate: string): number | null {
  const value = new Date(birthDate)
  if (Number.isNaN(value.getTime())) {
    return null
  }
  const now = new Date()
  let age = now.getFullYear() - value.getFullYear()
  const monthDiff = now.getMonth() - value.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < value.getDate())) {
    age -= 1
  }
  return age
}
