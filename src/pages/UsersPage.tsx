import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { SquarePen, Trash2 } from 'lucide-react'
import DataTable from '../components/DataTable'
import UserForm from '../components/UserForm'
import {
  canCreateRole,
  createUser,
  getRoleLabels,
  getUsers,
  getUsersChangedEventName,
  removeUser,
  updateUser,
  type AuthSession,
  type MockUser,
  type RoleKey,
  type SaveUserPayload,
} from '../lib/auth'

type UsersPageProps = {
  session: AuthSession
}

function createInitialDraft(role: RoleKey): SaveUserPayload {
  return {
    role,
    firstName: '',
    lastName: '',
    avatarUrl: '',
    login: '',
    password: '',
    email: '',
    age: null,
    sector: '',
    profession: '',
    permissions: [],
  }
}

function getAvatarUrl(user: MockUser): string {
  if (user.avatarUrl.trim()) {
    return user.avatarUrl
  }
  const seed = encodeURIComponent(`${user.firstName} ${user.lastName}`.trim() || user.login || user.email)
  return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}`
}

function userToSearchBlob(user: MockUser): string {
  return [
    user.firstName,
    user.lastName,
    user.name,
    user.login,
    user.email,
    user.sector,
    user.profession,
    user.age === null ? '' : String(user.age),
    ...user.permissions,
  ]
    .join(' ')
    .toLowerCase()
}

function UsersPage({ session }: UsersPageProps) {
  const { t } = useTranslation()
  const [users, setUsers] = useState<MockUser[]>(() => getUsers())
  const [activeTab, setActiveTab] = useState<RoleKey>('trainer')
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [draft, setDraft] = useState<SaveUserPayload>(() => createInitialDraft('trainer'))
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')
  const [professionFilter, setProfessionFilter] = useState('')
  const usersEvent = getUsersChangedEventName()
  const roleLabels = getRoleLabels()

  const editorAdminCanManageSubscribers =
    session.role !== 'editor-admin' || getUsers().find((user) => user.id === session.userId)?.permissions.includes('subscribers.manage')

  const visibleTabs = useMemo(() => {
    const tabs: RoleKey[] = []
    if (session.role === 'super-administrator') {
      tabs.push('administrator')
    }
    if (session.role === 'super-administrator' || session.role === 'administrator') {
      tabs.push('editor-admin')
    }
    if (session.role === 'super-administrator' || session.role === 'administrator' || session.role === 'editor-admin') {
      tabs.push('trainer')
      if (editorAdminCanManageSubscribers) {
        tabs.push('subscribers')
      }
    }
    return tabs
  }, [editorAdminCanManageSubscribers, session.role])

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0])
    }
  }, [activeTab, visibleTabs])

  useEffect(() => {
    const handleUsersChange = () => setUsers(getUsers())
    window.addEventListener(usersEvent, handleUsersChange)
    return () => window.removeEventListener(usersEvent, handleUsersChange)
  }, [usersEvent])

  useEffect(() => {
    setSearchTerm('')
    setSectorFilter('')
    setProfessionFilter('')
  }, [activeTab])

  const usersByTab = useMemo(() => users.filter((user) => user.role === activeTab), [activeTab, users])
  const sectorOptions = useMemo(
    () => Array.from(new Set(users.filter((user) => user.role === 'editor-admin').map((user) => user.sector).filter(Boolean))).sort(),
    [users],
  )
  const professionOptions = useMemo(
    () => Array.from(new Set(users.filter((user) => user.role === 'editor-admin').map((user) => user.profession).filter(Boolean))).sort(),
    [users],
  )

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return usersByTab.filter((user) => {
      if (activeTab === 'editor-admin' && sectorFilter && user.sector !== sectorFilter) {
        return false
      }
      if (activeTab === 'editor-admin' && professionFilter && user.profession !== professionFilter) {
        return false
      }
      if (!normalizedSearch || !['editor-admin', 'trainer', 'subscribers'].includes(activeTab)) {
        return true
      }
      return userToSearchBlob(user).includes(normalizedSearch)
    })
  }, [activeTab, professionFilter, searchTerm, sectorFilter, usersByTab])

  const openCreateModal = () => {
    setDraft(createInitialDraft(activeTab))
    setEditingUserId(null)
    setModalMode('create')
  }

  const openEditModal = useCallback((user: MockUser) => {
    setDraft({
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      login: user.login,
      password: user.password,
      email: user.email,
      age: user.age,
      sector: user.sector,
      profession: user.profession,
      permissions: user.permissions,
    })
    setEditingUserId(user.id)
    setModalMode('edit')
  }, [])

  const closeModal = () => {
    setModalMode(null)
    setEditingUserId(null)
  }

  const applyError = useCallback((error: string) => {
    setIsError(true)
    if (error === 'duplicateEmail') {
      setMessage(t('users.duplicateEmail'))
      return
    }
    if (error === 'duplicateLogin') {
      setMessage(t('users.duplicateLogin'))
      return
    }
    if (error === 'notAllowedRole') {
      setMessage(t('users.notAllowedRole'))
      return
    }
    setMessage(t('users.invalidData'))
  }, [t])

  const handleSubmit = () => {
    const payload = { ...draft, role: activeTab }
    const result =
      modalMode === 'create'
        ? createUser(payload, session.role)
        : editingUserId
          ? updateUser(editingUserId, payload, session.role)
          : { ok: false as const, error: 'notFound' as const }

    if (!result.ok) {
      applyError(result.error)
      return
    }

    setUsers(getUsers())
    setIsError(false)
    setMessage(modalMode === 'create' ? t('users.created') : t('users.updated'))
    closeModal()
  }

  const handleDelete = useCallback((user: MockUser) => {
    if (!canCreateRole(session.role, user.role)) {
      setIsError(true)
      setMessage(t('users.notAllowedRole'))
      return
    }
    const confirmed = window.confirm(t('users.confirmDelete', { name: user.name }))
    if (!confirmed) {
      return
    }
    const result = removeUser(user.id, session.role)
    if (!result.ok) {
      applyError(result.error)
      return
    }
    setUsers(getUsers())
    setIsError(false)
    setMessage(t('users.deleted'))
  }, [applyError, session.role, t])

  const columns = useMemo<ColumnDef<MockUser>[]>(() => {
    const base: ColumnDef<MockUser>[] = [
      {
        id: 'avatar',
        header: t('users.avatar'),
        cell: ({ row }) => <img src={getAvatarUrl(row.original)} alt={row.original.name} className="h-10 w-10 rounded-full object-cover" />,
      },
      {
        id: 'name',
        header: t('users.fullName'),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'login',
        header: t('users.login'),
        cell: ({ row }) => <span>{row.original.login}</span>,
      },
      {
        id: 'email',
        header: t('users.email'),
        cell: ({ row }) => <span>{row.original.email}</span>,
      },
    ]

    if (activeTab === 'trainer') {
      base.push({
        id: 'age',
        header: t('users.age'),
        cell: ({ row }) => <span>{row.original.age ?? '-'}</span>,
      })
    }
    if (activeTab === 'editor-admin') {
      base.push(
        {
          id: 'sector',
          header: t('users.sector'),
          cell: ({ row }) => <span>{row.original.sector || '-'}</span>,
        },
        {
          id: 'profession',
          header: t('users.profession'),
          cell: ({ row }) => <span>{row.original.profession || '-'}</span>,
        },
        {
          id: 'permissions',
          header: t('users.permissions.title'),
          cell: ({ row }) =>
            row.original.permissions.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {row.original.permissions.map((permission) => (
                  <span key={permission} className="badge badge-outline badge-sm">
                    {permission}
                  </span>
                ))}
              </div>
            ) : (
              <span>-</span>
            ),
        },
      )
    }

    base.push({
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
    })

    return base
  }, [activeTab, handleDelete, openEditModal, t])

  const table = useReactTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{t('users.title')}</h2>
          <p className="text-sm opacity-70">{t('users.description')}</p>
        </div>
      </div>

      <div className="tabs tabs-lift">
        {visibleTabs.map((tab) => (
          <button key={tab} type="button" className={`tab ${activeTab === tab ? 'tab-active' : ''}`} onClick={() => setActiveTab(tab)}>
            {roleLabels[tab] ?? tab}
          </button>
        ))}
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            {['editor-admin', 'trainer', 'subscribers'].includes(activeTab) && (
              <label className="form-control max-w-sm">
                <span className="label-text mb-1 text-xs">{t('users.searchAllFields')}</span>
                <input
                  className="input input-bordered w-full"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>
            )}
            {activeTab === 'editor-admin' && (
              <>
                <label className="form-control max-w-xs">
                  <span className="label-text mb-1 text-xs">{t('users.sector')}</span>
                  <select className="select select-bordered w-full" value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)}>
                    <option value="">{t('users.allOption')}</option>
                    {sectorOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-control max-w-xs">
                  <span className="label-text mb-1 text-xs">{t('users.profession')}</span>
                  <select
                    className="select select-bordered w-full"
                    value={professionFilter}
                    onChange={(event) => setProfessionFilter(event.target.value)}
                  >
                    <option value="">{t('users.allOption')}</option>
                    {professionOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <div className="ml-auto">
              <button type="button" className="btn btn-primary" onClick={openCreateModal}>
                {t('users.create')}
              </button>
            </div>
          </div>

          {message && (
            <p className={`rounded-lg px-3 py-2 text-sm ${isError ? 'bg-error/15 text-error' : 'bg-success/15 text-success'}`}>
              {message}
            </p>
          )}

          {filteredUsers.length === 0 ? (
            <p className="text-sm opacity-70">{t('users.empty')}</p>
          ) : (
            <DataTable table={table} />
          )}
        </div>
      </div>

      {modalMode && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-3xl space-y-4">
            <h3 className="text-lg font-semibold">
              {modalMode === 'create' ? t('users.create') : t('utility.categories.saveEdit')}
            </h3>

            <UserForm role={activeTab} draft={draft} onChange={setDraft} />

            <div className="modal-action gap-3">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                {t('utility.categories.cancelEdit')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                {modalMode === 'create' ? t('users.create') : t('utility.categories.saveEdit')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeModal} />
        </dialog>
      )}
    </section>
  )
}

export default UsersPage
