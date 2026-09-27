import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export function ok(data = undefined, message = 'OK', extra = {}) {
  return { httpStatus: 200, body: { success: true, status: 'success', message, ...extra, ...(data !== undefined ? { data } : {}) } };
}

export function fail(message, httpStatus = 200) {
  return { httpStatus, body: { success: false, status: 'error', message } };
}

// Thrown by action handlers to produce a business error (HTTP 200 + success:false)
export class ApiError extends Error {
  constructor(message, httpStatus = 200) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

// ---------------------------------------------------------------------------
// Crypto
// ---------------------------------------------------------------------------

// bcrypt is used for passwords. $2y$ format with 10 rounds matches PHP password_hash
// and is 100% compatible with existing MySQL users and WindowsProject1.
const BCRYPT_ROUNDS = 10;
const PBKDF2_DIGEST = 'sha512';

export function hashPassword(password) {
  const hash = bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
  return hash.replace(/^\$2[ab]\$/, '$2y$');
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;

  // Support bcrypt hashes from existing databases ($2y$, $2a$, $2b$)
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    try {
      const normalized = stored.startsWith('$2y$') ? '$2a$' + stored.slice(4) : stored;
      if (bcrypt.compareSync(password, normalized)) return true;
      if (bcrypt.compareSync(password, stored)) return true;
      return false;
    } catch {
      return false;
    }
  }

  // Plaintext match fallback
  if (stored === password) return true;

  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const iterations = parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations < 1) return false;

  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[2], 'base64');
    expected = Buffer.from(parts[3], 'base64');
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  const actual = crypto.pbkdf2Sync(password, salt, iterations, expected.length, PBKDF2_DIGEST);
  return crypto.timingSafeEqual(actual, expected);
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function numericCode(digits = 6) {
  const max = 10 ** digits;
  const value = crypto.randomInt(0, max);
  return String(value).padStart(digits, '0');
}

export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[\p{L}\p{N}_.\- ]{4,32}$/u;
const HWID_RE = /^[A-Za-z0-9_\-:]{8,128}$/;
const KEY_RE = /^[A-Za-z0-9]{64}$/;

export const validators = {
  email(value) {
    const email = String(value ?? '').trim().toLowerCase();
    if (!email) throw new ApiError('Укажите email');
    if (email.length > 190 || !EMAIL_RE.test(email)) throw new ApiError('Некорректный email');
    return email;
  },

  password(value) {
    const password = String(value ?? '');
    if (password.length < 6) throw new ApiError('Пароль должен быть не менее 6 символов');
    if (password.length > 200) throw new ApiError('Пароль слишком длинный');
    return password;
  },

  name(value) {
    const name = String(value ?? '').trim().replace(/\s+/g, ' ');
    if (name.length < 4 || name.length > 32) throw new ApiError('Никнейм должен быть от 4 до 32 символов');
    if (!NAME_RE.test(name)) throw new ApiError('Никнейм может содержать буквы, цифры, пробел, _ . -');
    return name;
  },

  hwid(value) {
    if (value === undefined || value === null || value === '') return null;
    const hwid = String(value).trim();
    if (!HWID_RE.test(hwid)) return null;
    return hwid;
  },

  keyCode(value) {
    const key = String(value ?? '').trim();
    if (key.length !== 64) throw new ApiError('Ключ должен содержать ровно 64 символа');
    if (!KEY_RE.test(key)) throw new ApiError('Ключ содержит недопустимые символы');
    return key;
  },

  code(value) {
    const code = String(value ?? '').trim();
    if (!/^\d{6}$/.test(code)) throw new ApiError('Введите 6-значный код');
    return code;
  },

  text(value, { field = 'Текст', min = 1, max = 5000 } = {}) {
    const text = String(value ?? '').trim();
    if (text.length < min) throw new ApiError(`${field}: минимум ${min} символов`);
    if (text.length > max) throw new ApiError(`${field}: максимум ${max} символов`);
    return text;
  },

  id(value, { field = 'ID', min = 1 } = {}) {
    const id = parseInt(value, 10);
    if (!Number.isInteger(id) || id < min) throw new ApiError(`Некорректный ${field}`);
    return id;
  },

  int(value, { field = 'Значение', min = 0, max = 1000000 } = {}) {
    const parsed = parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new ApiError(`${field}: допустимо от ${min} до ${max}`);
    }
    return parsed;
  },

  page(value, fallback = 1) {
    const page = parseInt(value, 10);
    return Number.isInteger(page) && page > 0 ? page : fallback;
  },

  perPage(value, fallback = 20, max = 100) {
    const perPage = parseInt(value, 10);
    if (!Number.isInteger(perPage) || perPage < 1) return fallback;
    return Math.min(perPage, max);
  },

  bool(value) {
    return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
  },

  enumValue(value, allowed, fallback) {
    const v = String(value ?? '');
    return allowed.includes(v) ? v : fallback;
  },
};

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim().slice(0, 45);
  }
  return String(req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '').slice(0, 45);
}

export function userAgent(req) {
  return String(req.headers['user-agent'] || '').slice(0, 255);
}

export function bearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

export function subToTimestamp(subTo) {
  if (!subTo) return 0;
  const value = subTo instanceof Date ? subTo.getTime() : new Date(`${String(subTo).replace(' ', 'T')}Z`).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function hasActiveSub(user, now = Date.now()) {
  return subToTimestamp(user?.sub_to) > now;
}

export function subDaysLeft(user, now = Date.now()) {
  const until = subToTimestamp(user?.sub_to);
  if (until <= now) return 0;
  return Math.ceil((until - now) / 86400000);
}

/** Serialises a user row for the client (adds computed sub fields). */
export function publicUser(row) {
  if (!row) return null;
  const now = Date.now();
  const active = hasActiveSub(row, now);
  return {
    ...row,
    banned: Number(row.banned) ? 1 : 0,
    dev: Number(row.dev) ? 1 : 0,
    seller: Number(row.seller) ? 1 : 0,
    forum_banned: Number(row.forum_banned) ? 1 : 0,
    email_verified: Number(row.email_verified) ? 1 : 0,
    token: undefined,
    sub_active: active,
    sub_days_left: subDaysLeft(row, now),
  };
}

/** Computes the price of a plan, honouring an active discount. */
export function priceOf(sub) {
  const cost = Number(sub.cost ?? 0);
  const discount = Number(sub.discount ?? 0);
  const discountActive = discount > 0 && (!sub.discount_to || new Date(`${String(sub.discount_to).replace(' ', 'T')}Z`).getTime() > Date.now());
  const final = discountActive ? Math.round(cost * (100 - discount)) / 100 : cost;
  return { cost, discount, discountActive, finalCost: final };
}

export function publicSubscription(row) {
  const { cost, discount, discountActive, finalCost } = priceOf(row);
  return {
    ...row,
    cost,
    discount,
    original_cost: cost,
    final_cost: finalCost,
    finalCost,
    discount_active: discountActive,
  };
}

/**
 * Adds `days` to the user subscription, starting from `sub_to` when it is
 * still in the future. Returns the new expiration date.
 */
export function nextSubTo(currentSubTo, days, now = new Date()) {
  const current = currentSubTo ? new Date(`${String(currentSubTo).replace(' ', 'T')}Z`) : null;
  const base = current && current.getTime() > now.getTime() ? current : now;
  const result = new Date(base.getTime() + days * 86400000);
  return result.toISOString().slice(0, 19).replace('T', ' ');
}

export function paginate(items, page, perPage, total) {
  return {
    items,
    total,
    page,
    per_page: perPage,
    total_pages: perPage > 0 ? Math.ceil(total / perPage) : 0,
  };
}

export function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function sqlDate(date) {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}

export function minutesFromNow(minutes) {
  return sqlDate(Date.now() + minutes * 60000);
}

export function downloadTokenTtlMs() {
  return config.downloadTokenTtlMinutes * 60000;
}
