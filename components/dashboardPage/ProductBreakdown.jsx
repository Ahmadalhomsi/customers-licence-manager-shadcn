import { SERIES } from './charts'
import { formatNumber } from './format'

const COLUMNS = 'sm:grid-cols-[minmax(11rem,1.2fr)_minmax(8rem,2fr)_repeat(4,minmax(5rem,auto))]'

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

// Licence count with the device count underneath
function Num({ value, devices, strong }) {
  return (
    <span className="flex flex-col items-end">
      <span className={`text-sm tabular-nums ${strong ? 'font-semibold' : ''}`}>{formatNumber(value)}</span>
      {devices !== undefined && (
        <span className="text-xs tabular-nums text-muted-foreground">{formatNumber(devices)} cihaz</span>
      )}
    </span>
  )
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + row[field], 0)
}

export function ProductBreakdown({ products }) {
  if (products.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Bu ay biten, yenilenen ya da yeni açılan lisans yok.
      </p>
    )
  }

  const max = Math.max(1, ...products.map((row) => row.expected))

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

      {products.map((row) => (
        <div
          key={row.key}
          role="row"
          className={`grid min-w-0 grid-cols-1 items-center gap-x-6 gap-y-1.5 border-b py-3 last:border-b-0 ${COLUMNS}`}
        >
          <span role="cell" className="flex min-w-0 flex-col">
            <span className="truncate font-medium" title={row.product}>{row.product}</span>
            <span className="text-xs text-muted-foreground">
              {row.grouped ? 'Müşteri başına 1 lisans' : 'Cihaz başına 1 lisans'}
            </span>
          </span>
          <span role="cell">
            <ExpectedBar row={row} max={max} />
          </span>
          {/* Mobile: one compact line instead of four columns */}
          <span role="cell" className="text-xs text-muted-foreground sm:hidden">
            {row.grouped
              ? `${formatNumber(row.pending)} bekleyen (${formatNumber(row.pendingDevices)} cihaz) · ${formatNumber(row.renewals)} yenileme · ${formatNumber(row.newLicences)} yeni lisans (${formatNumber(row.newDevices)} cihaz)`
              : `${formatNumber(row.pending)} bekleyen · ${formatNumber(row.renewals)} yenileme · ${formatNumber(row.newLicences)} yeni lisans`}
          </span>
          {/* Device counts only add information where one licence can cover several devices */}
          <span role="cell" className="hidden sm:contents"><Num value={row.expected} strong /></span>
          <span role="cell" className="hidden sm:contents"><Num value={row.pending} devices={row.grouped ? row.pendingDevices : undefined} /></span>
          <span role="cell" className="hidden sm:contents"><Num value={row.renewals} devices={row.grouped ? row.renewalDevices : undefined} /></span>
          <span role="cell" className="hidden sm:contents"><Num value={row.newLicences} devices={row.grouped ? row.newDevices : undefined} /></span>
        </div>
      ))}

      <div role="row" className={`hidden items-start gap-x-6 border-t pt-3 sm:grid ${COLUMNS}`}>
        <span role="cell" className="font-medium">Toplam</span>
        <span role="cell" />
        <Num value={sum(products, 'expected')} strong />
        <Num value={sum(products, 'pending')} devices={sum(products, 'pendingDevices')} strong />
        <Num value={sum(products, 'renewals')} devices={sum(products, 'renewalDevices')} strong />
        <Num value={sum(products, 'newLicences')} devices={sum(products, 'newDevices')} strong />
      </div>
    </div>
  )
}
