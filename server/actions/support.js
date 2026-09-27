import { execute, query, queryOne, transaction } from '../db.js';
import { isDev } from '../auth.js';
import { downloadFileExists } from '../downloads.js';
import { getSettings, settingInt } from '../settings-store.js';
import {
  ApiError,
  clientIp,
  downloadTokenTtlMs,
  nextSubTo,
  paginate,
  publicSubscription,
  randomToken,
  sqlDate,
  userAgent,
  validators,
} from '../helpers.js';

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------

const TICKET_CATEGORIES = ['general', 'payment', 'technical', 'ban', 'other'];

const MESSAGE_SELECT = `
  SELECT m.id, m.ticket_id, m.user_id, m.is_staff, m.message, m.created_at, u.name AS user_name
    FROM ticket_messages m
    LEFT JOIN users u ON u.id = m.user_id
`;

function mapMessage(row) {
  return {
    ...row,
    is_staff: Number(row.is_staff) ? 1 : 0,
    user: row.user_id ? { id: row.user_id, name: row.user_name || `User #${row.user_id}` } : null,
  };
}

export async function tickets_list({ user }) {
  const rows = await query(
    `SELECT t.id, t.user_id, t.subject, t.category, t.status, t.priority,
            t.last_reply_at, t.last_reply_staff, t.created_at, t.updated_at,
            (SELECT m.message FROM ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_message
       FROM tickets t WHERE t.user_id = ? ORDER BY t.updated_at DESC LIMIT 200`,
    [user.id],
  );
  return { success: true, status: 'success', message: 'OK', data: { tickets: rows } };
}

export async function ticket_get({ body, user }) {
  const id = validators.id(body.id, { field: 'обращения' });

  const ticket = await queryOne('SELECT * FROM tickets WHERE id = ? LIMIT 1', [id]);
  if (!ticket) throw new ApiError('Обращение не найдено');
  if (ticket.user_id !== user.id && !isDev(user)) throw new ApiError('Недостаточно прав', 403);

  const messages = await query(`${MESSAGE_SELECT} WHERE m.ticket_id = ? ORDER BY m.created_at ASC, m.id ASC`, [id]);
  return { success: true, status: 'success', message: 'OK', data: { ticket, messages: messages.map(mapMessage) } };
}

export async function ticket_create({ body, user }) {
  const subject = validators.text(body.subject, { field: 'Тема', min: 3, max: 180 });
  const category = validators.enumValue(body.category, TICKET_CATEGORIES, 'general');
  const message = validators.text(body.message, { field: 'Сообщение', min: 5, max: 10000 });

  const openTickets = Number(
    (await queryOne("SELECT COUNT(*) AS total FROM tickets WHERE user_id = ? AND status <> 'closed'", [user.id]))?.total ?? 0,
  );
  if (openTickets >= 10) throw new ApiError('У вас слишком много открытых обращений. Закройте лишние');

  const result = await transaction(async (conn) => {
    const [ticket] = await conn.execute(
      'INSERT INTO tickets (user_id, subject, category) VALUES (?, ?, ?)',
      [user.id, subject, category],
    );
    await conn.execute(
      'INSERT INTO ticket_messages (ticket_id, user_id, is_staff, message) VALUES (?, ?, 0, ?)',
      [ticket.insertId, user.id, message],
    );
    await conn.execute('UPDATE tickets SET last_reply_at = UTC_TIMESTAMP() WHERE id = ?', [ticket.insertId]);
    return ticket;
  });

  const ticket = await queryOne('SELECT * FROM tickets WHERE id = ? LIMIT 1', [result.insertId]);
  return { success: true, status: 'success', message: 'Обращение создано', data: { ticket } };
}

export async function ticket_reply({ body, user }) {
  const ticketId = validators.id(body.ticket_id, { field: 'обращения' });
  const message = validators.text(body.message, { field: 'Сообщение', min: 2, max: 10000 });

  const ticket = await queryOne('SELECT * FROM tickets WHERE id = ? LIMIT 1', [ticketId]);
  if (!ticket) throw new ApiError('Обращение не найдено');
  if (ticket.user_id !== user.id && !isDev(user)) throw new ApiError('Недостаточно прав', 403);
  if (ticket.status === 'closed') throw new ApiError('Обращение закрыто');
  if (Number(user.forum_banned) && !isDev(user)) throw new ApiError('Вам запрещено писать в поддержку', 403);

  const result = await execute(
    'INSERT INTO ticket_messages (ticket_id, user_id, is_staff, message) VALUES (?, ?, ?, ?)',
    [ticketId, user.id, isDev(user) ? 1 : 0, message],
  );
  await execute(
    'UPDATE tickets SET last_reply_at = UTC_TIMESTAMP(), last_reply_staff = ?, status = ? WHERE id = ?',
    [isDev(user) ? 1 : 0, isDev(user) ? 'answered' : 'waiting', ticketId],
  );

  const row = await queryOne(`${MESSAGE_SELECT} WHERE m.id = ? LIMIT 1`, [result.insertId]);
  return { success: true, status: 'success', message: 'Ответ отправлен', data: { message: mapMessage(row) } };
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

export async function downloads_list() {
  const rows = await query(
    'SELECT id, title, version, filename, filesize, sha256, changelog, is_active, created_at FROM downloads WHERE is_active = 1 ORDER BY id DESC',
  );
  // the raw filename must never reach the client - the file is served by
  // GET /download?token=... only. Builds whose archive is missing on disk are
  // hidden so users never see a download that cannot start.
  const downloads = rows
    .filter((row) => downloadFileExists(row.filename))
    .map((row) => ({
      id: row.id,
      title: row.title,
      version: row.version,
      filesize: Number(row.filesize ?? 0),
      sha256: row.sha256,
      changelog: row.changelog,
      is_active: Number(row.is_active) ? 1 : 0,
      created_at: row.created_at,
    }));
  return { success: true, status: 'success', message: 'OK', data: { downloads } };
}

/**
 * Issues a single-use download token bound to the user, IP and User-Agent.
 * The client then opens GET /download?token=... exactly once.
 */
export async function download_token({ body, user, req }) {
  const downloadId = validators.id(body.download_id, { field: 'файла' });

  const download = await queryOne('SELECT * FROM downloads WHERE id = ? LIMIT 1', [downloadId]);
  if (!download || !Number(download.is_active)) throw new ApiError('Файл недоступен');
  if (!downloadFileExists(download.filename)) throw new ApiError('Файл сборки ещё не загружен на сервер');

  const fresh = await queryOne('SELECT sub_to, banned FROM users WHERE id = ? LIMIT 1', [user.id]);
  if (Number(fresh.banned)) throw new ApiError('Аккаунт заблокирован', 403);
  const subActive = fresh.sub_to && new Date(`${String(fresh.sub_to).replace(' ', 'T')}Z`).getTime() > Date.now();
  if (!subActive && !Number(user.dev)) throw new ApiError('Требуется активная подписка', 403);

  const token = randomToken(32);
  const expiresAt = sqlDate(Date.now() + downloadTokenTtlMs());

  await execute(
    `INSERT INTO download_tokens (token, user_id, download_id, ip, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [token, user.id, downloadId, clientIp(req), userAgent(req), expiresAt],
  );

  // housekeeping
  await execute("DELETE FROM download_tokens WHERE expires_at < UTC_TIMESTAMP() - INTERVAL 1 DAY");

  return { success: true, status: 'success', message: 'Ссылка готова', data: { token, expires_at: expiresAt } };
}

// ---------------------------------------------------------------------------
// Redeem
// ---------------------------------------------------------------------------

export async function redeem_key({ body, user, req }) {
  const settings = await getSettings();
  const cooldownMinutes = Math.max(1, settingInt(settings, 'redeem_cooldown_minutes', 60));
  const keyCode = validators.keyCode(body.key_code);
  const ip = clientIp(req);

  const fresh = await queryOne('SELECT sub_to, banned FROM users WHERE id = ? LIMIT 1', [user.id]);
  if (Number(fresh.banned)) throw new ApiError('Аккаунт заблокирован', 403);

  const subActive = fresh.sub_to && new Date(`${String(fresh.sub_to).replace(' ', 'T')}Z`).getTime() > Date.now();
  if (subActive) throw new ApiError('У вас уже есть активная подписка');

  // 1 attempt per hour, counted on the server
  const lastAttempt = await queryOne(
    'SELECT created_at FROM redeem_attempts WHERE user_id = ? ORDER BY id DESC LIMIT 1',
    [user.id],
  );
  if (lastAttempt) {
    const elapsed = Date.now() - new Date(`${String(lastAttempt.created_at).replace(' ', 'T')}Z`).getTime();
    if (elapsed < cooldownMinutes * 60000) {
      const minutes = Math.ceil((cooldownMinutes * 60000 - elapsed) / 60000);
      throw new ApiError(`Слишком много попыток. Следующая через ${minutes} мин.`);
    }
  }

  await execute('INSERT INTO redeem_attempts (user_id, ip) VALUES (?, ?)', [user.id, ip]);

  const key = await queryOne('SELECT * FROM license_keys WHERE key_code = ? LIMIT 1', [keyCode]);
  if (!key) throw new ApiError('Ключ не найден');
  if (Number(key.is_disabled)) throw new ApiError('Ключ отключён');
  if (key.used_by) throw new ApiError('Ключ уже использован');

  const sub = await queryOne('SELECT * FROM subscriptions WHERE id = ? LIMIT 1', [key.sub_id]);
  if (!sub) throw new ApiError('План по ключу больше не существует');

  const days = key.days_override ? Number(key.days_override) : Number(sub.sub_days);
  const plan = publicSubscription(sub);
  const subTo = nextSubTo(null, days);

  await transaction(async (conn) => {
    await conn.execute('UPDATE users SET sub_id = ?, sub_to = ? WHERE id = ?', [sub.id, subTo, user.id]);
    await conn.execute(
      'UPDATE license_keys SET used_by = ?, used_at = UTC_TIMESTAMP(), used_ip = ? WHERE id = ? AND used_by IS NULL',
      [user.id, ip, key.id],
    );
    await conn.execute('UPDATE subscriptions SET subs_value = subs_value + 1 WHERE id = ?', [sub.id]);
    await conn.execute(
      `INSERT INTO orders (user_id, sub_id, sub_name, days, amount, discount, method, status)
       VALUES (?, ?, ?, ?, 0, ?, 'key', 'paid')`,
      [user.id, sub.id, sub.name, days, plan.discount],
    );
  });

  return {
    success: true,
    status: 'success',
    message: `Подписка ${sub.name} активирована на ${days} дн.`,
    data: { sub_id: sub.id, sub_to: subTo, days },
  };
}

// ---------------------------------------------------------------------------
// Settings (public legal texts)
// ---------------------------------------------------------------------------

export async function settings_get() {
  const settings = await getSettings();
  return { success: true, status: 'success', message: 'OK', data: { settings } };
}

export default {
  tickets_list,
  ticket_get,
  ticket_create,
  ticket_reply,
  downloads_list,
  download_token,
  redeem_key,
  settings_get,
};
