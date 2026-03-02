import { getPackages, type SportPackage } from './package-catalog'
import { getProjectSettings } from './project-settings'

function latestEditionByProduct(items: SportPackage[]): SportPackage[] {
  const grouped = new Map<string, SportPackage[]>()
  items.forEach((item) => {
    const key = item.productId || item.id
    const current = grouped.get(key) ?? []
    grouped.set(key, [...current, item])
  })
  return Array.from(grouped.values())
    .map((list) => [...list].sort((left, right) => right.editionYear - left.editionYear)[0])
    .filter((item): item is SportPackage => Boolean(item))
}

export function getCurrentPublicPackageEditions(): SportPackage[] {
  const all = getPackages().filter((item) => item.status !== 'archived')
  return latestEditionByProduct(all)
}

export function getHomepageSliderPackages(): SportPackage[] {
  const settings = getProjectSettings()
  const currentEditions = getCurrentPublicPackageEditions()
  if (!settings.homepageSliderEnabledContentTypes.includes('packages')) {
    return []
  }

  const configured = settings.homepageSliderItems
    .filter((item) => item.contentType === 'packages' && item.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => currentEditions.find((pkg) => pkg.id === item.contentId))
    .filter((item): item is SportPackage => Boolean(item))

  if (configured.length > 0) {
    return configured
  }
  return currentEditions
}

export function resolvePublicPackageImage(item: SportPackage): string {
  const explicit = (item.featuredImage || item.gallery[0]?.src || '').trim()
  if (explicit) {
    return explicit
  }
  if (item.categoryId === 'sport-football') {
    return '/images/calcio.jpg'
  }
  if (item.categoryId === 'sport-tennis' || item.categoryId === 'sport-padel') {
    return '/images/tennis.jpg'
  }
  if (item.categoryId === 'sport-campo-scuola') {
    return '/images/campo_scuola.jpg'
  }
  return ''
}

function getFrequencyLabelItalian(item: SportPackage): string {
  if (!item.recurringPaymentEnabled) {
    return 'periodo'
  }
  if (item.paymentFrequency === 'daily') {
    return 'giorno'
  }
  if (item.paymentFrequency === 'weekly') {
    return 'settimana'
  }
  if (item.paymentFrequency === 'monthly') {
    return 'mese'
  }
  return 'anno'
}

export function getSubscriptionCtaLabel(item: SportPackage): string {
  const settings = getProjectSettings()
  const currency = settings.paymentCurrency || 'EUR'
  const amount = Number.isFinite(item.priceAmount) ? Number(item.priceAmount) : 0
  const formattedAmount = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
  return `Abbonati a partire da ${formattedAmount} al ${getFrequencyLabelItalian(item)}`
}
