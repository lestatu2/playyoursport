import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getRoleDefinitions, getRoleLabels, isManagementRole, loginWithEmailPassword, type AuthSession } from '../lib/auth'

type LoginPageProps = {
  session: AuthSession | null
  onLogin: (session: AuthSession) => void
}

function LoginPage({ session, onLogin }: LoginPageProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const roleLabels = getRoleLabels()
  const managementRoles = getRoleDefinitions().filter((role) => role.area === 'management')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (session && isManagementRole(session.role)) {
    return <Navigate to="/app" replace />
  }

  const submitLogin = () => {
    setError('')

    const result = loginWithEmailPassword(email, password)
    if (!result.ok) {
      setError(t(`login.${result.errorKey}`))
      return
    }

    if (!isManagementRole(result.session.role)) {
      setError(
        t('login.publicRoleBlocked', { role: roleLabels[result.session.role] ?? result.session.role }),
      )
      return
    }

    onLogin(result.session)
    navigate('/app', { replace: true })
  }

  return (
    <main className="min-h-screen bg-base-200 p-4">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-2xl bg-base-100 shadow-xl lg:grid-cols-2">
          <section className="bg-neutral p-8 text-neutral-content">
            <h1 className="text-3xl font-bold">{t('login.title')}</h1>
            <p className="mt-3 text-sm opacity-80">{t('login.description')}</p>
            <div className="mt-8">
              <p className="text-xs uppercase tracking-wide opacity-70">{t('login.managementRoles')}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {managementRoles.map((role) => (
                  <li key={role.key}>{roleLabels[role.key] ?? role.key}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="p-8">
            <h2 className="text-xl font-semibold">{t('login.formTitle')}</h2>
            <p className="mt-1 text-sm opacity-70">{t('login.formSubtitle')}</p>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                submitLogin()
              }}
              className="mt-6 space-y-4"
            >
              <label className="form-control w-full">
                <span className="label-text mb-1 text-sm">{t('login.email')}</span>
                <input
                  type="email"
                  className="input input-bordered w-full"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              <label className="form-control w-full">
                <span className="label-text mb-1 text-sm">{t('login.password')}</span>
                <input
                  type="password"
                  className="input input-bordered w-full"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>

              {error && <p className="rounded-lg bg-error/15 px-3 py-2 text-sm text-error">{error}</p>}

              <button type="submit" className="btn btn-primary w-full">
                {t('login.submit')}
              </button>
            </form>

            <div className="mt-6 rounded-lg border border-base-300 p-3 text-xs">
              <p className="font-semibold">{t('login.demoUser')}</p>
              <p>superadmin@playyoursport.test / SuperAdmin123!</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default LoginPage
