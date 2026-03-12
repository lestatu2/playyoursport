import { Link, NavLink } from 'react-router-dom'
import { getProjectSettings } from '../lib/project-settings'
import { type PublicSession } from '../lib/auth'

type PublicSiteHeaderProps = {
  transparent?: boolean
  overlay?: boolean
  session: PublicSession | null
  onLogout: () => void
}

function PublicSiteHeader({ transparent = false, overlay = false, session, onLogout }: PublicSiteHeaderProps) {
  const settings = getProjectSettings()

  return (
    <header
      className={`${overlay ? 'absolute inset-x-0 top-0 z-50' : 'sticky top-0 z-40'} ${
        transparent ? '' : 'border-b border-base-300 bg-base-100/95 backdrop-blur'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className={`flex items-center gap-2 ${transparent ? 'text-white' : ''}`}>
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt={settings.projectName} className="h-10 w-10 object-contain" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded bg-base-300 text-sm font-semibold">
              {settings.projectName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="font-semibold">{settings.projectName}</span>
        </Link>
        <nav className="flex items-center gap-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `btn btn-ghost btn-sm ${transparent ? 'text-white hover:bg-white/10' : ''} ${isActive ? 'btn-active' : ''}`
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/pacchetti"
            className={({ isActive }) =>
              `btn btn-ghost btn-sm ${transparent ? 'text-white hover:bg-white/10' : ''} ${isActive ? 'btn-active' : ''}`
            }
          >
            Pacchetti
          </NavLink>
          <NavLink
            to="/open-day"
            className={({ isActive }) =>
              `btn btn-ghost btn-sm ${transparent ? 'text-white hover:bg-white/10' : ''} ${isActive ? 'btn-active' : ''}`
            }
          >
            Open Day
          </NavLink>
          {session ? (
            <button type="button" className={`btn btn-outline btn-sm ${transparent ? 'border-white/60 text-white hover:bg-white/10' : ''}`} onClick={onLogout}>
              Logout
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  )
}

export default PublicSiteHeader
