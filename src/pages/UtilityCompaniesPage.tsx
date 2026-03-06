import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { SquarePen, Trash2 } from 'lucide-react'
import DataTable from '../components/DataTable'
import RichTextEditor from '../components/RichTextEditor'
import {
  createCompany,
  getCompanies,
  getPackageCatalogChangedEventName,
  removeCompany,
  updateCompany,
  type Company,
  type SaveCompanyPayload,
} from '../lib/package-catalog'

type ConsentTab = 'minors' | 'adults' | 'information' | 'data-processing'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('file_read_error'))
    reader.readAsDataURL(file)
  })
}

function buildEmptyDraft(): SaveCompanyPayload {
  return {
    title: '',
    headquartersAddress: '',
    headquartersCity: '',
    headquartersPostalCode: '',
    headquartersProvince: '',
    headquartersCountry: 'Italia',
    googlePlaceId: '',
    phone: '',
    vatNumber: '',
    iban: '',
    pecEmail: '',
    sdiCode: '',
    legalForm: '',
    registrationNumber: '',
    federationAffiliation: '',
    legalRepresentativeFirstName: '',
    legalRepresentativeLastName: '',
    legalRepresentativeTaxCode: '',
    legalRepresentativeRole: '',
    contractSignaturePlace: '',
    contractSignerDisplayName: '',
    delegateSignatureDataUrl: '',
    paypalEnabled: false,
    paypalClientId: '',
    email: '',
    consentMinors: '',
    consentAdults: '',
    consentInformationNotice: '',
    consentDataProcessing: '',
  }
}

function UtilityCompaniesPage() {
  const { t } = useTranslation()
  const [companies, setCompanies] = useState<Company[]>(() => getCompanies())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeConsentTab, setActiveConsentTab] = useState<ConsentTab>('minors')
  const [draft, setDraft] = useState<SaveCompanyPayload>(() => buildEmptyDraft())
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const packageCatalogEvent = getPackageCatalogChangedEventName()

  useEffect(() => {
    const handleCatalogChange = () => {
      setCompanies(getCompanies())
    }
    window.addEventListener(packageCatalogEvent, handleCatalogChange)
    return () => window.removeEventListener(packageCatalogEvent, handleCatalogChange)
  }, [packageCatalogEvent])

  const openCreateModal = () => {
    setDraft(buildEmptyDraft())
    setModalMode('create')
    setEditingId(null)
    setActiveConsentTab('minors')
    setIsModalOpen(true)
  }

  const openEditModal = useCallback((company: Company) => {
    setDraft({
      title: company.title,
      headquartersAddress: company.headquartersAddress,
      headquartersCity: company.headquartersCity,
      headquartersPostalCode: company.headquartersPostalCode,
      headquartersProvince: company.headquartersProvince,
      headquartersCountry: company.headquartersCountry,
      googlePlaceId: company.googlePlaceId,
      phone: company.phone,
      vatNumber: company.vatNumber,
      iban: company.iban,
      pecEmail: company.pecEmail,
      sdiCode: company.sdiCode,
      legalForm: company.legalForm,
      registrationNumber: company.registrationNumber,
      federationAffiliation: company.federationAffiliation,
      legalRepresentativeFirstName: company.legalRepresentativeFirstName,
      legalRepresentativeLastName: company.legalRepresentativeLastName,
      legalRepresentativeTaxCode: company.legalRepresentativeTaxCode,
      legalRepresentativeRole: company.legalRepresentativeRole,
      contractSignaturePlace: company.contractSignaturePlace,
      contractSignerDisplayName: company.contractSignerDisplayName,
      delegateSignatureDataUrl: company.delegateSignatureDataUrl,
      paypalEnabled: company.paypalEnabled,
      paypalClientId: company.paypalClientId,
      email: company.email,
      consentMinors: company.consentMinors,
      consentAdults: company.consentAdults,
      consentInformationNotice: company.consentInformationNotice,
      consentDataProcessing: company.consentDataProcessing,
    })
    setModalMode('edit')
    setEditingId(company.id)
    setActiveConsentTab('minors')
    setIsModalOpen(true)
  }, [])

  const applyCompanyError = useCallback((
    error:
      | 'invalid'
      | 'invalidIban'
      | 'invalidEmail'
      | 'paypalClientIdRequired'
      | 'notFound'
      | 'companyInUse',
  ) => {
    setIsError(true)
    if (error === 'invalidIban') {
      setMessage(t('utility.companies.invalidIban'))
      return
    }
    if (error === 'invalidEmail') {
      setMessage(t('utility.companies.invalidEmail'))
      return
    }
    if (error === 'paypalClientIdRequired') {
      setMessage(t('utility.companies.paypalClientIdRequired'))
      return
    }
    if (error === 'companyInUse') {
      setMessage(t('utility.companies.companyInUse'))
      return
    }
    setMessage(t('utility.companies.invalidData'))
  }, [t])

  const handleSubmit = () => {
    const result =
      modalMode === 'create'
        ? createCompany(draft)
        : editingId
          ? updateCompany(editingId, draft)
          : { ok: false as const, error: 'notFound' as const }

    if (!result.ok) {
      applyCompanyError(result.error)
      return
    }

    setCompanies(getCompanies())
    setIsError(false)
    setMessage(modalMode === 'create' ? t('utility.companies.created') : t('utility.companies.updated'))
    setIsModalOpen(false)
  }

  const handleDelete = useCallback((company: Company) => {
    const confirmed = window.confirm(t('utility.companies.confirmDelete', { title: company.title }))
    if (!confirmed) {
      return
    }

    const result = removeCompany(company.id)
    if (!result.ok) {
      applyCompanyError(result.error)
      return
    }

    setCompanies(getCompanies())
    setIsError(false)
    setMessage(t('utility.companies.deleted'))
  }, [applyCompanyError, t])

  const columns = useMemo<ColumnDef<Company>[]>(
    () => [
      {
        id: 'title',
        header: t('utility.companies.titleLabel'),
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        id: 'address',
        header: t('utility.companies.addressLabel'),
        cell: ({ row }) => <span>{row.original.headquartersAddress}</span>,
      },
      {
        id: 'vat',
        header: t('utility.companies.vatLabel'),
        cell: ({ row }) => <span>{row.original.vatNumber}</span>,
      },
      {
        id: 'email',
        header: t('utility.companies.emailLabel'),
        cell: ({ row }) => <span>{row.original.email}</span>,
      },
      {
        id: 'actions',
        header: () => <div className="text-right">{t('utility.categories.actions')}</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm px-1 text-warning"
              onClick={() => openEditModal(row.original)}
              aria-label={t('utility.categories.edit')}
            >
              <SquarePen className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm px-1 text-error"
              onClick={() => handleDelete(row.original)}
              aria-label={t('utility.categories.delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [handleDelete, openEditModal, t],
  )

  const table = useReactTable({
    data: companies,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{t('utility.companies.title')}</h2>
          <p className="text-sm opacity-70">{t('utility.companies.description')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          {t('utility.companies.create')}
        </button>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body space-y-4">
          {message && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                isError ? 'bg-error/15 text-error' : 'bg-success/15 text-success'
              }`}
            >
              {message}
            </p>
          )}

          {companies.length === 0 ? (
            <p className="text-sm opacity-70">{t('utility.companies.empty')}</p>
          ) : (
            <DataTable table={table} />
          )}
        </div>
      </div>

      {isModalOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box w-11/12 max-w-6xl space-y-4">
            <h3 className="text-lg font-semibold">
              {modalMode === 'create' ? t('utility.companies.create') : t('utility.categories.saveEdit')}
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.titleLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.emailLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.email}
                  onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.pecEmailLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.pecEmail}
                  onChange={(event) => setDraft((prev) => ({ ...prev, pecEmail: event.target.value }))}
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.phoneLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.phone}
                  onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </label>

              <label className="form-control md:col-span-2">
                <span className="label-text mb-1 text-xs">{t('utility.companies.addressLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.headquartersAddress}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      headquartersAddress: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.cityLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.headquartersCity}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      headquartersCity: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.postalCodeLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.headquartersPostalCode}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      headquartersPostalCode: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.provinceLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.headquartersProvince}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      headquartersProvince: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.countryLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.headquartersCountry}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      headquartersCountry: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.googleIdentifierLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.googlePlaceId}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      googlePlaceId: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.legalFormLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.legalForm}
                  onChange={(event) => setDraft((prev) => ({ ...prev, legalForm: event.target.value }))}
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.vatLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.vatNumber}
                  onChange={(event) => setDraft((prev) => ({ ...prev, vatNumber: event.target.value }))}
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.ibanLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.iban}
                  onChange={(event) => setDraft((prev) => ({ ...prev, iban: event.target.value }))}
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.sdiCodeLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.sdiCode}
                  onChange={(event) => setDraft((prev) => ({ ...prev, sdiCode: event.target.value }))}
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.registrationNumberLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.registrationNumber}
                  onChange={(event) => setDraft((prev) => ({ ...prev, registrationNumber: event.target.value }))}
                />
              </label>

              <label className="form-control md:col-span-2">
                <span className="label-text mb-1 text-xs">{t('utility.companies.federationAffiliationLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.federationAffiliation}
                  onChange={(event) => setDraft((prev) => ({ ...prev, federationAffiliation: event.target.value }))}
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.legalRepresentativeFirstNameLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.legalRepresentativeFirstName}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, legalRepresentativeFirstName: event.target.value }))
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.legalRepresentativeLastNameLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.legalRepresentativeLastName}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, legalRepresentativeLastName: event.target.value }))
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.legalRepresentativeTaxCodeLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.legalRepresentativeTaxCode}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, legalRepresentativeTaxCode: event.target.value }))
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.legalRepresentativeRoleLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.legalRepresentativeRole}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, legalRepresentativeRole: event.target.value }))
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.contractSignaturePlaceLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.contractSignaturePlace}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, contractSignaturePlace: event.target.value }))
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('utility.companies.contractSignerDisplayNameLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.contractSignerDisplayName}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, contractSignerDisplayName: event.target.value }))
                  }
                />
              </label>
              <label className="form-control md:col-span-2">
                <span className="label-text mb-1 text-xs">{t('utility.companies.delegateSignatureLabel')}</span>
                <input
                  type="file"
                  className="file-input file-input-bordered w-full"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    if (!file) {
                      return
                    }
                    void readFileAsDataUrl(file).then((dataUrl) => {
                      setDraft((prev) => ({ ...prev, delegateSignatureDataUrl: dataUrl }))
                    })
                    event.currentTarget.value = ''
                  }}
                />
                {draft.delegateSignatureDataUrl ? (
                  <div className="mt-2 rounded border border-base-300 p-2">
                    <img
                      src={draft.delegateSignatureDataUrl}
                      alt={t('utility.companies.delegateSignaturePreviewAlt')}
                      className="max-h-24 object-contain"
                    />
                  </div>
                ) : null}
              </label>

              <label className="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300 px-3 py-2">
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={draft.paypalEnabled}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      paypalEnabled: event.target.checked,
                      paypalClientId: event.target.checked ? prev.paypalClientId : '',
                    }))
                  }
                />
                <span className="label-text">{t('utility.companies.paypalLabel')}</span>
              </label>

              {draft.paypalEnabled && (
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('utility.companies.paypalClientIdLabel')}</span>
                  <input
                    className="input input-bordered w-full"
                    value={draft.paypalClientId}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        paypalClientId: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
            </div>

            <div className="tabs tabs-lift">
              <button
                type="button"
                className={`tab ${activeConsentTab === 'minors' ? 'tab-active' : ''}`}
                onClick={() => setActiveConsentTab('minors')}
              >
                {t('utility.companies.tabs.minors')}
              </button>
              <button
                type="button"
                className={`tab ${activeConsentTab === 'adults' ? 'tab-active' : ''}`}
                onClick={() => setActiveConsentTab('adults')}
              >
                {t('utility.companies.tabs.adults')}
              </button>
              <button
                type="button"
                className={`tab ${activeConsentTab === 'information' ? 'tab-active' : ''}`}
                onClick={() => setActiveConsentTab('information')}
              >
                {t('utility.companies.tabs.information')}
              </button>
              <button
                type="button"
                className={`tab ${activeConsentTab === 'data-processing' ? 'tab-active' : ''}`}
                onClick={() => setActiveConsentTab('data-processing')}
              >
                {t('utility.companies.tabs.dataProcessing')}
              </button>
            </div>

            <div className="rounded-lg border border-base-300 p-4">
              {activeConsentTab === 'minors' && (
                <div className="space-y-2">
                  <p className="text-xs">{t('utility.companies.tabs.minors')}</p>
                  <RichTextEditor
                    value={draft.consentMinors}
                    onChange={(nextValue) =>
                      setDraft((prev) => ({
                        ...prev,
                        consentMinors: nextValue,
                      }))
                    }
                    minHeightClassName="min-h-56"
                  />
                </div>
              )}
              {activeConsentTab === 'adults' && (
                <div className="space-y-2">
                  <p className="text-xs">{t('utility.companies.tabs.adults')}</p>
                  <RichTextEditor
                    value={draft.consentAdults}
                    onChange={(nextValue) =>
                      setDraft((prev) => ({
                        ...prev,
                        consentAdults: nextValue,
                      }))
                    }
                    minHeightClassName="min-h-56"
                  />
                </div>
              )}
              {activeConsentTab === 'information' && (
                <div className="space-y-2">
                  <p className="text-xs">{t('utility.companies.tabs.information')}</p>
                  <RichTextEditor
                    value={draft.consentInformationNotice}
                    onChange={(nextValue) =>
                      setDraft((prev) => ({
                        ...prev,
                        consentInformationNotice: nextValue,
                      }))
                    }
                    minHeightClassName="min-h-56"
                  />
                </div>
              )}
              {activeConsentTab === 'data-processing' && (
                <div className="space-y-2">
                  <p className="text-xs">{t('utility.companies.tabs.dataProcessing')}</p>
                  <RichTextEditor
                    value={draft.consentDataProcessing}
                    onChange={(nextValue) =>
                      setDraft((prev) => ({
                        ...prev,
                        consentDataProcessing: nextValue,
                      }))
                    }
                    minHeightClassName="min-h-56"
                  />
                </div>
              )}
            </div>

            <div className="modal-action gap-3">
              <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                {t('utility.categories.cancelEdit')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                {modalMode === 'create' ? t('utility.companies.create') : t('utility.categories.saveEdit')}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            onClick={() => setIsModalOpen(false)}
            aria-label={t('utility.categories.cancelEdit')}
          />
        </dialog>
      )}
    </section>
  )
}

export default UtilityCompaniesPage
