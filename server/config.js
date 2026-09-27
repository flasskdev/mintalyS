import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env') });
dotenv.config({ path: path.join(ROOT_DIR, 'server', '.env') });

const int = (value, fallback) => {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 8000),
  host: process.env.HOST || process.env.IP || '0.0.0.0',

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: int(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mintaly',
    connectionLimit: int(process.env.DB_POOL, 10),
  },

  // Comma separated list of allowed origins. "*" in development.
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173',

  // Set to 1 only when the app really runs behind a reverse proxy that
  // overwrites X-Forwarded-For — otherwise clients could spoof their IP and
  // bypass the login throttle and the download token binding.
  trustProxy: String(process.env.TRUST_PROXY || '0') === '1',

  // where the built frontend lives (served by express in production)
  publicDir: path.resolve(ROOT_DIR, process.env.PUBLIC_DIR || 'dist'),
  // folder with the actual downloadable builds, never exposed statically
  storageDir: path.resolve(ROOT_DIR, process.env.STORAGE_DIR || 'storage'),

  // where the verification / recovery code is printed when SMTP is not set
  mailLogFile: path.resolve(ROOT_DIR, process.env.MAIL_LOG_FILE || path.join('server', 'logs', 'mail.log')),

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: int(process.env.SMTP_PORT, 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Mintaly <no-reply@mintaly.local>',
  },

  // security knobs
  codeTtlMinutes: int(process.env.CODE_TTL_MINUTES, 15),
  codeMaxAttempts: int(process.env.CODE_MAX_ATTEMPTS, 5),
  downloadTokenTtlMinutes: int(process.env.DOWNLOAD_TOKEN_TTL_MINUTES, 15),
  maxLoginAttempts: int(process.env.MAX_LOGIN_ATTEMPTS, 10),
  maxLoginWindowMinutes: int(process.env.MAX_LOGIN_WINDOW_MINUTES, 15),
  loginCooldownSeconds: int(process.env.LOGIN_COOLDOWN_SECONDS, 2),
};

export const isProd = config.env === 'production';
