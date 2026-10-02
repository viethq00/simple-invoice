const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MINUS = '−'; // U+2212, a real minus sign rather than a hyphen

const amountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(amount: number, currencySymbol: string): string {
  const sign = amount < 0 ? MINUS : '';
  return `${sign}${currencySymbol}${amountFormatter.format(Math.abs(amount))}`;
}

export function formatDeduction(amount: number, currencySymbol: string): string {
  if (amount === 0) return formatMoney(0, currencySymbol);
  return `${MINUS}${formatMoney(Math.abs(amount), currencySymbol)}`;
}

export function formatPercent(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parseIsoDate(value: string): DateParts | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isRealDate ? { year, month, day } : null;
}

export function isIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}

// Built from the date parts, so the viewer's time zone can't shift the day.
export function formatDate(value: string): string {
  const parts = parseIsoDate(value);
  if (!parts) return value;
  return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`;
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function todayIsoDate(now: Date = new Date()): string {
  return toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDaysToIsoDate(value: string, days: number): string {
  const parts = parseIsoDate(value);
  if (!parts) throw new RangeError(`Invalid ISO date: ${value}`);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}
