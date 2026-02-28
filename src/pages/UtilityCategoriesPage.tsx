import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { SquarePen, Trash2 } from 'lucide-react'
import DataTable from '../components/DataTable'
import {
  createSportCategory,
  getPackageCatalogChangedEventName,
  getSportCategories,
  removeSportCategory,
  updateSportCategory,
  type PackageCategory,
  type SaveCategoryPayload,
} from '../lib/package-catalog'

function UtilityCategoriesPage() {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<PackageCategory[]>(() => getSportCategories())
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [modalDraft, setModalDraft] = useState<SaveCategoryPayload>({
    code: '',
    label: '',
    icon: '',
    isActive: true,
  })
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const packageCatalogEvent = getPackageCatalogChangedEventName()

  useEffect(() => {
    const handleCatalogChange = () => {
      setCategories(getSportCategories())
    }
    window.addEventListener(packageCatalogEvent, handleCatalogChange)
    return () => window.removeEventListener(packageCatalogEvent, handleCatalogChange)
  }, [packageCatalogEvent])

  const applyError = useCallback((code: 'invalid' | 'duplicateCode' | 'notFound' | 'categoryInUse') => {
    setIsError(true)
    if (code === 'duplicateCode') {
      setMessage(t('utility.categories.duplicateCode'))
      return
    }
    if (code === 'categoryInUse') {
      setMessage(t('utility.categories.categoryInUse'))
      return
    }
    setMessage(t('utility.categories.invalidData'))
  }, [t])

  const closeModal = () => {
    setModalMode(null)
    setEditingCategoryId(null)
  }

  const openCreateModal = () => {
    setModalDraft({ code: '', label: '', icon: '', isActive: true })
    setEditingCategoryId(null)
    setModalMode('create')
  }

  const openEditModal = useCallback((category: PackageCategory) => {
    setModalDraft({
      code: category.code,
      label: category.label,
      icon: category.icon,
      isActive: category.isActive,
    })
    setEditingCategoryId(category.id)
    setModalMode('edit')
  }, [])

  const handleModalSubmit = () => {
    if (modalMode === 'create') {
      const result = createSportCategory(modalDraft)
      if (!result.ok) {
        applyError(result.error)
        return
      }
      setCategories(getSportCategories())
      setIsError(false)
      setMessage(t('utility.categories.created'))
      closeModal()
      return
    }

    if (modalMode === 'edit' && editingCategoryId) {
      const result = updateSportCategory(editingCategoryId, modalDraft)
      if (!result.ok) {
        applyError(result.error)
        return
      }
      setCategories(getSportCategories())
      setIsError(false)
      setMessage(t('utility.categories.updated'))
      closeModal()
    }
  }

  const handleDelete = useCallback((category: PackageCategory) => {
    const confirmed = window.confirm(
      t('utility.categories.confirmDelete', {
        label: category.label,
      }),
    )
    if (!confirmed) {
      return
    }

    const result = removeSportCategory(category.id)
    if (!result.ok) {
      applyError(result.error)
      return
    }

    if (editingCategoryId === category.id) {
      closeModal()
    }

    setCategories(getSportCategories())
    setIsError(false)
    setMessage(t('utility.categories.deleted'))
  }, [applyError, editingCategoryId, t])

  const handleStatusChange = useCallback((category: PackageCategory, isActive: boolean) => {
    const result = updateSportCategory(category.id, {
      code: category.code,
      label: category.label,
      icon: category.icon,
      isActive,
    })
    if (!result.ok) {
      applyError(result.error)
      return
    }
    setCategories(getSportCategories())
    setIsError(false)
    setMessage(t('utility.categories.updated'))
  }, [applyError, t])

  const columns = useMemo<ColumnDef<PackageCategory>[]>(
    () => [
      {
        id: 'icon',
        header: t('utility.categories.iconLabel'),
        cell: ({ row }) =>
          row.original.icon ? (
            <img src={row.original.icon} alt={row.original.label} className="h-8 w-8 rounded object-cover" />
          ) : (
            <span className="opacity-50">-</span>
          ),
      },
      {
        id: 'name',
        header: t('utility.categories.label'),
        cell: ({ row }) => <span className="font-medium">{row.original.label}</span>,
      },
      {
        id: 'status',
        header: t('utility.categories.active'),
        cell: ({ row }) => {
          const category = row.original
          return (
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={category.isActive}
              onChange={(event) => handleStatusChange(category, event.target.checked)}
              aria-label={t('utility.categories.active')}
            />
          )
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-right">{t('utility.categories.actions')}</div>,
        cell: ({ row }) => {
          const category = row.original
          return (
            <div className="flex justify-end gap-3 pr-1">
              <button
                type="button"
                className="btn btn-ghost btn-sm px-2 text-warning"
                onClick={() => openEditModal(category)}
                aria-label={t('utility.categories.edit')}
              >
                <SquarePen className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm px-2 text-error"
                onClick={() => handleDelete(category)}
                aria-label={t('utility.categories.delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        },
      },
    ],
    [handleDelete, handleStatusChange, openEditModal, t],
  )

  const table = useReactTable({
    data: categories,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{t('utility.categories.title')}</h2>
          <p className="text-sm opacity-70">{t('utility.categories.description')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          {t('utility.categories.create')}
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

          {categories.length === 0 ? (
            <p className="text-sm opacity-70">{t('utility.categories.empty')}</p>
          ) : (
            <DataTable table={table} />
          )}
        </div>
      </div>

      {modalMode && (
        <dialog className="modal modal-open">
          <div className="modal-box space-y-4">
            <h3 className="text-lg font-semibold">
              {modalMode === 'create' ? t('utility.categories.create') : t('utility.categories.saveEdit')}
            </h3>

            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.categories.code')}</span>
              <input
                className="input input-bordered w-full"
                value={modalDraft.code}
                onChange={(event) =>
                  setModalDraft((prev) => ({
                    ...prev,
                    code: event.target.value,
                  }))
                }
                placeholder="football"
              />
            </label>

            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.categories.label')}</span>
              <input
                className="input input-bordered w-full"
                value={modalDraft.label}
                onChange={(event) =>
                  setModalDraft((prev) => ({
                    ...prev,
                    label: event.target.value,
                  }))
                }
                placeholder="Calcio"
              />
            </label>

            <div className="space-y-2">
              <p className="text-xs">{t('utility.categories.iconLabel')}</p>
              <input
                type="file"
                className="file-input file-input-bordered w-full"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file || !file.type.startsWith('image/')) {
                    return
                  }
                  const reader = new FileReader()
                  reader.onload = () => {
                    const result = typeof reader.result === 'string' ? reader.result : ''
                    if (!result) {
                      return
                    }
                    setModalDraft((prev) => ({
                      ...prev,
                      icon: result,
                    }))
                  }
                  reader.readAsDataURL(file)
                }}
              />
              {modalDraft.icon && (
                <div className="rounded-lg border border-base-300 p-2">
                  <img src={modalDraft.icon} alt={modalDraft.label || 'icon'} className="h-16 w-16 rounded object-cover" />
                </div>
              )}
            </div>

            <label className="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300 px-3 py-2">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={modalDraft.isActive}
                onChange={(event) =>
                  setModalDraft((prev) => ({
                    ...prev,
                    isActive: event.target.checked,
                  }))
                }
              />
              <span className="label-text">{t('utility.categories.active')}</span>
            </label>

            <div className="modal-action gap-3">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                {t('utility.categories.cancelEdit')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleModalSubmit}>
                {modalMode === 'create' ? t('utility.categories.create') : t('utility.categories.saveEdit')}
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

export default UtilityCategoriesPage
