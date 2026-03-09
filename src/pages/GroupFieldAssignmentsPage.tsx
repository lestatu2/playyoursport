import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DndContext, DragOverlay, PointerSensor, closestCenter, type DragEndEvent, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { AuthSession } from '../lib/auth'
import { getPackages, getFields } from '../lib/package-catalog'
import { getPublicMinors } from '../lib/public-customer-records'
import { getPublicDirectAthletes } from '../lib/public-direct-athletes'
import {
  clearAssignmentFinalizationByGroup,
  ensureAssignmentsForPackage,
  finalizeAssignmentGroup,
  getAssignmentFinalizationByGroup,
  setAthleteAssignment,
} from '../lib/group-field-assignments'

type GroupFieldAssignmentsPageProps = {
  session: AuthSession
}

type AthleteCardRow = {
  athleteKey: string
  fullName: string
  birthDate: string
  type: 'minor' | 'direct'
}

type Slot = {
  groupId: string
  groupTitle: string
  fieldId: string
  fieldTitle: string
  schedulesLabel: string[]
}

function DraggableAthleteCard({ athlete }: { athlete: AthleteCardRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `athlete:${athlete.athleteKey}`,
    data: {
      type: 'athlete',
      athleteKey: athlete.athleteKey,
    },
  })
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="rounded border border-base-300 bg-base-100 p-2 text-sm shadow-sm"
    >
      <p className="font-medium">{athlete.fullName}</p>
      <p className="text-xs opacity-70">{athlete.type === 'minor' ? 'Minore' : 'Adulto'}</p>
    </div>
  )
}

function DropSlot({
  slot,
  athletes,
}: {
  slot: Slot
  athletes: AthleteCardRow[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop-group:${slot.groupId}` })
  return (
    <div ref={setNodeRef} className={`rounded border p-2 ${isOver ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-200/50'}`}>
      <div className="mb-2">
        <p className="text-xs font-semibold">{slot.fieldTitle}</p>
        <div className="space-y-1">
          {slot.schedulesLabel.map((label) => (
            <p key={label} className="text-xs opacity-70">{label}</p>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {athletes.map((athlete) => (
          <DraggableAthleteCard key={athlete.athleteKey} athlete={athlete} />
        ))}
      </div>
    </div>
  )
}

function SortableGroupCard({
  groupId,
  children,
}: {
  groupId: string
  children: (dragHandle: {
    ref: (node: HTMLElement | null) => void
    attributes: Record<string, unknown>
    listeners: Record<string, unknown>
  }) => ReactNode
}) {
  const { setNodeRef, setActivatorNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: `sort-group:${groupId}`,
    data: {
      type: 'group',
      groupId,
    },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-base-300 bg-base-100 p-3 ${isDragging ? 'opacity-80' : ''}`}
    >
      {children({
        ref: setActivatorNodeRef,
        attributes: attributes as unknown as Record<string, unknown>,
        listeners: listeners as unknown as Record<string, unknown>,
      })}
    </article>
  )
}

function GroupFieldAssignmentsPage({ session }: GroupFieldAssignmentsPageProps) {
  const { t } = useTranslation()
  const isAdministrator = session.role === 'super-administrator' || session.role === 'administrator'
  const allPackages = useMemo(
    () => getPackages().filter((item) => item.status === 'published'),
    [],
  )
  const visiblePackages = useMemo(
    () => (session.role === 'trainer'
      ? allPackages.filter((item) => item.trainerIds.includes(session.userId))
      : allPackages),
    [allPackages, session.role, session.userId],
  )
  const editablePackages = useMemo(() => {
    const now = new Date()
    return visiblePackages.filter((item) => {
      if (item.durationType !== 'period') {
        return false
      }
      const end = new Date(`${item.periodEndDate}T23:59:59`)
      if (Number.isNaN(end.getTime())) {
        return false
      }
      return now <= end
    })
  }, [visiblePackages])
  const [selectedPackageId, setSelectedPackageId] = useState(editablePackages[0]?.id ?? '')
  const [finalizationVersion, setFinalizationVersion] = useState(0)
  const [assignmentsVersion, setAssignmentsVersion] = useState(0)
  const [searchName, setSearchName] = useState('')
  const [searchAge, setSearchAge] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [fieldFilter, setFieldFilter] = useState('')
  const [weekdayFilter, setWeekdayFilter] = useState('')
  const [groupOrderByPackage, setGroupOrderByPackage] = useState<Record<string, string[]>>({})
  const [activeAthleteKey, setActiveAthleteKey] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const effectiveSelectedPackageId = useMemo(
    () => (editablePackages.some((item) => item.id === selectedPackageId)
      ? selectedPackageId
      : (editablePackages[0]?.id ?? '')),
    [editablePackages, selectedPackageId],
  )
  const selectedPackage = useMemo(
    () => editablePackages.find((item) => item.id === effectiveSelectedPackageId) ?? null,
    [editablePackages, effectiveSelectedPackageId],
  )
  const fieldsById = useMemo(() => new Map(getFields().map((field) => [field.id, field.title])), [])

  const athletes = useMemo<AthleteCardRow[]>(() => {
    if (!selectedPackage) {
      return []
    }
    const minors = getPublicMinors()
      .filter((item) => item.packageId === selectedPackage.id)
      .map((item) => ({
        athleteKey: `minor-${item.id}`,
        fullName: `${item.firstName} ${item.lastName}`.trim(),
        birthDate: item.birthDate,
        type: 'minor' as const,
      }))
    const directs = getPublicDirectAthletes()
      .filter((item) => item.packageId === selectedPackage.id)
      .map((item) => ({
        athleteKey: `direct-${item.id}`,
        fullName: `${item.firstName} ${item.lastName}`.trim(),
        birthDate: item.birthDate,
        type: 'direct' as const,
      }))
    return [...minors, ...directs]
  }, [selectedPackage])
  const filteredAthletes = useMemo(() => {
    const normalizedSearch = searchName.trim().toLowerCase()
    const targetAge = searchAge.trim() ? Number.parseInt(searchAge, 10) : null
    const computeAge = (birthDate: string): number | null => {
      const parsed = new Date(birthDate)
      if (Number.isNaN(parsed.getTime())) {
        return null
      }
      const now = new Date()
      let age = now.getFullYear() - parsed.getFullYear()
      const monthDelta = now.getMonth() - parsed.getMonth()
      if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < parsed.getDate())) {
        age -= 1
      }
      return age
    }
    return athletes.filter((athlete) => {
      if (normalizedSearch && !athlete.fullName.toLowerCase().includes(normalizedSearch)) {
        return false
      }
      if (targetAge !== null && Number.isFinite(targetAge)) {
        const athleteAge = computeAge(athlete.birthDate)
        if (athleteAge !== targetAge) {
          return false
        }
      }
      return true
    })
  }, [athletes, searchAge, searchName])

  const slots = useMemo<Slot[]>(() => {
    if (!selectedPackage) {
      return []
    }
    return selectedPackage.groups.map((group) => {
      const schedulesLabel =
        group.schedules.length === 0
          ? [t('assignments.noSchedule')]
          : group.schedules.map((schedule) => `${t(`public.youthWizard.schedule.weekdays.${schedule.weekday}`)} ${schedule.time}`)
      return {
        groupId: group.id,
        groupTitle: group.title,
        fieldId: group.fieldId,
        fieldTitle: fieldsById.get(group.fieldId) ?? group.fieldId,
        schedulesLabel,
      }
    })
  }, [fieldsById, selectedPackage, t])
  const availableWeekdays = useMemo(() => {
    if (!selectedPackage) {
      return [] as number[]
    }
    return Array.from(
      new Set(
        selectedPackage.groups.flatMap((group) => group.schedules.map((schedule) => schedule.weekday)),
      ),
    ).sort((a, b) => a - b)
  }, [selectedPackage])
  const orderedGroups = useMemo(() => {
    if (!selectedPackage) {
      return []
    }
    const baseOrder = groupOrderByPackage[selectedPackage.id] ?? selectedPackage.groups.map((group) => group.id)
    const normalizedOrder = [
      ...baseOrder.filter((id) => selectedPackage.groups.some((group) => group.id === id)),
      ...selectedPackage.groups.map((group) => group.id).filter((id) => !baseOrder.includes(id)),
    ]
    return normalizedOrder
      .map((id) => selectedPackage.groups.find((group) => group.id === id))
      .filter((group): group is (typeof selectedPackage.groups)[number] => Boolean(group))
  }, [groupOrderByPackage, selectedPackage])
  const filteredGroups = useMemo(() => {
    if (!selectedPackage) {
      return []
    }
    const targetWeekday = weekdayFilter.trim() ? Number.parseInt(weekdayFilter, 10) : null
    return orderedGroups.filter((group) => {
      if (groupFilter && group.id !== groupFilter) {
        return false
      }
      if (fieldFilter && group.fieldId !== fieldFilter) {
        return false
      }
      if (targetWeekday !== null && Number.isFinite(targetWeekday)) {
        if (!group.schedules.some((schedule) => schedule.weekday === targetWeekday)) {
          return false
        }
      }
      return true
    })
  }, [fieldFilter, groupFilter, orderedGroups, selectedPackage, weekdayFilter])

  const assignments = useMemo(() => {
    void assignmentsVersion
    if (!selectedPackage) {
      return []
    }
    return ensureAssignmentsForPackage(
      selectedPackage,
      athletes.map((athlete) => ({ athleteKey: athlete.athleteKey, birthDate: athlete.birthDate })),
      session.userId,
    )
  }, [assignmentsVersion, athletes, selectedPackage, session.userId])

  const assignmentByAthleteKey = useMemo(() => new Map(assignments.map((item) => [item.athleteKey, item])), [assignments])
  const athletesBySlot = useMemo(() => {
    const map = new Map<string, AthleteCardRow[]>()
    slots.forEach((slot) => map.set(slot.groupId, []))
    filteredAthletes.forEach((athlete) => {
      const assignment = assignmentByAthleteKey.get(athlete.athleteKey)
      if (!assignment) {
        return
      }
      const current = map.get(assignment.groupId) ?? []
      map.set(assignment.groupId, [...current, athlete])
    })
    return map
  }, [assignmentByAthleteKey, filteredAthletes, slots])

  const finalizationsByGroup = useMemo(() => {
    void finalizationVersion
    if (!selectedPackage) {
      return new Map<string, boolean>()
    }
    const map = new Map<string, boolean>()
    selectedPackage.groups.forEach((group) => {
      map.set(group.id, Boolean(getAssignmentFinalizationByGroup(selectedPackage.id, group.id)))
    })
    return map
  }, [finalizationVersion, selectedPackage])

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveAthleteKey(null)
    if (!selectedPackage || !event.over) {
      return
    }
    const activeType = event.active.data.current?.type
    if (activeType === 'group') {
      const activeGroupId = String(event.active.data.current?.groupId ?? '')
      const overId = String(event.over.id)
      const overGroupId = overId.startsWith('sort-group:')
        ? overId.slice('sort-group:'.length)
        : (overId.startsWith('drop-group:') ? overId.slice('drop-group:'.length) : '')
      if (!activeGroupId || !overGroupId || activeGroupId === overGroupId) {
        return
      }
      const currentOrder = groupOrderByPackage[selectedPackage.id] ?? selectedPackage.groups.map((group) => group.id)
      const fromIndex = currentOrder.indexOf(activeGroupId)
      const toIndex = currentOrder.indexOf(overGroupId)
      if (fromIndex < 0 || toIndex < 0) {
        return
      }
      const nextOrder = arrayMove(currentOrder, fromIndex, toIndex)
      setGroupOrderByPackage((prev) => ({ ...prev, [selectedPackage.id]: nextOrder }))
      return
    }
    if (activeType !== 'athlete') {
      return
    }
    const athleteKey = String(event.active.data.current?.athleteKey ?? '')
    const overId = String(event.over.id)
    const toGroupId = overId.startsWith('drop-group:') ? overId.slice('drop-group:'.length) : ''
    const targetSlot = slots.find((slot) => slot.groupId === toGroupId)
    if (!targetSlot || !toGroupId) {
      return
    }
    const current = assignmentByAthleteKey.get(athleteKey)
    if (!current) {
      return
    }
    if (current.groupId === toGroupId) {
      return
    }
    setAthleteAssignment({
      athleteKey,
      packageId: selectedPackage.id,
      groupId: toGroupId,
      fieldId: targetSlot.fieldId,
      scheduleId: '__group',
      updatedByUserId: session.userId,
    })
    if (current.groupId !== toGroupId) {
      clearAssignmentFinalizationByGroup(selectedPackage.id, current.groupId)
      clearAssignmentFinalizationByGroup(selectedPackage.id, toGroupId)
      setFinalizationVersion((prev) => prev + 1)
    }
    setAssignmentsVersion((prev) => prev + 1)
    setMessage(t('assignments.moveApplied'))
  }

  const handleToggleFinalizeGroup = (groupId: string) => {
    if (!selectedPackage || !groupId || !isAdministrator) {
      return
    }
    const alreadyFinalized = finalizationsByGroup.get(groupId) ?? false
    if (alreadyFinalized) {
      clearAssignmentFinalizationByGroup(selectedPackage.id, groupId)
      setFinalizationVersion((prev) => prev + 1)
      setMessage(t('assignments.groupReopened'))
      return
    }
    finalizeAssignmentGroup(selectedPackage.id, groupId, session.userId)
    setFinalizationVersion((prev) => prev + 1)
    setMessage(t('assignments.groupFinalized'))
  }
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{t('assignments.title')}</h2>
        <p className="text-sm opacity-70">{t('assignments.description')}</p>
      </div>

      <div className="rounded-lg border border-base-300 bg-base-100 p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('assignments.package')}</span>
            <select
              className="select select-bordered w-full"
              value={effectiveSelectedPackageId}
              onChange={(event) => {
                setSelectedPackageId(event.target.value)
                setAssignmentsVersion((prev) => prev + 1)
                setGroupFilter('')
                setFieldFilter('')
                setWeekdayFilter('')
              }}
            >
              {editablePackages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('assignments.searchName')}</span>
            <input
              className="input input-bordered w-full"
              value={searchName}
              onChange={(event) => setSearchName(event.target.value)}
              placeholder={t('assignments.searchNamePlaceholder')}
            />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('assignments.searchAge')}</span>
            <input
              className="input input-bordered w-full"
              value={searchAge}
              onChange={(event) => setSearchAge(event.target.value.replace(/\D/g, ''))}
              placeholder={t('assignments.searchAgePlaceholder')}
            />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('assignments.searchGroup')}</span>
            <select
              className="select select-bordered w-full"
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
            >
              <option value="">{t('assignments.allGroups')}</option>
              {selectedPackage?.groups.map((group) => (
                <option key={group.id} value={group.id}>{group.title}</option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('assignments.searchField')}</span>
            <select
              className="select select-bordered w-full"
              value={fieldFilter}
              onChange={(event) => setFieldFilter(event.target.value)}
            >
              <option value="">{t('assignments.allFields')}</option>
              {selectedPackage
                ? Array.from(new Set(selectedPackage.groups.map((group) => group.fieldId))).map((fieldId) => (
                  <option key={fieldId} value={fieldId}>{fieldsById.get(fieldId) ?? fieldId}</option>
                ))
                : null}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">{t('assignments.searchWeekday')}</span>
            <select
              className="select select-bordered w-full"
              value={weekdayFilter}
              onChange={(event) => setWeekdayFilter(event.target.value)}
            >
              <option value="">{t('assignments.allWeekdays')}</option>
              {availableWeekdays.map((weekday) => (
                <option key={weekday} value={String(weekday)}>
                  {t(`public.youthWizard.schedule.weekdays.${weekday}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {message ? <p className="rounded bg-success/15 px-3 py-2 text-sm text-success">{message}</p> : null}

      {!selectedPackage ? (
        <p className="rounded border border-base-300 bg-base-100 p-4 text-sm opacity-70">{t('assignments.noPackages')}</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(event) => {
            const isAthlete = event.active.data.current?.type === 'athlete'
            if (!isAthlete) {
              setActiveAthleteKey(null)
              return
            }
            const athleteKey = String(event.active.data.current?.athleteKey ?? '')
            setActiveAthleteKey(athleteKey)
          }}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveAthleteKey(null)}
        >
          <SortableContext
            items={filteredGroups.map((group) => `sort-group:${group.id}`)}
            strategy={rectSortingStrategy}
          >
            <div className="grid gap-3 lg:grid-cols-3">
              {filteredGroups.map((group) => (
                <SortableGroupCard key={group.id} groupId={group.id}>
                  {(dragHandle) => (
                    <>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs cursor-grab active:cursor-grabbing"
                            ref={dragHandle.ref}
                            {...dragHandle.attributes}
                            {...dragHandle.listeners}
                            aria-label={t('assignments.dragGroup')}
                            title={t('assignments.dragGroup')}
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                          <h3 className="text-sm font-semibold">{group.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`badge ${finalizationsByGroup.get(group.id) ? 'badge-success' : 'badge-warning'}`}>
                            {finalizationsByGroup.get(group.id) ? t('assignments.statusFinalized') : t('assignments.statusDraft')}
                          </span>
                          {isAdministrator ? (
                            <button type="button" className="btn btn-primary btn-xs" onClick={() => handleToggleFinalizeGroup(group.id)}>
                              {finalizationsByGroup.get(group.id) ? t('assignments.reopenGroup') : t('assignments.finalizeGroup')}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2 space-y-2">
                        {slots
                          .filter((slot) => slot.groupId === group.id)
                          .map((slot) => (
                            <DropSlot
                              key={slot.groupId}
                              slot={slot}
                              athletes={athletesBySlot.get(slot.groupId) ?? []}
                            />
                          ))}
                      </div>
                    </>
                  )}
                </SortableGroupCard>
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeAthleteKey ? (
              <div className="rounded border border-primary bg-base-100 px-3 py-2 text-sm shadow-lg">
                {filteredAthletes.find((item) => item.athleteKey === activeAthleteKey)?.fullName ?? activeAthleteKey}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </section>
  )
}

export default GroupFieldAssignmentsPage
