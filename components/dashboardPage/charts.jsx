"use client"

import { useLayoutEffect, useRef, useState } from 'react'
import { formatMonth, formatMonthShort, formatNumber, formatPercent, isJanuary, monthYear, niceTicks } from './format'

// One color per meaning across the whole dashboard: blue = renewal, orange = still pending, aqua = new
export const SERIES = {
  renewed: { label: 'Yenilenen', color: 'var(--viz-1)' },
  pending: { label: 'Bekleyen', color: 'var(--viz-2)' },
  renewals: { label: 'Yapılan yenileme', color: 'var(--viz-1)' },
  newLicences: { label: 'Yeni lisans', color: 'var(--viz-3)' },
}

const PLOT_HEIGHT = 220
const AXIS_HEIGHT = 40
const TOOLTIP_WIDTH = 200

function useElementWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)

  // Measure before the first paint so the chart never flashes empty, then track resizes
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(element.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}

// Column with rounded data-end and a square baseline
function columnPath(x, y, width, height, radius = 4) {
  if (height <= 0) return ''
  const r = Math.min(radius, height, width / 2)
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`
}

export function Legend({ items }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          {item.shape === 'line' ? (
            <span className="h-0.5 w-3 rounded-full" style={{ background: item.color }} aria-hidden />
          ) : (
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: item.color }} aria-hidden />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function ChartTooltip({ x, containerWidth, title, rows, footer }) {
  const left = x + 12 + TOOLTIP_WIDTH <= containerWidth ? x + 12 : Math.max(0, x - 12 - TOOLTIP_WIDTH)

  return (
    <div
      className="pointer-events-none absolute top-2 z-10 rounded-lg border bg-popover p-3 text-popover-foreground shadow-[0_4px_16px_-4px_rgba(0,0,0,0.18)]"
      style={{ left, width: TOOLTIP_WIDTH }}
    >
      <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-xs">
            {row.color ? (
              <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: row.color }} aria-hidden />
            ) : (
              <span className="w-3 shrink-0" aria-hidden />
            )}
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ml-auto text-sm font-semibold tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">{footer}</div>}
    </div>
  )
}

function YAxis({ ticks, y, left, right }) {
  return ticks.map((tick) => (
    <g key={tick}>
      <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} className="stroke-border" strokeWidth={1} shapeRendering="crispEdges" />
      <text x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
        {formatNumber(tick)}
      </text>
    </g>
  ))
}

function MonthTick({ x, top, row, index, selected, currentMonth }) {
  const secondLine = row.month === currentMonth
    ? 'bu ay'
    : index === 0 || isJanuary(row.month) ? String(monthYear(row.month)) : null

  return (
    <g>
      <text
        x={x}
        y={top + 16}
        textAnchor="middle"
        className={`text-[11px] ${selected ? 'fill-foreground font-semibold' : 'fill-muted-foreground'}`}
      >
        {formatMonthShort(row.month)}
      </text>
      {secondLine && (
        <text x={x} y={top + 30} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {secondLine}
        </text>
      )}
    </g>
  )
}

/**
 * Stacked columns per month: licences due that month, split into already renewed and still pending.
 * Columns are the month picker as well: click or Enter selects the month.
 */
export function RenewalColumnChart({ rows, selectedMonth, currentMonth, onSelect }) {
  const [ref, width] = useElementWidth()
  const [active, setActive] = useState(null)

  const margin = { top: 20, right: 4, left: 36 }
  const innerWidth = Math.max(0, width - margin.left - margin.right)
  const ticks = niceTicks(Math.max(0, ...rows.map((row) => row.expected)))
  const top = ticks[ticks.length - 1]
  const baseline = margin.top + PLOT_HEIGHT
  const y = (value) => baseline - (value / top) * PLOT_HEIGHT
  const band = rows.length ? innerWidth / rows.length : 0
  const barWidth = Math.min(24, band * 0.56)
  const bandX = (index) => margin.left + band * index
  const centerX = (index) => bandX(index) + band / 2

  const activeRow = active !== null ? rows[active] : null

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={baseline + AXIS_HEIGHT} role="group" aria-label="Aylara göre beklenen yenilemeler">
          {rows.map((row, index) => {
            const highlighted = row.month === selectedMonth || index === active
            if (!highlighted) return null
            return (
              <rect
                key={row.month}
                x={bandX(index) + 1}
                y={margin.top - 14}
                width={band - 2}
                height={PLOT_HEIGHT + 14}
                rx={6}
                className="fill-muted"
                opacity={row.month === selectedMonth ? 1 : 0.6}
              />
            )
          })}

          <YAxis ticks={ticks} y={y} left={margin.left} right={width - margin.right} />

          {rows.map((row, index) => {
            const x = centerX(index) - barWidth / 2
            const renewedHeight = baseline - y(row.renewed)
            const gap = row.renewed > 0 && row.pending > 0 ? 2 : 0
            const pendingHeight = Math.max(0, baseline - y(row.pending) - gap)
            const renewedTop = baseline - renewedHeight
            const stackTop = renewedTop - gap - pendingHeight

            return (
              <g key={row.month}>
                {row.pending > 0 ? (
                  <>
                    <rect x={x} y={renewedTop} width={barWidth} height={renewedHeight} fill={SERIES.renewed.color} />
                    <path d={columnPath(x, stackTop, barWidth, pendingHeight)} fill={SERIES.pending.color} />
                  </>
                ) : (
                  <path d={columnPath(x, renewedTop, barWidth, renewedHeight)} fill={SERIES.renewed.color} />
                )}
                {row.month === selectedMonth && row.expected > 0 && (
                  <text x={centerX(index)} y={stackTop - 6} textAnchor="middle" className="fill-foreground text-[11px] font-semibold tabular-nums">
                    {formatNumber(row.expected)}
                  </text>
                )}
              </g>
            )
          })}

          <line x1={margin.left} x2={width - margin.right} y1={baseline} y2={baseline} className="stroke-muted-foreground/40" strokeWidth={1} shapeRendering="crispEdges" />

          {rows.map((row, index) => (
            <MonthTick
              key={row.month}
              x={centerX(index)}
              top={baseline}
              row={row}
              index={index}
              selected={row.month === selectedMonth}
              currentMonth={currentMonth}
            />
          ))}

          {rows.map((row, index) => (
            <rect
              key={row.month}
              x={bandX(index)}
              y={margin.top - 14}
              width={band}
              height={PLOT_HEIGHT + 14 + AXIS_HEIGHT}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-pressed={row.month === selectedMonth}
              aria-label={`${formatMonth(row.month)}: ${row.renewed} yenilenen, ${row.pending} bekleyen`}
              className="cursor-pointer outline-none"
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              onClick={() => onSelect(row.month)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(row.month)
                }
              }}
            />
          ))}
        </svg>
      )}

      {activeRow && (
        <ChartTooltip
          x={centerX(active)}
          containerWidth={width}
          title={formatMonth(activeRow.month)}
          rows={[
            { label: SERIES.renewed.label, value: formatNumber(activeRow.renewed), color: SERIES.renewed.color },
            { label: SERIES.pending.label, value: formatNumber(activeRow.pending), color: SERIES.pending.color },
            { label: 'Bekleyen müşteri', value: formatNumber(activeRow.pendingCustomers) },
          ]}
          footer={`${formatNumber(activeRow.expected)} lisansın ${formatPercent(activeRow.renewed, activeRow.expected)} kadarı yenilendi`}
        />
      )}
    </div>
  )
}

/**
 * Two lines over past months: renewal operations and new licences, with a snapping crosshair.
 */
export function ActivityLineChart({ rows, selectedMonth, currentMonth }) {
  const [ref, width] = useElementWidth()
  const [active, setActive] = useState(null)

  const series = [
    { key: 'renewals', ...SERIES.renewals },
    { key: 'newLicences', ...SERIES.newLicences },
  ]
  const margin = { top: 20, right: 40, left: 36 }
  const innerWidth = Math.max(0, width - margin.left - margin.right)
  const ticks = niceTicks(Math.max(0, ...rows.flatMap((row) => series.map((s) => row[s.key]))))
  const top = ticks[ticks.length - 1]
  const baseline = margin.top + PLOT_HEIGHT
  const y = (value) => baseline - (value / top) * PLOT_HEIGHT
  const x = (index) => rows.length === 1 ? margin.left + innerWidth / 2 : margin.left + (innerWidth * index) / (rows.length - 1)

  const last = rows.length - 1
  const endYs = series.map((s) => y(rows[last]?.[s.key] ?? 0))
  // End labels only when they cannot collide; otherwise the legend and tooltip carry the values
  const showEndLabels = rows.length > 0 && Math.abs(endYs[0] - endYs[1]) >= 14

  const nearestIndex = (clientX, element) => {
    const bounds = element.getBoundingClientRect()
    const pointer = clientX - bounds.left
    let nearest = 0
    rows.forEach((_, index) => {
      if (Math.abs(x(index) - pointer) < Math.abs(x(nearest) - pointer)) nearest = index
    })
    return nearest
  }

  const activeRow = active !== null ? rows[active] : null

  return (
    <div ref={ref} className="relative">
      {width > 0 && rows.length > 0 && (
        <svg
          width={width}
          height={baseline + AXIS_HEIGHT}
          tabIndex={0}
          role="img"
          aria-label="Aylara göre yapılan yenileme ve yeni lisans sayıları; ok tuşlarıyla aylar arasında gezinin"
          className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-md"
          onPointerMove={(event) => setActive(nearestIndex(event.clientX, event.currentTarget))}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(last)}
          onBlur={() => setActive(null)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') setActive((index) => Math.max(0, (index ?? last) - 1))
            if (event.key === 'ArrowRight') setActive((index) => Math.min(last, (index ?? last) + 1))
          }}
        >
          <YAxis ticks={ticks} y={y} left={margin.left} right={width - margin.right + 8} />
          <line x1={margin.left} x2={width - margin.right + 8} y1={baseline} y2={baseline} className="stroke-muted-foreground/40" strokeWidth={1} shapeRendering="crispEdges" />

          {activeRow && (
            <line x1={x(active)} x2={x(active)} y1={margin.top - 8} y2={baseline} className="stroke-muted-foreground/60" strokeWidth={1} shapeRendering="crispEdges" />
          )}

          {series.map((s) => (
            <path
              key={s.key}
              d={rows.map((row, index) => `${index ? 'L' : 'M'}${x(index)},${y(row[s.key])}`).join('')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {series.map((s, seriesIndex) => {
            const index = active ?? last
            return (
              <circle
                key={s.key}
                cx={x(index)}
                cy={active !== null ? y(rows[index][s.key]) : endYs[seriesIndex]}
                r={4}
                fill={s.color}
                className="stroke-card"
                strokeWidth={2}
              />
            )
          })}

          {showEndLabels && active === null && series.map((s, seriesIndex) => (
            <text key={s.key} x={x(last) + 8} y={endYs[seriesIndex]} dy="0.32em" className="fill-foreground text-[11px] font-semibold tabular-nums">
              {formatNumber(rows[last][s.key])}
            </text>
          ))}

          {rows.map((row, index) => (
            <MonthTick
              key={row.month}
              x={x(index)}
              top={baseline}
              row={row}
              index={index}
              selected={row.month === selectedMonth}
              currentMonth={currentMonth}
            />
          ))}
        </svg>
      )}

      {activeRow && (
        <ChartTooltip
          x={x(active)}
          containerWidth={width}
          title={formatMonth(activeRow.month)}
          rows={series.map((s) => ({ label: s.label, value: formatNumber(activeRow[s.key]), color: s.color }))}
          footer={`Ayrıca ${formatNumber(activeRow.newTrials)} otomatik deneme lisansı açıldı (grafikte yok)`}
        />
      )}
    </div>
  )
}
