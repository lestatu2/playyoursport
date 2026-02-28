import { type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { RoleKey, SaveUserPayload } from '../lib/auth'

const EDITOR_ADMIN_PERMISSIONS = [
  { key: 'packages.manage', labelKey: 'users.permissions.packagesManage' },
  { key: 'users.read', labelKey: 'users.permissions.usersRead' },
  { key: 'subscribers.manage', labelKey: 'users.permissions.subscribersManage' },
] as const

type UserFormProps = {
  role: RoleKey
  draft: SaveUserPayload
  onChange: (next: SaveUserPayload) => void
}

function UserForm({ role, draft, onChange }: UserFormProps) {
  const { t } = useTranslation()

  const handleAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) {
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      onChange({
        ...draft,
        avatarUrl: result,
      })
    }
    reader.readAsDataURL(file)
  }

  const setValue = <K extends keyof SaveUserPayload>(key: K, value: SaveUserPayload[K]) => {
    onChange({
      ...draft,
      [key]: value,
    })
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="form-control">
        <span className="label-text mb-1 text-xs">{t('users.firstName')}</span>
        <input
          className="input input-bordered w-full"
          value={draft.firstName}
          onChange={(event) => setValue('firstName', event.target.value)}
        />
      </label>

      <label className="form-control">
        <span className="label-text mb-1 text-xs">{t('users.lastName')}</span>
        <input
          className="input input-bordered w-full"
          value={draft.lastName}
          onChange={(event) => setValue('lastName', event.target.value)}
        />
      </label>

      <div className="form-control md:col-span-2">
        <span className="label-text mb-1 text-xs">{t('users.avatar')}</span>
        <div className="flex items-center gap-3">
          <input type="file" className="file-input file-input-bordered w-full max-w-sm" accept="image/*" onChange={handleAvatarUpload} />
          {draft.avatarUrl && <img src={draft.avatarUrl} alt="avatar" className="h-12 w-12 rounded-full object-cover" />}
        </div>
      </div>

      <label className="form-control">
        <span className="label-text mb-1 text-xs">{t('users.login')}</span>
        <input
          className="input input-bordered w-full"
          value={draft.login}
          onChange={(event) => setValue('login', event.target.value)}
        />
      </label>

      <label className="form-control">
        <span className="label-text mb-1 text-xs">{t('users.password')}</span>
        <input
          type="password"
          className="input input-bordered w-full"
          value={draft.password}
          onChange={(event) => setValue('password', event.target.value)}
        />
      </label>

      <label className="form-control md:col-span-2">
        <span className="label-text mb-1 text-xs">{t('users.email')}</span>
        <input
          type="email"
          className="input input-bordered w-full"
          value={draft.email}
          onChange={(event) => setValue('email', event.target.value)}
        />
      </label>

      {role === 'editor-admin' && (
        <>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('users.sector')}</span>
            <input
              className="input input-bordered w-full"
              value={draft.sector}
              onChange={(event) => setValue('sector', event.target.value)}
            />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('users.profession')}</span>
            <input
              className="input input-bordered w-full"
              value={draft.profession}
              onChange={(event) => setValue('profession', event.target.value)}
            />
          </label>
          <div className="md:col-span-2 space-y-2 rounded-lg border border-base-300 p-3">
            <p className="text-xs font-medium">{t('users.permissions.title')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {EDITOR_ADMIN_PERMISSIONS.map((permission) => (
                <label key={permission.key} className="label cursor-pointer justify-start gap-2 rounded-md border border-base-300 px-2 py-1">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={draft.permissions.includes(permission.key)}
                    onChange={(event) =>
                      setValue(
                        'permissions',
                        event.target.checked
                          ? [...draft.permissions, permission.key]
                          : draft.permissions.filter((item) => item !== permission.key),
                      )
                    }
                  />
                  <span className="label-text">{t(permission.labelKey)}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {role === 'trainer' && (
        <label className="form-control">
          <span className="label-text mb-1 text-xs">{t('users.age')}</span>
          <input
            type="number"
            min={1}
            className="input input-bordered w-full"
            value={draft.age ?? ''}
            onChange={(event) => setValue('age', Number.isFinite(event.target.valueAsNumber) ? Math.trunc(event.target.valueAsNumber) : null)}
          />
        </label>
      )}
    </div>
  )
}

export default UserForm
