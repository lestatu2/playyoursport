import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, MessageCircle, Trash2 } from 'lucide-react'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from 'docx'
import DataTable from '../components/DataTable'
import { dateOnly, isClosedDatedItem } from '../lib/dated-items'
import {
  getOpenDayEditions,
  getOpenDayGroups,
  getOpenDayProducts,
  getOpenDaySessions,
  type OpenDaySession,
} from '../lib/open-day-catalog'
import { getSportCategories } from '../lib/package-catalog'
import {
  getOpenDayAdultAthletes,
  getOpenDayMinorAthletes,
  getOpenDayParticipations,
  getOpenDayProspects,
  getOpenDayRecordsChangedEventName,
  removeOpenDayParticipation,
  updateOpenDayAdultAthlete,
  updateOpenDayMinorAthlete,
  updateOpenDayParticipation,
  updateOpenDayProspect,
  type OpenDayParticipationStatus,
  type OpenDayProspectRole,
} from '../lib/open-day-records'

type ParticipationRow = {
  id: string
  editionId: string
  productId: string
  categoryId: string
  openDayLabel: string
  editionYear: number
  closureDate: string
  isHistorical: boolean
  participantName: string
  participantType: 'adult' | 'minor'
  tutorLabel: string
  tutorEmail: string
  tutorPhone: string
  participationStatus: OpenDayParticipationStatus
  groupLabel: string
  scheduleEntries: string[]
  sessionDates: string[]
  createdAt: string
}

type EditDraft = {
  prospectFirstName: string
  prospectLastName: string
  prospectEmail: string
  prospectPhone: string
  prospectSecondaryPhone: string
  prospectBirthDate: string
  prospectRole: OpenDayProspectRole
  prospectGender: 'M' | 'F'
  participantFirstName: string
  participantLastName: string
  participantBirthDate: string
  participantGender: 'M' | 'F'
  participantEmail: string
  participantPhone: string
  selectedSessionIds: string[]
  participationStatus: OpenDayParticipationStatus
}

type OpenDayExportFormat = 'xlsx' | 'pdf' | 'docx'

const EMPTY_DRAFT: EditDraft = {
  prospectFirstName: '',
  prospectLastName: '',
  prospectEmail: '',
  prospectPhone: '',
  prospectSecondaryPhone: '',
  prospectBirthDate: '',
  prospectRole: 'parent',
  prospectGender: 'M',
  participantFirstName: '',
  participantLastName: '',
  participantBirthDate: '',
  participantGender: 'M',
  participantEmail: '',
  participantPhone: '',
  selectedSessionIds: [],
  participationStatus: 'registered',
}

function getBirthYear(value: string): number | null {
  const parsed = Number.parseInt(value.slice(0, 4), 10)
  return Number.isInteger(parsed) ? parsed : null
}

function getProspectRoleLabel(t: (key: string) => string, role: OpenDayProspectRole): string {
  if (role === 'guardian') {
    return t('openDay.participations.fields.roleGuardian')
  }
  if (role === 'holder_of_parental_responsibility') {
    return t('openDay.participations.fields.roleHolderOfParentalResponsibility')
  }
  if (role === 'self') {
    return t('openDay.participations.fields.roleSelf')
  }
  return t('openDay.participations.fields.roleParent')
}

function buildWhatsAppUrl(phone: string): string | null {
  const normalized = phone.replace(/[^\d+]/g, '')
  const digits = normalized.startsWith('+') ? normalized.slice(1) : normalized
  if (!digits) {
    return null
  }
  return `https://wa.me/${digits}`
}

function OpenDayParticipationsPage() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<ParticipationRow[]>([])
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | OpenDayParticipationStatus>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'adult' | 'minor'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<EditDraft>(EMPTY_DRAFT)
  const [modalError, setModalError] = useState('')
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<OpenDayExportFormat>('xlsx')

  useEffect(() => {
    const load = () => {
      const today = dateOnly(new Date())
      const products = getOpenDayProducts()
      const editions = getOpenDayEditions()
      const groups = getOpenDayGroups()
      const sessions = getOpenDaySessions()
      const prospects = getOpenDayProspects()
      const minors = getOpenDayMinorAthletes()
      const adults = getOpenDayAdultAthletes()
      const nextRows: ParticipationRow[] = getOpenDayParticipations().map((participation) => {
        const product = products.find((item) => item.id === participation.productId) ?? null
        const edition = editions.find((item) => item.id === participation.openDayEditionId) ?? null
        const prospect = prospects.find((item) => item.id === participation.prospectId) ?? null
        const minor = participation.minorAthleteId ? minors.find((item) => item.id === participation.minorAthleteId) ?? null : null
        const adult = participation.adultAthleteId ? adults.find((item) => item.id === participation.adultAthleteId) ?? null : null
        const selectedSessions = sessions
          .filter((item) => participation.selectedSessionIds.includes(item.id))
        const groupedSessions = selectedSessions.map((session) => ({
          session,
          group: groups.find((item) => item.id === session.groupId) ?? null,
        }))
        const groupLabel = Array.from(
          new Set(groupedSessions.map((item) => item.group?.title ?? t('openDay.common.group'))),
        ).join(' | ')
        const scheduleEntries = groupedSessions
          .map((item) => `${item.session.date} ${item.session.startTime}-${item.session.endTime}`)
        return {
          id: participation.id,
          editionId: participation.openDayEditionId,
          productId: participation.productId,
          categoryId: product?.categoryId ?? '',
          openDayLabel: product ? `${product.name} (${edition?.editionYear ?? participation.editionYear})` : participation.productId,
          editionYear: participation.editionYear,
          closureDate:
            edition?.durationType === 'period' ? (edition.periodEndDate || '-') : (edition?.eventDate || '-'),
          isHistorical: edition ? isClosedDatedItem(edition, today) : false,
          participantName:
            participation.participantType === 'minor'
              ? `${minor?.firstName ?? '-'} ${minor?.lastName ?? ''}`.trim()
              : `${adult?.firstName ?? '-'} ${adult?.lastName ?? ''}`.trim(),
          participantType: participation.participantType,
          tutorLabel: prospect ? `${prospect.firstName} ${prospect.lastName}` : '-',
          tutorEmail: prospect?.email ?? '-',
          tutorPhone: prospect?.phone ?? '',
          participationStatus: participation.status,
          groupLabel,
          scheduleEntries,
          sessionDates: selectedSessions.map((item) => item.date).filter((item) => Boolean(item)),
          createdAt: participation.createdAt,
        }
      })
      setRows(nextRows)
    }

    load()
    const eventName = getOpenDayRecordsChangedEventName()
    window.addEventListener(eventName, load)
    return () => window.removeEventListener(eventName, load)
  }, [])

  const allParticipations = useMemo(() => getOpenDayParticipations(), [rows])
  const allProspects = useMemo(() => getOpenDayProspects(), [rows])
  const allMinors = useMemo(() => getOpenDayMinorAthletes(), [rows])
  const allAdults = useMemo(() => getOpenDayAdultAthletes(), [rows])
  const allGroups = useMemo(() => getOpenDayGroups(), [])
  const allSessions = useMemo(() => getOpenDaySessions(), [])
  const visibleRows = useMemo(
    () => rows.filter((row) => (viewMode === 'active' ? !row.isHistorical : row.isHistorical)),
    [rows, viewMode],
  )
  const categories = useMemo(() => {
    const visibleCategoryIds = new Set(visibleRows.map((row) => row.categoryId).filter((item) => Boolean(item)))
    return getSportCategories().filter((item) => item.isActive && visibleCategoryIds.has(item.id))
  }, [visibleRows])
  const groups = useMemo(() => {
    const next = new Set<string>()
    visibleRows.forEach((row) => {
      row.groupLabel
        .split(' | ')
        .map((item) => item.trim())
        .filter((item) => Boolean(item))
        .forEach((item) => next.add(item))
    })
    return Array.from(next).sort((left, right) => left.localeCompare(right))
  }, [visibleRows])

  useEffect(() => {
    if (categoryFilter && !categories.some((item) => item.id === categoryFilter)) {
      setCategoryFilter('')
    }
  }, [categories, categoryFilter])

  useEffect(() => {
    if (groupFilter && !groups.includes(groupFilter)) {
      setGroupFilter('')
    }
  }, [groupFilter, groups])

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if ((viewMode === 'active') === row.isHistorical) {
          return false
        }
        const haystack = `${row.openDayLabel} ${row.participantName} ${row.tutorLabel} ${row.tutorEmail} ${row.groupLabel} ${row.scheduleEntries.join(' ')}`.toLowerCase()
        if (search.trim() && !haystack.includes(search.trim().toLowerCase())) {
          return false
        }
        if (categoryFilter && row.categoryId !== categoryFilter) {
          return false
        }
        if (groupFilter) {
          const groupNames = row.groupLabel.split(' | ').map((item) => item.trim())
          if (!groupNames.includes(groupFilter)) {
            return false
          }
        }
        if (dateFrom && !row.sessionDates.some((item) => item >= dateFrom)) {
          return false
        }
        if (dateTo && !row.sessionDates.some((item) => item <= dateTo)) {
          return false
        }
        if (statusFilter !== 'all' && row.participationStatus !== statusFilter) {
          return false
        }
        return typeFilter === 'all' || row.participantType === typeFilter
      }),
    [categoryFilter, dateFrom, dateTo, groupFilter, rows, search, statusFilter, typeFilter, viewMode],
  )

  const selectedParticipation = useMemo(
    () => allParticipations.find((item) => item.id === selectedId) ?? null,
    [allParticipations, selectedId],
  )
  const selectedProspect = useMemo(
    () => (selectedParticipation ? allProspects.find((item) => item.id === selectedParticipation.prospectId) ?? null : null),
    [allProspects, selectedParticipation],
  )
  const selectedMinor = useMemo(
    () =>
      selectedParticipation?.minorAthleteId
        ? allMinors.find((item) => item.id === selectedParticipation.minorAthleteId) ?? null
        : null,
    [allMinors, selectedParticipation],
  )
  const selectedAdult = useMemo(
    () =>
      selectedParticipation?.adultAthleteId
        ? allAdults.find((item) => item.id === selectedParticipation.adultAthleteId) ?? null
        : null,
    [allAdults, selectedParticipation],
  )
  const selectedRow = useMemo(
    () => filteredRows.find((item) => item.id === selectedId) ?? rows.find((item) => item.id === selectedId) ?? null,
    [filteredRows, rows, selectedId],
  )

  const selectableSessions = useMemo(() => {
    if (!selectedParticipation) {
      return []
    }
    const participantBirthYear = getBirthYear(draft.participantBirthDate)
    const participantGender = draft.participantGender
    const eligibleGroups = allGroups.filter((item) => {
      if (item.openDayEditionId !== selectedParticipation.openDayEditionId) {
        return false
      }
      if (participantBirthYear !== null && (participantBirthYear < item.birthYearMin || participantBirthYear > item.birthYearMax)) {
        return false
      }
      if (item.gender === 'male' && participantGender !== 'M') {
        return false
      }
      if (item.gender === 'female' && participantGender !== 'F') {
        return false
      }
      return true
    })
    const editionGroupIds = new Set(eligibleGroups.map((item) => item.id))
    return allSessions
      .filter((item) => editionGroupIds.has(item.groupId))
      .map((session) => {
        const group = allGroups.find((item) => item.id === session.groupId) ?? null
        return {
          ...session,
          groupTitle: group?.title ?? t('openDay.common.group'),
        }
      })
      .sort((left, right) => `${left.date}${left.startTime}`.localeCompare(`${right.date}${right.startTime}`))
  }, [allGroups, allSessions, draft.participantBirthDate, draft.participantGender, selectedParticipation, t])

  useEffect(() => {
    const allowedIds = new Set(selectableSessions.map((item) => item.id))
    setDraft((prev) => {
      const nextSelectedSessionIds = prev.selectedSessionIds.filter((item) => allowedIds.has(item))
      if (nextSelectedSessionIds.length === prev.selectedSessionIds.length) {
        return prev
      }
      return {
        ...prev,
        selectedSessionIds: nextSelectedSessionIds,
      }
    })
  }, [selectableSessions])

  useEffect(() => {
    if (!selectedParticipation || !selectedProspect) {
      setDraft(EMPTY_DRAFT)
      setModalError('')
      return
    }
    const participant = selectedParticipation.participantType === 'minor' ? selectedMinor : selectedAdult
    setDraft({
      prospectFirstName: selectedProspect.firstName,
      prospectLastName: selectedProspect.lastName,
      prospectEmail: selectedProspect.email,
      prospectPhone: selectedProspect.phone,
      prospectSecondaryPhone: selectedProspect.secondaryPhone,
      prospectBirthDate: selectedProspect.birthDate,
      prospectRole: selectedProspect.role,
      prospectGender: selectedProspect.gender === 'F' ? 'F' : 'M',
      participantFirstName: participant?.firstName ?? '',
      participantLastName: participant?.lastName ?? '',
      participantBirthDate: participant?.birthDate ?? '',
      participantGender: participant?.gender === 'F' ? 'F' : 'M',
      participantEmail: selectedParticipation.participantType === 'adult' ? selectedAdult?.email ?? '' : '',
      participantPhone: selectedParticipation.participantType === 'adult' ? selectedAdult?.phone ?? '' : '',
      selectedSessionIds: selectedParticipation.selectedSessionIds,
      participationStatus: selectedParticipation.status,
    })
    setModalError('')
  }, [selectedAdult, selectedMinor, selectedParticipation, selectedProspect])

  const getParticipationStatusLabel = (status: OpenDayParticipationStatus): string => {
    if (status === 'confirmed') {
      return t('openDay.common.statusConfirmed')
    }
    if (status === 'attended') {
      return t('openDay.common.statusAttended')
    }
    if (status === 'cancelled') {
      return t('openDay.common.statusCancelled')
    }
    return t('openDay.common.statusRegistered')
  }

  const openWhatsAppChat = (phone: string) => {
    const url = buildWhatsAppUrl(phone)
    if (!url) {
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleDeleteParticipation = (participationId: string) => {
    const confirmed = window.confirm(t('openDay.participations.messages.confirmDelete'))
    if (!confirmed) {
      return
    }
    removeOpenDayParticipation(participationId)
    if (selectedId === participationId) {
      setSelectedId(null)
    }
    setMessage(t('openDay.participations.messages.deleted'))
  }

  const columns = useMemo<ColumnDef<ParticipationRow>[]>(
    () => [
      { accessorKey: 'openDayLabel', header: t('openDay.common.openDay') },
      {
        accessorKey: 'participantName',
        header: t('openDay.common.athlete'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.participantName}</div>
            <div className="text-xs opacity-60">
              {row.original.participantType === 'adult' ? t('openDay.common.adult') : t('openDay.common.minor')}
            </div>
          </div>
        ),
      },
      { accessorKey: 'tutorLabel', header: t('openDay.participations.table.tutor') },
      { accessorKey: 'tutorEmail', header: t('openDay.common.email') },
      { accessorKey: 'groupLabel', header: t('openDay.common.group') },
      {
        accessorKey: 'scheduleEntries',
        header: t('openDay.participations.table.schedule'),
        cell: ({ row }) => (
          <div className="space-y-1">
            {row.original.scheduleEntries.map((entry, index) => (
              <div key={`${row.original.id}-schedule-${index}`}>{entry}</div>
            ))}
          </div>
        ),
      },
      {
        accessorKey: 'participationStatus',
        header: t('openDay.common.status'),
        cell: ({ row }) => <span className="badge badge-outline">{getParticipationStatusLabel(row.original.participationStatus)}</span>,
      },
      {
        id: 'actions',
        header: () => <div className="flex justify-end">{t('openDay.common.actions')}</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm px-1 text-success"
              onClick={() => openWhatsAppChat(row.original.tutorPhone)}
              aria-label={t('utility.packages.openWhatsAppGroupAction')}
              title={t('utility.packages.openWhatsAppGroupAction')}
              disabled={!buildWhatsAppUrl(row.original.tutorPhone)}
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm px-1 text-warning"
              onClick={() => setSelectedId(row.original.id)}
              aria-label={t('utility.categories.edit')}
              title={t('utility.categories.edit')}
            >
              <FileText className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm px-1 text-error"
              onClick={() => handleDeleteParticipation(row.original.id)}
              aria-label={t('openDay.participations.delete')}
              title={t('openDay.participations.delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [t],
  )

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const exportHeaders = useMemo(
    () => [
      t('openDay.common.openDay'),
      t('openDay.common.category'),
      t('openDay.common.athlete'),
      t('openDay.common.type'),
      t('openDay.participations.table.tutor'),
      t('openDay.common.email'),
      t('clients.phone'),
      t('openDay.common.group'),
      t('openDay.participations.table.schedule'),
      t('openDay.common.status'),
      t('openDay.participations.fields.createdAtHeader'),
    ],
    [t],
  )

  const exportBodyRows = useMemo(
    () =>
      filteredRows.flatMap((row) => {
        const categoryLabel = categories.find((item) => item.id === row.categoryId)?.label ?? ''
        const participation = allParticipations.find((item) => item.id === row.id) ?? null
        if (!participation) {
          return [[
            row.openDayLabel,
            categoryLabel,
            row.participantName,
            row.participantType === 'adult' ? t('openDay.common.adult') : t('openDay.common.minor'),
            row.tutorLabel,
            row.tutorEmail,
            row.tutorPhone,
            row.groupLabel,
            row.scheduleEntries.join('\n'),
            getParticipationStatusLabel(row.participationStatus),
            row.createdAt.slice(0, 10),
          ]]
        }

        const selectedSessions = participation.selectedSessionIds
          .map((sessionId) => allSessions.find((session) => session.id === sessionId) ?? null)
          .filter((session): session is OpenDaySession => Boolean(session))

        if (selectedSessions.length === 0) {
          return [[
            row.openDayLabel,
            categoryLabel,
            row.participantName,
            row.participantType === 'adult' ? t('openDay.common.adult') : t('openDay.common.minor'),
            row.tutorLabel,
            row.tutorEmail,
            row.tutorPhone,
            row.groupLabel,
            '',
            getParticipationStatusLabel(row.participationStatus),
            row.createdAt.slice(0, 10),
          ]]
        }

        return selectedSessions.map((session) => {
          const group = allGroups.find((item) => item.id === session.groupId) ?? null
          return [
            row.openDayLabel,
            categoryLabel,
            row.participantName,
            row.participantType === 'adult' ? t('openDay.common.adult') : t('openDay.common.minor'),
            row.tutorLabel,
            row.tutorEmail,
            row.tutorPhone,
            group?.title ?? row.groupLabel,
            `${session.date} ${session.startTime}-${session.endTime}`,
            getParticipationStatusLabel(row.participationStatus),
            row.createdAt.slice(0, 10),
          ]
        })
      }),
    [allGroups, allParticipations, allSessions, categories, filteredRows, t],
  )

  const exportFilenameBase = useMemo(
    () => `open-day-registrazioni-${viewMode === 'active' ? 'attive' : 'storico'}-${new Date().toISOString().slice(0, 10)}`,
    [viewMode],
  )

  const handleExport = async () => {
    if (exportBodyRows.length === 0) {
      return
    }

    if (exportFormat === 'xlsx') {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet(t('openDay.participations.title'))
      worksheet.columns = exportHeaders.map((header) => ({ header, key: header, width: 24 }))
      exportBodyRows.forEach((row) => {
        const record: Record<string, string> = {}
        exportHeaders.forEach((header, index) => {
          record[header] = String(row[index] ?? '')
        })
        worksheet.addRow(record)
      })
      const buffer = await workbook.xlsx.writeBuffer()
      saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `${exportFilenameBase}.xlsx`,
      )
      setIsExportModalOpen(false)
      return
    }

    if (exportFormat === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      doc.setFontSize(11)
      doc.text(t('openDay.participations.export.title'), 40, 36)
      autoTable(doc, {
        head: [exportHeaders],
        body: exportBodyRows,
        startY: 50,
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [33, 37, 41] },
      })
      doc.save(`${exportFilenameBase}.pdf`)
      setIsExportModalOpen(false)
      return
    }

    const tableRows = [
      new TableRow({
        children: exportHeaders.map((header) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
          })),
      }),
      ...exportBodyRows.map((row) =>
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
          new Paragraph({
            children: [new TextRun({ text: t('openDay.participations.export.title'), bold: true })],
          }),
          new Table({ rows: tableRows }),
        ],
      }],
    })
    const blob = await Packer.toBlob(doc)
    saveAs(blob, `${exportFilenameBase}.docx`)
    setIsExportModalOpen(false)
  }

  const saveChanges = () => {
    if (!selectedParticipation || !selectedProspect) {
      return
    }
    if (
      !draft.prospectFirstName.trim() ||
      !draft.prospectLastName.trim() ||
      !draft.prospectEmail.trim() ||
      !draft.participantFirstName.trim() ||
      !draft.participantLastName.trim() ||
      draft.selectedSessionIds.length === 0
    ) {
      setModalError(t('openDay.participations.messages.completeMainData'))
      return
    }

    updateOpenDayProspect(selectedProspect.id, {
      firstName: draft.prospectFirstName,
      lastName: draft.prospectLastName,
      email: draft.prospectEmail,
      phone: draft.prospectPhone,
      secondaryPhone: draft.prospectSecondaryPhone,
      birthDate: draft.prospectBirthDate,
      role: draft.prospectRole,
      gender: draft.prospectGender,
    })

    if (selectedParticipation.participantType === 'minor' && selectedMinor) {
      updateOpenDayMinorAthlete(selectedMinor.id, {
        firstName: draft.participantFirstName,
        lastName: draft.participantLastName,
        birthDate: draft.participantBirthDate,
        gender: draft.participantGender,
      })
    }

    if (selectedParticipation.participantType === 'adult' && selectedAdult) {
      updateOpenDayAdultAthlete(selectedAdult.id, {
        firstName: draft.participantFirstName,
        lastName: draft.participantLastName,
        birthDate: draft.participantBirthDate,
        gender: draft.participantGender,
        email: draft.participantEmail,
        phone: draft.participantPhone,
      })
    }

    updateOpenDayParticipation(selectedParticipation.id, {
      selectedSessionIds: draft.selectedSessionIds,
      status: draft.participationStatus,
    })

    setMessage(t('openDay.participations.messages.updated'))
    setModalError('')
  }

  const closeModal = () => {
    setSelectedId(null)
    setModalError('')
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{t('openDay.participations.title')}</h2>
          <p className="text-sm opacity-70">{t('openDay.participations.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setIsExportModalOpen(true)} disabled={filteredRows.length === 0}>
            {t('openDay.participations.export.button')}
          </button>
          <div role="tablist" className="tabs tabs-boxed bg-base-200">
            <button type="button" role="tab" className={`tab ${viewMode === 'active' ? 'tab-active' : ''}`} onClick={() => setViewMode('active')}>
              {t('openDay.participations.tabs.active')}
            </button>
            <button type="button" role="tab" className={`tab ${viewMode === 'history' ? 'tab-active' : ''}`} onClick={() => setViewMode('history')}>
              {t('openDay.participations.tabs.history')}
            </button>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <div className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-3">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-12">
              <label className="form-control lg:col-span-3">
                <span className="label-text mb-1 text-xs">{t('openDay.common.search')}</span>
                <input
                  className="input input-bordered w-full"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('openDay.participations.searchPlaceholder')}
                />
              </label>
              <label className="form-control lg:col-span-2">
                <span className="label-text mb-1 text-xs">{t('openDay.common.category')}</span>
                <select
                  className="select select-bordered w-full"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="">{t('openDay.common.allPlural')}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control lg:col-span-2">
                <span className="label-text mb-1 text-xs">{t('openDay.common.group')}</span>
                <select
                  className="select select-bordered w-full"
                  value={groupFilter}
                  onChange={(event) => setGroupFilter(event.target.value)}
                >
                  <option value="">{t('openDay.common.allPlural')}</option>
                  {groups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control lg:col-span-1">
                <span className="label-text mb-1 text-xs">{t('openDay.common.dateFrom')}</span>
                <input className="input input-bordered w-full" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </label>
              <label className="form-control lg:col-span-1">
                <span className="label-text mb-1 text-xs">{t('openDay.common.dateTo')}</span>
                <input className="input input-bordered w-full" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </label>
              <label className="form-control lg:col-span-1">
                <span className="label-text mb-1 text-xs">{t('openDay.common.status')}</span>
                <select
                  className="select select-bordered w-full"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'all' | OpenDayParticipationStatus)}
                >
                  <option value="all">{t('openDay.common.allPlural')}</option>
                  <option value="registered">{t('openDay.common.statusRegistered')}</option>
                  <option value="confirmed">{t('openDay.common.statusConfirmed')}</option>
                  <option value="attended">{t('openDay.common.statusAttended')}</option>
                  <option value="cancelled">{t('openDay.common.statusCancelled')}</option>
                </select>
              </label>
              <label className="form-control lg:col-span-1">
                <span className="label-text mb-1 text-xs">{t('openDay.common.type')}</span>
                <select
                  className="select select-bordered w-full"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as 'all' | 'adult' | 'minor')}
                >
                  <option value="all">{t('openDay.common.allPlural')}</option>
                  <option value="adult">{t('openDay.common.adult')}</option>
                  <option value="minor">{t('openDay.common.minor')}</option>
                </select>
              </label>
              <div className="flex items-end justify-end lg:col-span-1">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setSearch('')
                    setCategoryFilter('')
                    setGroupFilter('')
                    setDateFrom('')
                    setDateTo('')
                    setStatusFilter('all')
                    setTypeFilter('all')
                  }}
                >
                  {t('common.resetFilters')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {message ? <p className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success">{message}</p> : null}

      <div className="rounded-lg border border-base-300 bg-base-100">
        {filteredRows.length === 0 ? (
          <p className="p-4 text-center text-sm opacity-70">
            {viewMode === 'active'
              ? t('openDay.participations.emptyActive')
              : t('openDay.participations.emptyHistory')}
          </p>
        ) : (
          <DataTable table={table} />
        )}
      </div>

      {selectedRow && selectedParticipation && selectedProspect ? (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-6xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{selectedRow.openDayLabel}</h3>
                <p className="text-sm opacity-70">{t('openDay.participations.detailDescription')}</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal}>{t('dataTable.close')}</button>
            </div>

            {modalError ? <p className="rounded-lg bg-error/15 px-3 py-2 text-sm text-error">{modalError}</p> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-base-300 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-semibold">{t('openDay.participations.sections.prospect')}</h4>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="form-control">
                    <span className="label-text mb-1 text-xs">{t('clients.parentFirstName').replace(' genitore', '')}</span>
                    <input className="input input-bordered w-full" value={draft.prospectFirstName} onChange={(event) => setDraft((prev) => ({ ...prev, prospectFirstName: event.target.value }))} />
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-1 text-xs">{t('users.lastName')}</span>
                    <input className="input input-bordered w-full" value={draft.prospectLastName} onChange={(event) => setDraft((prev) => ({ ...prev, prospectLastName: event.target.value }))} />
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-1 text-xs">{t('openDay.common.email')}</span>
                    <input className="input input-bordered w-full" type="email" value={draft.prospectEmail} onChange={(event) => setDraft((prev) => ({ ...prev, prospectEmail: event.target.value }))} />
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-1 text-xs">{t('clients.phone')}</span>
                    <input className="input input-bordered w-full" value={draft.prospectPhone} onChange={(event) => setDraft((prev) => ({ ...prev, prospectPhone: event.target.value }))} />
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-1 text-xs">{t('clients.secondaryPhone')}</span>
                    <input className="input input-bordered w-full" value={draft.prospectSecondaryPhone} onChange={(event) => setDraft((prev) => ({ ...prev, prospectSecondaryPhone: event.target.value }))} />
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-1 text-xs">{t('clients.parentRoleLabel')}</span>
                    <select className="select select-bordered w-full" value={draft.prospectRole} onChange={(event) => setDraft((prev) => ({ ...prev, prospectRole: event.target.value as OpenDayProspectRole }))}>
                      <option value="parent">{getProspectRoleLabel(t, 'parent')}</option>
                      <option value="guardian">{getProspectRoleLabel(t, 'guardian')}</option>
                      <option value="holder_of_parental_responsibility">{getProspectRoleLabel(t, 'holder_of_parental_responsibility')}</option>
                      <option value="self">{getProspectRoleLabel(t, 'self')}</option>
                    </select>
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-1 text-xs">{t('clients.birthDate')}</span>
                    <input className="input input-bordered w-full" type="date" value={draft.prospectBirthDate} onChange={(event) => setDraft((prev) => ({ ...prev, prospectBirthDate: event.target.value }))} />
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-1 text-xs">{t('clients.gender')}</span>
                    <select
                      className="select select-bordered w-full"
                      value={draft.prospectGender}
                      onChange={(event) => setDraft((prev) => ({ ...prev, prospectGender: event.target.value === 'F' ? 'F' : 'M' }))}
                    >
                      <option value="M">{t('clients.genderMale')}</option>
                      <option value="F">{t('clients.genderFemale')}</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-base-300 p-4">
                <h4 className="font-semibold">{t('openDay.participations.sections.participant')}</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="form-control">
                    <span className="label-text mb-1 text-xs">{t('users.firstName')}</span>
                    <input className="input input-bordered w-full" value={draft.participantFirstName} onChange={(event) => setDraft((prev) => ({ ...prev, participantFirstName: event.target.value }))} />
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-1 text-xs">{t('users.lastName')}</span>
                    <input className="input input-bordered w-full" value={draft.participantLastName} onChange={(event) => setDraft((prev) => ({ ...prev, participantLastName: event.target.value }))} />
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-1 text-xs">{t('clients.birthDate')}</span>
                    <input className="input input-bordered w-full" type="date" value={draft.participantBirthDate} onChange={(event) => setDraft((prev) => ({ ...prev, participantBirthDate: event.target.value }))} />
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-1 text-xs">{t('clients.gender')}</span>
                    <select
                      className="select select-bordered w-full"
                      value={draft.participantGender}
                      onChange={(event) => setDraft((prev) => ({ ...prev, participantGender: event.target.value === 'F' ? 'F' : 'M' }))}
                    >
                      <option value="M">{t('clients.genderMale')}</option>
                      <option value="F">{t('clients.genderFemale')}</option>
                    </select>
                  </label>
                  {selectedParticipation.participantType === 'adult' ? (
                    <>
                      <label className="form-control">
                        <span className="label-text mb-1 text-xs">{t('openDay.common.email')}</span>
                        <input className="input input-bordered w-full" type="email" value={draft.participantEmail} onChange={(event) => setDraft((prev) => ({ ...prev, participantEmail: event.target.value }))} />
                      </label>
                      <label className="form-control">
                        <span className="label-text mb-1 text-xs">{t('clients.phone')}</span>
                        <input className="input input-bordered w-full" value={draft.participantPhone} onChange={(event) => setDraft((prev) => ({ ...prev, participantPhone: event.target.value }))} />
                      </label>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.3fr_.7fr]">
              <div className="rounded-lg border border-base-300 p-4">
                <h4 className="font-semibold">{t('openDay.participations.sections.selectedSessions')}</h4>
                <div className="mt-3 grid gap-2">
                  {selectableSessions.map((session: OpenDaySession & { groupTitle: string }) => {
                    const isChecked = draft.selectedSessionIds.includes(session.id)
                    return (
                      <label key={session.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-base-300 px-3 py-2">
                        <div>
                          <p className="font-medium">{session.groupTitle}</p>
                          <p className="text-xs opacity-70">{session.date} {session.startTime}-{session.endTime}</p>
                        </div>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary"
                          checked={isChecked}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              selectedSessionIds: event.target.checked
                                ? [...prev.selectedSessionIds, session.id]
                                : prev.selectedSessionIds.filter((item) => item !== session.id),
                            }))
                          }
                        />
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-base-300 p-4">
                <h4 className="font-semibold">{t('openDay.participations.sections.workflow')}</h4>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs">{t('openDay.participations.fields.participationStatus')}</span>
                  <select className="select select-bordered w-full" value={draft.participationStatus} onChange={(event) => setDraft((prev) => ({ ...prev, participationStatus: event.target.value as OpenDayParticipationStatus }))}>
                    <option value="registered">{t('openDay.common.statusRegistered')}</option>
                    <option value="confirmed">{t('openDay.common.statusConfirmed')}</option>
                    <option value="attended">{t('openDay.common.statusAttended')}</option>
                    <option value="cancelled">{t('openDay.common.statusCancelled')}</option>
                  </select>
                </label>
                <div className="rounded border border-base-300 px-3 py-2 text-sm">
                  {t('openDay.participations.fields.createdAt', { date: selectedParticipation.createdAt.slice(0, 10) })}
                </div>
                <button type="button" className="btn btn-error btn-outline btn-sm w-full" onClick={() => handleDeleteParticipation(selectedParticipation.id)}>
                  {t('openDay.participations.delete')}
                </button>
              </div>
            </div>

            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>{t('dataTable.close')}</button>
              <button type="button" className="btn btn-primary" onClick={saveChanges}>{t('openDay.participations.saveChanges')}</button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeModal} />
        </dialog>
      ) : null}

      {isExportModalOpen ? (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-xl space-y-4">
            <h3 className="text-lg font-semibold">{t('openDay.participations.export.modalTitle')}</h3>
            <label className="form-control">
              <span className="label-text mb-1 text-xs">{t('openDay.participations.export.formatLabel')}</span>
              <select
                className="select select-bordered w-full"
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value as OpenDayExportFormat)}
              >
                <option value="xlsx">{t('openDay.participations.export.formats.xlsx')}</option>
                <option value="pdf">{t('openDay.participations.export.formats.pdf')}</option>
                <option value="docx">{t('openDay.participations.export.formats.docx')}</option>
              </select>
            </label>
            <p className="text-xs opacity-70">
              {t('openDay.participations.export.rowsCount', { count: exportBodyRows.length })}
            </p>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setIsExportModalOpen(false)}>
                {t('utility.categories.cancelEdit')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={exportBodyRows.length === 0}
                onClick={() => {
                  void handleExport()
                }}
              >
                {t('openDay.participations.export.download')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={() => setIsExportModalOpen(false)} />
        </dialog>
      ) : null}
    </section>
  )
}

export default OpenDayParticipationsPage
