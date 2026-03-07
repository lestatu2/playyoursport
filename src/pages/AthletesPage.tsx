import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, FileText, Wallet } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import DataTable from '../components/DataTable'
import {
  getPublicClients,
  getPublicMinors,
  updatePublicMinorRecord,
  updatePublicMinorValidationStatus,
  type PublicMinorRecord,
} from '../lib/public-customer-records'
import {
  getPublicDirectAthletes,
  updatePublicDirectAthleteRecord,
  updatePublicDirectAthleteValidationStatus,
  type PublicDirectAthleteRecord,
} from '../lib/public-direct-athletes'
import { getEnrollmentInsurances, getEnrollments, getPackages } from '../lib/package-catalog'
import { getAthleteEnrollmentCoverages } from '../lib/athlete-enrollment-coverages'
import { createAthleteActivity, getAthleteActivitiesByAthleteKey } from '../lib/athlete-activities'
import { getAthleteActivities } from '../lib/athlete-activities'
import { getSession } from '../lib/auth'
import { getAgeFromBirthDate } from '../lib/date-utils'
import { readFileAsDataUrl } from '../lib/file-utils'
import { getProjectSettings, getProjectSettingsChangedEventName } from '../lib/project-settings'
import { resolveDirectAthleteAvatarUrl, resolveMinorAvatarUrl } from '../lib/avatar'

type MinorDraft = Pick<
  PublicMinorRecord,
  | 'avatarUrl'
  | 'firstName'
  | 'lastName'
  | 'birthDate'
  | 'birthPlace'
  | 'residenceAddress'
  | 'taxCode'
  | 'medicalCertificateImageDataUrl'
  | 'medicalCertificateExpiryDate'
>
type AthleteRow =
  | { type: 'minor'; id: string; minor: PublicMinorRecord }
  | {
      type: 'direct'
      id: string
      direct: PublicDirectAthleteRecord
    }
type DirectDraft = Pick<
  PublicDirectAthleteRecord,
  | 'avatarUrl'
  | 'firstName'
  | 'lastName'
  | 'birthDate'
  | 'birthPlace'
  | 'residenceAddress'
  | 'taxCode'
  | 'email'
  | 'phone'
  | 'medicalCertificateImageDataUrl'
  | 'medicalCertificateExpiryDate'
>

type AthleteExportFormat = 'xlsx' | 'pdf' | 'docx'

type ParsedResidence = {
  street: string
  city: string
  province: string
  postalCode: string
}

function AthleteDocumentPreview({ dataUrl }: { dataUrl: string }) {
  const { t } = useTranslation()
  if (!dataUrl) {
    return <p className="text-sm opacity-70">-</p>
  }
  if (dataUrl.startsWith('data:image')) {
    return <img src={dataUrl} alt="" className="max-h-64 rounded border border-base-300 object-contain" />
  }
  return (
    <a className="link link-primary text-sm" href={dataUrl} target="_blank" rel="noreferrer">
      {t('athletes.openDocument')}
    </a>
  )
}

function isCertificateValid(expiryDate: string): boolean {
  if (!expiryDate) {
    return false
  }
  return expiryDate >= new Date().toISOString().slice(0, 10)
}

function isEnrollmentCoverageValid(validTo: string): boolean {
  if (!validTo) {
    return false
  }
  return validTo >= new Date().toISOString().slice(0, 10)
}

function isPackageEditionClosed(input: { durationType: string; periodEndDate?: string; eventDate?: string }): boolean {
  const today = new Date()
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (input.durationType === 'period') {
    const end = input.periodEndDate ? new Date(`${input.periodEndDate}T00:00:00`) : null
    return Boolean(end && !Number.isNaN(end.getTime()) && end < todayDate)
  }
  const eventDate = input.eventDate ? new Date(`${input.eventDate}T00:00:00`) : null
  return Boolean(eventDate && !Number.isNaN(eventDate.getTime()) && eventDate < todayDate)
}

function parseResidenceAddress(value: string): ParsedResidence {
  const raw = value.trim()
  if (!raw) {
    return { street: '', city: '', province: '', postalCode: '' }
  }
  const normalized = raw.replace(/\s+/g, ' ').trim()
  const parts = normalized.split(',').map((item) => item.trim()).filter(Boolean)
  const street = (parts[0] ?? normalized).replace(/^[/\-\s]+/, '').trim()
  const locationParts = parts
    .slice(1)
    .filter((item) => !/^(italia|italy)$/i.test(item))
  const locationSource = (locationParts.join(' ') || normalized).trim()

  const capMatch = locationSource.match(/\b\d{5}\b/) ?? normalized.match(/\b\d{5}\b/)
  const postalCode = capMatch?.[0] ?? ''

  let province = ''
  const provinceParenMatch = locationSource.match(/\(([A-Za-z]{2})\)/) ?? normalized.match(/\(([A-Za-z]{2})\)/)
  if (provinceParenMatch?.[1]) {
    province = provinceParenMatch[1].toUpperCase()
  } else {
    const provinceTailMatch = locationSource.match(/\b([A-Za-z]{2})\b\s*$/) ?? normalized.match(/\b([A-Za-z]{2})\b\s*$/)
    if (provinceTailMatch?.[1]) {
      const candidate = provinceTailMatch[1].toUpperCase()
      if (!['IT', 'ITA'].includes(candidate)) {
        province = candidate
      }
    }
  }

  let city = locationSource
    .replace(/\b\d{5}\b/g, '')
    .replace(/\(([A-Za-z]{2})\)/g, '')
    .replace(/\b([A-Za-z]{2})\b\s*$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')

  let normalizedStreet = street
  const leadingCivicMatch = city.match(/^(\d+[A-Za-z]?(?:[/-]\d+[A-Za-z]?)?)\s+(.+)$/)
  if (leadingCivicMatch) {
    const civic = leadingCivicMatch[1]
    const cityWithoutCivic = leadingCivicMatch[2].trim()
    normalizedStreet = `${street} ${civic}`.replace(/\s+/g, ' ').trim()
    city = cityWithoutCivic
  }

  return {
    street: normalizedStreet,
    city,
    province,
    postalCode,
  }
}

function AthletesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [minors, setMinors] = useState<PublicMinorRecord[]>(() => getPublicMinors())
  const [directAthletes, setDirectAthletes] = useState<PublicDirectAthleteRecord[]>(() => getPublicDirectAthletes())
  const [message, setMessage] = useState('')
  const [activeMinorId, setActiveMinorId] = useState<number | null>(null)
  const [minorDraft, setMinorDraft] = useState<MinorDraft | null>(null)
  const [activeDirectId, setActiveDirectId] = useState<string | null>(null)
  const [directDraft, setDirectDraft] = useState<DirectDraft | null>(null)
  const [newMinorPackageId, setNewMinorPackageId] = useState('')
  const [newDirectPackageId, setNewDirectPackageId] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [packageFilter, setPackageFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'minor' | 'adult'>('all')
  const [validationFilter, setValidationFilter] = useState<'all' | 'validated' | 'not_validated'>('all')
  const [certificateFilter, setCertificateFilter] = useState<'all' | 'expired' | 'valid'>('all')
  const [expiryFrom, setExpiryFrom] = useState('')
  const [expiryTo, setExpiryTo] = useState('')
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState<'all' | 'expired' | 'valid'>('all')
  const [enrollmentExpiryFrom, setEnrollmentExpiryFrom] = useState('')
  const [enrollmentExpiryTo, setEnrollmentExpiryTo] = useState('')
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<AthleteExportFormat>('xlsx')
  const [splitResidenceColumns, setSplitResidenceColumns] = useState(false)
  const session = useMemo(() => getSession(), [])
  const isSuperAdministrator = session?.role === 'super-administrator'
  const [avatarDicebearStyle, setAvatarDicebearStyle] = useState(() => getProjectSettings().avatarDicebearStyle)
  const lockedAthleteId = searchParams.get('athleteId')

  useEffect(() => {
    const settingsEvent = getProjectSettingsChangedEventName()
    const handleSettingsChange = () => {
      setAvatarDicebearStyle(getProjectSettings().avatarDicebearStyle)
    }
    window.addEventListener(settingsEvent, handleSettingsChange)
    return () => window.removeEventListener(settingsEvent, handleSettingsChange)
  }, [])

  const clientsById = useMemo(() => new Map(getPublicClients().map((client) => [client.id, client])), [])
  const packages = useMemo(() => getPackages(), [])
  const packagesById = useMemo(() => new Map(packages.map((item) => [item.id, item])), [packages])
  const athleteActivitiesByAthleteKey = useMemo(() => {
    const map = new Map<string, string[]>()
    getAthleteActivities().forEach((activity) => {
      const current = map.get(activity.athleteKey) ?? []
      if (!current.includes(activity.packageId)) {
        map.set(activity.athleteKey, [...current, activity.packageId])
      }
    })
    return map
  }, [])
  const enrollmentLabelById = useMemo(() => new Map(getEnrollments().map((item) => [item.id, item.title])), [])
  const insuranceLabelById = useMemo(() => new Map(getEnrollmentInsurances().map((item) => [item.id, item.title])), [])
  const enrollmentCoveragesByAthleteKey = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getAthleteEnrollmentCoverages>>()
    minors.forEach((minor) => {
      map.set(`minor-${minor.id}`, getAthleteEnrollmentCoverages(`minor-${minor.id}`))
    })
    directAthletes.forEach((direct) => {
      map.set(`direct-${direct.id}`, getAthleteEnrollmentCoverages(`direct-${direct.id}`))
    })
    return map
  }, [directAthletes, minors])
  const filteredAthletes = useMemo(() => {
    const allRows: AthleteRow[] = [
      ...minors.map((minor) => ({ type: 'minor' as const, id: `minor-${minor.id}`, minor })),
      ...directAthletes.map((direct) => ({ type: 'direct' as const, id: `direct-${direct.id}`, direct })),
    ]
    return allRows.filter((row) => {
      const isLegacyIdMatch =
        row.type === 'minor' ? lockedAthleteId === String(row.minor.id) : lockedAthleteId === row.direct.id
      if (lockedAthleteId && row.id !== lockedAthleteId && !isLegacyIdMatch) {
        return false
      }
      const packageId = row.type === 'minor' ? row.minor.packageId : row.direct.packageId
      const packageItem = packagesById.get(packageId)
      const validationStatus = row.type === 'minor' ? row.minor.validationStatus : row.direct.validationStatus
      const parent = row.type === 'minor' ? clientsById.get(row.minor.clientId) : null
      const expiresAt =
        row.type === 'minor'
          ? row.minor.medicalCertificateExpiryDate || ''
          : row.direct.medicalCertificateExpiryDate || ''
      const firstName = row.type === 'minor' ? row.minor.firstName : row.direct.firstName
      const lastName = row.type === 'minor' ? row.minor.lastName : row.direct.lastName
      const taxCode = row.type === 'minor' ? row.minor.taxCode : row.direct.taxCode
      const birthPlace = row.type === 'minor' ? row.minor.birthPlace : row.direct.birthPlace
      const residence = row.type === 'minor' ? row.minor.residenceAddress : row.direct.residenceAddress
      const directEmail = row.type === 'direct' ? row.direct.email : ''
      const directPhone = row.type === 'direct' ? row.direct.phone : ''
      const athleteKey = row.type === 'minor' ? `minor-${row.minor.id}` : `direct-${row.direct.id}`
      const enrollments = enrollmentCoveragesByAthleteKey.get(athleteKey) ?? []
      const searchHaystack = [
        firstName,
        lastName,
        taxCode,
        birthPlace,
        residence,
        directEmail,
        directPhone,
        parent?.parentFirstName ?? '',
        parent?.parentLastName ?? '',
        packageItem?.name ?? '',
      ]
        .join(' ')
        .toLowerCase()
      if (globalSearch.trim() && !searchHaystack.includes(globalSearch.trim().toLowerCase())) {
        return false
      }
      if (packageFilter !== 'all' && packageId !== packageFilter) {
        return false
      }
      if (typeFilter !== 'all') {
        if (typeFilter === 'minor' && row.type !== 'minor') {
          return false
        }
        if (typeFilter === 'adult' && row.type !== 'direct') {
          return false
        }
      }
      if (validationFilter !== 'all' && validationStatus !== validationFilter) {
        return false
      }
      if (certificateFilter !== 'all') {
        const isValidCertificate = Boolean(expiresAt) && isCertificateValid(expiresAt)
        if (certificateFilter === 'valid' && !isValidCertificate) {
          return false
        }
        if (certificateFilter === 'expired' && isValidCertificate) {
          return false
        }
      }
      if (expiryFrom && (!expiresAt || expiresAt < expiryFrom)) {
        return false
      }
      if (expiryTo && (!expiresAt || expiresAt > expiryTo)) {
        return false
      }
      if (enrollmentStatusFilter !== 'all') {
        const hasActiveEnrollment = enrollments.some((item) => isEnrollmentCoverageValid(item.validTo))
        const hasAnyEnrollment = enrollments.length > 0
        if (enrollmentStatusFilter === 'valid' && !hasActiveEnrollment) {
          return false
        }
        if (enrollmentStatusFilter === 'expired' && (!hasAnyEnrollment || hasActiveEnrollment)) {
          return false
        }
      }
      if (enrollmentExpiryFrom || enrollmentExpiryTo) {
        const hasMatchingEnrollmentDate = enrollments.some((item) => {
          if (!item.validTo) {
            return false
          }
          return (!enrollmentExpiryFrom || item.validTo >= enrollmentExpiryFrom)
            && (!enrollmentExpiryTo || item.validTo <= enrollmentExpiryTo)
        })
        if (!hasMatchingEnrollmentDate) {
          return false
        }
      }
      return true
    })
  }, [certificateFilter, clientsById, directAthletes, enrollmentCoveragesByAthleteKey, enrollmentExpiryFrom, enrollmentExpiryTo, enrollmentStatusFilter, expiryFrom, expiryTo, globalSearch, lockedAthleteId, minors, packageFilter, packagesById, typeFilter, validationFilter])

  const athleteExportRows = useMemo(() => {
    const yesNo = (value: boolean) => (value ? t('athletes.export.yes') : t('athletes.export.no'))
    return filteredAthletes
      .filter((row) => {
        const validationStatus = row.type === 'minor' ? row.minor.validationStatus : row.direct.validationStatus
        return validationStatus === 'validated'
      })
      .map((row) => {
      const isMinor = row.type === 'minor'
      const athlete = isMinor ? row.minor : row.direct
      const athleteKey = isMinor ? `minor-${row.minor.id}` : `direct-${row.direct.id}`
      const packageItem = packagesById.get(athlete.packageId)
      const parent = isMinor ? clientsById.get(row.minor.clientId) : null
      const enrollments = enrollmentCoveragesByAthleteKey.get(athleteKey) ?? []
      const enrollmentSummary = enrollments.length
        ? enrollments
            .map((item) => {
              const enrollmentLabel = enrollmentLabelById.get(item.sourceEnrollmentId) ?? item.sourceEnrollmentId
              const insuranceLabel = insuranceLabelById.get(item.insuranceId) ?? item.insuranceId
              return `${enrollmentLabel} / ${insuranceLabel} (${item.validFrom} - ${item.validTo})`
            })
            .join(' | ')
        : '-'
      const residence = parseResidenceAddress(athlete.residenceAddress || '')
      return {
        athleteId: row.id,
        athleteType: isMinor ? t('athletes.minorType') : t('athletes.adultType'),
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        birthDate: athlete.birthDate,
        birthPlace: athlete.birthPlace,
        taxCode: athlete.taxCode,
        residenceAddress: athlete.residenceAddress,
        residenceStreet: residence.street,
        residenceCity: residence.city,
        residenceProvince: residence.province,
        residencePostalCode: residence.postalCode,
        packageName: packageItem?.name ?? athlete.packageId,
        parentFullName: parent ? `${parent.parentFirstName} ${parent.parentLastName}` : '-',
        parentTaxCode: parent?.parentTaxCode ?? '-',
        email: isMinor ? (parent?.parentEmail ?? '-') : row.direct.email,
        phone: isMinor ? (parent?.parentPhone ?? '-') : row.direct.phone,
        medicalCertificateExpiryDate: athlete.medicalCertificateExpiryDate || '-',
        medicalCertificateDocumentPresent: yesNo(Boolean(athlete.medicalCertificateImageDataUrl)),
        enrollmentsSummary: enrollmentSummary,
      }
    })
  }, [clientsById, enrollmentCoveragesByAthleteKey, enrollmentLabelById, filteredAthletes, insuranceLabelById, packagesById, t])

  const exportAthletes = async () => {
    const headersBase = [
      ...(isSuperAdministrator ? [t('athletes.export.fields.athleteId')] : []),
      t('athletes.type'),
      t('athletes.firstName'),
      t('athletes.lastName'),
      t('athletes.birthDate'),
      t('athletes.birthPlace'),
      t('athletes.taxCode'),
      t('athletes.residence'),
      t('athletes.package'),
      t('athletes.parent'),
      t('athletes.export.fields.parentTaxCode'),
      t('clients.email'),
      t('clients.phone'),
      t('athletes.certificateExpiry'),
      t('athletes.export.fields.medicalCertificateDocumentPresent'),
      t('athletes.enrollmentsCoverageTitle'),
    ]
    const rowsBase = athleteExportRows.map((item) => [
      ...(isSuperAdministrator ? [item.athleteId] : []),
      item.athleteType,
      item.firstName,
      item.lastName,
      item.birthDate,
      item.birthPlace,
      item.taxCode,
      item.residenceAddress,
      item.packageName,
      item.parentFullName,
      item.parentTaxCode,
      item.email,
      item.phone,
      item.medicalCertificateExpiryDate,
      item.medicalCertificateDocumentPresent,
      item.enrollmentsSummary,
    ])
    const filenameBase = `atleti-schede-${new Date().toISOString().slice(0, 10)}`

    if (exportFormat === 'xlsx') {
      const records = athleteExportRows.map((item) => {
        const record: Record<string, string> = {
          ...(isSuperAdministrator ? { [t('athletes.export.fields.athleteId')]: item.athleteId } : {}),
          [t('athletes.type')]: item.athleteType,
          [t('athletes.firstName')]: item.firstName,
          [t('athletes.lastName')]: item.lastName,
          [t('athletes.birthDate')]: item.birthDate,
          [t('athletes.birthPlace')]: item.birthPlace,
          [t('athletes.taxCode')]: item.taxCode,
        }
        if (splitResidenceColumns) {
          record[t('athletes.export.fields.residenceStreet')] = item.residenceStreet
          record[t('athletes.export.fields.residenceCity')] = item.residenceCity
          record[t('athletes.export.fields.residenceProvince')] = item.residenceProvince
          record[t('athletes.export.fields.residencePostalCode')] = item.residencePostalCode
        } else {
          record[t('athletes.residence')] = item.residenceAddress
        }
        record[t('athletes.package')] = item.packageName
        record[t('athletes.parent')] = item.parentFullName
        record[t('athletes.export.fields.parentTaxCode')] = item.parentTaxCode
        record[t('clients.email')] = item.email
        record[t('clients.phone')] = item.phone
        record[t('athletes.certificateExpiry')] = item.medicalCertificateExpiryDate
        record[t('athletes.export.fields.medicalCertificateDocumentPresent')] = item.medicalCertificateDocumentPresent
        record[t('athletes.enrollmentsCoverageTitle')] = item.enrollmentsSummary
        return record
      })
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet(t('athletes.title'))
      const columns = records.length > 0 ? Object.keys(records[0]) : headersBase
      worksheet.columns = columns.map((header) => ({ header, key: header }))
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
      doc.text(t('athletes.export.title'), 40, 36)
      autoTable(doc, {
        head: [headersBase],
        body: rowsBase,
        startY: 50,
        styles: { fontSize: 7, cellPadding: 2.5 },
        headStyles: { fillColor: [33, 37, 41] },
      })
      doc.save(`${filenameBase}.pdf`)
      setIsExportModalOpen(false)
      return
    }

    const tableRows = [
      new TableRow({
        children: headersBase.map((header) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
          })),
      }),
      ...rowsBase.map((row) =>
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
          new Paragraph({ children: [new TextRun({ text: t('athletes.export.title'), bold: true })] }),
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
  const activeMinor = useMemo(
    () => (activeMinorId === null ? null : minors.find((item) => item.id === activeMinorId) ?? null),
    [activeMinorId, minors],
  )
  const activeDirect = useMemo(
    () => (activeDirectId === null ? null : directAthletes.find((item) => item.id === activeDirectId) ?? null),
    [activeDirectId, directAthletes],
  )
  const activeMinorCoverages = useMemo(
    () => (activeMinor ? getAthleteEnrollmentCoverages(`minor-${activeMinor.id}`) : []),
    [activeMinor],
  )
  const activeDirectCoverages = useMemo(
    () => (activeDirect ? getAthleteEnrollmentCoverages(`direct-${activeDirect.id}`) : []),
    [activeDirect],
  )
  const activeMinorActivities = useMemo(
    () => (activeMinor ? getAthleteActivitiesByAthleteKey(`minor-${activeMinor.id}`) : []),
    [activeMinor],
  )
  const activeDirectActivities = useMemo(
    () => (activeDirect ? getAthleteActivitiesByAthleteKey(`direct-${activeDirect.id}`) : []),
    [activeDirect],
  )
  const packageChipClassName =
    'inline-flex max-w-full items-start justify-start rounded-md border border-base-300 bg-base-100 px-2 py-1 text-left text-xs leading-tight text-base-content whitespace-normal break-words hover:bg-base-200'
  const getActivityPackageLabel = useCallback((packageId: string): string => {
    const packageItem = packagesById.get(packageId)
    if (!packageItem) {
      return packageId
    }
    const frequencyKey = `utility.packages.paymentFrequency${packageItem.paymentFrequency[0].toUpperCase()}${packageItem.paymentFrequency.slice(1)}`
    return `${packageItem.name} - ${t(frequencyKey)}`
  }, [packagesById, t])
  const availableMinorPackages = useMemo(() => {
    if (!activeMinor) {
      return []
    }
    const age = getAgeFromBirthDate(activeMinor.birthDate)
    if (age === null) {
      return []
    }
    const assignedPackageIds = new Set(activeMinorActivities.map((item) => item.packageId))
    return packages.filter(
      (item) =>
        item.audience === 'youth' &&
        !item.isDescriptive &&
        !isPackageEditionClosed(item) &&
        !assignedPackageIds.has(item.id) &&
        age >= item.ageMin &&
        age <= item.ageMax,
    )
  }, [activeMinor, activeMinorActivities, packages])
  const availableDirectPackages = useMemo(() => {
    if (!activeDirect) {
      return []
    }
    const age = getAgeFromBirthDate(activeDirect.birthDate)
    if (age === null) {
      return []
    }
    const assignedPackageIds = new Set(activeDirectActivities.map((item) => item.packageId))
    return packages.filter(
      (item) =>
        item.audience === 'adult' &&
        !item.isDescriptive &&
        !isPackageEditionClosed(item) &&
        !assignedPackageIds.has(item.id) &&
        age >= item.ageMin &&
        age <= item.ageMax,
    )
  }, [activeDirect, activeDirectActivities, packages])

  const refresh = () => {
    setMinors(getPublicMinors())
    setDirectAthletes(getPublicDirectAthletes())
  }

  const openAthleteModal = useCallback((minor: PublicMinorRecord) => {
    setActiveMinorId(minor.id)
    setMinorDraft({
      avatarUrl: minor.avatarUrl,
      firstName: minor.firstName,
      lastName: minor.lastName,
      birthDate: minor.birthDate,
      birthPlace: minor.birthPlace,
      residenceAddress: minor.residenceAddress,
      taxCode: minor.taxCode,
      medicalCertificateImageDataUrl: minor.medicalCertificateImageDataUrl,
      medicalCertificateExpiryDate: minor.medicalCertificateExpiryDate,
    })
    const firstAvailablePackageId = (() => {
      const age = getAgeFromBirthDate(minor.birthDate)
      if (age === null) {
        return ''
      }
      const assigned = new Set(getAthleteActivitiesByAthleteKey(`minor-${minor.id}`).map((item) => item.packageId))
      const next = packages.find(
        (item) =>
          item.audience === 'youth' &&
          !item.isDescriptive &&
          !isPackageEditionClosed(item) &&
          !assigned.has(item.id) &&
          age >= item.ageMin &&
          age <= item.ageMax,
      )
      return next?.id ?? ''
    })()
    setNewMinorPackageId(firstAvailablePackageId)
  }, [packages])

  const closeModal = () => {
    setActiveMinorId(null)
    setMinorDraft(null)
    setActiveDirectId(null)
    setDirectDraft(null)
    setNewMinorPackageId('')
    setNewDirectPackageId('')
  }

  const openDirectAthleteModal = useCallback((direct: PublicDirectAthleteRecord) => {
    setActiveDirectId(direct.id)
    setDirectDraft({
      avatarUrl: direct.avatarUrl,
      firstName: direct.firstName,
      lastName: direct.lastName,
      birthDate: direct.birthDate,
      birthPlace: direct.birthPlace,
      residenceAddress: direct.residenceAddress,
      taxCode: direct.taxCode,
      email: direct.email,
      phone: direct.phone,
      medicalCertificateImageDataUrl: direct.medicalCertificateImageDataUrl,
      medicalCertificateExpiryDate: direct.medicalCertificateExpiryDate,
    })
    const firstAvailablePackageId = (() => {
      const age = getAgeFromBirthDate(direct.birthDate)
      if (age === null) {
        return ''
      }
      const assigned = new Set(getAthleteActivitiesByAthleteKey(`direct-${direct.id}`).map((item) => item.packageId))
      const next = packages.find(
        (item) =>
          item.audience === 'adult' &&
          !item.isDescriptive &&
          !isPackageEditionClosed(item) &&
          !assigned.has(item.id) &&
          age >= item.ageMin &&
          age <= item.ageMax,
      )
      return next?.id ?? ''
    })()
    setNewDirectPackageId(firstAvailablePackageId)
  }, [packages])

  const addPackageToActiveMinor = () => {
    if (!activeMinor || !newMinorPackageId) {
      return
    }
    const createdActivity = createAthleteActivity({
      athleteKey: `minor-${activeMinor.id}`,
      type: 'minor',
      athleteId: String(activeMinor.id),
      packageId: newMinorPackageId,
      selectedPaymentMethodCode: '',
    })
    closeModal()
    navigate(`/app/attivita-pagamenti?athleteId=${encodeURIComponent(createdActivity.key)}`)
  }

  const addPackageToActiveDirect = () => {
    if (!activeDirect || !newDirectPackageId) {
      return
    }
    const createdActivity = createAthleteActivity({
      athleteKey: `direct-${activeDirect.id}`,
      type: 'direct_user',
      athleteId: activeDirect.id,
      packageId: newDirectPackageId,
      selectedPaymentMethodCode: '',
    })
    closeModal()
    navigate(`/app/attivita-pagamenti?athleteId=${encodeURIComponent(createdActivity.key)}`)
  }

  const saveChanges = (silent = false) => {
    if (!activeMinor || !minorDraft) {
      return
    }
    updatePublicMinorRecord(activeMinor.id, minorDraft)
    refresh()
    if (!silent) {
      setMessage(t('athletes.updated'))
    }
  }

  const setValidationStatus = (status: 'validated' | 'not_validated') => {
    if (!activeMinor) {
      return
    }
    saveChanges(true)
    updatePublicMinorValidationStatus(activeMinor.id, status)
    refresh()
    setMessage(t('athletes.updated'))
  }

  const saveDirectChanges = (silent = false) => {
    if (!activeDirect || !directDraft) {
      return
    }
    updatePublicDirectAthleteRecord(activeDirect.id, directDraft)
    refresh()
    if (!silent) {
      setMessage(t('athletes.updated'))
    }
  }

  const setDirectValidationStatus = (status: 'validated' | 'not_validated') => {
    if (!activeDirect) {
      return
    }
    saveDirectChanges(true)
    updatePublicDirectAthleteValidationStatus(activeDirect.id, status)
    refresh()
    setMessage(t('athletes.updated'))
  }

  const resetFilters = () => {
    setGlobalSearch('')
    setPackageFilter('all')
    setTypeFilter('all')
    setValidationFilter('all')
    setCertificateFilter('all')
    setExpiryFrom('')
    setExpiryTo('')
    setEnrollmentStatusFilter('all')
    setEnrollmentExpiryFrom('')
    setEnrollmentExpiryTo('')
    const next = new URLSearchParams(searchParams)
    next.delete('athleteId')
    setSearchParams(next, { replace: true })
  }

  const athleteColumns = useMemo<ColumnDef<AthleteRow>[]>(() => [
    {
      id: 'avatar',
      header: 'Avatar',
      cell: ({ row }) => {
        const minor = row.original.type === 'minor' ? row.original.minor : null
        const direct = row.original.type === 'direct' ? row.original.direct : null
        const client =
          minor
            ? clientsById.get(minor.clientId) ?? null
            : direct?.clientId !== null && direct?.clientId !== undefined
              ? clientsById.get(direct.clientId) ?? null
              : null
        const avatarUrl = minor
          ? resolveMinorAvatarUrl(minor, avatarDicebearStyle, client)
          : direct
            ? resolveDirectAthleteAvatarUrl(direct, avatarDicebearStyle, client)
            : ''
        return <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full border border-base-300 object-cover" />
      },
      meta: { responsivePriority: 'low' },
    },
    {
      id: 'athlete',
      header: t('athletes.athlete'),
      cell: ({ row }) => {
        const minor = row.original.type === 'minor' ? row.original.minor : null
        const direct = row.original.type === 'direct' ? row.original.direct : null
        return minor ? `${minor.firstName} ${minor.lastName}` : `${direct?.firstName ?? ''} ${direct?.lastName ?? ''}`
      },
      meta: { responsivePriority: 'high' },
    },
    {
      id: 'type',
      header: t('athletes.type'),
      cell: ({ row }) => (
        <span className={`badge ${row.original.type === 'minor' ? 'badge-info' : 'badge-primary'}`}>
          {row.original.type === 'minor' ? t('athletes.minorType') : t('athletes.adultType')}
        </span>
      ),
      meta: { responsivePriority: 'high' },
    },
    {
      id: 'birthDate',
      header: t('athletes.birthDate'),
      cell: ({ row }) => {
        const minor = row.original.type === 'minor' ? row.original.minor : null
        const direct = row.original.type === 'direct' ? row.original.direct : null
        return minor?.birthDate ?? direct?.birthDate ?? '-'
      },
      meta: { responsivePriority: 'low' },
    },
    {
      id: 'parent',
      header: t('athletes.parent'),
      cell: ({ row }) => {
        if (row.original.type !== 'minor') {
          return '-'
        }
        const client = clientsById.get(row.original.minor.clientId)
        if (!client) {
          return '-'
        }
        return (
          <button
            type="button"
            className="link text-base-content text-left"
            onClick={() => navigate(`/app/clienti?clientId=${client.id}`)}
          >
            {client.parentFirstName} {client.parentLastName}
          </button>
        )
      },
      meta: { responsivePriority: 'low' },
    },
    {
      id: 'package',
      header: t('athletes.package'),
      cell: ({ row }) => {
        const minor = row.original.type === 'minor' ? row.original.minor : null
        const direct = row.original.type === 'direct' ? row.original.direct : null
        const athleteKey = minor ? `minor-${minor.id}` : direct ? `direct-${direct.id}` : ''
        const packageIds =
          athleteActivitiesByAthleteKey.get(athleteKey) ??
          (minor?.packageId || direct?.packageId
            ? [minor?.packageId ?? direct?.packageId ?? '']
            : [])
        if (packageIds.length === 0) {
          return '-'
        }
        return (
          <div className="flex flex-wrap gap-1">
            {packageIds.map((pkgId) => (
              <button
                key={`${row.original.id}-${pkgId}`}
                type="button"
                className={packageChipClassName}
                onClick={() => navigate(`/app/pacchetti?packageId=${pkgId}`)}
              >
                {packagesById.get(pkgId)?.name ?? pkgId}
              </button>
            ))}
          </div>
        )
      },
      meta: { responsivePriority: 'low' },
    },
    {
      id: 'enrollments',
      header: t('athletes.enrollmentsCoverageTitle'),
      cell: ({ row }) => {
        const minor = row.original.type === 'minor' ? row.original.minor : null
        const direct = row.original.type === 'direct' ? row.original.direct : null
        const athleteKey = minor ? `minor-${minor.id}` : direct ? `direct-${direct.id}` : ''
        const enrollments = enrollmentCoveragesByAthleteKey.get(athleteKey) ?? []
        if (enrollments.length === 0) {
          return <span className="text-sm opacity-70">-</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {enrollments.map((enrollment) => {
              const title = enrollmentLabelById.get(enrollment.sourceEnrollmentId) ?? enrollment.sourceEnrollmentId
              const isValid = isEnrollmentCoverageValid(enrollment.validTo)
              return (
                <span key={enrollment.id} className={`badge ${isValid ? 'badge-success' : 'badge-error'}`}>
                  {title} {enrollment.validTo}
                </span>
              )
            })}
          </div>
        )
      },
      meta: { responsivePriority: 'low' },
    },
    {
      id: 'certificate',
      header: t('athletes.certificateExpiry'),
      cell: ({ row }) => {
        const minor = row.original.type === 'minor' ? row.original.minor : null
        const direct = row.original.type === 'direct' ? row.original.direct : null
        const value = minor?.medicalCertificateExpiryDate || direct?.medicalCertificateExpiryDate || ''
        if (!value) {
          return <span className="text-error font-medium">-</span>
        }
        return (
          <span className={isCertificateValid(value) ? 'text-success font-medium' : 'text-error font-medium'}>
            {value}
          </span>
        )
      },
      meta: { responsivePriority: 'low' },
    },
    {
      id: 'status',
      header: t('athletes.status'),
      cell: ({ row }) => {
        const isValidated = (
          row.original.type === 'minor'
            ? row.original.minor.validationStatus
            : row.original.direct.validationStatus
        ) === 'validated'
        return (
          <span className={`badge ${isValidated ? 'badge-success' : 'badge-warning'}`}>
            {isValidated ? t('athletes.validated') : t('athletes.notValidated')}
          </span>
        )
      },
      meta: { responsivePriority: 'high' },
    },
    {
      id: 'actions',
      header: t('athletes.actions'),
      cell: ({ row }) => {
        const minor = row.original.type === 'minor' ? row.original.minor : null
        const direct = row.original.type === 'direct' ? row.original.direct : null
        const isValidated = (minor ? minor.validationStatus : direct?.validationStatus) === 'validated'
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              onClick={() => (minor ? openAthleteModal(minor) : direct ? openDirectAthleteModal(direct) : undefined)}
              title={isValidated ? t('athletes.openProfile') : t('athletes.openValidation')}
            >
              {isValidated
                ? <FileText className="h-4 w-4" />
                : <AlertTriangle className="h-4 w-4 text-warning" />}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              title={t('athletes.openActivitiesPayments')}
              onClick={() => navigate(`/app/attivita-pagamenti?athleteId=${row.original.id}`)}
            >
              <Wallet className="h-4 w-4" />
            </button>
          </div>
        )
      },
      meta: { responsivePriority: 'high' },
    },
  ], [athleteActivitiesByAthleteKey, avatarDicebearStyle, clientsById, enrollmentCoveragesByAthleteKey, enrollmentLabelById, navigate, openDirectAthleteModal, openAthleteModal, packageChipClassName, packagesById, t])

  const athletesTable = useReactTable({
    data: filteredAthletes,
    columns: athleteColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{t('athletes.title')}</h2>
        <p className="text-sm opacity-70">{t('athletes.description')}</p>
      </div>
      {message ? <p className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success">{message}</p> : null}
      <div className="flex justify-start">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setIsExportModalOpen(true)}
          disabled={athleteExportRows.length === 0}
        >
          {t('athletes.export.button')}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-base-300 bg-base-100 p-3 md:grid-cols-2 lg:grid-cols-12">
        <label className="form-control lg:col-span-2">
          <span className="label-text mb-1 text-xs">{t('athletes.searchLabel')}</span>
          <input
            className="input input-bordered w-full"
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
            placeholder={t('athletes.searchPlaceholder')}
          />
        </label>
        <label className="form-control lg:col-span-2">
          <span className="label-text mb-1 text-xs">{t('athletes.packageFilter')}</span>
          <select className="select select-bordered w-full" value={packageFilter} onChange={(event) => setPackageFilter(event.target.value)}>
            <option value="all">{t('athletes.allPackages')}</option>
            {packages.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="form-control lg:col-span-1">
          <span className="label-text mb-1 text-xs">{t('athletes.typeFilter')}</span>
          <select
            className="select select-bordered w-full"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as 'all' | 'minor' | 'adult')}
          >
            <option value="all">{t('athletes.allTypes')}</option>
            <option value="minor">{t('athletes.minorType')}</option>
            <option value="adult">{t('athletes.adultType')}</option>
          </select>
        </label>
        <label className="form-control lg:col-span-2">
          <span className="label-text mb-1 text-xs">{t('athletes.validationFilter')}</span>
          <select
            className="select select-bordered w-full"
            value={validationFilter}
            onChange={(event) => setValidationFilter(event.target.value as 'all' | 'validated' | 'not_validated')}
          >
            <option value="all">{t('athletes.allStatuses')}</option>
            <option value="validated">{t('athletes.validated')}</option>
            <option value="not_validated">{t('athletes.notValidated')}</option>
          </select>
        </label>
        <label className="form-control lg:col-span-2">
          <span className="label-text mb-1 text-xs">{t('athletes.certificateFilter')}</span>
          <select
            className="select select-bordered w-full"
            value={certificateFilter}
            onChange={(event) => setCertificateFilter(event.target.value as 'all' | 'expired' | 'valid')}
          >
            <option value="all">{t('athletes.allCertificates')}</option>
            <option value="valid">{t('athletes.certificateValid')}</option>
            <option value="expired">{t('athletes.certificateExpired')}</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2 lg:col-span-3">
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('athletes.expiryFrom')}</span>
            <input type="date" className="input input-bordered w-full" value={expiryFrom} onChange={(event) => setExpiryFrom(event.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('athletes.expiryTo')}</span>
            <input type="date" className="input input-bordered w-full" value={expiryTo} onChange={(event) => setExpiryTo(event.target.value)} />
          </label>
        </div>
        <label className="form-control lg:col-span-2">
          <span className="label-text mb-1 text-xs">{t('athletes.enrollmentStatusFilter')}</span>
          <select
            className="select select-bordered w-full"
            value={enrollmentStatusFilter}
            onChange={(event) => setEnrollmentStatusFilter(event.target.value as 'all' | 'expired' | 'valid')}
          >
            <option value="all">{t('athletes.allEnrollmentsStatuses')}</option>
            <option value="valid">{t('athletes.enrollmentNotExpired')}</option>
            <option value="expired">{t('athletes.enrollmentExpired')}</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2 lg:col-span-3">
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('athletes.enrollmentExpiryFrom')}</span>
            <input type="date" className="input input-bordered w-full" value={enrollmentExpiryFrom} onChange={(event) => setEnrollmentExpiryFrom(event.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('athletes.enrollmentExpiryTo')}</span>
            <input type="date" className="input input-bordered w-full" value={enrollmentExpiryTo} onChange={(event) => setEnrollmentExpiryTo(event.target.value)} />
          </label>
        </div>
        <div className="lg:col-span-1 flex items-end justify-end">
          <button type="button" className="btn btn-outline btn-sm" onClick={resetFilters}>
            {t('common.resetFilters')}
          </button>
        </div>
      </div>
      <div className="rounded-lg border border-base-300 bg-base-100">
        {filteredAthletes.length === 0 ? <p className="p-4 text-center text-sm opacity-70">{t('athletes.empty')}</p> : <DataTable table={athletesTable} />}
      </div>

      {isExportModalOpen ? (
        <dialog className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
            <h3 className="text-lg font-semibold">{t('athletes.export.title')}</h3>
            <p className="mt-1 text-sm opacity-70">
              {t('athletes.export.description')}
            </p>
            <div className="mt-4 space-y-4">
              <label className="form-control max-w-xs">
                <span className="label-text mb-1 text-xs">{t('athletes.export.formatLabel')}</span>
                <select
                  className="select select-bordered w-full"
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value as AthleteExportFormat)}
                >
                  <option value="xlsx">{t('athletes.export.formats.xlsx')}</option>
                  <option value="pdf">{t('athletes.export.formats.pdf')}</option>
                  <option value="docx">{t('athletes.export.formats.docx')}</option>
                </select>
              </label>
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={splitResidenceColumns}
                  onChange={(event) => setSplitResidenceColumns(event.target.checked)}
                  disabled={exportFormat !== 'xlsx'}
                />
                <span className="label-text">
                  {t('athletes.export.splitResidenceColumns')}
                </span>
              </label>
            </div>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setIsExportModalOpen(false)}>
                {t('public.common.close')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void exportAthletes()}
                disabled={athleteExportRows.length === 0}
              >
                {t('athletes.export.exportAction')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={() => setIsExportModalOpen(false)} />
        </dialog>
      ) : null}

      {activeMinor && minorDraft ? (
        <dialog className="modal modal-open">
          <div className="modal-box w-11/12 max-w-3xl">
            <h3 className="text-lg font-semibold">{t('athletes.detailTitle')}</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="form-control md:col-span-2">
                <span className="label-text mb-1 text-xs">Avatar</span>
                <div className="flex flex-wrap items-center gap-3">
                  <img
                    src={resolveMinorAvatarUrl({ ...activeMinor, avatarUrl: minorDraft.avatarUrl }, avatarDicebearStyle, clientsById.get(activeMinor.clientId) ?? null)}
                    alt=""
                    className="h-12 w-12 rounded-full border border-base-300 object-cover"
                  />
                  <input
                    type="file"
                    className="file-input file-input-bordered w-full max-w-md"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) {
                        return
                      }
                      void readFileAsDataUrl(file).then((dataUrl) => {
                        setMinorDraft((prev) => (prev ? { ...prev, avatarUrl: dataUrl } : prev))
                      })
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setMinorDraft((prev) => (prev ? { ...prev, avatarUrl: '' } : prev))}
                  >
                    Rimuovi
                  </button>
                </div>
              </div>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('athletes.firstName')}</span>
                <input className="input input-bordered w-full" value={minorDraft.firstName} onChange={(event) => setMinorDraft((prev) => (prev ? { ...prev, firstName: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('athletes.lastName')}</span>
                <input className="input input-bordered w-full" value={minorDraft.lastName} onChange={(event) => setMinorDraft((prev) => (prev ? { ...prev, lastName: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('athletes.birthDate')}</span>
                <input type="date" className="input input-bordered w-full" value={minorDraft.birthDate} onChange={(event) => setMinorDraft((prev) => (prev ? { ...prev, birthDate: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('athletes.birthPlace')}</span>
                <input className="input input-bordered w-full" value={minorDraft.birthPlace} onChange={(event) => setMinorDraft((prev) => (prev ? { ...prev, birthPlace: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('athletes.taxCode')}</span>
                <input className="input input-bordered w-full" value={minorDraft.taxCode} onChange={(event) => setMinorDraft((prev) => (prev ? { ...prev, taxCode: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('athletes.certificateExpiry')}</span>
                <input type="date" className="input input-bordered w-full" value={minorDraft.medicalCertificateExpiryDate} onChange={(event) => setMinorDraft((prev) => (prev ? { ...prev, medicalCertificateExpiryDate: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('athletes.certificateUpload')}</span>
                <input
                  type="file"
                  className="file-input file-input-bordered w-full"
                  accept="image/*,.pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) {
                      return
                    }
                    void readFileAsDataUrl(file).then((dataUrl) => {
                      setMinorDraft((prev) => (prev ? { ...prev, medicalCertificateImageDataUrl: dataUrl } : prev))
                    })
                  }}
                />
              </label>
              <label className="form-control md:col-span-2">
                <span className="label-text mb-1 text-xs">{t('athletes.residence')}</span>
                <input className="input input-bordered w-full" value={minorDraft.residenceAddress} onChange={(event) => setMinorDraft((prev) => (prev ? { ...prev, residenceAddress: event.target.value } : prev))} />
              </label>
            </div>

            {activeMinor.validationStatus === 'not_validated' ? (
              <div className="mt-4 rounded border border-base-300">
                <div className="collapse collapse-arrow">
                  <input type="checkbox" />
                  <div className="collapse-title text-sm font-medium">{t('athletes.checkDocuments')}</div>
                  <div className="collapse-content">
                    <p className="mb-1 text-xs font-semibold">{t('athletes.taxCodeDocument')}</p>
                    <AthleteDocumentPreview dataUrl={activeMinor.taxCodeImageDataUrl} />
                    <p className="mb-1 mt-4 text-xs font-semibold">{t('athletes.certificateDocument')}</p>
                    <AthleteDocumentPreview dataUrl={minorDraft.medicalCertificateImageDataUrl} />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded border border-base-300 p-3">
              <p className="text-sm font-semibold">Pacchetti attivi atleta</p>
              {activeMinorActivities.length === 0 ? (
                <p className="mt-2 text-sm opacity-70">Nessun pacchetto attivo.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeMinorActivities.map((activity) => (
                    <button
                      key={activity.key}
                      type="button"
                      className={packageChipClassName}
                      onClick={() => navigate(`/app/pacchetti?packageId=${activity.packageId}`)}
                    >
                      {getActivityPackageLabel(activity.packageId)}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-col gap-2 md:flex-row">
                <select
                  className="select select-bordered w-full"
                  value={newMinorPackageId || availableMinorPackages[0]?.id || ''}
                  onChange={(event) => setNewMinorPackageId(event.target.value)}
                >
                  {availableMinorPackages.length === 0 ? (
                    <option value="">Nessun pacchetto compatibile disponibile</option>
                  ) : (
                    availableMinorPackages.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={addPackageToActiveMinor}
                  disabled={availableMinorPackages.length === 0}
                >
                  Aggiungi pacchetto
                </button>
              </div>
            </div>

            <div className="mt-4 rounded border border-base-300 p-3">
              <p className="text-sm font-semibold">{t('athletes.enrollmentsCoverageTitle')}</p>
              {activeMinorCoverages.length === 0 ? (
                <p className="mt-2 text-sm opacity-70">{t('athletes.enrollmentsCoverageEmpty')}</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>{t('athletes.enrollmentsCoverageEnrollment')}</th>
                        <th>{t('athletes.enrollmentsCoverageInsurance')}</th>
                        <th>{t('athletes.enrollmentsCoverageValidFrom')}</th>
                        <th>{t('athletes.enrollmentsCoverageValidTo')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMinorCoverages.map((itemCoverage) => (
                        <tr key={itemCoverage.id}>
                          <td>{enrollmentLabelById.get(itemCoverage.sourceEnrollmentId) ?? itemCoverage.sourceEnrollmentId}</td>
                              <td>{insuranceLabelById.get(itemCoverage.insuranceId) ?? itemCoverage.insuranceId}</td>
                          <td>{itemCoverage.validFrom}</td>
                          <td>{itemCoverage.validTo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>{t('public.common.close')}</button>
              <button type="button" className="btn btn-outline" onClick={() => saveChanges()}>{t('common.save')}</button>
              {activeMinor.validationStatus === 'validated' ? (
                <button type="button" className="btn btn-warning" onClick={() => setValidationStatus('not_validated')}>
                  {t('athletes.markNotValidated')}
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => setValidationStatus('validated')}>
                  {t('athletes.markValidated')}
                </button>
              )}
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeModal} />
        </dialog>
      ) : null}

      {activeDirect && directDraft ? (
        <dialog className="modal modal-open">
          <div className="modal-box w-11/12 max-w-3xl">
            <h3 className="text-lg font-semibold">{t('athletes.detailTitle')}</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="form-control md:col-span-2">
                <span className="label-text mb-1 text-xs">Avatar</span>
                <div className="flex flex-wrap items-center gap-3">
                  <img
                    src={resolveDirectAthleteAvatarUrl({ ...activeDirect, avatarUrl: directDraft.avatarUrl }, avatarDicebearStyle, activeDirect.clientId !== null ? clientsById.get(activeDirect.clientId) ?? null : null)}
                    alt=""
                    className="h-12 w-12 rounded-full border border-base-300 object-cover"
                  />
                  <input
                    type="file"
                    className="file-input file-input-bordered w-full max-w-md"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) {
                        return
                      }
                      void readFileAsDataUrl(file).then((dataUrl) => {
                        setDirectDraft((prev) => (prev ? { ...prev, avatarUrl: dataUrl } : prev))
                      })
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setDirectDraft((prev) => (prev ? { ...prev, avatarUrl: '' } : prev))}
                  >
                    Rimuovi
                  </button>
                </div>
              </div>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('athletes.firstName')}</span>
                <input className="input input-bordered w-full" value={directDraft.firstName} onChange={(event) => setDirectDraft((prev) => (prev ? { ...prev, firstName: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('athletes.lastName')}</span>
                <input className="input input-bordered w-full" value={directDraft.lastName} onChange={(event) => setDirectDraft((prev) => (prev ? { ...prev, lastName: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('athletes.birthDate')}</span>
                <input type="date" className="input input-bordered w-full" value={directDraft.birthDate} onChange={(event) => setDirectDraft((prev) => (prev ? { ...prev, birthDate: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('athletes.birthPlace')}</span>
                <input className="input input-bordered w-full" value={directDraft.birthPlace} onChange={(event) => setDirectDraft((prev) => (prev ? { ...prev, birthPlace: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('athletes.taxCode')}</span>
                <input className="input input-bordered w-full" value={directDraft.taxCode} onChange={(event) => setDirectDraft((prev) => (prev ? { ...prev, taxCode: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('clients.phone')}</span>
                <input className="input input-bordered w-full" value={directDraft.phone} onChange={(event) => setDirectDraft((prev) => (prev ? { ...prev, phone: event.target.value } : prev))} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs">{t('athletes.certificateExpiry')}</span>
                <input
                  type="date"
                  className="input input-bordered w-full"
                  value={directDraft.medicalCertificateExpiryDate}
                  onChange={(event) => setDirectDraft((prev) => (prev ? { ...prev, medicalCertificateExpiryDate: event.target.value } : prev))}
                />
              </label>
              <label className="form-control md:col-span-2">
                <span className="label-text mb-1 text-xs">{t('athletes.certificateUpload')}</span>
                <input
                  type="file"
                  className="file-input file-input-bordered w-full"
                  accept="image/*,.pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) {
                      return
                    }
                    void readFileAsDataUrl(file).then((dataUrl) => {
                      setDirectDraft((prev) => (prev ? { ...prev, medicalCertificateImageDataUrl: dataUrl } : prev))
                    })
                  }}
                />
              </label>
              <label className="form-control md:col-span-2">
                <span className="label-text mb-1 text-xs">{t('clients.email')}</span>
                <input className="input input-bordered w-full" value={directDraft.email} onChange={(event) => setDirectDraft((prev) => (prev ? { ...prev, email: event.target.value } : prev))} />
              </label>
              <label className="form-control md:col-span-2">
                <span className="label-text mb-1 text-xs">{t('athletes.residence')}</span>
                <input className="input input-bordered w-full" value={directDraft.residenceAddress} onChange={(event) => setDirectDraft((prev) => (prev ? { ...prev, residenceAddress: event.target.value } : prev))} />
              </label>
            </div>
            {activeDirect.validationStatus === 'not_validated' ? (
              <div className="mt-4 rounded border border-base-300">
                <div className="collapse collapse-arrow">
                  <input type="checkbox" />
                  <div className="collapse-title text-sm font-medium">{t('athletes.checkDocuments')}</div>
                  <div className="collapse-content">
                    <p className="mb-1 text-xs font-semibold">{t('athletes.certificateDocument')}</p>
                    <AthleteDocumentPreview dataUrl={directDraft.medicalCertificateImageDataUrl} />
                  </div>
                </div>
              </div>
            ) : null}
            <div className="mt-4 rounded border border-base-300 p-3">
              <p className="text-sm font-semibold">Pacchetti attivi atleta</p>
              {activeDirectActivities.length === 0 ? (
                <p className="mt-2 text-sm opacity-70">Nessun pacchetto attivo.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeDirectActivities.map((activity) => (
                    <button
                      key={activity.key}
                      type="button"
                      className={packageChipClassName}
                      onClick={() => navigate(`/app/pacchetti?packageId=${activity.packageId}`)}
                    >
                      {getActivityPackageLabel(activity.packageId)}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-col gap-2 md:flex-row">
                <select
                  className="select select-bordered w-full"
                  value={newDirectPackageId || availableDirectPackages[0]?.id || ''}
                  onChange={(event) => setNewDirectPackageId(event.target.value)}
                >
                  {availableDirectPackages.length === 0 ? (
                    <option value="">Nessun pacchetto compatibile disponibile</option>
                  ) : (
                    availableDirectPackages.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={addPackageToActiveDirect}
                  disabled={availableDirectPackages.length === 0}
                >
                  Aggiungi pacchetto
                </button>
              </div>
            </div>
            <div className="mt-4 rounded border border-base-300 p-3">
              <p className="text-sm font-semibold">{t('athletes.enrollmentsCoverageTitle')}</p>
              {activeDirectCoverages.length === 0 ? (
                <p className="mt-2 text-sm opacity-70">{t('athletes.enrollmentsCoverageEmpty')}</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>{t('athletes.enrollmentsCoverageEnrollment')}</th>
                        <th>{t('athletes.enrollmentsCoverageInsurance')}</th>
                        <th>{t('athletes.enrollmentsCoverageValidFrom')}</th>
                        <th>{t('athletes.enrollmentsCoverageValidTo')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeDirectCoverages.map((itemCoverage) => (
                        <tr key={itemCoverage.id}>
                          <td>{enrollmentLabelById.get(itemCoverage.sourceEnrollmentId) ?? itemCoverage.sourceEnrollmentId}</td>
                              <td>{insuranceLabelById.get(itemCoverage.insuranceId) ?? itemCoverage.insuranceId}</td>
                          <td>{itemCoverage.validFrom}</td>
                          <td>{itemCoverage.validTo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>{t('public.common.close')}</button>
              <button type="button" className="btn btn-outline" onClick={() => saveDirectChanges()}>{t('common.save')}</button>
              {activeDirect.validationStatus === 'validated' ? (
                <button type="button" className="btn btn-warning" onClick={() => setDirectValidationStatus('not_validated')}>
                  {t('athletes.markNotValidated')}
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => setDirectValidationStatus('validated')}>
                  {t('athletes.markValidated')}
                </button>
              )}
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeModal} />
        </dialog>
      ) : null}
    </section>
  )
}

export default AthletesPage
