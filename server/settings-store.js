import { query } from './db.js';

const DEFAULT_SETTINGS = {
  site_name: 'Mintaly',
  registration_open: '1',
  maintenance: '0',
  forum_open: '1',
  hwid_reset_days: '30',
  redeem_cooldown_minutes: '60',
  terms_text: '',
  refund_text: '',
};

let cache = null;
let cachedAt = 0;
const TTL_MS = 5000;

export async function getSettings(force = false) {
  if (!force && cache && Date.now() - cachedAt < TTL_MS) return cache;

  const settings = { ...DEFAULT_SETTINGS };
  try {
    const rows = await query('SELECT setting_key, setting_value FROM settings');
    for (const row of rows) {
      settings[row.setting_key] = row.setting_value;
    }
  } catch {
    try {
      const rows = await query('SELECT k, v FROM settings');
      for (const row of rows) {
        settings[row.k] = row.v;
      }
    } catch {
      // Use defaults if table is not yet accessible
    }
  }
  cache = settings;
  cachedAt = Date.now();
  return settings;
}

export function invalidateSettingsCache() {
  cache = null;
  cachedAt = 0;
}

export function settingInt(settings, key, fallback) {
  const value = parseInt(settings?.[key], 10);
  return Number.isFinite(value) ? value : fallback;
}

export function settingFlag(settings, key) {
  const value = String(settings?.[key] ?? '').trim();
  return value === '1' || value.toLowerCase() === 'true';
}

/** Blocks write actions while maintenance mode is on (devs are exempt). */
export function assertNotMaintenance(settings, user) {
  if (!settingFlag(settings, 'maintenance')) return;
  if (user && Number(user.dev)) return;
  const error = new Error('Сайт временно на обслуживании');
  error.httpStatus = 503;
  throw error;
}
