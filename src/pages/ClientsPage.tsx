import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, FileSignature, FileText, ShieldCheck, ShieldX, Wallet } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import {
  createPublicClientRecord,
  createPublicMinorRecord,
  findPublicClientByTaxCode,
  findPublicMinorByTaxCode,
  getPublicClients,
  getPublicMinors,
  updatePublicClientRecord,
  updatePublicClientPrivacyPolicyStatus,
  updatePublicClientValidationStatus,
  updatePublicMinorRecord,
  updatePublicMinorValidationStatus,
  type ParentRole,
  type PublicClientRecord,
  type PublicMinorRecord,
} from '../lib/public-customer-records'
import { getCompanies, getEnrollmentById, getPackages, type SportPackage } from '../lib/package-catalog'
import { getProjectSettings, getProjectSettingsChangedEventName } from '../lib/project-settings'
import { computeItalianTaxCode, findBirthPlaceCodeByName } from '../lib/tax-code'
import { getAvailablePaymentMethodsForCompany, type PaymentMethodCode } from '../lib/payment-methods'
import { upsertCoverageFromEnrollmentPurchase } from '../lib/athlete-enrollment-coverages'
import { downloadConsentsPdf, type ConsentPdfPayload } from '../lib/contract-pdf'
import { getPublicDirectAthletes, type PublicDirectAthleteRecord } from '../lib/public-direct-athletes'
import { getSession } from '../lib/auth'

const GOOGLE_PLACES_SCRIPT_ID = 'pys-google-places-script'

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            inputField: HTMLInputElement,
            options?: {
              fields?: string[]
              types?: string[]
            },
          ) => {
            addListener: (eventName: string, handler: () => void) => void
            getPlace: () => {
              formatted_address?: string
              name?: string
            }
          }
        }
      }
    }
  }
}

function loadGooglePlacesScript(apiKey: string): Promise<void> {
  if (!apiKey.trim()) {
    return Promise.reject(new Error('missing-api-key'))
  }
  if (window.google?.maps?.places) {
    return Promise.resolve()
  }

  const existingScript = document.getElementById(GOOGLE_PLACES_SCRIPT_ID) as HTMLScriptElement | null
  if (existingScript) {
    if (existingScript.dataset.loaded === 'true') {
      if (window.google?.maps?.places) {
        return Promise.resolve()
      }
      return Promise.reject(new Error('google-places-not-available'))
    }
    return new Promise((resolve, reject) => {
      const onLoad = () => resolve()
      const onError = () => reject(new Error('google-places-load-error'))
      existingScript.addEventListener('load', onLoad, { once: true })
      existingScript.addEventListener('error', onError, { once: true })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = GOOGLE_PLACES_SCRIPT_ID
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey.trim())}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => reject(new Error('google-places-load-error'))
    document.head.appendChild(script)
  })
}

function getAgeFromBirthDate(birthDate: string): number | null {
  const value = new Date(birthDate)
  if (Number.isNaN(value.getTime())) {
    return null
  }
  const now = new Date()
  let age = now.getFullYear() - value.getFullYear()
  const monthDiff = now.getMonth() - value.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < value.getDate())) {
    age -= 1
  }
  return age
}

type ClientDraft = Pick<
  PublicClientRecord,
  | 'parentFirstName'
  | 'parentLastName'
  | 'parentEmail'
  | 'parentPhone'
  | 'parentSecondaryPhone'
  | 'parentBirthDate'
  | 'parentBirthPlace'
  | 'parentRole'
  | 'parentTaxCode'
  | 'residenceAddress'
>

type MinorDraft = Pick<
  PublicMinorRecord,
  'firstName' | 'lastName' | 'birthDate' | 'birthPlace' | 'residenceAddress' | 'taxCode'
>

type CreateClientMode = 'parent' | 'athlete'
type CreateParentMinorDraft = {
  packageId: string
  paymentMethodCode: PaymentMethodCode | ''
  parentFirstName: string
  parentLastName: string
  parentEmail: string
  parentPhone: string
  parentSecondaryPhone: string
  parentBirthDate: string
  parentRole: ParentRole
  parentGender: 'M' | 'F'
  parentBirthPlace: string
  parentTaxCode: string
  parentResidenceAddress: string
  minorFirstName: string
  minorLastName: string
  minorBirthDate: string
  minorGender: 'M' | 'F'
  minorBirthPlace: string
  minorTaxCode: string
  minorResidenceAddress: string
}
type AddMinorDraft = {
  packageId: string
  paymentMethodCode: PaymentMethodCode | ''
  firstName: string
  lastName: string
  birthDate: string
  gender: 'M' | 'F'
  birthPlace: string
  taxCode: string
  residenceAddress: string
}

const emptyCreateParentMinorDraft: CreateParentMinorDraft = {
  packageId: '',
  paymentMethodCode: '',
  parentFirstName: '',
  parentLastName: '',
  parentEmail: '',
  parentPhone: '',
  parentSecondaryPhone: '',
  parentBirthDate: '',
  parentRole: 'genitore',
  parentGender: 'F',
  parentBirthPlace: '',
  parentTaxCode: '',
  parentResidenceAddress: '',
  minorFirstName: '',
  minorLastName: '',
  minorBirthDate: '',
  minorGender: 'M',
  minorBirthPlace: '',
  minorTaxCode: '',
  minorResidenceAddress: '',
}
const emptyAddMinorDraft: AddMinorDraft = {
  packageId: '',
  paymentMethodCode: '',
  firstName: '',
  lastName: '',
  birthDate: '',
  gender: 'M',
  birthPlace: '',
  taxCode: '',
  residenceAddress: '',
}

const PARENT_ROLE_OPTIONS: Array<{ value: ParentRole; label: string }> = [
  { value: 'genitore', label: 'Genitore' },
  { value: 'tutore', label: 'Tutore' },
  { value: 'esercente_responsabilita', label: 'Esercente responsabilita' },
]

type ClientExportFormat = 'xlsx' | 'pdf' | 'docx'

type ClientExportFieldKey =
  | 'clientId'
  | 'createdAt'
  | 'parentFirstName'
  | 'parentLastName'
  | 'parentEmail'
  | 'parentPhone'
  | 'parentSecondaryPhone'
  | 'parentBirthDate'
  | 'parentBirthPlace'
  | 'parentRole'
  | 'parentTaxCode'
  | 'residenceAddress'
  | 'validationStatus'
  | 'privacyPolicySigned'
  | 'consentEnrollmentAccepted'
  | 'consentInformationAccepted'
  | 'consentDataProcessingAccepted'
  | 'consentDataProcessingSignaturePresent'
  | 'enrollmentConfirmationSignaturePresent'
  | 'parentTaxCodeDocumentPresent'
  | 'parentIdentityDocumentPresent'
  | 'linkedMinorsCount'
  | 'linkedMinorsSummary'
  | 'linkedMinorsValidation'
  | 'linkedDirectAthletes'

const CLIENT_EXPORT_FIELDS: ClientExportFieldKey[] = [
  'clientId',
  'createdAt',
  'parentFirstName',
  'parentLastName',
  'parentEmail',
  'parentPhone',
  'parentSecondaryPhone',
  'parentBirthDate',
  'parentBirthPlace',
  'parentRole',
  'parentTaxCode',
  'residenceAddress',
  'validationStatus',
  'privacyPolicySigned',
  'consentEnrollmentAccepted',
  'consentInformationAccepted',
  'consentDataProcessingAccepted',
  'consentDataProcessingSignaturePresent',
  'enrollmentConfirmationSignaturePresent',
  'parentTaxCodeDocumentPresent',
  'parentIdentityDocumentPresent',
  'linkedMinorsCount',
  'linkedMinorsSummary',
  'linkedMinorsValidation',
  'linkedDirectAthletes',
]

function ClientDocumentPreview({ dataUrl }: { dataUrl: string }) {
  if (!dataUrl) {
    return <p className="text-sm opacity-70">-</p>
  }
  if (dataUrl.startsWith('data:image')) {
    return <img src={dataUrl} alt="" className="max-h-64 rounded border border-base-300 object-contain" />
  }
  return (
    <a className="link link-primary text-sm" href={dataUrl} target="_blank" rel="noreferrer">
      Apri documento
    </a>
  )
}

function isClientPrivacyPolicySigned(client: PublicClientRecord): boolean {
  return Boolean(client.privacyPolicySigned)
}

function resolveValidPaymentMethodCode(
  requested: PaymentMethodCode | '',
  available: Array<{ code: PaymentMethodCode }>,
): PaymentMethodCode | '' {
  if (requested && available.some((item) => item.code === requested)) {
    return requested
  }
  return available[0]?.code ?? ''
}

function ClientsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lockedClientIdParam = searchParams.get('clientId')
  const lockedClientId = lockedClientIdParam && /^\d+$/.test(lockedClientIdParam)
    ? Number(lockedClientIdParam)
    : null
  const [clients, setClients] = useState<PublicClientRecord[]>(() => getPublicClients())
  const [minors, setMinors] = useState<PublicMinorRecord[]>(() => getPublicMinors())
  const [directAthletes, setDirectAthletes] = useState<PublicDirectAthleteRecord[]>(() => getPublicDirectAthletes())
  const [message, setMessage] = useState('')
  const [activeClientId, setActiveClientId] = useState<number | null>(null)
  const [clientDraft, setClientDraft] = useState<ClientDraft | null>(null)
  const [minorDrafts, setMinorDrafts] = useState<Record<number, MinorDraft>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'validated' | 'not_validated'>('all')
  const [privacyFilter, setPrivacyFilter] = useState<'all' | 'signed' | 'not_signed'>('all')
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ClientExportFormat>('xlsx')
  const [selectedExportFields, setSelectedExportFields] = useState<ClientExportFieldKey[]>(CLIENT_EXPORT_FIELDS)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createMode, setCreateMode] = useState<CreateClientMode>('parent')
  const [createDraft, setCreateDraft] = useState<CreateParentMinorDraft>(emptyCreateParentMinorDraft)
  const [createError, setCreateError] = useState('')
  const [isAddMinorModalOpen, setIsAddMinorModalOpen] = useState(false)
  const [addMinorDraft, setAddMinorDraft] = useState<AddMinorDraft>(emptyAddMinorDraft)
  const [addMinorError, setAddMinorError] = useState('')
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState(() => getProjectSettings().googleMapsApiKey || '')
  const parentBirthPlaceRef = useRef<HTMLInputElement | null>(null)
  const parentResidenceRef = useRef<HTMLInputElement | null>(null)
  const minorBirthPlaceRef = useRef<HTMLInputElement | null>(null)
  const minorResidenceRef = useRef<HTMLInputElement | null>(null)
  const addMinorBirthPlaceRef = useRef<HTMLInputElement | null>(null)
  const addMinorResidenceRef = useRef<HTMLInputElement | null>(null)
  const parentBirthPlaceInitializedRef = useRef(false)
  const parentResidenceInitializedRef = useRef(false)
  const minorBirthPlaceInitializedRef = useRef(false)
  const minorResidenceInitializedRef = useRef(false)
  const addMinorBirthPlaceInitializedRef = useRef(false)
  const addMinorResidenceInitializedRef = useRef(false)
  const session = useMemo(() => getSession(), [])
  const isSuperAdministrator = session?.role === 'super-administrator'
  const availableClientExportFields = useMemo(
    () => (isSuperAdministrator ? CLIENT_EXPORT_FIELDS : CLIENT_EXPORT_FIELDS.filter((field) => field !== 'clientId')),
    [isSuperAdministrator],
  )
  const effectiveSelectedExportFields = useMemo(
    () => selectedExportFields.filter((field) => isSuperAdministrator || field !== 'clientId'),
    [isSuperAdministrator, selectedExportFields],
  )

  const youthPackages = useMemo(
    () =>
      getPackages().filter((item) => item.audience === 'youth' && item.status === 'published'),
    [],
  )
  const selectedCreatePackage = useMemo(
    () => youthPackages.find((item) => item.id === createDraft.packageId) ?? null,
    [createDraft.packageId, youthPackages],
  )
  const selectedAddMinorPackage = useMemo(
    () => youthPackages.find((item) => item.id === addMinorDraft.packageId) ?? null,
    [addMinorDraft.packageId, youthPackages],
  )
  const createPaymentMethods = useMemo(() => {
    if (!selectedCreatePackage) {
      return []
    }
    return getAvailablePaymentMethodsForCompany(selectedCreatePackage.companyId)
  }, [selectedCreatePackage])
  const addMinorPaymentMethods = useMemo(() => {
    if (!selectedAddMinorPackage) {
      return []
    }
    return getAvailablePaymentMethodsForCompany(selectedAddMinorPackage.companyId)
  }, [selectedAddMinorPackage])
  const resolvePaymentMethodForPackage = useCallback(
    (packageId: string, currentCode: PaymentMethodCode | ''): PaymentMethodCode | '' => {
      const packageItem = youthPackages.find((item) => item.id === packageId) ?? null
      const methods = packageItem ? getAvailablePaymentMethodsForCompany(packageItem.companyId) : []
      return resolveValidPaymentMethodCode(currentCode, methods)
    },
    [youthPackages],
  )
  const renderPaymentMethodOptions = useCallback(
    (methods: ReturnType<typeof getAvailablePaymentMethodsForCompany>) => {
      if (methods.length === 0) {
        return <option value="">{t('clients.noPaymentMethods')}</option>
      }
      return methods.map((item) => (
        <option key={item.code} value={item.code}>
          {t(`utility.paymentMethods.methods.${item.code}.label`)}
        </option>
      ))
    },
    [t],
  )

  useEffect(() => {
    const settingsEvent = getProjectSettingsChangedEventName()
    const handleSettingsChange = () => {
      setGoogleMapsApiKey(getProjectSettings().googleMapsApiKey || '')
    }
    window.addEventListener(settingsEvent, handleSettingsChange)
    return () => window.removeEventListener(settingsEvent, handleSettingsChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!isCreateModalOpen || createMode !== 'parent') {
      return () => {
        cancelled = true
      }
    }
    const updateParentTaxCode = async () => {
      const birthPlaceCode = await findBirthPlaceCodeByName(createDraft.parentBirthPlace)
      if (cancelled || !birthPlaceCode) {
        return
      }
      const computed = computeItalianTaxCode({
        firstName: createDraft.parentFirstName,
        lastName: createDraft.parentLastName,
        birthDate: createDraft.parentBirthDate,
        gender: createDraft.parentGender,
        birthPlaceCode,
      })
      if (!computed) {
        return
      }
      setCreateDraft((prev) => (prev.parentTaxCode === computed ? prev : { ...prev, parentTaxCode: computed }))
    }
    void updateParentTaxCode()
    return () => {
      cancelled = true
    }
  }, [
    createDraft.parentBirthDate,
    createDraft.parentBirthPlace,
    createDraft.parentFirstName,
    createDraft.parentGender,
    createDraft.parentLastName,
    createMode,
    isCreateModalOpen,
  ])

  useEffect(() => {
    let cancelled = false
    if (!isAddMinorModalOpen || activeClientId === null) {
      return () => {
        cancelled = true
      }
    }
    const updateAddMinorTaxCode = async () => {
      const birthPlaceCode = await findBirthPlaceCodeByName(addMinorDraft.birthPlace)
      if (cancelled || !birthPlaceCode) {
        return
      }
      const computed = computeItalianTaxCode({
        firstName: addMinorDraft.firstName,
        lastName: addMinorDraft.lastName,
        birthDate: addMinorDraft.birthDate,
        gender: addMinorDraft.gender,
        birthPlaceCode,
      })
      if (!computed) {
        return
      }
      setAddMinorDraft((prev) => (prev.taxCode === computed ? prev : { ...prev, taxCode: computed }))
    }
    void updateAddMinorTaxCode()
    return () => {
      cancelled = true
    }
  }, [
    activeClientId,
    addMinorDraft.birthDate,
    addMinorDraft.birthPlace,
    addMinorDraft.firstName,
    addMinorDraft.gender,
    addMinorDraft.lastName,
    isAddMinorModalOpen,
  ])

  useEffect(() => {
    let cancelled = false
    if (!isCreateModalOpen || createMode !== 'parent') {
      return () => {
        cancelled = true
      }
    }
    const updateMinorTaxCode = async () => {
      const birthPlaceCode = await findBirthPlaceCodeByName(createDraft.minorBirthPlace)
      if (cancelled || !birthPlaceCode) {
        return
      }
      const computed = computeItalianTaxCode({
        firstName: createDraft.minorFirstName,
        lastName: createDraft.minorLastName,
        birthDate: createDraft.minorBirthDate,
        gender: createDraft.minorGender,
        birthPlaceCode,
      })
      if (!computed) {
        return
      }
      setCreateDraft((prev) => (prev.minorTaxCode === computed ? prev : { ...prev, minorTaxCode: computed }))
    }
    void updateMinorTaxCode()
    return () => {
      cancelled = true
    }
  }, [
    createDraft.minorBirthDate,
    createDraft.minorBirthPlace,
    createDraft.minorFirstName,
    createDraft.minorGender,
    createDraft.minorLastName,
    createMode,
    isCreateModalOpen,
  ])

  const initializeAutocomplete = useCallback(
    (
      inputElement: HTMLInputElement | null,
      initializedRef: { current: boolean },
      types: string[],
      onPlaceResolved: (value: string) => void,
    ) => {
      if ((!isCreateModalOpen && !isAddMinorModalOpen) || initializedRef.current || !inputElement || !googleMapsApiKey.trim()) {
        return
      }
      loadGooglePlacesScript(googleMapsApiKey)
        .then(() => {
          if (!window.google?.maps?.places || initializedRef.current) {
            return
          }
          const autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
            fields: ['formatted_address', 'name'],
            types,
          })
          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace()
            const value = (place.formatted_address ?? place.name ?? inputElement.value ?? '').trim()
            if (!value) {
              return
            }
            onPlaceResolved(value)
          })
          initializedRef.current = true
        })
        .catch(() => {
          initializedRef.current = false
        })
    },
    [googleMapsApiKey, isAddMinorModalOpen, isCreateModalOpen],
  )

  const initializeParentBirthPlaceAutocomplete = useCallback(() => {
    initializeAutocomplete(parentBirthPlaceRef.current, parentBirthPlaceInitializedRef, ['(cities)'], (value) =>
      setCreateDraft((prev) => ({ ...prev, parentBirthPlace: value })),
    )
  }, [initializeAutocomplete])

  const initializeParentResidenceAutocomplete = useCallback(() => {
    initializeAutocomplete(parentResidenceRef.current, parentResidenceInitializedRef, ['address'], (value) =>
      setCreateDraft((prev) => ({ ...prev, parentResidenceAddress: value })),
    )
  }, [initializeAutocomplete])

  const initializeMinorBirthPlaceAutocomplete = useCallback(() => {
    initializeAutocomplete(minorBirthPlaceRef.current, minorBirthPlaceInitializedRef, ['(cities)'], (value) =>
      setCreateDraft((prev) => ({ ...prev, minorBirthPlace: value })),
    )
  }, [initializeAutocomplete])

  const initializeMinorResidenceAutocomplete = useCallback(() => {
    initializeAutocomplete(minorResidenceRef.current, minorResidenceInitializedRef, ['address'], (value) =>
      setCreateDraft((prev) => ({ ...prev, minorResidenceAddress: value })),
    )
  }, [initializeAutocomplete])

  const initializeAddMinorBirthPlaceAutocomplete = useCallback(() => {
    initializeAutocomplete(addMinorBirthPlaceRef.current, addMinorBirthPlaceInitializedRef, ['(cities)'], (value) =>
      setAddMinorDraft((prev) => ({ ...prev, birthPlace: value })),
    )
  }, [initializeAutocomplete])

  const initializeAddMinorResidenceAutocomplete = useCallback(() => {
    initializeAutocomplete(addMinorResidenceRef.current, addMinorResidenceInitializedRef, ['address'], (value) =>
      setAddMinorDraft((prev) => ({ ...prev, residenceAddress: value })),
    )
  }, [initializeAutocomplete])

  const minorsByClientId = useMemo(() => {
    const map = new Map<number, PublicMinorRecord[]>()
    minors.forEach((minor) => {
      const current = map.get(minor.clientId) ?? []
      map.set(minor.clientId, [...current, minor])
    })
    return map
  }, [minors])
  const directAthletesByClientId = useMemo(() => {
    const map = new Map<number, PublicDirectAthleteRecord[]>()
    directAthletes.forEach((athlete) => {
      if (athlete.clientId === null) {
        return
      }
      const current = map.get(athlete.clientId) ?? []
      map.set(athlete.clientId, [...current, athlete])
    })
    return map
  }, [directAthletes])
  const packagesById = useMemo(() => new Map(getPackages().map((item) => [item.id, item])), [])
  const companiesById = useMemo(() => new Map(getCompanies().map((item) => [item.id, item])), [])
  const visibleClients = useMemo(
    () => (lockedClientId === null ? clients : clients.filter((item) => item.id === lockedClientId)),
    [clients, lockedClientId],
  )
  const filteredClients = useMemo(() => {
    return visibleClients.filter((client) => {
      const linkedMinors = minorsByClientId.get(client.id) ?? []
      const searchHaystack = [
        client.parentFirstName,
        client.parentLastName,
        client.parentEmail,
        client.parentPhone,
        client.parentSecondaryPhone,
        client.parentTaxCode,
        client.parentBirthPlace,
        client.residenceAddress,
        ...linkedMinors.map((minor) => `${minor.firstName} ${minor.lastName}`),
      ]
        .join(' ')
        .toLowerCase()

      if (searchTerm.trim() && !searchHaystack.includes(searchTerm.trim().toLowerCase())) {
        return false
      }
      if (statusFilter !== 'all' && client.validationStatus !== statusFilter) {
        return false
      }
      const isPrivacySigned = isClientPrivacyPolicySigned(client)
      if (privacyFilter === 'signed' && !isPrivacySigned) {
        return false
      }
      return privacyFilter !== 'not_signed' || !isPrivacySigned
    })
  }, [minorsByClientId, privacyFilter, searchTerm, statusFilter, visibleClients])

  const exportFieldLabel = useCallback((field: ClientExportFieldKey): string => {
    switch (field) {
      case 'clientId':
        return 'ID cliente'
      case 'createdAt':
        return 'Data creazione'
      case 'parentFirstName':
        return t('clients.parentFirstName')
      case 'parentLastName':
        return t('clients.parentLastName')
      case 'parentEmail':
        return t('clients.email')
      case 'parentPhone':
        return t('clients.phone')
      case 'parentSecondaryPhone':
        return t('clients.secondaryPhone')
      case 'parentBirthDate':
        return t('clients.birthDate')
      case 'parentBirthPlace':
        return t('clients.birthPlace')
      case 'parentRole':
        return 'Ruolo firmatario'
      case 'parentTaxCode':
        return t('clients.taxCode')
      case 'residenceAddress':
        return t('clients.residence')
      case 'validationStatus':
        return t('clients.status')
      case 'privacyPolicySigned':
        return 'Privacy policy firmata'
      case 'consentEnrollmentAccepted':
        return 'Consenso iscrizione'
      case 'consentInformationAccepted':
        return 'Presa visione informativa'
      case 'consentDataProcessingAccepted':
        return 'Consenso trattamento dati'
      case 'consentDataProcessingSignaturePresent':
        return 'Firma trattamento dati presente'
      case 'enrollmentConfirmationSignaturePresent':
        return 'Firma conferma iscrizione presente'
      case 'parentTaxCodeDocumentPresent':
        return 'Documento CF presente'
      case 'parentIdentityDocumentPresent':
        return 'Documento identita presente'
      case 'linkedMinorsCount':
        return t('clients.minorsCount')
      case 'linkedMinorsSummary':
        return 'Dettaglio minori collegati'
      case 'linkedMinorsValidation':
        return 'Stato validazione minori'
      case 'linkedDirectAthletes':
        return 'Atleti adulti collegati'
      default:
        return field
    }
  }, [t])

  const exportRows = useMemo(() => {
    const boolLabel = (value: boolean) => (value ? 'Si' : 'No')
    const roleLabel = (role: ParentRole) => {
      const found = PARENT_ROLE_OPTIONS.find((item) => item.value === role)
      return found?.label ?? role
    }
    const clientStatusLabel = (status: PublicClientRecord['validationStatus']) =>
      status === 'validated' ? t('clients.validated') : t('clients.notValidated')
    const minorStatusLabel = (status: PublicMinorRecord['validationStatus']) =>
      status === 'validated' ? t('clients.validated') : t('clients.notValidated')

    return filteredClients.map((client) => {
      const linkedMinors = minorsByClientId.get(client.id) ?? []
      const linkedDirectAthletes = directAthletesByClientId.get(client.id) ?? []
      const linkedMinorsSummary = linkedMinors.length
        ? linkedMinors
            .map((minor) => {
              const packageItem = packagesById.get(minor.packageId)
              const packageName = packageItem?.name ?? minor.packageId
              return `${minor.firstName} ${minor.lastName} | CF ${minor.taxCode} | Pacchetto ${packageName}`
            })
            .join(' || ')
        : '-'
      const linkedMinorsValidation = linkedMinors.length
        ? linkedMinors
            .map((minor) => `${minor.firstName} ${minor.lastName}: ${minorStatusLabel(minor.validationStatus)}`)
            .join(' | ')
        : '-'
      const linkedDirectAthletesLabel = linkedDirectAthletes.length
        ? linkedDirectAthletes.map((athlete) => `${athlete.firstName} ${athlete.lastName}`).join(' | ')
        : '-'

      const row: Record<ClientExportFieldKey, string> = {
        clientId: String(client.id),
        createdAt: (client.createdAt || '').slice(0, 10),
        parentFirstName: client.parentFirstName,
        parentLastName: client.parentLastName,
        parentEmail: client.parentEmail,
        parentPhone: client.parentPhone,
        parentSecondaryPhone: client.parentSecondaryPhone,
        parentBirthDate: client.parentBirthDate,
        parentBirthPlace: client.parentBirthPlace,
        parentRole: roleLabel(client.parentRole),
        parentTaxCode: client.parentTaxCode,
        residenceAddress: client.residenceAddress,
        validationStatus: clientStatusLabel(client.validationStatus),
        privacyPolicySigned: boolLabel(Boolean(client.privacyPolicySigned)),
        consentEnrollmentAccepted: boolLabel(Boolean(client.consentEnrollmentAccepted)),
        consentInformationAccepted: boolLabel(Boolean(client.consentInformationAccepted)),
        consentDataProcessingAccepted: boolLabel(Boolean(client.consentDataProcessingAccepted)),
        consentDataProcessingSignaturePresent: boolLabel(Boolean(client.consentDataProcessingSignatureDataUrl)),
        enrollmentConfirmationSignaturePresent: boolLabel(Boolean(client.enrollmentConfirmationSignatureDataUrl)),
        parentTaxCodeDocumentPresent: boolLabel(Boolean(client.parentTaxCodeImageDataUrl)),
        parentIdentityDocumentPresent: boolLabel(Boolean(client.parentIdentityDocumentImageDataUrl)),
        linkedMinorsCount: String(linkedMinors.length),
        linkedMinorsSummary,
        linkedMinorsValidation,
        linkedDirectAthletes: linkedDirectAthletesLabel,
      }
      return row
    })
  }, [directAthletesByClientId, filteredClients, minorsByClientId, packagesById, t])

  const toggleExportField = (field: ClientExportFieldKey) => {
    setSelectedExportFields((prev) => (
      prev.includes(field) ? prev.filter((item) => item !== field) : [...prev, field]
    ))
  }

  const exportClientProfiles = async () => {
    if (effectiveSelectedExportFields.length === 0) {
      return
    }
    const headers = effectiveSelectedExportFields.map((field) => exportFieldLabel(field))
    const bodyRows = exportRows.map((row) => effectiveSelectedExportFields.map((field) => row[field]))
    const filenameBase = `clienti-schede-${new Date().toISOString().slice(0, 10)}`

    if (exportFormat === 'xlsx') {
      const records = exportRows.map((row) => {
        const item: Record<string, string> = {}
        effectiveSelectedExportFields.forEach((field, index) => {
          item[headers[index]] = row[field]
        })
        return item
      })
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Clienti')
      worksheet.columns = headers.map((header) => ({ header, key: header }))
      records.forEach((record) => {
        worksheet.addRow(record)
      })
      const buffer = await workbook.xlsx.writeBuffer()
      saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `${filenameBase}.xlsx`,
      )
      setIsExportModalOpen(false)
      return
    }

    if (exportFormat === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      doc.setFontSize(11)
      doc.text('Export schede clienti', 40, 36)
      autoTable(doc, {
        head: [headers],
        body: bodyRows,
        startY: 50,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [33, 37, 41] },
      })
      doc.save(`${filenameBase}.pdf`)
      setIsExportModalOpen(false)
      return
    }

    const tableRows = [
      new TableRow({
        children: headers.map((header) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
          })),
      }),
      ...bodyRows.map((row) =>
        new TableRow({
          children: row.map((value) =>
            new TableCell({
              children: [new Paragraph(String(value ?? ''))],
            })),
        })),
    ]

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: 'Export schede clienti', bold: true })] }),
          new Paragraph(''),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
        ],
      }],
    })
    const blob = await Packer.toBlob(doc)
    saveAs(blob, `${filenameBase}.docx`)
    setIsExportModalOpen(false)
  }

  const activeClient = useMemo(
    () => (activeClientId === null ? null : clients.find((item) => item.id === activeClientId) ?? null),
    [activeClientId, clients],
  )
  const activeClientMinors = useMemo(
    () => (activeClient ? minorsByClientId.get(activeClient.id) ?? [] : []),
    [activeClient, minorsByClientId],
  )

  const refresh = () => {
    setClients(getPublicClients())
    setMinors(getPublicMinors())
    setDirectAthletes(getPublicDirectAthletes())
  }

  const buildConsentPayload = useCallback(
    (
      client: PublicClientRecord,
      company: ReturnType<typeof getCompanies>[number],
      subject: { kind: 'minor'; minor: PublicMinorRecord } | { kind: 'adult'; athlete: PublicDirectAthleteRecord },
    ): ConsentPdfPayload => ({
      activity: {
        key: subject.kind === 'minor' ? `minor-${subject.minor.id}` : subject.athlete.id,
        createdAt:
          subject.kind === 'minor'
            ? subject.minor.createdAt || client.createdAt
            : subject.athlete.createdAt || client.createdAt,
      },
      company: {
        title: company.title,
        portalName: getProjectSettings().projectName || 'Play Your Sport',
        headquartersAddress: company.headquartersAddress,
        headquartersCity: company.headquartersCity,
        email: company.email,
        pecEmail: company.pecEmail,
        legalRepresentativeFullName: `${company.legalRepresentativeFirstName} ${company.legalRepresentativeLastName}`.trim(),
        contractSignaturePlace: company.contractSignaturePlace,
        delegateSignatureDataUrl: company.delegateSignatureDataUrl,
        consentMinors: company.consentMinors,
        consentAdults: company.consentAdults,
        consentInformationNotice: company.consentInformationNotice,
        consentDataProcessing: company.consentDataProcessing,
      },
      subject: {
        kind: 'adult',
        athlete: {
          firstName: client.parentFirstName,
          lastName: client.parentLastName,
          birthDate: client.parentBirthDate,
          birthPlace: client.parentBirthPlace,
          taxCode: client.parentTaxCode,
          residenceAddress: client.residenceAddress,
          email: client.parentEmail,
          phone: client.parentPhone,
        },
        guardian: null,
      },
      consentStatus: {
        enrollmentAccepted: null,
        informationAccepted: null,
        dataProcessingAccepted: null,
      },
      signatures: {
        enrollmentConfirmationSignatureDataUrl: client.enrollmentConfirmationSignatureDataUrl,
        dataProcessingSignatureDataUrl: client.consentDataProcessingSignatureDataUrl,
      },
    }),
    [],
  )

  const downloadClientConsents = useCallback(
    async (client: PublicClientRecord, preferredMinor?: PublicMinorRecord | null): Promise<boolean> => {
      const clientMinors = minorsByClientId.get(client.id) ?? []
      const clientDirectAthletes = directAthletesByClientId.get(client.id) ?? []
      const fallbackDirectAthlete =
        directAthletes.find((athlete) => athlete.taxCode.trim().toUpperCase() === client.parentTaxCode.trim().toUpperCase()) ??
        null
      const minor = preferredMinor ?? clientMinors[0] ?? null
      const directAthlete = clientDirectAthletes[0] ?? fallbackDirectAthlete
      const selectedPackageId = minor ? minor.packageId : directAthlete?.packageId ?? ''
      if (!selectedPackageId) {
        window.alert(t('clients.consentsNoLinkedMinor'))
        return false
      }
      const packageItem = packagesById.get(selectedPackageId)
      if (!packageItem) {
        window.alert(t('clients.consentsNoLinkedMinor'))
        return false
      }
      const company = companiesById.get(packageItem.companyId)
      if (!company) {
        window.alert(t('activitiesPayments.contract.companyNotFound'))
        return false
      }
      const payload = buildConsentPayload(
        client,
        company,
        minor ? { kind: 'minor', minor } : { kind: 'adult', athlete: directAthlete as PublicDirectAthleteRecord },
      )
      const fullName = `${client.parentFirstName} ${client.parentLastName}`
      const result = await downloadConsentsPdf({
        payload,
        clientFullName: fullName,
      })
      if (!result.ok) {
        window.alert(`${t('clients.consentsDownloadError')} (${result.error})`)
        return false
      }
      return true
    },
    [buildConsentPayload, companiesById, directAthletes, directAthletesByClientId, minorsByClientId, packagesById, t],
  )

  const openCreateModal = () => {
    setCreateMode('parent')
    setCreateError('')
    setCreateDraft({
      ...emptyCreateParentMinorDraft,
      packageId: youthPackages[0]?.id ?? '',
      paymentMethodCode: resolveValidPaymentMethodCode(
        '',
        getAvailablePaymentMethodsForCompany(youthPackages[0]?.companyId ?? ''),
      ),
    })
    setIsCreateModalOpen(true)
  }

  const closeCreateModal = () => {
    setIsCreateModalOpen(false)
    setCreateError('')
    setCreateMode('parent')
    setCreateDraft(emptyCreateParentMinorDraft)
    parentBirthPlaceInitializedRef.current = false
    parentResidenceInitializedRef.current = false
    minorBirthPlaceInitializedRef.current = false
    minorResidenceInitializedRef.current = false
  }

  const openAddMinorModal = () => {
    setAddMinorError('')
    setAddMinorDraft({
      ...emptyAddMinorDraft,
      packageId: youthPackages[0]?.id ?? '',
      paymentMethodCode: resolveValidPaymentMethodCode(
        '',
        getAvailablePaymentMethodsForCompany(youthPackages[0]?.companyId ?? ''),
      ),
    })
    setIsAddMinorModalOpen(true)
  }

  const closeAddMinorModal = () => {
    setIsAddMinorModalOpen(false)
    setAddMinorError('')
    setAddMinorDraft(emptyAddMinorDraft)
    addMinorBirthPlaceInitializedRef.current = false
    addMinorResidenceInitializedRef.current = false
  }

  const saveCreateClient = () => {
    if (createMode === 'athlete') {
      setCreateError(t('clients.createAthleteNotImplemented'))
      return
    }
    const selectedPackage = youthPackages.find((item) => item.id === createDraft.packageId) ?? null
    if (!selectedPackage) {
      setCreateError(t('clients.createSelectPackage'))
      return
    }
    if (!createDraft.paymentMethodCode) {
      setCreateError(t('clients.selectPaymentMethod'))
      return
    }
    const selectedCreatePaymentMethodCode = resolveValidPaymentMethodCode(createDraft.paymentMethodCode, createPaymentMethods)
    if (!selectedCreatePaymentMethodCode) {
      setCreateError(t('clients.selectPaymentMethod'))
      return
    }
    const minorAge = getAgeFromBirthDate(createDraft.minorBirthDate)
    if (
      minorAge === null ||
      minorAge < selectedPackage.ageMin ||
      minorAge > selectedPackage.ageMax
    ) {
      setCreateError(
        t('clients.minorAgeNotCompatible', {
          min: selectedPackage.ageMin,
          max: selectedPackage.ageMax,
        }),
      )
      return
    }
    const requiredFields = [
      createDraft.parentFirstName,
      createDraft.parentLastName,
      createDraft.parentEmail,
      createDraft.parentPhone,
      createDraft.parentBirthDate,
      createDraft.parentBirthPlace,
      createDraft.parentRole,
      createDraft.parentTaxCode,
      createDraft.parentResidenceAddress,
      createDraft.minorFirstName,
      createDraft.minorLastName,
      createDraft.minorBirthDate,
      createDraft.minorBirthPlace,
      createDraft.minorTaxCode,
      createDraft.minorResidenceAddress,
    ]
    if (requiredFields.some((item) => !item.trim())) {
      setCreateError(t('clients.createRequired'))
      return
    }
    if (findPublicClientByTaxCode(createDraft.parentTaxCode)) {
      setCreateError(t('clients.parentTaxCodeDuplicate'))
      return
    }
    if (findPublicMinorByTaxCode(createDraft.minorTaxCode)) {
      setCreateError(t('clients.minorTaxCodeDuplicate'))
      return
    }

    const allClients = getPublicClients()
    const nextUserId = Math.max(0, ...allClients.map((item) => item.userId || 0)) + 1

    const createdClient = createPublicClientRecord({
      userId: nextUserId,
      parentFirstName: createDraft.parentFirstName,
      parentLastName: createDraft.parentLastName,
      parentEmail: createDraft.parentEmail,
      parentPhone: createDraft.parentPhone,
      parentSecondaryPhone: createDraft.parentSecondaryPhone,
      parentBirthDate: createDraft.parentBirthDate,
      parentBirthPlace: createDraft.parentBirthPlace,
      parentRole: createDraft.parentRole,
      parentTaxCode: createDraft.parentTaxCode,
      residenceAddress: createDraft.parentResidenceAddress,
      consentEnrollmentAccepted: true,
      consentInformationAccepted: true,
      consentDataProcessingAccepted: false,
      consentDataProcessingSignatureDataUrl: '',
      enrollmentConfirmationSignatureDataUrl: '',
      parentTaxCodeImageDataUrl: '',
      parentIdentityDocumentImageDataUrl: '',
      privacyPolicySigned: false,
    })
    const createdMinor = createPublicMinorRecord({
      clientId: createdClient.id,
      packageId: selectedPackage.id,
      firstName: createDraft.minorFirstName,
      lastName: createDraft.minorLastName,
      birthDate: createDraft.minorBirthDate,
      birthPlace: createDraft.minorBirthPlace,
      residenceAddress: createDraft.minorResidenceAddress,
      taxCode: createDraft.minorTaxCode,
      taxCodeImageDataUrl: '',
      selectedPaymentMethodCode: selectedCreatePaymentMethodCode,
    })
    const selectedEnrollment = getEnrollmentById(selectedPackage.enrollmentId)
    if (selectedEnrollment) {
      upsertCoverageFromEnrollmentPurchase({
        athleteKey: `minor-${createdMinor.id}`,
        packageItem: selectedPackage,
        enrollment: selectedEnrollment,
      })
    }

    updatePublicClientValidationStatus(createdClient.id, 'validated')
    updatePublicMinorValidationStatus(createdMinor.id, 'validated')
    void downloadClientConsents(createdClient, createdMinor)
    refresh()
    setMessage(t('clients.created'))
    closeCreateModal()
    navigate(`/app/attivita-pagamenti?athleteId=minor-${createdMinor.id}`)
  }

  const saveAddMinor = () => {
    if (!activeClient) {
      return
    }
    const selectedPackage = youthPackages.find((item) => item.id === addMinorDraft.packageId) ?? null
    if (!selectedPackage) {
      setAddMinorError(t('clients.createSelectPackage'))
      return
    }
    if (!addMinorDraft.paymentMethodCode) {
      setAddMinorError(t('clients.selectPaymentMethod'))
      return
    }
    const selectedAddMinorPaymentMethodCode = resolveValidPaymentMethodCode(addMinorDraft.paymentMethodCode, addMinorPaymentMethods)
    if (!selectedAddMinorPaymentMethodCode) {
      setAddMinorError(t('clients.selectPaymentMethod'))
      return
    }
    const minorAge = getAgeFromBirthDate(addMinorDraft.birthDate)
    if (
      minorAge === null ||
      minorAge < selectedPackage.ageMin ||
      minorAge > selectedPackage.ageMax
    ) {
      setAddMinorError(
        t('clients.minorAgeNotCompatible', {
          min: selectedPackage.ageMin,
          max: selectedPackage.ageMax,
        }),
      )
      return
    }
    const requiredFields = [
      addMinorDraft.firstName,
      addMinorDraft.lastName,
      addMinorDraft.birthDate,
      addMinorDraft.birthPlace,
      addMinorDraft.taxCode,
      addMinorDraft.residenceAddress,
    ]
    if (requiredFields.some((item) => !item.trim())) {
      setAddMinorError(t('clients.createRequired'))
      return
    }
    if (findPublicMinorByTaxCode(addMinorDraft.taxCode)) {
      setAddMinorError(t('clients.minorTaxCodeDuplicate'))
      return
    }

    const createdMinor = createPublicMinorRecord({
      clientId: activeClient.id,
      packageId: selectedPackage.id,
      firstName: addMinorDraft.firstName,
      lastName: addMinorDraft.lastName,
      birthDate: addMinorDraft.birthDate,
      birthPlace: addMinorDraft.birthPlace,
      residenceAddress: addMinorDraft.residenceAddress,
      taxCode: addMinorDraft.taxCode,
      taxCodeImageDataUrl: '',
      selectedPaymentMethodCode: selectedAddMinorPaymentMethodCode,
    })
    const selectedEnrollment = getEnrollmentById(selectedPackage.enrollmentId)
    if (selectedEnrollment) {
      upsertCoverageFromEnrollmentPurchase({
        athleteKey: `minor-${createdMinor.id}`,
        packageItem: selectedPackage,
        enrollment: selectedEnrollment,
      })
    }
    updatePublicMinorValidationStatus(createdMinor.id, 'validated')
    refresh()
    setMessage(t('clients.minorCreated'))
    closeAddMinorModal()
    closeModal()
    navigate(`/app/attivita-pagamenti?athleteId=minor-${createdMinor.id}`)
  }

  const openClientModal = (client: PublicClientRecord) => {
    setActiveClientId(client.id)
    setClientDraft({
      parentFirstName: client.parentFirstName,
      parentLastName: client.parentLastName,
      parentEmail: client.parentEmail,
      parentPhone: client.parentPhone,
      parentSecondaryPhone: client.parentSecondaryPhone,
      parentBirthDate: client.parentBirthDate,
      parentBirthPlace: client.parentBirthPlace,
      parentRole: client.parentRole,
      parentTaxCode: client.parentTaxCode,
      residenceAddress: client.residenceAddress,
    })
    const clientMinors = minorsByClientId.get(client.id) ?? []
    const nextMinorDrafts: Record<number, MinorDraft> = {}
    clientMinors.forEach((minor) => {
      nextMinorDrafts[minor.id] = {
        firstName: minor.firstName,
        lastName: minor.lastName,
        birthDate: minor.birthDate,
        birthPlace: minor.birthPlace,
        residenceAddress: minor.residenceAddress,
        taxCode: minor.taxCode,
      }
    })
    setMinorDrafts(nextMinorDrafts)
  }

  const closeModal = () => {
    setActiveClientId(null)
    setClientDraft(null)
    setMinorDrafts({})
  }

  const saveAllChanges = (silent = false) => {
    if (!activeClient || !clientDraft) {
      return
    }
    updatePublicClientRecord(activeClient.id, clientDraft)
    activeClientMinors.forEach((minor) => {
      const draft = minorDrafts[minor.id]
      if (!draft) {
        return
      }
      updatePublicMinorRecord(minor.id, draft)
    })
    refresh()
    if (!silent) {
      setMessage(t('clients.updated'))
    }
  }

  const setValidationStatus = (status: 'validated' | 'not_validated') => {
    if (!activeClient) {
      return
    }
    const clientForDownload = activeClient
    const firstLinkedMinor = activeClientMinors[0] ?? null
    if (status === 'validated') {
      const hasNotValidatedMinors = activeClientMinors.some((minor) => minor.validationStatus !== 'validated')
      if (hasNotValidatedMinors) {
        const confirmed = window.confirm(t('clients.confirmValidateWithUnvalidatedMinors'))
        if (!confirmed) {
          return
        }
      }
    }
    saveAllChanges(true)
    updatePublicClientValidationStatus(activeClient.id, status)
    refresh()
    setMessage(t('clients.updated'))
    if (status === 'validated') {
      void downloadClientConsents(clientForDownload, firstLinkedMinor)
    }
  }

  const saveMinorChanges = (minorId: number, silent = false) => {
    const draft = minorDrafts[minorId]
    if (!draft) {
      return
    }
    updatePublicMinorRecord(minorId, draft)
    refresh()
    if (!silent) {
      setMessage(t('clients.updated'))
    }
  }

  const setMinorValidationStatus = (minor: PublicMinorRecord, status: 'validated' | 'not_validated') => {
    saveMinorChanges(minor.id, true)
    updatePublicMinorValidationStatus(minor.id, status)
    refresh()
    setMessage(t('clients.updated'))
  }

  const resetFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setPrivacyFilter('all')
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{t('clients.title')}</h2>
        <p className="text-sm opacity-70">{t('clients.description')}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setIsExportModalOpen(true)}
          disabled={filteredClients.length === 0}
        >
          Esporta schede
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreateModal}>
          {t('clients.create')}
        </button>
      </div>
      {message ? <p className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success">{message}</p> : null}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-base-300 bg-base-100 p-3">
        <label className="form-control min-w-[240px] flex-[2_1_360px]">
          <span className="label-text mb-1 text-xs">{t('clients.searchLabel')}</span>
          <input
            className="input input-bordered w-full"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={t('clients.searchPlaceholder')}
          />
        </label>
        <label className="form-control min-w-[180px] flex-[1_1_220px]">
          <span className="label-text mb-1 text-xs">{t('clients.validationFilter')}</span>
          <select
            className="select select-bordered w-full"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | 'validated' | 'not_validated')}
          >
            <option value="all">{t('clients.allStatuses')}</option>
            <option value="validated">{t('clients.validated')}</option>
            <option value="not_validated">{t('clients.notValidated')}</option>
          </select>
        </label>
        <label className="form-control min-w-[180px] flex-[1_1_220px]">
          <span className="label-text mb-1 text-xs">{t('clients.privacyFilter')}</span>
          <select
            className="select select-bordered w-full"
            value={privacyFilter}
            onChange={(event) => setPrivacyFilter(event.target.value as 'all' | 'signed' | 'not_signed')}
          >
            <option value="all">{t('clients.allPrivacyStatuses')}</option>
            <option value="signed">{t('clients.privacySigned')}</option>
            <option value="not_signed">{t('clients.privacyNotSigned')}</option>
          </select>
        </label>
        <div className="ml-auto flex-[0_0_auto]">
          <button type="button" className="btn btn-outline btn-sm" onClick={resetFilters}>
            {t('common.resetFilters')}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
        <table className="table">
          <thead>
            <tr>
              <th>{t('clients.parent')}</th>
              <th>{t('clients.email')}</th>
              <th>{t('clients.phone')}</th>
              <th>{t('clients.minors')}</th>
              <th>{t('clients.status')}</th>
              <th>{t('clients.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-sm opacity-70">{t('clients.empty')}</td>
              </tr>
            ) : (
              filteredClients.map((client) => {
                const linkedMinors = minorsByClientId.get(client.id) ?? []
                const isPrivacySigned = isClientPrivacyPolicySigned(client)
                return (
                  <tr key={client.id}>
                    <td>{client.parentFirstName} {client.parentLastName}</td>
                    <td>{client.parentEmail}</td>
                    <td>{client.parentPhone}</td>
                    <td>
                      {linkedMinors.length === 0
                        ? '-'
                        : linkedMinors.map((minor) => `${minor.firstName} ${minor.lastName}`).join(', ')}
                    </td>
                    <td>
                      <span className={`badge ${client.validationStatus === 'validated' ? 'badge-success' : 'badge-warning'}`}>
                        {client.validationStatus === 'validated'
                          ? t('clients.validated')
                          : t('clients.notValidated')}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <span
                          className="inline-flex items-center"
                          title={isPrivacySigned ? 'Privacy firmata' : 'Privacy non firmata'}
                        >
                          {isPrivacySigned ? (
                            <ShieldCheck className="h-4 w-4 text-success" />
                          ) : (
                            <ShieldX className="h-4 w-4 text-error" />
                          )}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-square"
                          onClick={() => openClientModal(client)}
                          title={client.validationStatus === 'validated' ? t('clients.openProfile') : t('clients.openValidation')}
                        >
                          {client.validationStatus === 'validated'
                            ? <FileText className="h-4 w-4" />
                            : <AlertTriangle className="h-4 w-4 text-warning" />}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-square"
                          title={t('clients.downloadConsents')}
                          onClick={() => {
                            void downloadClientConsents(client)
                          }}
                        >
                          <FileSignature className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-square"
                          title={t('athletes.openActivitiesPayments')}
                          onClick={() => navigate(`/app/attivita-pagamenti?clientId=${client.id}`)}
                        >
                          <Wallet className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {isExportModalOpen ? (
        <dialog className="modal modal-open">
          <div className="modal-box w-11/12 max-w-5xl">
            <h3 className="text-lg font-semibold">Esporta schede clienti</h3>
            <p className="mt-1 text-sm opacity-70">
              Seleziona i campi della scheda cliente da includere e il formato del file.
            </p>

            <div className="mt-4 space-y-4">
              <label className="form-control max-w-xs">
                <span className="label-text mb-1 text-xs">Formato export</span>
                <select
                  className="select select-bordered w-full"
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value as ClientExportFormat)}
                >
                  <option value="xlsx">Excel (.xlsx)</option>
                  <option value="pdf">PDF (.pdf)</option>
                  <option value="docx">Word (.docx)</option>
                </select>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-xs btn-outline"
                  onClick={() => setSelectedExportFields(availableClientExportFields)}
                >
                  Seleziona tutto
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-outline"
                  onClick={() => setSelectedExportFields([])}
                >
                  Deseleziona tutto
                </button>
                <span className="text-xs opacity-70">
                  Campi selezionati: {effectiveSelectedExportFields.length}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {availableClientExportFields.map((field) => (
                  <label key={field} className="label cursor-pointer justify-start gap-2 rounded border border-base-300 px-3 py-2">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm checkbox-primary"
                      checked={effectiveSelectedExportFields.includes(field)}
                      onChange={() => toggleExportField(field)}
                    />
                    <span className="label-text">{exportFieldLabel(field)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setIsExportModalOpen(false)}>
                {t('public.common.close')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void exportClientProfiles()}
                disabled={effectiveSelectedExportFields.length === 0 || filteredClients.length === 0}
              >
                Esporta
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={() => setIsExportModalOpen(false)} />
        </dialog>
      ) : null}

      {activeClient && clientDraft ? (
        <dialog className="modal modal-open">
          <div className="modal-box w-11/12 max-w-5xl">
            <h3 className="text-lg font-semibold">{t('clients.detailTitle')}</h3>
            <div className="mt-2">
              <label className="label cursor-default justify-start gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={isClientPrivacyPolicySigned(activeClient)}
                  onChange={(event) => {
                    updatePublicClientPrivacyPolicyStatus(activeClient.id, event.target.checked)
                    refresh()
                    setMessage(t('clients.updated'))
                  }}
                />
                <span className="label-text">Privacy policy firmata</span>
              </label>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.parentFirstName')}</span>
                <input className="input input-bordered w-full" value={clientDraft.parentFirstName} onChange={(event) => setClientDraft((prev) => (prev ? { ...prev, parentFirstName: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.parentLastName')}</span>
                <input className="input input-bordered w-full" value={clientDraft.parentLastName} onChange={(event) => setClientDraft((prev) => (prev ? { ...prev, parentLastName: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.email')}</span>
                <input className="input input-bordered w-full" value={clientDraft.parentEmail} onChange={(event) => setClientDraft((prev) => (prev ? { ...prev, parentEmail: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.phone')}</span>
                <input className="input input-bordered w-full" value={clientDraft.parentPhone} onChange={(event) => setClientDraft((prev) => (prev ? { ...prev, parentPhone: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.secondaryPhone')}</span>
                <input className="input input-bordered w-full" value={clientDraft.parentSecondaryPhone} onChange={(event) => setClientDraft((prev) => (prev ? { ...prev, parentSecondaryPhone: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.birthDate')}</span>
                <input type="date" className="input input-bordered w-full" value={clientDraft.parentBirthDate} onChange={(event) => setClientDraft((prev) => (prev ? { ...prev, parentBirthDate: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">Ruolo firmatario</span>
                <select
                  className="select select-bordered w-full"
                  value={clientDraft.parentRole}
                  onChange={(event) =>
                    setClientDraft((prev) =>
                      prev ? { ...prev, parentRole: event.target.value as ParentRole } : prev,
                    )
                  }
                >
                  {PARENT_ROLE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.birthPlace')}</span>
                <input className="input input-bordered w-full" value={clientDraft.parentBirthPlace} onChange={(event) => setClientDraft((prev) => (prev ? { ...prev, parentBirthPlace: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.taxCode')}</span>
                <input className="input input-bordered w-full" value={clientDraft.parentTaxCode} onChange={(event) => setClientDraft((prev) => (prev ? { ...prev, parentTaxCode: event.target.value } : prev))} />
              </label>
              <label className="form-control md:col-span-2">
                <span className="label-text mb-1 text-xs">{t('clients.residence')}</span>
                <input className="input input-bordered w-full" value={clientDraft.residenceAddress} onChange={(event) => setClientDraft((prev) => (prev ? { ...prev, residenceAddress: event.target.value } : prev))} />
              </label>
            </div>

            {activeClient.validationStatus === 'not_validated' ? (
              <div className="mt-4 rounded border border-base-300">
                <div className="collapse collapse-arrow">
                  <input type="checkbox" />
                  <div className="collapse-title text-sm font-medium">{t('clients.checkDocuments')}</div>
                  <div className="collapse-content space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold">{t('clients.taxCodeDocument')}</p>
                      <ClientDocumentPreview dataUrl={activeClient.parentTaxCodeImageDataUrl} />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold">{t('clients.identityDocument')}</p>
                      <ClientDocumentPreview dataUrl={activeClient.parentIdentityDocumentImageDataUrl} />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold">{t('clients.linkedMinors')}</h4>
                <button type="button" className="btn btn-primary btn-xs" onClick={openAddMinorModal}>
                  {t('clients.addMinor')}
                </button>
              </div>
              {activeClientMinors.length === 0 ? (
                <p className="text-sm opacity-70">{t('clients.noLinkedMinors')}</p>
              ) : (
                <div className="space-y-2">
                  {activeClientMinors.map((minor) => {
                    const minorDraft = minorDrafts[minor.id]
                    if (!minorDraft) {
                      return null
                    }
                    return (
                      <div key={minor.id} className="rounded border border-base-300">
                        <div className="collapse collapse-arrow">
                          <input type="checkbox" />
                          <div className="collapse-title text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <span>{minor.firstName} {minor.lastName}</span>
                              <span className={`badge badge-sm ${minor.validationStatus === 'validated' ? 'badge-success' : 'badge-warning'}`}>
                                {minor.validationStatus === 'validated'
                                  ? t('clients.validated')
                                  : t('clients.notValidated')}
                              </span>
                            </div>
                          </div>
                          <div className="collapse-content space-y-3">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <label className="form-control">
                                <span className="label-text mb-1 text-xs">{t('clients.minorFirstName')}</span>
                                <input className="input input-bordered w-full" value={minorDraft.firstName} onChange={(event) => setMinorDrafts((prev) => ({ ...prev, [minor.id]: { ...prev[minor.id], firstName: event.target.value } }))} />
                              </label>
                              <label className="form-control">
                                <span className="label-text mb-1 text-xs">{t('clients.minorLastName')}</span>
                                <input className="input input-bordered w-full" value={minorDraft.lastName} onChange={(event) => setMinorDrafts((prev) => ({ ...prev, [minor.id]: { ...prev[minor.id], lastName: event.target.value } }))} />
                              </label>
                              <label className="form-control">
                                <span className="label-text mb-1 text-xs">{t('athletes.birthDate')}</span>
                                <input type="date" className="input input-bordered w-full" value={minorDraft.birthDate} onChange={(event) => setMinorDrafts((prev) => ({ ...prev, [minor.id]: { ...prev[minor.id], birthDate: event.target.value } }))} />
                              </label>
                              <label className="form-control">
                                <span className="label-text mb-1 text-xs">{t('clients.birthPlace')}</span>
                                <input className="input input-bordered w-full" value={minorDraft.birthPlace} onChange={(event) => setMinorDrafts((prev) => ({ ...prev, [minor.id]: { ...prev[minor.id], birthPlace: event.target.value } }))} />
                              </label>
                              <label className="form-control">
                                <span className="label-text mb-1 text-xs">{t('clients.taxCode')}</span>
                                <input className="input input-bordered w-full" value={minorDraft.taxCode} onChange={(event) => setMinorDrafts((prev) => ({ ...prev, [minor.id]: { ...prev[minor.id], taxCode: event.target.value } }))} />
                              </label>
                              <label className="form-control md:col-span-2">
                                <span className="label-text mb-1 text-xs">{t('clients.residence')}</span>
                                <input className="input input-bordered w-full" value={minorDraft.residenceAddress} onChange={(event) => setMinorDrafts((prev) => ({ ...prev, [minor.id]: { ...prev[minor.id], residenceAddress: event.target.value } }))} />
                              </label>
                            </div>
                            {minor.validationStatus === 'not_validated' ? (
                              <div className="rounded border border-base-300">
                                <div className="collapse collapse-arrow">
                                  <input type="checkbox" />
                                  <div className="collapse-title text-sm font-medium">{t('clients.checkDocuments')}</div>
                                  <div className="collapse-content">
                                    <p className="mb-1 text-xs font-semibold">{t('clients.taxCodeDocument')}</p>
                                    <ClientDocumentPreview dataUrl={minor.taxCodeImageDataUrl} />
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button type="button" className="btn btn-sm btn-outline" onClick={() => saveMinorChanges(minor.id)}>
                                {t('common.save')}
                              </button>
                              {minor.validationStatus === 'validated' ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-warning"
                                  onClick={() => setMinorValidationStatus(minor, 'not_validated')}
                                >
                                  {t('clients.markNotValidated')}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  onClick={() => setMinorValidationStatus(minor, 'validated')}
                                >
                                  {t('clients.markValidated')}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>{t('public.common.close')}</button>
              <button type="button" className="btn btn-outline" onClick={() => saveAllChanges()}>{t('common.save')}</button>
              {activeClient.validationStatus === 'not_validated' ? (
                <button type="button" className="btn btn-primary" onClick={() => setValidationStatus('validated')}>
                  {t('clients.markValidated')}
                </button>
              ) : (
                <button type="button" className="btn btn-warning" onClick={() => setValidationStatus('not_validated')}>
                  {t('clients.markNotValidated')}
                </button>
              )}
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeModal} />
        </dialog>
      ) : null}

      {activeClient && isAddMinorModalOpen ? (
        <dialog className="modal modal-open">
          <div className="modal-box w-11/12 max-w-3xl">
            <h3 className="text-lg font-semibold">{t('clients.addMinorTitle')}</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="form-control md:col-span-2">
                <span className="label-text mb-1 text-xs">{t('clients.createPackageLabel')}</span>
                <select
                  className="select select-bordered w-full"
                  value={addMinorDraft.packageId}
                  onChange={(event) => {
                    const packageId = event.target.value
                    setAddMinorDraft((prev) => ({
                      ...prev,
                      packageId,
                      paymentMethodCode: resolvePaymentMethodForPackage(packageId, prev.paymentMethodCode),
                    }))
                  }}
                >
                  {youthPackages.length === 0 ? (
                    <option value="">{t('clients.createNoPackages')}</option>
                  ) : (
                    youthPackages.map((item: SportPackage) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="form-control md:col-span-2">
                <span className="label-text mb-1 text-xs">{t('clients.paymentMethod')}</span>
                <select
                  className="select select-bordered w-full"
                  value={addMinorDraft.paymentMethodCode}
                  onChange={(event) =>
                    setAddMinorDraft((prev) => ({ ...prev, paymentMethodCode: event.target.value as PaymentMethodCode | '' }))
                  }
                >
                  {renderPaymentMethodOptions(addMinorPaymentMethods)}
                </select>
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.minorFirstName')}</span>
                <input className="input input-bordered w-full" value={addMinorDraft.firstName} onChange={(event) => setAddMinorDraft((prev) => ({ ...prev, firstName: event.target.value }))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.minorLastName')}</span>
                <input className="input input-bordered w-full" value={addMinorDraft.lastName} onChange={(event) => setAddMinorDraft((prev) => ({ ...prev, lastName: event.target.value }))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('athletes.birthDate')}</span>
                <input type="date" className="input input-bordered w-full" value={addMinorDraft.birthDate} onChange={(event) => setAddMinorDraft((prev) => ({ ...prev, birthDate: event.target.value }))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.gender')}</span>
                <select
                  className="select select-bordered w-full"
                  value={addMinorDraft.gender}
                  onChange={(event) => setAddMinorDraft((prev) => ({ ...prev, gender: event.target.value as 'M' | 'F' }))}
                >
                  <option value="M">{t('clients.genderMale')}</option>
                  <option value="F">{t('clients.genderFemale')}</option>
                </select>
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.birthPlace')}</span>
                <input
                  ref={addMinorBirthPlaceRef}
                  className="input input-bordered w-full"
                  value={addMinorDraft.birthPlace}
                  onFocus={initializeAddMinorBirthPlaceAutocomplete}
                  onChange={(event) => setAddMinorDraft((prev) => ({ ...prev, birthPlace: event.target.value }))}
                />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.taxCode')}</span>
                <input className="input input-bordered w-full" value={addMinorDraft.taxCode} readOnly />
              </label>
              <label className="form-control md:col-span-2">
                <span className="label-text mb-1 text-xs">{t('clients.residence')}</span>
                <input
                  ref={addMinorResidenceRef}
                  className="input input-bordered w-full"
                  value={addMinorDraft.residenceAddress}
                  onFocus={initializeAddMinorResidenceAutocomplete}
                  onChange={(event) => setAddMinorDraft((prev) => ({ ...prev, residenceAddress: event.target.value }))}
                />
              </label>
            </div>
            {addMinorError ? <p className="mt-4 rounded bg-error/15 px-3 py-2 text-sm text-error">{addMinorError}</p> : null}
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={closeAddMinorModal}>{t('public.common.close')}</button>
              <button type="button" className="btn btn-primary" onClick={saveAddMinor}>
                {t('clients.createAthlete')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeAddMinorModal} />
        </dialog>
      ) : null}

      {isCreateModalOpen ? (
        <dialog className="modal modal-open">
          <div className="modal-box w-11/12 max-w-5xl">
            <h3 className="text-lg font-semibold">{t('clients.createTitle')}</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.createModeLabel')}</span>
                <select
                  className="select select-bordered w-full"
                  value={createMode}
                  onChange={(event) => {
                    setCreateMode(event.target.value as CreateClientMode)
                    setCreateError('')
                  }}
                >
                  <option value="parent">{t('clients.createAsParent')}</option>
                  <option value="athlete">{t('clients.createAsAthlete')}</option>
                </select>
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.createPackageLabel')}</span>
                <select
                  className="select select-bordered w-full"
                  value={createDraft.packageId}
                  onChange={(event) => {
                    const packageId = event.target.value
                    setCreateDraft((prev) => ({
                      ...prev,
                      packageId,
                      paymentMethodCode: resolvePaymentMethodForPackage(packageId, prev.paymentMethodCode),
                    }))
                  }}
                >
                  {youthPackages.length === 0 ? (
                    <option value="">{t('clients.createNoPackages')}</option>
                  ) : (
                    youthPackages.map((item: SportPackage) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="form-control md:col-span-2">
                <span className="label-text mb-1 text-xs">{t('clients.paymentMethod')}</span>
                <select
                  className="select select-bordered w-full"
                  value={createDraft.paymentMethodCode}
                  onChange={(event) =>
                    setCreateDraft((prev) => ({ ...prev, paymentMethodCode: event.target.value as PaymentMethodCode | '' }))
                  }
                >
                  {renderPaymentMethodOptions(createPaymentMethods)}
                </select>
              </label>
            </div>

            {createMode === 'parent' ? (
              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="font-semibold">{t('clients.parent')}</h4>
                  <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('clients.parentFirstName')}</span>
                      <input className="input input-bordered w-full" value={createDraft.parentFirstName} onChange={(event) => setCreateDraft((prev) => ({ ...prev, parentFirstName: event.target.value }))} />
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('clients.parentLastName')}</span>
                      <input className="input input-bordered w-full" value={createDraft.parentLastName} onChange={(event) => setCreateDraft((prev) => ({ ...prev, parentLastName: event.target.value }))} />
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('clients.email')}</span>
                      <input className="input input-bordered w-full" value={createDraft.parentEmail} onChange={(event) => setCreateDraft((prev) => ({ ...prev, parentEmail: event.target.value }))} />
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('clients.phone')}</span>
                      <input className="input input-bordered w-full" value={createDraft.parentPhone} onChange={(event) => setCreateDraft((prev) => ({ ...prev, parentPhone: event.target.value }))} />
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('clients.secondaryPhone')}</span>
                      <input className="input input-bordered w-full" value={createDraft.parentSecondaryPhone} onChange={(event) => setCreateDraft((prev) => ({ ...prev, parentSecondaryPhone: event.target.value }))} />
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('clients.birthDate')}</span>
                      <input type="date" className="input input-bordered w-full" value={createDraft.parentBirthDate} onChange={(event) => setCreateDraft((prev) => ({ ...prev, parentBirthDate: event.target.value }))} />
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('clients.gender')}</span>
                      <select
                        className="select select-bordered w-full"
                        value={createDraft.parentGender}
                        onChange={(event) => setCreateDraft((prev) => ({ ...prev, parentGender: event.target.value as 'M' | 'F' }))}
                      >
                        <option value="M">{t('clients.genderMale')}</option>
                        <option value="F">{t('clients.genderFemale')}</option>
                      </select>
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">Ruolo firmatario</span>
                      <select
                        className="select select-bordered w-full"
                        value={createDraft.parentRole}
                        onChange={(event) =>
                          setCreateDraft((prev) => ({ ...prev, parentRole: event.target.value as ParentRole }))
                        }
                      >
                        {PARENT_ROLE_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('clients.birthPlace')}</span>
                      <input
                        ref={parentBirthPlaceRef}
                        className="input input-bordered w-full"
                        value={createDraft.parentBirthPlace}
                        onFocus={initializeParentBirthPlaceAutocomplete}
                        onChange={(event) => setCreateDraft((prev) => ({ ...prev, parentBirthPlace: event.target.value }))}
                      />
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('clients.taxCode')}</span>
                      <input className="input input-bordered w-full" value={createDraft.parentTaxCode} readOnly />
                    </label>
                    <label className="form-control md:col-span-2">
                      <span className="label-text mb-1 text-xs">{t('clients.residence')}</span>
                      <input
                        ref={parentResidenceRef}
                        className="input input-bordered w-full"
                        value={createDraft.parentResidenceAddress}
                        onFocus={initializeParentResidenceAutocomplete}
                        onChange={(event) => setCreateDraft((prev) => ({ ...prev, parentResidenceAddress: event.target.value }))}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold">{t('clients.minor')}</h4>
                  <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('clients.minorFirstName')}</span>
                      <input className="input input-bordered w-full" value={createDraft.minorFirstName} onChange={(event) => setCreateDraft((prev) => ({ ...prev, minorFirstName: event.target.value }))} />
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('clients.minorLastName')}</span>
                      <input className="input input-bordered w-full" value={createDraft.minorLastName} onChange={(event) => setCreateDraft((prev) => ({ ...prev, minorLastName: event.target.value }))} />
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('athletes.birthDate')}</span>
                      <input type="date" className="input input-bordered w-full" value={createDraft.minorBirthDate} onChange={(event) => setCreateDraft((prev) => ({ ...prev, minorBirthDate: event.target.value }))} />
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('clients.gender')}</span>
                      <select
                        className="select select-bordered w-full"
                        value={createDraft.minorGender}
                        onChange={(event) => setCreateDraft((prev) => ({ ...prev, minorGender: event.target.value as 'M' | 'F' }))}
                      >
                        <option value="M">{t('clients.genderMale')}</option>
                        <option value="F">{t('clients.genderFemale')}</option>
                      </select>
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('clients.birthPlace')}</span>
                      <input
                        ref={minorBirthPlaceRef}
                        className="input input-bordered w-full"
                        value={createDraft.minorBirthPlace}
                        onFocus={initializeMinorBirthPlaceAutocomplete}
                        onChange={(event) => setCreateDraft((prev) => ({ ...prev, minorBirthPlace: event.target.value }))}
                      />
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('clients.taxCode')}</span>
                      <input className="input input-bordered w-full" value={createDraft.minorTaxCode} readOnly />
                    </label>
                    <label className="form-control md:col-span-2">
                      <span className="label-text mb-1 text-xs">{t('clients.residence')}</span>
                      <input
                        ref={minorResidenceRef}
                        className="input input-bordered w-full"
                        value={createDraft.minorResidenceAddress}
                        onFocus={initializeMinorResidenceAutocomplete}
                        onChange={(event) => setCreateDraft((prev) => ({ ...prev, minorResidenceAddress: event.target.value }))}
                      />
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded border border-warning/40 bg-warning/10 p-3 text-sm">
                {t('clients.createAthleteNotImplemented')}
              </p>
            )}

            {createError ? <p className="mt-4 rounded bg-error/15 px-3 py-2 text-sm text-error">{createError}</p> : null}
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={closeCreateModal}>{t('public.common.close')}</button>
              <button type="button" className="btn btn-primary" onClick={saveCreateClient}>
                {t('common.save')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeCreateModal} />
        </dialog>
      ) : null}
    </section>
  )
}

export default ClientsPage
