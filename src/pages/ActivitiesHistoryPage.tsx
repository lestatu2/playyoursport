import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import DataTable from '../components/DataTable'
import { getPackages } from '../lib/package-catalog'
import { getPublicClients, getPublicMinors } from '../lib/public-customer-records'
import { getPublicDirectAthletes } from '../lib/public-direct-athletes'
import { getActivityPaymentPlans } from '../lib/activity-payment-plans'

type HistoryTypeFilter = 'all' | 'minor' | 'adult'
type HistoryBalanceFilter = 'all' | 'ok' | 'partial' | 'overdue'
type HistoryFrequencyFilter = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly'

type HistoryRow = {
  key: string
  athleteId: string
  clientId: number | null
  athleteName: string
  athleteType: 'minor' | 'adult'
  parentLabel: string
  packageId: string
  packageName: string
  periodLabel: string
  closureDate: string
  totalDue: number
  totalPaid: number
  residual: number
  overdueCount: number
  planInstallmentsCount: number
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

function dateOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function isClosedEdition(input: { durationType: string; periodEndDate?: string; eventDate?: string }, today: Date): boolean {
  if (input.durationType === 'period') {
    const end = parseIsoDate(input.periodEndDate || '')
    return Boolean(end && dateOnly(end) < today)
  }
  const eventDate = parseIsoDate(input.eventDate || '')
  return Boolean(eventDate && dateOnly(eventDate) < today)
}

function safeAmount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function getFrequencyLabelKey(frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'): string {
  return `utility.packages.paymentFrequency${frequency[0].toUpperCase()}${frequency.slice(1)}`
}

function summarizePlan(plan: ReturnType<typeof getActivityPaymentPlans>[number] | null, today: Date) {
  const installments = plan?.installments ?? []
  const totalDue = installments.reduce((sum, item) => sum + safeAmount(item.amount), 0)
  const totalPaid = installments
    .filter((item) => item.paymentStatus === 'paid')
    .reduce((sum, item) => sum + safeAmount(item.amount), 0)
  const overdueCount = installments.filter((item) => {
    if (item.paymentStatus !== 'pending') {
      return false
    }
    const due = parseIsoDate(item.dueDate)
    return Boolean(due && dateOnly(due) < today)
  }).length
  return {
    totalDue,
    totalPaid,
    overdueCount,
    installmentsCount: installments.length,
  }
}

function ActivitiesHistoryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [globalSearch, setGlobalSearch] = useState('')
  const [packageFilter, setPackageFilter] = useState('all')
  const [frequencyFilter, setFrequencyFilter] = useState<HistoryFrequencyFilter>('all')
  const [typeFilter, setTypeFilter] = useState<HistoryTypeFilter>('all')
  const [balanceFilter, setBalanceFilter] = useState<HistoryBalanceFilter>('all')
  const [closureDateFrom, setClosureDateFrom] = useState('')
  const [closureDateTo, setClosureDateTo] = useState('')
  const lockedAthleteId = searchParams.get('athleteId')

  const packages = useMemo(() => getPackages(), [])
  const packagesById = useMemo(() => new Map(packages.map((item) => [item.id, item])), [packages])
  const plansByActivityKey = useMemo(() => new Map(getActivityPaymentPlans().map((item) => [item.activityKey, item])), [])
  const clientsById = useMemo(() => new Map(getPublicClients().map((item) => [item.id, item])), [])
  const minors = useMemo(() => getPublicMinors(), [])
  const directAthletes = useMemo(() => getPublicDirectAthletes(), [])

  const rows = useMemo<HistoryRow[]>(() => {
    const today = dateOnly(new Date())
    const mappedRows: HistoryRow[] = []

    minors.forEach((minor) => {
      const packageItem = packagesById.get(minor.packageId)
      if (!packageItem || !isClosedEdition(packageItem, today)) {
        return
      }
      const parent = clientsById.get(minor.clientId)
      const activityKey = `minor-${minor.id}`
      const plan = plansByActivityKey.get(activityKey) ?? null
      const summary = summarizePlan(plan, today)
      mappedRows.push({
        key: activityKey,
        athleteId: String(minor.id),
        clientId: minor.clientId,
        athleteName: `${minor.firstName} ${minor.lastName}`,
        athleteType: 'minor',
        parentLabel: parent ? `${parent.parentFirstName} ${parent.parentLastName}` : '-',
        packageId: packageItem.id,
        packageName: packageItem.name,
        periodLabel:
          packageItem.durationType === 'period'
            ? `${packageItem.periodStartDate || '-'} - ${packageItem.periodEndDate || '-'}`
            : packageItem.eventDate || '-',
        closureDate: packageItem.durationType === 'period' ? (packageItem.periodEndDate || '-') : (packageItem.eventDate || '-'),
        totalDue: summary.totalDue,
        totalPaid: summary.totalPaid,
        residual: Math.max(0, summary.totalDue - summary.totalPaid),
        overdueCount: summary.overdueCount,
        planInstallmentsCount: summary.installmentsCount,
      })
    })

    directAthletes.forEach((athlete) => {
      const packageItem = packagesById.get(athlete.packageId)
      if (!packageItem || !isClosedEdition(packageItem, today)) {
        return
      }
      const activityKey = `direct-${athlete.id}`
      const plan = plansByActivityKey.get(activityKey) ?? null
      const summary = summarizePlan(plan, today)
      mappedRows.push({
        key: activityKey,
        athleteId: athlete.id,
        clientId: athlete.clientId,
        athleteName: `${athlete.firstName} ${athlete.lastName}`,
        athleteType: 'adult',
        parentLabel: '-',
        packageId: packageItem.id,
        packageName: packageItem.name,
        periodLabel:
          packageItem.durationType === 'period'
            ? `${packageItem.periodStartDate || '-'} - ${packageItem.periodEndDate || '-'}`
            : packageItem.eventDate || '-',
        closureDate: packageItem.durationType === 'period' ? (packageItem.periodEndDate || '-') : (packageItem.eventDate || '-'),
        totalDue: summary.totalDue,
        totalPaid: summary.totalPaid,
        residual: Math.max(0, summary.totalDue - summary.totalPaid),
        overdueCount: summary.overdueCount,
        planInstallmentsCount: summary.installmentsCount,
      })
    })

    return mappedRows
  }, [clientsById, directAthletes, minors, packagesById, plansByActivityKey])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const isLegacyIdMatch = lockedAthleteId === row.athleteId
      if (lockedAthleteId && lockedAthleteId !== row.key && !isLegacyIdMatch) {
        return false
      }
      const haystack = `${row.athleteName} ${row.parentLabel} ${row.packageName} ${row.packageId}`.toLowerCase()
      if (globalSearch.trim() && !haystack.includes(globalSearch.trim().toLowerCase())) {
        return false
      }
      if (packageFilter !== 'all' && row.packageId !== packageFilter) {
        return false
      }
      if (frequencyFilter !== 'all') {
        const packageItem = packagesById.get(row.packageId)
        if (!packageItem || packageItem.paymentFrequency !== frequencyFilter) {
          return false
        }
      }
      if (typeFilter === 'minor' && row.athleteType !== 'minor') {
        return false
      }
      if (typeFilter === 'adult' && row.athleteType !== 'adult') {
        return false
      }
      if (closureDateFrom && row.closureDate !== '-' && row.closureDate < closureDateFrom) {
        return false
      }
      if (closureDateTo && row.closureDate !== '-' && row.closureDate > closureDateTo) {
        return false
      }
      if (balanceFilter === 'ok' && row.residual > 0) {
        return false
      }
      if (balanceFilter === 'partial' && (row.totalPaid <= 0 || row.residual <= 0)) {
        return false
      }
      return balanceFilter !== 'overdue' || row.overdueCount > 0
    })
  }, [balanceFilter, closureDateFrom, closureDateTo, frequencyFilter, globalSearch, lockedAthleteId, packageFilter, packagesById, rows, typeFilter])

  const resetFilters = () => {
    setGlobalSearch('')
    setPackageFilter('all')
    setFrequencyFilter('all')
    setTypeFilter('all')
    setBalanceFilter('all')
    setClosureDateFrom('')
    setClosureDateTo('')
  }

  const historyColumns = useMemo<ColumnDef<HistoryRow>[]>(() => [
    {
      id: 'athlete',
      header: t('activitiesPayments.table.athlete'),
      cell: ({ row }) => {
        const item = row.original
        if (item.athleteType === 'minor') {
          return (
            <button type="button" className="link text-base-content text-left" onClick={() => navigate(`/app/atleti?athleteId=${item.key}`)}>
              {item.athleteName}
            </button>
          )
        }
        if (item.clientId !== null) {
          return (
            <button type="button" className="link text-base-content text-left" onClick={() => navigate(`/app/clienti?clientId=${item.clientId}`)}>
              {item.athleteName}
            </button>
          )
        }
        return <span>{item.athleteName}</span>
      },
      meta: { responsivePriority: 'high' },
    },
    {
      id: 'athleteType',
      header: t('activitiesPayments.table.athleteType'),
      cell: ({ row }) => (
        <span className={`badge ${row.original.athleteType === 'minor' ? 'badge-info' : 'badge-primary'}`}>
          {row.original.athleteType === 'minor' ? t('activitiesPayments.types.minor') : t('athletes.adultType')}
        </span>
      ),
      meta: { responsivePriority: 'high' },
    },
    { id: 'parent', header: t('activitiesPayments.table.parent'), cell: ({ row }) => row.original.parentLabel, meta: { responsivePriority: 'low' } },
    {
      id: 'package',
      header: t('activitiesPayments.table.package'),
      cell: ({ row }) => (
        <button type="button" className="link text-base-content text-left" onClick={() => navigate(`/app/pacchetti?packageId=${row.original.packageId}`)}>
          {row.original.packageName}
        </button>
      ),
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
    { id: 'period', header: t('activitiesPayments.table.period'), cell: ({ row }) => row.original.periodLabel, meta: { responsivePriority: 'low' } },
    { id: 'closureDate', header: t('activitiesHistory.table.closureDate'), cell: ({ row }) => row.original.closureDate, meta: { responsivePriority: 'low' } },
    { id: 'totalDue', header: t('activitiesHistory.table.totalDue'), cell: ({ row }) => row.original.totalDue.toFixed(2), meta: { responsivePriority: 'low' } },
    { id: 'totalPaid', header: t('activitiesHistory.table.totalPaid'), cell: ({ row }) => row.original.totalPaid.toFixed(2), meta: { responsivePriority: 'low' } },
    { id: 'residual', header: t('activitiesHistory.table.residual'), cell: ({ row }) => row.original.residual.toFixed(2), meta: { responsivePriority: 'low' } },
    {
      id: 'status',
      header: t('activitiesHistory.table.status'),
      cell: ({ row }) => {
        const item = row.original
        if (item.planInstallmentsCount === 0) {
          return <span className="badge badge-ghost">{t('activitiesPayments.status.noPlan')}</span>
        }
        if (item.residual <= 0) {
          return <span className="badge badge-success">{t('activitiesHistory.status.balanceOk')}</span>
        }
        if (item.overdueCount > 0) {
          return <span className="badge badge-error">{t('activitiesHistory.status.withOverdue')}</span>
        }
        return <span className="badge badge-warning">{t('activitiesHistory.status.partial')}</span>
      },
      meta: { responsivePriority: 'high' },
    },
    {
      id: 'plan',
      header: t('activitiesPayments.table.plan'),
      cell: ({ row }) => (
        <button
          type="button"
          className={`btn btn-xs ${row.original.planInstallmentsCount > 0 ? 'btn-success' : 'btn-ghost'}`}
          onClick={() => navigate(`/app/attivita-pagamenti?athleteId=${row.original.key}`)}
        >
          {row.original.planInstallmentsCount > 0
            ? t('activitiesPayments.workflow.planGenerated', { count: row.original.planInstallmentsCount })
            : t('activitiesPayments.status.noPlan')}
        </button>
      ),
      meta: { responsivePriority: 'high' },
    },
  ], [navigate, packagesById, t])

  const historyTable = useReactTable({
    data: filteredRows,
    columns: historyColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{t('activitiesHistory.title')}</h2>
          <p className="text-sm opacity-70">{t('activitiesHistory.description')}</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/app/attivita-pagamenti')}>
          {t('activitiesHistory.backToActivitiesPayments')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-base-300 bg-base-100 p-3 md:grid-cols-8 md:items-end">
        <label className="form-control">
          <span className="label-text mb-1 text-xs">{t('activitiesHistory.filters.search')}</span>
          <input
            className="input input-bordered w-full"
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
            placeholder={t('activitiesHistory.filters.searchPlaceholder')}
          />
        </label>
        <label className="form-control">
          <span className="label-text mb-1 text-xs">{t('activitiesHistory.filters.package')}</span>
          <select className="select select-bordered w-full" value={packageFilter} onChange={(event) => setPackageFilter(event.target.value)}>
            <option value="all">{t('activitiesHistory.filters.allPackages')}</option>
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
            onChange={(event) => setFrequencyFilter(event.target.value as HistoryFrequencyFilter)}
          >
            <option value="all">{t('activitiesPayments.filters.allFrequencies')}</option>
            <option value="daily">{t('utility.packages.paymentFrequencyDaily')}</option>
            <option value="weekly">{t('utility.packages.paymentFrequencyWeekly')}</option>
            <option value="monthly">{t('utility.packages.paymentFrequencyMonthly')}</option>
            <option value="yearly">{t('utility.packages.paymentFrequencyYearly')}</option>
          </select>
        </label>
        <label className="form-control">
          <span className="label-text mb-1 text-xs">{t('activitiesHistory.filters.type')}</span>
          <select className="select select-bordered w-full" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as HistoryTypeFilter)}>
            <option value="all">{t('activitiesHistory.filters.allTypes')}</option>
            <option value="minor">{t('activitiesPayments.types.minor')}</option>
            <option value="adult">{t('athletes.adultType')}</option>
          </select>
        </label>
        <label className="form-control">
          <span className="label-text mb-1 text-xs">{t('activitiesHistory.filters.closureFrom')}</span>
          <input type="date" className="input input-bordered w-full" value={closureDateFrom} onChange={(event) => setClosureDateFrom(event.target.value)} />
        </label>
        <label className="form-control">
          <span className="label-text mb-1 text-xs">{t('activitiesHistory.filters.closureTo')}</span>
          <input type="date" className="input input-bordered w-full" value={closureDateTo} onChange={(event) => setClosureDateTo(event.target.value)} />
        </label>
        <div className="form-control">
          <button type="button" className="btn btn-outline btn-sm" onClick={resetFilters}>
            {t('common.resetFilters')}
          </button>
        </div>
        <label className="form-control">
          <span className="label-text mb-1 text-xs">{t('activitiesHistory.filters.balanceStatus')}</span>
          <select
            className="select select-bordered w-full"
            value={balanceFilter}
            onChange={(event) => setBalanceFilter(event.target.value as HistoryBalanceFilter)}
          >
            <option value="all">{t('activitiesHistory.filters.allBalanceStatuses')}</option>
            <option value="ok">{t('activitiesHistory.status.balanceOk')}</option>
            <option value="partial">{t('activitiesHistory.status.partial')}</option>
            <option value="overdue">{t('activitiesHistory.status.withOverdue')}</option>
          </select>
        </label>
      </div>

      <div className="rounded-lg border border-base-300 bg-base-100">
        {filteredRows.length === 0 ? <p className="p-4 text-center text-sm opacity-70">{t('activitiesHistory.empty')}</p> : <DataTable table={historyTable} />}
      </div>
    </section>
  )
}

export default ActivitiesHistoryPage
