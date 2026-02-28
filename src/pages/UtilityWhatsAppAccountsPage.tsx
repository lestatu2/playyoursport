import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { SquarePen, Trash2 } from 'lucide-react'
import DataTable from '../components/DataTable'
import {
  createWhatsAppAccount,
  getPackageCatalogChangedEventName,
  getWhatsAppAccounts,
  removeWhatsAppAccount,
  updateWhatsAppAccount,
  type SaveWhatsAppAccountPayload,
  type WhatsAppAccount,
  type WhatsAppAvailabilitySlot,
} from '../lib/package-catalog'

const WEEK_DAYS = [
  { value: 1, key: 'utility.whatsappAccounts.weekdayMonday' },
  { value: 2, key: 'utility.whatsappAccounts.weekdayTuesday' },
  { value: 3, key: 'utility.whatsappAccounts.weekdayWednesday' },
  { value: 4, key: 'utility.whatsappAccounts.weekdayThursday' },
  { value: 5, key: 'utility.whatsappAccounts.weekdayFriday' },
  { value: 6, key: 'utility.whatsappAccounts.weekdaySaturday' },
  { value: 0, key: 'utility.whatsappAccounts.weekdaySunday' },
]

function createEmptySlot(): WhatsAppAvailabilitySlot {
  return {
    id: `wa-slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    weekday: 1,
    startTime: '09:00',
    endTime: '18:00',
  }
}

function createInitialDraft(): SaveWhatsAppAccountPayload {
  return {
    title: '',
    phoneNumber: '',
    avatarUrl: '',
    isActive: true,
    alwaysAvailable: true,
    availabilitySlots: [createEmptySlot()],
    offlineMessage: '',
    buttonStyle: {
      label: 'WhatsApp',
      backgroundColor: '#25D366',
      textColor: '#ffffff',
    },
  }
}

function UtilityWhatsAppAccountsPage() {
  const { t } = useTranslation()
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>(() => getWhatsAppAccounts())
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SaveWhatsAppAccountPayload>(() => createInitialDraft())
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const packageCatalogEvent = getPackageCatalogChangedEventName()

  useEffect(() => {
    const handleCatalogChange = () => {
      setAccounts(getWhatsAppAccounts())
    }
    window.addEventListener(packageCatalogEvent, handleCatalogChange)
    return () => window.removeEventListener(packageCatalogEvent, handleCatalogChange)
  }, [packageCatalogEvent])

  const closeModal = () => {
    setModalMode(null)
    setEditingId(null)
  }

  const openCreateModal = () => {
    setDraft(createInitialDraft())
    setEditingId(null)
    setModalMode('create')
  }

  const openEditModal = useCallback((account: WhatsAppAccount) => {
    setDraft({
      title: account.title,
      phoneNumber: account.phoneNumber,
      avatarUrl: account.avatarUrl,
      isActive: account.isActive,
      alwaysAvailable: account.alwaysAvailable,
      availabilitySlots: account.availabilitySlots.length > 0 ? account.availabilitySlots : [createEmptySlot()],
      offlineMessage: account.offlineMessage,
      buttonStyle: account.buttonStyle,
    })
    setEditingId(account.id)
    setModalMode('edit')
  }, [])

  const applyError = useCallback(() => {
    setIsError(true)
    setMessage(t('utility.whatsappAccounts.invalidData'))
  }, [t])

  const handleSubmit = () => {
    const result =
      modalMode === 'create'
        ? createWhatsAppAccount(draft)
        : editingId
          ? updateWhatsAppAccount(editingId, draft)
          : { ok: false as const, error: 'notFound' as const }

    if (!result.ok) {
      applyError()
      return
    }

    setAccounts(getWhatsAppAccounts())
    setIsError(false)
    setMessage(modalMode === 'create' ? t('utility.whatsappAccounts.created') : t('utility.whatsappAccounts.updated'))
    closeModal()
  }

  const handleDelete = useCallback(
    (account: WhatsAppAccount) => {
      const confirmed = window.confirm(t('utility.whatsappAccounts.confirmDelete', { title: account.title }))
      if (!confirmed) {
        return
      }
      const result = removeWhatsAppAccount(account.id)
      if (!result.ok) {
        applyError()
        return
      }
      setAccounts(getWhatsAppAccounts())
      setIsError(false)
      setMessage(t('utility.whatsappAccounts.deleted'))
    },
    [applyError, t],
  )

  const weekdayLabelByValue = useMemo(
    () => new Map(WEEK_DAYS.map((day) => [day.value, t(day.key)])),
    [t],
  )

  const columns = useMemo<ColumnDef<WhatsAppAccount>[]>(
    () => [
      {
        id: 'avatar',
        header: t('utility.whatsappAccounts.avatarLabel'),
        cell: ({ row }) =>
          row.original.avatarUrl ? (
            <img src={row.original.avatarUrl} alt={row.original.title} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="opacity-50">-</span>
          ),
      },
      {
        id: 'title',
        header: t('utility.whatsappAccounts.titleLabel'),
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        id: 'phone',
        header: t('utility.whatsappAccounts.phoneLabel'),
        cell: ({ row }) => <span>{row.original.phoneNumber}</span>,
      },
      {
        id: 'status',
        header: t('utility.whatsappAccounts.activeLabel'),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={row.original.isActive}
            onChange={(event) => {
              const result = updateWhatsAppAccount(row.original.id, {
                title: row.original.title,
                phoneNumber: row.original.phoneNumber,
                avatarUrl: row.original.avatarUrl,
                isActive: event.target.checked,
                alwaysAvailable: row.original.alwaysAvailable,
                availabilitySlots: row.original.availabilitySlots,
                offlineMessage: row.original.offlineMessage,
                buttonStyle: row.original.buttonStyle,
              })
              if (!result.ok) {
                applyError()
                return
              }
              setAccounts(getWhatsAppAccounts())
              setIsError(false)
              setMessage(t('utility.whatsappAccounts.updated'))
            }}
          />
        ),
      },
      {
        id: 'actions',
        header: () => <div className="text-right">{t('utility.categories.actions')}</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm px-2 text-warning" onClick={() => openEditModal(row.original)}>
              <SquarePen className="h-4 w-4" />
            </button>
            <button type="button" className="btn btn-ghost btn-sm px-2 text-error" onClick={() => handleDelete(row.original)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [applyError, handleDelete, openEditModal, t],
  )

  const table = useReactTable({
    data: accounts,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{t('utility.whatsappAccounts.title')}</h2>
          <p className="text-sm opacity-70">{t('utility.whatsappAccounts.description')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          {t('utility.whatsappAccounts.create')}
        </button>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body space-y-4">
          {message && (
            <p className={`rounded-lg px-3 py-2 text-sm ${isError ? 'bg-error/15 text-error' : 'bg-success/15 text-success'}`}>
              {message}
            </p>
          )}
          {accounts.length === 0 ? (
            <p className="text-sm opacity-70">{t('utility.whatsappAccounts.empty')}</p>
          ) : (
            <DataTable table={table} />
          )}
        </div>
      </div>

      {modalMode && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl space-y-4">
            <h3 className="text-lg font-semibold">
              {modalMode === 'create' ? t('utility.whatsappAccounts.create') : t('utility.categories.saveEdit')}
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.whatsappAccounts.titleLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.whatsappAccounts.phoneLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.phoneNumber}
                  onChange={(event) => setDraft((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                  placeholder="+393331234567"
                />
              </label>

              <div className="space-y-2">
                <p className="text-xs">{t('utility.whatsappAccounts.avatarLabel')}</p>
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
                      setDraft((prev) => ({ ...prev, avatarUrl: result }))
                    }
                    reader.readAsDataURL(file)
                  }}
                />
                {draft.avatarUrl && <img src={draft.avatarUrl} alt="avatar" className="h-14 w-14 rounded-full object-cover" />}
              </div>

              <label className="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300 px-3 py-2">
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={draft.isActive}
                  onChange={(event) => setDraft((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                <span className="label-text">{t('utility.whatsappAccounts.activeLabel')}</span>
              </label>
            </div>

            <div className="space-y-3 rounded-lg border border-base-300 p-3">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={draft.alwaysAvailable}
                  onChange={(event) => setDraft((prev) => ({ ...prev, alwaysAvailable: event.target.checked }))}
                />
                <span className="label-text">{t('utility.whatsappAccounts.alwaysAvailableLabel')}</span>
              </label>

              {!draft.alwaysAvailable && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">{t('utility.whatsappAccounts.availabilityLabel')}</p>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          availabilitySlots: [...prev.availabilitySlots, createEmptySlot()],
                        }))
                      }
                    >
                      {t('utility.whatsappAccounts.addSlot')}
                    </button>
                  </div>
                  {draft.availabilitySlots.map((slot) => (
                    <div key={slot.id} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                      <label className="form-control">
                        <span className="label-text mb-1 text-xs">{t('utility.whatsappAccounts.dayLabel')}</span>
                        <select
                          className="select select-bordered w-full"
                          value={slot.weekday}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              availabilitySlots: prev.availabilitySlots.map((item) =>
                                item.id === slot.id ? { ...item, weekday: Number(event.target.value) } : item,
                              ),
                            }))
                          }
                        >
                          {WEEK_DAYS.map((day) => (
                            <option key={day.value} value={day.value}>
                              {weekdayLabelByValue.get(day.value) ?? day.value}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="form-control">
                        <span className="label-text mb-1 text-xs">{t('utility.whatsappAccounts.startTimeLabel')}</span>
                        <input
                          type="time"
                          className="input input-bordered w-full"
                          value={slot.startTime}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              availabilitySlots: prev.availabilitySlots.map((item) =>
                                item.id === slot.id ? { ...item, startTime: event.target.value } : item,
                              ),
                            }))
                          }
                        />
                      </label>
                      <label className="form-control">
                        <span className="label-text mb-1 text-xs">{t('utility.whatsappAccounts.endTimeLabel')}</span>
                        <input
                          type="time"
                          className="input input-bordered w-full"
                          value={slot.endTime}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              availabilitySlots: prev.availabilitySlots.map((item) =>
                                item.id === slot.id ? { ...item, endTime: event.target.value } : item,
                              ),
                            }))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        disabled={draft.availabilitySlots.length <= 1}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            availabilitySlots:
                              prev.availabilitySlots.length > 1
                                ? prev.availabilitySlots.filter((item) => item.id !== slot.id)
                                : prev.availabilitySlots,
                          }))
                        }
                      >
                        {t('utility.whatsappAccounts.removeSlot')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.whatsappAccounts.offlineMessageLabel')}</span>
              <textarea
                className="textarea textarea-bordered min-h-20 w-full"
                value={draft.offlineMessage}
                onChange={(event) => setDraft((prev) => ({ ...prev, offlineMessage: event.target.value }))}
              />
            </label>

            <div className="grid gap-4 rounded-lg border border-base-300 p-3 md:grid-cols-3">
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.whatsappAccounts.buttonLabelField')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.buttonStyle.label}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      buttonStyle: { ...prev.buttonStyle, label: event.target.value },
                    }))
                  }
                />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.whatsappAccounts.buttonBackgroundLabel')}</span>
                <input
                  type="color"
                  className="input input-bordered h-10 w-full p-1"
                  value={draft.buttonStyle.backgroundColor}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      buttonStyle: { ...prev.buttonStyle, backgroundColor: event.target.value },
                    }))
                  }
                />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.whatsappAccounts.buttonTextLabel')}</span>
                <input
                  type="color"
                  className="input input-bordered h-10 w-full p-1"
                  value={draft.buttonStyle.textColor}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      buttonStyle: { ...prev.buttonStyle, textColor: event.target.value },
                    }))
                  }
                />
              </label>
              <div className="md:col-span-3">
                <button
                  type="button"
                  className="btn"
                  style={{
                    backgroundColor: draft.buttonStyle.backgroundColor,
                    color: draft.buttonStyle.textColor,
                  }}
                >
                  {draft.buttonStyle.label || 'WhatsApp'}
                </button>
              </div>
            </div>

            <div className="modal-action gap-3">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                {t('utility.categories.cancelEdit')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                {modalMode === 'create' ? t('utility.whatsappAccounts.create') : t('utility.categories.saveEdit')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeModal} />
        </dialog>
      )}
    </section>
  )
}

export default UtilityWhatsAppAccountsPage
