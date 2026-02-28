import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { SquarePen, Trash2 } from 'lucide-react'
import DataTable from '../components/DataTable'
import {
  createField,
  getFields,
  getPackageCatalogChangedEventName,
  getSportCategories,
  removeField,
  updateField,
  type PackageCategory,
  type SaveFieldPayload,
  type SportField,
} from '../lib/package-catalog'

function UtilityFieldsPage() {
  const { t } = useTranslation()
  const [fields, setFields] = useState<SportField[]>(() => getFields())
  const [categories, setCategories] = useState<PackageCategory[]>(() => getSportCategories())
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [modalDraft, setModalDraft] = useState<SaveFieldPayload>({
    title: '',
    categoryId: '',
    description: '',
  })
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const packageCatalogEvent = getPackageCatalogChangedEventName()

  useEffect(() => {
    const handleCatalogChange = () => {
      setFields(getFields())
      setCategories(getSportCategories())
    }
    window.addEventListener(packageCatalogEvent, handleCatalogChange)
    return () => window.removeEventListener(packageCatalogEvent, handleCatalogChange)
  }, [packageCatalogEvent])

  const categoryLabelById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.label])),
    [categories],
  )

  const applyError = useCallback((code: 'invalid' | 'categoryNotFound' | 'notFound' | 'fieldInUse') => {
    setIsError(true)
    if (code === 'categoryNotFound') {
      setMessage(t('utility.fields.invalidCategory'))
      return
    }
    if (code === 'fieldInUse') {
      setMessage(t('utility.fields.fieldInUse'))
      return
    }
    setMessage(t('utility.fields.invalidData'))
  }, [t])

  const closeModal = () => {
    setModalMode(null)
    setEditingFieldId(null)
  }

  const openCreateModal = () => {
    setModalDraft({
      title: '',
      categoryId: categories[0]?.id ?? '',
      description: '',
    })
    setEditingFieldId(null)
    setModalMode('create')
  }

  const openEditModal = useCallback((field: SportField) => {
    setModalDraft({
      title: field.title,
      categoryId: field.categoryId,
      description: field.description,
    })
    setEditingFieldId(field.id)
    setModalMode('edit')
  }, [])

  const handleModalSubmit = () => {
    if (modalMode === 'create') {
      const result = createField(modalDraft)
      if (!result.ok) {
        applyError(result.error)
        return
      }
      setFields(getFields())
      setIsError(false)
      setMessage(t('utility.fields.created'))
      closeModal()
      return
    }

    if (modalMode === 'edit' && editingFieldId) {
      const result = updateField(editingFieldId, modalDraft)
      if (!result.ok) {
        applyError(result.error)
        return
      }
      setFields(getFields())
      setIsError(false)
      setMessage(t('utility.fields.updated'))
      closeModal()
    }
  }

  const handleDelete = useCallback((field: SportField) => {
    const confirmed = window.confirm(
      t('utility.fields.confirmDelete', {
        title: field.title,
      }),
    )
    if (!confirmed) {
      return
    }

    const result = removeField(field.id)
    if (!result.ok) {
      applyError(result.error)
      return
    }

    if (editingFieldId === field.id) {
      closeModal()
    }

    setFields(getFields())
    setIsError(false)
    setMessage(t('utility.fields.deleted'))
  }, [applyError, editingFieldId, t])

  const columns = useMemo<ColumnDef<SportField>[]>(
    () => [
      {
        id: 'title',
        header: t('utility.fields.titleLabel'),
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        id: 'category',
        header: t('utility.fields.categoryLabel'),
        cell: ({ row }) => <span>{categoryLabelById.get(row.original.categoryId) ?? '-'}</span>,
      },
      {
        id: 'description',
        header: t('utility.fields.descriptionLabel'),
        cell: ({ row }) => <span className="line-clamp-2">{row.original.description}</span>,
      },
      {
        id: 'actions',
        header: () => <div className="text-right">{t('utility.categories.actions')}</div>,
        cell: ({ row }) => {
          const field = row.original
          return (
            <div className="flex justify-end gap-3 pr-1">
              <button
                type="button"
                className="btn btn-ghost btn-sm px-2 text-warning"
                onClick={() => openEditModal(field)}
                aria-label={t('utility.categories.edit')}
              >
                <SquarePen className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm px-2 text-error"
                onClick={() => handleDelete(field)}
                aria-label={t('utility.categories.delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        },
      },
    ],
    [categoryLabelById, handleDelete, openEditModal, t],
  )

  const table = useReactTable({
    data: fields,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{t('utility.fields.title')}</h2>
          <p className="text-sm opacity-70">{t('utility.fields.description')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          {t('utility.fields.create')}
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

          {fields.length === 0 ? (
            <p className="text-sm opacity-70">{t('utility.fields.empty')}</p>
          ) : (
            <DataTable table={table} />
          )}
        </div>
      </div>

      {modalMode && (
        <dialog className="modal modal-open">
          <div className="modal-box space-y-4">
            <h3 className="text-lg font-semibold">
              {modalMode === 'create' ? t('utility.fields.create') : t('utility.categories.saveEdit')}
            </h3>

            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.fields.titleLabel')}</span>
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
              <span className="label-text mb-1 text-xs">{t('utility.fields.categoryLabel')}</span>
              <select
                className="select select-bordered w-full"
                value={modalDraft.categoryId}
                onChange={(event) =>
                  setModalDraft((prev) => ({
                    ...prev,
                    categoryId: event.target.value,
                  }))
                }
              >
                {categories.length === 0 && <option value="">{t('utility.packages.noCategoryOption')}</option>}
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.fields.descriptionLabel')}</span>
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
                {modalMode === 'create' ? t('utility.fields.create') : t('utility.categories.saveEdit')}
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

export default UtilityFieldsPage
