import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { MessageCircle, SquarePen, Trash2 } from 'lucide-react'
import DataTable from '../components/DataTable'
import {
  createOpenDay,
  createOpenDayEdition,
  getOpenDayCatalogChangedEventName,
  getOpenDayEditions,
  getOpenDayGroups,
  getOpenDayProducts,
  getOpenDaySessions,
  removeOpenDay,
  updateOpenDay,
  type OpenDayAudience,
  type OpenDayEdition,
  type OpenDayGroup,
  type OpenDayGroupGender,
  type OpenDayProduct,
  type OpenDaySession,
  type OpenDayStatus,
  type SaveOpenDayGroupPayload,
  type SaveOpenDayPayload,
  type SaveOpenDaySessionPayload,
} from '../lib/open-day-catalog'
import {
  getFields,
  getPackageCatalogChangedEventName,
  getSportCategories,
  getWhatsAppAccounts,
  type WhatsAppAccount,
} from '../lib/package-catalog'

type OpenDayRow = {
  productId: string
  name: string
  categoryLabel: string
  audience: OpenDayAudience
  ageRange: string
  editionsCount: number
  latestEditionId: string
  latestEditionYear: number
  latestDurationLabel: string
  latestStatus: OpenDayStatus
}

type OpenDayEditionRow = {
  productId: string
  editionId: string
  code: string
  name: string
  categoryLabel: string
  audience: OpenDayAudience
  ageRange: string
  editionYear: number
  durationLabel: string
  status: OpenDayStatus
}

const CURRENT_YEAR = new Date().getFullYear()

const EMPTY_DRAFT: SaveOpenDayPayload = {
  code: '',
  name: '',
  categoryId: '',
  audience: 'youth',
  description: '',
  disclaimer: '',
  ageMin: 5,
  ageMax: 18,
  productStatus: 'draft',
  editionYear: CURRENT_YEAR,
  editionStatus: 'draft',
  whatsappAccountIds: [],
  whatsappGroupLink: '',
  durationType: 'single-event',
  eventDate: '',
  periodStartDate: '',
  periodEndDate: '',
  groups: [],
}

function createOpenDaySessionDraft(): SaveOpenDaySessionPayload {
  return {
    id: `open-day-session-draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    date: '',
    startTime: '17:00',
    endTime: '18:00',
    capacity: null,
    isActive: true,
  }
}

function createOpenDayGroupDraft(): SaveOpenDayGroupPayload {
  return {
    id: `open-day-group-draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    gender: 'mixed',
    birthYearMin: CURRENT_YEAR - 10,
    birthYearMax: CURRENT_YEAR - 10,
    fieldId: '',
    capacity: null,
    isActive: true,
    sessions: [createOpenDaySessionDraft()],
  }
}

function OpenDayPage() {
  const { t } = useTranslation()
  const [products, setProducts] = useState<OpenDayProduct[]>(() => getOpenDayProducts())
  const [editions, setEditions] = useState<OpenDayEdition[]>(() => getOpenDayEditions())
  const [storedGroups, setStoredGroups] = useState<OpenDayGroup[]>(() => getOpenDayGroups())
  const [storedSessions, setStoredSessions] = useState<OpenDaySession[]>(() => getOpenDaySessions())
  const [categories, setCategories] = useState(() => getSportCategories().filter((item) => item.isActive))
  const [allFields, setAllFields] = useState(() => getFields())
  const [whatsappAccounts, setWhatsAppAccounts] = useState<WhatsAppAccount[]>(() => getWhatsAppAccounts())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'create-edition' | 'edit'>('create')
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editingEditionId, setEditingEditionId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SaveOpenDayPayload>(() => ({
    ...EMPTY_DRAFT,
    categoryId: getSportCategories().filter((item) => item.isActive)[0]?.id ?? '',
  }))
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [activeTab, setActiveTab] = useState<'general-info' | 'duration' | 'groups' | 'whatsapp'>('general-info')
  const [isEditionsModalOpen, setIsEditionsModalOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'edit'>('create')
  const [editingGroupIndex, setEditingGroupIndex] = useState<number | null>(null)
  const [groupDraft, setGroupDraft] = useState<SaveOpenDayGroupPayload>(() => createOpenDayGroupDraft())

  useEffect(() => {
    const eventName = getOpenDayCatalogChangedEventName()
    const packageCatalogEvent = getPackageCatalogChangedEventName()
    const handleChange = () => {
      const nextWhatsAppAccounts = getWhatsAppAccounts()
      setProducts(getOpenDayProducts())
      setEditions(getOpenDayEditions())
      setStoredGroups(getOpenDayGroups())
      setStoredSessions(getOpenDaySessions())
      setCategories(getSportCategories().filter((item) => item.isActive))
      setAllFields(getFields())
      setWhatsAppAccounts(nextWhatsAppAccounts)
      setDraft((prev) => ({
        ...prev,
        whatsappAccountIds: prev.whatsappAccountIds.filter((id) => nextWhatsAppAccounts.some((account) => account.id === id)),
      }))
    }
    window.addEventListener(eventName, handleChange)
    window.addEventListener(packageCatalogEvent, handleChange)
    return () => {
      window.removeEventListener(eventName, handleChange)
      window.removeEventListener(packageCatalogEvent, handleChange)
    }
  }, [])

  const editionRows = useMemo<OpenDayEditionRow[]>(() => {
    const categoryLabelById = new Map(categories.map((item) => [item.id, item.label]))
    return editions
      .map((edition) => {
        const product = products.find((item) => item.id === edition.productId) ?? null
        if (!product) {
          return null
        }
        const durationLabel =
          edition.durationType === 'single-event'
            ? edition.eventDate || '-'
            : `${edition.periodStartDate || '-'} - ${edition.periodEndDate || '-'}`
        return {
          productId: product.id,
          editionId: edition.id,
          code: product.code,
          name: product.name,
          categoryLabel: categoryLabelById.get(product.categoryId) ?? product.categoryId,
          audience: product.audience,
          ageRange: `${product.ageMin}-${product.ageMax}`,
          editionYear: edition.editionYear,
          durationLabel,
          status: edition.status,
        }
      })
      .filter((item): item is OpenDayEditionRow => Boolean(item))
  }, [categories, editions, products])

  const rows = useMemo<OpenDayRow[]>(() => {
    const grouped = new Map<string, OpenDayEditionRow[]>()
    editionRows.forEach((row) => {
      const current = grouped.get(row.productId) ?? []
      grouped.set(row.productId, [...current, row])
    })
    return Array.from(grouped.values()).map((items) => {
      const sorted = [...items].sort((left, right) => right.editionYear - left.editionYear)
      const latest = sorted[0]
      return {
        productId: latest.productId,
        name: latest.name,
        categoryLabel: latest.categoryLabel,
        audience: latest.audience,
        ageRange: latest.ageRange,
        editionsCount: sorted.length,
        latestEditionId: latest.editionId,
        latestEditionYear: latest.editionYear,
        latestDurationLabel: latest.durationLabel,
        latestStatus: latest.status,
      }
    })
  }, [editionRows])

  const selectedProductEditions = useMemo(
    () =>
      selectedProductId
        ? editionRows.filter((item) => item.productId === selectedProductId).sort((left, right) => right.editionYear - left.editionYear)
        : [],
    [editionRows, selectedProductId],
  )

  const categoryFields = useMemo(
    () => allFields.filter((item) => item.categoryId === draft.categoryId),
    [allFields, draft.categoryId],
  )

  const fieldTitleById = useMemo(() => new Map(allFields.map((field) => [field.id, field.title])), [allFields])

  const selectedCategoryLabel = useMemo(
    () => categories.find((item) => item.id === draft.categoryId)?.label ?? '-',
    [categories, draft.categoryId],
  )

  const openCreateModal = () => {
    setModalMode('create')
    setEditingProductId(null)
    setEditingEditionId(null)
    setActiveTab('general-info')
    setDraft({
      ...EMPTY_DRAFT,
      categoryId: categories[0]?.id ?? '',
      groups: [],
    })
    setMessage('')
    setIsError(false)
    setIsGroupModalOpen(false)
    setEditingGroupIndex(null)
    setIsModalOpen(true)
  }

  const openCreateEditionFromProduct = (productId: string) => {
    const source = editionRows
      .filter((item) => item.productId === productId)
      .sort((left, right) => right.editionYear - left.editionYear)[0]
    if (!source) {
      return
    }
    const product = products.find((item) => item.id === productId) ?? null
    const edition = editions.find((item) => item.id === source.editionId) ?? null
    if (!product || !edition) {
      return
    }
    const editionGroups = storedGroups.filter((item) => item.openDayEditionId === edition.id)
    const editionSessions = storedSessions.filter((item) => editionGroups.some((group) => group.id === item.groupId))
    setModalMode('create-edition')
    setEditingProductId(product.id)
    setEditingEditionId(null)
    setDraft({
      code: product.code,
      name: product.name,
      categoryId: product.categoryId,
      audience: product.audience,
      description: product.description,
      disclaimer: product.disclaimer,
      ageMin: product.ageMin,
      ageMax: product.ageMax,
      productStatus: product.status,
      editionYear: Math.max(CURRENT_YEAR, edition.editionYear + 1),
      editionStatus: 'draft',
      whatsappAccountIds: [...edition.whatsappAccountIds],
      whatsappGroupLink: edition.whatsappGroupLink,
      durationType: edition.durationType,
      eventDate: edition.eventDate,
      periodStartDate: edition.periodStartDate,
      periodEndDate: edition.periodEndDate,
      groups: editionGroups.map((group) => ({
        id: '',
        title: group.title,
        gender: group.gender,
        birthYearMin: group.birthYearMin,
        birthYearMax: group.birthYearMax,
        fieldId: group.fieldId,
        capacity: group.capacity,
        isActive: group.isActive,
        sessions: editionSessions
          .filter((session) => session.groupId === group.id)
          .map((session) => ({
            id: '',
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            capacity: session.capacity,
            isActive: session.isActive,
          })),
      })),
    })
    setMessage('')
    setIsError(false)
    setActiveTab('general-info')
    setIsModalOpen(true)
  }

  const openEditionsModal = (productId: string) => {
    setSelectedProductId(productId)
    setIsEditionsModalOpen(true)
  }

  const closeEditionsModal = () => {
    setSelectedProductId(null)
    setIsEditionsModalOpen(false)
  }

  const openEditModal = (productId: string, editionId: string) => {
    const product = products.find((item) => item.id === productId) ?? null
    const edition = editions.find((item) => item.id === editionId) ?? null
    if (!product || !edition) {
      return
    }
    const editionGroups = storedGroups.filter((item) => item.openDayEditionId === edition.id)
    const editionSessions = storedSessions.filter((item) => editionGroups.some((group) => group.id === item.groupId))
    setModalMode('edit')
    setEditingProductId(product.id)
    setEditingEditionId(edition.id)
    setDraft({
      code: product.code,
      name: product.name,
      categoryId: product.categoryId,
      audience: product.audience,
      description: product.description,
      disclaimer: product.disclaimer,
      ageMin: product.ageMin,
      ageMax: product.ageMax,
      productStatus: product.status,
      editionYear: edition.editionYear,
      editionStatus: edition.status,
      whatsappAccountIds: [...edition.whatsappAccountIds],
      whatsappGroupLink: edition.whatsappGroupLink,
      durationType: edition.durationType,
      eventDate: edition.eventDate,
      periodStartDate: edition.periodStartDate,
      periodEndDate: edition.periodEndDate,
      groups: editionGroups.map((group) => ({
        id: group.id,
        title: group.title,
        gender: group.gender,
        birthYearMin: group.birthYearMin,
        birthYearMax: group.birthYearMax,
        fieldId: group.fieldId,
        capacity: group.capacity,
        isActive: group.isActive,
        sessions: editionSessions
          .filter((session) => session.groupId === group.id)
          .map((session) => ({
            id: session.id,
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            capacity: session.capacity,
            isActive: session.isActive,
          })),
      })),
    })
    setMessage('')
    setIsError(false)
    setActiveTab('general-info')
    setIsGroupModalOpen(false)
    setEditingGroupIndex(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingProductId(null)
    setEditingEditionId(null)
    setActiveTab('general-info')
    setMessage('')
    setIsError(false)
    setIsGroupModalOpen(false)
    setEditingGroupIndex(null)
  }

  const closeGroupModal = () => {
    setIsGroupModalOpen(false)
    setEditingGroupIndex(null)
  }

  const openCreateGroupModal = () => {
    setGroupDraft({
      ...createOpenDayGroupDraft(),
      fieldId: categoryFields[0]?.id ?? '',
      birthYearMin: CURRENT_YEAR - Math.max(1, draft.ageMax),
      birthYearMax: CURRENT_YEAR - Math.max(0, draft.ageMin),
    })
    setGroupModalMode('create')
    setEditingGroupIndex(null)
    setIsGroupModalOpen(true)
  }

  const openEditGroupModal = (index: number) => {
    const current = draft.groups[index]
    if (!current) {
      return
    }
    setGroupDraft({
      ...current,
      sessions: current.sessions.length > 0 ? current.sessions : [createOpenDaySessionDraft()],
    })
    setGroupModalMode('edit')
    setEditingGroupIndex(index)
    setIsGroupModalOpen(true)
  }

  const saveGroupModal = () => {
    if (!groupDraft.title.trim()) {
      setIsError(true)
      setMessage('Inserisci il titolo del gruppo.')
      return
    }
    if (!groupDraft.fieldId.trim()) {
      setIsError(true)
      setMessage('Seleziona un campo.')
      return
    }
    if (groupDraft.birthYearMax < groupDraft.birthYearMin) {
      setIsError(true)
      setMessage('L anno nascita massimo non puo essere inferiore al minimo.')
      return
    }
    if (
      groupDraft.sessions.length === 0 ||
      groupDraft.sessions.some((session) => !session.date || !session.startTime || !session.endTime)
    ) {
      setIsError(true)
      setMessage('Completa tutte le sessioni del gruppo.')
      return
    }

    const normalizedGroup: SaveOpenDayGroupPayload = {
      ...groupDraft,
      title: groupDraft.title.trim(),
      sessions: groupDraft.sessions.map((session) => ({
        ...session,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
      })),
    }

    setDraft((prev) => {
      if (groupModalMode === 'edit' && editingGroupIndex !== null) {
        return {
          ...prev,
          groups: prev.groups.map((group, index) => (index === editingGroupIndex ? normalizedGroup : group)),
        }
      }
      return {
        ...prev,
        groups: [...prev.groups, normalizedGroup],
      }
    })
    setIsError(false)
    setMessage('')
    closeGroupModal()
  }

  const removeGroup = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      groups: prev.groups.filter((_, groupIndex) => groupIndex !== index),
    }))
  }

  const handleSubmit = () => {
    const result =
      modalMode === 'create'
        ? createOpenDay(draft)
        : modalMode === 'create-edition' && editingProductId
          ? createOpenDayEdition(editingProductId, draft)
        : editingProductId && editingEditionId
          ? updateOpenDay(editingProductId, editingEditionId, draft)
          : { ok: false as const, error: 'productNotFound' as const }
    if (!result.ok) {
      setIsError(true)
      if (result.error === 'duplicateCode') {
        setMessage('Codice open day gia esistente.')
        return
      }
      if (result.error === 'duplicateEditionYear') {
        setMessage('Esiste gia un edizione con questo anno per il prodotto selezionato.')
        return
      }
      if (result.error === 'invalidWhatsAppAccounts') {
        setMessage('Gli account WhatsApp selezionati non sono validi.')
        return
      }
      setMessage('Dati open day non validi.')
      return
    }
    setIsError(false)
    setMessage(modalMode === 'create' ? 'Open day creato correttamente.' : 'Open day aggiornato correttamente.')
    setTimeout(() => closeModal(), 250)
  }

  const handleDeleteEdition = (row: OpenDayEditionRow) => {
    const confirmed = window.confirm(`Eliminare l'open day "${row.name}" edizione ${row.editionYear}?`)
    if (!confirmed) {
      return
    }
    removeOpenDay(row.productId, row.editionId)
  }

  const openOpenDayWhatsAppGroup = (editionId: string) => {
    const edition = editions.find((item) => item.id === editionId) ?? null
    if (!edition) {
      return
    }
    const rawLink = edition.whatsappGroupLink.trim()
    if (!rawLink) {
      setIsError(true)
      setMessage('Nessun gruppo WhatsApp collegato a questa edizione.')
      return
    }
    const href = /^https?:\/\//i.test(rawLink) ? rawLink : `https://${rawLink}`
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const columns = useMemo<ColumnDef<OpenDayRow>[]>(
    () => [
      { accessorKey: 'name', header: 'Titolo' },
      { accessorKey: 'categoryLabel', header: 'Categoria' },
      {
        accessorKey: 'audience',
        header: 'Tipologia eta',
        cell: ({ row }) => (row.original.audience === 'adult' ? 'Adulto' : 'Minore'),
      },
      { accessorKey: 'ageRange', header: 'Eta' },
      { accessorKey: 'editionsCount', header: 'Edizioni' },
      { accessorKey: 'latestEditionYear', header: 'Ultima edizione' },
      { accessorKey: 'latestDurationLabel', header: 'Periodo/Data' },
      {
        accessorKey: 'latestStatus',
        header: 'Stato',
        cell: ({ row }) =>
          row.original.latestStatus === 'published'
            ? 'Pubblicato'
            : row.original.latestStatus === 'archived'
              ? 'Archiviato'
              : 'Bozza',
      },
      {
        id: 'actions',
        header: 'Azioni',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost btn-sm px-1" onClick={() => openEditionsModal(row.original.productId)}>
              {row.original.editionsCount}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm px-1 text-success"
              onClick={() => openOpenDayWhatsAppGroup(row.original.latestEditionId)}
              aria-label={t('utility.packages.openWhatsAppGroupAction')}
              title="Apri gruppo WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm px-1 text-warning"
              onClick={() => openEditModal(row.original.productId, row.original.latestEditionId)}
            >
              <SquarePen className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [rows],
  )

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Open Day</h2>
          <p className="text-sm opacity-70">Gestione prodotti open day ed edizioni annuali.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          Crea open day
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-base-300 bg-base-100 p-4 text-sm opacity-70">
          Nessun open day disponibile.
        </div>
      ) : (
        <DataTable table={table} />
      )}

      {isEditionsModalOpen && selectedProductId ? (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Edizioni open day</h3>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => openCreateEditionFromProduct(selectedProductId)}>
                Nuova edizione
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-zebra table-sm">
                <thead>
                  <tr>
                    <th>Anno</th>
                    <th>Titolo</th>
                    <th>Periodo/Data</th>
                    <th>Stato</th>
                    <th className="text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProductEditions.map((edition) => (
                    <tr key={edition.editionId}>
                      <td>{edition.editionYear}</td>
                      <td>{edition.name}</td>
                      <td>{edition.durationLabel}</td>
                      <td>{edition.status === 'published' ? 'Pubblicato' : edition.status === 'archived' ? 'Archiviato' : 'Bozza'}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm px-1 text-success"
                            onClick={() => openOpenDayWhatsAppGroup(edition.editionId)}
                            aria-label={t('utility.packages.openWhatsAppGroupAction')}
                            title="Apri gruppo WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm px-1 text-warning"
                            onClick={() => openEditModal(edition.productId, edition.editionId)}
                          >
                            <SquarePen className="h-4 w-4" />
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm px-1 text-error" onClick={() => handleDeleteEdition(edition)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedProductEditions.length === 0 ? <p className="text-sm opacity-70">Nessuna edizione presente.</p> : null}
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={closeEditionsModal}>
                Chiudi
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeEditionsModal} />
        </dialog>
      ) : null}

      {isModalOpen ? (
        <dialog className="modal modal-open">
          <div className="modal-box h-screen w-screen max-w-none rounded-none p-0">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-base-300 px-6 py-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {modalMode === 'create' ? 'Crea open day' : modalMode === 'create-edition' ? 'Crea nuova edizione open day' : 'Modifica open day'}
                  </h3>
                  <p className="text-sm opacity-70">Gestione prodotto open day con edizione annuale.</p>
                </div>
                <button type="button" className="btn btn-ghost" onClick={closeModal}>
                  Chiudi
                </button>
              </div>

              <div className="border-b border-base-300 px-6 pt-4">
                <div className="tabs tabs-lift">
                  <button type="button" className={`tab ${activeTab === 'general-info' ? 'tab-active' : ''}`} onClick={() => setActiveTab('general-info')}>
                    Info generali
                  </button>
                  <button type="button" className={`tab ${activeTab === 'duration' ? 'tab-active' : ''}`} onClick={() => setActiveTab('duration')}>
                    Durata
                  </button>
                  <button type="button" className={`tab ${activeTab === 'groups' ? 'tab-active' : ''}`} onClick={() => setActiveTab('groups')}>
                    Campi e Gruppi
                  </button>
                  <button type="button" className={`tab ${activeTab === 'whatsapp' ? 'tab-active' : ''}`} onClick={() => setActiveTab('whatsapp')}>
                    WhatsApp
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {message ? (
                  <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${isError ? 'bg-error/15 text-error' : 'bg-success/15 text-success'}`}>
                    {message}
                  </p>
                ) : null}

                <div className="rounded-b-lg rounded-tr-lg border border-base-300 p-4">
                  {activeTab === 'general-info' ? (
                    <div className="grid gap-5 md:grid-cols-12">
                      <div className="space-y-4 md:col-span-9">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="form-control">
                            <span className="label-text mb-1 text-xs">Codice open day</span>
                            <input
                              className="input input-bordered w-full mb-4"
                              value={draft.code}
                              onChange={(event) => setDraft((prev) => ({ ...prev, code: event.target.value }))}
                              placeholder="open-day-calcio-u12"
                            />
                          </label>
                          <label className="form-control">
                            <span className="label-text mb-1 text-xs">Anno edizione</span>
                            <input
                              className="input input-bordered w-full mb-4"
                              type="number"
                              min={2000}
                              max={2100}
                              value={draft.editionYear}
                              onChange={(event) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  editionYear: Math.max(2000, Math.min(2100, Math.trunc(event.target.valueAsNumber || CURRENT_YEAR))),
                                }))
                              }
                            />
                          </label>
                        </div>

                        <label className="form-control">
                          <span className="label-text mb-1 text-xs">Titolo</span>
                          <input
                            className="input input-bordered w-full"
                            value={draft.name}
                            onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                            placeholder="Open day calcio primavera"
                          />
                        </label>

                        <label className="form-control">
                          <span className="label-text mb-1 text-xs">Descrizione</span>
                          <textarea
                            className="textarea textarea-bordered min-h-32 w-full"
                            value={draft.description}
                            onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                          />
                        </label>

                        <label className="form-control">
                          <span className="label-text mb-1 text-xs">Disclaimer</span>
                          <textarea
                            className="textarea textarea-bordered min-h-28 w-full"
                            rows={3}
                            value={draft.disclaimer}
                            onChange={(event) => setDraft((prev) => ({ ...prev, disclaimer: event.target.value }))}
                          />
                        </label>

                        <div className="space-y-2 rounded-lg border border-base-300 p-3">
                          <p className="text-xs font-medium">Range eta</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="form-control">
                              <span className="label-text mb-1 text-xs">Eta minima</span>
                              <input
                                className="input input-bordered w-full mb-4"
                                type="number"
                                min={0}
                                max={120}
                                value={draft.ageMin}
                                onChange={(event) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    ageMin: Math.max(0, Math.trunc(event.target.valueAsNumber || 0)),
                                  }))
                                }
                              />
                            </label>
                            <label className="form-control">
                              <span className="label-text mb-1 text-xs">Eta massima</span>
                              <input
                                className="input input-bordered w-full"
                                type="number"
                                min={0}
                                max={120}
                                value={draft.ageMax}
                                onChange={(event) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    ageMax: Math.max(0, Math.trunc(event.target.valueAsNumber || 0)),
                                  }))
                                }
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 md:col-span-3">
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs">Tipologia eta</span>
                          <select
                            className="select select-bordered w-full"
                            value={draft.audience}
                            onChange={(event) =>
                              setDraft((prev) => ({
                                ...prev,
                                audience: event.target.value === 'adult' ? 'adult' : 'youth',
                              }))
                            }
                          >
                            <option value="youth">Minore</option>
                            <option value="adult">Adulto</option>
                          </select>
                        </label>

                        <label className="form-control">
                          <span className="label-text mb-1 text-xs">Categoria</span>
                          <select
                            className="select select-bordered w-full"
                            value={draft.categoryId}
                            onChange={(event) => {
                              const nextCategoryId = event.target.value
                              setDraft((prev) => ({
                                ...prev,
                                categoryId: nextCategoryId,
                                groups: prev.groups.map((group) => ({
                                  ...group,
                                  fieldId:
                                    allFields.some((field) => field.id === group.fieldId && field.categoryId === nextCategoryId)
                                      ? group.fieldId
                                      : (allFields.find((field) => field.categoryId === nextCategoryId)?.id ?? ''),
                                })),
                              }))
                            }}
                          >
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="form-control">
                          <span className="label-text mb-1 text-xs">Stato prodotto</span>
                          <select
                            className="select select-bordered w-full"
                            value={draft.productStatus}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, productStatus: event.target.value as OpenDayStatus }))
                            }
                          >
                            <option value="draft">Bozza</option>
                            <option value="published">Pubblicato</option>
                            <option value="archived">Archiviato</option>
                          </select>
                        </label>

                        <div className="rounded-lg border border-base-300 p-3 text-sm">
                          <p className="text-xs font-medium uppercase tracking-wide opacity-60">Riepilogo</p>
                          <dl className="mt-3 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <dt className="opacity-70">Audience</dt>
                              <dd className="font-medium">{draft.audience === 'adult' ? 'Adulto' : 'Minore'}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="opacity-70">Eta</dt>
                              <dd className="font-medium">
                                {draft.ageMin}-{draft.ageMax}
                              </dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="opacity-70">Categoria</dt>
                              <dd className="font-medium">{selectedCategoryLabel}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="opacity-70">Gruppi</dt>
                              <dd className="font-medium">{draft.groups.length}</dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeTab === 'duration' ? (
                    <div className="grid gap-5 md:grid-cols-12">
                      <div className="space-y-4 md:col-span-8">
                        <div className="rounded-lg border border-base-300 p-4">
                          <p className="mb-2 text-xs font-medium">Durata open day</p>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <label className="label cursor-pointer justify-start gap-2">
                              <input
                                type="radio"
                                name="open-day-duration-type"
                                className="radio radio-primary radio-sm"
                                checked={draft.durationType === 'single-event'}
                                onChange={() =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    durationType: 'single-event',
                                    periodStartDate: '',
                                    periodEndDate: '',
                                  }))
                                }
                              />
                              <span className="label-text">Singolo giorno</span>
                            </label>
                            <label className="label cursor-pointer justify-start gap-2">
                              <input
                                type="radio"
                                name="open-day-duration-type"
                                className="radio radio-primary radio-sm"
                                checked={draft.durationType === 'period'}
                                onChange={() =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    durationType: 'period',
                                    eventDate: '',
                                  }))
                                }
                              />
                              <span className="label-text">Periodo</span>
                            </label>
                          </div>
                        </div>

                        {draft.durationType === 'single-event' ? (
                          <div className="grid gap-4 rounded-lg border border-base-300 p-4 sm:grid-cols-2">
                            <label className="form-control">
                              <span className="label-text mb-1 text-xs">Data evento</span>
                              <input
                                className="input input-bordered w-full"
                                type="date"
                                value={draft.eventDate}
                                onChange={(event) => setDraft((prev) => ({ ...prev, eventDate: event.target.value }))}
                              />
                            </label>
                            <label className="form-control">
                              <span className="label-text mb-1 text-xs">Stato edizione</span>
                              <select
                                className="select select-bordered w-full"
                                value={draft.editionStatus}
                                onChange={(event) =>
                                  setDraft((prev) => ({ ...prev, editionStatus: event.target.value as OpenDayStatus }))
                                }
                              >
                                <option value="draft">Bozza</option>
                                <option value="published">Pubblicato</option>
                                <option value="archived">Archiviato</option>
                              </select>
                            </label>
                          </div>
                        ) : (
                          <div className="space-y-3 rounded-lg border border-base-300 p-4">
                            <p className="text-xs opacity-70">
                              Definisci l'intervallo temporale in cui potranno essere configurate e mostrate le sessioni specifiche.
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="form-control">
                                <span className="label-text mb-1 text-xs">Data inizio</span>
                                <input
                                  className="input input-bordered w-full"
                                  type="date"
                                  value={draft.periodStartDate}
                                  onChange={(event) => setDraft((prev) => ({ ...prev, periodStartDate: event.target.value }))}
                                />
                              </label>
                              <label className="form-control">
                                <span className="label-text mb-1 text-xs">Data fine</span>
                                <input
                                  className="input input-bordered w-full"
                                  type="date"
                                  value={draft.periodEndDate}
                                  onChange={(event) => setDraft((prev) => ({ ...prev, periodEndDate: event.target.value }))}
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4 md:col-span-4">
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs">Stato edizione</span>
                          <select
                            className="select select-bordered w-full"
                            value={draft.editionStatus}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, editionStatus: event.target.value as OpenDayStatus }))
                            }
                          >
                            <option value="draft">Bozza</option>
                            <option value="published">Pubblicato</option>
                            <option value="archived">Archiviato</option>
                          </select>
                        </label>

                        <div className="rounded-lg border border-base-300 p-3 text-sm">
                          <p className="text-xs font-medium uppercase tracking-wide opacity-60">Finestra attivita</p>
                          <dl className="mt-3 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <dt className="opacity-70">Tipo</dt>
                              <dd className="font-medium">{draft.durationType === 'single-event' ? 'Singolo giorno' : 'Periodo'}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="opacity-70">Avvio</dt>
                              <dd className="font-medium">{draft.durationType === 'single-event' ? draft.eventDate || '-' : draft.periodStartDate || '-'}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="opacity-70">Chiusura</dt>
                              <dd className="font-medium">{draft.durationType === 'single-event' ? draft.eventDate || '-' : draft.periodEndDate || '-'}</dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeTab === 'groups' ? (
                    <div className="grid gap-5 md:grid-cols-12">
                      <div className="space-y-4 md:col-span-8">
                        <div className="rounded-lg border border-base-300 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h4 className="font-semibold">Campi e gruppi</h4>
                              <p className="mt-1 text-sm opacity-70">
                                Definisci i gruppi open day con età, sesso, campo e singole sessioni datate.
                              </p>
                            </div>
                            <button type="button" className="btn btn-primary btn-sm" onClick={openCreateGroupModal}>
                              Nuovo gruppo
                            </button>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-base-300">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Gruppo</th>
                                <th>Campo</th>
                                <th>Anno nascita</th>
                                <th>Sesso</th>
                                <th>Sessioni</th>
                                <th className="text-right">Azioni</th>
                              </tr>
                            </thead>
                            <tbody>
                              {draft.groups.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="py-8 text-center text-sm opacity-60">
                                    Nessun gruppo configurato.
                                  </td>
                                </tr>
                              ) : (
                                draft.groups.map((group, index) => (
                                  <tr key={group.id}>
                                    <td>
                                      <div className="font-medium">{group.title}</div>
                                      <div className="text-xs opacity-60">{group.isActive ? 'Attivo' : 'Disattivo'}</div>
                                    </td>
                                    <td>{fieldTitleById.get(group.fieldId) ?? '-'}</td>
                                    <td>
                                      {group.birthYearMin}-{group.birthYearMax}
                                    </td>
                                    <td>{group.gender === 'mixed' ? 'Misto' : group.gender === 'female' ? 'Femminile' : 'Maschile'}</td>
                                    <td>
                                      <div className="space-y-1 text-xs">
                                        {group.sessions.map((session) => (
                                          <div key={session.id}>
                                            {session.date} {session.startTime}-{session.endTime}
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                    <td>
                                      <div className="flex justify-end gap-1">
                                        <button type="button" className="btn btn-ghost btn-sm px-1 text-warning" onClick={() => openEditGroupModal(index)}>
                                          <SquarePen className="h-4 w-4" />
                                        </button>
                                        <button type="button" className="btn btn-ghost btn-sm px-1 text-error" onClick={() => removeGroup(index)}>
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="space-y-4 md:col-span-4">
                        <div className="rounded-lg border border-base-300 p-3 text-sm">
                          <p className="text-xs font-medium uppercase tracking-wide opacity-60">Regole tab</p>
                          <ul className="mt-3 space-y-2 opacity-80">
                            <li>Sessioni su date specifiche, non settimanali.</li>
                            <li>Filtri lato form per eta, sesso e disponibilita.</li>
                            <li>Selezione multipla possibile su piu giorni e gruppi.</li>
                          </ul>
                        </div>

                        <div className="rounded-lg border border-base-300 p-3 text-sm">
                          <p className="text-xs font-medium uppercase tracking-wide opacity-60">Riepilogo gruppi</p>
                          <dl className="mt-3 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <dt className="opacity-70">Gruppi</dt>
                              <dd className="font-medium">{draft.groups.length}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="opacity-70">Sessioni</dt>
                              <dd className="font-medium">{draft.groups.reduce((total, group) => total + group.sessions.length, 0)}</dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeTab === 'whatsapp' ? (
                    <div className="grid gap-5 md:grid-cols-12">
                      <div className="space-y-4 md:col-span-8">
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs">Link gruppo WhatsApp</span>
                          <input
                            className="input input-bordered w-full mb-4"
                            value={draft.whatsappGroupLink}
                            onChange={(event) => setDraft((prev) => ({ ...prev, whatsappGroupLink: event.target.value }))}
                            placeholder="https://chat.whatsapp.com/..."
                          />
                        </label>

                        <div className="rounded-lg border border-base-300 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h4 className="font-semibold">Account WhatsApp collegati</h4>
                              <p className="mt-1 text-sm opacity-70">
                                Seleziona gli account WhatsApp disponibili per questo open day come nei pacchetti.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() =>
                                setDraft((prev) => {
                                  const selectedIds = new Set(prev.whatsappAccountIds)
                                  const nextAccount = whatsappAccounts.find((account) => !selectedIds.has(account.id))
                                  if (!nextAccount) {
                                    return prev
                                  }
                                  return {
                                    ...prev,
                                    whatsappAccountIds: [...prev.whatsappAccountIds, nextAccount.id],
                                  }
                                })
                              }
                            >
                              Aggiungi account
                            </button>
                          </div>

                          {draft.whatsappAccountIds.length === 0 ? (
                            <p className="mt-4 text-sm opacity-70">Nessun account WhatsApp selezionato.</p>
                          ) : (
                            <div className="mt-4 space-y-2">
                              {draft.whatsappAccountIds.map((accountId, index) => (
                                <div key={`open-day-whatsapp-${index}`} className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
                                  <label className="form-control">
                                    <span className="label-text mb-1 text-xs">Account WhatsApp</span>
                                    <select
                                      className="select select-bordered w-full mb-4"
                                      value={accountId}
                                      onChange={(event) =>
                                        setDraft((prev) => ({
                                          ...prev,
                                          whatsappAccountIds: prev.whatsappAccountIds.map((item, itemIndex) =>
                                            itemIndex === index ? event.target.value : item,
                                          ),
                                        }))
                                      }
                                    >
                                      {whatsappAccounts.length === 0 ? <option value="">Nessun account disponibile</option> : null}
                                      {whatsappAccounts
                                        .filter(
                                          (account) =>
                                            account.id === accountId ||
                                            !draft.whatsappAccountIds.some(
                                              (selectedId, selectedIndex) =>
                                                selectedIndex !== index && selectedId === account.id,
                                            ),
                                        )
                                        .map((account) => (
                                          <option key={account.id} value={account.id}>
                                            {account.title}
                                          </option>
                                        ))}
                                    </select>
                                  </label>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm px-1 text-error"
                                    onClick={() =>
                                      setDraft((prev) => ({
                                        ...prev,
                                        whatsappAccountIds: prev.whatsappAccountIds.filter((_, itemIndex) => itemIndex !== index),
                                      }))
                                    }
                                  >
                                    Rimuovi
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4 md:col-span-4">
                        <div className="rounded-lg border border-base-300 p-3 text-sm">
                          <p className="text-xs font-medium uppercase tracking-wide opacity-60">Riepilogo WhatsApp</p>
                          <dl className="mt-3 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <dt className="opacity-70">Account</dt>
                              <dd className="font-medium">{draft.whatsappAccountIds.length}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="opacity-70">Link gruppo</dt>
                              <dd className="max-w-48 truncate text-right font-medium">{draft.whatsappGroupLink || '-'}</dd>
                            </div>
                          </dl>
                        </div>

                        <div className="rounded-lg border border-base-300 p-3 text-sm">
                          <p className="text-xs font-medium uppercase tracking-wide opacity-60">Regole tab</p>
                          <ul className="mt-3 space-y-2 opacity-80">
                            <li>Il collegamento WhatsApp e definito per singola edizione.</li>
                            <li>Gli account selezionabili arrivano dalla utility WhatsApp.</li>
                            <li>Puoi collegare piu account senza duplicati.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-base-300 px-6 py-4">
                <div className="flex items-center justify-between">
                  <button type="button" className="btn btn-ghost" onClick={closeModal}>
                    Chiudi
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                    {modalMode === 'create' ? 'Crea' : modalMode === 'create-edition' ? 'Crea edizione' : 'Salva'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeModal} />
        </dialog>
      ) : null}

      {isGroupModalOpen ? (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-lg font-semibold">{groupModalMode === 'create' ? 'Nuovo gruppo open day' : 'Modifica gruppo open day'}</h4>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeGroupModal}>
                Chiudi
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-1 text-xs">Titolo gruppo</span>
                <input
                  className="input input-bordered w-full"
                  value={groupDraft.title}
                  onChange={(event) => setGroupDraft((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">Campo</span>
                <select
                  className="select select-bordered w-full"
                  value={groupDraft.fieldId}
                  onChange={(event) => setGroupDraft((prev) => ({ ...prev, fieldId: event.target.value }))}
                >
                  {categoryFields.length === 0 ? <option value="">Nessun campo disponibile</option> : null}
                  {categoryFields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">Sesso</span>
                <select
                  className="select select-bordered w-full"
                  value={groupDraft.gender}
                  onChange={(event) =>
                    setGroupDraft((prev) => ({ ...prev, gender: event.target.value as OpenDayGroupGender }))
                  }
                >
                  <option value="mixed">Misto</option>
                  <option value="male">Maschile</option>
                  <option value="female">Femminile</option>
                </select>
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">Capienza gruppo</span>
                <input
                  className="input input-bordered w-full"
                  type="number"
                  min={0}
                  value={groupDraft.capacity ?? ''}
                  onChange={(event) =>
                    setGroupDraft((prev) => ({
                      ...prev,
                      capacity: event.target.value === '' ? null : Math.max(0, Math.trunc(event.target.valueAsNumber || 0)),
                    }))
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">Anno nascita minimo</span>
                <input
                  className="input input-bordered w-full"
                  type="number"
                  value={groupDraft.birthYearMin}
                  onChange={(event) =>
                    setGroupDraft((prev) => ({
                      ...prev,
                      birthYearMin: Math.trunc(event.target.valueAsNumber || CURRENT_YEAR),
                    }))
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">Anno nascita massimo</span>
                <input
                  className="input input-bordered w-full"
                  type="number"
                  value={groupDraft.birthYearMax}
                  onChange={(event) =>
                    setGroupDraft((prev) => ({
                      ...prev,
                      birthYearMax: Math.trunc(event.target.valueAsNumber || CURRENT_YEAR),
                    }))
                  }
                />
              </label>
            </div>

            <label className="flex items-center justify-between rounded-lg border border-base-300 px-3 py-2">
              <span className="text-xs">Gruppo attivo</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={groupDraft.isActive}
                onChange={(event) => setGroupDraft((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
            </label>

            <div className="space-y-3 rounded-lg border border-base-300 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Sessioni</p>
                  <p className="text-xs opacity-70">Ogni sessione definisce data, orario e capienza specifica.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    setGroupDraft((prev) => ({
                      ...prev,
                      sessions: [...prev.sessions, createOpenDaySessionDraft()],
                    }))
                  }
                >
                  Nuova sessione
                </button>
              </div>

              <div className="space-y-3">
                {groupDraft.sessions.map((session) => (
                  <div key={session.id} className="rounded-lg border border-base-300 p-3">
                    <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
                      <label className="form-control">
                        <span className="label-text mb-1 text-xs">Data</span>
                        <input
                          className="input input-bordered w-full"
                          type="date"
                          value={session.date}
                          onChange={(event) =>
                            setGroupDraft((prev) => ({
                              ...prev,
                              sessions: prev.sessions.map((entry) =>
                                entry.id === session.id ? { ...entry, date: event.target.value } : entry,
                              ),
                            }))
                          }
                        />
                      </label>

                      <label className="form-control">
                        <span className="label-text mb-1 text-xs">Inizio</span>
                        <input
                          className="input input-bordered w-full"
                          type="time"
                          value={session.startTime}
                          onChange={(event) =>
                            setGroupDraft((prev) => ({
                              ...prev,
                              sessions: prev.sessions.map((entry) =>
                                entry.id === session.id ? { ...entry, startTime: event.target.value } : entry,
                              ),
                            }))
                          }
                        />
                      </label>

                      <label className="form-control">
                        <span className="label-text mb-1 text-xs">Fine</span>
                        <input
                          className="input input-bordered w-full"
                          type="time"
                          value={session.endTime}
                          onChange={(event) =>
                            setGroupDraft((prev) => ({
                              ...prev,
                              sessions: prev.sessions.map((entry) =>
                                entry.id === session.id ? { ...entry, endTime: event.target.value } : entry,
                              ),
                            }))
                          }
                        />
                      </label>

                      <label className="form-control">
                        <span className="label-text mb-1 text-xs">Capienza</span>
                        <input
                          className="input input-bordered w-full"
                          type="number"
                          min={0}
                          value={session.capacity ?? ''}
                          onChange={(event) =>
                            setGroupDraft((prev) => ({
                              ...prev,
                              sessions: prev.sessions.map((entry) =>
                                entry.id === session.id
                                  ? {
                                      ...entry,
                                      capacity:
                                        event.target.value === ''
                                          ? null
                                          : Math.max(0, Math.trunc(event.target.valueAsNumber || 0)),
                                    }
                                  : entry,
                              ),
                            }))
                          }
                        />
                      </label>

                      <div className="flex items-end justify-end gap-2">
                        <label className="label cursor-pointer justify-start gap-2">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={session.isActive}
                            onChange={(event) =>
                              setGroupDraft((prev) => ({
                                ...prev,
                                sessions: prev.sessions.map((entry) =>
                                  entry.id === session.id ? { ...entry, isActive: event.target.checked } : entry,
                                ),
                              }))
                            }
                          />
                          <span className="label-text text-xs">Attiva</span>
                        </label>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm px-1 text-error"
                          disabled={groupDraft.sessions.length <= 1}
                          onClick={() =>
                            setGroupDraft((prev) => ({
                              ...prev,
                              sessions:
                                prev.sessions.length > 1
                                  ? prev.sessions.filter((entry) => entry.id !== session.id)
                                  : prev.sessions,
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={closeGroupModal}>
                Chiudi
              </button>
              <button type="button" className="btn btn-primary" onClick={saveGroupModal}>
                {groupModalMode === 'create' ? 'Aggiungi gruppo' : 'Salva gruppo'}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeGroupModal} />
        </dialog>
      ) : null}
    </section>
  )
}

export default OpenDayPage
