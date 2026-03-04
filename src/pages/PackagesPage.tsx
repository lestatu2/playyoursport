import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { DndContext, PointerSensor, closestCenter, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MessageCircle, SquarePen, Trash2 } from 'lucide-react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { useSearchParams } from 'react-router-dom'
import 'react-day-picker/style.css'
import DataTable from '../components/DataTable'
import RichTextEditor from '../components/RichTextEditor'
import {
  createSportPackage,
  getAdditionalServices,
  getCompanies,
  getEnrollments,
  getFields,
  getGroups,
  getPackageCatalogChangedEventName,
  getPackages,
  getSportCategories,
  getWhatsAppAccounts,
  removeSportPackage,
  updateSportPackage,
  type AudienceCode,
  type PackageGalleryImage,
  type PackageGroup,
  type PackageGroupSchedule,
  type PackagePaymentFrequency,
  type PackageDurationType,
  type SavePackagePayload,
  type AdditionalService,
  type WhatsAppAccount,
  type EnrollmentType,
  type SportField,
  type SportPackage,
  type UtilityGroup,
} from '../lib/package-catalog'
import { getRoleLabels, getUsers, getUsersChangedEventName, type MockUser } from '../lib/auth'
import { getProjectSettings, getProjectSettingsChangedEventName } from '../lib/project-settings'

const PACKAGE_AUDIENCES: Array<{ value: AudienceCode; labelKey: string }> = [
  { value: 'adult', labelKey: 'utility.packages.audienceAdult' },
  { value: 'youth', labelKey: 'utility.packages.audienceYouth' },
]
const PAYMENT_FREQUENCIES: Array<{ value: PackagePaymentFrequency; labelKey: string }> = [
  { value: 'daily', labelKey: 'utility.packages.paymentFrequencyDaily' },
  { value: 'weekly', labelKey: 'utility.packages.paymentFrequencyWeekly' },
  { value: 'monthly', labelKey: 'utility.packages.paymentFrequencyMonthly' },
  { value: 'yearly', labelKey: 'utility.packages.paymentFrequencyYearly' },
]
const WEEK_DAYS: Array<{ value: number; labelKey: string }> = [
  { value: 1, labelKey: 'utility.packages.weekdayMonday' },
  { value: 2, labelKey: 'utility.packages.weekdayTuesday' },
  { value: 3, labelKey: 'utility.packages.weekdayWednesday' },
  { value: 4, labelKey: 'utility.packages.weekdayThursday' },
  { value: 5, labelKey: 'utility.packages.weekdayFriday' },
  { value: 6, labelKey: 'utility.packages.weekdaySaturday' },
  { value: 0, labelKey: 'utility.packages.weekdaySunday' },
]
const GOOGLE_PLACES_SCRIPT_ID = 'pys-google-places-script'
type PackageTableColumnId = 'name' | 'ageRange' | 'period' | 'paymentFrequency' | 'priceByPeriod' | 'category' | 'company' | 'audience'
const DEFAULT_PACKAGE_TABLE_PRIORITY_ORDER: PackageTableColumnId[] = [
  'name',
  'ageRange',
  'period',
  'paymentFrequency',
  'priceByPeriod',
  'category',
  'company',
  'audience',
]
const DEFAULT_PACKAGE_TABLE_HIGH_PRIORITY: PackageTableColumnId[] = ['name', 'ageRange', 'period', 'paymentFrequency', 'priceByPeriod']

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

function parseIsoDate(value: string): Date | undefined {
  if (!value) {
    return undefined
  }
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function toIsoDate(value: Date | undefined): string {
  if (!value) {
    return ''
  }
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

function getEntriesMaxForFrequency(recurringPaymentEnabled: boolean, frequency: PackagePaymentFrequency): number | null {
  if (!recurringPaymentEnabled) {
    return null
  }
  if (frequency === 'weekly') {
    return 7
  }
  if (frequency === 'monthly') {
    return 31
  }
  if (frequency === 'yearly') {
    return 365
  }
  return null
}

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        reject(new Error('invalid-image-result'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error('image-read-error'))
    reader.readAsDataURL(file)
  })
}

function createPackageGroupSchedule(): PackageGroupSchedule {
  return {
    id: `pkg-group-schedule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    weekday: 1,
    time: '17:00',
  }
}

function normalizeProductId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

type GallerySortableCardProps = {
  image: PackageGalleryImage
  onEditCaption: (image: PackageGalleryImage) => void
  onRemove: (id: string) => void
  captionLabel: string
  emptyCaptionLabel: string
  removeLabel: string
}

function GallerySortableCard({
  image,
  onEditCaption,
  onRemove,
  captionLabel,
  emptyCaptionLabel,
  removeLabel,
}: GallerySortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`overflow-hidden rounded-lg border border-base-300 bg-base-100 ${isDragging ? 'z-10 opacity-80' : ''}`}
    >
      <div className="flex items-center justify-between border-b border-base-300 px-2 py-1">
        <button type="button" className="btn btn-ghost btn-xs gap-1 px-2" {...attributes} {...listeners}>
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>
      <button type="button" className="block w-full text-left" onClick={() => onEditCaption(image)}>
        <img src={image.src} alt={image.caption || 'gallery'} className="h-36 w-full object-cover" />
        <div className="space-y-1 p-2 text-xs">
          <p className="font-medium">{captionLabel}</p>
          <p className="line-clamp-2 opacity-70">{image.caption || emptyCaptionLabel}</p>
        </div>
      </button>
      <div className="border-t border-base-300 p-2">
        <button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => onRemove(image.id)}>
          {removeLabel}
        </button>
      </div>
    </article>
  )
}

function PackagesPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentYear = new Date().getFullYear()
  const [packages, setPackages] = useState<SportPackage[]>(() => getPackages())
  const [categories, setCategories] = useState(() => getSportCategories().filter((category) => category.isActive))
  const [companies, setCompanies] = useState(() => getCompanies())
  const [enrollments, setEnrollments] = useState<EnrollmentType[]>(() => getEnrollments())
  const [whatsappAccounts, setWhatsAppAccounts] = useState<WhatsAppAccount[]>(() => getWhatsAppAccounts())
  const [fields, setFields] = useState<SportField[]>(() => getFields())
  const [platformGroups, setPlatformGroups] = useState<UtilityGroup[]>(() => getGroups())
  const [additionalServices, setAdditionalServices] = useState<AdditionalService[]>(() => getAdditionalServices())
  const [trainers, setTrainers] = useState<MockUser[]>(() => getUsers().filter((user) => user.role === 'trainer'))
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<
    | 'general-info'
    | 'gallery'
    | 'duration'
    | 'payments'
    | 'enrollments'
    | 'additional-services'
    | 'groups'
    | 'trainers'
    | 'contract'
    | 'whatsapp'
  >('general-info')
  const [paymentCurrency, setPaymentCurrency] = useState(() => getProjectSettings().paymentCurrency || 'EUR')
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState(() => getProjectSettings().googleMapsApiKey || '')
  const [draft, setDraft] = useState<SavePackagePayload>({
    productId: '',
    editionYear: currentYear,
    name: '',
    description: '',
    disclaimer: '',
    categoryId: '',
    companyId: '',
    enrollmentId: '',
    enrollmentPrice: 0,
    trainerIds: [],
    whatsappAccountIds: [],
    whatsappGroupLink: '',
    additionalFixedServices: [],
    additionalVariableServices: [],
    audience: 'adult',
    ageMin: 18,
    ageMax: 99,
    durationType: 'single-event',
    eventDate: '',
    eventTime: '',
    periodStartDate: '',
    periodEndDate: '',
    gallery: [],
    groups: [],
    recurringPaymentEnabled: false,
    paymentFrequency: 'monthly',
    priceAmount: 0,
    monthlyDueDay: null,
    monthlyNextCycleOpenDay: null,
    weeklyDueWeekday: null,
    firstPaymentOnSite: false,
    trainingAddress: '',
    entriesCount: 1,
    userSelectableSchedule: false,
    contractHeaderImage: '',
    contractHeaderText: '',
    contractRegulation: '',
    featuredImage: '',
    isFeatured: false,
    isDescriptive: false,
  })
  const [editingGalleryImageId, setEditingGalleryImageId] = useState<string | null>(null)
  const [galleryCaptionDraft, setGalleryCaptionDraft] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterCompanyId, setFilterCompanyId] = useState('')
  const [filterAudience, setFilterAudience] = useState<'all' | AudienceCode>('all')
  const [filterFrequency, setFilterFrequency] = useState<'all' | 'non-recurring' | PackagePaymentFrequency>('all')
  const [filterAgeMin, setFilterAgeMin] = useState('')
  const [filterAgeMax, setFilterAgeMax] = useState('')
  const [isPriorityModalOpen, setIsPriorityModalOpen] = useState(false)
  const [priorityOrder, setPriorityOrder] = useState<PackageTableColumnId[]>(DEFAULT_PACKAGE_TABLE_PRIORITY_ORDER)
  const [highPriorityColumns, setHighPriorityColumns] = useState<PackageTableColumnId[]>(DEFAULT_PACKAGE_TABLE_HIGH_PRIORITY)
  const [priorityDraftOrder, setPriorityDraftOrder] = useState<PackageTableColumnId[]>(DEFAULT_PACKAGE_TABLE_PRIORITY_ORDER)
  const [priorityDraftHighColumns, setPriorityDraftHighColumns] = useState<PackageTableColumnId[]>(DEFAULT_PACKAGE_TABLE_HIGH_PRIORITY)
  const [isEditionsModalOpen, setIsEditionsModalOpen] = useState(false)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'edit'>('create')
  const [editingGroupIndex, setEditingGroupIndex] = useState<number | null>(null)
  const [groupDraft, setGroupDraft] = useState<PackageGroup>({
    id: '',
    title: '',
    birthYearMin: 2010,
    birthYearMax: 2010,
    fieldId: '',
    schedules: [createPackageGroupSchedule()],
  })
  const trainingAddressInputRef = useRef<HTMLInputElement | null>(null)
  const trainingAddressAutocompleteInitializedRef = useRef(false)
  const packageCatalogEvent = getPackageCatalogChangedEventName()
  const projectSettingsEvent = getProjectSettingsChangedEventName()
  const usersEvent = getUsersChangedEventName()

  useEffect(() => {
    const handleCatalogChange = () => {
      const nextCategories = getSportCategories().filter((category) => category.isActive)
      const nextCompanies = getCompanies()
      const nextEnrollments = getEnrollments()
      const nextWhatsAppAccounts = getWhatsAppAccounts()
      const nextFields = getFields()
      const nextGroups = getGroups()
      const nextAdditionalServices = getAdditionalServices()
      setCategories(nextCategories)
      setCompanies(nextCompanies)
      setEnrollments(nextEnrollments)
      setWhatsAppAccounts(nextWhatsAppAccounts)
      setFields(nextFields)
      setPlatformGroups(nextGroups)
      setAdditionalServices(nextAdditionalServices)
      setPackages(getPackages())
      setDraft((prev) => ({
        ...prev,
        categoryId: (() => {
          if (prev.categoryId && nextCategories.some((item) => item.id === prev.categoryId)) {
            return prev.categoryId
          }
          return nextCategories[0]?.id ?? ''
        })(),
        companyId:
          prev.companyId && nextCompanies.some((item) => item.id === prev.companyId)
            ? prev.companyId
            : (nextCompanies[0]?.id ?? ''),
        enrollmentId:
          prev.enrollmentId && nextEnrollments.some((item) => item.id === prev.enrollmentId)
            ? prev.enrollmentId
            : (nextEnrollments[0]?.id ?? ''),
        whatsappAccountIds: prev.whatsappAccountIds.filter((id) =>
          nextWhatsAppAccounts.some((account) => account.id === id),
        ),
        additionalFixedServices: prev.additionalFixedServices.filter((selection) =>
          nextAdditionalServices.some((service) => service.id === selection.serviceId && service.type === 'fixed'),
        ),
        additionalVariableServices: prev.additionalVariableServices.filter((selection) =>
          nextAdditionalServices.some((service) => service.id === selection.serviceId && service.type === 'variable'),
        ),
        groups: (() => {
          const nextCategoryId =
            prev.categoryId && nextCategories.some((item) => item.id === prev.categoryId)
              ? prev.categoryId
              : (nextCategories[0]?.id ?? '')
          return prev.groups
            .map((group) => nextGroups.find((item) => item.id === group.id))
            .filter((group): group is UtilityGroup => Boolean(group))
            .filter((group) => group.audience === prev.audience)
            .map((group) => ({
              ...(prev.groups.find((item) => item.id === group.id) ?? group),
              id: group.id,
              title: group.title,
              birthYearMin: group.birthYearMin,
              birthYearMax: group.birthYearMax,
              fieldId: (() => {
                const currentFieldId = prev.groups.find((item) => item.id === group.id)?.fieldId ?? ''
                const isCurrentFieldValid =
                  !!currentFieldId &&
                  nextFields.some((field) => field.id === currentFieldId && field.categoryId === nextCategoryId)
                if (isCurrentFieldValid) {
                  return currentFieldId
                }
                return nextFields.find((field) => field.categoryId === nextCategoryId)?.id ?? ''
              })(),
              schedules: prev.groups.find((item) => item.id === group.id)?.schedules ?? [createPackageGroupSchedule()],
            }))
        })(),
      }))
    }

    window.addEventListener(packageCatalogEvent, handleCatalogChange)
    return () => window.removeEventListener(packageCatalogEvent, handleCatalogChange)
  }, [packageCatalogEvent])

  useEffect(() => {
    const handleProjectSettingsChange = () => {
      const settings = getProjectSettings()
      setPaymentCurrency(settings.paymentCurrency || 'EUR')
      setGoogleMapsApiKey(settings.googleMapsApiKey || '')
    }
    window.addEventListener(projectSettingsEvent, handleProjectSettingsChange)
    return () => window.removeEventListener(projectSettingsEvent, handleProjectSettingsChange)
  }, [projectSettingsEvent])

  useEffect(() => {
    const handleUsersChange = () => {
      setTrainers(getUsers().filter((user) => user.role === 'trainer'))
    }
    window.addEventListener(usersEvent, handleUsersChange)
    return () => window.removeEventListener(usersEvent, handleUsersChange)
  }, [usersEvent])

  const initializeTrainingAddressAutocomplete = useCallback(() => {
    if (!isModalOpen || !googleMapsApiKey.trim() || trainingAddressAutocompleteInitializedRef.current) {
      return
    }
    const inputElement = trainingAddressInputRef.current
    if (!inputElement) {
      return
    }

    loadGooglePlacesScript(googleMapsApiKey)
      .then(() => {
        if (!window.google?.maps?.places || trainingAddressAutocompleteInitializedRef.current) {
          return
        }
        const autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
          fields: ['formatted_address', 'name'],
          types: ['address'],
        })
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          const nextAddress = (place.formatted_address ?? place.name ?? inputElement.value ?? '').trim()
          if (!nextAddress) {
            return
          }
          setDraft((prev) => ({
            ...prev,
            trainingAddress: nextAddress,
          }))
        })
        trainingAddressAutocompleteInitializedRef.current = true
      })
      .catch(() => {
        trainingAddressAutocompleteInitializedRef.current = false
      })
  }, [googleMapsApiKey, isModalOpen])

  useEffect(() => {
    if (!isModalOpen) {
      trainingAddressAutocompleteInitializedRef.current = false
      return
    }
    trainingAddressAutocompleteInitializedRef.current = false
    initializeTrainingAddressAutocomplete()
  }, [initializeTrainingAddressAutocomplete, isModalOpen])

  const categoryLabelById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.label])),
    [categories],
  )
  const companyLabelById = useMemo(
    () => new Map(companies.map((company) => [company.id, company.title])),
    [companies],
  )
  const packageById = useMemo(() => new Map(packages.map((item) => [item.id, item])), [packages])
  const fieldById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields])
  const availableUtilityGroups = useMemo(
    () =>
      platformGroups.filter((group) => {
        return group.audience === draft.audience
      }),
    [draft.audience, platformGroups],
  )
  const categoryFields = useMemo(
    () => fields.filter((field) => field.categoryId === draft.categoryId),
    [draft.categoryId, fields],
  )
  const trainerRoleLabel = useMemo(() => getRoleLabels().trainer ?? 'Trainer', [])
  const fixedAdditionalServices = useMemo(
    () => additionalServices.filter((service) => service.type === 'fixed' && service.isActive),
    [additionalServices],
  )
  const variableAdditionalServices = useMemo(
    () => additionalServices.filter((service) => service.type === 'variable' && service.isActive),
    [additionalServices],
  )
  const additionalServiceById = useMemo(
    () => new Map(additionalServices.map((service) => [service.id, service])),
    [additionalServices],
  )

  const openCreateModal = () => {
    setIsError(false)
    setMessage('')
    setDraft({
      productId: `product-${Date.now().toString(36)}`,
      editionYear: currentYear,
      name: '',
      description: '',
      disclaimer: '',
      categoryId: categories[0]?.id ?? '',
      companyId: companies[0]?.id ?? '',
      enrollmentId: enrollments[0]?.id ?? '',
      enrollmentPrice: 0,
      trainerIds: [],
      whatsappAccountIds: [],
      whatsappGroupLink: '',
      additionalFixedServices: [],
      additionalVariableServices: [],
      audience: 'adult',
      ageMin: 18,
      ageMax: 99,
      durationType: 'single-event',
      eventDate: '',
      eventTime: '',
      periodStartDate: '',
      periodEndDate: '',
      gallery: [],
      groups: [],
      recurringPaymentEnabled: false,
      paymentFrequency: 'monthly',
      priceAmount: 0,
      monthlyDueDay: null,
      monthlyNextCycleOpenDay: null,
      weeklyDueWeekday: null,
      firstPaymentOnSite: false,
      trainingAddress: '',
      entriesCount: 1,
      userSelectableSchedule: false,
      contractHeaderImage: '',
      contractHeaderText: '',
      contractRegulation: '',
      featuredImage: '',
      isFeatured: false,
      isDescriptive: false,
    })
    setModalMode('create')
    setEditingId(null)
    setActiveTab('general-info')
    setEditingGalleryImageId(null)
    setGalleryCaptionDraft('')
    setIsGroupModalOpen(false)
    setEditingGroupIndex(null)
    setIsModalOpen(true)
  }

  const openEditModal = useCallback((item: SportPackage) => {
    setIsError(false)
    setMessage('')
    setDraft({
      productId: item.productId,
      editionYear: item.editionYear,
      name: item.name,
      description: item.description,
      disclaimer: item.disclaimer ?? '',
      categoryId: item.categoryId,
      companyId: item.companyId,
      enrollmentId: item.enrollmentId ?? enrollments[0]?.id ?? '',
      enrollmentPrice: item.enrollmentPrice ?? 0,
      trainerIds: item.trainerIds ?? [],
      whatsappAccountIds: item.whatsappAccountIds ?? [],
      whatsappGroupLink: item.whatsappGroupLink ?? '',
      additionalFixedServices: item.additionalFixedServices ?? [],
      additionalVariableServices: item.additionalVariableServices ?? [],
      audience: item.audience,
      ageMin: item.ageMin ?? 18,
      ageMax: item.ageMax ?? 99,
      durationType: item.durationType ?? 'single-event',
      eventDate: item.eventDate ?? '',
      eventTime: item.eventTime ?? '',
      periodStartDate: item.periodStartDate ?? '',
      periodEndDate: item.periodEndDate ?? '',
      gallery: item.gallery ?? [],
      groups: item.groups ?? [],
      recurringPaymentEnabled: item.recurringPaymentEnabled ?? false,
      paymentFrequency: item.paymentFrequency ?? 'monthly',
      priceAmount: item.priceAmount ?? 0,
      monthlyDueDay: item.monthlyDueDay ?? null,
      monthlyNextCycleOpenDay: item.monthlyNextCycleOpenDay ?? null,
      weeklyDueWeekday: item.weeklyDueWeekday ?? null,
      firstPaymentOnSite: item.firstPaymentOnSite ?? false,
      trainingAddress: item.trainingAddress ?? '',
      entriesCount:
        item.entriesCount ??
        (item.recurringPaymentEnabled && item.paymentFrequency === 'daily' ? null : 1),
      userSelectableSchedule: item.userSelectableSchedule ?? false,
      contractHeaderImage: item.contractHeaderImage ?? '',
      contractHeaderText: item.contractHeaderText ?? '',
      contractRegulation: item.contractRegulation ?? '',
      featuredImage: item.featuredImage,
      isFeatured: item.isFeatured ?? false,
      isDescriptive: item.isDescriptive ?? false,
    })
    setModalMode('edit')
    setEditingId(item.id)
    setActiveTab('general-info')
    setEditingGalleryImageId(null)
    setGalleryCaptionDraft('')
    setIsGroupModalOpen(false)
    setEditingGroupIndex(null)
    setIsModalOpen(true)
  }, [enrollments])

  const applyPackageError = (
    error:
      | 'invalid'
      | 'invalidEdition'
      | 'duplicateEditionYear'
      | 'invalidAgeRange'
      | 'invalidDuration'
      | 'invalidPayment'
      | 'invalidEnrollment'
      | 'invalidWhatsAppAccounts'
      | 'invalidAdditionalServices'
      | 'invalidGroups'
      | 'categoryNotFound'
      | 'companyNotFound'
      | 'notFound',
  ) => {
    setIsError(true)
    if (error === 'categoryNotFound') {
      setMessage(t('utility.packages.invalidCategory'))
      return
    }
    if (error === 'companyNotFound') {
      setMessage(t('utility.packages.invalidCompany'))
      return
    }
    if (error === 'invalidAgeRange') {
      setMessage(t('utility.packages.invalidAgeRange'))
      return
    }
    if (error === 'invalidEdition') {
      setMessage('Compila codice prodotto e anno edizione validi.')
      return
    }
    if (error === 'duplicateEditionYear') {
      setMessage('Esiste già una edizione con questo anno per il prodotto selezionato.')
      return
    }
    if (error === 'invalidDuration') {
      setMessage(t('utility.packages.invalidDuration'))
      return
    }
    if (error === 'invalidPayment') {
      setMessage(t('utility.packages.invalidPayment'))
      return
    }
    if (error === 'invalidGroups') {
      setMessage(t('utility.packages.invalidGroups'))
      return
    }
    if (error === 'invalidEnrollment') {
      setMessage(t('utility.packages.invalidEnrollment'))
      return
    }
    if (error === 'invalidWhatsAppAccounts') {
      setMessage(t('utility.packages.invalidWhatsAppAccounts'))
      return
    }
    if (error === 'invalidAdditionalServices') {
      setMessage(t('utility.packages.invalidAdditionalServices'))
      return
    }
    setMessage(t('utility.packages.invalidData'))
  }

  const handleGalleryUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files
    if (!fileList || fileList.length === 0) {
      return
    }
    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'))
    if (files.length === 0) {
      event.target.value = ''
      return
    }

    try {
      const images = await Promise.all(files.map((file) => readImageFileAsDataUrl(file)))
      const newImages: PackageGalleryImage[] = images.map((src) => ({
        id: `gallery-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        src,
        caption: '',
      }))
      setDraft((prev) => ({
        ...prev,
        gallery: [...prev.gallery, ...newImages],
      }))
    } catch {
      setIsError(true)
      setMessage(t('utility.packages.galleryUploadError'))
    } finally {
      event.target.value = ''
    }
  }

  const handleContractHeaderImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    try {
      const imageDataUrl = await readImageFileAsDataUrl(file)
      setDraft((prev) => ({
        ...prev,
        contractHeaderImage: imageDataUrl,
      }))
    } catch {
      setIsError(true)
      setMessage(t('utility.packages.contractHeaderImageUploadError'))
    } finally {
      event.target.value = ''
    }
  }

  const openCaptionEditor = (image: PackageGalleryImage) => {
    setEditingGalleryImageId(image.id)
    setGalleryCaptionDraft(image.caption)
  }

  const saveCaption = () => {
    if (!editingGalleryImageId) {
      return
    }
    setDraft((prev) => ({
      ...prev,
      gallery: prev.gallery.map((item) =>
        item.id === editingGalleryImageId
          ? {
              ...item,
              caption: galleryCaptionDraft.trim(),
            }
          : item,
      ),
    }))
    setEditingGalleryImageId(null)
    setGalleryCaptionDraft('')
  }

  const removeGalleryImage = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      gallery: prev.gallery.filter((item) => item.id !== id),
    }))
    if (editingGalleryImageId === id) {
      setEditingGalleryImageId(null)
      setGalleryCaptionDraft('')
    }
  }

  const closeGroupModal = () => {
    setIsGroupModalOpen(false)
    setEditingGroupIndex(null)
  }

  const openCreateGroupModal = () => {
    const selectedIds = new Set(draft.groups.map((group) => group.id))
    const nextGroup = availableUtilityGroups.find((group) => !selectedIds.has(group.id))
    if (!nextGroup) {
      setIsError(true)
      setMessage(t('utility.packages.noUtilityGroupsOption'))
      return
    }
    setGroupDraft({
      ...mapUtilityGroupToPackageGroup(nextGroup),
      fieldId: categoryFields[0]?.id ?? '',
    })
    setGroupModalMode('create')
    setEditingGroupIndex(null)
    setIsGroupModalOpen(true)
  }

  const openEditGroupModal = (index: number) => {
    const current = draft.groups[index]
    if (!current) {
      return
    }
    setGroupDraft({
      ...current,
      schedules: current.schedules.length > 0 ? current.schedules : [createPackageGroupSchedule()],
    })
    setGroupModalMode('edit')
    setEditingGroupIndex(index)
    setIsGroupModalOpen(true)
  }

  const saveGroupModal = () => {
    const selectedUtilityGroup = availableUtilityGroups.find((group) => group.id === groupDraft.id)
    if (!selectedUtilityGroup) {
      setIsError(true)
      setMessage(t('utility.packages.noUtilityGroupsOption'))
      return
    }
    const normalizedGroup: PackageGroup = {
      ...groupDraft,
      id: selectedUtilityGroup.id,
      title: selectedUtilityGroup.title,
      birthYearMin: selectedUtilityGroup.birthYearMin,
      birthYearMax: selectedUtilityGroup.birthYearMax,
      fieldId:
        categoryFields.some((field) => field.id === groupDraft.fieldId)
          ? groupDraft.fieldId
          : (categoryFields[0]?.id ?? ''),
      schedules:
        groupDraft.schedules.length > 0
          ? groupDraft.schedules
          : [createPackageGroupSchedule()],
    }
    setDraft((prev) => {
      if (groupModalMode === 'edit' && editingGroupIndex !== null) {
        return {
          ...prev,
          groups: prev.groups.map((group, index) => (index === editingGroupIndex ? normalizedGroup : group)),
        }
      }
      return {
        ...prev,
        groups: [...prev.groups, normalizedGroup],
      }
    })
    closeGroupModal()
  }

  const formatGroupScheduleSummary = useCallback(
    (schedules: PackageGroupSchedule[]) => {
      const byTime = new Map<string, number[]>()
      schedules.forEach((schedule) => {
        const existing = byTime.get(schedule.time) ?? []
        byTime.set(schedule.time, [...existing, schedule.weekday])
      })
      const weekdayOrder = WEEK_DAYS.map((item) => item.value)
      return Array.from(byTime.entries()).map(([time, weekdays]) => {
        const dayLabels = [...new Set(weekdays)]
          .sort((left, right) => weekdayOrder.indexOf(left) - weekdayOrder.indexOf(right))
          .map((weekday) => t(WEEK_DAYS.find((day) => day.value === weekday)?.labelKey ?? 'utility.packages.weekdayMonday'))
        return `${dayLabels.join(' + ')} ${t('utility.packages.groupTimeLabel')}: ${time}`
      })
    },
    [t],
  )

  const handleSubmit = () => {
    const result =
      modalMode === 'create'
        ? createSportPackage(draft)
        : editingId
          ? updateSportPackage(editingId, draft)
          : { ok: false as const, error: 'notFound' as const }

    if (!result.ok) {
      applyPackageError(result.error)
      return
    }

    setPackages(getPackages())
    setIsError(false)
    setMessage(modalMode === 'create' ? t('utility.packages.created') : t('utility.packages.updated'))
    closeGroupModal()
    setIsModalOpen(false)
  }

  const closePackageModal = () => {
    closeGroupModal()
    setIsModalOpen(false)
    setIsError(false)
    setMessage('')
  }

  const openPackageWhatsAppGroup = (item: SportPackage) => {
    const rawLink = item.whatsappGroupLink.trim()
    if (!rawLink) {
      setIsError(true)
      setMessage(t('utility.packages.whatsappGroupLinkMissing'))
      return
    }
    const href = /^https?:\/\//i.test(rawLink) ? rawLink : `https://${rawLink}`
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const handleDelete = useCallback((item: SportPackage) => {
    const confirmed = window.confirm(t('utility.packages.confirmDelete', { title: item.name }))
    if (!confirmed) {
      return
    }

    const result = removeSportPackage(item.id)
    if (!result.ok) {
      setIsError(true)
      setMessage(t('utility.packages.invalidData'))
      return
    }

    setPackages(getPackages())
    setIsError(false)
    setMessage(t('utility.packages.deleted'))
  }, [t])

  const formatPackageFrequency = useCallback(
    (item: Pick<SportPackage, 'recurringPaymentEnabled' | 'paymentFrequency'>): string => {
      if (!item.recurringPaymentEnabled) {
        return '-'
      }
      const keyByFrequency: Record<PackagePaymentFrequency, string> = {
        daily: 'utility.packages.paymentFrequencyDaily',
        weekly: 'utility.packages.paymentFrequencyWeekly',
        monthly: 'utility.packages.paymentFrequencyMonthly',
        yearly: 'utility.packages.paymentFrequencyYearly',
      }
      return t(keyByFrequency[item.paymentFrequency])
    },
    [t],
  )

  const formatPackagePriceByPeriod = useCallback(
    (item: Pick<SportPackage, 'recurringPaymentEnabled' | 'paymentFrequency' | 'priceAmount'>): string => {
      const amount = Number.isFinite(item.priceAmount) ? Number(item.priceAmount) : 0
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: paymentCurrency,
          maximumFractionDigits: 2,
        }).format(amount)
      } catch {
        return `${amount} ${paymentCurrency}`
      }
    },
    [paymentCurrency],
  )

  type ProductRow = {
    productId: string
    name: string
    categoryId: string
    companyId: string
    audience: AudienceCode
    ageMin: number
    ageMax: number
    durationType: PackageDurationType
    eventDate: string
    eventTime: string
    periodStartDate: string
    periodEndDate: string
    recurringPaymentEnabled: boolean
    paymentFrequency: PackagePaymentFrequency
    priceAmount: number
    whatsappGroupLink: string
    editionsCount: number
    latestEditionYear: number
    latestEditionId: string
  }

  const productRows = useMemo<ProductRow[]>(() => {
    const grouped = new Map<string, SportPackage[]>()
    packages.forEach((item) => {
      const key = item.productId || `product-${item.id}`
      const existing = grouped.get(key) ?? []
      grouped.set(key, [...existing, item])
    })
    return Array.from(grouped.entries()).map(([productId, editions]) => {
      const sorted = [...editions].sort((left, right) => right.editionYear - left.editionYear)
      const latest = sorted[0]
      return {
        productId,
        name: latest?.name ?? productId,
        categoryId: latest?.categoryId ?? '',
        companyId: latest?.companyId ?? '',
        audience: latest?.audience ?? 'adult',
        ageMin: latest?.ageMin ?? 0,
        ageMax: latest?.ageMax ?? 0,
        durationType: latest?.durationType ?? 'single-event',
        eventDate: latest?.eventDate ?? '',
        eventTime: latest?.eventTime ?? '',
        periodStartDate: latest?.periodStartDate ?? '',
        periodEndDate: latest?.periodEndDate ?? '',
        recurringPaymentEnabled: latest?.recurringPaymentEnabled ?? false,
        paymentFrequency: latest?.paymentFrequency ?? 'monthly',
        priceAmount: latest?.priceAmount ?? 0,
        whatsappGroupLink: latest?.whatsappGroupLink ?? '',
        editionsCount: sorted.length,
        latestEditionYear: latest?.editionYear ?? currentYear,
        latestEditionId: latest?.id ?? '',
      }
    })
  }, [currentYear, packages])

  const selectedProductEditions = useMemo(
    () =>
      selectedProductId
        ? packages
            .filter((item) => item.productId === selectedProductId)
            .sort((left, right) => right.editionYear - left.editionYear)
        : [],
    [packages, selectedProductId],
  )

  const highPrioritySet = useMemo(() => new Set(highPriorityColumns), [highPriorityColumns])
  const columnOrder = useMemo(() => [...priorityOrder, 'actions'], [priorityOrder])

  const columnLabelById = useMemo<Record<PackageTableColumnId, string>>(
    () => ({
      name: t('utility.packages.nameLabel'),
      ageRange: t('utility.packages.ageRangeLabel'),
      period: 'Periodo',
      paymentFrequency: t('utility.packages.paymentFrequencyLabel'),
      priceByPeriod: t('utility.packages.pricePerPeriodLabel'),
      category: t('utility.packages.categoryLabel'),
      company: t('utility.packages.companyLabel'),
      audience: t('utility.packages.audienceLabel'),
    }),
    [t],
  )

  const filteredProducts = useMemo(() => {
    const lockedPackageId = searchParams.get('packageId')
    const lockedProductId = lockedPackageId
      ? (packages.find((item) => item.id === lockedPackageId)?.productId ?? null)
      : null
    const normalizedSearch = searchQuery.trim().toLowerCase()
    const ageMinFilter = filterAgeMin.trim() === '' ? null : Number(filterAgeMin)
    const ageMaxFilter = filterAgeMax.trim() === '' ? null : Number(filterAgeMax)
    return productRows.filter((item) => {
      if (lockedProductId && item.productId !== lockedProductId) {
        return false
      }
      if (filterCategoryId && item.categoryId !== filterCategoryId) {
        return false
      }
      if (filterCompanyId && item.companyId !== filterCompanyId) {
        return false
      }
      if (filterAudience !== 'all' && item.audience !== filterAudience) {
        return false
      }
      if (filterFrequency === 'non-recurring' && item.recurringPaymentEnabled) {
        return false
      }
      if (
        filterFrequency !== 'all' &&
        filterFrequency !== 'non-recurring' &&
        (!item.recurringPaymentEnabled || item.paymentFrequency !== filterFrequency)
      ) {
        return false
      }
      if (ageMinFilter !== null && Number.isFinite(ageMinFilter) && item.ageMin < ageMinFilter) {
        return false
      }
      if (ageMaxFilter !== null && Number.isFinite(ageMaxFilter) && item.ageMax > ageMaxFilter) {
        return false
      }
      if (!normalizedSearch) {
        return true
      }
      const categoryLabel = categoryLabelById.get(item.categoryId) ?? ''
      const companyLabel = companyLabelById.get(item.companyId) ?? ''
      const frequencyLabel = formatPackageFrequency(item)
      const audienceLabel = item.audience === 'adult' ? t('utility.packages.audienceAdult') : t('utility.packages.audienceYouth')
      const periodLabel =
        item.durationType === 'period'
          ? `${item.periodStartDate} ${item.periodEndDate}`
          : `${item.eventDate} ${item.eventTime}`
      const haystack = `${item.name} ${categoryLabel} ${companyLabel} ${frequencyLabel} ${audienceLabel} ${item.ageMin} ${item.ageMax} ${periodLabel}`.toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [
    categoryLabelById,
    companyLabelById,
    filterAgeMax,
    filterAgeMin,
    filterAudience,
    filterCategoryId,
    filterCompanyId,
    filterFrequency,
    formatPackageFrequency,
    packages,
    productRows,
    searchQuery,
    searchParams,
    t,
  ])

  const resetFilters = () => {
    setSearchQuery('')
    setFilterCategoryId('')
    setFilterCompanyId('')
    setFilterAudience('all')
    setFilterFrequency('all')
    setFilterAgeMin('')
    setFilterAgeMax('')
    const next = new URLSearchParams(searchParams)
    next.delete('packageId')
    setSearchParams(next, { replace: true })
  }

  const openEditionsModal = (productId: string) => {
    setSelectedProductId(productId)
    setIsEditionsModalOpen(true)
  }

  const closeEditionsModal = () => {
    setIsEditionsModalOpen(false)
    setSelectedProductId(null)
  }

  const openCreateEditionFromProduct = (productId: string) => {
    const editions = packages
      .filter((item) => item.productId === productId)
      .sort((left, right) => right.editionYear - left.editionYear)
    const source = editions[0]
    if (!source) {
      return
    }
    setIsError(false)
    setMessage('')
    setDraft({
      ...source,
      productId,
      editionYear: source.editionYear + 1,
    })
    setModalMode('create')
    setEditingId(null)
    setActiveTab('general-info')
    setEditingGalleryImageId(null)
    setGalleryCaptionDraft('')
    setIsGroupModalOpen(false)
    setEditingGroupIndex(null)
    setIsModalOpen(true)
  }

  const openPriorityModal = () => {
    setPriorityDraftOrder(priorityOrder)
    setPriorityDraftHighColumns(highPriorityColumns)
    setIsPriorityModalOpen(true)
  }

  const applyPriorityModal = () => {
    setPriorityOrder(priorityDraftOrder)
    setHighPriorityColumns(priorityDraftHighColumns)
    setIsPriorityModalOpen(false)
  }

  const movePriorityItem = (id: PackageTableColumnId, direction: 'up' | 'down') => {
    setPriorityDraftOrder((prev) => {
      const index = prev.indexOf(id)
      if (index < 0) {
        return prev
      }
      if (direction === 'up' && index === 0) {
        return prev
      }
      if (direction === 'down' && index === prev.length - 1) {
        return prev
      }
      const next = [...prev]
      const swapIndex = direction === 'up' ? index - 1 : index + 1
      ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
      return next
    })
  }

  const columns = useMemo<ColumnDef<ProductRow>[]>(
    () => [
      {
        id: 'name',
        header: t('utility.packages.nameLabel'),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
        meta: { responsivePriority: highPrioritySet.has('name') ? 'high' : 'low' },
      },
      {
        id: 'ageRange',
        header: t('utility.packages.ageRangeLabel'),
        cell: ({ row }) => <span>{`${row.original.ageMin} - ${row.original.ageMax}`}</span>,
        meta: { responsivePriority: highPrioritySet.has('ageRange') ? 'high' : 'low' },
      },
      {
        id: 'period',
        header: 'Periodo',
        cell: ({ row }) =>
          row.original.durationType === 'period'
            ? <span>{`${row.original.periodStartDate} - ${row.original.periodEndDate}`}</span>
            : <span>{`${row.original.eventDate} ${row.original.eventTime}`.trim() || '-'}</span>,
        meta: { responsivePriority: highPrioritySet.has('period') ? 'high' : 'low' },
      },
      {
        id: 'paymentFrequency',
        header: t('utility.packages.paymentFrequencyLabel'),
        cell: ({ row }) => <span>{formatPackageFrequency(row.original)}</span>,
        meta: { responsivePriority: highPrioritySet.has('paymentFrequency') ? 'high' : 'low' },
      },
      {
        id: 'priceByPeriod',
        header: t('utility.packages.pricePerPeriodLabel'),
        cell: ({ row }) => <span>{formatPackagePriceByPeriod(row.original)}</span>,
        meta: { responsivePriority: highPrioritySet.has('priceByPeriod') ? 'high' : 'low' },
      },
      {
        id: 'category',
        header: t('utility.packages.categoryLabel'),
        cell: ({ row }) => <span>{categoryLabelById.get(row.original.categoryId) ?? '-'}</span>,
        meta: { responsivePriority: highPrioritySet.has('category') ? 'high' : 'low' },
      },
      {
        id: 'company',
        header: t('utility.packages.companyLabel'),
        cell: ({ row }) => <span>{companyLabelById.get(row.original.companyId) ?? '-'}</span>,
        meta: { responsivePriority: highPrioritySet.has('company') ? 'high' : 'low' },
      },
      {
        id: 'audience',
        header: t('utility.packages.audienceLabel'),
        cell: ({ row }) => (
          <span>
            {row.original.audience === 'adult'
              ? t('utility.packages.audienceAdult')
              : t('utility.packages.audienceYouth')}
          </span>
        ),
        meta: { responsivePriority: highPrioritySet.has('audience') ? 'high' : 'low' },
      },
      {
        id: 'actions',
        header: () => <div className="text-right">{t('utility.categories.actions')}</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm px-1"
              onClick={() => openEditionsModal(row.original.productId)}
              aria-label="Edizioni"
              title="Edizioni"
            >
              {row.original.editionsCount}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm px-1 text-success"
              onClick={() => {
                const latestEdition = packageById.get(row.original.latestEditionId)
                if (latestEdition) {
                  openPackageWhatsAppGroup(latestEdition)
                }
              }}
              aria-label={t('utility.packages.openWhatsAppGroupAction')}
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm px-1 text-warning"
              onClick={() => {
                const latestEdition = packageById.get(row.original.latestEditionId)
                if (latestEdition) {
                  openEditModal(latestEdition)
                }
              }}
              aria-label={t('utility.categories.edit')}
            >
              <SquarePen className="h-4 w-4" />
            </button>
          </div>
        ),
        meta: { responsivePriority: 'high' as const },
      },
    ],
    [
      categoryLabelById,
      companyLabelById,
      formatPackageFrequency,
      formatPackagePriceByPeriod,
      highPrioritySet,
      openPackageWhatsAppGroup,
      openEditionsModal,
      openEditModal,
      packageById,
      t,
    ],
  )

  const table = useReactTable({
    data: filteredProducts,
    columns,
    state: {
      columnOrder,
    },
    getCoreRowModel: getCoreRowModel(),
  })

  const selectedPeriodRange: DateRange | undefined =
    draft.durationType === 'period'
      ? {
          from: parseIsoDate(draft.periodStartDate),
          to: parseIsoDate(draft.periodEndDate),
        }
      : undefined
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleGalleryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }
    setDraft((prev) => {
      const oldIndex = prev.gallery.findIndex((item) => item.id === String(active.id))
      const newIndex = prev.gallery.findIndex((item) => item.id === String(over.id))
      if (oldIndex < 0 || newIndex < 0) {
        return prev
      }
      return {
        ...prev,
        gallery: arrayMove(prev.gallery, oldIndex, newIndex),
      }
    })
  }

  const entriesMax = useMemo(
    () => getEntriesMaxForFrequency(draft.recurringPaymentEnabled, draft.paymentFrequency),
    [draft.paymentFrequency, draft.recurringPaymentEnabled],
  )
  const hideEntriesCount = draft.recurringPaymentEnabled && draft.paymentFrequency === 'daily'
  const mapEmbedSource = useMemo(() => {
    const address = draft.trainingAddress.trim()
    if (!address) {
      return ''
    }
    const encodedAddress = encodeURIComponent(address)
    if (googleMapsApiKey.trim()) {
      return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(googleMapsApiKey)}&q=${encodedAddress}`
    }
    return `https://www.google.com/maps?q=${encodedAddress}&output=embed`
  }, [draft.trainingAddress, googleMapsApiKey])

  const mapUtilityGroupToPackageGroup = useCallback((group: UtilityGroup): PackageGroup => ({
    id: group.id,
    title: group.title,
    birthYearMin: group.birthYearMin,
    birthYearMax: group.birthYearMax,
    fieldId: categoryFields[0]?.id ?? '',
    schedules: [createPackageGroupSchedule()],
  }), [categoryFields])

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{t('utility.packages.title')}</h2>
          <p className="text-sm opacity-70">{t('utility.packages.description')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          {t('utility.packages.create')}
        </button>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body space-y-4">
          {message && !isModalOpen && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                isError ? 'bg-error/15 text-error' : 'bg-success/15 text-success'
              }`}
            >
              {message}
            </p>
          )}

          <div className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-3">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-12">
              <label className="form-control lg:col-span-3">
                <span className="label-text mb-1 text-xs">{t('utility.packages.searchLabel')}</span>
                <input
                  className="input input-bordered w-full"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('utility.packages.searchPlaceholder')}
                />
              </label>
              <label className="form-control lg:col-span-1">
                <span className="label-text mb-1 text-xs">{t('utility.packages.categoryLabel')}</span>
                <select className="select select-bordered w-full" value={filterCategoryId} onChange={(event) => setFilterCategoryId(event.target.value)}>
                  <option value="">{t('utility.packages.filterAllOption')}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control lg:col-span-1">
                <span className="label-text mb-1 text-xs">{t('utility.packages.companyLabel')}</span>
                <select className="select select-bordered w-full" value={filterCompanyId} onChange={(event) => setFilterCompanyId(event.target.value)}>
                  <option value="">{t('utility.packages.filterAllOption')}</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control lg:col-span-1">
                <span className="label-text mb-1 text-xs">{t('utility.packages.audienceLabel')}</span>
                <select
                  className="select select-bordered w-full"
                  value={filterAudience}
                  onChange={(event) => setFilterAudience(event.target.value as 'all' | AudienceCode)}
                >
                  <option value="all">{t('utility.packages.filterAllOption')}</option>
                  <option value="adult">{t('utility.packages.audienceAdult')}</option>
                  <option value="youth">{t('utility.packages.audienceYouth')}</option>
                </select>
              </label>
              <label className="form-control lg:col-span-2">
                <span className="label-text mb-1 text-xs">{t('utility.packages.paymentFrequencyLabel')}</span>
                <select
                  className="select select-bordered w-full"
                  value={filterFrequency}
                  onChange={(event) =>
                    setFilterFrequency(event.target.value as 'all' | 'non-recurring' | PackagePaymentFrequency)
                  }
                >
                  <option value="all">{t('utility.packages.filterAllOption')}</option>
                  <option value="non-recurring">{t('utility.packages.nonRecurringFrequency')}</option>
                  {PAYMENT_FREQUENCIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {t(item.labelKey)}
                    </option>
                    ))}
                </select>
              </label>
              <label className="form-control lg:col-span-1">
                <span className="label-text mb-1 text-xs">{t('utility.packages.filterAgeMin')}</span>
                <input
                  type="number"
                  min={0}
                  className="input input-bordered w-full"
                  value={filterAgeMin}
                  onChange={(event) => setFilterAgeMin(event.target.value)}
                />
              </label>
              <label className="form-control lg:col-span-1">
                <span className="label-text mb-1 text-xs">{t('utility.packages.filterAgeMax')}</span>
                <input
                  type="number"
                  min={0}
                  className="input input-bordered w-full"
                  value={filterAgeMax}
                  onChange={(event) => setFilterAgeMax(event.target.value)}
                />
              </label>
              <div className="lg:col-span-2 flex items-end justify-end gap-2">
                <button type="button" className="btn btn-outline btn-sm" onClick={openPriorityModal}>
                  {t('utility.packages.columnPriorityButton')}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={resetFilters}>
                  {t('common.resetFilters')}
                </button>
              </div>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <p className="text-sm opacity-70">{t('utility.packages.empty')}</p>
          ) : (
            <DataTable table={table} />
          )}
        </div>
      </div>

      {isEditionsModalOpen && selectedProductId && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Edizioni prodotto</h3>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => openCreateEditionFromProduct(selectedProductId)}
              >
                Nuova edizione
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-zebra table-sm">
                <thead>
                  <tr>
                    <th>Anno</th>
                    <th>Nome</th>
                    <th>{t('utility.packages.paymentFrequencyLabel')}</th>
                    <th>{t('utility.packages.pricePerPeriodLabel')}</th>
                    <th className="text-right">{t('utility.categories.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProductEditions.map((edition) => (
                    <tr key={edition.id}>
                      <td>{edition.editionYear}</td>
                      <td>{edition.name}</td>
                      <td>{formatPackageFrequency(edition)}</td>
                      <td>{formatPackagePriceByPeriod(edition)}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm px-1 text-warning"
                            onClick={() => openEditModal(edition)}
                            aria-label={t('utility.categories.edit')}
                          >
                            <SquarePen className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm px-1 text-error"
                            onClick={() => handleDelete(edition)}
                            aria-label={t('utility.categories.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedProductEditions.length === 0 && <p className="text-sm opacity-70">Nessuna edizione presente.</p>}
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={closeEditionsModal}>
                {t('utility.categories.cancelEdit')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeEditionsModal} />
        </dialog>
      )}

      {isPriorityModalOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-2xl space-y-4">
            <h3 className="text-lg font-semibold">{t('utility.packages.columnPriorityModalTitle')}</h3>
            <p className="text-sm opacity-70">{t('utility.packages.columnPriorityModalHelp')}</p>

            <div className="space-y-2">
              {priorityDraftOrder.map((columnId, index) => {
                const isHigh = priorityDraftHighColumns.includes(columnId)
                return (
                  <div key={`priority-${columnId}`} className="grid items-center gap-2 rounded-lg border border-base-300 p-2 md:grid-cols-[1fr_auto_auto_auto]">
                    <span className="text-sm">{columnLabelById[columnId]}</span>
                    <label className="label cursor-pointer justify-start gap-2 p-0">
                      <span className="label-text text-xs">{t('utility.packages.columnPriorityHighLabel')}</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-sm"
                        checked={isHigh}
                        onChange={(event) =>
                          setPriorityDraftHighColumns((prev) =>
                            event.target.checked ? [...new Set([...prev, columnId])] : prev.filter((item) => item !== columnId),
                          )
                        }
                      />
                    </label>
                    <div className="flex gap-1">
                      <button type="button" className="btn btn-ghost btn-xs" disabled={index === 0} onClick={() => movePriorityItem(columnId, 'up')}>
                        {t('utility.packages.columnMoveUp')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        disabled={index === priorityDraftOrder.length - 1}
                        onClick={() => movePriorityItem(columnId, 'down')}
                      >
                        {t('utility.packages.columnMoveDown')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setIsPriorityModalOpen(false)}>
                {t('utility.categories.cancelEdit')}
              </button>
              <button type="button" className="btn btn-primary" onClick={applyPriorityModal}>
                {t('common.save')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={() => setIsPriorityModalOpen(false)} />
        </dialog>
      )}

      {isModalOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box h-screen w-screen max-w-none space-y-4 rounded-none">
            <h3 className="text-lg font-semibold">
              {modalMode === 'create' ? t('utility.packages.create') : t('utility.categories.saveEdit')}
            </h3>
            {message && (
              <p
                className={`rounded-lg px-3 py-2 text-sm ${
                  isError ? 'bg-error/15 text-error' : 'bg-success/15 text-success'
                }`}
              >
                {message}
              </p>
            )}

            <div>
              <div className="tabs tabs-lift">
                <button
                  type="button"
                  className={`tab ${activeTab === 'general-info' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('general-info')}
                >
                  {t('utility.packages.generalInfoTab')}
                </button>
                <button
                  type="button"
                  className={`tab ${activeTab === 'gallery' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('gallery')}
                >
                  {t('utility.packages.galleryTab')}
                </button>
                <button
                  type="button"
                  className={`tab ${activeTab === 'duration' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('duration')}
                >
                  {t('utility.packages.durationTab')}
                </button>
                <button
                  type="button"
                  className={`tab ${activeTab === 'payments' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('payments')}
                >
                  {t('utility.packages.paymentsTab')}
                </button>
                <button
                  type="button"
                  className={`tab ${activeTab === 'enrollments' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('enrollments')}
                >
                  {t('utility.packages.enrollmentsTab')}
                </button>
                <button
                  type="button"
                  className={`tab ${activeTab === 'additional-services' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('additional-services')}
                >
                  {t('utility.packages.additionalServicesTab')}
                </button>
                <button
                  type="button"
                  className={`tab ${activeTab === 'groups' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('groups')}
                >
                  {t('utility.packages.groupsTab')}
                </button>
                <button
                  type="button"
                  className={`tab ${activeTab === 'trainers' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('trainers')}
                >
                  {trainerRoleLabel}
                </button>
                <button
                  type="button"
                  className={`tab ${activeTab === 'contract' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('contract')}
                >
                  {t('utility.packages.contractTab')}
                </button>
                <button
                  type="button"
                  className={`tab ${activeTab === 'whatsapp' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('whatsapp')}
                >
                  {t('utility.packages.whatsappTab')}
                </button>
              </div>
              <div className="rounded-b-lg rounded-tr-lg border border-base-300 p-4">
                {activeTab === 'general-info' && (
                  <div className="grid gap-5 md:grid-cols-12">
                    <div className="space-y-4 md:col-span-9">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs">Codice prodotto</span>
                          <input
                            className="input input-bordered w-full mb-4"
                            value={draft.productId}
                            onChange={(event) =>
                              setDraft((prev) => ({
                                ...prev,
                                productId: normalizeProductId(event.target.value),
                              }))
                            }
                            placeholder="product-calcio-u14"
                          />
                        </label>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs">Anno edizione</span>
                          <input
                            type="number"
                            min={2000}
                            max={2100}
                            className="input input-bordered w-full mb-4"
                            value={draft.editionYear}
                            onChange={(event) =>
                              setDraft((prev) => ({
                                ...prev,
                                editionYear: Math.max(2000, Math.min(2100, Math.trunc(event.target.valueAsNumber || currentYear))),
                              }))
                            }
                          />
                        </label>
                      </div>

                      <label className="form-control">
                        <span className="label-text mb-1 text-xs">{t('utility.packages.nameLabel')}</span>
                        <input
                          className="input input-bordered w-full"
                          value={draft.name}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              name: event.target.value,
                            }))
                          }
                          placeholder={t('utility.packages.namePlaceholder')}
                        />
                      </label>

                      <div className="form-control">
                        <span className="label-text mb-1 text-xs">{t('utility.packages.descriptionLabel')}</span>
                        <RichTextEditor
                          value={draft.description}
                          onChange={(nextValue) =>
                            setDraft((prev) => ({
                              ...prev,
                              description: nextValue,
                            }))
                          }
                          placeholder={t('utility.packages.descriptionPlaceholder')}
                          minHeightClassName="min-h-72"
                        />
                      </div>

                      <label className="form-control">
                        <span className="label-text mb-1 text-xs">Disclaimer</span>
                        <textarea
                          className="textarea textarea-bordered w-full mb-4"
                          rows={3}
                          value={draft.disclaimer}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              disclaimer: event.target.value,
                            }))
                          }
                          placeholder="Inserisci disclaimer per slide homepage"
                        />
                      </label>

                      <div className="space-y-2 rounded-lg border border-base-300 p-3">
                        <p className="text-xs font-medium">{t('utility.packages.ageRangeLabel')}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="form-control">
                            <span className="label-text mb-1 text-xs">{t('utility.packages.ageMinLabel')}</span>
                            <input
                              type="number"
                              min={0}
                              max={120}
                              className="input input-bordered w-full mb-4"
                              value={draft.ageMin}
                              onChange={(event) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  ageMin: Math.max(0, Math.trunc(event.target.valueAsNumber || 0)),
                                }))
                              }
                            />
                          </label>
                          <label className="form-control">
                            <span className="label-text mb-1 text-xs">{t('utility.packages.ageMaxLabel')}</span>
                            <input
                              type="number"
                              min={0}
                              max={120}
                              className="input input-bordered w-full"
                              value={draft.ageMax}
                              onChange={(event) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  ageMax: Math.max(0, Math.trunc(event.target.valueAsNumber || 0)),
                                }))
                              }
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 md:col-span-3">
                      <label className="form-control">
                        <span className="label-text mb-1 text-xs">{t('utility.packages.audienceLabel')}</span>
                        <select
                          className="select select-bordered w-full"
                          value={draft.audience}
                          onChange={(event) => {
                            const nextAudience = event.target.value as AudienceCode
                            setDraft((prev) => ({
                              ...prev,
                              audience: nextAudience,
                              groups: prev.groups.filter((group) => {
                                const utilityGroup = platformGroups.find((item) => item.id === group.id)
                                return utilityGroup?.audience === nextAudience
                              }),
                            }))
                          }}
                        >
                          {PACKAGE_AUDIENCES.map((item) => (
                            <option key={item.value} value={item.value}>
                              {t(item.labelKey)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="form-control">
                        <span className="label-text mb-1 text-xs">{t('utility.packages.categoryLabel')}</span>
                        <select
                          className="select select-bordered w-full"
                          value={draft.categoryId}
                          onChange={(event) => {
                            const nextCategoryId = event.target.value
                            setDraft((prev) => ({
                              ...prev,
                              categoryId: nextCategoryId,
                              groups: prev.groups
                                .map((group) => {
                                  const utilityGroup = platformGroups.find((item) => item.id === group.id)
                                  if (!utilityGroup) {
                                    return null
                                  }
                                  const field = fieldById.get(group.fieldId)
                                  return {
                                    ...group,
                                    fieldId:
                                      field && field.categoryId === nextCategoryId
                                        ? group.fieldId
                                        : (fields.find((item) => item.categoryId === nextCategoryId)?.id ?? ''),
                                  }
                                })
                                .filter((group): group is PackageGroup => Boolean(group)),
                            }))
                          }}
                        >
                          {categories.length === 0 && (
                            <option value="">{t('utility.packages.noCategoryOption')}</option>
                          )}
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="form-control">
                        <span className="label-text mb-1 text-xs">{t('utility.packages.companyLabel')}</span>
                        <select
                          className="select select-bordered w-full"
                          value={draft.companyId}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              companyId: event.target.value,
                            }))
                          }
                        >
                          {companies.length === 0 && (
                            <option value="">{t('utility.packages.noCompanyOption')}</option>
                          )}
                          {companies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.title}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="space-y-2">
                        <p className="text-xs">{t('utility.packages.featuredImageLabel')}</p>
                        <input
                          type="file"
                          className="file-input file-input-bordered w-full"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (!file || !file.type.startsWith('image/')) {
                              return
                            }
                            const reader = new FileReader()
                            reader.onload = () => {
                              const result = typeof reader.result === 'string' ? reader.result : ''
                              if (!result) {
                                return
                              }
                              setDraft((prev) => ({
                                ...prev,
                                featuredImage: result,
                              }))
                            }
                            reader.readAsDataURL(file)
                          }}
                        />
                        {draft.featuredImage && (
                          <div className="rounded-lg border border-base-300 p-2">
                            <img
                              src={draft.featuredImage}
                              alt={draft.name || 'featured'}
                              className="h-28 w-full rounded object-cover"
                            />
                          </div>
                        )}
                      </div>

                      <label className="flex items-center justify-between rounded-lg border border-base-300 px-3 py-2">
                        <span className="text-xs">{t('utility.packages.isFeaturedLabel')}</span>
                        <input
                          type="checkbox"
                          className="toggle toggle-primary"
                          checked={draft.isFeatured}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              isFeatured: event.target.checked,
                            }))
                          }
                        />
                      </label>

                      <label className="flex items-center justify-between rounded-lg border border-base-300 px-3 py-2">
                        <span className="text-xs">{t('utility.packages.isDescriptiveLabel')}</span>
                        <input
                          type="checkbox"
                          className="toggle toggle-primary"
                          checked={draft.isDescriptive}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              isDescriptive: event.target.checked,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}
                {activeTab === 'gallery' && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-base-300 p-4">
                      <p className="mb-2 text-xs font-medium">{t('utility.packages.galleryUploadLabel')}</p>
                      <input
                        type="file"
                        className="file-input file-input-bordered w-full max-w-md"
                        accept="image/*"
                        multiple
                        onChange={handleGalleryUpload}
                      />
                    </div>

                    {draft.gallery.length === 0 ? (
                      <p className="text-sm opacity-70">{t('utility.packages.galleryEmpty')}</p>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleGalleryDragEnd}>
                          <SortableContext items={draft.gallery.map((item) => item.id)} strategy={rectSortingStrategy}>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                              {draft.gallery.map((image) => (
                                <GallerySortableCard
                                  key={image.id}
                                  image={image}
                                  onEditCaption={openCaptionEditor}
                                  onRemove={removeGalleryImage}
                                  captionLabel={t('utility.packages.galleryCaptionLabel')}
                                  emptyCaptionLabel={t('utility.packages.galleryNoCaption')}
                                  removeLabel={t('utility.packages.galleryRemove')}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>

                        <aside className="space-y-3 rounded-lg border border-base-300 p-4">
                          <p className="text-xs font-medium">{t('utility.packages.galleryCaptionEditor')}</p>
                          {editingGalleryImageId ? (
                            <>
                              <textarea
                                className="textarea textarea-bordered min-h-28 w-full"
                                value={galleryCaptionDraft}
                                onChange={(event) => setGalleryCaptionDraft(event.target.value)}
                                placeholder={t('utility.packages.galleryCaptionPlaceholder')}
                              />
                              <div className="flex gap-2">
                                <button type="button" className="btn btn-primary btn-sm" onClick={saveCaption}>
                                  {t('common.save')}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => {
                                    setEditingGalleryImageId(null)
                                    setGalleryCaptionDraft('')
                                  }}
                                >
                                  {t('utility.categories.cancelEdit')}
                                </button>
                              </div>
                            </>
                          ) : (
                            <p className="text-sm opacity-70">{t('utility.packages.galleryCaptionHelp')}</p>
                          )}
                        </aside>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'duration' && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-base-300 p-4">
                      <p className="mb-2 text-xs font-medium">{t('utility.packages.eventTypeLabel')}</p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <label className="label cursor-pointer justify-start gap-2">
                          <input
                            type="radio"
                            name="package-duration-type"
                            className="radio radio-primary radio-sm"
                            checked={draft.durationType === 'single-event'}
                            onChange={() =>
                              setDraft((prev) => ({
                                ...prev,
                                durationType: 'single-event' as PackageDurationType,
                                periodStartDate: '',
                                periodEndDate: '',
                              }))
                            }
                          />
                          <span className="label-text">{t('utility.packages.durationSingleEvent')}</span>
                        </label>
                        <label className="label cursor-pointer justify-start gap-2">
                          <input
                            type="radio"
                            name="package-duration-type"
                            className="radio radio-primary radio-sm"
                            checked={draft.durationType === 'period'}
                            onChange={() =>
                              setDraft((prev) => ({
                                ...prev,
                                durationType: 'period' as PackageDurationType,
                                eventDate: '',
                                eventTime: '',
                              }))
                            }
                          />
                          <span className="label-text">{t('utility.packages.durationPeriod')}</span>
                        </label>
                      </div>
                    </div>

                    {draft.durationType === 'single-event' && (
                      <div className="grid gap-4 rounded-lg border border-base-300 p-4 sm:grid-cols-2">
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs">{t('utility.packages.eventDateLabel')}</span>
                          <input
                            type="date"
                            className="input input-bordered w-full"
                            value={draft.eventDate}
                            onChange={(event) =>
                              setDraft((prev) => ({
                                ...prev,
                                eventDate: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs">{t('utility.packages.eventTimeLabel')}</span>
                          <input
                            type="time"
                            className="input input-bordered w-full"
                            value={draft.eventTime}
                            onChange={(event) =>
                              setDraft((prev) => ({
                                ...prev,
                                eventTime: event.target.value,
                              }))
                            }
                          />
                        </label>
                      </div>
                    )}

                    {draft.durationType === 'period' && (
                      <div className="space-y-3 rounded-lg border border-base-300 p-4">
                        <p className="text-xs opacity-70">{t('utility.packages.periodRangeHelp')}</p>
                        <div className="overflow-x-auto">
                          <DayPicker
                            mode="range"
                            selected={selectedPeriodRange}
                            onSelect={(range) =>
                              setDraft((prev) => ({
                                ...prev,
                                periodStartDate: toIsoDate(range?.from),
                                periodEndDate: toIsoDate(range?.to),
                              }))
                            }
                            numberOfMonths={2}
                            fixedWeeks
                            showOutsideDays
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="form-control">
                            <span className="label-text mb-1 text-xs">{t('utility.packages.periodStartLabel')}</span>
                            <input type="date" className="input input-bordered w-full" value={draft.periodStartDate} readOnly />
                          </label>
                          <label className="form-control">
                            <span className="label-text mb-1 text-xs">{t('utility.packages.periodEndLabel')}</span>
                            <input type="date" className="input input-bordered w-full" value={draft.periodEndDate} readOnly />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'payments' && (
                  <div className="max-w-2xl space-y-4">
                    <label className="flex items-center justify-between rounded-lg border border-base-300 px-3 py-2">
                      <span className="text-sm">{t('utility.packages.recurringPaymentLabel')}</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary"
                        checked={draft.recurringPaymentEnabled}
                        onChange={(event) =>
                          setDraft((prev) => {
                            const isRecurring = event.target.checked
                            const limit = getEntriesMaxForFrequency(isRecurring, prev.paymentFrequency)
                            const nextEntries =
                              isRecurring && prev.paymentFrequency === 'daily'
                                ? null
                                : Math.max(
                                    1,
                                    Math.min(
                                      limit ?? Number.POSITIVE_INFINITY,
                                      Number.isInteger(prev.entriesCount) && (prev.entriesCount ?? 0) > 0
                                        ? (prev.entriesCount as number)
                                        : 1,
                                    ),
                                  )
                            return {
                              ...prev,
                              recurringPaymentEnabled: isRecurring,
                              monthlyDueDay: isRecurring && prev.paymentFrequency === 'monthly' ? (prev.monthlyDueDay ?? 1) : null,
                              monthlyNextCycleOpenDay:
                                isRecurring && prev.paymentFrequency === 'monthly'
                                  ? (prev.monthlyNextCycleOpenDay ?? 1)
                                  : null,
                              weeklyDueWeekday: isRecurring && prev.paymentFrequency === 'weekly' ? (prev.weeklyDueWeekday ?? 1) : null,
                              entriesCount: nextEntries,
                            }
                          })
                        }
                      />
                    </label>

                    {draft.recurringPaymentEnabled ? (
                      <>
                        <label className="form-control max-w-sm mb-4">
                          <span className="label-text mb-1 text-xs">{t('utility.packages.paymentFrequencyLabel')}</span>
                          <select
                            className="select select-bordered w-full"
                            value={draft.paymentFrequency}
                            onChange={(event) =>
                              setDraft((prev) => {
                                const nextFrequency = event.target.value as PackagePaymentFrequency
                                const limit = getEntriesMaxForFrequency(prev.recurringPaymentEnabled, nextFrequency)
                                const nextEntries =
                                  prev.recurringPaymentEnabled && nextFrequency === 'daily'
                                    ? null
                                    : Math.max(
                                        1,
                                        Math.min(
                                          limit ?? Number.POSITIVE_INFINITY,
                                          Number.isInteger(prev.entriesCount) && (prev.entriesCount ?? 0) > 0
                                            ? (prev.entriesCount as number)
                                            : 1,
                                        ),
                                      )
                                return {
                                  ...prev,
                                  paymentFrequency: nextFrequency,
                                  monthlyDueDay: nextFrequency === 'monthly' ? (prev.monthlyDueDay ?? 1) : null,
                                  monthlyNextCycleOpenDay: nextFrequency === 'monthly' ? (prev.monthlyNextCycleOpenDay ?? 1) : null,
                                  weeklyDueWeekday: nextFrequency === 'weekly' ? (prev.weeklyDueWeekday ?? 1) : null,
                                  entriesCount: nextEntries,
                                }
                              })
                            }
                          >
                            {PAYMENT_FREQUENCIES.map((item) => (
                              <option key={item.value} value={item.value}>
                                {t(item.labelKey)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="mb-4">
                          <label className="form-control max-w-sm">
                            <span className="label-text mb-1 text-xs">
                              {t('utility.packages.priceByFrequencyLabel', {
                                frequency: t(
                                  PAYMENT_FREQUENCIES.find((item) => item.value === draft.paymentFrequency)?.labelKey ??
                                    'utility.packages.paymentFrequencyMonthly',
                                ),
                                currency: paymentCurrency,
                              })}
                            </span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="input input-bordered w-full"
                              value={draft.priceAmount}
                              onChange={(event) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  priceAmount: Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : 0,
                                }))
                              }
                            />
                          </label>
                        </div>

                        {draft.paymentFrequency === 'monthly' && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="form-control max-w-sm">
                              <span className="label-text mb-1 text-xs">{t('utility.packages.monthlyDueDayLabel')}</span>
                              <select
                                className="select select-bordered w-full"
                                value={draft.monthlyDueDay ?? 1}
                                onChange={(event) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    monthlyDueDay: Number(event.target.value),
                                  }))
                                }
                              >
                                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                                  <option key={day} value={day}>
                                    {day}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="form-control max-w-sm">
                              <span className="label-text mb-1 text-xs">{t('utility.packages.monthlyNextCycleDayLabel')}</span>
                              <select
                                className="select select-bordered w-full"
                                value={draft.monthlyNextCycleOpenDay ?? 1}
                                onChange={(event) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    monthlyNextCycleOpenDay: Number(event.target.value),
                                  }))
                                }
                              >
                                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                                  <option key={day} value={day}>
                                    {day}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )}

                        {draft.paymentFrequency === 'weekly' && (
                          <label className="form-control max-w-sm">
                            <span className="label-text mb-1 text-xs">{t('utility.packages.weeklyDueWeekdayLabel')}</span>
                            <select
                              className="select select-bordered w-full"
                              value={draft.weeklyDueWeekday ?? 1}
                              onChange={(event) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  weeklyDueWeekday: Number(event.target.value),
                                }))
                              }
                            >
                              {WEEK_DAYS.map((day) => (
                                <option key={day.value} value={day.value}>
                                  {t(day.labelKey)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </>
                    ) : (
                      <div className="mb-4">
                        <label className="form-control w-full">
                          <span className="label-text mb-1 text-xs">
                            {t('utility.packages.priceLabel', { currency: paymentCurrency })}
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="input input-bordered w-full"
                            value={draft.priceAmount}
                            onChange={(event) =>
                              setDraft((prev) => ({
                                ...prev,
                                priceAmount: Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : 0,
                              }))
                            }
                          />
                        </label>
                      </div>
                    )}

                    <label className="flex items-center justify-between rounded-lg border border-base-300 px-3 py-2">
                      <span className="text-sm">{t('utility.packages.firstPaymentOnSiteLabel')}</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary"
                        checked={draft.firstPaymentOnSite}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            firstPaymentOnSite: event.target.checked,
                          }))
                        }
                      />
                    </label>
                  </div>
                )}
                {activeTab === 'groups' && (
                  <div className="space-y-4">
                    <div className="grid gap-4 rounded-lg border border-base-300 p-4 lg:grid-cols-2">
                      <div className="space-y-4">
                        <label className="form-control mb-4">
                          <span className="label-text mb-1 text-xs">{t('utility.packages.trainingAddressLabel')}</span>
                          <input
                            ref={trainingAddressInputRef}
                            className="input input-bordered w-full"
                            autoComplete="off"
                            value={draft.trainingAddress}
                            onFocus={initializeTrainingAddressAutocomplete}
                            onChange={(event) =>
                              setDraft((prev) => ({
                                ...prev,
                                trainingAddress: event.target.value,
                              }))
                            }
                            placeholder={t('utility.packages.trainingAddressPlaceholder')}
                          />
                        </label>

                        {!hideEntriesCount && (
                          <label className="form-control max-w-sm mb-4">
                            <span className="label-text mb-1 text-xs">
                              {entriesMax
                                ? t('utility.packages.entriesCountLabelWithMax', { max: entriesMax })
                                : t('utility.packages.entriesCountLabel')}
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={entriesMax ?? undefined}
                              className="input input-bordered w-full mb-4"
                              value={draft.entriesCount ?? 1}
                              onChange={(event) => {
                                const raw = Number(event.target.valueAsNumber)
                                const fallback = Number.isInteger(draft.entriesCount) && (draft.entriesCount ?? 0) > 0 ? (draft.entriesCount as number) : 1
                                const next = Number.isFinite(raw) ? Math.trunc(raw) : fallback
                                const clamped = Math.max(1, Math.min(entriesMax ?? Number.POSITIVE_INFINITY, next))
                                setDraft((prev) => ({
                                  ...prev,
                                  entriesCount: clamped,
                                }))
                              }}
                            />
                          </label>
                        )}

                        <label className="flex items-center justify-between rounded-lg border border-base-300 px-3 py-2">
                          <span className="text-sm">{t('utility.packages.userSelectableScheduleLabel')}</span>
                          <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={draft.userSelectableSchedule}
                            onChange={(event) =>
                              setDraft((prev) => ({
                                ...prev,
                                userSelectableSchedule: event.target.checked,
                              }))
                            }
                          />
                        </label>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium">{t('utility.packages.trainingMapLabel')}</p>
                        {mapEmbedSource ? (
                          <iframe
                            title={t('utility.packages.trainingMapLabel')}
                            src={mapEmbedSource}
                            className="h-72 w-full rounded-lg border border-base-300"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        ) : (
                          <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-base-300 p-4 text-center text-sm opacity-70">
                            {t('utility.packages.trainingMapEmpty')}
                          </div>
                        )}
                        {!googleMapsApiKey.trim() && (
                          <p className="text-xs opacity-70">{t('utility.packages.trainingMapNoApiKeyHint')}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border border-base-300 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{t('utility.packages.groupsTab')}</p>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={openCreateGroupModal}
                          disabled={availableUtilityGroups.length === 0 || draft.groups.length >= availableUtilityGroups.length}
                        >
                          {t('utility.packages.groupsAdd')}
                        </button>
                      </div>
                      <p className="text-xs opacity-70">{t('utility.packages.groupsSelectHint')}</p>

                      {draft.groups.length === 0 ? (
                        <p className="text-sm opacity-70">{t('utility.packages.groupsEmpty')}</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="table table-zebra table-sm">
                            <thead>
                              <tr>
                                <th>{t('utility.packages.groupSelectLabel')}</th>
                                <th>{t('utility.packages.groupYearRangeLabel')}</th>
                                <th>{t('utility.packages.groupGenderLabel')}</th>
                                <th>{t('utility.packages.groupFieldLabel')}</th>
                                <th>{t('utility.packages.groupScheduleLabel')}</th>
                                <th className="text-right">{t('utility.categories.actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {draft.groups.map((group, index) => {
                                const selectedUtilityGroup = platformGroups.find((item) => item.id === group.id)
                                const groupField = fieldById.get(group.fieldId)
                                const scheduleLines = formatGroupScheduleSummary(group.schedules)
                                return (
                                  <tr key={`pkg-group-row-${index}`}>
                                    <td>{selectedUtilityGroup?.title ?? group.title}</td>
                                    <td>
                                      {group.birthYearMin === group.birthYearMax
                                        ? group.birthYearMin
                                        : `${group.birthYearMin} - ${group.birthYearMax}`}
                                    </td>
                                    <td>
                                      {selectedUtilityGroup?.gender === 'male'
                                        ? t('utility.groups.genderMale')
                                        : selectedUtilityGroup?.gender === 'female'
                                          ? t('utility.groups.genderFemale')
                                          : t('utility.groups.genderMixed')}
                                    </td>
                                    <td>{groupField?.title ?? '-'}</td>
                                    <td>
                                      <div className="space-y-1">
                                        {scheduleLines.map((line) => (
                                          <p key={`${group.id}-${line}`} className="text-xs">
                                            {line}
                                          </p>
                                        ))}
                                      </div>
                                    </td>
                                    <td>
                                      <div className="flex justify-end gap-1">
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-sm px-1 text-warning"
                                          onClick={() => openEditGroupModal(index)}
                                          aria-label={t('utility.categories.edit')}
                                        >
                                          <SquarePen className="h-4 w-4" />
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-sm px-1 text-error"
                                          onClick={() =>
                                            setDraft((prev) => ({
                                              ...prev,
                                              groups: prev.groups.filter((_, groupIndex) => groupIndex !== index),
                                            }))
                                          }
                                          aria-label={t('utility.categories.delete')}
                                        >
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

                    {isGroupModalOpen && (
                      <dialog className="modal modal-open">
                        <div className="modal-box max-w-3xl space-y-4">
                          <h4 className="text-lg font-semibold">
                            {groupModalMode === 'create' ? t('utility.packages.groupsAdd') : t('utility.categories.saveEdit')}
                          </h4>
                          <label className="form-control mb-4">
                            <span className="label-text mb-1 text-xs">{t('utility.packages.groupSelectLabel')}</span>
                            <select
                              className="select select-bordered w-full mb-4"
                              value={groupDraft.id}
                              onChange={(event) => {
                                const next = availableUtilityGroups.find((item) => item.id === event.target.value)
                                if (!next) {
                                  return
                                }
                                setGroupDraft((prev) => ({
                                  ...prev,
                                  id: next.id,
                                  title: next.title,
                                  birthYearMin: next.birthYearMin,
                                  birthYearMax: next.birthYearMax,
                                }))
                              }}
                            >
                              {availableUtilityGroups
                                .filter((item) => {
                                  if (item.id === groupDraft.id) {
                                    return true
                                  }
                                  return !draft.groups.some((group, index) => {
                                    if (groupModalMode === 'edit' && editingGroupIndex === index) {
                                      return false
                                    }
                                    return group.id === item.id
                                  })
                                })
                                .map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.title}
                                  </option>
                                ))}
                            </select>
                          </label>

                          <label className="form-control mb-4">
                            <span className="label-text mb-1 text-xs">{t('utility.packages.groupFieldLabel')}</span>
                            <select
                              className="select select-bordered w-full mb-4"
                              value={groupDraft.fieldId}
                              onChange={(event) =>
                                setGroupDraft((prev) => ({
                                  ...prev,
                                  fieldId: event.target.value,
                                }))
                              }
                            >
                              {categoryFields.length === 0 && (
                                <option value="">{t('utility.packages.noFieldOption')}</option>
                              )}
                              {categoryFields.map((field) => (
                                <option key={field.id} value={field.id}>
                                  {field.title}
                                </option>
                              ))}
                            </select>
                          </label>

                          <div className="space-y-2 rounded-lg border border-base-300 p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium">{t('utility.packages.groupScheduleLabel')}</p>
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                onClick={() =>
                                  setGroupDraft((prev) => ({
                                    ...prev,
                                    schedules: [...prev.schedules, createPackageGroupSchedule()],
                                  }))
                                }
                              >
                                {t('utility.packages.groupScheduleAdd')}
                              </button>
                            </div>
                            <div className="space-y-2">
                              {groupDraft.schedules.map((schedule) => (
                                <div key={schedule.id} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                                  <label className="form-control mb-4">
                                    <span className="label-text mb-1 text-xs">{t('utility.packages.groupWeekdayLabel')}</span>
                                    <select
                                      className="select select-bordered w-full mb-4"
                                      value={schedule.weekday}
                                      onChange={(event) =>
                                        setGroupDraft((prev) => ({
                                          ...prev,
                                          schedules: prev.schedules.map((entry) =>
                                            entry.id === schedule.id ? { ...entry, weekday: Number(event.target.value) } : entry,
                                          ),
                                        }))
                                      }
                                    >
                                      {WEEK_DAYS.map((day) => (
                                        <option key={day.value} value={day.value}>
                                          {t(day.labelKey)}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="form-control mb-4">
                                    <span className="label-text mb-1 text-xs">{t('utility.packages.groupTimeLabel')}</span>
                                    <input
                                      type="time"
                                      className="input input-bordered w-full mb-4"
                                      value={schedule.time}
                                      onChange={(event) =>
                                        setGroupDraft((prev) => ({
                                          ...prev,
                                          schedules: prev.schedules.map((entry) =>
                                            entry.id === schedule.id ? { ...entry, time: event.target.value } : entry,
                                          ),
                                        }))
                                      }
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-xs px-1 text-error"
                                    disabled={groupDraft.schedules.length <= 1}
                                    onClick={() =>
                                      setGroupDraft((prev) => ({
                                        ...prev,
                                        schedules:
                                          prev.schedules.length > 1
                                            ? prev.schedules.filter((entry) => entry.id !== schedule.id)
                                            : prev.schedules,
                                      }))
                                    }
                                  >
                                    {t('utility.packages.groupScheduleRemove')}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="modal-action">
                            <button type="button" className="btn btn-ghost" onClick={closeGroupModal}>
                              {t('utility.categories.cancelEdit')}
                            </button>
                            <button type="button" className="btn btn-primary" onClick={saveGroupModal}>
                              {groupModalMode === 'create' ? t('utility.packages.groupsAdd') : t('utility.categories.saveEdit')}
                            </button>
                          </div>
                        </div>
                        <button type="button" className="modal-backdrop" onClick={closeGroupModal} />
                      </dialog>
                    )}
                  </div>
                )}
                {activeTab === 'enrollments' && (
                  <div className="max-w-2xl space-y-4">
                    <label className="form-control max-w-md">
                      <span className="label-text mb-1 text-xs">{t('utility.packages.enrollmentTypeLabel')}</span>
                      <select
                        className="select select-bordered w-full"
                        value={draft.enrollmentId}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            enrollmentId: event.target.value,
                          }))
                        }
                      >
                        {enrollments.length === 0 && (
                          <option value="">{t('utility.packages.noEnrollmentOption')}</option>
                        )}
                        {enrollments.map((enrollment) => (
                          <option key={enrollment.id} value={enrollment.id}>
                            {enrollment.title}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="form-control max-w-sm">
                      <span className="label-text mb-1 text-xs">{t('utility.packages.enrollmentPriceLabel')}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input input-bordered w-full"
                        value={draft.enrollmentPrice}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            enrollmentPrice: Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : 0,
                          }))
                        }
                      />
                    </label>
                  </div>
                )}
                {activeTab === 'whatsapp' && (
                  <div className="max-w-3xl space-y-4">
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('utility.packages.whatsappGroupLinkLabel')}</span>
                      <input
                        className="input input-bordered w-full mb-4"
                        value={draft.whatsappGroupLink}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            whatsappGroupLink: event.target.value,
                          }))
                        }
                        placeholder={t('utility.packages.whatsappGroupLinkPlaceholder')}
                      />
                    </label>

                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{t('utility.packages.whatsappAccountsLabel')}</p>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          setDraft((prev) => {
                            const selectedIds = new Set(prev.whatsappAccountIds)
                            const nextAccount = whatsappAccounts.find((account) => !selectedIds.has(account.id))
                            if (!nextAccount) {
                              return prev
                            }
                            return {
                              ...prev,
                              whatsappAccountIds: [...prev.whatsappAccountIds, nextAccount.id],
                            }
                          })
                        }
                      >
                        {t('utility.packages.addWhatsAppAccount')}
                      </button>
                    </div>

                    {draft.whatsappAccountIds.length === 0 ? (
                      <p className="text-sm opacity-70">{t('utility.packages.noWhatsAppAccountsSelected')}</p>
                    ) : (
                      <div className="space-y-2">
                        {draft.whatsappAccountIds.map((accountId, index) => (
                          <div key={`whatsapp-row-${index}`} className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
                            <label className="form-control">
                              <span className="label-text mb-1 text-xs">{t('utility.packages.whatsappAccountSelectLabel')}</span>
                              <select
                                className="select select-bordered w-full mb-4"
                                value={accountId}
                                onChange={(event) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    whatsappAccountIds: prev.whatsappAccountIds.map((item, itemIndex) =>
                                      itemIndex === index ? event.target.value : item,
                                    ),
                                  }))
                                }
                              >
                                {whatsappAccounts.length === 0 && (
                                  <option value="">{t('utility.packages.noWhatsAppAccountsOption')}</option>
                                )}
                                {whatsappAccounts
                                  .filter(
                                    (account) =>
                                      account.id === accountId ||
                                      !draft.whatsappAccountIds.some(
                                        (selectedId, selectedIndex) =>
                                          selectedIndex !== index && selectedId === account.id,
                                      ),
                                  )
                                  .map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.title}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm px-1 text-error"
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  whatsappAccountIds: prev.whatsappAccountIds.filter((_, itemIndex) => itemIndex !== index),
                                }))
                              }
                            >
                              {t('utility.packages.removeWhatsAppAccount')}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'trainers' && (
                  <div className="max-w-3xl space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{trainerRoleLabel}</p>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            trainerIds: [...prev.trainerIds, trainers[0]?.id ?? 0].filter((id) => id > 0),
                          }))
                        }
                      >
                        {t('utility.packages.trainersAdd')}
                      </button>
                    </div>

                    {draft.trainerIds.length === 0 ? (
                      <p className="text-sm opacity-70">{t('utility.packages.trainersEmpty')}</p>
                    ) : (
                      <div className="space-y-2">
                        {draft.trainerIds.map((trainerId, index) => (
                          <div key={`trainer-row-${index}`} className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
                            <label className="form-control">
                              <span className="label-text mb-1 text-xs">{t('utility.packages.trainerSelectLabel')}</span>
                              <select
                                className="select select-bordered w-full"
                                value={trainerId}
                                onChange={(event) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    trainerIds: prev.trainerIds.map((item, itemIndex) =>
                                      itemIndex === index ? Number(event.target.value) : item,
                                    ),
                                  }))
                                }
                              >
                                {trainers.length === 0 && (
                                  <option value={0}>{t('utility.packages.noTrainerOption')}</option>
                                )}
                                {trainers.map((trainer) => (
                                  <option key={trainer.id} value={trainer.id}>
                                    {trainer.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm px-1 text-error"
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  trainerIds: prev.trainerIds.filter((_, itemIndex) => itemIndex !== index),
                                }))
                              }
                            >
                              {t('utility.packages.trainersRemove')}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'contract' && (
                  <div className="max-w-4xl space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-medium">{t('utility.packages.contractHeaderImageLabel')}</p>
                      <input
                        type="file"
                        accept="image/*"
                        className="file-input file-input-bordered w-full"
                        onChange={handleContractHeaderImageUpload}
                      />
                      {draft.contractHeaderImage && (
                        <div className="space-y-2 rounded-lg border border-base-300 p-3">
                          <img
                            src={draft.contractHeaderImage}
                            alt={t('utility.packages.contractHeaderImageLabel')}
                            className="h-32 w-full rounded object-cover md:h-40"
                          />
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                contractHeaderImage: '',
                              }))
                            }
                          >
                            {t('utility.packages.contractHeaderImageRemove')}
                          </button>
                        </div>
                      )}
                    </div>

                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('utility.packages.contractHeaderTextLabel')}</span>
                      <input
                        className="input input-bordered w-full"
                        value={draft.contractHeaderText}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            contractHeaderText: event.target.value,
                          }))
                        }
                        placeholder={t('utility.packages.contractHeaderTextPlaceholder')}
                      />
                    </label>

                    <div className="form-control">
                      <span className="label-text mb-1 text-xs">{t('utility.packages.contractRegulationLabel')}</span>
                      <RichTextEditor
                        value={draft.contractRegulation}
                        onChange={(nextValue) =>
                          setDraft((prev) => ({
                            ...prev,
                            contractRegulation: nextValue,
                          }))
                        }
                        placeholder={t('utility.packages.contractRegulationPlaceholder')}
                        minHeightClassName="min-h-64"
                      />
                    </div>
                  </div>
                )}
                {activeTab === 'additional-services' && (
                  <div className="max-w-3xl space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{t('utility.packages.fixedServicesLabel')}</p>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setDraft((prev) => {
                              const alreadySelected = new Set(
                                prev.additionalFixedServices.map((selection) => selection.serviceId),
                              )
                              const nextService = fixedAdditionalServices.find((service) => !alreadySelected.has(service.id))
                              if (!nextService) {
                                return prev
                              }
                              return {
                                ...prev,
                                additionalFixedServices: [
                                  ...prev.additionalFixedServices,
                                  { serviceId: nextService.id, isActive: true },
                                ],
                              }
                            })
                          }}
                        >
                          {t('utility.packages.addService')}
                        </button>
                      </div>

                      {draft.additionalFixedServices.length === 0 ? (
                        <p className="text-sm opacity-70">{t('utility.packages.noFixedServicesSelected')}</p>
                      ) : (
                        <div className="space-y-2">
                          {draft.additionalFixedServices.map((selection, index) => (
                            <div key={`fixed-service-row-${index}`} className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
                              <label className="form-control">
                                <span className="label-text mb-1 text-xs">{t('utility.packages.serviceSelectLabel')}</span>
                                <select
                                  className="select select-bordered w-full"
                                  value={selection.serviceId}
                                  onChange={(event) =>
                                    setDraft((prev) => ({
                                      ...prev,
                                      additionalFixedServices: prev.additionalFixedServices.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, serviceId: event.target.value } : item,
                                      ),
                                    }))
                                  }
                                >
                                  {fixedAdditionalServices.length === 0 && (
                                    <option value="">{t('utility.packages.noFixedServicesOption')}</option>
                                  )}
                                  {fixedAdditionalServices
                                    .filter(
                                      (service) =>
                                        service.id === selection.serviceId ||
                                        !draft.additionalFixedServices.some(
                                          (selected, selectedIndex) =>
                                            selectedIndex !== index && selected.serviceId === service.id,
                                        ),
                                    )
                                    .map((service) => (
                                    <option key={service.id} value={service.id}>
                                      {service.title}
                                    </option>
                                    ))}
                                </select>
                              </label>
                              <div className="min-w-28 text-sm opacity-70">
                                {t('utility.packages.servicePriceReadonly', {
                                  price: additionalServiceById.get(selection.serviceId)?.price ?? 0,
                                  currency: paymentCurrency,
                                })}
                              </div>
                              <label className="label cursor-pointer justify-start gap-2 rounded-lg border border-base-300 px-2 py-1">
                                <span className="label-text text-xs">{t('utility.packages.serviceActiveLabel')}</span>
                                <input
                                  type="checkbox"
                                  className="toggle toggle-sm"
                                  checked={selection.isActive}
                                  onChange={(event) =>
                                    setDraft((prev) => ({
                                      ...prev,
                                      additionalFixedServices: prev.additionalFixedServices.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, isActive: event.target.checked } : item,
                                      ),
                                    }))
                                  }
                                />
                              </label>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm px-1 text-error"
                                onClick={() =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    additionalFixedServices: prev.additionalFixedServices.filter(
                                      (_, itemIndex) => itemIndex !== index,
                                    ),
                                  }))
                                }
                              >
                                {t('utility.packages.removeService')}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{t('utility.packages.variableServicesLabel')}</p>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setDraft((prev) => {
                              const alreadySelected = new Set(
                                prev.additionalVariableServices.map((selection) => selection.serviceId),
                              )
                              const nextService = variableAdditionalServices.find((service) => !alreadySelected.has(service.id))
                              if (!nextService) {
                                return prev
                              }
                              return {
                                ...prev,
                                additionalVariableServices: [
                                  ...prev.additionalVariableServices,
                                  { serviceId: nextService.id, isActive: true },
                                ],
                              }
                            })
                          }}
                        >
                          {t('utility.packages.addService')}
                        </button>
                      </div>

                      {draft.additionalVariableServices.length === 0 ? (
                        <p className="text-sm opacity-70">{t('utility.packages.noVariableServicesSelected')}</p>
                      ) : (
                        <div className="space-y-2">
                          {draft.additionalVariableServices.map((selection, index) => (
                            <div key={`variable-service-row-${index}`} className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
                              <label className="form-control">
                                <span className="label-text mb-1 text-xs">{t('utility.packages.serviceSelectLabel')}</span>
                                <select
                                  className="select select-bordered w-full"
                                  value={selection.serviceId}
                                  onChange={(event) =>
                                    setDraft((prev) => ({
                                      ...prev,
                                      additionalVariableServices: prev.additionalVariableServices.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, serviceId: event.target.value } : item,
                                      ),
                                    }))
                                  }
                                >
                                  {variableAdditionalServices.length === 0 && (
                                    <option value="">{t('utility.packages.noVariableServicesOption')}</option>
                                  )}
                                  {variableAdditionalServices
                                    .filter(
                                      (service) =>
                                        service.id === selection.serviceId ||
                                        !draft.additionalVariableServices.some(
                                          (selected, selectedIndex) =>
                                            selectedIndex !== index && selected.serviceId === service.id,
                                        ),
                                    )
                                    .map((service) => (
                                    <option key={service.id} value={service.id}>
                                      {service.title}
                                    </option>
                                    ))}
                                </select>
                              </label>
                              <label className="label cursor-pointer justify-start gap-2 rounded-lg border border-base-300 px-2 py-1">
                                <span className="label-text text-xs">{t('utility.packages.serviceActiveLabel')}</span>
                                <input
                                  type="checkbox"
                                  className="toggle toggle-sm"
                                  checked={selection.isActive}
                                  onChange={(event) =>
                                    setDraft((prev) => ({
                                      ...prev,
                                      additionalVariableServices: prev.additionalVariableServices.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, isActive: event.target.checked } : item,
                                      ),
                                    }))
                                  }
                                />
                              </label>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm px-1 text-error"
                                onClick={() =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    additionalVariableServices: prev.additionalVariableServices.filter(
                                      (_, itemIndex) => itemIndex !== index,
                                    ),
                                  }))
                                }
                              >
                                {t('utility.packages.removeService')}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-action gap-3">
              <button type="button" className="btn btn-ghost" onClick={closePackageModal}>
                {t('utility.categories.cancelEdit')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                {modalMode === 'create' ? t('utility.packages.create') : t('utility.categories.saveEdit')}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            onClick={closePackageModal}
            aria-label={t('utility.categories.cancelEdit')}
          />
        </dialog>
      )}
    </section>
  )
}

export default PackagesPage
