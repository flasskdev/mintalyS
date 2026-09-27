import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getPlural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

const MONTHS_SHORT = [
  'янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.',
  'июл.', 'авг.', 'сен.', 'окт.', 'нояб.', 'дек.'
];

function padZero(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * MySQL DATETIME strings ("2026-09-25 12:00:00") are stored in UTC, so they
 * have to be marked as UTC before parsing. ISO strings are left untouched.
 */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (raw.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const isoLike = raw.replace(' ', 'T');
  const asUtc = new Date(`${isoLike}Z`);
  const asLocal = new Date(isoLike);

  if (Number.isNaN(asUtc.getTime())) {
    return Number.isNaN(asLocal.getTime()) ? null : asLocal;
  }

  const now = Date.now();
  const diffUtc = now - asUtc.getTime();
  const diffLocal = now - asLocal.getTime();

  // If treating as UTC puts the date in the future (> 2 minutes) while local time is in the past
  if (diffUtc < -120000 && Math.abs(diffLocal) < Math.abs(diffUtc)) {
    return asLocal;
  }

  return asUtc;
}

export function formatDate(dateString: string): string {
  const date = parseDate(dateString);
  if (!date) return '—';
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(dateString: string): string {
  const date = parseDate(dateString);
  if (!date) return '—';
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatCommentTime(dateString: string | Date | null | undefined): string {
  const date = dateString instanceof Date ? dateString : parseDate(dateString);
  if (!date) return '—';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  // If less than 60 seconds (or slight clock drift between client and server)
  if (diffSecs < 60) {
    return 'только что';
  }

  const diffMins = Math.floor(diffSecs / 60);

  // Less than 60 minutes: "5 мин. назад"
  if (diffMins < 60) {
    return `${diffMins} мин. назад`;
  }

  // Same calendar day: "2 часа назад", "5 часов назад"
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    const diffHours = Math.floor(diffMins / 60);
    const hourWord = getPlural(diffHours, 'час', 'часа', 'часов');
    return `${diffHours} ${hourWord} назад`;
  }

  const timeStr = `${padZero(date.getHours())}:${padZero(date.getMinutes())}`;

  // Check yesterday: "вчера в 10:01"
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `вчера в ${timeStr}`;
  }

  // Check day before yesterday: "позавчера в 10:01"
  const dayBeforeYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
  const isDayBeforeYesterday =
    date.getDate() === dayBeforeYesterday.getDate() &&
    date.getMonth() === dayBeforeYesterday.getMonth() &&
    date.getFullYear() === dayBeforeYesterday.getFullYear();

  if (isDayBeforeYesterday) {
    return `позавчера в ${timeStr}`;
  }

  const monthName = MONTHS_SHORT[date.getMonth()];

  // Same calendar year: "20 сен. в 10:01"
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getDate()} ${monthName} в ${timeStr}`;
  }

  // Different calendar year: "20 сен. 2025"
  return `${date.getDate()} ${monthName} ${date.getFullYear()}`;
}

export function timeAgo(dateString: string | Date | null | undefined): string {
  return formatCommentTime(dateString);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length).trim() + '...';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / Math.pow(1024, i);
  return `${i === 0 ? Math.round(amount) : amount.toFixed(2)} ${units[i]}`;
}

export function generateHWID(): string {
  // Simple HWID generation for demo - in production this should be more robust
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Mintaly HWID', 2, 2);
  }
  const fingerprint = canvas.toDataURL() + navigator.userAgent + screen.width + screen.height;
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0').toUpperCase();
}