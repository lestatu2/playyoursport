import type { PackagePaymentFrequency } from './package-catalog'
import mockActivityPaymentPlans from '../data/mock-activity-payment-plans.json'

const ACTIVITY_PAYMENT_PLANS_KEY = 'pys_activity_payment_plans'

export type InstallmentServiceSnapshot = {
  serviceId: string
  title: string
  kind: 'fixed' | 'variable'
  enabled: boolean
  amount: number
}

export type PaymentInstallment = {
  id: string
  dueDate: string
  amount: number
  label: string
  services: InstallmentServiceSnapshot[]
  paymentMethodCode: string
  paymentStatus: 'pending' | 'paid'
  paymentProofDataUrl: string
  paidAt: string
  unlocked: boolean
}

export type ActivityPaymentPlan = {
  activityKey: string
  packageId: string
  athleteKey: string
  createdAt: string
  config: {
    enrollmentFee: number
    recurringAmount: number
    fixedServicesAmount?: number
    variableServicesAmount?: number
    services?: InstallmentServiceSnapshot[]
    frequency: PackagePaymentFrequency
    recurringEnabled: boolean
    startDate: string
    endDate: string
    selectedPaymentMethodCode?: string
    contractSigned?: boolean
  }
  installments: PaymentInstallment[]
}

function readPlans(): ActivityPaymentPlan[] {
  const seedPlans = (mockActivityPaymentPlans as ActivityPaymentPlan[]).map((item) => normalizePlan(item))
  try {
    const raw = localStorage.getItem(ACTIVITY_PAYMENT_PLANS_KEY)
    if (!raw) {
      return seedPlans
    }
    const parsed = JSON.parse(raw) as ActivityPaymentPlan[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return seedPlans
    }
    const normalizedStored = parsed.map((item) => normalizePlan(item))
    const byActivityKey = new Map(normalizedStored.map((item) => [item.activityKey, item]))
    const merged = [...normalizedStored]
    seedPlans.forEach((seed) => {
      if (!byActivityKey.has(seed.activityKey)) {
        merged.push(seed)
      }
    })
    return merged
  } catch {
    return seedPlans
  }
}

function writePlans(items: ActivityPaymentPlan[]): void {
  localStorage.setItem(ACTIVITY_PAYMENT_PLANS_KEY, JSON.stringify(items))
}

function normalizeAmount(value: unknown): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0
}

function normalizeServices(value: unknown): InstallmentServiceSnapshot[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }
      const typed = item as Partial<InstallmentServiceSnapshot>
      if (!typed.serviceId || !typed.title) {
        return null
      }
      return {
        serviceId: typed.serviceId,
        title: typed.title,
        kind: typed.kind === 'variable' ? 'variable' : 'fixed',
        enabled: typed.enabled ?? true,
        amount: normalizeAmount(typed.amount),
      }
    })
    .filter((item): item is InstallmentServiceSnapshot => Boolean(item))
}

function normalizeInstallment(value: unknown, fallbackMethodCode: string): PaymentInstallment | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const typed = value as Partial<PaymentInstallment> & { status?: 'draft' }
  if (!typed.id || !typed.dueDate || !typed.label) {
    return null
  }
  const paymentStatus = typed.paymentStatus ?? (typed.status === 'draft' ? 'pending' : 'pending')
  return {
    id: typed.id,
    dueDate: typed.dueDate,
    amount: normalizeAmount(typed.amount),
    label: typed.label,
    services: normalizeServices(typed.services),
    paymentMethodCode: typed.paymentMethodCode ?? fallbackMethodCode,
    paymentStatus: paymentStatus === 'paid' ? 'paid' : 'pending',
    paymentProofDataUrl: typed.paymentProofDataUrl ?? '',
    paidAt: typed.paidAt ?? '',
    unlocked: Boolean(typed.unlocked),
  }
}

function normalizePlan(plan: ActivityPaymentPlan): ActivityPaymentPlan {
  const services = normalizeServices(plan.config.services)
  const selectedPaymentMethodCode = plan.config.selectedPaymentMethodCode ?? ''
  const installments = Array.isArray(plan.installments)
    ? plan.installments
        .map((item) => normalizeInstallment(item, selectedPaymentMethodCode))
        .filter((item): item is PaymentInstallment => Boolean(item))
    : []
  return {
    ...plan,
    config: {
      ...plan.config,
      enrollmentFee: normalizeAmount(plan.config.enrollmentFee),
      recurringAmount: normalizeAmount(plan.config.recurringAmount),
      fixedServicesAmount: normalizeAmount(plan.config.fixedServicesAmount),
      variableServicesAmount: normalizeAmount(plan.config.variableServicesAmount),
      services,
      selectedPaymentMethodCode,
      contractSigned: Boolean(plan.config.contractSigned),
      recurringEnabled: Boolean(plan.config.recurringEnabled),
      startDate: plan.config.startDate,
      endDate: plan.config.endDate,
      frequency: plan.config.frequency,
    },
    installments,
  }
}

export function getActivityPaymentPlans(): ActivityPaymentPlan[] {
  return readPlans().map((item) => normalizePlan(item))
}

export function saveActivityPaymentPlan(plan: ActivityPaymentPlan): ActivityPaymentPlan {
  const normalizedPlan = normalizePlan(plan)
  const all = getActivityPaymentPlans()
  const next = [...all.filter((item) => item.activityKey !== normalizedPlan.activityKey), normalizedPlan]
  writePlans(next)
  return normalizedPlan
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function toDate(value: string): Date | null {
  if (!isIsoDate(value)) {
    return null
  }
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function daysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate()
}

function addMonthsSafe(value: Date, months: number, dayOfMonth: number): Date {
  const year = value.getFullYear()
  const month = value.getMonth()
  const targetMonthIndex = month + months
  const targetYear = year + Math.floor(targetMonthIndex / 12)
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12
  const day = Math.min(dayOfMonth, daysInMonth(targetYear, normalizedMonth))
  return new Date(targetYear, normalizedMonth, day)
}

function nextDate(current: Date, frequency: PackagePaymentFrequency, baseDayOfMonth: number): Date {
  if (frequency === 'daily') {
    const next = new Date(current)
    next.setDate(next.getDate() + 1)
    return next
  }
  if (frequency === 'weekly') {
    const next = new Date(current)
    next.setDate(next.getDate() + 7)
    return next
  }
  if (frequency === 'yearly') {
    return addMonthsSafe(current, 12, baseDayOfMonth)
  }
  return addMonthsSafe(current, 1, baseDayOfMonth)
}

export function generateInstallments(input: {
  startDate: string
  endDate: string
  recurringEnabled: boolean
  frequency: PackagePaymentFrequency
  monthlyDueDay?: number | null
  weeklyDueWeekday?: number | null
  enrollmentFee: number
  recurringAmount: number
  services: InstallmentServiceSnapshot[]
  selectedPaymentMethodCode: string
}): PaymentInstallment[] {
  const start = toDate(input.startDate)
  const end = toDate(input.endDate)
  if (!start) {
    return []
  }
  const effectiveEnd = end && end >= start ? end : start
  const servicesAmount = input.services.filter((item) => item.enabled).reduce((sum, item) => sum + normalizeAmount(item.amount), 0)
  const firstAmount = normalizeAmount(input.enrollmentFee) + normalizeAmount(input.recurringAmount) + servicesAmount
  const recurringOnlyAmount = normalizeAmount(input.recurringAmount) + servicesAmount
  const servicesSnapshot = input.services.map((item) => ({ ...item, amount: normalizeAmount(item.amount) }))
  const normalizedMonthlyDueDay =
    Number.isInteger(input.monthlyDueDay) && Number(input.monthlyDueDay) >= 1 && Number(input.monthlyDueDay) <= 31
      ? Number(input.monthlyDueDay)
      : null

  if (!input.recurringEnabled) {
    return [
      {
        id: `ins-1-${input.startDate}`,
        dueDate: toIsoDate(start),
        amount: firstAmount,
        label: 'Rata 1',
        services: servicesSnapshot,
        paymentMethodCode: input.selectedPaymentMethodCode,
        paymentStatus: 'pending',
        paymentProofDataUrl: '',
        paidAt: '',
        unlocked: false,
      },
    ]
  }

  const baseDayOfMonth = start.getDate()
  const dates: Date[] = []
  let cursor = new Date(start)
  let guard = 0
  while (cursor <= effectiveEnd && guard < 500) {
    dates.push(new Date(cursor))
    cursor = nextDate(cursor, input.frequency, baseDayOfMonth)
    guard += 1
  }
  if (dates.length === 0) {
    dates.push(new Date(start))
  }

  return dates.map((date, index) => {
    let dueDate = toIsoDate(date)
    if (input.frequency === 'monthly' && normalizedMonthlyDueDay !== null) {
      const year = date.getFullYear()
      const month = date.getMonth()
      const day = Math.min(normalizedMonthlyDueDay, daysInMonth(year, month))
      dueDate = toIsoDate(new Date(year, month, day))
    }
    return {
    id: `ins-${index + 1}-${toIsoDate(date)}`,
    dueDate,
    amount: index === 0 ? firstAmount : recurringOnlyAmount,
    label: `Rata ${index + 1}`,
    services: servicesSnapshot.map((item) => ({ ...item })),
    paymentMethodCode: input.selectedPaymentMethodCode,
    paymentStatus: 'pending',
    paymentProofDataUrl: '',
    paidAt: '',
    unlocked: false,
  }})
}
