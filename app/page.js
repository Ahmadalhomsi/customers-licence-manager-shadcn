"use client"

import { useState, useEffect } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ActivityLineChart, Legend, RenewalColumnChart, SERIES } from '@/components/dashboardPage/charts'
import { KpiStrip } from '@/components/dashboardPage/KpiStrip'
import { CategoryBreakdown } from '@/components/dashboardPage/CategoryBreakdown'
import { formatMonth, formatNumber, formatPercent, shiftMonth } from '@/components/dashboardPage/format'

function Panel({ title, description, actions, children, className = '' }) {
  return (
    <section className={`flex flex-col gap-4 rounded-xl border bg-card p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold leading-none">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

function ViewToggle({ view, onChange }) {
  return (
    <div className="inline-flex rounded-md border p-0.5 text-xs" role="group" aria-label="Görünüm">
      {[['chart', 'Grafik'], ['table', 'Tablo']].map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={`rounded-[5px] px-2.5 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function MonthTable({ rows, columns, selectedMonth }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ay</TableHead>
          {columns.map((column) => (
            <TableHead key={column.label} className="text-right">{column.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.month} data-state={row.month === selectedMonth ? 'selected' : undefined}>
            <TableCell className="font-medium">{formatMonth(row.month)}</TableCell>
            {columns.map((column) => (
              <TableCell key={column.label} className="text-right tabular-nums">{column.value(row)}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Yükleniyor">
      <Skeleton className="h-[132px] rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-[372px] rounded-xl lg:col-span-3" />
        <Skeleton className="h-[372px] rounded-xl lg:col-span-2" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}

export default function DashboardPage() {
  // Empty string lets the API pick the current month
  const [requestedMonth, setRequestedMonth] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [renewalView, setRenewalView] = useState('chart')
  const [activityView, setActivityView] = useState('chart')

  useEffect(() => {
    let cancelled = false

    const fetchDashboard = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = requestedMonth ? `?month=${requestedMonth}` : ''
        const response = await axios.get(`/api/dashboard${params}`)
        if (!cancelled) setData(response.data)
      } catch (err) {
        console.error('Error fetching dashboard:', err)
        if (!cancelled) setError(err.response?.data?.error || 'Veriler yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchDashboard()
    return () => {
      cancelled = true
    }
  }, [requestedMonth, reloadKey])

  const trend = data?.trend ?? []
  const selectedIndex = trend.findIndex((row) => row.month === data?.month)
  const pastRows = trend.filter((row) => row.month <= data?.currentMonth)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Genel Bakış</h1>
          <p className="text-sm text-muted-foreground">Lisans yenilemeleri ve yeni lisanslar, aylık</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex h-9 items-center rounded-md border bg-card shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-full rounded-r-none"
              disabled={!data}
              onClick={() => setRequestedMonth(shiftMonth(data.month, -1))}
              aria-label="Önceki ay"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[8.5rem] px-2 text-center text-sm font-medium" aria-live="polite">
              {data ? formatMonth(data.month) : '…'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-full rounded-l-none"
              disabled={!data}
              onClick={() => setRequestedMonth(shiftMonth(data.month, 1))}
              aria-label="Sonraki ay"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            className="h-9"
            disabled={!data || data.month === data.currentMonth}
            onClick={() => setRequestedMonth(data.currentMonth)}
          >
            Bu ay
          </Button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 px-4 py-3 text-sm">
          <span className="text-destructive">{error}</span>
          <Button variant="outline" size="sm" onClick={() => setReloadKey((key) => key + 1)}>Tekrar dene</Button>
        </div>
      )}

      {!data && loading && <DashboardSkeleton />}

      {data && (
        // Refetches keep the previous render at reduced opacity instead of flashing a skeleton
        <div className={`flex flex-col gap-6 transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`}>
          <KpiStrip
            summary={data.summary}
            previous={trend[selectedIndex - 1]}
            isPast={data.month < data.currentMonth}
            isFuture={data.month > data.currentMonth}
          />

          <div className="grid gap-6 lg:grid-cols-5">
            <Panel
              className="lg:col-span-3"
              title="Beklenen yenilemeler"
              description="Bitiş tarihi o aya düşen lisanslar. Bir aya tıklayarak seçin."
              actions={<ViewToggle view={renewalView} onChange={setRenewalView} />}
            >
              {renewalView === 'chart' ? (
                <>
                  <Legend items={[SERIES.renewed, SERIES.pending]} />
                  <RenewalColumnChart
                    rows={trend}
                    selectedMonth={data.month}
                    currentMonth={data.currentMonth}
                    onSelect={setRequestedMonth}
                  />
                </>
              ) : (
                <MonthTable
                  rows={trend}
                  selectedMonth={data.month}
                  columns={[
                    { label: 'Beklenen', value: (row) => formatNumber(row.expected) },
                    { label: 'Yenilenen', value: (row) => formatNumber(row.renewed) },
                    { label: 'Bekleyen', value: (row) => formatNumber(row.pending) },
                    { label: 'Bekleyen müşteri', value: (row) => formatNumber(row.pendingCustomers) },
                    { label: 'Oran', value: (row) => formatPercent(row.renewed, row.expected) },
                  ]}
                />
              )}
            </Panel>

            <Panel
              className="lg:col-span-2"
              title="Yenileme ve yeni lisans"
              description="Ay içinde yapılan işlemler"
              actions={<ViewToggle view={activityView} onChange={setActivityView} />}
            >
              {pastRows.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Seçilen dönem henüz başlamadı. Geçmiş ayları görmek için bu aya dönün.
                </p>
              ) : activityView === 'chart' ? (
                <>
                  <Legend items={[{ ...SERIES.renewals, shape: 'line' }, { ...SERIES.newLicences, shape: 'line' }]} />
                  <ActivityLineChart rows={pastRows} selectedMonth={data.month} currentMonth={data.currentMonth} />
                </>
              ) : (
                <MonthTable
                  rows={pastRows}
                  selectedMonth={data.month}
                  columns={[
                    { label: 'Yenileme', value: (row) => formatNumber(row.renewals) },
                    { label: 'Yeni lisans', value: (row) => formatNumber(row.newLicences) },
                    { label: 'Deneme', value: (row) => formatNumber(row.newTrials) },
                  ]}
                />
              )}
            </Panel>
          </div>

          <Panel
            title={`Ürün bazında · ${formatMonth(data.month)}`}
            description="Her üründe bu ay biten lisanslar, yapılan yenilemeler ve yeni lisanslar"
            actions={<Legend items={[SERIES.renewed, SERIES.pending]} />}
          >
            <CategoryBreakdown categories={data.categories} />
          </Panel>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Müşteriler telefon numarasına göre eşleştirilir. Deneme, sınırsız ve arşivlenmiş lisanslar beklenen yenilemelere dahil değildir.
            Geçmiş aylarda &quot;bekleyen&quot;, süresi dolup yenilenmeyen lisans demektir.
          </p>
        </div>
      )}
    </div>
  )
}
