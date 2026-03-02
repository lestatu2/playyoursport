import { Fragment, useCallback, useMemo, useState } from 'react'
import { flexRender, type Cell, type Header, type Row, type Table } from '@tanstack/react-table'
import { ChevronDown, ChevronUp } from 'lucide-react'

type DataTableProps<TData> = {
  table: Table<TData>
}

type ResponsivePriority = 'high' | 'low'

type ColumnMeta = {
  responsivePriority?: ResponsivePriority
}

function DataTable<TData>({ table }: DataTableProps<TData>) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const rows = table.getRowModel().rows
  const leafColumns = table.getAllLeafColumns()
  const hasExplicitPriorities = leafColumns.some(
    (column) => ((column.columnDef.meta as ColumnMeta | undefined)?.responsivePriority ?? undefined) !== undefined,
  )
  const priorityByColumnId = useMemo(() => {
    return new Map<string, ResponsivePriority>(
      leafColumns.map((column, index) => {
        const explicit = (column.columnDef.meta as ColumnMeta | undefined)?.responsivePriority
        if (explicit) {
          return [column.id, explicit]
        }
        if (hasExplicitPriorities) {
          return [column.id, 'high']
        }
        const autoPriority: ResponsivePriority =
          column.id === 'actions' || index < 2 ? 'high' : 'low'
        return [column.id, autoPriority]
      }),
    )
  }, [hasExplicitPriorities, leafColumns])
  const getPriority = useCallback(
    (headerOrCell: Header<TData, unknown> | Cell<TData, unknown>): ResponsivePriority =>
      priorityByColumnId.get(headerOrCell.column.id) ?? 'high',
    [priorityByColumnId],
  )
  const hasLowPriorityColumns = Array.from(priorityByColumnId.values()).some((priority) => priority === 'low')
  const headerByColumnId = useMemo(() => {
    const map = new Map<string, Header<TData, unknown>>()
    table.getFlatHeaders().forEach((header) => {
      if (!header.isPlaceholder) {
        map.set(header.column.id, header as Header<TData, unknown>)
      }
    })
    return map
  }, [table])

  const getLowPriorityCells = (row: Row<TData>) => row.getVisibleCells().filter((cell) => getPriority(cell) === 'low')

  return (
    <div className="overflow-x-auto rounded-lg border border-base-300">
      <table className="table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {hasLowPriorityColumns && <th className="w-10 md:hidden" />}
              {headerGroup.headers.map((header) => (
                <th key={header.id} className={getPriority(header as Header<TData, unknown>) === 'low' ? 'hidden md:table-cell' : ''}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row) => {
            const lowPriorityCells = getLowPriorityCells(row)
            const canExpand = hasLowPriorityColumns && lowPriorityCells.length > 0
            const isExpanded = Boolean(expandedRows[row.id])
            const colSpan = row.getVisibleCells().length + (hasLowPriorityColumns ? 1 : 0)

            return (
              <Fragment key={row.id}>
                <tr key={row.id}>
                  {hasLowPriorityColumns && (
                    <td className="align-top md:hidden">
                      {canExpand ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs px-1"
                          aria-label={isExpanded ? 'Nascondi dettagli' : 'Mostra dettagli'}
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
                  )}
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={getPriority(cell) === 'low' ? 'hidden md:table-cell' : ''}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {canExpand && isExpanded && (
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
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
