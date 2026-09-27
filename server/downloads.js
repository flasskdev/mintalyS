import fs, { createReadStream } from 'node:fs';
import path from 'node:path';
import { queryOne, execute } from './db.js';
import { config } from './config.js';
import { clientIp, userAgent } from './helpers.js';

const fail = (res, status, message) => {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ success: false, status: 'error', message }));
};

/**
 * Tells whether the archive of a download row is present in STORAGE_DIR. Used
 * to hide builds that were published before the file was uploaded.
 *
 * @param {unknown} filename
 * @returns {boolean}
 */
export function downloadFileExists(filename) {
  const base = path.basename(String(filename ?? ''));
  if (!base) return false;
  try {
    const resolved = path.resolve(config.storageDir, base);
    if (!resolved.startsWith(path.resolve(config.storageDir) + path.sep)) return false;
    return fs.statSync(resolved).isFile();
  } catch {
    return false;
  }
}

/**
 * GET /download?token=<64 hex>
 *
 * The token is the only way to reach a build:
 *   - issued only to an authenticated subscriber via the `download_token` action
 *   - single use (burned on the first successful read)
 *   - bound to the user IP and User-Agent that requested it
 *   - expires after DOWNLOAD_TOKEN_TTL_MINUTES (15 by default)
 *   - the real file name never leaves the server
 */
export async function serveDownload(req, res) {
  const token = String(req.query.token || '').trim();
  if (!/^[a-f0-9]{64}$/.test(token)) {
    fail(res, 400, 'Ссылка недействительна');
    return;
  }

  const row = await queryOne(
    `SELECT t.id AS token_id, t.user_id, t.ip, t.user_agent, t.used_at, t.expires_at,
            d.filename, d.title, d.filesize, d.sha256, d.is_active,
            u.banned, u.sub_to
       FROM download_tokens t
       JOIN downloads d ON d.id = t.download_id
       JOIN users u ON u.id = t.user_id
      WHERE t.token = ? LIMIT 1`,
    [token],
  );

  if (!row) {
    fail(res, 404, 'Ссылка недействительна');
    return;
  }
  if (row.used_at) {
    fail(res, 410, 'Ссылка уже использована');
    return;
  }
  if (new Date(`${String(row.expires_at).replace(' ', 'T')}Z`).getTime() <= Date.now()) {
    fail(res, 410, 'Срок действия ссылки истёк');
    return;
  }
  if (Number(row.banned)) {
    fail(res, 403, 'Аккаунт заблокирован');
    return;
  }
  if (!Number(row.is_active)) {
    fail(res, 404, 'Файл недоступен');
    return;
  }
  const subActive = row.sub_to && new Date(`${String(row.sub_to).replace(' ', 'T')}Z`).getTime() > Date.now();
  if (!subActive) {
    fail(res, 403, 'Требуется активная подписка');
    return;
  }
  if (row.ip && row.ip !== clientIp(req)) {
    fail(res, 403, 'Ссылка привязана к другому IP');
    return;
  }
  if (row.user_agent && row.user_agent !== userAgent(req)) {
    fail(res, 403, 'Ссылка привязана к другому браузеру');
    return;
  }

  // --- path traversal guard: the file must live directly inside STORAGE_DIR ---
  const safeName = path.basename(String(row.filename));
  const filePath = path.join(config.storageDir, safeName);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(config.storageDir) + path.sep)) {
    fail(res, 400, 'Некорректное имя файла');
    return;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    fail(res, 404, 'Файл не найден на сервере');
    return;
  }

  // burn the token first so it can never be replayed
  const burned = await execute(
    'UPDATE download_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL',
    [row.token_id],
  );
  if (Number(burned.affectedRows) !== 1) {
    fail(res, 410, 'Ссылка уже использована');
    return;
  }

  const stat = fs.statSync(resolved);
  const downloadName = `${String(row.title).replace(/[^\w.\- ]+/g, '_').trim() || 'download'}.zip`;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${downloadName.replace(/["\\]/g, '')}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // lets the client verify the archive after download
  if (row.sha256) res.setHeader('X-Checksum-Sha256', String(row.sha256));

  createReadStream(resolved)
    .on('error', () => {
      if (!res.headersSent) fail(res, 500, 'Ошибка чтения файла');
      else res.destroy();
    })
    .pipe(res);
}
