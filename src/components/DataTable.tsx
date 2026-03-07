import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { flexRender, type Header, type Row, type Table } from '@tanstack/react-table'
import { ChevronDown, ChevronUp } from 'lucide-react'

type DataTableProps<TData> = {
  table: Table<TData>
}

type ResponsivePriority = 'high' | 'low'

type ColumnMeta = {
  responsivePriority?: ResponsivePriority
}

type ColumnUiSettings = {
  visible: boolean
  mobileVisible: boolean
  mobilePriority: ResponsivePriority
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

function DataTable<TData>({ table }: DataTableProps<TData>) {
  const { t } = useTranslation()
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [pageSize, setPageSize] = useState<number>(20)
  const [pageIndex, setPageIndex] = useState<number>(0)
  const [isColumnsModalOpen, setIsColumnsModalOpen] = useState(false)
  const [columnOrderState, setColumnOrderState] = useState<string[]>([])
  const [columnSettingsState, setColumnSettingsState] = useState<Record<string, ColumnUiSettings>>({})

  const rows = table.getRowModel().rows
  const leafColumns = table.getAllLeafColumns()
  const flatHeaders = table.getFlatHeaders().filter((header) => !header.isPlaceholder) as Header<TData, unknown>[]
  const headerByColumnId = useMemo(
    () => new Map<string, Header<TData, unknown>>(flatHeaders.map((header) => [header.column.id, header])),
    [flatHeaders],
  )
  const baseColumnIds = useMemo(() => leafColumns.map((column) => column.id), [leafColumns])
  const hasActionsColumn = baseColumnIds.includes('actions')

  const defaultMobilePriorityById = useMemo(() => {
    const hasExplicitPriorities = leafColumns.some(
      (column) => ((column.columnDef.meta as ColumnMeta | undefined)?.responsivePriority ?? undefined) !== undefined,
    )
    return new Map<string, ResponsivePriority>(
      leafColumns.map((column, index) => {
        const explicit = (column.columnDef.meta as ColumnMeta | undefined)?.responsivePriority
        if (explicit) {
          return [column.id, explicit]
        }
        if (hasExplicitPriorities) {
          return [column.id, 'high']
        }
        return [column.id, column.id === 'actions' || index < 2 ? 'high' : 'low']
      }),
    )
  }, [leafColumns])

  const effectiveColumnOrder = useMemo(() => {
    const baseWithoutActions = baseColumnIds.filter((id) => id !== 'actions')
    const orderedWithoutActions = columnOrderState.filter((id) => id !== 'actions' && baseWithoutActions.includes(id))
    const missing = baseWithoutActions.filter((id) => !orderedWithoutActions.includes(id))
    const next = [...orderedWithoutActions, ...missing]
    if (hasActionsColumn) {
      next.push('actions')
    }
    return next
  }, [baseColumnIds, columnOrderState, hasActionsColumn])

  const getColumnSettings = (columnId: string): ColumnUiSettings => {
    if (columnId === 'actions') {
      return { visible: true, mobileVisible: true, mobilePriority: 'high' }
    }
    const saved = columnSettingsState[columnId]
    if (saved) {
      return saved
    }
    return {
      visible: true,
      mobileVisible: true,
      mobilePriority: defaultMobilePriorityById.get(columnId) ?? 'high',
    }
  }

  const visibleColumnIds = effectiveColumnOrder.filter((columnId) => getColumnSettings(columnId).visible)
  const hasLowPriorityColumns = visibleColumnIds.some((columnId) => {
    const settings = getColumnSettings(columnId)
    return settings.mobileVisible && settings.mobilePriority === 'low'
  })

  const totalRows = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const currentPageIndex = Math.min(pageIndex, Math.max(0, totalPages - 1))
  const pagedRows = useMemo(() => {
    const start = currentPageIndex * pageSize
    return rows.slice(start, start + pageSize)
  }, [currentPageIndex, pageSize, rows])

  const configurableColumnIds = effectiveColumnOrder.filter((columnId) => columnId !== 'actions')

  const moveColumn = (columnId: string, direction: 'up' | 'down') => {
    setColumnOrderState((prev) => {
      const current = prev.length > 0
        ? prev.filter((id) => id !== 'actions' && baseColumnIds.includes(id))
        : baseColumnIds.filter((id) => id !== 'actions')
      const index = current.indexOf(columnId)
      if (index < 0) {
        return current
      }
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current
      }
      const next = [...current]
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }

  const setColumnVisible = (columnId: string, visible: boolean) => {
    setColumnSettingsState((prev) => ({
      ...prev,
      [columnId]: { ...getColumnSettings(columnId), visible },
    }))
  }

  const setColumnMobilePriority = (columnId: string, mobilePriority: ResponsivePriority) => {
    setColumnSettingsState((prev) => ({
      ...prev,
      [columnId]: { ...getColumnSettings(columnId), mobilePriority },
    }))
  }

  const setColumnMobileVisible = (columnId: string, mobileVisible: boolean) => {
    setColumnSettingsState((prev) => ({
      ...prev,
      [columnId]: { ...getColumnSettings(columnId), mobileVisible },
    }))
  }

  const resolveColumnLabel = (columnId: string): string => {
    const header = headerByColumnId.get(columnId)
    if (!header) {
      return columnId
    }
    const rawHeader = header.column.columnDef.header
    if (typeof rawHeader === 'string') {
      return rawHeader
    }
    return columnId
  }

  const getOrderedVisibleCells = (row: Row<TData>) => {
    const cellsById = new Map(row.getVisibleCells().map((cell) => [cell.column.id, cell]))
    return visibleColumnIds
      .map((columnId) => cellsById.get(columnId))
      .filter((cell): cell is NonNullable<typeof cell> => Boolean(cell))
  }

  return (
    <div className="overflow-hidden rounded-lg border border-base-300">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 bg-base-100 px-3 py-2">
        <button type="button" className="btn btn-outline btn-xs" onClick={() => setIsColumnsModalOpen(true)}>
          {t('dataTable.columns')}
        </button>
        <label className="form-control">
          <span className="sr-only">{t('dataTable.rowsPerPage')}</span>
          <select
            className="select select-bordered select-xs"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value))
              setPageIndex(0)
            }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={`page-size-${size}`} value={size}>
                {t('dataTable.pageSizeOption', { size })}
              </option>
            ))}
          </select>
        </label>
      </div>
      {isColumnsModalOpen ? (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-3xl space-y-3">
            <h3 className="text-base font-semibold">{t('dataTable.columnsManagement')}</h3>
            <div className="space-y-2">
              {configurableColumnIds.map((columnId, index) => {
                const settings = getColumnSettings(columnId)
                return (
                  <div key={`col-settings-${columnId}`} className="grid items-center gap-2 rounded-lg border border-base-300 p-2 md:grid-cols-[1fr_auto_auto_auto]">
                    <span className="text-xs">{resolveColumnLabel(columnId)}</span>
                    <label className="label cursor-pointer justify-start gap-2 p-0">
                      <span className="label-text text-xs">{t('dataTable.visible')}</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-xs"
                        checked={settings.visible}
                        onChange={(event) => setColumnVisible(columnId, event.target.checked)}
                      />
                    </label>
                    <label className="label cursor-pointer justify-start gap-2 p-0">
                      <span className="label-text text-xs">{t('dataTable.mobileVisible')}</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-xs"
                        checked={settings.mobileVisible}
                        onChange={(event) => setColumnMobileVisible(columnId, event.target.checked)}
                      />
                    </label>
                    <label className="label cursor-pointer justify-start gap-2 p-0">
                      <span className="label-text text-xs">{t('dataTable.mobilePriority')}</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-xs"
                        checked={settings.mobilePriority === 'high'}
                        onChange={(event) => setColumnMobilePriority(columnId, event.target.checked ? 'high' : 'low')}
                      />
                    </label>
                    <div className="flex gap-1 md:col-span-4 md:justify-end">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        disabled={index === 0}
                        onClick={() => moveColumn(columnId, 'up')}
                      >
                        {t('dataTable.up')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        disabled={index === configurableColumnIds.length - 1}
                        onClick={() => moveColumn(columnId, 'down')}
                      >
                        {t('dataTable.down')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="modal-action">
              <button type="button" className="btn btn-primary" onClick={() => setIsColumnsModalOpen(false)}>
                {t('dataTable.close')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={() => setIsColumnsModalOpen(false)} />
        </dialog>
      ) : null}
      <table className="table w-full [&_th]:whitespace-normal [&_td]:whitespace-normal">
        <thead>
          <tr>
            {hasLowPriorityColumns ? <th className="w-10 md:hidden" /> : null}
            {visibleColumnIds.map((columnId) => {
              const header = headerByColumnId.get(columnId)
              if (!header) {
                return null
              }
              const settings = getColumnSettings(columnId)
              const hiddenOnMobile = !settings.mobileVisible
              const isLowPriority = settings.mobilePriority === 'low'
              const mobileClass = hiddenOnMobile || isLowPriority ? 'hidden md:table-cell' : 'break-words'
              return (
                <th key={header.id} className={mobileClass}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {pagedRows.map((row) => {
            const orderedVisibleCells = getOrderedVisibleCells(row)
            const lowPriorityCells = orderedVisibleCells.filter(
              (cell) => {
                const settings = getColumnSettings(cell.column.id)
                return settings.mobileVisible && settings.mobilePriority === 'low'
              },
            )
            const canExpand = hasLowPriorityColumns && lowPriorityCells.length > 0
            const isExpanded = Boolean(expandedRows[row.id])
            const colSpan = orderedVisibleCells.length + (hasLowPriorityColumns ? 1 : 0)

            return (
              <Fragment key={row.id}>
                <tr>
                  {hasLowPriorityColumns ? (
                    <td className="align-top md:hidden">
                      {canExpand ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs px-1"
                          aria-label={isExpanded ? t('dataTable.hideDetails') : t('dataTable.showDetails')}
                          onClick={() =>
                            setExpandedRows((prev) => ({
                              ...prev,
                              [row.id]: !prev[row.id],
                            }))
                          }
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                  {orderedVisibleCells.map((cell) => {
                    const settings = getColumnSettings(cell.column.id)
                    const hiddenOnMobile = !settings.mobileVisible
                    const isLowPriority = settings.mobilePriority === 'low'
                    const mobileClass = hiddenOnMobile || isLowPriority ? 'hidden md:table-cell' : 'break-words'
                    return (
                      <td key={cell.id} className={mobileClass}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
                {canExpand && isExpanded ? (
                  <tr className="md:hidden">
                    <td colSpan={colSpan} className="bg-base-200/40">
                      <div className="space-y-2">
                        {lowPriorityCells.map((cell) => {
                          const header = headerByColumnId.get(cell.column.id)
                          if (!header) {
                            return null
                          }
                          return (
                            <div key={`expanded-${row.id}-${cell.id}`} className="grid gap-1">
                              <p className="text-xs font-medium opacity-70">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </p>
                              <div>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      <div className="flex items-center justify-between gap-2 border-t border-base-300 bg-base-100 px-3 py-2 text-xs">
        <span>
          {t('dataTable.pageOf', {
            page: totalRows === 0 ? 0 : currentPageIndex + 1,
            total: totalRows === 0 ? 0 : totalPages,
          })}
        </span>
        <span className="hidden md:inline">{t('dataTable.totalRows', { total: totalRows })}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentPageIndex === 0 || totalRows === 0}
          >
            {t('dataTable.previous')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setPageIndex((prev) => Math.min(totalPages - 1, Math.min(prev, totalPages - 1) + 1))}
            disabled={totalRows === 0 || currentPageIndex >= totalPages - 1}
          >
            {t('dataTable.next')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DataTable
