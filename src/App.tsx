import { Navigate, Route, Routes } from 'react-router-dom'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import ManagementLayout from './layouts/ManagementLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ConfigurationPage from './pages/ConfigurationPage'
import UtilityCategoriesPage from './pages/UtilityCategoriesPage'
import PackagesPage from './pages/PackagesPage'
import UtilityCompaniesPage from './pages/UtilityCompaniesPage'
import UtilityFieldsPage from './pages/UtilityFieldsPage'
import UtilityEnrollmentsPage from './pages/UtilityEnrollmentsPage'
import UtilityAdditionalServicesPage from './pages/UtilityAdditionalServicesPage'
import UtilityWhatsAppAccountsPage from './pages/UtilityWhatsAppAccountsPage'
import UsersPage from './pages/UsersPage'
import {
  canAccessConfiguration,
  canAccessPackages,
  canAccessUsersPage,
  canAccessUtility,
  clearSession,
  getSession,
  isManagementRole,
  type AuthSession,
  hasSessionPermission,
} from './lib/auth'

type ProtectedRouteProps = {
  session: AuthSession | null
  children: ReactElement
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

  if (!session || !canAccessConfiguration(session.role)) {
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

type UtilityRouteProps = {
  session: AuthSession | null
  children: ReactElement
}

function PackagesRoute({ session, children }: UtilityRouteProps) {
  const { t } = useTranslation()

  if (!session || !canAccessPackages(session.role)) {
    return <Navigate to="/login" replace />
  }
  if (session.role === 'editor-admin' && !hasSessionPermission('packages.manage')) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-error">{t('common.accessDenied')}</h2>
          <p className="text-sm">{t('app.permissionDenied')}</p>
        </div>
      </div>
    )
  }
  return children
}

function UtilityRoute({ session, children }: UtilityRouteProps) {
  const { t } = useTranslation()

  if (!session || !canAccessUtility(session.role)) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-error">{t('common.accessDenied')}</h2>
          <p className="text-sm">{t('app.adminOnlyUtility')}</p>
        </div>
      </div>
    )
  }
  return children
}

function UsersRoute({ session, children }: UtilityRouteProps) {
  const { t } = useTranslation()

  if (!session || !canAccessUsersPage(session.role)) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-error">{t('common.accessDenied')}</h2>
          <p className="text-sm">{t('app.usersOnly')}</p>
        </div>
      </div>
    )
  }
  if (session.role === 'editor-admin' && !hasSessionPermission('users.read')) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-error">{t('common.accessDenied')}</h2>
          <p className="text-sm">{t('app.permissionDenied')}</p>
        </div>
      </div>
    )
  }
  return children
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
        <Route
          path="pacchetti"
          element={
            <PackagesRoute session={session}>
              <PackagesPage />
            </PackagesRoute>
          }
        />
        <Route
          path="utenti"
          element={
            <UsersRoute session={session}>
              <UsersPage session={session!} />
            </UsersRoute>
          }
        />
        <Route path="configurazione" element={<AdministratorRoute session={session} />} />
        <Route
          path="utility/categorie"
          element={
            <UtilityRoute session={session}>
              <UtilityCategoriesPage />
            </UtilityRoute>
          }
        />
        <Route
          path="utility/aziende"
          element={
            <UtilityRoute session={session}>
              <UtilityCompaniesPage />
            </UtilityRoute>
          }
        />
        <Route
          path="utility/campi"
          element={
            <UtilityRoute session={session}>
              <UtilityFieldsPage />
            </UtilityRoute>
          }
        />
        <Route
          path="utility/iscrizioni"
          element={
            <UtilityRoute session={session}>
              <UtilityEnrollmentsPage />
            </UtilityRoute>
          }
        />
        <Route
          path="utility/servizi-aggiuntivi"
          element={
            <UtilityRoute session={session}>
              <UtilityAdditionalServicesPage />
            </UtilityRoute>
          }
        />
        <Route
          path="utility/whatsapp-accounts"
          element={
            <UtilityRoute session={session}>
              <UtilityWhatsAppAccountsPage />
            </UtilityRoute>
          }
        />
        <Route path="utility" element={<Navigate to="/app/utility/categorie" replace />} />
      </Route>
      <Route path="*" element={<Navigate to={redirectTarget} replace />} />
    </Routes>
  )
}

export default App
