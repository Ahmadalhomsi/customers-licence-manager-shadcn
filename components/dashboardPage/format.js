// Month keys are "YYYY-MM" strings as returned by /api/dashboard

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

const numberFormat = new Intl.NumberFormat('tr-TR')

function parseMonth(key) {
  const [year, month] = key.split('-').map(Number)
  return { year, month }
}

export function formatMonth(key) {
  const { year, month } = parseMonth(key)
  return `${MONTH_NAMES[month - 1]} ${year}`
}

export function formatMonthShort(key) {
  return MONTH_SHORT[parseMonth(key).month - 1]
}

export function monthYear(key) {
  return parseMonth(key).year
}

export function isJanuary(key) {
  return parseMonth(key).month === 1
}

export function shiftMonth(key, offset) {
  const { year, month } = parseMonth(key)
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function formatNumber(value) {
  return numberFormat.format(value)
}

export function formatPercent(part, whole) {
  return whole > 0 ? `%${Math.round((part / whole) * 100)}` : '—'
}

// Whole-number axis ticks from 0 to a rounded maximum (steps of 1, 2 or 5 × 10^n)
export function niceTicks(max, count = 4) {
  const safeMax = max > 0 ? max : count
  const rough = safeMax / count
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = Math.max(1, [1, 2, 5, 10].map((s) => s * power).find((s) => s >= rough))
  const top = Math.ceil(safeMax / step) * step
  const ticks = []
  for (let tick = 0; tick <= top; tick += step) ticks.push(tick)
  return ticks
}
