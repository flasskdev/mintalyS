import { execute, queryOne } from '../db.js';
import { USER_COLUMNS } from '../auth.js';
import { getSettings, settingInt } from '../settings-store.js';
import {
  ApiError,
  clientIp,
  hashPassword,
  nowSql,
  publicUser,
  validators,
  verifyPassword,
} from '../helpers.js';

export async function profile({ user }) {
  const fresh = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [user.id]);
  return { success: true, status: 'success', message: 'OK', data: { user: publicUser(fresh) } };
}

export async function name_change({ body, user }) {
  const name = validators.name(body.name);
  if (name === user.name) throw new ApiError('Никнейм не изменился');

  const taken = await queryOne('SELECT id FROM users WHERE name = ? AND id <> ? LIMIT 1', [name, user.id]);
  if (taken) throw new ApiError('Этот никнейм уже занят');

  await execute('UPDATE users SET name = ? WHERE id = ?', [name, user.id]);
  const fresh = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [user.id]);

  return { success: true, status: 'success', message: 'Никнейм обновлён', data: { user: publicUser(fresh) } };
}

export async function password_change({ body, user }) {
  const currentPassword = String(body.current_password ?? '');
  const newPassword = validators.password(body.new_password);

  const fresh = await queryOne('SELECT password, token FROM users WHERE id = ? LIMIT 1', [user.id]);
  if (!verifyPassword(currentPassword, fresh.password)) {
    throw new ApiError('Текущий пароль указан неверно');
  }
  if (currentPassword === newPassword) {
    throw new ApiError('Новый пароль совпадает с текущим');
  }

  // rotating the token forces other sessions to sign in again
  await execute('UPDATE users SET password = ?, token = NULL WHERE id = ?', [hashPassword(newPassword), user.id]);

  return { success: true, status: 'success', message: 'Пароль изменён. Войдите заново', reauth: true };
}

/** HWID reset — once per `hwid_reset_days` (default 30). */
export async function hwid_reset({ user }) {
  const settings = await getSettings();
  const cooldownDays = Math.max(1, settingInt(settings, 'hwid_reset_days', 30));

  const last = user.hwid_reset_at ? new Date(`${String(user.hwid_reset_at).replace(' ', 'T')}Z`).getTime() : 0;
  if (last && Date.now() - last < cooldownDays * 86400000) {
    const next = new Date(last + cooldownDays * 86400000);
    throw new ApiError(`Сброс HWID доступен раз в ${cooldownDays} дн. Следующий: ${next.toISOString().slice(0, 10)}`);
  }

  await execute(
    'UPDATE users SET hwid = NULL, hwid_reset_at = ?, hwid_reset_count = hwid_reset_count + 1 WHERE id = ?',
    [nowSql(), user.id],
  );

  const fresh = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [user.id]);
  return {
    success: true,
    status: 'success',
    message: 'HWID сброшен. Он привяжется заново при следующем входе',
    data: { user: publicUser(fresh) },
  };
}

/** Called by the launcher to check the current session + subscription. */
export async function session_check({ user, req }) {
  const ip = clientIp(req);
  const hwid = validators.hwid(req.body?.hwid ?? req.headers['x-hwid']);

  if (hwid && user.hwid && user.hwid !== hwid) {
    throw new ApiError('HWID не совпадает', 403);
  }
  if (hwid && !user.hwid) {
    await execute('UPDATE users SET hwid = ? WHERE id = ?', [hwid, user.id]);
  }

  const fresh = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [user.id]);
  return { success: true, status: 'success', message: 'OK', data: { user: publicUser(fresh), ip } };
}

export default { profile, name_change, password_change, hwid_reset, session_check };
