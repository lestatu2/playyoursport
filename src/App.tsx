import { Navigate, Route, Routes } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ManagementLayout from './layouts/ManagementLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ConfigurationPage from './pages/ConfigurationPage'
import { clearSession, getSession, isAdministrator, isManagementRole, type AuthSession } from './lib/auth'

type ProtectedRouteProps = {
  session: AuthSession | null
  children: JSX.Element
}

function ProtectedRoute({ session, children }: ProtectedRouteProps) {
  if (!session) {
    return <Navigate to="/login" replace />
  }
  if (!isManagementRole(session.role)) {
    clearSession()
    return <Navigate to="/login" replace />
  }
  return children
}

type AdminRouteProps = {
  session: AuthSession | null
}

function AdministratorRoute({ session }: AdminRouteProps) {
  const { t } = useTranslation()

  if (!session || !isAdministrator(session.role)) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-error">{t('common.accessDenied')}</h2>
          <p className="text-sm">{t('app.adminOnly')}</p>
        </div>
      </div>
    )
  }
  return <ConfigurationPage />
}

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getSession())

  const handleLogout = () => {
    clearSession()
    setSession(null)
  }

  const redirectTarget = session && isManagementRole(session.role) ? '/app' : '/login'

  return (
    <Routes>
      <Route path="/login" element={<LoginPage session={session} onLogin={setSession} />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute session={session}>
            <ManagementLayout session={session!} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="configurazione" element={<AdministratorRoute session={session} />} />
      </Route>
      <Route path="*" element={<Navigate to={redirectTarget} replace />} />
    </Routes>
  )
}

export default App
