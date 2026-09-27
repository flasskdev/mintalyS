import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';

import { config, isProd } from './config.js';
import { testConnection } from './db.js';
import { resolveUser } from './auth.js';
import { hasAction, listActions, runAction } from './actions/index.js';
import { serveDownload } from './downloads.js';
import { ApiError } from './helpers.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (e.g. mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      if (config.corsOrigin === '*') return callback(null, true);
      const allowed = config.corsOrigin.split(',').map((value) => value.trim());
      if (allowed.includes(origin) || allowed.includes('*')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// tiny in-memory throttle so a single client cannot spam the action endpoint
const hits = new Map();
app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const key = req.ip || 'unknown';
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.start > 60000) {
    hits.set(key, { start: now, count: 1 });
    return next();
  }
  entry.count += 1;
  if (entry.count > 300) {
    res.status(429).json({ success: false, status: 'error', message: 'Слишком много запросов' });
    return;
  }
  // do not let the map grow forever on a public server
  if (hits.size > 10000) {
    for (const [ip, value] of hits) {
      if (now - value.start > 60000) hits.delete(ip);
    }
  }
  next();
});

app.get('/health', async (_req, res) => {
  try {
    const db = await testConnection();
    res.json({ success: true, status: 'success', message: 'ok', data: { db, env: config.env } });
  } catch (error) {
    res.status(503).json({ success: false, status: 'error', message: `db unavailable: ${error.message}` });
  }
});

/**
 * Single JSON entrypoint. The client posts `{ action: 'auth', ... }` here.
 * Available at both `/` and `/api` so it works behind the Vite proxy too.
 */
const actionHandler = async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const action = String(body.action ?? req.query.action ?? '').trim();

  if (!action) {
    res.status(400).json({ success: false, status: 'error', message: 'Не указано действие (action)' });
    return;
  }
  if (!hasAction(action)) {
    res.status(400).json({ success: false, status: 'error', message: `Неизвестное действие: ${action}` });
    return;
  }

  try {
    req.user = await resolveUser(req);
    const result = await runAction(action, {
      req,
      res,
      body,
      action,
      user: req.user ?? null,
      ip: req.ip,
    });
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.httpStatus).json({ success: false, status: 'error', message: error.message });
      return;
    }
    if (error?.httpStatus) {
      res.status(error.httpStatus).json({
        success: false,
        status: 'error',
        message: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
      return;
    }
    console.error(`[api] ${action} failed:`, error);
    res.status(500).json({ success: false, status: 'error', message: error?.message || 'Внутренняя ошибка сервера' });
  }
};

app.post(['/', '/api', '/game/api/v1', '/game/api/v1/'], actionHandler);
app.get(['/game/api/v1', '/game/api/v1/'], (req, res) => {
  if (req.query.action) return actionHandler(req, res);
  res.json({ success: true, status: 'success', message: 'Mintaly Game API v1 is active' });
});
app.get('/actions', (_req, res) => res.json({ success: true, status: 'success', message: 'OK', data: { actions: listActions() } }));

// protected file delivery
app.get('/download', serveDownload);

// --- static frontend (production) -------------------------------------------
if (fs.existsSync(config.publicDir)) {
  app.use(express.static(config.publicDir, { index: false, maxAge: isProd ? '1h' : 0 }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/game/api') || req.path === '/health' || req.path === '/download') return next();
    const indexHtml = path.resolve(config.publicDir, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      res.status(404).json({
        success: false,
        status: 'error',
        message: `index.html не найден внутри ${config.publicDir}. Убедитесь, что внутри папки dist лежат файлы index.html и assets`,
      });
      return;
    }
    res.sendFile(indexHtml);
  });
} else {
  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      status: 'success',
      message: `Mintaly API is running. Frontend build not found in ${config.publicDir} — run "npm run build" or use the Vite dev server.`,
      data: { actions: listActions().length },
    });
  });
}

app.use((error, _req, res, _next) => {
  console.error('[server] unhandled:', error);
  if (res.headersSent) return;
  res.status(500).json({ success: false, status: 'error', message: error?.message || 'Внутренняя ошибка сервера' });
});

async function start() {
  try {
    await testConnection();
    console.log(`[db] connected to ${config.db.host}:${config.db.port}/${config.db.database}`);
  } catch (error) {
    console.error(`[db] connection failed: ${error.message}`);
    console.error('[db] check DB_* values in server/.env and import schema.sql');
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : config.port;
  const host = process.env.IP || (config.host !== '0.0.0.0' ? config.host : undefined);

  const onListen = () => {
    console.log(`[api] Mintaly API listening on port ${port} (${config.env})`);
    console.log(`[api] ${listActions().length} actions registered`);
    if (!config.smtp.host) {
      console.log('[mail] SMTP not configured — verification codes are written to server/logs/mail.log');
    }
  };

  if (host) {
    app.listen(port, host, onListen);
  } else {
    app.listen(port, onListen);
  }
}

start();
