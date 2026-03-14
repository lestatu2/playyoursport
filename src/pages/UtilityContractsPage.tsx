import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RichTextEditor from '../components/RichTextEditor'
import {
  type ContractSpecialClause,
  CONTRACT_SUBJECT_TEMPLATE_VARIABLES,
  getProjectSettings,
  setContractEconomicClausesTemplate,
  setContractServicesAdjustmentTemplate,
  setContractSpecialClauses,
  setContractSpecialClausesFormula,
  setContractSubjectTemplate,
} from '../lib/project-settings'

type ContractTab = 'subject' | 'economic' | 'services' | 'special'
type VariableTarget = 'subject' | 'economic' | 'services' | 'special_formula' | `special_clause_${number}`

function nextSpecialClauseId(items: ContractSpecialClause[]): string {
  const next = items.length + 1
  return `special-clause-${next}`
}

function resolveVariableTarget(target: VariableTarget, clausesLength: number): VariableTarget {
  if (!target.startsWith('special_clause_')) {
    return target
  }
  const index = Number(target.replace('special_clause_', ''))
  if (!Number.isInteger(index) || index < 0 || index >= clausesLength) {
    return 'special_formula'
  }
  return target
}

function UtilityContractsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<ContractTab>('subject')
  const [draft, setDraft] = useState(() => getProjectSettings())
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [variableTarget, setVariableTarget] = useState<VariableTarget>('subject')

  const variableTargetOptions = useMemo(() => {
    const base: Array<{ value: VariableTarget; label: string }> = [
      { value: 'subject', label: t('utility.contracts.targets.subject') },
      { value: 'economic', label: t('utility.contracts.targets.economic') },
      { value: 'services', label: t('utility.contracts.targets.services') },
      { value: 'special_formula', label: t('utility.contracts.targets.specialFormula') },
    ]
    draft.contractSpecialClauses.forEach((clause, index) => {
      const suffix = clause.title.trim() ? ` - ${clause.title.trim()}` : ` #${index + 1}`
      base.push({
        value: `special_clause_${index}`,
        label: `${t('utility.contracts.targets.specialClause')}${suffix}`,
      })
    })
    return base
  }, [draft.contractSpecialClauses, t])
  const resolvedVariableTarget = useMemo(
    () => resolveVariableTarget(variableTarget, draft.contractSpecialClauses.length),
    [draft.contractSpecialClauses.length, variableTarget],
  )

  const insertVariableToken = (token: string) => {
    setDraft((prev) => {
      if (resolvedVariableTarget === 'subject') {
        return {
          ...prev,
          contractSubjectTemplate: `${prev.contractSubjectTemplate}${prev.contractSubjectTemplate.trim() ? ' ' : ''}${token}`,
        }
      }
      if (resolvedVariableTarget === 'economic') {
        return {
          ...prev,
          contractEconomicClausesTemplate: `${prev.contractEconomicClausesTemplate}${prev.contractEconomicClausesTemplate.trim() ? ' ' : ''}${token}`,
        }
      }
      if (resolvedVariableTarget === 'services') {
        return {
          ...prev,
          contractServicesAdjustmentTemplate: `${prev.contractServicesAdjustmentTemplate}${prev.contractServicesAdjustmentTemplate.trim() ? ' ' : ''}${token}`,
        }
      }
      if (resolvedVariableTarget === 'special_formula') {
        return {
          ...prev,
          contractSpecialClausesFormula: `${prev.contractSpecialClausesFormula}${prev.contractSpecialClausesFormula.trim() ? ' ' : ''}${token}`,
        }
      }
      const clauseIndex = Number(resolvedVariableTarget.replace('special_clause_', ''))
      if (!Number.isInteger(clauseIndex) || clauseIndex < 0 || clauseIndex >= prev.contractSpecialClauses.length) {
        return prev
      }
      return {
        ...prev,
        contractSpecialClauses: prev.contractSpecialClauses.map((item, index) =>
          index === clauseIndex ? { ...item, text: `${item.text}${item.text.trim() ? ' ' : ''}${token}` } : item,
        ),
      }
    })
  }

  const handleSave = () => {
    if (!draft.contractSubjectTemplate.trim()) {
      setIsError(true)
      setMessage(t('configuration.contract.invalidTemplate'))
      return
    }
    if (!draft.contractEconomicClausesTemplate.trim()) {
      setIsError(true)
      setMessage(t('configuration.contract.invalidEconomicClauses'))
      return
    }
    if (!draft.contractServicesAdjustmentTemplate.trim()) {
      setIsError(true)
      setMessage(t('configuration.contract.invalidServicesClauses'))
      return
    }
    setContractSubjectTemplate(draft.contractSubjectTemplate)
    setContractEconomicClausesTemplate(draft.contractEconomicClausesTemplate)
    setContractServicesAdjustmentTemplate(draft.contractServicesAdjustmentTemplate)
    setContractSpecialClausesFormula(draft.contractSpecialClausesFormula)
    setContractSpecialClauses(draft.contractSpecialClauses)
    setDraft(getProjectSettings())
    setIsError(false)
    setMessage(t('configuration.contract.saved'))
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">{t('utility.contracts.title')}</h2>
        <p className="text-sm opacity-70">{t('utility.contracts.description')}</p>
      </div>

      <div className="tabs tabs-lift">
        <button type="button" className={`tab ${activeTab === 'subject' ? 'tab-active' : ''}`} onClick={() => setActiveTab('subject')}>
          {t('utility.contracts.tabs.subject')}
        </button>
        <button type="button" className={`tab ${activeTab === 'economic' ? 'tab-active' : ''}`} onClick={() => setActiveTab('economic')}>
          {t('utility.contracts.tabs.economic')}
        </button>
        <button type="button" className={`tab ${activeTab === 'services' ? 'tab-active' : ''}`} onClick={() => setActiveTab('services')}>
          {t('utility.contracts.tabs.services')}
        </button>
        <button type="button" className={`tab ${activeTab === 'special' ? 'tab-active' : ''}`} onClick={() => setActiveTab('special')}>
          {t('utility.contracts.tabs.special')}
        </button>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body space-y-4">
          {message ? (
            <p className={`rounded-lg px-3 py-2 text-sm ${isError ? 'bg-error/15 text-error' : 'bg-success/15 text-success'}`}>
              {message}
            </p>
          ) : null}

          {activeTab === 'subject' ? (
            <div className="rounded-lg border border-base-300 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">
                {t('configuration.contract.baseTemplateLabel')}
              </p>
              <RichTextEditor
                value={draft.contractSubjectTemplate}
                onChange={(nextValue) => setDraft((prev) => ({ ...prev, contractSubjectTemplate: nextValue }))}
                minHeightClassName="min-h-56"
              />
            </div>
          ) : null}

          {activeTab === 'economic' ? (
            <div className="rounded-lg border border-base-300 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">
                {t('configuration.contract.economicClausesLabel')}
              </p>
              <RichTextEditor
                value={draft.contractEconomicClausesTemplate}
                onChange={(nextValue) => setDraft((prev) => ({ ...prev, contractEconomicClausesTemplate: nextValue }))}
                minHeightClassName="min-h-56"
              />
            </div>
          ) : null}

          {activeTab === 'services' ? (
            <div className="rounded-lg border border-base-300 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">
                {t('configuration.contract.servicesClausesLabel')}
              </p>
              <RichTextEditor
                value={draft.contractServicesAdjustmentTemplate}
                onChange={(nextValue) => setDraft((prev) => ({ ...prev, contractServicesAdjustmentTemplate: nextValue }))}
                minHeightClassName="min-h-56"
              />
            </div>
          ) : null}

          {activeTab === 'special' ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-base-300 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">
                  {t('utility.contracts.specialFormula')}
                </p>
                <RichTextEditor
                  value={draft.contractSpecialClausesFormula}
                  onChange={(nextValue) => setDraft((prev) => ({ ...prev, contractSpecialClausesFormula: nextValue }))}
                  minHeightClassName="min-h-32"
                />
              </div>

              <div className="rounded-lg border border-base-300 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{t('utility.contracts.specialList')}</p>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        contractSpecialClauses: [
                          ...prev.contractSpecialClauses,
                          { id: nextSpecialClauseId(prev.contractSpecialClauses), title: '', text: '', isActive: true },
                        ],
                      }))
                    }
                  >
                    {t('utility.contracts.addSpecial')}
                  </button>
                </div>
                {draft.contractSpecialClauses.length === 0 ? (
                  <p className="text-sm opacity-70">{t('utility.contracts.emptySpecial')}</p>
                ) : (
                  <div className="space-y-3">
                    {draft.contractSpecialClauses.map((clause, index) => (
                      <div key={`${clause.id}-${index}`} className="rounded border border-base-300 p-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="form-control">
                            <span className="label-text mb-1 text-xs">{t('utility.contracts.specialTitle')}</span>
                            <input
                              className="input input-bordered w-full"
                              value={clause.title}
                              onChange={(event) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  contractSpecialClauses: prev.contractSpecialClauses.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, title: event.target.value } : item,
                                  ),
                                }))
                              }
                            />
                          </label>
                          <label className="label cursor-pointer justify-start gap-2 rounded-lg border border-base-300 px-3 py-2 self-end">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={clause.isActive}
                              onChange={(event) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  contractSpecialClauses: prev.contractSpecialClauses.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, isActive: event.target.checked } : item,
                                  ),
                                }))
                              }
                            />
                            <span className="label-text">{t('utility.contracts.active')}</span>
                          </label>
                        </div>
                        <div className="mt-3">
                          <p className="mb-1 text-xs">{t('utility.contracts.specialText')}</p>
                          <RichTextEditor
                            value={clause.text}
                            onChange={(nextValue) =>
                              setDraft((prev) => ({
                                ...prev,
                                contractSpecialClauses: prev.contractSpecialClauses.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, text: nextValue } : item,
                                ),
                              }))
                            }
                            minHeightClassName="min-h-28"
                          />
                        </div>
                        <div className="mt-3">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-error"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                contractSpecialClauses: prev.contractSpecialClauses.filter((_, itemIndex) => itemIndex !== index),
                              }))
                            }
                          >
                            {t('utility.contracts.removeSpecial')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-base-300 p-3">
            <div className="mb-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.contracts.targetLabel')}</span>
                <select
                  className="select select-bordered w-full"
                  value={resolvedVariableTarget}
                  onChange={(event) => setVariableTarget(event.target.value as VariableTarget)}
                >
                  {variableTargetOptions.map((target) => (
                    <option key={target.value} value={target.value}>
                      {target.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs opacity-70">{t('utility.contracts.targetHint')}</p>
            </div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">
              {t('configuration.contract.variablesLabel')}
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {CONTRACT_SUBJECT_TEMPLATE_VARIABLES.map((variable) => (
                <div key={variable.token} className="rounded border border-base-300 p-2">
                  <p className="font-mono text-xs">{variable.token}</p>
                  <p className="mt-1 text-xs opacity-70">{t(variable.descriptionKey)}</p>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline mt-2"
                    onClick={() => insertVariableToken(variable.token)}
                  >
                    {t('configuration.contract.insertVariable')}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={handleSave}>
              {t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default UtilityContractsPage
