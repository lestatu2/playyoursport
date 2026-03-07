import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { SquarePen, Trash2 } from 'lucide-react'
import DataTable from '../components/DataTable'
import {
  createGroup,
  getGroups,
  getPackageCatalogChangedEventName,
  removeGroup,
  updateGroup,
  type GroupGender,
  type SaveGroupPayload,
  type UtilityGroup,
} from '../lib/package-catalog'

function UtilityGroupsPage() {
  const { t } = useTranslation()
  const [groups, setGroups] = useState<UtilityGroup[]>(() => getGroups())
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [modalDraft, setModalDraft] = useState<SaveGroupPayload>({
    title: '',
    audience: 'adult',
    gender: 'mixed',
    birthYearMin: 2010,
    birthYearMax: 2010,
  })
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const packageCatalogEvent = getPackageCatalogChangedEventName()

  useEffect(() => {
    const handleCatalogChange = () => {
      setGroups(getGroups())
    }
    window.addEventListener(packageCatalogEvent, handleCatalogChange)
    return () => window.removeEventListener(packageCatalogEvent, handleCatalogChange)
  }, [packageCatalogEvent])

  const closeModal = () => {
    setModalMode(null)
    setEditingGroupId(null)
  }

  const applyError = useCallback(
    (code: 'invalid' | 'fieldNotFound' | 'notFound' | 'groupInUse') => {
      setIsError(true)
    if (code === 'fieldNotFound') {
        setMessage(t('utility.groups.invalidData'))
        return
      }
      if (code === 'groupInUse') {
        setMessage(t('utility.groups.groupInUse'))
        return
      }
      setMessage(t('utility.groups.invalidData'))
    },
    [t],
  )

  const openCreateModal = () => {
    setModalDraft({
      title: '',
      audience: 'adult',
      gender: 'mixed',
      birthYearMin: 2010,
      birthYearMax: 2010,
    })
    setEditingGroupId(null)
    setModalMode('create')
  }

  const openEditModal = useCallback((item: UtilityGroup) => {
    setModalDraft({
      title: item.title,
      audience: item.audience,
      gender: item.gender,
      birthYearMin: item.birthYearMin,
      birthYearMax: item.birthYearMax,
    })
    setEditingGroupId(item.id)
    setModalMode('edit')
  }, [])

  const handleSubmit = () => {
    if (modalMode === 'create') {
      const result = createGroup(modalDraft)
      if (!result.ok) {
        applyError(result.error)
        return
      }
      setGroups(getGroups())
      setIsError(false)
      setMessage(t('utility.groups.created'))
      closeModal()
      return
    }
    if (modalMode === 'edit' && editingGroupId) {
      const result = updateGroup(editingGroupId, modalDraft)
      if (!result.ok) {
        applyError(result.error)
        return
      }
      setGroups(getGroups())
      setIsError(false)
      setMessage(t('utility.groups.updated'))
      closeModal()
    }
  }

  const handleDelete = useCallback(
    (item: UtilityGroup) => {
      const confirmed = window.confirm(t('utility.groups.confirmDelete', { title: item.title }))
      if (!confirmed) {
        return
      }
      const result = removeGroup(item.id)
      if (!result.ok) {
        applyError(result.error)
        return
      }
      setGroups(getGroups())
      setIsError(false)
      setMessage(t('utility.groups.deleted'))
    },
    [applyError, t],
  )

  const genderLabel = useCallback((value: GroupGender) => {
    if (value === 'male') {
      return t('utility.groups.genderMale')
    }
    if (value === 'female') {
      return t('utility.groups.genderFemale')
    }
    return t('utility.groups.genderMixed')
  }, [t])

  const columns = useMemo<ColumnDef<UtilityGroup>[]>(
    () => [
      {
        id: 'title',
        header: t('utility.groups.titleLabel'),
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        id: 'audience',
        header: t('utility.groups.audienceLabel'),
        cell: ({ row }) =>
          row.original.audience === 'adult'
            ? t('utility.packages.audienceAdult')
            : t('utility.packages.audienceYouth'),
      },
      {
        id: 'gender',
        header: t('utility.groups.genderLabel'),
        cell: ({ row }) => genderLabel(row.original.gender),
      },
      {
        id: 'yearRange',
        header: t('utility.groups.yearRangeLabel'),
        cell: ({ row }) =>
          row.original.birthYearMin === row.original.birthYearMax
            ? row.original.birthYearMin
            : `${row.original.birthYearMin} - ${row.original.birthYearMax}`,
      },
      {
        id: 'actions',
        header: () => <div className="text-right">{t('utility.categories.actions')}</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm px-1 text-warning"
              onClick={() => openEditModal(row.original)}
              aria-label={t('utility.categories.edit')}
            >
              <SquarePen className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm px-1 text-error"
              onClick={() => handleDelete(row.original)}
              aria-label={t('utility.categories.delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [genderLabel, handleDelete, openEditModal, t],
  )

  const table = useReactTable({
    data: groups,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{t('utility.groups.title')}</h2>
          <p className="text-sm opacity-70">{t('utility.groups.description')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          {t('utility.groups.create')}
        </button>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body space-y-4">
          {message && (
            <p className={`rounded-lg px-3 py-2 text-sm ${isError ? 'bg-error/15 text-error' : 'bg-success/15 text-success'}`}>
              {message}
            </p>
          )}

          {groups.length === 0 ? <p className="text-sm opacity-70">{t('utility.groups.empty')}</p> : <DataTable table={table} />}
        </div>
      </div>

      {modalMode && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-2xl space-y-4">
            <h3 className="text-lg font-semibold">
              {modalMode === 'create' ? t('utility.groups.create') : t('utility.categories.saveEdit')}
            </h3>

            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.groups.titleLabel')}</span>
              <input
                className="input input-bordered w-full"
                value={modalDraft.title}
                onChange={(event) => setModalDraft((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>

            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.groups.audienceLabel')}</span>
              <select
                className="select select-bordered w-full"
                value={modalDraft.audience}
                onChange={(event) =>
                  setModalDraft((prev) => ({
                    ...prev,
                    audience: event.target.value === 'youth' ? 'youth' : 'adult',
                  }))
                }
              >
                <option value="adult">{t('utility.packages.audienceAdult')}</option>
                <option value="youth">{t('utility.packages.audienceYouth')}</option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('utility.groups.genderLabel')}</span>
              <select
                className="select select-bordered w-full"
                value={modalDraft.gender}
                onChange={(event) =>
                  setModalDraft((prev) => ({
                    ...prev,
                    gender:
                      event.target.value === 'female'
                        ? 'female'
                        : event.target.value === 'mixed'
                          ? 'mixed'
                          : 'male',
                  }))
                }
              >
                <option value="male">{t('utility.groups.genderMale')}</option>
                <option value="female">{t('utility.groups.genderFemale')}</option>
                <option value="mixed">{t('utility.groups.genderMixed')}</option>
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.groups.yearMinLabel')}</span>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  value={modalDraft.birthYearMin}
                  onChange={(event) =>
                    setModalDraft((prev) => ({ ...prev, birthYearMin: Math.trunc(event.target.valueAsNumber || 1900) }))
                  }
                />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.groups.yearMaxLabel')}</span>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  value={modalDraft.birthYearMax}
                  onChange={(event) =>
                    setModalDraft((prev) => ({ ...prev, birthYearMax: Math.trunc(event.target.valueAsNumber || 1900) }))
                  }
                />
              </label>
            </div>

            <div className="modal-action gap-3">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                {t('utility.categories.cancelEdit')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                {modalMode === 'create' ? t('utility.groups.create') : t('utility.categories.saveEdit')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeModal} />
        </dialog>
      )}
    </section>
  )
}

export default UtilityGroupsPage
