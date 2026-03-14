import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { Plus, Trash2 } from 'lucide-react'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, Table, TextRun } from 'docx'
import DataTable from '../components/DataTable'
import {
  getAdditionalServices,
  getCompanies,
  getEnrollmentById,
  getPackages,
  type AdditionalService,
  type PackagePaymentFrequency,
} from '../lib/package-catalog'
import { resolveEnrollmentFeeForAthlete, upsertCoverageFromEnrollmentPurchase } from '../lib/athlete-enrollment-coverages'
import { getPublicClients, getPublicMinors } from '../lib/public-customer-records'
import { getPublicDirectAthletes } from '../lib/public-direct-athletes'
import {
  generateInstallments,
  getActivityPaymentPlans,
  saveActivityPaymentPlan,
  type ActivityPaymentPlan,
  type PaymentInstallment,
} from '../lib/activity-payment-plans'
import { getAthleteActivities } from '../lib/athlete-activities'
import {
  downloadContractPdf,
  ensureContractHeaderImage,
  type ContractPdfPayload,
} from '../lib/contract-pdf'
import { readFileAsDataUrl } from '../lib/file-utils'
import { getProjectSettings } from '../lib/project-settings'
import { buildDocxTableRows, toWorksheetRecord } from '../lib/tabular-export'

type ActivitiesPaymentsTab = 'activities' | 'deadlines' | 'expired' | 'collections' | 'overdue'
type FrequencyFilter = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly'
type ActivitiesExportFormat = 'xlsx' | 'pdf' | 'docx'
type ActivitiesExportScope = 'activities' | 'payments'
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
  contractSigned: boolean
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
  return dueYear === currentYear && dueMonth >= currentMonth
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

function buildPlansByActivityKey(): Map<string, ActivityPaymentPlan> {
  return new Map(getActivityPaymentPlans().map((item) => [item.activityKey, item]))
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

function isEditionClosed(input: { durationType: string; periodEndDate?: string; eventDate?: string }, today: Date): boolean {
  if (input.durationType === 'period') {
    const end = parseIsoDate(input.periodEndDate || '')
    return Boolean(end && dateOnly(end) < today)
  }
  const eventDate = parseIsoDate(input.eventDate || '')
  return Boolean(eventDate && dateOnly(eventDate) < today)
}

function formatPeriodMonthLabel(periodMonth: string, locale: string): string {
  const [yearStr, monthStr] = periodMonth.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return periodMonth
  }
  const date = new Date(year, month - 1, 1)
  const formatted = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function monthShift(periodMonth: string, deltaMonths: number): string {
  const [yearStr, monthStr] = periodMonth.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return periodMonth
  }
  const date = new Date(year, month - 1 + deltaMonths, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getFrequencyLabelKey(frequency: PackagePaymentFrequency): string {
  return `utility.packages.paymentFrequency${frequency[0].toUpperCase()}${frequency.slice(1)}`
}

function ActivitiesPaymentsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<ActivitiesPaymentsTab>('activities')
  const [globalSearch, setGlobalSearch] = useState('')
  const [packageFilter, setPackageFilter] = useState('all')
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>('all')
  const [planFilter, setPlanFilter] = useState<'all' | 'generated' | 'not_generated'>('all')
  const [activePlanItemKey, setActivePlanItemKey] = useState<string | null>(null)
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null)
  const [isEnrollmentFeeCovered, setIsEnrollmentFeeCovered] = useState(false)
  const adminPaymentMethodOptions = ['onsite_pos', 'bank_transfer'] as const
  const currentPeriodMonth = getCurrentPeriodMonthValue()
  const [periodFromMonth, setPeriodFromMonth] = useState(currentPeriodMonth)
  const [periodToMonth, setPeriodToMonth] = useState(currentPeriodMonth)
  const [newServiceOptionKey, setNewServiceOptionKey] = useState('')
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ActivitiesExportFormat>('xlsx')
  const [exportScope, setExportScope] = useState<ActivitiesExportScope>('activities')

  const minors = useMemo(() => getPublicMinors(), [])
  const directAthletes = useMemo(() => getPublicDirectAthletes(), [])
  const minorsById = useMemo(() => new Map(minors.map((item) => [String(item.id), item])), [minors])
  const directAthletesById = useMemo(
    () => new Map(directAthletes.map((item) => [item.id, item])),
    [directAthletes],
  )
  const clientsById = useMemo(() => new Map(getPublicClients().map((item) => [item.id, item])), [])
  const packages = useMemo(() => getPackages(), [])
  const companiesById = useMemo(() => new Map(getCompanies().map((item) => [item.id, item])), [])
  const packagesById = useMemo(() => new Map(packages.map((item) => [item.id, item])), [packages])
  const additionalServicesById = useMemo(
    () => new Map(getAdditionalServices().map((service) => [service.id, service])),
    [],
  )
  const [plansByActivityKey, setPlansByActivityKey] = useState<Map<string, ActivityPaymentPlan>>(buildPlansByActivityKey)
  const periodFromRange = useMemo(() => getPeriodRange(periodFromMonth), [periodFromMonth])
  const periodToRange = useMemo(() => getPeriodRange(periodToMonth), [periodToMonth])
  const periodRange = useMemo(() => {
    const start = periodFromRange.start <= periodToRange.start ? periodFromRange.start : periodToRange.start
    const end = periodFromRange.start <= periodToRange.start ? periodToRange.end : periodFromRange.end
    return { start, end }
  }, [periodFromRange.end, periodFromRange.start, periodToRange.end, periodToRange.start])
  const periodMonthLabel = useMemo(
    () => formatPeriodMonthLabel(currentPeriodMonth, i18n.resolvedLanguage || i18n.language || 'it'),
    [currentPeriodMonth, i18n.language, i18n.resolvedLanguage],
  )
  const periodFilterLabel = useMemo(() => {
    const locale = i18n.resolvedLanguage || i18n.language || 'it'
    const fromLabel = formatPeriodMonthLabel(periodFromMonth, locale)
    const toLabel = formatPeriodMonthLabel(periodToMonth, locale)
    if (periodFromMonth === periodToMonth) {
      return fromLabel
    }
    return `${fromLabel} - ${toLabel}`
  }, [i18n.language, i18n.resolvedLanguage, periodFromMonth, periodToMonth])
  const currentMonthRange = useMemo(() => getPeriodRange(currentPeriodMonth), [currentPeriodMonth])

  const applyPeriodPreset = (preset: 'current' | 'last3' | 'last6' | 'year') => {
    if (preset === 'current') {
      setPeriodFromMonth(currentPeriodMonth)
      setPeriodToMonth(currentPeriodMonth)
      return
    }
    if (preset === 'last3') {
      setPeriodToMonth(currentPeriodMonth)
      setPeriodFromMonth(monthShift(currentPeriodMonth, -2))
      return
    }
    if (preset === 'last6') {
      setPeriodToMonth(currentPeriodMonth)
      setPeriodFromMonth(monthShift(currentPeriodMonth, -5))
      return
    }
    const [year] = currentPeriodMonth.split('-')
    setPeriodFromMonth(`${year}-01`)
    setPeriodToMonth(currentPeriodMonth)
  }

  const onChangePeriodFrom = (value: string) => {
    const next = value || currentPeriodMonth
    const clamped = next > currentPeriodMonth ? currentPeriodMonth : next
    setPeriodFromMonth(clamped)
    if (clamped > periodToMonth) {
      setPeriodToMonth(clamped)
    }
  }

  const onChangePeriodTo = (value: string) => {
    const next = value || currentPeriodMonth
    const clamped = next > currentPeriodMonth ? currentPeriodMonth : next
    setPeriodToMonth(clamped)
    if (clamped < periodFromMonth) {
      setPeriodFromMonth(clamped)
    }
  }
  const lockedAthleteId = searchParams.get('athleteId')
  const lockedClientId = searchParams.get('clientId')
  const activityItems = useMemo<AthleteActivityItem[]>(() => {
    const today = dateOnly(new Date())
    return getAthleteActivities()
      .map((activity) => {
      const packageItem = packagesById.get(activity.packageId)
      if (!packageItem || isEditionClosed(packageItem, today)) {
        return null
      }
      const minor = activity.type === 'minor' ? minorsById.get(activity.athleteId) : null
      const direct = activity.type === 'direct_user' ? directAthletesById.get(activity.athleteId) : null
      if (!minor && !direct) {
        return null
      }
      const parent = minor ? clientsById.get(minor.clientId) : null
      return {
        key: activity.key,
        type: activity.type,
        athleteId: activity.athleteId,
        clientId: minor?.clientId ?? direct?.clientId ?? null,
        firstName: minor?.firstName ?? direct?.firstName ?? '',
        lastName: minor?.lastName ?? direct?.lastName ?? '',
        packageId: activity.packageId,
        validationStatus: minor?.validationStatus ?? direct?.validationStatus ?? 'not_validated',
        parentLabel: parent ? `${parent.parentFirstName} ${parent.parentLastName}` : '-',
        createdAt: activity.createdAt,
        selectedPaymentMethodCode:
          activity.selectedPaymentMethodCode ||
          minor?.selectedPaymentMethodCode ||
          '',
      }
    })
      .filter((item): item is AthleteActivityItem => Boolean(item))
  }, [clientsById, directAthletesById, minorsById, packagesById])
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

  const exportContractPdf = useCallback(async (item: AthleteActivityItem, packageItem: ReturnType<typeof getPackages>[number], plan: ActivityPaymentPlan) => {
    const company = companiesById.get(packageItem.companyId)
    if (!company) {
      window.alert(t('activitiesPayments.contract.companyNotFound'))
      return
    }
    const minor = item.type === 'minor' ? minorsById.get(item.athleteId) ?? null : null
    const directAthlete = item.type === 'direct_user' ? directAthletesById.get(item.athleteId) ?? null : null
    const guardian = minor && item.clientId !== null ? clientsById.get(item.clientId) ?? null : null
    if (item.type === 'minor' && (!minor || !guardian)) {
      window.alert(t('activitiesPayments.contract.subjectDataMissing'))
      return
    }
    if (item.type === 'direct_user' && !directAthlete) {
      window.alert(t('activitiesPayments.contract.subjectDataMissing'))
      return
    }

    const projectSettings = getProjectSettings()
    const specialClausesById = new Map(
      projectSettings.contractSpecialClauses.map((clause) => [clause.id, clause]),
    )
    const packageSpecialClauses = (packageItem.contractSpecialClauseIds ?? [])
      .map((id) => specialClausesById.get(id))
      .filter((clause): clause is NonNullable<typeof clause> => Boolean(clause))
      .map((clause) => ({
        id: clause.id,
        title: clause.title,
        text: clause.text,
      }))

    const legalRepresentativeFullName = `${company.legalRepresentativeFirstName} ${company.legalRepresentativeLastName}`.trim()
    const signerRole = item.type === 'minor'
      ? (guardian?.parentRole ?? 'genitore')
      : 'contraente'

    const payload: ContractPdfPayload = {
      activity: {
        key: item.key,
        createdAt: item.createdAt,
        orderNumber: item.key,
      },
      package: {
        id: packageItem.id,
        editionYear: packageItem.editionYear,
        name: packageItem.name,
        description: packageItem.description,
        durationType: packageItem.durationType,
        eventDate: packageItem.eventDate,
        eventTime: packageItem.eventTime,
        periodStartDate: packageItem.periodStartDate,
        periodEndDate: packageItem.periodEndDate,
        trainingAddress: packageItem.trainingAddress,
        contractHeaderImage: ensureContractHeaderImage(packageItem.contractHeaderImage, company.title),
        contractHeaderText: packageItem.contractHeaderText,
        contractSpecialClauses: packageSpecialClauses,
        contractRegulation: packageItem.contractRegulation,
      },
      contractConfig: {
        subjectTemplate: projectSettings.contractSubjectTemplate,
        economicClausesTemplate: projectSettings.contractEconomicClausesTemplate,
        servicesAdjustmentTemplate: projectSettings.contractServicesAdjustmentTemplate,
        specialClausesFormula: projectSettings.contractSpecialClausesFormula,
      },
      company: {
        title: company.title,
        legalForm: company.legalForm,
        headquartersAddress: company.headquartersAddress,
        headquartersCity: company.headquartersCity,
        headquartersPostalCode: company.headquartersPostalCode,
        headquartersProvince: company.headquartersProvince,
        headquartersCountry: company.headquartersCountry,
        vatNumber: company.vatNumber,
        pecEmail: company.pecEmail,
        email: company.email,
        legalRepresentativeFullName,
        legalRepresentativeRole: company.legalRepresentativeRole,
        contractSignaturePlace: company.contractSignaturePlace,
        delegateSignatureDataUrl: company.delegateSignatureDataUrl,
        iban: company.iban,
        consentMinors: company.consentMinors,
        consentAdults: company.consentAdults,
        consentInformationNotice: company.consentInformationNotice,
        consentDataProcessing: company.consentDataProcessing,
      },
      plan: {
        createdAt: plan.createdAt,
        enrollmentFee: plan.config.enrollmentFee,
        recurringAmount: plan.config.recurringAmount,
        selectedPaymentMethodCode: plan.config.selectedPaymentMethodCode ?? item.selectedPaymentMethodCode ?? '',
        services: (plan.config.services ?? []).map((service) => ({
          title: service.title,
          kind: service.kind,
          enabled: service.enabled,
          amount: service.amount,
        })),
        installments: plan.installments.map((installment) => ({
          id: installment.id,
          dueDate: installment.dueDate,
          amount: installment.amount,
          label: installment.label,
          paymentMethodCode: installment.paymentMethodCode,
        })),
      },
      subject: item.type === 'minor'
        ? {
            kind: 'minor',
            signerRole,
            athlete: {
              firstName: minor?.firstName ?? '',
              lastName: minor?.lastName ?? '',
              birthDate: minor?.birthDate ?? '',
              birthPlace: minor?.birthPlace ?? '',
              taxCode: minor?.taxCode ?? '',
              residenceAddress: minor?.residenceAddress ?? '',
            },
            guardian: {
              firstName: guardian?.parentFirstName ?? '',
              lastName: guardian?.parentLastName ?? '',
              birthDate: guardian?.parentBirthDate ?? '',
              birthPlace: guardian?.parentBirthPlace ?? '',
              taxCode: guardian?.parentTaxCode ?? '',
              residenceAddress: guardian?.residenceAddress ?? '',
              email: guardian?.parentEmail ?? '',
              phone: guardian?.parentPhone ?? '',
            },
          }
        : {
            kind: 'adult',
            signerRole: 'contraente',
            athlete: {
              firstName: directAthlete?.firstName ?? '',
              lastName: directAthlete?.lastName ?? '',
              birthDate: directAthlete?.birthDate ?? '',
              birthPlace: directAthlete?.birthPlace ?? '',
              taxCode: directAthlete?.taxCode ?? '',
              residenceAddress: directAthlete?.residenceAddress ?? '',
              email: directAthlete?.email ?? '',
              phone: directAthlete?.phone ?? '',
            },
            guardian: null,
          },
    }

    const result = await downloadContractPdf({
      payload,
      orderNumber: item.key,
      contraenteFullName:
        item.type === 'minor'
          ? `${guardian?.parentFirstName ?? ''} ${guardian?.parentLastName ?? ''}`.trim()
          : `${directAthlete?.firstName ?? ''} ${directAthlete?.lastName ?? ''}`.trim(),
      minorFullName: item.type === 'minor' ? `${item.firstName} ${item.lastName}` : undefined,
      packageName: packageItem.name,
      editionYear: packageItem.editionYear,
    })
    if (!result.ok) {
      window.alert(`${t('activitiesPayments.contract.downloadError')} (${result.error})`)
    }
  }, [clientsById, companiesById, directAthletesById, minorsById, t])
  const addableServiceOptions = useMemo(() => {
    if (!planDraft) {
      return [] as PlanServiceOption[]
    }
    const used = new Set(planDraft.services.map((item) => `${item.kind}::${item.serviceId}`))
    return activePlanServiceOptions.filter((item) => !used.has(item.key))
  }, [activePlanServiceOptions, planDraft])

  const buildInstallments = useCallback((
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
    }), [])

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

  const matchesActivityBaseFilters = useCallback((item: AthleteActivityItem): boolean => {
    const isLegacyMinorIdMatch = lockedAthleteId === item.athleteId
    const isAthleteKeyMatch = lockedAthleteId === item.key.split('::')[0]
    if (lockedAthleteId && lockedAthleteId !== item.key && !isLegacyMinorIdMatch && !isAthleteKeyMatch) {
      return false
    }
    if (lockedClientId) {
      const targetClientId = Number(lockedClientId)
      if (!Number.isFinite(targetClientId) || item.clientId !== targetClientId) {
        return false
      }
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
    return frequencyFilter === 'all' || packageItem?.paymentFrequency === frequencyFilter
  }, [frequencyFilter, globalSearch, lockedAthleteId, lockedClientId, packageFilter, packagesById])

  const filteredActivities = useMemo(() => {
    return activityItems.filter((item) => {
      if (!matchesActivityBaseFilters(item)) {
        return false
      }
      if (planFilter !== 'all') {
        const hasPlan = plansByActivityKey.has(item.key)
        if (planFilter === 'generated' && !hasPlan) {
          return false
        }
        if (planFilter === 'not_generated' && hasPlan) {
          return false
        }
      }
      return true
    })
  }, [activityItems, matchesActivityBaseFilters, planFilter, plansByActivityKey])

  const activityItemsByBaseFilters = useMemo(() => {
    return activityItems.filter(matchesActivityBaseFilters)
  }, [activityItems, matchesActivityBaseFilters])

  const resetFilters = () => {
    setGlobalSearch('')
    setPackageFilter('all')
    setFrequencyFilter('all')
    setPlanFilter('all')
    setPeriodFromMonth(currentPeriodMonth)
    setPeriodToMonth(currentPeriodMonth)
    const next = new URLSearchParams(searchParams)
    next.delete('athleteId')
    next.delete('clientId')
    setSearchParams(next, { replace: true })
  }

  const filteredActivitiesByPeriod = useMemo(() => filteredActivities, [filteredActivities])

  const installmentRows = useMemo(() => {
    const rows: Array<{
      activity: AthleteActivityItem
      installment: PaymentInstallment
      installmentIndex: number
      packageName: string
    }> = []
    activityItemsByBaseFilters.forEach((activity) => {
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
  }, [activityItemsByBaseFilters, packagesById, plansByActivityKey])

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
    const start = dateOnly(periodRange.start)
    const end = dateOnly(periodRange.end)
    return installmentRows.filter((row) => {
      if (row.installment.paymentStatus !== 'paid') {
        return false
      }
      const paidDate = parseIsoDate((row.installment.paidAt || '').slice(0, 10))
      const fallbackDate = parseIsoDate(row.installment.dueDate)
      const value = dateOnly(paidDate ?? fallbackDate ?? new Date(0))
      return value >= start && value <= end
    })
  }, [installmentRows, periodRange.end, periodRange.start])

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

  type ActivityStatusSummary =
    | { kind: 'no_plan' }
    | { kind: 'no_installment_in_period' }
    | { kind: 'insoluti'; insolutiCount: number }
    | { kind: 'scaduta'; insolutiCount: number }
    | { kind: 'in_regola' }
    | { kind: 'in_scadenza'; pendingCurrentCount: number; insolutiCount: number }

  const resolveActivityStatusSummary = useCallback((item: AthleteActivityItem): ActivityStatusSummary => {
    const plan = plansByActivityKey.get(item.key)
    if (!plan) {
      return { kind: 'no_plan' }
    }
    const periodStart = dateOnly(currentMonthRange.start)
    const periodEnd = dateOnly(currentMonthRange.end)
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
      return insolutiCount > 0
        ? { kind: 'insoluti', insolutiCount }
        : { kind: 'no_installment_in_period' }
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
      return { kind: 'scaduta', insolutiCount }
    }
    if (pendingCurrent.length === 0) {
      return { kind: 'in_regola' }
    }
    return {
      kind: 'in_scadenza',
      pendingCurrentCount: pendingCurrent.length,
      insolutiCount,
    }
  }, [currentMonthRange.end, currentMonthRange.start, plansByActivityKey])

  const getActivityStatusLabel = useCallback((item: AthleteActivityItem): string => {
    const summary = resolveActivityStatusSummary(item)
    if (summary.kind === 'no_plan') {
      return t('activitiesPayments.status.noPlan')
    }
    if (summary.kind === 'no_installment_in_period') {
      return t('activitiesPayments.status.noInstallmentInPeriod')
    }
    if (summary.kind === 'insoluti') {
      return `${t('activitiesPayments.status.insoluti')} (${summary.insolutiCount})`
    }
    if (summary.kind === 'scaduta') {
      return t('activitiesPayments.status.scaduta')
    }
    if (summary.kind === 'in_regola') {
      return t('activitiesPayments.status.inRegola')
    }
    return `${t('activitiesPayments.status.toPay')} (${summary.pendingCurrentCount})`
  }, [resolveActivityStatusSummary, t])

  const activitiesExportRows = useMemo(() => {
    return filteredActivitiesByPeriod.map((item) => {
      const plan = plansByActivityKey.get(item.key) ?? null
      const packageItem = packagesById.get(item.packageId) ?? null
      const company = packageItem ? companiesById.get(packageItem.companyId) ?? null : null
      const totalDue = plan ? plan.installments.reduce((sum, installment) => sum + safeAmount(installment.amount), 0) : 0
      const totalPaid = plan
        ? plan.installments
            .filter((installment) => installment.paymentStatus === 'paid')
            .reduce((sum, installment) => sum + safeAmount(installment.amount), 0)
        : 0
      const insoluti = plan
        ? plan.installments.filter((installment) => {
            if (installment.paymentStatus !== 'pending') {
              return false
            }
            const due = parseIsoDate(installment.dueDate)
            return Boolean(due && dateOnly(due) < dateOnly(new Date()))
          }).length
        : 0
      const nextDueDate = plan
        ? [...plan.installments]
            .filter((installment) => installment.paymentStatus === 'pending')
            .map((installment) => installment.dueDate)
            .sort((left, right) => left.localeCompare(right))[0] ?? '-'
        : '-'
      return {
        athlete: `${item.firstName} ${item.lastName}`.trim(),
        parent: item.parentLabel,
        packageName: packageItem?.name ?? item.packageId,
        company: company?.title ?? '-',
        frequency: packageItem ? t(getFrequencyLabelKey(packageItem.paymentFrequency)) : '-',
        planStatus: plan ? t('activitiesPayments.filters.generatedPlan') : t('activitiesPayments.filters.notGeneratedPlan'),
        paymentStatus: getActivityStatusLabel(item),
        totalDue: totalDue.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        insoluti: String(insoluti),
        nextDueDate,
      }
    })
  }, [companiesById, filteredActivitiesByPeriod, getActivityStatusLabel, packagesById, plansByActivityKey, t])

  const paymentsExportRows = useMemo(() => {
    const today = dateOnly(new Date())
    return installmentRows.map((row) => {
      const due = parseIsoDate(row.installment.dueDate)
      const dueDateOnly = due ? dateOnly(due) : null
      const statusLabel = row.installment.paymentStatus === 'paid'
        ? t('activitiesPayments.plan.paid')
        : dueDateOnly && dueDateOnly < today
          ? t('activitiesPayments.status.scaduta')
          : t('activitiesPayments.status.toPay')
      return {
        athlete: `${row.activity.firstName} ${row.activity.lastName}`.trim(),
        parent: row.activity.parentLabel,
        packageName: row.packageName,
        installmentLabel: row.installment.label,
        dueDate: row.installment.dueDate,
        amount: row.installment.amount.toFixed(2),
        paymentMethod: t(`utility.paymentMethods.methods.${row.installment.paymentMethodCode || 'onsite_pos'}.label`),
        paymentStatus: statusLabel,
        paidAt: row.installment.paidAt ? row.installment.paidAt.slice(0, 10) : '-',
      }
    })
  }, [installmentRows, t])

  const exportHeaders = useMemo(() => {
    if (exportScope === 'activities') {
      return ['Atleta', 'Genitore', 'Pacchetto', 'Azienda', 'Frequenza', 'Stato piano', 'Stato pagamenti', 'Totale dovuto', 'Totale pagato', 'Insoluti', 'Prossima scadenza']
    }
    return ['Atleta', 'Genitore', 'Pacchetto', 'Rata', 'Scadenza', 'Importo', 'Metodo pagamento', 'Stato', 'Data pagamento']
  }, [exportScope])

  const exportBodyRows = useMemo(() => {
    if (exportScope === 'activities') {
      return activitiesExportRows.map((row) => [
        row.athlete,
        row.parent,
        row.packageName,
        row.company,
        row.frequency,
        row.planStatus,
        row.paymentStatus,
        row.totalDue,
        row.totalPaid,
        row.insoluti,
        row.nextDueDate,
      ])
    }
    return paymentsExportRows.map((row) => [
      row.athlete,
      row.parent,
      row.packageName,
      row.installmentLabel,
      row.dueDate,
      row.amount,
      row.paymentMethod,
      row.paymentStatus,
      row.paidAt,
    ])
  }, [activitiesExportRows, exportScope, paymentsExportRows])

  const exportLabelByScope = exportScope === 'activities'
    ? t('activitiesPayments.export.fileActivities')
    : t('activitiesPayments.export.filePayments')
  const exportFilenameBase = `${exportLabelByScope}-${new Date().toISOString().slice(0, 10)}`

  const handleExport = useCallback(async () => {
    if (exportBodyRows.length === 0) {
      return
    }

    if (exportFormat === 'xlsx') {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet(
        exportScope === 'activities'
          ? t('activitiesPayments.export.scopeActivities')
          : t('activitiesPayments.export.scopePayments'),
      )
      worksheet.columns = exportHeaders.map((header) => ({ header, key: header }))
      exportBodyRows.forEach((row) => worksheet.addRow(toWorksheetRecord(exportHeaders, row)))
      const buffer = await workbook.xlsx.writeBuffer()
      saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `${exportFilenameBase}.xlsx`,
      )
      setIsExportModalOpen(false)
      return
    }

    if (exportFormat === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      doc.setFontSize(11)
      doc.text(
        exportScope === 'activities'
          ? t('activitiesPayments.export.titleActivities')
          : t('activitiesPayments.export.titlePayments'),
        40,
        36,
      )
      autoTable(doc, {
        head: [exportHeaders],
        body: exportBodyRows,
        startY: 50,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [33, 37, 41] },
      })
      doc.save(`${exportFilenameBase}.pdf`)
      setIsExportModalOpen(false)
      return
    }

    const tableRows = buildDocxTableRows(exportHeaders, exportBodyRows)
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            children: [new TextRun({
              text: exportScope === 'activities'
                ? t('activitiesPayments.export.titleActivities')
                : t('activitiesPayments.export.titlePayments'),
              bold: true,
            })],
          }),
          new Table({
            rows: tableRows,
          }),
        ],
      }],
    })
    const blob = await Packer.toBlob(doc)
    saveAs(blob, `${exportFilenameBase}.docx`)
    setIsExportModalOpen(false)
  }, [exportBodyRows, exportFilenameBase, exportFormat, exportHeaders, exportScope, t])

  const openPlanModal = useCallback((item: AthleteActivityItem) => {
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
    const athleteKey = item.key.split('::')[0]
    const selectedEnrollment = getEnrollmentById(packageItem.enrollmentId)
    const enrollmentFeeDecision = selectedEnrollment
      ? resolveEnrollmentFeeForAthlete({
          athleteKey,
          targetEnrollment: selectedEnrollment,
          defaultEnrollmentFee: packageItem.enrollmentPrice,
          nowDate: new Date(),
          excludeSourcePackageId: packageItem.id,
        })
      : {
          enrollmentFee: packageItem.enrollmentPrice,
          isCovered: false,
        }

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
          contractSigned: Boolean(existingPlan.config.contractSigned),
          services: servicesDraft,
          startDate: existingPlan.config.startDate,
          endDate: existingPlan.config.endDate,
        }
      : {
          enrollmentFee: enrollmentFeeDecision.enrollmentFee,
          recurringAmount: packageItem.priceAmount,
          selectedPaymentMethodCode: item.selectedPaymentMethodCode || 'onsite_pos',
          contractSigned: false,
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
    setIsEnrollmentFeeCovered(enrollmentFeeDecision.isCovered && safeAmount(baseDraft.enrollmentFee) === 0)
    setNewServiceOptionKey('')
    setActivePlanItemKey(item.key)
  }, [additionalServicesById, buildInstallments, packagesById, plansByActivityKey])

  const closePlanModal = () => {
    setActivePlanItemKey(null)
    setPlanDraft(null)
    setIsEnrollmentFeeCovered(false)
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
        contractSigned: planDraft.contractSigned,
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
    const selectedEnrollment = getEnrollmentById(activePlanPackage.enrollmentId)
    if (selectedEnrollment && safeAmount(planDraft.enrollmentFee) > 0) {
      const athleteKey = activePlanItem.key.split('::')[0]
      upsertCoverageFromEnrollmentPurchase({
        athleteKey,
        packageItem: activePlanPackage,
        enrollment: selectedEnrollment,
      })
    }
    setPlansByActivityKey(buildPlansByActivityKey())
    closePlanModal()
  }

  const activitiesColumns = useMemo<ColumnDef<AthleteActivityItem>[]>(() => [
    {
      id: 'athlete',
      header: t('activitiesPayments.table.athlete'),
      cell: ({ row }) => {
        const item = row.original
        if (item.type === 'direct_user' && item.clientId !== null) {
          return (
            <button
              type="button"
              className="link text-base-content text-left"
              onClick={() => navigate(`/app/clienti?clientId=${item.clientId}`)}
            >
              {item.firstName} {item.lastName}
            </button>
          )
        }
        if (item.type === 'minor') {
          return (
            <button
              type="button"
              className="link text-base-content text-left"
              onClick={() => navigate(`/app/atleti?athleteId=${item.key}`)}
            >
              {item.firstName} {item.lastName}
            </button>
          )
        }
        return <span>{item.firstName} {item.lastName}</span>
      },
      meta: { responsivePriority: 'high' },
    },
    {
      id: 'athleteType',
      header: t('activitiesPayments.table.athleteType'),
      cell: ({ row }) => (
        <span className={`badge ${row.original.type === 'minor' ? 'badge-info' : 'badge-primary'}`}>
          {row.original.type === 'minor'
            ? t('activitiesPayments.types.minor')
            : t('activitiesPayments.types.directUser')}
        </span>
      ),
      meta: { responsivePriority: 'high' },
    },
    {
      id: 'parent',
      header: t('activitiesPayments.table.parent'),
      cell: ({ row }) => {
        const item = row.original
        if (item.type === 'minor' && item.clientId !== null) {
          return (
            <button
              type="button"
              className="link text-base-content text-left"
              onClick={() => navigate(`/app/clienti?clientId=${item.clientId}`)}
            >
              {item.parentLabel}
            </button>
          )
        }
        return item.parentLabel
      },
      meta: { responsivePriority: 'low' },
    },
    {
      id: 'package',
      header: t('activitiesPayments.table.package'),
      cell: ({ row }) => {
        const item = row.original
        const packageItem = packagesById.get(item.packageId)
        return (
          <button
            type="button"
            className="link text-base-content text-left"
            onClick={() => navigate(`/app/pacchetti?packageId=${item.packageId}`)}
          >
            {packageItem?.name ?? item.packageId}
          </button>
        )
      },
      meta: { responsivePriority: 'high' },
    },
    {
      id: 'frequency',
      header: t('activitiesPayments.table.frequency'),
      cell: ({ row }) => {
        const packageItem = packagesById.get(row.original.packageId)
        return packageItem ? t(getFrequencyLabelKey(packageItem.paymentFrequency)) : '-'
      },
      meta: { responsivePriority: 'low' },
    },
    {
      id: 'period',
      header: t('activitiesPayments.table.period'),
      cell: ({ row }) => {
        const item = row.original
        const packageItem = packagesById.get(item.packageId)
        const periodLabel = packageItem?.durationType === 'period'
          ? `${packageItem.periodStartDate || '-'} - ${packageItem.periodEndDate || '-'}`
          : packageItem?.eventDate || '-'
        return (
          <div className="text-sm">
            <p><span className="font-medium">{t('activitiesPayments.period.current')}:</span> {periodMonthLabel}</p>
            <p className="opacity-70"><span className="font-medium">{t('activitiesPayments.period.selected')}:</span> {periodFilterLabel}</p>
            <p className="opacity-70"><span className="font-medium">{t('activitiesPayments.period.total')}:</span> {periodLabel}</p>
          </div>
        )
      },
      meta: { responsivePriority: 'low' },
    },
    {
      id: 'paymentStatus',
      header: t('activitiesPayments.table.paymentStatus'),
      cell: ({ row }) => {
        const summary = resolveActivityStatusSummary(row.original)
        if (summary.kind === 'no_plan') {
          return <span className="badge badge-ghost">{t('activitiesPayments.status.noPlan')}</span>
        }
        if (summary.kind === 'no_installment_in_period') {
          return <span className="badge badge-ghost">{t('activitiesPayments.status.noInstallmentInPeriod')}</span>
        }
        if (summary.kind === 'insoluti') {
          return (
            <div className="space-y-1">
              <span className="badge badge-error">{t('activitiesPayments.status.insoluti')}</span>
              <p className="text-xs opacity-70">{t('activitiesPayments.status.insolutiCount', { count: summary.insolutiCount })}</p>
            </div>
          )
        }
        if (summary.kind === 'scaduta') {
          return (
            <div className="space-y-1">
              <span className="badge badge-error">{t('activitiesPayments.status.scaduta')}</span>
              {summary.insolutiCount > 0 ? (
                <p className="text-xs opacity-70">{t('activitiesPayments.status.insolutiCount', { count: summary.insolutiCount })}</p>
              ) : null}
            </div>
          )
        }
        if (summary.kind === 'in_regola') {
          return (
            <div className="space-y-1">
              <span className="badge badge-success">{t('activitiesPayments.status.inRegola')}</span>
              <p className="text-xs opacity-70">{t('activitiesPayments.status.currentPaid')}</p>
            </div>
          )
        }
        return (
          <div className="space-y-1">
            <span className="badge badge-warning">{t('activitiesPayments.status.toPay')}</span>
            <p className="text-xs opacity-70">
              {t('activitiesPayments.status.currentPendingCount', { count: summary.pendingCurrentCount })}
            </p>
            {summary.insolutiCount > 0 ? (
              <p className="text-xs opacity-70">{t('activitiesPayments.status.insolutiCount', { count: summary.insolutiCount })}</p>
            ) : null}
          </div>
        )
      },
      meta: { responsivePriority: 'high' },
    },
    {
      id: 'plan',
      header: t('activitiesPayments.table.plan'),
      cell: ({ row }) => {
        const item = row.original
        const plan = plansByActivityKey.get(item.key) ?? null
        const packageItem = packagesById.get(item.packageId)
        return (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              className={`btn btn-xs ${plan ? 'btn-success' : 'btn-error'}`}
              onClick={() => openPlanModal(item)}
            >
              {plan
                ? t('activitiesPayments.workflow.planGenerated', { count: plan.installments.length })
                : t('activitiesPayments.workflow.generatePlan')}
            </button>
            {plan && packageItem ? (
              <button
                type="button"
                className={`btn btn-xs ${plan.config.contractSigned ? 'btn-success' : 'btn-error'}`}
                onClick={() => {
                  void exportContractPdf(item, packageItem, plan)
                }}
              >
                {t('activitiesPayments.contract.download')}
              </button>
            ) : null}
          </div>
        )
      },
      meta: { responsivePriority: 'high' },
    },
  ], [exportContractPdf, navigate, openPlanModal, packagesById, periodFilterLabel, periodMonthLabel, plansByActivityKey, resolveActivityStatusSummary, t])

  type InstallmentTabRow = {
    id: string
    athlete: string
    parent: string
    packageName: string
    dueDate: string
    paidAt: string
    amount: string
    paymentMethod: string
    statusLabel: string
    statusClass: string
  }

  const toInstallmentTabRows = useCallback((
    rowsSource: Array<{ activity: AthleteActivityItem; installment: PaymentInstallment; packageName: string }>,
    statusLabel: string,
    statusClass: string,
  ): InstallmentTabRow[] =>
    rowsSource.map((row) => ({
      id: `${row.activity.key}-${row.installment.id}`,
      athlete: `${row.activity.firstName} ${row.activity.lastName}`,
      parent: row.activity.parentLabel,
      packageName: row.packageName,
      dueDate: row.installment.dueDate,
      paidAt: row.installment.paidAt ? row.installment.paidAt.slice(0, 10) : '-',
      amount: row.installment.amount.toFixed(2),
      paymentMethod: t(`utility.paymentMethods.methods.${row.installment.paymentMethodCode || 'onsite_pos'}.label`),
      statusLabel,
      statusClass,
    })), [t])

  const scadenzeTabRows = useMemo(
    () => toInstallmentTabRows(periodScadenzeRows, t('activitiesPayments.status.toPay'), 'badge-warning'),
    [periodScadenzeRows, t, toInstallmentTabRows],
  )
  const incassiTabRows = useMemo(
    () => toInstallmentTabRows(periodIncassiRows, t('activitiesPayments.plan.paid'), 'badge-success'),
    [periodIncassiRows, t, toInstallmentTabRows],
  )
  const scaduteTabRows = useMemo(
    () => toInstallmentTabRows(periodScaduteRows, t('activitiesPayments.status.scaduta'), 'badge-error'),
    [periodScaduteRows, t, toInstallmentTabRows],
  )
  const insolutiTabRows = useMemo(
    () => toInstallmentTabRows(periodInsolutiRows, t('activitiesPayments.status.insoluti'), 'badge-error'),
    [periodInsolutiRows, t, toInstallmentTabRows],
  )

  const installmentColumns = useMemo<ColumnDef<InstallmentTabRow>[]>(() => [
    { id: 'athlete', header: t('activitiesPayments.table.athlete'), cell: ({ row }) => row.original.athlete, meta: { responsivePriority: 'high' } },
    { id: 'parent', header: t('activitiesPayments.table.parent'), cell: ({ row }) => row.original.parent, meta: { responsivePriority: 'low' } },
    { id: 'package', header: t('activitiesPayments.table.package'), cell: ({ row }) => row.original.packageName, meta: { responsivePriority: 'high' } },
    { id: 'dueDate', header: t('activitiesPayments.plan.dueDate'), cell: ({ row }) => row.original.dueDate, meta: { responsivePriority: 'low' } },
    { id: 'paidAt', header: 'Data pagamento', cell: ({ row }) => row.original.paidAt, meta: { responsivePriority: 'low' } },
    { id: 'amount', header: t('activitiesPayments.plan.amount'), cell: ({ row }) => row.original.amount, meta: { responsivePriority: 'low' } },
    { id: 'paymentMethod', header: t('activitiesPayments.plan.paymentMethod'), cell: ({ row }) => row.original.paymentMethod, meta: { responsivePriority: 'low' } },
    {
      id: 'status',
      header: t('activitiesPayments.plan.paymentStatus'),
      cell: ({ row }) => <span className={`badge ${row.original.statusClass}`}>{row.original.statusLabel}</span>,
      meta: { responsivePriority: 'high' },
    },
  ], [t])

  const activitiesTable = useReactTable({
    data: filteredActivitiesByPeriod,
    columns: activitiesColumns,
    getCoreRowModel: getCoreRowModel(),
  })
  const scadenzeTable = useReactTable({
    data: scadenzeTabRows,
    columns: installmentColumns,
    getCoreRowModel: getCoreRowModel(),
  })
  const incassiTable = useReactTable({
    data: incassiTabRows,
    columns: installmentColumns,
    getCoreRowModel: getCoreRowModel(),
  })
  const scaduteTable = useReactTable({
    data: scaduteTabRows,
    columns: installmentColumns,
    getCoreRowModel: getCoreRowModel(),
  })
  const insolutiTable = useReactTable({
    data: insolutiTabRows,
    columns: installmentColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{t('activitiesPayments.title')}</h2>
          <p className="text-sm opacity-70">{t('activitiesPayments.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setIsExportModalOpen(true)}>
            {t('activitiesPayments.export.button')}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/app/storico-attivita')}>
            {t('activitiesPayments.goToHistory')}
          </button>
        </div>
      </div>

      {lockedAthlete ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
          {t('activitiesPayments.filters.lockedAthlete')}: {lockedAthlete.firstName} {lockedAthlete.lastName}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-base-300 bg-base-100 p-3 md:grid-cols-8 md:items-end">
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
          <span className="label-text mb-1 text-xs">{t('activitiesPayments.table.frequency')}</span>
          <select
            className="select select-bordered w-full"
            value={frequencyFilter}
            onChange={(event) => setFrequencyFilter(event.target.value as FrequencyFilter)}
          >
            <option value="all">{t('activitiesPayments.filters.allFrequencies')}</option>
            <option value="daily">{t('utility.packages.paymentFrequencyDaily')}</option>
            <option value="weekly">{t('utility.packages.paymentFrequencyWeekly')}</option>
            <option value="monthly">{t('utility.packages.paymentFrequencyMonthly')}</option>
            <option value="yearly">{t('utility.packages.paymentFrequencyYearly')}</option>
          </select>
        </label>
        <label className="form-control">
          <span className="label-text mb-1 text-xs">{t('activitiesPayments.filters.plan')}</span>
          <select
            className="select select-bordered w-full"
            value={planFilter}
            onChange={(event) => setPlanFilter(event.target.value as 'all' | 'generated' | 'not_generated')}
            disabled={tab !== 'activities'}
          >
            <option value="all">{t('activitiesPayments.filters.allPlans')}</option>
            <option value="generated">{t('activitiesPayments.filters.generatedPlan')}</option>
            <option value="not_generated">{t('activitiesPayments.filters.notGeneratedPlan')}</option>
          </select>
        </label>
        <label className="form-control">
          <span className="label-text mb-1 text-xs">{t('activitiesPayments.filters.periodFromMonth')}</span>
          <input
            type="month"
            className="input input-bordered w-full"
            value={periodFromMonth}
            max={currentPeriodMonth}
            onChange={(event) => onChangePeriodFrom(event.target.value)}
          />
        </label>
        <label className="form-control">
          <span className="label-text mb-1 text-xs">{t('activitiesPayments.filters.periodToMonth')}</span>
          <input
            type="month"
            className="input input-bordered w-full"
            value={periodToMonth}
            max={currentPeriodMonth}
            onChange={(event) => onChangePeriodTo(event.target.value)}
          />
        </label>
        <div className="form-control">
          <button type="button" className="btn btn-outline btn-sm" onClick={resetFilters}>
            {t('common.resetFilters')}
          </button>
        </div>
        <div className="form-control md:col-span-8">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-xs btn-outline" onClick={() => applyPeriodPreset('current')}>
              {t('activitiesPayments.filters.quickCurrentMonth')}
            </button>
            <button type="button" className="btn btn-xs btn-outline" onClick={() => applyPeriodPreset('last3')}>
              {t('activitiesPayments.filters.quickLast3Months')}
            </button>
            <button type="button" className="btn btn-xs btn-outline" onClick={() => applyPeriodPreset('last6')}>
              {t('activitiesPayments.filters.quickLast6Months')}
            </button>
            <button type="button" className="btn btn-xs btn-outline" onClick={() => applyPeriodPreset('year')}>
              {t('activitiesPayments.filters.quickCurrentYear')}
            </button>
          </div>
        </div>
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
      </div>

      {tab === 'activities' ? (
        <div className="rounded-lg border border-base-300 bg-base-100">
          {filteredActivitiesByPeriod.length === 0 ? <p className="p-4 text-center text-sm opacity-70">{t('activitiesPayments.empty')}</p> : <DataTable table={activitiesTable} />}
        </div>
      ) : null}

      {tab === 'deadlines' ? (
        <div className="rounded-lg border border-base-300 bg-base-100">
          {scadenzeTabRows.length === 0 ? <p className="p-4 text-center text-sm opacity-70">{t('activitiesPayments.empty')}</p> : <DataTable table={scadenzeTable} />}
        </div>
      ) : null}

      {tab === 'collections' ? (
        <div className="rounded-lg border border-base-300 bg-base-100">
          {incassiTabRows.length === 0 ? <p className="p-4 text-center text-sm opacity-70">{t('activitiesPayments.empty')}</p> : <DataTable table={incassiTable} />}
        </div>
      ) : null}

      {tab === 'expired' ? (
        <div className="rounded-lg border border-base-300 bg-base-100">
          {scaduteTabRows.length === 0 ? <p className="p-4 text-center text-sm opacity-70">{t('activitiesPayments.empty')}</p> : <DataTable table={scaduteTable} />}
        </div>
      ) : null}

      {tab === 'overdue' ? (
        <div className="rounded-lg border border-base-300 bg-base-100">
          {insolutiTabRows.length === 0 ? <p className="p-4 text-center text-sm opacity-70">{t('activitiesPayments.empty')}</p> : <DataTable table={insolutiTable} />}
        </div>
      ) : null}

      {isExportModalOpen ? (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-xl space-y-4">
            <h3 className="text-lg font-semibold">{t('activitiesPayments.export.modalTitle')}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('activitiesPayments.export.scopeLabel')}</span>
                <select
                  className="select select-bordered w-full"
                  value={exportScope}
                  onChange={(event) => setExportScope(event.target.value as ActivitiesExportScope)}
                >
                  <option value="activities">{t('activitiesPayments.export.scopeActivities')}</option>
                  <option value="payments">{t('activitiesPayments.export.scopePayments')}</option>
                </select>
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('activitiesPayments.export.formatLabel')}</span>
                <select
                  className="select select-bordered w-full"
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value as ActivitiesExportFormat)}
                >
                  <option value="xlsx">{t('activitiesPayments.export.formats.xlsx')}</option>
                  <option value="pdf">{t('activitiesPayments.export.formats.pdf')}</option>
                  <option value="docx">{t('activitiesPayments.export.formats.docx')}</option>
                </select>
              </label>
            </div>
            <p className="text-xs opacity-70">
              {t('activitiesPayments.export.rowsCount', {
                count: exportScope === 'activities' ? activitiesExportRows.length : paymentsExportRows.length,
              })}
            </p>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setIsExportModalOpen(false)}>
                {t('utility.categories.cancelEdit')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={(exportScope === 'activities' ? activitiesExportRows : paymentsExportRows).length === 0}
                onClick={() => {
                  void handleExport()
                }}
              >
                {t('activitiesPayments.export.download')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={() => setIsExportModalOpen(false)} />
        </dialog>
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
                <label className="label cursor-pointer justify-start gap-2 md:col-span-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-primary"
                    checked={planDraft.contractSigned}
                    onChange={(event) => setPlanDraft((prev) => (prev ? { ...prev, contractSigned: event.target.checked } : prev))}
                  />
                  <span className="label-text">Contratto firmato</span>
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('activitiesPayments.plan.enrollmentFee')}</span>
                  <input
                  type="number"
                  min={0}
                  className="input input-bordered w-full"
                  value={planDraft.enrollmentFee}
                  onChange={(event) => updatePlanDraftAndInstallments((prev) => ({ ...prev, enrollmentFee: Number(event.target.value) }))}
                />
                {isEnrollmentFeeCovered ? (
                  <span className="mt-1 text-xs text-success">{t('activitiesPayments.plan.enrollmentFeeCoveredNote')}</span>
                ) : null}
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
              {planDraft.services.length > 0 ? (
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
              ) : null}
            </div>

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
