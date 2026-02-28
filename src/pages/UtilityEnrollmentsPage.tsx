import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { SquarePen, Trash2 } from 'lucide-react'
import DataTable from '../components/DataTable'
import {
  createEnrollment,
  getEnrollments,
  getPackageCatalogChangedEventName,
  removeEnrollment,
  updateEnrollment,
  type EnrollmentType,
  type SaveEnrollmentPayload,
} from '../lib/package-catalog'

function UtilityEnrollmentsPage() {
  const { t } = useTranslation()
  const [enrollments, setEnrollments] = useState<EnrollmentType[]>(() => getEnrollments())
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingEnrollmentId, setEditingEnrollmentId] = useState<string | null>(null)
  const [modalDraft, setModalDraft] = useState<SaveEnrollmentPayload>({
    title: '',
    description: '',
  })
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const packageCatalogEvent = getPackageCatalogChangedEventName()

  useEffect(() => {
    const handleCatalogChange = () => {
      setEnrollments(getEnrollments())
    }
    window.addEventListener(packageCatalogEvent, handleCatalogChange)
    return () => window.removeEventListener(packageCatalogEvent, handleCatalogChange)
  }, [packageCatalogEvent])

  const applyError = useCallback(() => {
    setIsError(true)
    setMessage(t('utility.enrollments.invalidData'))
  }, [t])

  const closeModal = () => {
    setModalMode(null)
    setEditingEnrollmentId(null)
  }

  const openCreateModal = () => {
    setModalDraft({ title: '', description: '' })
    setEditingEnrollmentId(null)
    setModalMode('create')
  }

  const openEditModal = useCallback((enrollment: EnrollmentType) => {
    setModalDraft({
      title: enrollment.title,
      description: enrollment.description,
    })
    setEditingEnrollmentId(enrollment.id)
    setModalMode('edit')
  }, [])

  const handleModalSubmit = () => {
    if (modalMode === 'create') {
      const result = createEnrollment(modalDraft)
      if (!result.ok) {
        applyError()
        return
      }
      setEnrollments(getEnrollments())
      setIsError(false)
      setMessage(t('utility.enrollments.created'))
      closeModal()
      return
    }

    if (modalMode === 'edit' && editingEnrollmentId) {
      const result = updateEnrollment(editingEnrollmentId, modalDraft)
      if (!result.ok) {
        applyError()
        return
      }
      setEnrollments(getEnrollments())
      setIsError(false)
      setMessage(t('utility.enrollments.updated'))
      closeModal()
    }
  }

  const handleDelete = useCallback((enrollment: EnrollmentType) => {
    const confirmed = window.confirm(
      t('utility.enrollments.confirmDelete', {
        title: enrollment.title,
      }),
    )
    if (!confirmed) {
      return
    }

    const result = removeEnrollment(enrollment.id)
    if (!result.ok) {
      applyError()
      return
    }

    if (editingEnrollmentId === enrollment.id) {
      closeModal()
    }

    setEnrollments(getEnrollments())
    setIsError(false)
    setMessage(t('utility.enrollments.deleted'))
  }, [applyError, editingEnrollmentId, t])

  const columns = useMemo<ColumnDef<EnrollmentType>[]>(
    () => [
      {
        id: 'title',
        header: t('utility.enrollments.titleLabel'),
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        id: 'description',
        header: t('utility.enrollments.descriptionLabel'),
        cell: ({ row }) => <span className="line-clamp-2">{row.original.description}</span>,
      },
      {
        id: 'actions',
        header: () => <div className="text-right">{t('utility.categories.actions')}</div>,
        cell: ({ row }) => {
          const enrollment = row.original
          return (
            <div className="flex justify-end gap-3 pr-1">
              <button
                type="button"
                className="btn btn-ghost btn-sm px-2 text-warning"
                onClick={() => openEditModal(enrollment)}
                aria-label={t('utility.categories.edit')}
              >
                <SquarePen className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm px-2 text-error"
                onClick={() => handleDelete(enrollment)}
                aria-label={t('utility.categories.delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        },
      },
    ],
    [handleDelete, openEditModal, t],
  )

  const table = useReactTable({
    data: enrollments,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{t('utility.enrollments.title')}</h2>
          <p className="text-sm opacity-70">{t('utility.enrollments.description')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          {t('utility.enrollments.create')}
        </button>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body space-y-4">
          {message && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                isError ? 'bg-error/15 text-error' : 'bg-success/15 text-success'
              }`}
            >
              {message}
            </p>
          )}

          {enrollments.length === 0 ? (
            <p className="text-sm opacity-70">{t('utility.enrollments.empty')}</p>
          ) : (
            <DataTable table={table} />
          )}
        </div>
      </div>

      {modalMode && (
        <dialog className="modal modal-open">
          <div className="modal-box space-y-4">
            <h3 className="text-lg font-semibold">
              {modalMode === 'create' ? t('utility.enrollments.create') : t('utility.categories.saveEdit')}
            </h3>

            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.enrollments.titleLabel')}</span>
              <input
                className="input input-bordered w-full"
                value={modalDraft.title}
                onChange={(event) =>
                  setModalDraft((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
              />
            </label>

            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.enrollments.descriptionLabel')}</span>
              <textarea
                className="textarea textarea-bordered min-h-28 w-full"
                value={modalDraft.description}
                onChange={(event) =>
                  setModalDraft((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </label>

            <div className="modal-action gap-3">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                {t('utility.categories.cancelEdit')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleModalSubmit}>
                {modalMode === 'create' ? t('utility.enrollments.create') : t('utility.categories.saveEdit')}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            onClick={closeModal}
            aria-label={t('utility.categories.cancelEdit')}
          />
        </dialog>
      )}
    </section>
  )
}

export default UtilityEnrollmentsPage
