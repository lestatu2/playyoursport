import { getCompanies } from './package-catalog'

const PAYMENT_METHODS_KEY = 'pys_payment_methods'
const PAYMENT_METHODS_CHANGED_EVENT = 'pys-payment-methods-changed'

export type PaymentMethodCode = 'onsite_pos' | 'bank_transfer' | 'paypal'

export type PaymentMethod = {
  code: PaymentMethodCode
  isActive: boolean
}

export type ResolvedPaymentMethod = {
  code: PaymentMethodCode
  details: string
}

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { code: 'onsite_pos', isActive: true },
  { code: 'bank_transfer', isActive: true },
  { code: 'paypal', isActive: true },
]

function emitPaymentMethodsChanged(): void {
  window.dispatchEvent(new Event(PAYMENT_METHODS_CHANGED_EVENT))
}

function readPaymentMethods(): PaymentMethod[] {
  try {
    const raw = localStorage.getItem(PAYMENT_METHODS_KEY)
    if (!raw) {
      return DEFAULT_PAYMENT_METHODS
    }
    const parsed = JSON.parse(raw) as PaymentMethod[]
    if (!Array.isArray(parsed)) {
      return DEFAULT_PAYMENT_METHODS
    }
    const byCode = new Map(parsed.map((item) => [item.code, item]))
    return DEFAULT_PAYMENT_METHODS.map((item) => {
      const found = byCode.get(item.code)
      return found ? { code: item.code, isActive: Boolean(found.isActive) } : item
    })
  } catch {
    return DEFAULT_PAYMENT_METHODS
  }
}

function writePaymentMethods(items: PaymentMethod[]): void {
  localStorage.setItem(PAYMENT_METHODS_KEY, JSON.stringify(items))
  emitPaymentMethodsChanged()
}

export function getPaymentMethodsChangedEventName(): string {
  return PAYMENT_METHODS_CHANGED_EVENT
}

export function getPaymentMethods(): PaymentMethod[] {
  return readPaymentMethods()
}

export function updatePaymentMethodActive(code: PaymentMethodCode, isActive: boolean): PaymentMethod[] {
  const current = readPaymentMethods()
  const next = current.map((item) => (item.code === code ? { ...item, isActive } : item))
  writePaymentMethods(next)
  return next
}

export function getAvailablePaymentMethodsForCompany(companyId: string): ResolvedPaymentMethod[] {
  const activeCodes = new Set(readPaymentMethods().filter((item) => item.isActive).map((item) => item.code))
  const company = getCompanies().find((item) => item.id === companyId) ?? null
  if (!company) {
    return []
  }
  const result: ResolvedPaymentMethod[] = []
  if (activeCodes.has('onsite_pos')) {
    result.push({ code: 'onsite_pos', details: '' })
  }
  if (activeCodes.has('bank_transfer') && company.iban.trim()) {
    result.push({ code: 'bank_transfer', details: company.iban.trim() })
  }
  if (activeCodes.has('paypal') && company.paypalEnabled && company.paypalClientId.trim()) {
    result.push({ code: 'paypal', details: company.paypalClientId.trim() })
  }
  return result
}
