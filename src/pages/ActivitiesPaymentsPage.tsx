import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import {
  getAdditionalServices,
  getPackages,
  type AdditionalService,
  type PackagePaymentFrequency,
} from '../lib/package-catalog'
import { getPublicClients, getPublicMinors } from '../lib/public-customer-records'
import { getPublicDirectAthletes } from '../lib/public-direct-athletes'
import {
  generateInstallments,
  getActivityPaymentPlans,
  saveActivityPaymentPlan,
  type ActivityPaymentPlan,
  type PaymentInstallment,
} from '../lib/activity-payment-plans'

type ActivitiesPaymentsTab = 'activities' | 'deadlines' | 'expired' | 'collections' | 'overdue' | 'history'
type AthleteSubjectType = 'minor' | 'direct_user'
type AthleteActivityItem = {
  key: string
  type: AthleteSubjectType
  athleteId: string
  clientId: number | null
  firstName: string
  lastName: string
  packageId: string
  validationStatus: 'validated' | 'not_validated'
  parentLabel: string
  createdAt: string
  selectedPaymentMethodCode: string
}

type PlanVariableServiceDraft = {
  serviceId: string
  title: string
  kind: 'fixed' | 'variable'
  enabled: boolean
  amount: number
}

type PlanDraft = {
  enrollmentFee: number
  recurringAmount: number
  selectedPaymentMethodCode: string
  services: PlanVariableServiceDraft[]
  startDate: string
  endDate: string
  installments: PaymentInstallment[]
}
type PlanServiceOption = {
  key: string
  serviceId: string
  title: string
  kind: 'fixed' | 'variable'
  amount: number
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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

function safeAmount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('file_read_error'))
    reader.readAsDataURL(file)
  })
}

function isEligibleInstallmentForAutomaticChanges(dueDate: string, paymentStatus: 'pending' | 'paid'): boolean {
  if (paymentStatus !== 'pending') {
    return false
  }
  const due = parseIsoDate(dueDate)
  if (!due) {
    return false
  }
  const today = new Date()
  const dueYear = due.getFullYear()
  const dueMonth = due.getMonth()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth()
  if (dueYear > currentYear) {
    return true
  }
  if (dueYear === currentYear && dueMonth >= currentMonth) {
    return true
  }
  return false
}

function normalizeCreatedAtToIsoDate(createdAt: string): string {
  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) {
    return toIsoDate(new Date())
  }
  return toIsoDate(parsed)
}

function getCurrentPeriodMonthValue(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getPeriodRange(periodMonth: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = periodMonth.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear()
  const safeMonthIndex = Number.isFinite(month) ? Math.min(11, Math.max(0, month - 1)) : 0
  const start = new Date(safeYear, safeMonthIndex, 1)
  const end = new Date(safeYear, safeMonthIndex + 1, 0)
  return { start, end }
}

function dateOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function ActivitiesPaymentsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<ActivitiesPaymentsTab>('activities')
  const [globalSearch, setGlobalSearch] = useState('')
  const [packageFilter, setPackageFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'validated' | 'not_validated'>('all')
  const [plansVersion, setPlansVersion] = useState(0)
  const [activePlanItemKey, setActivePlanItemKey] = useState<string | null>(null)
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null)
  const adminPaymentMethodOptions = ['onsite_pos', 'bank_transfer'] as const
  const [periodMonth, setPeriodMonth] = useState(getCurrentPeriodMonthValue)
  const currentPeriodMonth = getCurrentPeriodMonthValue()
  const [newServiceOptionKey, setNewServiceOptionKey] = useState('')

  const minors = useMemo(() => getPublicMinors(), [])
  const directAthletes = useMemo(() => getPublicDirectAthletes(), [])
  const clientsById = useMemo(() => new Map(getPublicClients().map((item) => [item.id, item])), [])
  const packages = useMemo(() => getPackages(), [])
  const packagesById = useMemo(() => new Map(packages.map((item) => [item.id, item])), [packages])
  const additionalServicesById = useMemo(
    () => new Map(getAdditionalServices().map((service) => [service.id, service])),
    [],
  )
  const plansByActivityKey = useMemo(() => {
    const items = getActivityPaymentPlans()
    return new Map(items.map((item) => [item.activityKey, item]))
  }, [plansVersion])
  const periodRange = useMemo(() => getPeriodRange(periodMonth), [periodMonth])
  const lockedAthleteId = searchParams.get('athleteId')
  const activityItems = useMemo<AthleteActivityItem[]>(() => {
    const minorItems: AthleteActivityItem[] = minors.map((minor) => {
      const parent = clientsById.get(minor.clientId)
      return {
        key: `minor-${minor.id}`,
        type: 'minor',
        athleteId: String(minor.id),
        clientId: minor.clientId,
        firstName: minor.firstName,
        lastName: minor.lastName,
        packageId: minor.packageId,
        validationStatus: minor.validationStatus,
        parentLabel: parent ? `${parent.parentFirstName} ${parent.parentLastName}` : '-',
        createdAt: minor.createdAt,
        selectedPaymentMethodCode: minor.selectedPaymentMethodCode ?? '',
      }
    })
    const directItems: AthleteActivityItem[] = directAthletes.map((athlete) => ({
      key: `direct-${athlete.id}`,
      type: 'direct_user',
      athleteId: athlete.id,
      clientId: athlete.clientId,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      packageId: athlete.packageId,
      validationStatus: athlete.validationStatus,
      parentLabel: '-',
      createdAt: athlete.createdAt,
      selectedPaymentMethodCode: '',
    }))
    return [...minorItems, ...directItems]
  }, [clientsById, directAthletes, minors])
  const lockedAthlete = useMemo(
    () => (lockedAthleteId ? activityItems.find((item) => item.key === lockedAthleteId || item.athleteId === lockedAthleteId) ?? null : null),
    [activityItems, lockedAthleteId],
  )
  const activePlanItem = useMemo(
    () => (activePlanItemKey ? activityItems.find((item) => item.key === activePlanItemKey) ?? null : null),
    [activePlanItemKey, activityItems],
  )
  const activePlanPackage = useMemo(
    () => (activePlanItem ? packagesById.get(activePlanItem.packageId) ?? null : null),
    [activePlanItem, packagesById],
  )
  const activePlanServicesTotal = useMemo(
    () =>
      (planDraft?.services ?? [])
        .filter((item) => item.enabled)
        .reduce((sum, item) => sum + safeAmount(item.amount), 0),
    [planDraft],
  )
  const activePlanServiceOptions = useMemo<PlanServiceOption[]>(() => {
    if (!activePlanPackage) {
      return []
    }
    const optionsMap = new Map<string, PlanServiceOption>()
    activePlanPackage.additionalFixedServices
      .filter((selection) => selection.isActive)
      .forEach((selection) => {
        const service = additionalServicesById.get(selection.serviceId)
        if (!service) {
          return
        }
        const key = `fixed::${service.id}`
        optionsMap.set(key, {
          key,
          serviceId: service.id,
          title: service.title,
          kind: 'fixed',
          amount: Number.isFinite(service.price) ? Number(service.price) : 0,
        })
      })
    activePlanPackage.additionalVariableServices
      .filter((selection) => selection.isActive)
      .forEach((selection) => {
        const service = additionalServicesById.get(selection.serviceId)
        if (!service) {
          return
        }
        const key = `variable::${service.id}`
        optionsMap.set(key, {
          key,
          serviceId: service.id,
          title: service.title,
          kind: 'variable',
          amount: Number.isFinite(service.price) ? Number(service.price) : 0,
        })
      })

    // Fallback: allow other active catalog services to be added manually.
    getAdditionalServices()
      .filter((service) => service.isActive)
      .forEach((service) => {
        const kind: 'fixed' | 'variable' = service.type === 'variable' ? 'variable' : 'fixed'
        const key = `${kind}::${service.id}`
        if (!optionsMap.has(key)) {
          optionsMap.set(key, {
            key,
            serviceId: service.id,
            title: service.title,
            kind,
            amount: Number.isFinite(service.price) ? Number(service.price) : 0,
          })
        }
      })

    return Array.from(optionsMap.values())
  }, [activePlanPackage, additionalServicesById])
  const addableServiceOptions = useMemo(() => {
    if (!planDraft) {
      return [] as PlanServiceOption[]
    }
    const used = new Set(planDraft.services.map((item) => `${item.kind}::${item.serviceId}`))
    return activePlanServiceOptions.filter((item) => !used.has(item.key))
  }, [activePlanServiceOptions, planDraft])

  const buildInstallments = (
    draft: Pick<PlanDraft, 'enrollmentFee' | 'recurringAmount' | 'services' | 'startDate' | 'endDate'>,
    packageItem: {
      recurringPaymentEnabled: boolean
      paymentFrequency: PackagePaymentFrequency
      monthlyDueDay: number | null
      weeklyDueWeekday: number | null
    },
    selectedPaymentMethodCode: string,
  ) =>
    generateInstallments({
      startDate: draft.startDate,
      endDate: draft.endDate,
      recurringEnabled: packageItem.recurringPaymentEnabled,
      frequency: packageItem.paymentFrequency,
      monthlyDueDay: packageItem.monthlyDueDay,
      weeklyDueWeekday: packageItem.weeklyDueWeekday,
      enrollmentFee: safeAmount(draft.enrollmentFee),
      recurringAmount: safeAmount(draft.recurringAmount),
      services: draft.services.map((item) => ({ ...item, amount: safeAmount(item.amount) })),
      selectedPaymentMethodCode,
    })

  const applyAutomaticRulesOnInstallments = (
    draft: Pick<PlanDraft, 'installments' | 'services' | 'enrollmentFee' | 'recurringAmount'>,
  ) =>
    draft.installments.map((installment, index) => {
      if (!isEligibleInstallmentForAutomaticChanges(installment.dueDate, installment.paymentStatus)) {
        return installment
      }
      const servicesSnapshot = draft.services.map((item) => ({ ...item, amount: safeAmount(item.amount) }))
      const servicesAmount = servicesSnapshot
        .filter((item) => item.enabled)
        .reduce((sum, item) => sum + safeAmount(item.amount), 0)
      const nextAmount =
        safeAmount(draft.recurringAmount) +
        servicesAmount +
        (index === 0 ? safeAmount(draft.enrollmentFee) : 0)
      return {
        ...installment,
        services: servicesSnapshot,
        amount: nextAmount,
      }
    })

  const updatePlanDraftAndInstallments = (
    updater: (prev: PlanDraft) => PlanDraft,
  ) => {
    setPlanDraft((prev) => {
      if (!prev) {
        return prev
      }
      const next = updater(prev)
      return {
        ...next,
        installments: applyAutomaticRulesOnInstallments(next),
      }
    })
  }

  const filteredActivities = useMemo(() => {
    const periodStart = dateOnly(periodRange.start)
    const periodEnd = dateOnly(periodRange.end)
    return activityItems.filter((item) => {
      const isLegacyMinorIdMatch = lockedAthleteId === item.athleteId
      if (lockedAthleteId && lockedAthleteId !== item.key && !isLegacyMinorIdMatch) {
        return false
      }
      const packageItem = packagesById.get(item.packageId)
      const searchHaystack = [
        item.firstName,
        item.lastName,
        item.parentLabel,
        item.packageId,
        packageItem?.name ?? '',
      ]
        .join(' ')
        .toLowerCase()
      if (globalSearch.trim() && !searchHaystack.includes(globalSearch.trim().toLowerCase())) {
        return false
      }
      if (packageFilter !== 'all' && item.packageId !== packageFilter) {
        return false
      }
      if (statusFilter !== 'all' && item.validationStatus !== statusFilter) {
        return false
      }
      const plan = plansByActivityKey.get(item.key)
      if (!plan) {
        return true
      }
      const hasPendingInPeriod = plan.installments.some((installment) => {
        if (installment.paymentStatus !== 'pending') {
          return false
        }
        const due = parseIsoDate(installment.dueDate)
        if (!due) {
          return false
        }
        const value = dateOnly(due)
        return value >= periodStart && value <= periodEnd
      })
      if (!hasPendingInPeriod) {
        return false
      }
      return true
    })
  }, [activityItems, globalSearch, lockedAthleteId, packageFilter, packagesById, periodRange.end, periodRange.start, plansByActivityKey, statusFilter])

  const installmentRows = useMemo(() => {
    const rows: Array<{
      activity: AthleteActivityItem
      installment: PaymentInstallment
      installmentIndex: number
      packageName: string
    }> = []
    activityItems.forEach((activity) => {
      const plan = plansByActivityKey.get(activity.key)
      if (!plan) {
        return
      }
      const packageName = packagesById.get(activity.packageId)?.name ?? activity.packageId
      plan.installments.forEach((installment, installmentIndex) => {
        rows.push({ activity, installment, installmentIndex, packageName })
      })
    })
    return rows
  }, [activityItems, packagesById, plansByActivityKey])

  const periodScadenzeRows = useMemo(() => {
    const start = dateOnly(periodRange.start)
    const end = dateOnly(periodRange.end)
    const today = dateOnly(new Date())
    return installmentRows.filter((row) => {
      if (row.installment.paymentStatus !== 'pending') {
        return false
      }
      const due = parseIsoDate(row.installment.dueDate)
      if (!due) {
        return false
      }
      const value = dateOnly(due)
      return value >= start && value <= end && value >= today
    })
  }, [installmentRows, periodRange.end, periodRange.start])

  const periodScaduteRows = useMemo(() => {
    const start = dateOnly(periodRange.start)
    const end = dateOnly(periodRange.end)
    const today = dateOnly(new Date())
    return installmentRows.filter((row) => {
      if (row.installment.paymentStatus !== 'pending') {
        return false
      }
      const due = parseIsoDate(row.installment.dueDate)
      if (!due) {
        return false
      }
      const value = dateOnly(due)
      return value >= start && value <= end && value < today
    })
  }, [installmentRows, periodRange.end, periodRange.start])

  const periodIncassiRows = useMemo(() => {
    const end = dateOnly(periodRange.end)
    return installmentRows.filter((row) => {
      if (row.installment.paymentStatus !== 'paid') {
        return false
      }
      const paidDate = parseIsoDate((row.installment.paidAt || '').slice(0, 10))
      const fallbackDate = parseIsoDate(row.installment.dueDate)
      const value = dateOnly(paidDate ?? fallbackDate ?? new Date(0))
      return value <= end
    })
  }, [installmentRows, periodRange.end])

  const periodInsolutiRows = useMemo(() => {
    const periodStart = dateOnly(periodRange.start)
    return installmentRows.filter((row) => {
      if (row.installment.paymentStatus !== 'pending') {
        return false
      }
      const due = parseIsoDate(row.installment.dueDate)
      if (!due) {
        return false
      }
      const value = dateOnly(due)
      return value < periodStart
    })
  }, [installmentRows, periodRange.start])

  const openPlanModal = (item: AthleteActivityItem) => {
    const packageItem = packagesById.get(item.packageId)
    if (!packageItem) {
      return
    }
    const existingPlan = plansByActivityKey.get(item.key) ?? null
    const enrollmentDate = normalizeCreatedAtToIsoDate(item.createdAt)
    const periodStart = packageItem.periodStartDate || enrollmentDate
    const periodEnd = packageItem.periodEndDate || periodStart
    const enrollmentDateObj = parseIsoDate(enrollmentDate)
    const periodStartObj = parseIsoDate(periodStart)
    const startDate =
      enrollmentDateObj && periodStartObj && enrollmentDateObj < periodStartObj
        ? periodStart
        : enrollmentDate
    const fallbackEndDate = packageItem.durationType === 'period' ? periodEnd : startDate
    const fixedServices = packageItem.additionalFixedServices
      .filter((selection) => selection.isActive)
      .map((selection) => additionalServicesById.get(selection.serviceId))
      .filter((itemService): itemService is AdditionalService => Boolean(itemService))
    const variableServices = packageItem.additionalVariableServices
      .filter((selection) => selection.isActive)
      .map((selection) => additionalServicesById.get(selection.serviceId))
      .filter((itemService): itemService is AdditionalService => Boolean(itemService))

    const fixedServicesDraft: PlanVariableServiceDraft[] = fixedServices.map((service) => ({
      serviceId: service.id,
      title: service.title,
      kind: 'fixed',
      enabled: true,
      amount: Number.isFinite(service.price) ? Number(service.price) : 0,
    }))
    const variableServicesDraft: PlanVariableServiceDraft[] = variableServices.map((service) => ({
      serviceId: service.id,
      title: service.title,
      kind: 'variable',
      enabled: true,
      amount: Number.isFinite(service.price) ? Number(service.price) : 0,
    }))
    const defaultServicesDraft = [...fixedServicesDraft, ...variableServicesDraft]

    const servicesFromPlan = existingPlan?.config.services
    const servicesDraft = Array.isArray(servicesFromPlan) && servicesFromPlan.length > 0
      ? servicesFromPlan.map((item) => ({
          serviceId: item.serviceId,
          title: item.title,
          kind: item.kind,
          enabled: item.enabled,
          amount: safeAmount(item.amount),
        }))
      : defaultServicesDraft
    const baseDraft: Omit<PlanDraft, 'installments'> = existingPlan
      ? {
          enrollmentFee: existingPlan.config.enrollmentFee,
          recurringAmount: existingPlan.config.recurringAmount,
          selectedPaymentMethodCode: (existingPlan.config.selectedPaymentMethodCode ?? item.selectedPaymentMethodCode) || 'onsite_pos',
          services: servicesDraft,
          startDate: existingPlan.config.startDate,
          endDate: existingPlan.config.endDate,
        }
      : {
          enrollmentFee: packageItem.enrollmentPrice,
          recurringAmount: packageItem.priceAmount,
          selectedPaymentMethodCode: item.selectedPaymentMethodCode || 'onsite_pos',
          services: servicesDraft,
          startDate,
          endDate: fallbackEndDate,
        }
    const fallbackInstallments = buildInstallments(baseDraft, packageItem, baseDraft.selectedPaymentMethodCode)
    const installments =
      existingPlan?.installments && existingPlan.installments.length > 0
        ? existingPlan.installments
        : fallbackInstallments
    setPlanDraft({ ...baseDraft, installments })
    setNewServiceOptionKey('')
    setActivePlanItemKey(item.key)
  }

  const closePlanModal = () => {
    setActivePlanItemKey(null)
    setPlanDraft(null)
    setNewServiceOptionKey('')
  }

  const addServiceToDraft = () => {
    if (!planDraft) {
      return
    }
    const fallbackKey = addableServiceOptions[0]?.key ?? ''
    const selectedKey = newServiceOptionKey || fallbackKey
    const selected = addableServiceOptions.find((item) => item.key === selectedKey)
    if (!selected) {
      return
    }
    updatePlanDraftAndInstallments((prev) => ({
      ...prev,
      services: [
        ...prev.services,
        {
          serviceId: selected.serviceId,
          title: selected.title,
          kind: selected.kind,
          enabled: true,
          amount: selected.amount,
        },
      ],
    }))
    setNewServiceOptionKey('')
  }

  const updateInstallment = (
    installmentIndex: number,
    updater: (current: PaymentInstallment) => PaymentInstallment,
  ) => {
    setPlanDraft((prev) => {
      if (!prev) {
        return prev
      }
      const nextInstallments = [...prev.installments]
      const current = nextInstallments[installmentIndex]
      if (!current) {
        return prev
      }
      nextInstallments[installmentIndex] = updater(current)
      return { ...prev, installments: nextInstallments }
    })
  }

  const markInstallmentPaid = (installmentIndex: number) => {
    updateInstallment(installmentIndex, (current) => ({
      ...current,
      paymentStatus: 'paid',
      paidAt: new Date().toISOString(),
      unlocked: false,
    }))
  }

  const toggleInstallmentUnlock = (installmentIndex: number) => {
    updateInstallment(installmentIndex, (current) => ({
      ...current,
      unlocked: !current.unlocked,
    }))
  }

  const uploadInstallmentProof = async (installmentIndex: number, file: File | null) => {
    if (!file) {
      return
    }
    const dataUrl = await readFileAsDataUrl(file)
    updateInstallment(installmentIndex, (current) => ({
      ...current,
      paymentProofDataUrl: dataUrl,
    }))
  }

  const savePlan = () => {
    if (!activePlanItem || !activePlanPackage || !planDraft) {
      return
    }
    const fixedServicesAmount = planDraft.services
      .filter((item) => item.kind === 'fixed' && item.enabled)
      .reduce((sum, item) => sum + safeAmount(item.amount), 0)
    const variableServicesAmount = planDraft.services
      .filter((item) => item.kind === 'variable' && item.enabled)
      .reduce((sum, item) => sum + safeAmount(item.amount), 0)
    const payload: ActivityPaymentPlan = {
      activityKey: activePlanItem.key,
      packageId: activePlanItem.packageId,
      athleteKey: activePlanItem.key,
      createdAt: new Date().toISOString(),
      config: {
        enrollmentFee: safeAmount(planDraft.enrollmentFee),
        recurringAmount: safeAmount(planDraft.recurringAmount),
        fixedServicesAmount,
        variableServicesAmount,
        services: planDraft.services.map((item) => ({
          serviceId: item.serviceId,
          title: item.title,
          kind: item.kind,
          enabled: item.enabled,
          amount: safeAmount(item.amount),
        })),
        selectedPaymentMethodCode: planDraft.selectedPaymentMethodCode,
        frequency: activePlanPackage.paymentFrequency as PackagePaymentFrequency,
        recurringEnabled: activePlanPackage.recurringPaymentEnabled,
        startDate: planDraft.startDate,
        endDate: planDraft.endDate,
      },
      installments: planDraft.installments.map((item) => ({
        ...item,
        paymentMethodCode: item.paymentMethodCode || planDraft.selectedPaymentMethodCode,
        amount: safeAmount(item.amount),
      })),
    }
    saveActivityPaymentPlan(payload)
    setPlansVersion((prev) => prev + 1)
    closePlanModal()
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{t('activitiesPayments.title')}</h2>
        <p className="text-sm opacity-70">{t('activitiesPayments.description')}</p>
      </div>

      {lockedAthlete ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
          {t('activitiesPayments.filters.lockedAthlete')}: {lockedAthlete.firstName} {lockedAthlete.lastName}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-base-300 bg-base-100 p-3 md:grid-cols-4">
        <label className="form-control">
          <span className="label-text mb-1 text-xs">{t('activitiesPayments.filters.search')}</span>
          <input
            className="input input-bordered w-full"
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
            placeholder={t('activitiesPayments.filters.searchPlaceholder')}
          />
        </label>
        <label className="form-control">
          <span className="label-text mb-1 text-xs">{t('activitiesPayments.filters.package')}</span>
          <select className="select select-bordered w-full" value={packageFilter} onChange={(event) => setPackageFilter(event.target.value)}>
            <option value="all">{t('activitiesPayments.filters.allPackages')}</option>
            {packages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-control">
          <span className="label-text mb-1 text-xs">{t('activitiesPayments.filters.validation')}</span>
          <select
            className="select select-bordered w-full"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | 'validated' | 'not_validated')}
          >
            <option value="all">{t('activitiesPayments.filters.allStatuses')}</option>
            <option value="validated">{t('athletes.validated')}</option>
            <option value="not_validated">{t('athletes.notValidated')}</option>
          </select>
        </label>
        <label className="form-control">
          <span className="label-text mb-1 text-xs">{t('activitiesPayments.filters.periodMonth')}</span>
          <input
            type="month"
            className="input input-bordered w-full"
            value={periodMonth}
            max={currentPeriodMonth}
            onChange={(event) => {
              const next = event.target.value || currentPeriodMonth
              setPeriodMonth(next > currentPeriodMonth ? currentPeriodMonth : next)
            }}
          />
        </label>
      </div>

      <div role="tablist" className="tabs tabs-boxed bg-base-200">
        <button type="button" role="tab" className={`tab ${tab === 'activities' ? 'tab-active' : ''}`} onClick={() => setTab('activities')}>
          {t('activitiesPayments.tabs.activities')}
        </button>
        <button type="button" role="tab" className={`tab ${tab === 'deadlines' ? 'tab-active' : ''}`} onClick={() => setTab('deadlines')}>
          {t('activitiesPayments.tabs.deadlines')}
        </button>
        <button type="button" role="tab" className={`tab ${tab === 'expired' ? 'tab-active' : ''}`} onClick={() => setTab('expired')}>
          {t('activitiesPayments.tabs.expired')}
        </button>
        <button type="button" role="tab" className={`tab ${tab === 'collections' ? 'tab-active' : ''}`} onClick={() => setTab('collections')}>
          {t('activitiesPayments.tabs.collections')}
        </button>
        <button type="button" role="tab" className={`tab ${tab === 'overdue' ? 'tab-active' : ''}`} onClick={() => setTab('overdue')}>
          {t('activitiesPayments.tabs.overdue')}
        </button>
        <button type="button" role="tab" className={`tab ${tab === 'history' ? 'tab-active' : ''}`} onClick={() => setTab('history')}>
          {t('activitiesPayments.tabs.history')}
        </button>
      </div>

      {tab === 'activities' ? (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table">
            <thead>
              <tr>
                <th>{t('activitiesPayments.table.athlete')}</th>
                <th>{t('activitiesPayments.table.athleteType')}</th>
                <th>{t('activitiesPayments.table.parent')}</th>
                <th>{t('activitiesPayments.table.package')}</th>
                <th>{t('activitiesPayments.table.period')}</th>
                <th>{t('activitiesPayments.table.paymentStatus')}</th>
                <th>{t('activitiesPayments.table.plan')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-sm opacity-70">
                    {t('activitiesPayments.empty')}
                  </td>
                </tr>
              ) : (
                filteredActivities.map((item) => {
                  const packageItem = packagesById.get(item.packageId)
                  const plan = plansByActivityKey.get(item.key) ?? null
                  const periodLabel = packageItem?.durationType === 'period'
                    ? `${packageItem.periodStartDate || '-'} - ${packageItem.periodEndDate || '-'}`
                    : packageItem?.eventDate || '-'
                  return (
                    <tr key={item.key}>
                      <td>
                        {item.type === 'direct_user' && item.clientId !== null ? (
                          <button
                            type="button"
                            className="link text-base-content text-left"
                            onClick={() => navigate(`/app/clienti?clientId=${item.clientId}`)}
                          >
                            {item.firstName} {item.lastName}
                          </button>
                        ) : item.type === 'minor' ? (
                          <button
                            type="button"
                            className="link text-base-content text-left"
                            onClick={() => navigate(`/app/atleti?athleteId=${item.key}`)}
                          >
                            {item.firstName} {item.lastName}
                          </button>
                        ) : (
                          <span>{item.firstName} {item.lastName}</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${item.type === 'minor' ? 'badge-info' : 'badge-primary'}`}>
                          {item.type === 'minor'
                            ? t('activitiesPayments.types.minor')
                            : t('activitiesPayments.types.directUser')}
                        </span>
                      </td>
                      <td>
                        {item.type === 'minor' && item.clientId !== null ? (
                          <button
                            type="button"
                            className="link text-base-content text-left"
                            onClick={() => navigate(`/app/clienti?clientId=${item.clientId}`)}
                          >
                            {item.parentLabel}
                          </button>
                        ) : (
                          item.parentLabel
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="link text-base-content text-left"
                          onClick={() => navigate(`/app/pacchetti?packageId=${item.packageId}`)}
                        >
                          {packageItem?.name ?? item.packageId}
                        </button>
                      </td>
                      <td>
                        <div className="text-sm">
                          <p><span className="font-medium">{t('activitiesPayments.period.current')}:</span> {periodMonth}</p>
                          <p className="opacity-70"><span className="font-medium">{t('activitiesPayments.period.total')}:</span> {periodLabel}</p>
                        </div>
                      </td>
                      <td>
                        {(() => {
                          const plan = plansByActivityKey.get(item.key)
                          if (!plan) {
                            return <span className="badge badge-ghost">{t('activitiesPayments.status.noPlan')}</span>
                          }
                          const periodStart = dateOnly(periodRange.start)
                          const periodEnd = dateOnly(periodRange.end)
                          const today = dateOnly(new Date())
                          const currentInstallments = plan.installments.filter((installment) => {
                            const due = parseIsoDate(installment.dueDate)
                            if (!due) {
                              return false
                            }
                            const value = dateOnly(due)
                            return value >= periodStart && value <= periodEnd
                          })
                          const insolutiCount = plan.installments.filter((installment) => {
                            if (installment.paymentStatus !== 'pending') {
                              return false
                            }
                            const due = parseIsoDate(installment.dueDate)
                            if (!due) {
                              return false
                            }
                            return dateOnly(due) < periodStart
                          }).length
                          if (currentInstallments.length === 0) {
                            if (insolutiCount > 0) {
                              return (
                                <div className="space-y-1">
                                  <span className="badge badge-error">{t('activitiesPayments.status.insoluti')}</span>
                                  <p className="text-xs opacity-70">{t('activitiesPayments.status.insolutiCount', { count: insolutiCount })}</p>
                                </div>
                              )
                            }
                            return <span className="badge badge-ghost">{t('activitiesPayments.status.noInstallmentInPeriod')}</span>
                          }

                          const pendingCurrent = currentInstallments.filter((installment) => installment.paymentStatus === 'pending')
                          const expiredCurrentCount = pendingCurrent.filter((installment) => {
                            const due = parseIsoDate(installment.dueDate)
                            if (!due) {
                              return false
                            }
                            return dateOnly(due) < today
                          }).length

                          if (expiredCurrentCount > 0) {
                            return (
                              <div className="space-y-1">
                                <span className="badge badge-error">{t('activitiesPayments.status.scaduta')}</span>
                                {insolutiCount > 0 ? (
                                  <p className="text-xs opacity-70">{t('activitiesPayments.status.insolutiCount', { count: insolutiCount })}</p>
                                ) : null}
                              </div>
                            )
                          }

                          if (pendingCurrent.length === 0) {
                            return (
                              <div className="space-y-1">
                                <span className="badge badge-success">{t('activitiesPayments.status.inRegola')}</span>
                                <p className="text-xs opacity-70">{t('activitiesPayments.status.currentPaid')}</p>
                              </div>
                            )
                          }

                          return (
                            <div className="space-y-1">
                              <span className="badge badge-warning">{t('activitiesPayments.status.inScadenza')}</span>
                              <p className="text-xs opacity-70">
                                {t('activitiesPayments.status.currentPendingCount', { count: pendingCurrent.length })}
                              </p>
                              {insolutiCount > 0 ? (
                                <p className="text-xs opacity-70">{t('activitiesPayments.status.insolutiCount', { count: insolutiCount })}</p>
                              ) : null}
                            </div>
                          )
                        })()}
                      </td>
                      <td>
                        <button type="button" className="btn btn-xs btn-outline" onClick={() => openPlanModal(item)}>
                          {plan
                            ? t('activitiesPayments.workflow.planGenerated', { count: plan.installments.length })
                            : t('activitiesPayments.workflow.generatePlan')}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'deadlines' ? (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table">
            <thead>
              <tr>
                <th>{t('activitiesPayments.table.athlete')}</th>
                <th>{t('activitiesPayments.table.package')}</th>
                <th>{t('activitiesPayments.plan.dueDate')}</th>
                <th>{t('activitiesPayments.plan.amount')}</th>
                <th>{t('activitiesPayments.plan.paymentMethod')}</th>
                <th>{t('activitiesPayments.plan.paymentStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {periodScadenzeRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-sm opacity-70">{t('activitiesPayments.empty')}</td>
                </tr>
              ) : (
                periodScadenzeRows.map((row) => (
                  <tr key={`deadline-${row.activity.key}-${row.installment.id}`}>
                    <td>{row.activity.firstName} {row.activity.lastName}</td>
                    <td>{row.packageName}</td>
                    <td>{row.installment.dueDate}</td>
                    <td>{row.installment.amount.toFixed(2)}</td>
                    <td>{t(`utility.paymentMethods.methods.${row.installment.paymentMethodCode || 'onsite_pos'}.label`)}</td>
                    <td><span className="badge badge-warning">{t('activitiesPayments.status.inScadenza')}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'collections' ? (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table">
            <thead>
              <tr>
                <th>{t('activitiesPayments.table.athlete')}</th>
                <th>{t('activitiesPayments.table.package')}</th>
                <th>{t('activitiesPayments.plan.dueDate')}</th>
                <th>{t('activitiesPayments.plan.amount')}</th>
                <th>{t('activitiesPayments.plan.paymentMethod')}</th>
                <th>{t('activitiesPayments.plan.paymentStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {periodIncassiRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-sm opacity-70">{t('activitiesPayments.empty')}</td>
                </tr>
              ) : (
                periodIncassiRows.map((row) => (
                  <tr key={`collection-${row.activity.key}-${row.installment.id}`}>
                    <td>{row.activity.firstName} {row.activity.lastName}</td>
                    <td>{row.packageName}</td>
                    <td>{row.installment.dueDate}</td>
                    <td>{row.installment.amount.toFixed(2)}</td>
                    <td>{t(`utility.paymentMethods.methods.${row.installment.paymentMethodCode || 'onsite_pos'}.label`)}</td>
                    <td><span className="badge badge-success">{t('activitiesPayments.plan.paid')}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'expired' ? (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table">
            <thead>
              <tr>
                <th>{t('activitiesPayments.table.athlete')}</th>
                <th>{t('activitiesPayments.table.package')}</th>
                <th>{t('activitiesPayments.plan.dueDate')}</th>
                <th>{t('activitiesPayments.plan.amount')}</th>
                <th>{t('activitiesPayments.plan.paymentMethod')}</th>
                <th>{t('activitiesPayments.plan.paymentStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {periodScaduteRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-sm opacity-70">{t('activitiesPayments.empty')}</td>
                </tr>
              ) : (
                periodScaduteRows.map((row) => (
                  <tr key={`expired-${row.activity.key}-${row.installment.id}`}>
                    <td>{row.activity.firstName} {row.activity.lastName}</td>
                    <td>{row.packageName}</td>
                    <td>{row.installment.dueDate}</td>
                    <td>{row.installment.amount.toFixed(2)}</td>
                    <td>{t(`utility.paymentMethods.methods.${row.installment.paymentMethodCode || 'onsite_pos'}.label`)}</td>
                    <td><span className="badge badge-error">{t('activitiesPayments.status.scaduta')}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'overdue' ? (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table">
            <thead>
              <tr>
                <th>{t('activitiesPayments.table.athlete')}</th>
                <th>{t('activitiesPayments.table.package')}</th>
                <th>{t('activitiesPayments.plan.dueDate')}</th>
                <th>{t('activitiesPayments.plan.amount')}</th>
                <th>{t('activitiesPayments.plan.paymentMethod')}</th>
                <th>{t('activitiesPayments.plan.paymentStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {periodInsolutiRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-sm opacity-70">{t('activitiesPayments.empty')}</td>
                </tr>
              ) : (
                periodInsolutiRows.map((row) => (
                  <tr key={`overdue-${row.activity.key}-${row.installment.id}`}>
                    <td>{row.activity.firstName} {row.activity.lastName}</td>
                    <td>{row.packageName}</td>
                    <td>{row.installment.dueDate}</td>
                    <td>{row.installment.amount.toFixed(2)}</td>
                    <td>{t(`utility.paymentMethods.methods.${row.installment.paymentMethodCode || 'onsite_pos'}.label`)}</td>
                    <td><span className="badge badge-error">{t('activitiesPayments.status.insoluti')}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="rounded-lg border border-base-300 bg-base-100 p-6 text-sm opacity-80">
          {t('activitiesPayments.placeholder')}
        </div>
      ) : null}

      {activePlanItem && activePlanPackage && planDraft ? (
        <dialog className="modal modal-open">
          <div className="modal-box w-11/12 max-w-6xl">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">
                {activePlanItem.firstName} {activePlanItem.lastName} - {activePlanPackage.name}
              </h3>
              <span className="badge badge-outline">
                {t(`utility.packages.paymentFrequency${activePlanPackage.paymentFrequency[0].toUpperCase()}${activePlanPackage.paymentFrequency.slice(1)}`)}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('activitiesPayments.plan.enrollmentFee')}</span>
                <input
                  type="number"
                  min={0}
                  className="input input-bordered w-full"
                  value={planDraft.enrollmentFee}
                  onChange={(event) => updatePlanDraftAndInstallments((prev) => ({ ...prev, enrollmentFee: Number(event.target.value) }))}
                />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('activitiesPayments.plan.recurringAmount')}</span>
                <input
                  type="number"
                  min={0}
                  className="input input-bordered w-full"
                  value={planDraft.recurringAmount}
                  onChange={(event) => updatePlanDraftAndInstallments((prev) => ({ ...prev, recurringAmount: Number(event.target.value) }))}
                />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('activitiesPayments.plan.startDate')}</span>
                <input type="date" className="input input-bordered w-full" value={planDraft.startDate} readOnly />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('activitiesPayments.plan.endDate')}</span>
                <input type="date" className="input input-bordered w-full" value={planDraft.endDate} readOnly />
              </label>
            </div>

            {planDraft.services.length > 0 ? (
              <div className="mt-4 rounded border border-base-300 p-3">
                <p className="text-sm font-semibold">{t('activitiesPayments.plan.services')}</p>
                <div className="mt-2 flex flex-col gap-2 md:flex-row">
                  <select
                    className="select select-bordered w-full"
                    value={newServiceOptionKey || addableServiceOptions[0]?.key || ''}
                    onChange={(event) => setNewServiceOptionKey(event.target.value)}
                  >
                    {addableServiceOptions.length === 0 ? (
                      <option value="">{t('activitiesPayments.plan.noServiceAvailable')}</option>
                    ) : (
                      addableServiceOptions.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.title} ({item.kind === 'fixed' ? t('activitiesPayments.plan.fixedService') : t('activitiesPayments.plan.variableService')})
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={addServiceToDraft}
                    disabled={addableServiceOptions.length === 0}
                  >
                    <Plus className="h-4 w-4" />
                    {t('activitiesPayments.plan.addService')}
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {planDraft.services.map((itemService, index) => (
                    <div key={itemService.serviceId} className="grid grid-cols-1 gap-2 rounded border border-base-300 p-2 md:grid-cols-3">
                      <label className="label cursor-pointer justify-start gap-2">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary"
                          checked={itemService.enabled}
                          onChange={(event) =>
                            updatePlanDraftAndInstallments((prev) => {
                              const next = [...prev.services]
                              next[index] = { ...next[index], enabled: event.target.checked }
                              return { ...prev, services: next }
                            })
                          }
                        />
                        <span className="label-text">
                          {itemService.title} ({itemService.kind === 'fixed' ? t('activitiesPayments.plan.fixedService') : t('activitiesPayments.plan.variableService')})
                        </span>
                      </label>
                      <div className="md:col-span-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            className="input input-bordered w-full"
                            value={itemService.amount}
                            onChange={(event) =>
                              updatePlanDraftAndInstallments((prev) => {
                                const next = [...prev.services]
                                next[index] = { ...next[index], amount: Number(event.target.value) }
                                return { ...prev, services: next }
                              })
                            }
                          />
                          <button
                            type="button"
                            className="btn btn-ghost btn-square"
                            title={t('activitiesPayments.plan.removeService')}
                            onClick={() =>
                              updatePlanDraftAndInstallments((prev) => ({
                                ...prev,
                                services: prev.services.filter((_, currentIndex) => currentIndex !== index),
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4 text-error" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded border border-base-300 p-3">
                <p className="text-sm font-semibold">{t('activitiesPayments.plan.services')}</p>
                <div className="mt-2 flex flex-col gap-2 md:flex-row">
                  <select
                    className="select select-bordered w-full"
                    value={newServiceOptionKey || addableServiceOptions[0]?.key || ''}
                    onChange={(event) => setNewServiceOptionKey(event.target.value)}
                  >
                    {addableServiceOptions.length === 0 ? (
                      <option value="">{t('activitiesPayments.plan.noServiceAvailable')}</option>
                    ) : (
                      addableServiceOptions.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.title} ({item.kind === 'fixed' ? t('activitiesPayments.plan.fixedService') : t('activitiesPayments.plan.variableService')})
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={addServiceToDraft}
                    disabled={addableServiceOptions.length === 0}
                  >
                    <Plus className="h-4 w-4" />
                    {t('activitiesPayments.plan.addService')}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 rounded border border-base-300 p-3">
              <p className="text-sm">{t('activitiesPayments.plan.servicesTotal')}: <span className="font-semibold">{activePlanServicesTotal.toFixed(2)}</span></p>
              <p className="text-sm">{t('activitiesPayments.plan.installmentsCount')}: <span className="font-semibold">{planDraft.installments.length}</span></p>
              <div className="mt-2 max-h-48 overflow-auto rounded border border-base-300">
                <table className="table table-xs">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('activitiesPayments.plan.dueDate')}</th>
                      <th>{t('activitiesPayments.plan.amount')}</th>
                      <th>{t('activitiesPayments.plan.servicesSnapshot')}</th>
                      <th>{t('activitiesPayments.plan.paymentMethod')}</th>
                      <th>{t('activitiesPayments.plan.paymentEvidence')}</th>
                      <th>{t('activitiesPayments.plan.paymentStatus')}</th>
                      <th>{t('activitiesPayments.plan.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planDraft.installments.map((itemInstallment, index) => (
                      <tr key={itemInstallment.id}>
                        <td>{index + 1}</td>
                        <td>{itemInstallment.dueDate}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className="input input-bordered input-xs w-28"
                            value={itemInstallment.amount}
                            disabled={itemInstallment.paymentStatus === 'paid' && !itemInstallment.unlocked}
                            onChange={(event) =>
                              setPlanDraft((prev) => {
                                if (!prev) {
                                  return prev
                                }
                                const next = [...prev.installments]
                                next[index] = { ...next[index], amount: Number(event.target.value) }
                                return { ...prev, installments: next }
                              })
                            }
                          />
                        </td>
                        <td>
                          <div className="max-w-56 space-y-1 text-xs">
                            {itemInstallment.services.filter((service) => service.enabled).length === 0 ? (
                              <span className="opacity-70">-</span>
                            ) : (
                              itemInstallment.services
                                .filter((service: PaymentInstallment['services'][number]) => service.enabled)
                                .map((service: PaymentInstallment['services'][number]) => (
                                  <p key={`${itemInstallment.id}-${service.kind}-${service.serviceId}`}>
                                    {service.title}: {service.amount.toFixed(2)}
                                  </p>
                                ))
                            )}
                          </div>
                        </td>
                        <td>
                          {itemInstallment.paymentStatus !== 'paid' || itemInstallment.unlocked ? (
                            <select
                              className="select select-bordered select-xs w-40"
                              value={itemInstallment.paymentMethodCode || 'onsite_pos'}
                              onChange={(event) =>
                                updateInstallment(index, (current) => ({
                                  ...current,
                                  paymentMethodCode: event.target.value,
                                  paymentProofDataUrl:
                                    event.target.value === 'bank_transfer' ? current.paymentProofDataUrl : '',
                                }))
                              }
                            >
                              {adminPaymentMethodOptions.map((code) => (
                                <option key={code} value={code}>
                                  {t(`utility.paymentMethods.methods.${code}.label`)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            t(`utility.paymentMethods.methods.${itemInstallment.paymentMethodCode || 'onsite_pos'}.label`)
                          )}
                        </td>
                        <td>
                          {itemInstallment.paymentMethodCode === 'bank_transfer' ? (
                            <div className="flex flex-col gap-1">
                              {itemInstallment.paymentProofDataUrl ? (
                                <a className="link text-xs" href={itemInstallment.paymentProofDataUrl} target="_blank" rel="noreferrer">
                                  {t('activitiesPayments.plan.viewEvidence')}
                                </a>
                              ) : (
                                <span className="text-xs opacity-70">{t('activitiesPayments.plan.noEvidence')}</span>
                              )}
                              {itemInstallment.paymentStatus !== 'paid' || itemInstallment.unlocked ? (
                                <input
                                  type="file"
                                  className="file-input file-input-bordered file-input-xs w-44"
                                  accept="image/*,.pdf"
                                  onChange={(event) => {
                                    void uploadInstallmentProof(index, event.target.files?.[0] ?? null)
                                    event.currentTarget.value = ''
                                  }}
                                />
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs opacity-70">-</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-sm ${itemInstallment.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                            {itemInstallment.paymentStatus === 'paid'
                              ? t('activitiesPayments.plan.paid')
                              : t('activitiesPayments.plan.pending')}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {itemInstallment.paymentMethodCode === 'paypal' ? (
                              <span className="badge badge-ghost badge-sm">{t('activitiesPayments.plan.paypalManagedFrontend')}</span>
                            ) : itemInstallment.paymentStatus === 'pending' ? (
                              <button
                                type="button"
                                className="btn btn-xs btn-primary"
                                disabled={itemInstallment.paymentMethodCode === 'bank_transfer' && !itemInstallment.paymentProofDataUrl}
                                onClick={() => markInstallmentPaid(index)}
                              >
                                {t('activitiesPayments.plan.markPaid')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={`btn btn-xs ${itemInstallment.unlocked ? 'btn-warning' : 'btn-outline'}`}
                                onClick={() => toggleInstallmentUnlock(index)}
                              >
                                {itemInstallment.unlocked
                                  ? t('activitiesPayments.plan.lockInstallment')
                                  : t('activitiesPayments.plan.unlockInstallment')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={closePlanModal}>{t('public.common.close')}</button>
              <button type="button" className="btn btn-primary" onClick={savePlan}>
                {t('activitiesPayments.workflow.savePlan')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closePlanModal} />
        </dialog>
      ) : null}
    </section>
  )
}

export default ActivitiesPaymentsPage
