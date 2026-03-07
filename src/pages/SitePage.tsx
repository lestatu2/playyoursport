import { useMemo, useState } from 'react'
import { SquarePen, Trash2 } from 'lucide-react'
import { getPackages } from '../lib/package-catalog'
import {
  getProjectSettings,
  setHomepageSliderEnabledContentTypes,
  setHomepageSliderItems,
  type HomepageSliderItem,
} from '../lib/project-settings'

function SitePage() {
  const [activeTab, setActiveTab] = useState<'settings' | 'slider'>('settings')
  const [settings, setSettings] = useState(() => getProjectSettings())
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Omit<HomepageSliderItem, 'sortOrder' | 'id'>>({
    contentType: 'packages',
    contentId: '',
    isActive: true,
  })
  const [repeaterRows, setRepeaterRows] = useState<Array<{ contentType: 'packages'; contentId: string; isActive: boolean }>>([])

  const packages = useMemo(() => getPackages().filter((item) => item.status !== 'archived'), [])
  const sliderItems = settings.homepageSliderItems
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
  const enabledContentTypes = settings.homepageSliderEnabledContentTypes

  const getAvailableContentOptions = (
    rowIndex: number,
    contentType: 'packages',
  ): Array<{ id: string; label: string }> => {
    if (contentType !== 'packages') {
      return []
    }
    const selectedInOtherRows = new Set(
      repeaterRows
        .filter((_row, index) => index !== rowIndex)
        .map((row) => row.contentId)
        .filter((id) => id.length > 0),
    )
    const alreadyConfigured = new Set(sliderItems.map((item) => item.contentId))
    return packages
      .filter((item) => !selectedInOtherRows.has(item.id) && !alreadyConfigured.has(item.id))
      .map((item) => ({
        id: item.id,
        label: `${item.name} (${item.editionYear})`,
      }))
  }

  const saveSettings = () => {
    setHomepageSliderEnabledContentTypes(settings.homepageSliderEnabledContentTypes)
    setSettings(getProjectSettings())
    setIsError(false)
    setMessage('Impostazioni Sito salvate.')
  }

  const openCreate = () => {
    if (enabledContentTypes.length === 0) {
      setIsError(true)
      setMessage('Abilita almeno un tipo contenuto nelle impostazioni Sito.')
      return
    }
    const initialOptions = getAvailableContentOptions(0, 'packages')
    setEditingId(null)
    setDraft({ contentType: 'packages', contentId: '', isActive: true })
    setRepeaterRows([{ contentType: 'packages', contentId: initialOptions[0]?.id ?? '', isActive: true }])
    setIsError(false)
    setMessage('')
    setIsModalOpen(true)
  }

  const openEdit = (item: HomepageSliderItem) => {
    setEditingId(item.id)
    setDraft({
      contentType: item.contentType,
      contentId: item.contentId,
      isActive: item.isActive,
    })
    setRepeaterRows([])
    setIsModalOpen(true)
  }

  const saveSliderItem = () => {
    const next = [...settings.homepageSliderItems]
    if (editingId) {
      if (!draft.contentId) {
        setIsError(true)
        setMessage('Seleziona un contenuto.')
        return
      }
      const index = next.findIndex((item) => item.id === editingId)
      if (index < 0) {
        setIsError(true)
        setMessage('Elemento slider non trovato.')
        return
      }
      next[index] = { ...next[index], ...draft }
    } else {
      const validRows = repeaterRows.filter((row) => row.contentId)
      if (validRows.length === 0) {
        setIsError(true)
        setMessage('Aggiungi almeno una slide valida.')
        return
      }
      validRows.forEach((row, index) => {
        next.push({
          id: `slider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${index}`,
          contentType: row.contentType,
          contentId: row.contentId,
          isActive: row.isActive,
          sortOrder: next.length + index,
        })
      })
    }
    const normalized = next.map((item, index) => ({ ...item, sortOrder: index }))
    setHomepageSliderItems(normalized)
    setSettings(getProjectSettings())
    setIsModalOpen(false)
    setIsError(false)
    setMessage('Slider homepage aggiornato.')
  }

  const removeSliderItem = (id: string) => {
    const next = settings.homepageSliderItems.filter((item) => item.id !== id).map((item, index) => ({ ...item, sortOrder: index }))
    setHomepageSliderItems(next)
    setSettings(getProjectSettings())
    setIsError(false)
    setMessage('Elemento slider rimosso.')
  }

  const moveSliderItem = (id: string, direction: 'up' | 'down') => {
    const next = sliderItems.slice()
    const index = next.findIndex((item) => item.id === id)
    if (index < 0) {
      return
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= next.length) {
      return
    }
    ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
    setHomepageSliderItems(next.map((item, currentIndex) => ({ ...item, sortOrder: currentIndex })))
    setSettings(getProjectSettings())
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Sito</h2>
        <p className="text-sm opacity-70">Impostazioni frontend pubblico e slider homepage.</p>
      </div>

      <div className="tabs tabs-lift">
        <button
          type="button"
          className={`tab ${activeTab === 'settings' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Impostazioni
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'slider' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('slider')}
        >
          Slider homepage
        </button>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body space-y-4">
          {message && (
            <p className={`rounded-lg px-3 py-2 text-sm ${isError ? 'bg-error/15 text-error' : 'bg-success/15 text-success'}`}>
              {message}
            </p>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="space-y-2 rounded-lg border border-base-300 p-3 max-w-xl">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                  Tipi contenuto disponibili per slider homepage
                </p>
                <label className="label cursor-pointer justify-start gap-2 p-0">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={settings.homepageSliderEnabledContentTypes.includes('packages')}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        homepageSliderEnabledContentTypes: event.target.checked ? ['packages'] : [],
                      }))
                    }
                  />
                  <span className="label-text">Pacchetti</span>
                </label>
              </div>
              <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={saveSettings}>
                Salva
              </button>
            </div>
          )}

          {activeTab === 'slider' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm opacity-70">Contenuti mostrati nello slider homepage.</p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={openCreate}
                  disabled={enabledContentTypes.length === 0 || packages.length === 0}
                >
                  Aggiungi
                </button>
              </div>
              {packages.length === 0 && (
                <p className="rounded-lg bg-warning/15 px-3 py-2 text-sm text-warning">
                  Nessun pacchetto disponibile. Crea prima almeno un pacchetto attivo.
                </p>
              )}
              {sliderItems.length === 0 ? (
                <p className="text-sm opacity-70">Nessun contenuto configurato.</p>
              ) : (
                <div className="overflow-x-auto">
              <table className="table table-zebra table-sm">
                    <thead>
                      <tr>
                        <th>Ordine</th>
                        <th>Tipo</th>
                        <th>Contenuto</th>
                        <th>Attivo</th>
                        <th className="text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sliderItems.map((item, index) => {
                        const label = item.contentType === 'packages'
                          ? packages.find((pkg) => pkg.id === item.contentId)?.name ?? item.contentId
                          : item.contentId
                        return (
                          <tr key={item.id}>
                            <td>{index + 1}</td>
                            <td>Pacchetti</td>
                            <td>{label}</td>
                            <td>{item.isActive ? 'Si' : 'No'}</td>
                            <td>
                              <div className="flex justify-end gap-1">
                                <button type="button" className="btn btn-ghost btn-xs px-1" onClick={() => moveSliderItem(item.id, 'up')} disabled={index === 0}>Su</button>
                                <button type="button" className="btn btn-ghost btn-xs px-1" onClick={() => moveSliderItem(item.id, 'down')} disabled={index === sliderItems.length - 1}>Giu</button>
                                <button type="button" className="btn btn-ghost btn-sm px-1 text-warning" onClick={() => openEdit(item)}>
                                  <SquarePen className="h-4 w-4" />
                                </button>
                                <button type="button" className="btn btn-ghost btn-sm px-1 text-error" onClick={() => removeSliderItem(item.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-xl space-y-4">
            <h3 className="text-lg font-semibold">{editingId ? 'Modifica slide' : 'Aggiungi slide (repeater)'}</h3>
            {editingId ? (
              <>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">Tipo contenuto</span>
                  <select
                    className="select select-bordered w-full mb-4"
                    value={draft.contentType}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        contentType: event.target.value === 'packages' ? 'packages' : 'packages',
                        contentId: '',
                      }))
                    }
                  >
                    {enabledContentTypes.map((type) => (
                      <option key={type} value={type}>
                        {type === 'packages' ? 'Pacchetti' : type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">Contenuto</span>
                  <select
                    className="select select-bordered w-full mb-4"
                    value={draft.contentId}
                    onChange={(event) => setDraft((prev) => ({ ...prev, contentId: event.target.value }))}
                  >
                    {packages.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.editionYear})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="label cursor-pointer justify-start gap-2 p-0">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={draft.isActive}
                    onChange={(event) => setDraft((prev) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  <span className="label-text">Attivo</span>
                </label>
              </>
            ) : (
              <div className="space-y-3">
                {repeaterRows.map((row, index) => (
                  <div key={`row-${index}`} className="grid items-end gap-3 rounded-lg border border-base-300 p-3 sm:grid-cols-[1fr_auto_auto]">
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">Tipo contenuto</span>
                      <select
                        className="select select-bordered w-full mb-4"
                        value={row.contentType}
                        onChange={(event) => {
                          const nextType = event.target.value === 'packages' ? 'packages' : 'packages'
                          const options = getAvailableContentOptions(index, nextType)
                          setRepeaterRows((prev) =>
                            prev.map((item, rowIndex) =>
                              rowIndex === index
                                ? { ...item, contentType: nextType, contentId: options[0]?.id ?? '' }
                                : item,
                            ),
                          )
                        }}
                      >
                        {enabledContentTypes.map((type) => (
                          <option key={`row-type-${index}-${type}`} value={type}>
                            {type === 'packages' ? 'Pacchetti' : type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">Slide {index + 1}</span>
                      <select
                        className="select select-bordered w-full mb-4"
                        value={row.contentId}
                        onChange={(event) =>
                          setRepeaterRows((prev) =>
                            prev.map((item, rowIndex) =>
                              rowIndex === index ? { ...item, contentId: event.target.value } : item,
                            ),
                          )
                        }
                      >
                        {getAvailableContentOptions(index, row.contentType).length === 0 && (
                          <option value="">
                            {packages.length === 0 ? 'Nessun pacchetto disponibile' : 'Tutti i pacchetti sono già usati nello slider'}
                          </option>
                        )}
                        {getAvailableContentOptions(index, row.contentType).map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="label cursor-pointer justify-start gap-2 p-0 mb-4">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={row.isActive}
                        onChange={(event) =>
                          setRepeaterRows((prev) =>
                            prev.map((item, rowIndex) =>
                              rowIndex === index ? { ...item, isActive: event.target.checked } : item,
                            ),
                          )
                        }
                      />
                      <span className="label-text">Attivo</span>
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm px-1 text-error mb-4"
                      disabled={repeaterRows.length <= 1}
                      onClick={() => setRepeaterRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    const nextIndex = repeaterRows.length
                    const options = getAvailableContentOptions(nextIndex, 'packages')
                    if (options.length === 0) {
                      setIsError(true)
                      setMessage('Non ci sono altre slide disponibili da aggiungere.')
                      return
                    }
                    setRepeaterRows((prev) => [...prev, { contentType: 'packages', contentId: options[0].id, isActive: true }])
                  }}
                >
                  Aggiungi slide
                </button>
              </div>
            )}
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                Annulla
              </button>
              <button type="button" className="btn btn-primary" onClick={saveSliderItem}>
                Salva
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={() => setIsModalOpen(false)} />
        </dialog>
      )}
    </section>
  )
}

export default SitePage
