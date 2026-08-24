const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/

export function formatPrice(value: string | null): string {
  if (value === null) {
    return '—'
  }

  const match = DECIMAL_PATTERN.exec(value.trim())
  if (!match) {
    return '—'
  }

  const sign = match[1] ?? ''
  const integer = (match[2] ?? '0').replace(/^0+(?=\d)/, '')
  const fraction = match[3] ?? ''
  const decimalPlaces = integer !== '0' ? 4 : 6
  const rounded = roundFraction(integer, fraction, decimalPlaces)
  const visibleFraction = rounded.fraction.replace(/0+$/, '')
  const visibleSign = rounded.integer === '0' && visibleFraction.length === 0 ? '' : sign

  return `${visibleSign}${rounded.integer}${visibleFraction ? `.${visibleFraction}` : ''}`
}

export function formatBeijingTime(value: string | null): string {
  if (value === null) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`
}

function roundFraction(
  integer: string,
  fraction: string,
  decimalPlaces: number,
): { integer: string; fraction: string } {
  const kept = fraction.slice(0, decimalPlaces).padEnd(decimalPlaces, '0')
  if ((fraction[decimalPlaces] ?? '0') < '5') {
    return { integer, fraction: kept }
  }

  const combined = `${integer}${kept}`
  const incremented = (BigInt(combined || '0') + 1n).toString().padStart(combined.length, '0')
  const integerLength = incremented.length - decimalPlaces
  return {
    integer: incremented.slice(0, integerLength) || '0',
    fraction: decimalPlaces === 0 ? '' : incremented.slice(integerLength),
  }
}
