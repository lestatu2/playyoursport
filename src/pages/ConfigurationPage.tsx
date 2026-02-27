import { useMemo, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import FlagIcon from '../components/FlagIcon'
import {
  clearRoleLabelOverrides,
  getRoleDefinitions,
  getRoleLabels,
  setRoleLabel,
} from '../lib/auth'
import {
  getCurrentLanguage,
  getLanguageSettings,
  saveLanguageSettings,
  setCurrentLanguage,
} from '../lib/language-settings'
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../lib/languages'
import {
  clearProjectLogo,
  getDefaultProjectSettings,
  getProjectSettings,
  setProjectLogo,
  setProjectName,
} from '../lib/project-settings'
import { applyTheme, getAvailableThemes, getStoredTheme } from '../lib/theme'

function ConfigurationPage() {
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState<'users' | 'styling' | 'project' | 'language'>('project')
  const roles = useMemo(() => getRoleDefinitions(), [])
  const themes = useMemo(() => getAvailableThemes(), [])
  const defaults = useMemo(() => getDefaultProjectSettings(), [])
  const [projectDraft, setProjectDraft] = useState(() => getProjectSettings())
  const [languageDraft, setLanguageDraft] = useState(() => getLanguageSettings())
  const [labels, setLabels] = useState<Record<string, string>>(() => getRoleLabels())
  const [selectedTheme, setSelectedTheme] = useState(() => getStoredTheme())
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  const handleUsersSave = () => {
    for (const role of roles) {
      if (!(labels[role.key] ?? '').trim()) {
        setIsError(true)
        setMessage(t('configuration.users.invalidRoleLabel', { role: role.key }))
        return
      }
    }

    for (const role of roles) {
      setRoleLabel(role.key, labels[role.key] ?? '')
    }
    setIsError(false)
    setMessage(t('configuration.users.saved'))
  }

  const handleUsersReset = () => {
    clearRoleLabelOverrides()
    setLabels(getRoleLabels())
    setIsError(false)
    setMessage(t('configuration.users.resetDone'))
  }

  const handleThemeChange = (theme: string) => {
    setSelectedTheme(theme)
    const success = applyTheme(theme)
    if (!success) {
      setIsError(true)
      setMessage(t('configuration.styling.invalidTheme'))
      return
    }
    setIsError(false)
    setMessage(t('configuration.styling.themeApplied', { theme }))
  }

  const handleProjectSave = () => {
    const projectName = projectDraft.projectName.trim()
    const success = setProjectName(projectName)
    if (!success) {
      setIsError(true)
      setMessage(t('configuration.project.invalidName'))
      return
    }

    if (projectDraft.logoUrl.trim()) {
      setProjectLogo(projectDraft.logoUrl)
    } else {
      clearProjectLogo()
    }

    setProjectDraft(getProjectSettings())
    setIsError(false)
    setMessage(t('configuration.project.saved'))
  }

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    if (!file.type.startsWith('image/')) {
      setIsError(true)
      setMessage(t('configuration.project.invalidImage'))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        setIsError(true)
        setMessage(t('configuration.project.uploadError'))
        return
      }
      setProjectDraft((prev) => ({ ...prev, logoUrl: result }))
      setIsError(false)
      setMessage(t('configuration.project.logoLoadedDraft'))
    }
    reader.onerror = () => {
      setIsError(true)
      setMessage(t('configuration.project.uploadError'))
    }
    reader.readAsDataURL(file)
  }

  const handleLogoReset = () => {
    setProjectDraft((prev) => ({ ...prev, logoUrl: '' }))
    setIsError(false)
    setMessage(t('configuration.project.logoRemovedDraft'))
  }

  const handleLanguageToggle = (language: LanguageCode) => {
    setLanguageDraft((prev) => {
      const isActive = prev.activeLanguages.includes(language)
      const nextActive = isActive
        ? prev.activeLanguages.filter((item) => item !== language)
        : [...prev.activeLanguages, language]

      return {
        ...prev,
        activeLanguages: nextActive,
      }
    })
  }

  const handleLanguageSave = () => {
    if (languageDraft.activeLanguages.length === 0) {
      setIsError(true)
      setMessage(t('configuration.language.needOneActive'))
      return
    }

    const normalizedPrimary = languageDraft.activeLanguages.includes(languageDraft.primaryLanguage)
      ? languageDraft.primaryLanguage
      : languageDraft.activeLanguages[0]

    const saved = saveLanguageSettings({
      primaryLanguage: normalizedPrimary,
      activeLanguages: languageDraft.activeLanguages,
    })
    setLanguageDraft(saved)

    const current = getCurrentLanguage()
    if (!saved.activeLanguages.includes(current)) {
      const nextLanguage = setCurrentLanguage(saved.primaryLanguage)
      void i18n.changeLanguage(nextLanguage)
    }

    setIsError(false)
    setMessage(t('configuration.language.saved'))
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">{t('configuration.title')}</h2>
        <p className="text-sm opacity-70">{t('configuration.subtitle')}</p>
      </div>

      <div className="tabs tabs-lift">
        <button
          type="button"
          className={`tab ${activeTab === 'project' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('project')}
        >
          {t('configuration.tabs.project')}
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'users' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          {t('configuration.tabs.users')}
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'styling' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('styling')}
        >
          {t('configuration.tabs.styling')}
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'language' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('language')}
        >
          {t('configuration.tabs.language')}
        </button>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          {message && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                isError ? 'bg-error/15 text-error' : 'bg-success/15 text-success'
              }`}
            >
              {message}
            </p>
          )}

          {activeTab === 'project' && (
            <div className="space-y-4">
              <div>
                <h3 className="card-title text-base">{t('configuration.project.title')}</h3>
              </div>

              <label className="form-control max-w-xl">
                <span className="label-text mb-1 text-xs">{t('configuration.project.nameLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={projectDraft.projectName}
                  onChange={(event) =>
                    setProjectDraft((prev) => ({
                      ...prev,
                      projectName: event.target.value,
                    }))
                  }
                  placeholder={defaults.projectName}
                />
              </label>

              <div className="divider my-2" />

              <div className="space-y-3">
                <span className="label-text text-xs">{t('configuration.project.logoLabel')}</span>
                <div className="flex items-center gap-4 rounded-lg border border-base-300 p-3">
                  {projectDraft.logoUrl ? (
                    <img
                      src={projectDraft.logoUrl}
                      alt={projectDraft.projectName}
                      className="h-12 w-auto rounded object-contain"
                    />
                  ) : (
                    <div className="text-sm opacity-70">{t('configuration.project.noLogo')}</div>
                  )}
                </div>

                <input type="file" className="file-input file-input-bordered w-full max-w-xl" accept="image/*" onChange={handleLogoUpload} />

                <div className="flex gap-2">
                  <button type="button" className="btn btn-outline btn-sm" onClick={handleLogoReset}>
                    {t('configuration.project.removeLogo')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setProjectDraft((prev) => ({
                        ...prev,
                        logoUrl: defaults.logoUrl,
                      }))
                      setIsError(false)
                      setMessage(t('configuration.project.logoDefaultDraft'))
                    }}
                  >
                    {t('common.resetDefault')}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={handleProjectSave}>
                  {t('common.save')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="card-title text-base">{t('configuration.users.title')}</h3>
                <button type="button" className="btn btn-outline btn-sm" onClick={handleUsersReset}>
                  {t('common.resetDefault')}
                </button>
              </div>

              <div className="mt-2 space-y-3">
                {roles.map((role) => (
                  <div
                    key={role.key}
                    className="grid items-end gap-3 rounded-lg border border-base-300 p-4 md:grid-cols-[1fr_1.3fr]"
                  >
                    <div>
                      <p className="text-sm font-semibold">{role.key}</p>
                      <p className="text-xs uppercase tracking-wide opacity-60">{role.area}</p>
                    </div>

                    <label className="form-control w-full">
                      <span className="label-text mb-1 text-xs">{t('configuration.users.roleLabel')}</span>
                      <input
                        className="input input-bordered w-full"
                        value={labels[role.key] ?? ''}
                        onChange={(event) =>
                          setLabels((prev) => ({
                            ...prev,
                            [role.key]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={handleUsersSave}>
                  {t('common.save')}
                </button>
              </div>
            </>
          )}

          {activeTab === 'styling' && (
            <div className="space-y-4">
              <div>
                <h3 className="card-title text-base">{t('configuration.styling.title')}</h3>
              </div>

              <label className="form-control max-w-md">
                <span className="label-text mb-1 text-xs">{t('configuration.styling.themeLabel')}</span>
                <select
                  className="select select-bordered w-full"
                  value={selectedTheme}
                  onChange={(event) => handleThemeChange(event.target.value)}
                >
                  {themes.map((theme) => (
                    <option key={theme} value={theme}>
                      {theme}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {activeTab === 'language' && (
            <div className="space-y-4">
              <div>
                <h3 className="card-title text-base">{t('configuration.language.title')}</h3>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                  {t('configuration.language.activeLanguages')}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {SUPPORTED_LANGUAGES.map((languageCode) => (
                    <label key={languageCode} className="label cursor-pointer justify-start gap-2 rounded-lg border border-base-300 px-3 py-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={languageDraft.activeLanguages.includes(languageCode)}
                        onChange={() => handleLanguageToggle(languageCode)}
                      />
                      <span className="label-text">
                        <span className="inline-flex items-center gap-2">
                          <FlagIcon language={languageCode} />
                          {t(`languages.${languageCode}`)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                  {t('configuration.language.primaryLanguage')}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {SUPPORTED_LANGUAGES.map((languageCode) => (
                    <label
                      key={languageCode}
                      className="label cursor-pointer justify-start gap-2 rounded-lg border border-base-300 px-3 py-2"
                    >
                      <input
                        type="radio"
                        name="primary-language"
                        className="radio radio-sm"
                        checked={languageDraft.primaryLanguage === languageCode}
                        onChange={() =>
                          setLanguageDraft((prev) => ({
                            ...prev,
                            primaryLanguage: languageCode,
                          }))
                        }
                      />
                      <span className="label-text inline-flex items-center gap-2">
                        <FlagIcon language={languageCode} />
                        {t(`languages.${languageCode}`)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={handleLanguageSave}>
                  {t('common.save')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default ConfigurationPage
