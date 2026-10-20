import { SERIES } from './charts'
import { formatNumber } from './format'

const COLUMNS = 'sm:grid-cols-[minmax(10rem,1.2fr)_minmax(8rem,2fr)_repeat(4,minmax(4.5rem,auto))]'

// Horizontal stacked bar: renewed then pending, 2px gap between them, rounded only at the data end
function ExpectedBar({ row, max }) {
  if (row.expected === 0) return <div className="h-3" aria-hidden />

  const segments = [
    { key: 'renewed', value: row.renewed },
    { key: 'pending', value: row.pending },
  ].filter((segment) => segment.value > 0)

  return (
    <div className="flex h-3 gap-[2px]" style={{ width: `${(row.expected / max) * 100}%` }} aria-hidden>
      {segments.map((segment, index) => (
        <div
          key={segment.key}
          className={index === segments.length - 1 ? 'rounded-r-[4px]' : ''}
          style={{ flexGrow: segment.value, flexBasis: 0, minWidth: 2, background: SERIES[segment.key].color }}
        />
      ))}
    </div>
  )
}

function Num({ value, strong }) {
  return (
    <span className={`text-right text-sm tabular-nums ${strong ? 'font-semibold' : 'text-muted-foreground'}`}>
      {formatNumber(value)}
    </span>
  )
}

export function CategoryBreakdown({ categories }) {
  if (categories.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Bu ay biten, yenilenen ya da yeni açılan lisans yok.
      </p>
    )
  }

  const max = Math.max(1, ...categories.map((row) => row.expected))
  const totals = categories.reduce((sum, row) => ({
    expected: sum.expected + row.expected,
    pending: sum.pending + row.pending,
    renewals: sum.renewals + row.renewals,
    newLicences: sum.newLicences + row.newLicences,
  }), { expected: 0, pending: 0, renewals: 0, newLicences: 0 })

  return (
    <div role="table" aria-label="Ürün bazında lisanslar" className="text-sm">
      <div role="row" className={`hidden gap-x-6 border-b pb-2 text-xs font-medium text-muted-foreground sm:grid ${COLUMNS}`}>
        <span role="columnheader">Ürün</span>
        <span role="columnheader">Yenilenen / bekleyen</span>
        <span role="columnheader" className="text-right">Beklenen</span>
        <span role="columnheader" className="text-right">Bekleyen</span>
        <span role="columnheader" className="text-right">Yapılan yenileme</span>
        <span role="columnheader" className="text-right">Yeni lisans</span>
      </div>

      {categories.map((row) => (
        <div
          key={row.category}
          role="row"
          className={`grid min-w-0 grid-cols-1 items-center gap-x-6 gap-y-1.5 border-b py-3 last:border-b-0 sm:py-2.5 ${COLUMNS}`}
        >
          <span role="cell" className="truncate font-medium" title={row.category}>{row.category}</span>
          <span role="cell">
            <ExpectedBar row={row} max={max} />
          </span>
          {/* Mobile: one compact line instead of four columns */}
          <span role="cell" className="text-xs text-muted-foreground sm:hidden">
            {formatNumber(row.pending)} bekleyen · {formatNumber(row.renewals)} yenileme · {formatNumber(row.newLicences)} yeni
          </span>
          <span role="cell" className="hidden sm:contents"><Num value={row.expected} strong /></span>
          <span role="cell" className="hidden sm:contents"><Num value={row.pending} /></span>
          <span role="cell" className="hidden sm:contents"><Num value={row.renewals} /></span>
          <span role="cell" className="hidden sm:contents"><Num value={row.newLicences} /></span>
        </div>
      ))}

      <div role="row" className={`hidden gap-x-6 border-t pt-3 sm:grid ${COLUMNS}`}>
        <span role="cell" className="font-medium">Toplam</span>
        <span role="cell" />
        <Num value={totals.expected} strong />
        <Num value={totals.pending} strong />
        <Num value={totals.renewals} strong />
        <Num value={totals.newLicences} strong />
      </div>
    </div>
  )
}
