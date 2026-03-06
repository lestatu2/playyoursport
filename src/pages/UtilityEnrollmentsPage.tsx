import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { Check, SquarePen, Trash2, X } from 'lucide-react'
import DataTable from '../components/DataTable'
import RichTextEditor from '../components/RichTextEditor'
import {
  createEnrollment,
  createEnrollmentInsurance,
  getEnrollmentInsurances,
  getEnrollments,
  getPackageCatalogChangedEventName,
  removeEnrollment,
  removeEnrollmentInsurance,
  updateEnrollment,
  updateEnrollmentInsurance,
  type EnrollmentInsurance,
  type EnrollmentType,
  type SaveEnrollmentPayload,
  type SaveInsurancePayload,
} from '../lib/package-catalog'

type UtilityEnrollmentsTab = 'insurances' | 'enrollments'

function formatInsuranceTitleForUi(value: string): string {
  const raw = value.trim()
  if (!raw) {
    return ''
  }
  const isTechnical = /^[a-z0-9_-]+$/i.test(raw) && (raw.includes('insurance') || raw.includes('enrollment'))
  if (!isTechnical) {
    return raw
  }
  const normalized = raw
    .replace(/^insurance[-_]?/i, '')
    .replace(/^enrollment[-_]?/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
  if (!normalized) {
    return 'Assicurazione'
  }
  const title = normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((item) => item[0].toUpperCase() + item.slice(1).toLowerCase())
    .join(' ')
  return `Assicurazione ${title}`
}

function UtilityEnrollmentsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<UtilityEnrollmentsTab>('enrollments')
  const [enrollments, setEnrollments] = useState<EnrollmentType[]>(() => getEnrollments())
  const [insurances, setInsurances] = useState<EnrollmentInsurance[]>(() => getEnrollmentInsurances())
  const [enrollmentModalMode, setEnrollmentModalMode] = useState<'create' | 'edit' | null>(null)
  const [insuranceModalMode, setInsuranceModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingEnrollmentId, setEditingEnrollmentId] = useState<string | null>(null)
  const [editingInsuranceId, setEditingInsuranceId] = useState<string | null>(null)
  const [enrollmentDraft, setEnrollmentDraft] = useState<SaveEnrollmentPayload>({
    title: '',
    description: '',
    insuranceId: '',
    coveredEnrollmentIds: [],
    alwaysRequirePurchase: false,
    validityMode: 'annual_365',
  })
  const [insuranceDraft, setInsuranceDraft] = useState<SaveInsurancePayload>({
    title: '',
    description: '',
    coverageText: '',
    exclusionsText: '',
    durationText: '',
    isActive: true,
  })
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const packageCatalogEvent = getPackageCatalogChangedEventName()
  const insuranceLabelById = useMemo(() => new Map(insurances.map((item) => [item.id, item.title])), [insurances])
  const enrollmentLabelById = useMemo(() => new Map(enrollments.map((item) => [item.id, item.title])), [enrollments])

  const refresh = useCallback(() => {
    setEnrollments(getEnrollments())
    setInsurances(getEnrollmentInsurances())
  }, [])

  useEffect(() => {
    const handleCatalogChange = () => refresh()
    window.addEventListener(packageCatalogEvent, handleCatalogChange)
    return () => window.removeEventListener(packageCatalogEvent, handleCatalogChange)
  }, [packageCatalogEvent, refresh])

  const applyError = useCallback((fallbackKey = 'utility.enrollments.invalidData') => {
    setIsError(true)
    setMessage(t(fallbackKey))
  }, [t])

  const closeEnrollmentModal = () => {
    setEnrollmentModalMode(null)
    setEditingEnrollmentId(null)
  }

  const closeInsuranceModal = () => {
    setInsuranceModalMode(null)
    setEditingInsuranceId(null)
  }

  const openCreateInsuranceModal = () => {
    setInsuranceDraft({ title: '', description: '', coverageText: '', exclusionsText: '', durationText: '', isActive: true })
    setEditingInsuranceId(null)
    setInsuranceModalMode('create')
  }

  const openEditInsuranceModal = (insurance: EnrollmentInsurance) => {
    setInsuranceDraft({
      title: insurance.title,
      description: insurance.description,
      coverageText: insurance.coverageText,
      exclusionsText: insurance.exclusionsText,
      durationText: insurance.durationText,
      isActive: insurance.isActive,
    })
    setEditingInsuranceId(insurance.id)
    setInsuranceModalMode('edit')
  }

  const openCreateEnrollmentModal = () => {
    setEnrollmentDraft({
      title: '',
      description: '',
      insuranceId: insurances[0]?.id ?? '',
      coveredEnrollmentIds: [],
      alwaysRequirePurchase: false,
      validityMode: 'annual_365',
    })
    setEditingEnrollmentId(null)
    setEnrollmentModalMode('create')
  }

  const openEditEnrollmentModal = (enrollment: EnrollmentType) => {
    setEnrollmentDraft({
      title: enrollment.title,
      description: enrollment.description,
      insuranceId: enrollment.insuranceId,
      coveredEnrollmentIds: enrollment.coveredEnrollmentIds.filter((item) => item !== enrollment.id),
      alwaysRequirePurchase: enrollment.alwaysRequirePurchase,
      validityMode: enrollment.validityMode,
    })
    setEditingEnrollmentId(enrollment.id)
    setEnrollmentModalMode('edit')
  }

  const saveInsurance = () => {
    if (insuranceModalMode === 'create') {
      const result = createEnrollmentInsurance(insuranceDraft)
      if (!result.ok) {
        applyError()
        return
      }
      refresh()
      setIsError(false)
      setMessage(t('utility.insurances.created'))
      closeInsuranceModal()
      return
    }
    if (insuranceModalMode === 'edit' && editingInsuranceId) {
      const result = updateEnrollmentInsurance(editingInsuranceId, insuranceDraft)
      if (!result.ok) {
        applyError()
        return
      }
      refresh()
      setIsError(false)
      setMessage(t('utility.insurances.updated'))
      closeInsuranceModal()
    }
  }

  const saveEnrollment = () => {
    if (enrollmentModalMode === 'create') {
      const result = createEnrollment(enrollmentDraft)
      if (!result.ok) {
        if (result.error === 'insuranceNotFound') {
          applyError('utility.enrollments.insuranceRequired')
          return
        }
        applyError()
        return
      }
      refresh()
      setIsError(false)
      setMessage(t('utility.enrollments.created'))
      closeEnrollmentModal()
      return
    }
    if (enrollmentModalMode === 'edit' && editingEnrollmentId) {
      const result = updateEnrollment(editingEnrollmentId, enrollmentDraft)
      if (!result.ok) {
        if (result.error === 'insuranceNotFound') {
          applyError('utility.enrollments.insuranceRequired')
          return
        }
        applyError()
        return
      }
      refresh()
      setIsError(false)
      setMessage(t('utility.enrollments.updated'))
      closeEnrollmentModal()
    }
  }

  const deleteInsurance = (insurance: EnrollmentInsurance) => {
    const confirmed = window.confirm(t('utility.insurances.confirmDelete', { title: insurance.title }))
    if (!confirmed) {
      return
    }
    const result = removeEnrollmentInsurance(insurance.id)
    if (!result.ok) {
      if (result.error === 'insuranceInUse') {
        applyError('utility.insurances.inUse')
        return
      }
      applyError()
      return
    }
    refresh()
    setIsError(false)
    setMessage(t('utility.insurances.deleted'))
  }

  const deleteEnrollment = (enrollment: EnrollmentType) => {
    const confirmed = window.confirm(t('utility.enrollments.confirmDelete', { title: enrollment.title }))
    if (!confirmed) {
      return
    }
    const result = removeEnrollment(enrollment.id)
    if (!result.ok) {
      applyError()
      return
    }
    refresh()
    setIsError(false)
    setMessage(t('utility.enrollments.deleted'))
  }

  const insuranceColumns = useMemo<ColumnDef<EnrollmentInsurance>[]>(
    () => [
      {
        id: 'title',
        header: t('utility.insurances.titleLabel'),
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        id: 'description',
        header: t('utility.insurances.descriptionLabel'),
        cell: ({ row }) => <span className="line-clamp-2">{row.original.description}</span>,
      },
      {
        id: 'coverageText',
        header: t('utility.insurances.coverageTextLabel'),
        cell: ({ row }) =>
          row.original.coverageText.trim() ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <X className="h-4 w-4 text-error" />
          ),
      },
      {
        id: 'exclusionsText',
        header: t('utility.insurances.exclusionsTextLabel'),
        cell: ({ row }) =>
          row.original.exclusionsText.trim() ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <X className="h-4 w-4 text-error" />
          ),
      },
      {
        id: 'durationText',
        header: t('utility.insurances.durationTextLabel'),
        cell: ({ row }) =>
          row.original.durationText.trim() ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <X className="h-4 w-4 text-error" />
          ),
      },
      {
        id: 'active',
        header: t('utility.insurances.activeLabel'),
        cell: ({ row }) => (
          <span className={`badge ${row.original.isActive ? 'badge-success' : 'badge-ghost'}`}>
            {row.original.isActive ? t('utility.categories.active') : t('utility.categories.inactive')}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <div className="text-right">{t('utility.categories.actions')}</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <button type="button" className="btn btn-ghost btn-sm px-1 text-warning" onClick={() => openEditInsuranceModal(row.original)}>
              <SquarePen className="h-4 w-4" />
            </button>
            <button type="button" className="btn btn-ghost btn-sm px-1 text-error" onClick={() => deleteInsurance(row.original)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [t],
  )

  const enrollmentColumns = useMemo<ColumnDef<EnrollmentType>[]>(
    () => [
      {
        id: 'title',
        header: t('utility.enrollments.titleLabel'),
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        id: 'insurance',
        header: t('utility.enrollments.insuranceLabel'),
        cell: ({ row }) => {
          const resolved = insuranceLabelById.get(row.original.insuranceId) ?? row.original.insuranceId
          return formatInsuranceTitleForUi(resolved) || '-'
        },
      },
      {
        id: 'validity',
        header: t('utility.enrollments.validityModeLabel'),
        cell: ({ row }) =>
          row.original.validityMode === 'edition_period'
            ? t('utility.enrollments.validityEditionPeriod')
            : t('utility.enrollments.validityAnnual365'),
      },
      {
        id: 'alwaysRequirePurchase',
        header: t('utility.enrollments.alwaysRequirePurchaseLabel'),
        cell: ({ row }) => (
          <span className={`badge ${row.original.alwaysRequirePurchase ? 'badge-warning' : 'badge-ghost'}`}>
            {row.original.alwaysRequirePurchase ? t('utility.enrollments.alwaysRequirePurchaseYes') : t('utility.enrollments.alwaysRequirePurchaseNo')}
          </span>
        ),
      },
      {
        id: 'covered',
        header: t('utility.enrollments.coveredEnrollmentsLabel'),
        cell: ({ row }) => {
          const covered = row.original.coveredEnrollmentIds
            .filter((id) => id !== row.original.id)
            .map((id) => enrollmentLabelById.get(id) ?? id)
            .join(', ')
          return <span className="text-xs">{covered || '-'}</span>
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-right">{t('utility.categories.actions')}</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <button type="button" className="btn btn-ghost btn-sm px-1 text-warning" onClick={() => openEditEnrollmentModal(row.original)}>
              <SquarePen className="h-4 w-4" />
            </button>
            <button type="button" className="btn btn-ghost btn-sm px-1 text-error" onClick={() => deleteEnrollment(row.original)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [enrollmentLabelById, insuranceLabelById, t],
  )

  const insuranceTable = useReactTable({
    data: insurances,
    columns: insuranceColumns,
    getCoreRowModel: getCoreRowModel(),
  })
  const enrollmentTable = useReactTable({
    data: enrollments,
    columns: enrollmentColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  const toggleCoveredEnrollment = (coveredId: string, checked: boolean) => {
    setEnrollmentDraft((prev) => {
      const nextSet = new Set(prev.coveredEnrollmentIds)
      if (checked) {
        nextSet.add(coveredId)
      } else {
        nextSet.delete(coveredId)
      }
      return {
        ...prev,
        coveredEnrollmentIds: Array.from(nextSet),
      }
    })
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{t('utility.enrollments.title')}</h2>
          <p className="text-sm opacity-70">{t('utility.enrollments.description')}</p>
        </div>
      </div>

      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            isError ? 'bg-error/15 text-error' : 'bg-success/15 text-success'
          }`}
        >
          {message}
        </p>
      )}

      <div role="tablist" className="tabs tabs-boxed bg-base-200">
        <button type="button" role="tab" className={`tab ${tab === 'enrollments' ? 'tab-active' : ''}`} onClick={() => setTab('enrollments')}>
          {t('utility.enrollments.tabEnrollments')}
        </button>
        <button type="button" role="tab" className={`tab ${tab === 'insurances' ? 'tab-active' : ''}`} onClick={() => setTab('insurances')}>
          {t('utility.enrollments.tabInsurances')}
        </button>
      </div>

      {tab === 'enrollments' ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body space-y-4">
            <div className="flex justify-end">
              <button type="button" className="btn btn-primary" onClick={openCreateEnrollmentModal}>
                {t('utility.enrollments.create')}
              </button>
            </div>
            {enrollments.length === 0 ? <p className="text-sm opacity-70">{t('utility.enrollments.empty')}</p> : <DataTable table={enrollmentTable} />}
          </div>
        </div>
      ) : null}

      {tab === 'insurances' ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body space-y-4">
            <div className="flex justify-end">
              <button type="button" className="btn btn-primary" onClick={openCreateInsuranceModal}>
                {t('utility.insurances.create')}
              </button>
            </div>
            {insurances.length === 0 ? <p className="text-sm opacity-70">{t('utility.insurances.empty')}</p> : <DataTable table={insuranceTable} />}
          </div>
        </div>
      ) : null}

      {enrollmentModalMode ? (
        <dialog className="modal modal-open">
          <div className="modal-box space-y-4">
            <h3 className="text-lg font-semibold">
              {enrollmentModalMode === 'create' ? t('utility.enrollments.create') : t('utility.categories.saveEdit')}
            </h3>
            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.enrollments.titleLabel')}</span>
              <input className="input input-bordered w-full" value={enrollmentDraft.title} onChange={(event) => setEnrollmentDraft((prev) => ({ ...prev, title: event.target.value }))} />
            </label>
            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.enrollments.descriptionLabel')}</span>
              <textarea className="textarea textarea-bordered min-h-24 w-full" value={enrollmentDraft.description} onChange={(event) => setEnrollmentDraft((prev) => ({ ...prev, description: event.target.value }))} />
            </label>
            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.enrollments.insuranceLabel')}</span>
              <select className="select select-bordered w-full" value={enrollmentDraft.insuranceId} onChange={(event) => setEnrollmentDraft((prev) => ({ ...prev, insuranceId: event.target.value }))}>
                {insurances.map((insurance) => (
                  <option key={insurance.id} value={insurance.id}>
                    {formatInsuranceTitleForUi(insurance.title) || 'Assicurazione'}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.enrollments.validityModeLabel')}</span>
              <select className="select select-bordered w-full" value={enrollmentDraft.validityMode} onChange={(event) => setEnrollmentDraft((prev) => ({ ...prev, validityMode: event.target.value === 'edition_period' ? 'edition_period' : 'annual_365' }))}>
                <option value="annual_365">{t('utility.enrollments.validityAnnual365')}</option>
                <option value="edition_period">{t('utility.enrollments.validityEditionPeriod')}</option>
              </select>
            </label>
            <label className="label cursor-pointer justify-start gap-2">
              <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={enrollmentDraft.alwaysRequirePurchase} onChange={(event) => setEnrollmentDraft((prev) => ({ ...prev, alwaysRequirePurchase: event.target.checked }))} />
              <span className="label-text">{t('utility.enrollments.alwaysRequirePurchaseLabel')}</span>
            </label>
            <div className="rounded border border-base-300 p-2">
              <p className="text-xs font-semibold">{t('utility.enrollments.coveredEnrollmentsLabel')}</p>
              <div className="mt-2 grid grid-cols-1 gap-1">
                {enrollments
                  .filter((item) => (editingEnrollmentId ? item.id !== editingEnrollmentId : true))
                  .map((item) => {
                  const checked = enrollmentDraft.coveredEnrollmentIds.includes(item.id)
                  return (
                    <label key={item.id} className="label cursor-pointer justify-start gap-2 py-1">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs checkbox-primary"
                        checked={checked}
                        onChange={(event) => toggleCoveredEnrollment(item.id, event.target.checked)}
                      />
                      <span className="label-text">{item.title}</span>
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="modal-action gap-3">
              <button type="button" className="btn btn-ghost" onClick={closeEnrollmentModal}>
                {t('utility.categories.cancelEdit')}
              </button>
              <button type="button" className="btn btn-primary" onClick={saveEnrollment}>
                {enrollmentModalMode === 'create' ? t('utility.enrollments.create') : t('utility.categories.saveEdit')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeEnrollmentModal} />
        </dialog>
      ) : null}

      {insuranceModalMode ? (
        <dialog className="modal modal-open">
          <div className="modal-box space-y-4">
            <h3 className="text-lg font-semibold">
              {insuranceModalMode === 'create' ? t('utility.insurances.create') : t('utility.categories.saveEdit')}
            </h3>
            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.insurances.titleLabel')}</span>
              <input className="input input-bordered w-full" value={insuranceDraft.title} onChange={(event) => setInsuranceDraft((prev) => ({ ...prev, title: event.target.value }))} />
            </label>
            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.insurances.descriptionLabel')}</span>
              <textarea className="textarea textarea-bordered min-h-24 w-full" value={insuranceDraft.description} onChange={(event) => setInsuranceDraft((prev) => ({ ...prev, description: event.target.value }))} />
            </label>
            <div className="space-y-2 rounded border border-base-300 p-2">
              <p className="text-xs font-semibold">{t('utility.insurances.coverageTextLabel')}</p>
              <RichTextEditor
                value={insuranceDraft.coverageText}
                onChange={(nextValue) =>
                  setInsuranceDraft((prev) => ({ ...prev, coverageText: nextValue }))
                }
                minHeightClassName="min-h-32"
              />
            </div>
            <div className="space-y-2 rounded border border-base-300 p-2">
              <p className="text-xs font-semibold">{t('utility.insurances.exclusionsTextLabel')}</p>
              <RichTextEditor
                value={insuranceDraft.exclusionsText}
                onChange={(nextValue) =>
                  setInsuranceDraft((prev) => ({ ...prev, exclusionsText: nextValue }))
                }
                minHeightClassName="min-h-32"
              />
            </div>
            <div className="space-y-2 rounded border border-base-300 p-2">
              <p className="text-xs font-semibold">{t('utility.insurances.durationTextLabel')}</p>
              <RichTextEditor
                value={insuranceDraft.durationText}
                onChange={(nextValue) =>
                  setInsuranceDraft((prev) => ({ ...prev, durationText: nextValue }))
                }
                minHeightClassName="min-h-24"
              />
            </div>
            <label className="label cursor-pointer justify-start gap-2">
              <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={insuranceDraft.isActive} onChange={(event) => setInsuranceDraft((prev) => ({ ...prev, isActive: event.target.checked }))} />
              <span className="label-text">{t('utility.insurances.activeLabel')}</span>
            </label>
            <div className="modal-action gap-3">
              <button type="button" className="btn btn-ghost" onClick={closeInsuranceModal}>
                {t('utility.categories.cancelEdit')}
              </button>
              <button type="button" className="btn btn-primary" onClick={saveInsurance}>
                {insuranceModalMode === 'create' ? t('utility.insurances.create') : t('utility.categories.saveEdit')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeInsuranceModal} />
        </dialog>
      ) : null}
    </section>
  )
}

export default UtilityEnrollmentsPage
