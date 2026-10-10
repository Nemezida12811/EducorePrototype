import type { ReactNode } from 'react'

export interface Column<T> {
  header: string
  cell: (row: T) => ReactNode
  align?: 'left' | 'right'
  /** Marks the row-header cell for screen readers. */
  rowHeader?: boolean
}

interface DataTableProps<T> {
  caption: string
  columns: Column<T>[]
  rows: T[]
  getKey: (row: T) => string
}

/** Scrolls horizontally inside its own region on narrow screens; the page itself never does. */
export function DataTable<T>({ caption, columns, rows, getKey }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-rose">
            {columns.map((col) => (
              <th
                key={col.header}
                scope="col"
                className={`px-5 py-3 text-sm font-semibold first:pl-6 last:pr-6 ${col.align === 'right' ? 'text-right' : ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getKey(row)} className="border-b border-rose last:border-b-0">
              {columns.map((col) => {
                const cls = `px-5 py-3.5 align-middle first:pl-6 last:pr-6 ${col.align === 'right' ? 'text-right' : ''}`
                return col.rowHeader ? (
                  <th key={col.header} scope="row" className={`${cls} font-semibold`}>
                    {col.cell(row)}
                  </th>
                ) : (
                  <td key={col.header} className={cls}>
                    {col.cell(row)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
