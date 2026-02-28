import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { SquarePen, Trash2 } from 'lucide-react'
import DataTable from '../components/DataTable'
import {
  createAdditionalService,
  getAdditionalServices,
  getPackageCatalogChangedEventName,
  removeAdditionalService,
  updateAdditionalService,
  type AdditionalService,
  type SaveAdditionalServicePayload,
} from '../lib/package-catalog'

function UtilityAdditionalServicesPage() {
  const { t } = useTranslation()
  const [services, setServices] = useState<AdditionalService[]>(() => getAdditionalServices())
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [modalDraft, setModalDraft] = useState<SaveAdditionalServicePayload>({
    title: '',
    type: 'fixed',
    price: 0,
    isActive: true,
    description: '',
  })
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const packageCatalogEvent = getPackageCatalogChangedEventName()

  useEffect(() => {
    const handleCatalogChange = () => {
      setServices(getAdditionalServices())
    }
    window.addEventListener(packageCatalogEvent, handleCatalogChange)
    return () => window.removeEventListener(packageCatalogEvent, handleCatalogChange)
  }, [packageCatalogEvent])

  const applyError = useCallback(() => {
    setIsError(true)
    setMessage(t('utility.additionalServices.invalidData'))
  }, [t])

  const closeModal = () => {
    setModalMode(null)
    setEditingServiceId(null)
  }

  const openCreateModal = () => {
    setModalDraft({ title: '', type: 'fixed', price: 0, isActive: true, description: '' })
    setEditingServiceId(null)
    setModalMode('create')
  }

  const openEditModal = useCallback((service: AdditionalService) => {
    setModalDraft({
      title: service.title,
      type: service.type,
      price: service.price,
      isActive: service.isActive,
      description: service.description,
    })
    setEditingServiceId(service.id)
    setModalMode('edit')
  }, [])

  const handleModalSubmit = () => {
    if (modalMode === 'create') {
      const result = createAdditionalService(modalDraft)
      if (!result.ok) {
        applyError()
        return
      }
      setServices(getAdditionalServices())
      setIsError(false)
      setMessage(t('utility.additionalServices.created'))
      closeModal()
      return
    }

    if (modalMode === 'edit' && editingServiceId) {
      const result = updateAdditionalService(editingServiceId, modalDraft)
      if (!result.ok) {
        applyError()
        return
      }
      setServices(getAdditionalServices())
      setIsError(false)
      setMessage(t('utility.additionalServices.updated'))
      closeModal()
    }
  }

  const handleDelete = useCallback(
    (service: AdditionalService) => {
      const confirmed = window.confirm(
        t('utility.additionalServices.confirmDelete', {
          title: service.title,
        }),
      )
      if (!confirmed) {
        return
      }

      const result = removeAdditionalService(service.id)
      if (!result.ok) {
        applyError()
        return
      }

      if (editingServiceId === service.id) {
        closeModal()
      }

      setServices(getAdditionalServices())
      setIsError(false)
      setMessage(t('utility.additionalServices.deleted'))
    },
    [applyError, editingServiceId, t],
  )

  const columns = useMemo<ColumnDef<AdditionalService>[]>(
    () => [
      {
        id: 'title',
        header: t('utility.additionalServices.titleLabel'),
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        id: 'type',
        header: t('utility.additionalServices.typeLabel'),
        cell: ({ row }) =>
          row.original.type === 'fixed' ? t('utility.additionalServices.typeFixed') : t('utility.additionalServices.typeVariable'),
      },
      {
        id: 'active',
        header: t('utility.additionalServices.activeLabel'),
        cell: ({ row }) => {
          const service = row.original
          return (
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={service.isActive}
              onChange={(event) => {
                const result = updateAdditionalService(service.id, {
                  title: service.title,
                  type: service.type,
                  price: service.price,
                  isActive: event.target.checked,
                  description: service.description,
                })
                if (!result.ok) {
                  applyError()
                  return
                }
                setServices(getAdditionalServices())
                setIsError(false)
                setMessage(t('utility.additionalServices.updated'))
              }}
              aria-label={t('utility.additionalServices.activeLabel')}
            />
          )
        },
      },
      {
        id: 'price',
        header: t('utility.additionalServices.priceLabel'),
        cell: ({ row }) => <span>{row.original.type === 'fixed' ? row.original.price ?? 0 : '-'}</span>,
      },
      {
        id: 'description',
        header: t('utility.additionalServices.descriptionLabel'),
        cell: ({ row }) => <span className="line-clamp-2">{row.original.description}</span>,
      },
      {
        id: 'actions',
        header: () => <div className="text-right">{t('utility.categories.actions')}</div>,
        cell: ({ row }) => {
          const service = row.original
          return (
            <div className="flex justify-end gap-3 pr-1">
              <button
                type="button"
                className="btn btn-ghost btn-sm px-2 text-warning"
                onClick={() => openEditModal(service)}
                aria-label={t('utility.categories.edit')}
              >
                <SquarePen className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm px-2 text-error"
                onClick={() => handleDelete(service)}
                aria-label={t('utility.categories.delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        },
      },
    ],
    [applyError, handleDelete, openEditModal, t],
  )

  const table = useReactTable({
    data: services,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{t('utility.additionalServices.title')}</h2>
          <p className="text-sm opacity-70">{t('utility.additionalServices.description')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          {t('utility.additionalServices.create')}
        </button>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body space-y-4">
          {message && (
            <p className={`rounded-lg px-3 py-2 text-sm ${isError ? 'bg-error/15 text-error' : 'bg-success/15 text-success'}`}>
              {message}
            </p>
          )}

          {services.length === 0 ? <p className="text-sm opacity-70">{t('utility.additionalServices.empty')}</p> : <DataTable table={table} />}
        </div>
      </div>

      {modalMode && (
        <dialog className="modal modal-open">
          <div className="modal-box space-y-4">
            <h3 className="text-lg font-semibold">
              {modalMode === 'create' ? t('utility.additionalServices.create') : t('utility.categories.saveEdit')}
            </h3>

            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.additionalServices.titleLabel')}</span>
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
              <span className="label-text mb-1 text-xs">{t('utility.additionalServices.typeLabel')}</span>
              <select
                className="select select-bordered w-full"
                value={modalDraft.type}
                onChange={(event) =>
                  setModalDraft((prev) => ({
                    ...prev,
                    type: event.target.value === 'variable' ? 'variable' : 'fixed',
                    price: event.target.value === 'variable' ? null : (prev.price ?? 0),
                  }))
                }
              >
                <option value="fixed">{t('utility.additionalServices.typeFixed')}</option>
                <option value="variable">{t('utility.additionalServices.typeVariable')}</option>
              </select>
            </label>

            {modalDraft.type === 'fixed' && (
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.additionalServices.priceLabel')}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input input-bordered w-full"
                  value={modalDraft.price ?? 0}
                  onChange={(event) =>
                    setModalDraft((prev) => ({
                      ...prev,
                      price: Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : 0,
                    }))
                  }
                />
              </label>
            )}

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
              <span className="label-text">{t('utility.additionalServices.activeLabel')}</span>
            </label>

            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.additionalServices.descriptionLabel')}</span>
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
                {modalMode === 'create' ? t('utility.additionalServices.create') : t('utility.categories.saveEdit')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeModal} aria-label={t('utility.categories.cancelEdit')} />
        </dialog>
      )}
    </section>
  )
}

export default UtilityAdditionalServicesPage
