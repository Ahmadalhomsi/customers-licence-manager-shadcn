import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { formatNumber, formatPercent } from './format'

function Delta({ current, previous }) {
  if (previous === undefined) return null

  const diff = current - previous
  if (diff === 0) return <span className="text-muted-foreground">Geçen ayla aynı</span>

  const up = diff > 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-flex items-center font-medium ${up ? 'text-[#006300] dark:text-[#0ca30c]' : 'text-[#d03b3b] dark:text-red-400'}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {up ? '+' : '−'}{formatNumber(Math.abs(diff))}
      </span>
      <span className="text-muted-foreground">geçen aya göre</span>
    </span>
  )
}

function Metric({ label, value, children }) {
  return (
    <div className="flex flex-col gap-1 bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
      <div className="flex min-h-5 flex-col gap-2 text-xs">{children}</div>
    </div>
  )
}

/**
 * Headline figures for the selected month. "summary" and "previous" are trend rows from /api/dashboard.
 */
export function KpiStrip({ summary, previous, isPast, isFuture }) {
  const renewedShare = summary.expected > 0 ? (summary.renewed / summary.expected) * 100 : 0

  return (
    <section
      aria-label="Ay özeti"
      className="grid overflow-hidden rounded-xl border bg-border gap-px sm:grid-cols-2 lg:grid-cols-4"
    >
      <Metric label={isPast ? 'Yenilenmeyen lisans' : 'Yenileme bekleyen lisans'} value={formatNumber(summary.pending)}>
        <span className="text-muted-foreground">
          {formatNumber(summary.pendingDevices)} cihaz · {formatNumber(summary.pendingCustomers)} müşteri
        </span>
        <span className="text-muted-foreground">{isPast ? 'Süresi doldu, yenilenmedi' : 'Bu ay süresi doluyor'}</span>
      </Metric>

      <Metric label="Yenilenme oranı" value={formatPercent(summary.renewed, summary.expected)}>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: 'color-mix(in srgb, var(--viz-1) 18%, transparent)' }}
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(renewedShare)}
          aria-label="Yenilenme oranı"
        >
          <div className="h-full rounded-full" style={{ width: `${renewedShare}%`, background: 'var(--viz-1)' }} />
        </div>
        <span className="text-muted-foreground">
          Bu ay biten {formatNumber(summary.expected)} lisanstan {formatNumber(summary.renewed)} tanesi yenilendi
        </span>
      </Metric>

      <Metric label="Yapılan yenileme" value={isFuture ? '—' : formatNumber(summary.renewals)}>
        {isFuture ? (
          <span className="text-muted-foreground">Bu ay henüz gelmedi</span>
        ) : (
          <>
            <Delta current={summary.renewals} previous={previous?.renewals} />
            <span className="text-muted-foreground">{formatNumber(summary.renewalDevices)} cihaz yenilendi</span>
          </>
        )}
      </Metric>

      <Metric label="Yeni lisans" value={isFuture ? '—' : formatNumber(summary.newLicences)}>
        {isFuture ? (
          <span className="text-muted-foreground">Bu ay henüz gelmedi</span>
        ) : (
          <>
            <Delta current={summary.newLicences} previous={previous?.newLicences} />
            <span className="text-muted-foreground">
              {formatNumber(summary.newDevices)} yeni cihaz · ayrıca {formatNumber(summary.newTrials)} otomatik deneme
            </span>
          </>
        )}
      </Metric>
    </section>
  )
}
