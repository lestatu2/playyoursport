import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Boxes,
  Building2,
  ChevronLeft,
  CircleUser,
  CreditCard,
  Globe,
  HandCoins,
  LayoutDashboard,
  Map,
  Menu,
  MessageCircle,
  Package,
  Settings,
  ShieldCheck,
  Tag,
  UserCheck,
  Users,
  Users2,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import FlagIcon from '../components/FlagIcon'
import {
  canAccessConfiguration,
  canAccessPackages,
  canAccessUsersPage,
  canAccessUtility,
  getRoleLabels,
  hasSessionPermission,
  type AuthSession,
} from '../lib/auth'
import {
  getCurrentLanguage,
  getLanguageSettings,
  getLanguageSettingsChangedEventName,
  setCurrentLanguage,
} from '../lib/language-settings'
import type { LanguageCode } from '../lib/languages'
import { getProjectSettings, getProjectSettingsChangedEventName } from '../lib/project-settings'

type MenuItemProps = {
  to: string
  icon: ReactNode
  label: string
  collapsed: boolean
  exact?: boolean
  activeOnStartsWith?: string[]
}

function MenuItem({ to, icon, label, collapsed, exact = false, activeOnStartsWith = [] }: MenuItemProps) {
  const location = useLocation()
  const isForcedActive = activeOnStartsWith.some((prefix) => location.pathname.startsWith(prefix))
  return (
    <li>
      <NavLink
        to={to}
        end={exact}
        className={({ isActive }) =>
          `flex w-full items-center gap-3 rounded-lg px-3 py-2 transition ${
            isActive || isForcedActive ? 'bg-primary text-primary-content' : 'hover:bg-base-300'
          }`
        }
      >
        {icon}
        {!collapsed && <span>{label}</span>}
      </NavLink>
    </li>
  )
}

type ManagementLayoutProps = {
  session: AuthSession
  onLogout: () => void
}

function ManagementLayout({ session, onLogout }: ManagementLayoutProps) {
  const { t, i18n } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  const [projectSettings, setProjectSettings] = useState(() => getProjectSettings())
  const [languageSettings, setLanguageSettings] = useState(() => getLanguageSettings())
  const [currentLanguage, setCurrentLanguageState] = useState<LanguageCode>(() => getCurrentLanguage())
  const roleLabel = useMemo(() => getRoleLabels()[session.role] ?? session.role, [session.role])
  const projectSettingsEvent = getProjectSettingsChangedEventName()
  const languageSettingsEvent = getLanguageSettingsChangedEventName()

  useEffect(() => {
    const handleProjectSettingsChange = () => {
      setProjectSettings(getProjectSettings())
    }
    window.addEventListener(projectSettingsEvent, handleProjectSettingsChange)
    return () => window.removeEventListener(projectSettingsEvent, handleProjectSettingsChange)
  }, [projectSettingsEvent])

  useEffect(() => {
    const handleLanguageSettingsChange = () => {
      const nextSettings = getLanguageSettings()
      const nextLanguage = getCurrentLanguage()
      setLanguageSettings(nextSettings)
      setCurrentLanguageState(nextLanguage)
      void i18n.changeLanguage(nextLanguage)
    }
    window.addEventListener(languageSettingsEvent, handleLanguageSettingsChange)
    return () => window.removeEventListener(languageSettingsEvent, handleLanguageSettingsChange)
  }, [i18n, languageSettingsEvent])

  const switchLanguage = (language: LanguageCode) => {
    const next = setCurrentLanguage(language)
    setCurrentLanguageState(next)
    void i18n.changeLanguage(next)
  }

  return (
    <div className="drawer lg:drawer-open min-h-screen bg-base-200">
      <input id="main-sidebar" type="checkbox" className="drawer-toggle" />

      <div className="drawer-content">
        <header className="navbar border-b border-base-300 bg-base-100 px-4 lg:px-6">
          <div className="flex-1 items-center gap-2">
            <label htmlFor="main-sidebar" className="btn btn-ghost btn-square lg:hidden">
              <Menu className="h-5 w-5" />
            </label>
            <h1 className="text-lg font-semibold">{t('layout.managementPanel')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1 sm:flex">
              {languageSettings.activeLanguages.map((languageCode) => (
                <button
                  key={languageCode}
                  type="button"
                  className={`btn btn-xs ${currentLanguage === languageCode ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => switchLanguage(languageCode)}
                >
                  <FlagIcon language={languageCode} className="h-3.5 w-5 rounded-xs" />
                </button>
              ))}
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{session.name}</p>
              <p className="text-xs opacity-70">{roleLabel}</p>
            </div>
            <button type="button" onClick={onLogout} className="btn btn-outline btn-sm">
              {t('common.logout')}
            </button>
          </div>
        </header>

        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <div className="drawer-side z-20">
        <label htmlFor="main-sidebar" className="drawer-overlay" />
        <aside
          className={`min-h-full border-r border-base-300 bg-base-100 transition-all ${
            collapsed ? 'w-20' : 'w-72'
          }`}
        >
          <div className="flex h-16 items-center justify-between border-b border-base-300 px-4">
            <div
              className={`flex min-w-0 items-center gap-2 leading-tight ${collapsed ? 'cursor-pointer' : ''}`}
              onClick={collapsed ? () => setCollapsed(false) : undefined}
              onKeyDown={
                collapsed
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setCollapsed(false)
                      }
                    }
                  : undefined
              }
              role={collapsed ? 'button' : undefined}
              tabIndex={collapsed ? 0 : undefined}
              aria-label={collapsed ? t('layout.expandMenu') : undefined}
            >
              {projectSettings.logoUrl ? (
                <img src={projectSettings.logoUrl} alt={projectSettings.projectName} className="h-8 w-8 shrink-0 object-contain" />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-base-300 text-xs font-semibold">
                  {projectSettings.projectName.slice(0, 1).toUpperCase()}
                </div>
              )}
              {!collapsed && (
                <p className="truncate text-xs uppercase tracking-wide opacity-60">{projectSettings.projectName}</p>
              )}
            </div>
            {!collapsed && (
              <button
                type="button"
                className="btn btn-ghost btn-square hidden lg:inline-flex"
                onClick={() => setCollapsed(true)}
                aria-label={t('layout.collapseMenu')}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
          </div>

          <ul className="menu w-full gap-1 p-3">
            <MenuItem
              to="/app"
              icon={<LayoutDashboard className="h-5 w-5 shrink-0" />}
              label={t('nav.dashboard')}
              collapsed={collapsed}
              exact
            />
            {canAccessUsersPage(session.role) &&
              (session.role !== 'editor-admin' || hasSessionPermission('users.read')) && (
              <>
                <MenuItem
                  to="/app/utenti"
                  icon={<Users className="h-5 w-5 shrink-0" />}
                  label={t('nav.users')}
                  collapsed={collapsed}
                />
                <MenuItem
                  to="/app/clienti"
                  icon={<UserCheck className="h-5 w-5 shrink-0" />}
                  label={t('nav.clients')}
                  collapsed={collapsed}
                />
                <MenuItem
                  to="/app/atleti"
                  icon={<CircleUser className="h-5 w-5 shrink-0" />}
                  label={t('nav.athletes')}
                  collapsed={collapsed}
                />
                <MenuItem
                  to="/app/attivita-pagamenti"
                  icon={<Wallet className="h-5 w-5 shrink-0" />}
                  label={t('nav.activitiesPayments')}
                  collapsed={collapsed}
                  activeOnStartsWith={['/app/storico-attivita']}
                />
              </>
            )}
            {canAccessPackages(session.role) &&
              (session.role !== 'editor-admin' || hasSessionPermission('packages.manage')) && (
                <MenuItem
                  to="/app/pacchetti"
                  icon={<Package className="h-5 w-5 shrink-0" />}
                  label={t('nav.packages')}
                  collapsed={collapsed}
                />
              )}
            {canAccessPackages(session.role) &&
              (session.role !== 'editor-admin' || hasSessionPermission('packages.manage')) && (
                <MenuItem
                  to="/app/sito"
                  icon={<Globe className="h-5 w-5 shrink-0" />}
                  label={t('nav.site')}
                  collapsed={collapsed}
                />
              )}
            {canAccessUtility(session.role) && (
              <>
                {collapsed ? (
                  <>
                    <MenuItem
                      to="/app/utility/categorie"
                      icon={<Tag className="h-5 w-5 shrink-0" />}
                      label={t('nav.utilityCategories')}
                      collapsed={collapsed}
                    />
                    <MenuItem
                      to="/app/utility/aziende"
                      icon={<Building2 className="h-5 w-5 shrink-0" />}
                      label={t('nav.utilityCompanies')}
                      collapsed={collapsed}
                    />
                    <MenuItem
                      to="/app/utility/campi"
                      icon={<Map className="h-5 w-5 shrink-0" />}
                      label={t('nav.utilityFields')}
                      collapsed={collapsed}
                    />
                    <MenuItem
                      to="/app/utility/gruppi"
                      icon={<Users2 className="h-5 w-5 shrink-0" />}
                      label={t('nav.utilityGroups')}
                      collapsed={collapsed}
                    />
                    <MenuItem
                      to="/app/utility/iscrizioni"
                      icon={<ShieldCheck className="h-5 w-5 shrink-0" />}
                      label={t('nav.utilityEnrollments')}
                      collapsed={collapsed}
                    />
                    <MenuItem
                      to="/app/utility/servizi-aggiuntivi"
                      icon={<HandCoins className="h-5 w-5 shrink-0" />}
                      label={t('nav.utilityAdditionalServices')}
                      collapsed={collapsed}
                    />
                    <MenuItem
                      to="/app/utility/metodi-pagamento"
                      icon={<CreditCard className="h-5 w-5 shrink-0" />}
                      label={t('nav.utilityPaymentMethods')}
                      collapsed={collapsed}
                    />
                    <MenuItem
                      to="/app/utility/whatsapp-accounts"
                      icon={<MessageCircle className="h-5 w-5 shrink-0" />}
                      label={t('nav.utilityWhatsAppAccounts')}
                      collapsed={collapsed}
                    />
                  </>
                ) : (
                  <li className="rounded-lg border border-base-300 px-2 py-1">
                    <details>
                      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-1 py-2 hover:bg-base-300">
                        <Boxes className="h-5 w-5 shrink-0" />
                        <span>{t('nav.utility')}</span>
                      </summary>
                      <ul className="mt-1">
                        <li>
                          <NavLink
                            to="/app/utility/categorie"
                            className={({ isActive }) =>
                              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                                isActive ? 'bg-primary text-primary-content' : 'hover:bg-base-300'
                              }`
                            }
                          >
                            <Tag className="h-4 w-4 shrink-0" />
                            {t('nav.utilityCategories')}
                          </NavLink>
                        </li>
                        <li>
                          <NavLink
                            to="/app/utility/aziende"
                            className={({ isActive }) =>
                              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                                isActive ? 'bg-primary text-primary-content' : 'hover:bg-base-300'
                              }`
                            }
                          >
                            <Building2 className="h-4 w-4 shrink-0" />
                            {t('nav.utilityCompanies')}
                          </NavLink>
                        </li>
                        <li>
                          <NavLink
                            to="/app/utility/campi"
                            className={({ isActive }) =>
                              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                                isActive ? 'bg-primary text-primary-content' : 'hover:bg-base-300'
                              }`
                            }
                          >
                            <Map className="h-4 w-4 shrink-0" />
                            {t('nav.utilityFields')}
                          </NavLink>
                        </li>
                        <li>
                          <NavLink
                            to="/app/utility/gruppi"
                            className={({ isActive }) =>
                              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                                isActive ? 'bg-primary text-primary-content' : 'hover:bg-base-300'
                              }`
                            }
                          >
                            <Users2 className="h-4 w-4 shrink-0" />
                            {t('nav.utilityGroups')}
                          </NavLink>
                        </li>
                        <li>
                          <NavLink
                            to="/app/utility/iscrizioni"
                            className={({ isActive }) =>
                              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                                isActive ? 'bg-primary text-primary-content' : 'hover:bg-base-300'
                              }`
                            }
                          >
                            <ShieldCheck className="h-4 w-4 shrink-0" />
                            {t('nav.utilityEnrollments')}
                          </NavLink>
                        </li>
                        <li>
                          <NavLink
                            to="/app/utility/servizi-aggiuntivi"
                            className={({ isActive }) =>
                              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                                isActive ? 'bg-primary text-primary-content' : 'hover:bg-base-300'
                              }`
                            }
                          >
                            <HandCoins className="h-4 w-4 shrink-0" />
                            {t('nav.utilityAdditionalServices')}
                          </NavLink>
                        </li>
                        <li>
                          <NavLink
                            to="/app/utility/metodi-pagamento"
                            className={({ isActive }) =>
                              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                                isActive ? 'bg-primary text-primary-content' : 'hover:bg-base-300'
                              }`
                            }
                          >
                            <CreditCard className="h-4 w-4 shrink-0" />
                            {t('nav.utilityPaymentMethods')}
                          </NavLink>
                        </li>
                        <li>
                          <NavLink
                            to="/app/utility/whatsapp-accounts"
                            className={({ isActive }) =>
                              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                                isActive ? 'bg-primary text-primary-content' : 'hover:bg-base-300'
                              }`
                            }
                          >
                            <MessageCircle className="h-4 w-4 shrink-0" />
                            {t('nav.utilityWhatsAppAccounts')}
                          </NavLink>
                        </li>
                      </ul>
                    </details>
                  </li>
                )}
                {canAccessConfiguration(session.role) && (
                  <MenuItem
                    to="/app/configurazione"
                    icon={<Settings className="h-5 w-5 shrink-0" />}
                    label={t('nav.configuration')}
                    collapsed={collapsed}
                  />
                )}
              </>
            )}
          </ul>
        </aside>
      </div>
    </div>
  )
}

export default ManagementLayout
