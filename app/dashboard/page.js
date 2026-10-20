"use client"

import { useState, useEffect } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronLeft, ChevronRight, Clock, RefreshCw, CheckCircle2, Sparkles } from 'lucide-react'

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

function formatMonth(key) {
  const [year, month] = key.split('-').map(Number)
  return `${MONTH_NAMES[month - 1]} ${year}`
}

function shiftMonth(key, offset) {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function StatCard({ title, value, description, icon: Icon }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  // Empty string lets the API pick the current month
  const [requestedMonth, setRequestedMonth] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
        if (!cancelled) setError(err.response?.data?.error || 'Dashboard verileri yüklenemedi')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchDashboard()
    return () => {
      cancelled = true
    }
  }, [requestedMonth])

  const summary = data?.summary
  const renewedPercent = summary?.expected ? Math.round((summary.renewed / summary.expected) * 100) : 0
  const categoryTotals = (data?.categories || []).reduce((totals, row) => ({
    expected: totals.expected + row.expected,
    pending: totals.pending + row.pending,
    renewed: totals.renewed + row.renewed,
    renewals: totals.renewals + row.renewals,
    newLicences: totals.newLicences + row.newLicences,
  }), { expected: 0, pending: 0, renewed: 0, renewals: 0, newLicences: 0 })

  // Renewals and new licences cannot have happened yet in future months
  const isFuture = (key) => data && key > data.currentMonth

  return (
    <div className="w-full min-h-full pt-6 pb-6 px-4 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={!data}
            onClick={() => setRequestedMonth(shiftMonth(data.month, -1))}
            aria-label="Önceki ay"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center font-medium">{data ? formatMonth(data.month) : '…'}</span>
          <Button
            variant="outline"
            size="icon"
            disabled={!data}
            onClick={() => setRequestedMonth(shiftMonth(data.month, 1))}
            aria-label="Sonraki ay"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            disabled={!data || data.month === data.currentMonth}
            onClick={() => setRequestedMonth(data.currentMonth)}
          >
            Bu Ay
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 p-4 text-sm text-destructive">{error}</div>
      )}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : summary && (
        <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Yenileme Bekleyen"
              value={summary.pending}
              description={`${summary.pendingCustomers} müşteri · bu ay biten, henüz yenilenmemiş`}
              icon={Clock}
            />
            <StatCard
              title="Yenilenen"
              value={`${summary.renewed} / ${summary.expected}`}
              description={`Bu ay bitecek lisansların %${renewedPercent}'i yenilendi`}
              icon={CheckCircle2}
            />
            <StatCard
              title="Aylık Yenileme"
              value={summary.renewals}
              description="Bu ay yapılan yenileme işlemi"
              icon={RefreshCw}
            />
            <StatCard
              title="Yeni Lisans"
              value={summary.newLicences}
              description={`Bu ay açılan lisans · ayrıca ${summary.newTrials} deneme`}
              icon={Sparkles}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kategoriye Göre · {formatMonth(data.month)}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bu ay için kayıt yok.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-right">Beklenen Yenileme</TableHead>
                      <TableHead className="text-right">Bekleyen</TableHead>
                      <TableHead className="text-right">Yenilenen</TableHead>
                      <TableHead className="text-right">Yapılan Yenileme</TableHead>
                      <TableHead className="text-right">Yeni Lisans</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.categories.map((row) => (
                      <TableRow key={row.category}>
                        <TableCell className="font-medium">{row.category}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.expected}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.pending}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.renewed}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.renewals}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.newLicences}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell>Toplam</TableCell>
                      <TableCell className="text-right tabular-nums">{categoryTotals.expected}</TableCell>
                      <TableCell className="text-right tabular-nums">{categoryTotals.pending}</TableCell>
                      <TableCell className="text-right tabular-nums">{categoryTotals.renewed}</TableCell>
                      <TableCell className="text-right tabular-nums">{categoryTotals.renewals}</TableCell>
                      <TableCell className="text-right tabular-nums">{categoryTotals.newLicences}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aylık Görünüm</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ay</TableHead>
                    <TableHead className="text-right">Beklenen Yenileme</TableHead>
                    <TableHead className="text-right">Bekleyen</TableHead>
                    <TableHead className="text-right">Bekleyen Müşteri</TableHead>
                    <TableHead className="text-right">Yenilenen</TableHead>
                    <TableHead className="text-right">Yapılan Yenileme</TableHead>
                    <TableHead className="text-right">Yeni Lisans</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.trend.map((row) => (
                    <TableRow
                      key={row.month}
                      onClick={() => setRequestedMonth(row.month)}
                      data-state={row.month === data.month ? 'selected' : undefined}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium">
                        {formatMonth(row.month)}
                        {row.month === data.currentMonth && (
                          <span className="ml-2 text-xs text-muted-foreground">(bu ay)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.expected}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.pending}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.pendingCustomers}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.renewed}</TableCell>
                      <TableCell className="text-right tabular-nums">{isFuture(row.month) ? '–' : row.renewals}</TableCell>
                      <TableCell className="text-right tabular-nums">{isFuture(row.month) ? '–' : row.newLicences}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-4 text-xs text-muted-foreground">
                Geçmiş aylarda &quot;Bekleyen&quot;, bitiş tarihi o ayda olup hiç yenilenmemiş lisanslardır.
                Müşteriler telefon numarasına göre eşleştirilir. Deneme, sınırsız ve arşivlenmiş lisanslar beklenen yenilemeye dahil değildir.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
