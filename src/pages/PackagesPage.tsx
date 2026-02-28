import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { DndContext, PointerSensor, closestCenter, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, SquarePen, Trash2 } from 'lucide-react'
import { DayPicker, type DateRange } from 'react-day-picker'
import 'react-day-picker/style.css'
import DataTable from '../components/DataTable'
import RichTextEditor from '../components/RichTextEditor'
import {
  createSportPackage,
  getAdditionalServices,
  getCompanies,
  getEnrollments,
  getFields,
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
const WEEKDAY_SORT_ORDER = new Map<number, number>(WEEK_DAYS.map((day, index) => [day.value, index]))
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

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
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

function joinWithConjunction(values: string[], conjunction: string): string {
  if (values.length <= 1) {
    return values[0] ?? ''
  }
  if (values.length === 2) {
    return `${values[0]} ${conjunction} ${values[1]}`
  }
  return `${values.slice(0, -1).join(', ')} ${conjunction} ${values[values.length - 1]}`
}

function formatHour(value: string): string {
  const [hours, minutes] = value.split(':')
  if (!hours || !minutes) {
    return value
  }
  return `${hours.padStart(2, '0')}.${minutes.padStart(2, '0')}`
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

function createEmptyGroupSchedule(): PackageGroupSchedule {
  return {
    id: `group-schedule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    weekday: 1,
    time: '17:00',
  }
}

function createEmptyGroup(fieldId = ''): PackageGroup {
  const defaultYear = 2014
  return {
    id: `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    birthYearMin: defaultYear,
    birthYearMax: defaultYear,
    fieldId,
    schedules: [createEmptyGroupSchedule()],
  }
}

function isValidGroupDraft(group: PackageGroup): boolean {
  return (
    Boolean(group.title.trim()) &&
    Boolean(group.fieldId.trim()) &&
    Number.isInteger(group.birthYearMin) &&
    Number.isInteger(group.birthYearMax) &&
    group.birthYearMin >= 1900 &&
    group.birthYearMax >= group.birthYearMin &&
    group.birthYearMax <= 2100 &&
    group.schedules.length > 0 &&
    group.schedules.every((item) => Number.isInteger(item.weekday) && item.weekday >= 0 && item.weekday <= 6 && /^\d{2}:\d{2}$/.test(item.time))
  )
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
  const [packages, setPackages] = useState<SportPackage[]>(() => getPackages())
  const [categories, setCategories] = useState(() => getSportCategories().filter((category) => category.isActive))
  const [companies, setCompanies] = useState(() => getCompanies())
  const [enrollments, setEnrollments] = useState<EnrollmentType[]>(() => getEnrollments())
  const [whatsappAccounts, setWhatsAppAccounts] = useState<WhatsAppAccount[]>(() => getWhatsAppAccounts())
  const [fields, setFields] = useState<SportField[]>(() => getFields())
  const [additionalServices, setAdditionalServices] = useState<AdditionalService[]>(() => getAdditionalServices())
  const [trainers, setTrainers] = useState<MockUser[]>(() => getUsers().filter((user) => user.role === 'trainer'))
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<
    'general-info' | 'gallery' | 'duration' | 'payments' | 'enrollments' | 'whatsapp' | 'additional-services' | 'trainers' | 'groups'
  >('general-info')
  const [paymentCurrency, setPaymentCurrency] = useState(() => getProjectSettings().paymentCurrency || 'EUR')
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState(() => getProjectSettings().googleMapsApiKey || '')
  const [draft, setDraft] = useState<SavePackagePayload>({
    name: '',
    description: '',
    categoryId: '',
    companyId: '',
    enrollmentId: '',
    enrollmentPrice: 0,
    trainerIds: [],
    whatsappAccountIds: [],
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
    featuredImage: '',
    isFeatured: false,
    isDescriptive: false,
  })
  const [editingGalleryImageId, setEditingGalleryImageId] = useState<string | null>(null)
  const [galleryCaptionDraft, setGalleryCaptionDraft] = useState('')
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [groupDraft, setGroupDraft] = useState<PackageGroup>(() => createEmptyGroup())
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
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
      const nextAdditionalServices = getAdditionalServices()
      setCategories(nextCategories)
      setCompanies(nextCompanies)
      setEnrollments(nextEnrollments)
      setWhatsAppAccounts(nextWhatsAppAccounts)
      setFields(nextFields)
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
          if (!nextCategoryId) {
            return []
          }
          return prev.groups.filter((group) =>
            nextFields.some((field) => field.id === group.fieldId && field.categoryId === nextCategoryId),
          )
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
  const weekdayLabelByValue = useMemo(
    () => new Map(WEEK_DAYS.map((day) => [day.value, t(day.labelKey)])),
    [t],
  )
  const fieldLabelById = useMemo(() => new Map(fields.map((field) => [field.id, field.title])), [fields])
  const availableGroupFields = useMemo(
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
    setDraft({
      name: '',
      description: '',
      categoryId: categories[0]?.id ?? '',
      companyId: companies[0]?.id ?? '',
      enrollmentId: enrollments[0]?.id ?? '',
      enrollmentPrice: 0,
      trainerIds: [],
      whatsappAccountIds: [],
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
      featuredImage: '',
      isFeatured: false,
      isDescriptive: false,
    })
    setModalMode('create')
    setEditingId(null)
    setActiveTab('general-info')
    setEditingGalleryImageId(null)
    setGalleryCaptionDraft('')
    setGroupModalMode(null)
    setEditingGroupId(null)
    setGroupDraft(createEmptyGroup(availableGroupFields[0]?.id ?? ''))
    setIsModalOpen(true)
  }

  const openEditModal = useCallback((item: SportPackage) => {
    setDraft({
      name: item.name,
      description: item.description,
      categoryId: item.categoryId,
      companyId: item.companyId,
      enrollmentId: item.enrollmentId ?? enrollments[0]?.id ?? '',
      enrollmentPrice: item.enrollmentPrice ?? 0,
      trainerIds: item.trainerIds ?? [],
      whatsappAccountIds: item.whatsappAccountIds ?? [],
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
      featuredImage: item.featuredImage,
      isFeatured: item.isFeatured ?? false,
      isDescriptive: item.isDescriptive ?? false,
    })
    setModalMode('edit')
    setEditingId(item.id)
    setActiveTab('general-info')
    setEditingGalleryImageId(null)
    setGalleryCaptionDraft('')
    setGroupModalMode(null)
    setEditingGroupId(null)
    const firstCategoryField = fields.find((field) => field.categoryId === item.categoryId)
    setGroupDraft(createEmptyGroup(item.groups[0]?.fieldId ?? firstCategoryField?.id ?? ''))
    setIsModalOpen(true)
  }, [enrollments, fields])

  const applyPackageError = (
    error:
      | 'invalid'
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

  const openCreateGroupModal = () => {
    setGroupDraft(createEmptyGroup(availableGroupFields[0]?.id ?? ''))
    setEditingGroupId(null)
    setGroupModalMode('create')
  }

  const openEditGroupModal = (group: PackageGroup) => {
    const categoryFields = fields.filter((field) => field.categoryId === draft.categoryId)
    const fieldExistsInCategory = categoryFields.some((field) => field.id === group.fieldId)
    setGroupDraft({
      ...group,
      fieldId: fieldExistsInCategory ? group.fieldId : (categoryFields[0]?.id ?? ''),
    })
    setEditingGroupId(group.id)
    setGroupModalMode('edit')
  }

  const closeGroupModal = () => {
    setGroupModalMode(null)
    setEditingGroupId(null)
    setGroupDraft(createEmptyGroup(availableGroupFields[0]?.id ?? ''))
  }

  const saveGroupModal = () => {
    if (!isValidGroupDraft(groupDraft)) {
      setIsError(true)
      setMessage(t('utility.packages.invalidGroups'))
      return
    }
    if (groupModalMode === 'create') {
      setDraft((prev) => ({
        ...prev,
        groups: [...prev.groups, groupDraft],
      }))
      closeGroupModal()
      return
    }
    if (groupModalMode === 'edit' && editingGroupId) {
      setDraft((prev) => ({
        ...prev,
        groups: prev.groups.map((item) => (item.id === editingGroupId ? groupDraft : item)),
      }))
      closeGroupModal()
    }
  }

  const deleteGroup = (group: PackageGroup) => {
    const confirmed = window.confirm(t('utility.packages.groupConfirmDelete', { title: group.title }))
    if (!confirmed) {
      return
    }
    setDraft((prev) => ({
      ...prev,
      groups: prev.groups.filter((item) => item.id !== group.id),
    }))
  }

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
    setIsModalOpen(false)
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

  const columns = useMemo<ColumnDef<SportPackage>[]>(
    () => [
      {
        id: 'name',
        header: t('utility.packages.nameLabel'),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'description',
        header: t('utility.packages.descriptionLabel'),
        cell: ({ row }) => <span>{stripHtml(row.original.description)}</span>,
      },
      {
        id: 'featuredImage',
        header: t('utility.packages.featuredImageLabel'),
        cell: ({ row }) =>
          row.original.featuredImage ? (
            <img src={row.original.featuredImage} alt={row.original.name} className="h-10 w-14 rounded object-cover" />
          ) : (
            <span className="opacity-50">-</span>
          ),
      },
      {
        id: 'category',
        header: t('utility.packages.categoryLabel'),
        cell: ({ row }) => <span>{categoryLabelById.get(row.original.categoryId) ?? '-'}</span>,
      },
      {
        id: 'company',
        header: t('utility.packages.companyLabel'),
        cell: ({ row }) => <span>{companyLabelById.get(row.original.companyId) ?? '-'}</span>,
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
      },
      {
        id: 'actions',
        header: () => <div className="text-right">{t('utility.categories.actions')}</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-3 pr-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm px-2 text-warning"
              onClick={() => openEditModal(row.original)}
              aria-label={t('utility.categories.edit')}
            >
              <SquarePen className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm px-2 text-error"
              onClick={() => handleDelete(row.original)}
              aria-label={t('utility.categories.delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [categoryLabelById, companyLabelById, handleDelete, openEditModal, t],
  )

  const table = useReactTable({
    data: packages,
    columns,
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

  const formatGroupSchedules = (schedules: PackageGroupSchedule[]): string[] => {
    const grouped = new Map<string, number[]>()
    schedules.forEach((schedule) => {
      const current = grouped.get(schedule.time) ?? []
      current.push(schedule.weekday)
      grouped.set(schedule.time, current)
    })

    const entries = Array.from(grouped.entries()).sort(([timeA], [timeB]) => timeA.localeCompare(timeB))
    return entries.map(([time, weekdays]) => {
      const sortedDays = Array.from(new Set(weekdays)).sort(
        (left, right) => (WEEKDAY_SORT_ORDER.get(left) ?? 99) - (WEEKDAY_SORT_ORDER.get(right) ?? 99),
      )
      const dayLabels = sortedDays.map((day) => weekdayLabelByValue.get(day) ?? String(day))
      return `${joinWithConjunction(dayLabels, t('utility.packages.andConjunction'))} ${t('utility.packages.atHourLabel')} ${formatHour(time)}`
    })
  }

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
          {message && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                isError ? 'bg-error/15 text-error' : 'bg-success/15 text-success'
              }`}
            >
              {message}
            </p>
          )}

          {packages.length === 0 ? (
            <p className="text-sm opacity-70">{t('utility.packages.empty')}</p>
          ) : (
            <DataTable table={table} />
          )}
        </div>
      </div>

      {isModalOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box h-screen w-screen max-w-none space-y-4 rounded-none">
            <h3 className="text-lg font-semibold">
              {modalMode === 'create' ? t('utility.packages.create') : t('utility.categories.saveEdit')}
            </h3>

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
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              audience: event.target.value as AudienceCode,
                            }))
                          }
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
                            const nextCategoryFields = fields.filter((field) => field.categoryId === nextCategoryId)
                            setDraft((prev) => ({
                              ...prev,
                              categoryId: nextCategoryId,
                              groups: prev.groups.filter((group) =>
                                nextCategoryFields.some((field) => field.id === group.fieldId),
                              ),
                            }))
                            setGroupDraft((prev) => ({
                              ...prev,
                              fieldId:
                                nextCategoryFields.some((field) => field.id === prev.fieldId)
                                  ? prev.fieldId
                                  : (nextCategoryFields[0]?.id ?? ''),
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

                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{t('utility.packages.groupsTab')}</p>
                      <button type="button" className="btn btn-outline btn-sm" onClick={openCreateGroupModal}>
                        {t('utility.packages.groupsAdd')}
                      </button>
                    </div>

                    {draft.groups.length === 0 ? (
                      <p className="text-sm opacity-70">{t('utility.packages.groupsEmpty')}</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-base-300">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>{t('utility.packages.groupTitleLabel')}</th>
                              <th>{t('utility.packages.groupFieldLabel')}</th>
                              <th>{t('utility.packages.groupYearRangeLabel')}</th>
                              <th>{t('utility.packages.groupScheduleLabel')}</th>
                              <th className="text-right">{t('utility.categories.actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {draft.groups.map((group) => (
                              <tr key={group.id}>
                                <td>{group.title}</td>
                                <td>{fieldLabelById.get(group.fieldId) ?? '-'}</td>
                                <td>
                                  {group.birthYearMin === group.birthYearMax
                                    ? group.birthYearMin
                                    : `${group.birthYearMin} - ${group.birthYearMax}`}
                                </td>
                                <td>
                                  <div className="space-y-1">
                                    {formatGroupSchedules(group.schedules).map((line, index) => (
                                      <p key={`${group.id}-${index}`} className="text-sm">
                                        {line}
                                      </p>
                                    ))}
                                  </div>
                                </td>
                                <td>
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm px-2 text-warning"
                                      onClick={() => openEditGroupModal(group)}
                                      aria-label={t('utility.categories.edit')}
                                    >
                                      <SquarePen className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm px-2 text-error"
                                      onClick={() => deleteGroup(group)}
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
                                className="select select-bordered w-full"
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
                              className="btn btn-ghost btn-sm text-error"
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
                              className="btn btn-ghost btn-sm text-error"
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
                                className="btn btn-ghost btn-sm text-error"
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
                                className="btn btn-ghost btn-sm text-error"
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

            {groupModalMode && (
              <dialog className="modal modal-open">
                <div className="modal-box max-w-3xl space-y-4">
                  <h4 className="text-base font-semibold">
                    {groupModalMode === 'create' ? t('utility.packages.groupsAdd') : t('utility.categories.saveEdit')}
                  </h4>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="form-control sm:col-span-2">
                      <span className="label-text mb-1 text-xs">{t('utility.packages.groupTitleLabel')}</span>
                      <input
                        className="input input-bordered w-full"
                        value={groupDraft.title}
                        onChange={(event) =>
                          setGroupDraft((prev) => ({
                            ...prev,
                            title: event.target.value,
                          }))
                        }
                        placeholder={t('utility.packages.groupTitlePlaceholder')}
                      />
                    </label>
                    <label className="form-control sm:col-span-2">
                      <span className="label-text mb-1 text-xs">{t('utility.packages.groupFieldLabel')}</span>
                      <select
                        className="select select-bordered w-full"
                        value={groupDraft.fieldId}
                        onChange={(event) =>
                          setGroupDraft((prev) => ({
                            ...prev,
                            fieldId: event.target.value,
                          }))
                        }
                      >
                        {availableGroupFields.length === 0 && (
                          <option value="">{t('utility.packages.noFieldOption')}</option>
                        )}
                        {availableGroupFields.map((field) => (
                          <option key={field.id} value={field.id}>
                            {field.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('utility.packages.groupYearMinLabel')}</span>
                      <input
                        type="number"
                        min={1900}
                        max={2100}
                        className="input input-bordered w-full"
                        value={groupDraft.birthYearMin}
                        onChange={(event) =>
                          setGroupDraft((prev) => ({
                            ...prev,
                            birthYearMin: Math.max(1900, Math.trunc(event.target.valueAsNumber || 1900)),
                          }))
                        }
                      />
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs">{t('utility.packages.groupYearMaxLabel')}</span>
                      <input
                        type="number"
                        min={1900}
                        max={2100}
                        className="input input-bordered w-full"
                        value={groupDraft.birthYearMax}
                        onChange={(event) =>
                          setGroupDraft((prev) => ({
                            ...prev,
                            birthYearMax: Math.max(1900, Math.trunc(event.target.valueAsNumber || 1900)),
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="space-y-2 rounded-lg border border-base-300 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">{t('utility.packages.groupScheduleLabel')}</p>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() =>
                          setGroupDraft((prev) => ({
                            ...prev,
                            schedules: [...prev.schedules, createEmptyGroupSchedule()],
                          }))
                        }
                      >
                        {t('utility.packages.groupScheduleAdd')}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {groupDraft.schedules.map((schedule) => (
                        <div key={schedule.id} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                          <label className="form-control">
                            <span className="label-text mb-1 text-xs">{t('utility.packages.groupWeekdayLabel')}</span>
                            <select
                              className="select select-bordered w-full"
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
                          <label className="form-control">
                            <span className="label-text mb-1 text-xs">{t('utility.packages.groupTimeLabel')}</span>
                            <input
                              type="time"
                              className="input input-bordered w-full"
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
                            className="btn btn-ghost btn-xs text-error"
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

                  <div className="modal-action gap-3">
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

            <div className="modal-action gap-3">
              <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
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
            onClick={() => setIsModalOpen(false)}
            aria-label={t('utility.categories.cancelEdit')}
          />
        </dialog>
      )}
    </section>
  )
}

export default PackagesPage
