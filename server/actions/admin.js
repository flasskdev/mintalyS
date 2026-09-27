import { randomInt } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execute, query, queryOne, transaction } from '../db.js';
import { USER_COLUMNS } from '../auth.js';
import { invalidateSettingsCache } from '../settings-store.js';
import { config } from '../config.js';
import {
  ApiError,
  clientIp,
  nowSql,
  paginate,
  publicSubscription,
  publicUser,
  sha256File,
  validators,
} from '../helpers.js';

const ORDER_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
const TICKET_STATUSES = ['open', 'answered', 'waiting', 'closed'];

function logAction(ctx, action, targetType, targetId, details) {
  return execute(
    'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip) VALUES (?, ?, ?, ?, ?, ?)',
    [ctx.user.id, action, targetType, targetId, details ?? null, clientIp(ctx.req) || null],
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function stats() {
  const [users, subs, balance, today] = await Promise.all([
    queryOne('SELECT COUNT(*) AS total FROM users'),
    queryOne('SELECT COUNT(*) AS total FROM users WHERE sub_to > UTC_TIMESTAMP()'),
    queryOne('SELECT COALESCE(SUM(balance), 0) AS total FROM users'),
    queryOne("SELECT COUNT(*) AS total FROM users WHERE created_at >= UTC_DATE()"),
  ]);

  return {
    success: true,
    status: 'success',
    message: 'OK',
    data: {
      total_users: Number(users?.total ?? 0),
      active_subs: Number(subs?.total ?? 0),
      total_balance: Number(balance?.total ?? 0),
      today_registrations: Number(today?.total ?? 0),
    },
  };
}

export async function logs({ body }) {
  const page = validators.page(body.page, 1);
  const perPage = validators.perPage(body.per_page, 50, 200);
  const offset = (page - 1) * perPage;

  const rows = await query(
    'SELECT id, admin_id, action, target_type, target_id, details, ip, created_at FROM admin_logs ORDER BY id DESC LIMIT ? OFFSET ?',
    [perPage, offset],
  );
  const totalRow = await queryOne('SELECT COUNT(*) AS total FROM admin_logs');

  return { success: true, status: 'success', message: 'OK', data: paginate(rows, page, perPage, Number(totalRow?.total ?? 0)) };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function users_list({ body }) {
  const page = validators.page(body.page, 1);
  const perPage = validators.perPage(body.per_page, 50, 200);
  const offset = (page - 1) * perPage;

  const search = String(body.search ?? '').trim();
  const params = [];
  let where = '';

  if (search) {
    where = 'WHERE name LIKE ? OR email LIKE ? OR id = ?';
    params.push(`%${search}%`, `%${search}%`, Number.isNaN(parseInt(search, 10)) ? 0 : parseInt(search, 10));
  }

  const rows = await query(
    `SELECT ${USER_COLUMNS},
            (sub_to IS NOT NULL AND sub_to > UTC_TIMESTAMP()) AS sub_active,
            GREATEST(0, CEIL(TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), sub_to) / 86400)) AS sub_days_left
       FROM users ${where}
      ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, perPage, offset],
  );
  const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM users ${where}`, params);

  return {
    success: true,
    status: 'success',
    message: 'OK',
    data: paginate(rows.map(publicUser), page, perPage, Number(totalRow?.total ?? 0)),
  };
}

export async function ban(ctx) {
  const { body, user } = ctx;
  const targetId = validators.id(body.target_id, { field: 'пользователя' });
  const reason = String(body.reason ?? '').trim().slice(0, 255) || 'Нарушение правил';

  if (targetId === user.id) throw new ApiError('Нельзя забанить себя');

  const target = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [targetId]);
  if (!target) throw new ApiError('Пользователь не найден');
  if (Number(target.dev)) throw new ApiError('Нельзя забанить разработчика');

  await execute(
    'UPDATE users SET banned = 1, ban_reason = ?, banned_at = ?, token = NULL WHERE id = ?',
    [reason, nowSql(), targetId],
  );
  await logAction(ctx, 'ban', 'user', targetId, `reason=${reason}`);

  return { success: true, status: 'success', message: `Пользователь ${target.name} заблокирован` };
}

export async function unban(ctx) {
  const targetId = validators.id(ctx.body.target_id, { field: 'пользователя' });

  const target = await queryOne('SELECT name FROM users WHERE id = ? LIMIT 1', [targetId]);
  if (!target) throw new ApiError('Пользователь не найден');

  await execute('UPDATE users SET banned = 0, ban_reason = NULL, banned_at = NULL WHERE id = ?', [targetId]);
  await logAction(ctx, 'unban', 'user', targetId);

  return { success: true, status: 'success', message: `Пользователь ${target.name} разблокирован` };
}

export async function balance_add(ctx) {
  const targetId = validators.id(ctx.body.target_id, { field: 'пользователя' });
  const amount = Number(ctx.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError('Некорректная сумма');
  if (amount > 100000) throw new ApiError('Слишком большая сумма');

  const target = await queryOne('SELECT name, balance FROM users WHERE id = ? LIMIT 1', [targetId]);
  if (!target) throw new ApiError('Пользователь не найден');

  await execute('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, targetId]);
  await logAction(ctx, 'balance_add', 'user', targetId, `amount=${amount}`);

  const fresh = await queryOne('SELECT balance FROM users WHERE id = ? LIMIT 1', [targetId]);
  return { success: true, status: 'success', message: 'Баланс пополнен', data: { balance: Number(fresh.balance) } };
}

/** Gives a dev-only shortcut to extend or revoke a subscription manually. */
export async function sub_grant(ctx) {
  const targetId = validators.id(ctx.body.target_id, { field: 'пользователя' });
  const days = parseInt(ctx.body.days ?? 30, 10);
  if (!Number.isInteger(days) || days === 0) throw new ApiError('Некорректное количество дней');

  const target = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [targetId]);
  if (!target) throw new ApiError('Пользователь не найден');

  if (days < 0) {
    await execute('UPDATE users SET sub_to = UTC_TIMESTAMP(), sub_id = NULL WHERE id = ?', [targetId]);
    await logAction(ctx, 'sub_revoke', 'user', targetId);
    return { success: true, status: 'success', message: 'Подписка отозвана' };
  }

  const current = target.sub_to ? new Date(`${String(target.sub_to).replace(' ', 'T')}Z`) : null;
  const base = current && current.getTime() > Date.now() ? current : new Date();
  const subTo = new Date(base.getTime() + days * 86400000).toISOString().slice(0, 19).replace('T', ' ');

  // a granted subscription always belongs to a plan: keep the current one,
  // take the requested one, or fall back to the first visible plan
  let subId = ctx.body.sub_id !== undefined ? validators.id(ctx.body.sub_id, { field: 'подписки' }) : target.sub_id;
  if (!subId) {
    const fallback = await queryOne('SELECT id FROM subscriptions WHERE is_visible = 1 ORDER BY sort_order ASC, id ASC LIMIT 1');
    if (!fallback) throw new ApiError('Сначала создайте хотя бы один тариф');
    subId = fallback.id;
  }

  await execute('UPDATE users SET sub_id = ?, sub_to = ? WHERE id = ?', [subId, subTo, targetId]);
  await logAction(ctx, 'sub_grant', 'user', targetId, `days=${days}, sub=${subId}`);

  return { success: true, status: 'success', message: `Подписка продлена на ${days} дн.`, data: { sub_to: subTo, sub_id: subId } };
}

export async function hwid_reset(ctx) {
  const targetId = validators.id(ctx.body.target_id, { field: 'пользователя' });
  const target = await queryOne('SELECT name FROM users WHERE id = ? LIMIT 1', [targetId]);
  if (!target) throw new ApiError('Пользователь не найден');

  await execute(
    'UPDATE users SET hwid = NULL, hwid_reset_at = ?, hwid_reset_count = hwid_reset_count + 1 WHERE id = ?',
    [nowSql(), targetId],
  );
  await logAction(ctx, 'hwid_reset', 'user', targetId);

  return { success: true, status: 'success', message: `HWID пользователя ${target.name} сброшен` };
}

// ---------------------------------------------------------------------------
// Subscription plans
// ---------------------------------------------------------------------------

export async function sub_create(ctx) {
  const name = validators.text(ctx.body.name, { field: 'Название', min: 2, max: 64 });
  const description = String(ctx.body.description ?? '').trim().slice(0, 255);
  const subDays = parseInt(ctx.body.sub_days ?? 30, 10);
  const cost = Number(ctx.body.cost ?? 0);
  const discount = parseInt(ctx.body.discount ?? 0, 10);
  const sortOrder = parseInt(ctx.body.sort_order ?? 0, 10);

  if (!Number.isInteger(subDays) || subDays < 1) throw new ApiError('Некорректное количество дней');
  if (!Number.isFinite(cost) || cost < 0 || cost > 100000) throw new ApiError('Некорректная цена');
  if (!Number.isInteger(discount) || discount < 0 || discount > 90) throw new ApiError('Скидка должна быть от 0 до 90 %');

  const result = await execute(
    `INSERT INTO subscriptions (name, description, sub_days, cost, discount, is_visible, is_popular, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description, subDays, cost, discount, validators.bool(ctx.body.is_visible ?? 1), validators.bool(ctx.body.is_popular ?? 0), sortOrder || 0],
  );
  await logAction(ctx, 'sub_create', 'subscription', result.insertId, `name=${name}`);

  const sub = await queryOne('SELECT * FROM subscriptions WHERE id = ? LIMIT 1', [result.insertId]);
  return { success: true, status: 'success', message: 'Подписка создана', data: { sub: publicSubscription(sub) } };
}

export async function sub_update(ctx) {
  const id = validators.id(ctx.body.id, { field: 'подписки' });

  const current = await queryOne('SELECT * FROM subscriptions WHERE id = ? LIMIT 1', [id]);
  if (!current) throw new ApiError('Подписка не найдена');

  const name = ctx.body.name !== undefined ? validators.text(ctx.body.name, { field: 'Название', min: 2, max: 64 }) : current.name;
  const description = ctx.body.description !== undefined ? String(ctx.body.description).trim().slice(0, 255) : current.description;
  const subDays = ctx.body.sub_days !== undefined ? parseInt(ctx.body.sub_days, 10) : current.sub_days;
  const cost = ctx.body.cost !== undefined ? Number(ctx.body.cost) : Number(current.cost);
  const discount = ctx.body.discount !== undefined ? parseInt(ctx.body.discount, 10) : current.discount;
  const isVisible = ctx.body.is_visible !== undefined ? validators.bool(ctx.body.is_visible) : current.is_visible;
  const isPopular = ctx.body.is_popular !== undefined ? validators.bool(ctx.body.is_popular) : current.is_popular;
  const sortOrder = ctx.body.sort_order !== undefined ? parseInt(ctx.body.sort_order, 10) : current.sort_order;

  if (!Number.isInteger(subDays) || subDays < 1) throw new ApiError('Некорректное количество дней');
  if (!Number.isFinite(cost) || cost < 0 || cost > 100000) throw new ApiError('Некорректная цена');
  if (!Number.isInteger(discount) || discount < 0 || discount > 90) throw new ApiError('Скидка должна быть от 0 до 90 %');

  await execute(
    `UPDATE subscriptions
        SET name = ?, description = ?, sub_days = ?, cost = ?, discount = ?, is_visible = ?, is_popular = ?, sort_order = ?
      WHERE id = ?`,
    [name, description, subDays, cost, discount, isVisible, isPopular, sortOrder || 0, id],
  );
  await logAction(ctx, 'sub_update', 'subscription', id, `name=${name}`);

  const sub = await queryOne('SELECT * FROM subscriptions WHERE id = ? LIMIT 1', [id]);
  return { success: true, status: 'success', message: 'Подписка обновлена', data: { sub: publicSubscription(sub) } };
}

export async function sub_delete(ctx) {
  const id = validators.id(ctx.body.id, { field: 'подписки' });

  const sub = await queryOne('SELECT name FROM subscriptions WHERE id = ? LIMIT 1', [id]);
  if (!sub) throw new ApiError('Подписка не найдена');

  const active = Number((await queryOne('SELECT COUNT(*) AS total FROM users WHERE sub_id = ? AND sub_to > UTC_TIMESTAMP()', [id]))?.total ?? 0);
  if (active > 0) throw new ApiError('На этом плане ещё есть активные пользователи');

  await execute('DELETE FROM subscriptions WHERE id = ?', [id]);
  await logAction(ctx, 'sub_delete', 'subscription', id, `name=${sub.name}`);

  return { success: true, status: 'success', message: 'Подписка удалена' };
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

/** Only the file name may be used, and it must live directly in STORAGE_DIR. */
function safeStorageName(value) {
  const name = path.basename(String(value ?? '').trim());
  if (!name || name === '.' || name === '..' || name !== String(value).trim()) {
    throw new ApiError('Некорректное имя файла');
  }
  if (!/^[A-Za-z0-9._-]{1,180}$/.test(name)) throw new ApiError('Некорректное имя файла');
  return name;
}

function storageFilePath(filename) {
  const resolved = path.resolve(config.storageDir, filename);
  if (!resolved.startsWith(path.resolve(config.storageDir) + path.sep)) {
    throw new ApiError('Некорректное имя файла');
  }
  return resolved;
}

/** @returns {import('node:fs').Stats|null} */
function statStorageFile(filename) {
  try {
    const stat = fs.statSync(storageFilePath(filename));
    return stat.isFile() ? stat : null;
  } catch {
    return null;
  }
}

export async function downloads_list() {
  const rows = await query(
    'SELECT id, title, version, filename, filesize, sha256, changelog, is_active, created_at FROM downloads ORDER BY id DESC',
  );
  const downloads = rows.map((row) => ({
    ...row,
    filesize: Number(row.filesize ?? 0),
    is_active: Number(row.is_active) ? 1 : 0,
    file_exists: statStorageFile(row.filename) !== null,
  }));
  return { success: true, status: 'success', message: 'OK', data: { downloads } };
}

export async function download_create(ctx) {
  const title = validators.text(ctx.body.title, { field: 'Название', min: 2, max: 120 });
  const version = validators.text(ctx.body.version ?? '1.0.0', { field: 'Версия', min: 1, max: 32 });
  const filename = safeStorageName(ctx.body.filename);
  const changelog = ctx.body.changelog ? String(ctx.body.changelog).trim().slice(0, 5000) : null;
  const isActive = validators.bool(ctx.body.is_active ?? 0);

  const stat = statStorageFile(filename);
  if (isActive && !stat) {
    throw new ApiError(`Файл ${filename} не найден в папке сборок (STORAGE_DIR). Сначала загрузите его на сервер.`);
  }

  const filesize = stat ? stat.size : 0;
  const sha256 = stat ? await sha256File(storageFilePath(filename)) : null;

  const result = await execute(
    'INSERT INTO downloads (title, version, filename, filesize, sha256, changelog, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [title, version, filename, filesize, sha256, changelog, isActive],
  );
  await logAction(ctx, 'download_create', 'download', result.insertId, `filename=${filename}`);

  const row = await queryOne('SELECT * FROM downloads WHERE id = ? LIMIT 1', [result.insertId]);
  return {
    success: true,
    status: 'success',
    message: stat ? 'Сборка добавлена' : 'Сборка добавлена, но файла на сервере пока нет',
    data: {
      download: {
        ...row,
        filesize: Number(row.filesize ?? 0),
        is_active: Number(row.is_active),
        file_exists: stat !== null,
      },
    },
  };
}

export async function download_update(ctx) {
  const id = validators.id(ctx.body.id, { field: 'сборки' });
  const current = await queryOne('SELECT * FROM downloads WHERE id = ? LIMIT 1', [id]);
  if (!current) throw new ApiError('Сборка не найдена');

  const title = ctx.body.title !== undefined ? validators.text(ctx.body.title, { field: 'Название', min: 2, max: 120 }) : current.title;
  const version = ctx.body.version !== undefined ? validators.text(ctx.body.version, { field: 'Версия', min: 1, max: 32 }) : current.version;
  const filename = ctx.body.filename !== undefined ? safeStorageName(ctx.body.filename) : current.filename;
  const changelog = ctx.body.changelog !== undefined ? String(ctx.body.changelog).trim().slice(0, 5000) || null : current.changelog;
  const isActive = ctx.body.is_active !== undefined ? validators.bool(ctx.body.is_active) : Number(current.is_active);

  const stat = statStorageFile(filename);

  // size and hash belong to the file, so they are recomputed when the name
  // changed, when the build was uploaded after the row was created, or when a
  // rebuilt archive no longer matches what we stored
  let filesize = stat ? stat.size : 0;
  let sha256 = current.sha256;
  if (stat && (filename !== current.filename || filesize !== Number(current.filesize ?? 0))) {
    sha256 = await sha256File(storageFilePath(filename));
  } else if (!stat) {
    sha256 = null;
  }

  if (isActive && !stat) {
    throw new ApiError(`Файл ${filename} не найден в папке сборок (STORAGE_DIR)`);
  }

  await execute(
    'UPDATE downloads SET title = ?, version = ?, filename = ?, filesize = ?, sha256 = ?, changelog = ?, is_active = ? WHERE id = ?',
    [title, version, filename, filesize, sha256, changelog, isActive, id],
  );
  await logAction(ctx, 'download_update', 'download', id, `filename=${filename}, active=${isActive}`);

  const row = await queryOne('SELECT * FROM downloads WHERE id = ? LIMIT 1', [id]);
  return {
    success: true,
    status: 'success',
    message: 'Сборка обновлена',
    data: {
      download: {
        ...row,
        filesize: Number(row.filesize ?? 0),
        is_active: Number(row.is_active),
        file_exists: stat !== null,
      },
    },
  };
}

export async function download_delete(ctx) {
  const id = validators.id(ctx.body.id, { field: 'сборки' });

  const row = await queryOne('SELECT filename FROM downloads WHERE id = ? LIMIT 1', [id]);
  if (!row) throw new ApiError('Сборка не найдена');

  await transaction(async (conn) => {
    await conn.execute('DELETE FROM download_tokens WHERE download_id = ?', [id]);
    await conn.execute('DELETE FROM downloads WHERE id = ?', [id]);
  });
  await logAction(ctx, 'download_delete', 'download', id, `filename=${row.filename}`);

  return { success: true, status: 'success', message: 'Сборка удалена из списка (файл на сервере не тронут)' };
}

// ---------------------------------------------------------------------------
// License keys
// ---------------------------------------------------------------------------

const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateKeyCode() {
  let out = '';
  for (let i = 0; i < 64; i += 1) {
    out += KEY_ALPHABET[randomInt(0, KEY_ALPHABET.length)];
  }
  return out;
}

export async function key_create(ctx) {
  const subId = validators.id(ctx.body.sub_id, { field: 'подписки' });
  const daysOverride = ctx.body.days_override ? parseInt(ctx.body.days_override, 10) : null;
  const note = ctx.body.note ? String(ctx.body.note).trim().slice(0, 255) : null;

  const sub = await queryOne('SELECT name FROM subscriptions WHERE id = ? LIMIT 1', [subId]);
  if (!sub) throw new ApiError('Подписка не найдена');
  if (daysOverride !== null && (!Number.isInteger(daysOverride) || daysOverride < 1)) {
    throw new ApiError('Некорректное количество дней');
  }

  const keyCode = generateKeyCode();
  const result = await execute(
    'INSERT INTO license_keys (key_code, sub_id, days_override, note, created_by) VALUES (?, ?, ?, ?, ?)',
    [keyCode, subId, daysOverride, note, ctx.user.id],
  );
  await logAction(ctx, 'key_create', 'license_key', result.insertId, `sub=${subId}`);

  const key = await queryOne('SELECT * FROM license_keys WHERE id = ? LIMIT 1', [result.insertId]);
  return { success: true, status: 'success', message: 'Ключ создан', data: { key } };
}

export async function keys_list({ body }) {
  const page = validators.page(body.page, 1);
  const perPage = validators.perPage(body.per_page, 50, 200);
  const offset = (page - 1) * perPage;

  const rows = await query('SELECT * FROM license_keys ORDER BY id DESC LIMIT ? OFFSET ?', [perPage, offset]);
  const totalRow = await queryOne('SELECT COUNT(*) AS total FROM license_keys');

  return { success: true, status: 'success', message: 'OK', data: paginate(rows, page, perPage, Number(totalRow?.total ?? 0)) };
}

export async function key_delete(ctx) {
  const id = validators.id(ctx.body.id, { field: 'ключа' });

  const key = await queryOne('SELECT used_by FROM license_keys WHERE id = ? LIMIT 1', [id]);
  if (!key) throw new ApiError('Ключ не найден');
  if (key.used_by) throw new ApiError('Использованный ключ удалить нельзя');

  await execute('DELETE FROM license_keys WHERE id = ?', [id]);
  await logAction(ctx, 'key_delete', 'license_key', id);

  return { success: true, status: 'success', message: 'Ключ удалён' };
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export async function news_create(ctx) {
  const title = validators.text(ctx.body.title, { field: 'Заголовок', min: 3, max: 180 });
  const shortDesc = validators.text(ctx.body.short_desc, { field: 'Краткое описание', min: 3, max: 300 });
  const content = validators.text(ctx.body.content, { field: 'Содержание', min: 3, max: 100000 });
  const isPublished = validators.bool(ctx.body.is_published ?? 1);
  const isPinned = validators.bool(ctx.body.is_pinned ?? 0);

  const result = await execute(
    'INSERT INTO news (title, short_desc, content, author_id, is_published, is_pinned) VALUES (?, ?, ?, ?, ?, ?)',
    [title, shortDesc, content, ctx.user.id, isPublished, isPinned],
  );
  await logAction(ctx, 'news_create', 'news', result.insertId, `title=${title}`);

  const news = await queryOne('SELECT * FROM news WHERE id = ? LIMIT 1', [result.insertId]);
  return { success: true, status: 'success', message: 'Новость создана', data: { news } };
}

export async function news_update(ctx) {
  const id = validators.id(ctx.body.id, { field: 'новости' });

  const current = await queryOne('SELECT * FROM news WHERE id = ? LIMIT 1', [id]);
  if (!current) throw new ApiError('Новость не найдена');

  const title = ctx.body.title !== undefined ? validators.text(ctx.body.title, { field: 'Заголовок', min: 3, max: 180 }) : current.title;
  const shortDesc = ctx.body.short_desc !== undefined ? validators.text(ctx.body.short_desc, { field: 'Краткое описание', min: 3, max: 300 }) : current.short_desc;
  const content = ctx.body.content !== undefined ? validators.text(ctx.body.content, { field: 'Содержание', min: 3, max: 100000 }) : current.content;
  const isPublished = ctx.body.is_published !== undefined ? validators.bool(ctx.body.is_published) : current.is_published;
  const isPinned = ctx.body.is_pinned !== undefined ? validators.bool(ctx.body.is_pinned) : current.is_pinned;

  await execute(
    'UPDATE news SET title = ?, short_desc = ?, content = ?, is_published = ?, is_pinned = ? WHERE id = ?',
    [title, shortDesc, content, isPublished, isPinned, id],
  );
  await logAction(ctx, 'news_update', 'news', id, `title=${title}`);

  const news = await queryOne('SELECT * FROM news WHERE id = ? LIMIT 1', [id]);
  return { success: true, status: 'success', message: 'Новость обновлена', data: { news } };
}

export async function news_delete(ctx) {
  const id = validators.id(ctx.body.id, { field: 'новости' });

  const news = await queryOne('SELECT title FROM news WHERE id = ? LIMIT 1', [id]);
  if (!news) throw new ApiError('Новость не найдена');

  await transaction(async (conn) => {
    await conn.execute('DELETE FROM news_comments WHERE news_id = ?', [id]);
    await conn.execute('DELETE FROM news WHERE id = ?', [id]);
  });
  await logAction(ctx, 'news_delete', 'news', id, `title=${news.title}`);

  return { success: true, status: 'success', message: 'Новость удалена' };
}

// ---------------------------------------------------------------------------
// Orders — approving a pending order grants the subscription
// ---------------------------------------------------------------------------

export async function orders_list({ body }) {
  const page = validators.page(body.page, 1);
  const perPage = validators.perPage(body.per_page, 50, 200);
  const offset = (page - 1) * perPage;

  const rows = await query('SELECT * FROM orders ORDER BY id DESC LIMIT ? OFFSET ?', [perPage, offset]);
  const totalRow = await queryOne('SELECT COUNT(*) AS total FROM orders');

  return { success: true, status: 'success', message: 'OK', data: paginate(rows, page, perPage, Number(totalRow?.total ?? 0)) };
}

export async function order_status(ctx) {
  const id = validators.id(ctx.body.id, { field: 'заказа' });
  const status = validators.enumValue(ctx.body.status, ORDER_STATUSES, null);
  if (!status) throw new ApiError('Неизвестный статус заказа');

  const order = await queryOne('SELECT * FROM orders WHERE id = ? LIMIT 1', [id]);
  if (!order) throw new ApiError('Заказ не найден');
  if (order.status === status) throw new ApiError('Статус не изменился');

  await transaction(async (conn) => {
    await conn.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);

    if (status === 'paid') {
      // grant the subscription (extend if one is already running)
      const [rows] = await conn.execute('SELECT sub_to FROM users WHERE id = ? LIMIT 1', [order.user_id]);
      const currentSubTo = rows[0]?.sub_to;
      const now = Date.now();
      const current = currentSubTo ? new Date(`${String(currentSubTo).replace(' ', 'T')}Z`) : null;
      const base = current && current.getTime() > now ? current : new Date();
      const subTo = new Date(base.getTime() + order.days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
      await conn.execute('UPDATE users SET sub_id = ?, sub_to = ? WHERE id = ?', [order.sub_id, subTo, order.user_id]);
      await conn.execute('UPDATE subscriptions SET subs_value = subs_value + 1 WHERE id = ?', [order.sub_id]);
    }

    if (order.status === 'paid' && (status === 'refunded' || status === 'failed')) {
      // the granted days are taken back
      await conn.execute(
        'UPDATE users SET sub_to = UTC_TIMESTAMP() WHERE id = ? AND sub_id = ?',
        [order.user_id, order.sub_id],
      );
    }
  });

  await logAction(ctx, 'order_status', 'order', id, `${order.status} -> ${status}`);

  return { success: true, status: 'success', message: `Статус заказа: ${status}` };
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export async function tickets_list({ body }) {
  const page = validators.page(body.page, 1);
  const perPage = validators.perPage(body.per_page, 50, 200);
  const offset = (page - 1) * perPage;

  const rows = await query('SELECT * FROM tickets ORDER BY updated_at DESC LIMIT ? OFFSET ?', [perPage, offset]);
  const totalRow = await queryOne('SELECT COUNT(*) AS total FROM tickets');

  return { success: true, status: 'success', message: 'OK', data: paginate(rows, page, perPage, Number(totalRow?.total ?? 0)) };
}

export async function ticket_reply(ctx) {
  const ticketId = validators.id(ctx.body.ticket_id, { field: 'обращения' });
  const message = validators.text(ctx.body.message, { field: 'Ответ', min: 2, max: 10000 });

  const ticket = await queryOne('SELECT * FROM tickets WHERE id = ? LIMIT 1', [ticketId]);
  if (!ticket) throw new ApiError('Обращение не найдено');

  const result = await execute(
    'INSERT INTO ticket_messages (ticket_id, user_id, is_staff, message) VALUES (?, ?, 1, ?)',
    [ticketId, ctx.user.id, message],
  );
  await execute(
    'UPDATE tickets SET last_reply_at = UTC_TIMESTAMP(), last_reply_staff = 1, status = ? WHERE id = ?',
    [ticket.status === 'closed' ? 'closed' : 'answered', ticketId],
  );
  await logAction(ctx, 'ticket_reply', 'ticket', ticketId);

  const row = await queryOne(
    `SELECT m.id, m.ticket_id, m.user_id, m.is_staff, m.message, m.created_at, u.name AS user_name
       FROM ticket_messages m LEFT JOIN users u ON u.id = m.user_id
      WHERE m.id = ? LIMIT 1`,
    [result.insertId],
  );

  return {
    success: true,
    status: 'success',
    message: 'Ответ отправлен',
    data: { message: { ...row, is_staff: 1, user: { id: row.user_id, name: row.user_name } } },
  };
}

export async function ticket_status(ctx) {
  const ticketId = validators.id(ctx.body.ticket_id, { field: 'обращения' });
  const status = validators.enumValue(ctx.body.status, TICKET_STATUSES, null);
  if (!status) throw new ApiError('Неизвестный статус обращения');

  const ticket = await queryOne('SELECT status FROM tickets WHERE id = ? LIMIT 1', [ticketId]);
  if (!ticket) throw new ApiError('Обращение не найдено');

  await execute('UPDATE tickets SET status = ? WHERE id = ?', [status, ticketId]);
  await logAction(ctx, 'ticket_status', 'ticket', ticketId, `${ticket.status} -> ${status}`);

  return { success: true, status: 'success', message: `Статус обращения: ${status}` };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function settings_update(ctx) {
  const allowed = [
    'site_name',
    'registration_open',
    'maintenance',
    'forum_open',
    'hwid_reset_days',
    'redeem_cooldown_minutes',
    'terms_text',
    'refund_text',
  ];

  const updates = [];
  for (const key of allowed) {
    if (ctx.body[key] !== undefined) {
      let value = String(ctx.body[key]);
      if (key === 'site_name') {
        value = validators.text(value, { field: 'Название сайта', min: 1, max: 64 });
      } else if (key === 'hwid_reset_days' || key === 'redeem_cooldown_minutes') {
        value = String(validators.int(value, { field: key, min: 1, max: 3650 }));
      } else if (key === 'registration_open' || key === 'maintenance' || key === 'forum_open') {
        value = value === '1' || value === 'true' ? '1' : '0';
      } else {
        value = validators.text(value, { field: key, min: 0, max: 20000 });
      }
      updates.push([value, key]);
    }
  }
  if (updates.length === 0) throw new ApiError('Нет изменений');

  await transaction(async (conn) => {
    for (const [value, key] of updates) {
      try {
        await conn.execute(
          'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
          [key, value],
        );
      } catch {
        await conn.execute(
          'INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
          [key, value],
        );
      }
    }
  });
  invalidateSettingsCache();
  await logAction(ctx, 'settings_update', 'settings', null, `keys=${updates.map(([, key]) => key).join(',')}`);

  return { success: true, status: 'success', message: 'Настройки сохранены' };
}

export default {
  stats,
  logs,
  users_list,
  ban,
  unban,
  balance_add,
  sub_grant,
  hwid_reset,
  sub_create,
  sub_update,
  sub_delete,
  downloads_list,
  download_create,
  download_update,
  download_delete,
  key_create,
  keys_list,
  key_delete,
  news_create,
  news_update,
  news_delete,
  orders_list,
  order_status,
  tickets_list,
  ticket_reply,
  ticket_status,
  settings_update,
};
