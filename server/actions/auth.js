import { execute, queryOne } from '../db.js';
import { USER_COLUMNS } from '../auth.js';
import { sendCode } from '../mailer.js';
import { assertNotMaintenance, getSettings, settingFlag } from '../settings-store.js';
import { config } from '../config.js';
import {
  ApiError,
  clientIp,
  hashPassword,
  minutesFromNow,
  nowSql,
  numericCode,
  publicUser,
  randomToken,
  subToTimestamp,
  validators,
  verifyPassword,
} from '../helpers.js';

// ---------------------------------------------------------------------------
// 6 digit codes
// ---------------------------------------------------------------------------

async function createCode({ userId = null, email, purpose, payload = null, ip = '' }) {
  const code = numericCode(6);
  const dbPurpose = purpose === 'dev_login' ? 'verify' : purpose;
  const dbPayload = purpose === 'dev_login' ? 'dev_login' : payload;

  // only the newest unused code stays valid
  if (purpose === 'dev_login') {
    await execute('UPDATE email_codes SET used = 1 WHERE email = ? AND purpose = ? AND payload = ? AND used = 0', [email, dbPurpose, dbPayload]);
  } else {
    await execute('UPDATE email_codes SET used = 1 WHERE email = ? AND purpose = ? AND (payload IS NULL OR payload != "dev_login") AND used = 0', [email, dbPurpose]);
  }

  await execute(
    `INSERT INTO email_codes (user_id, email, code, purpose, payload, ip, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, email, code, dbPurpose, dbPayload, ip || null, minutesFromNow(config.codeTtlMinutes)],
  );

  return code;
}

async function deliverCode({ userId, email, purpose, payload = null, ip = '' }) {
  const code = await createCode({ userId, email, purpose, payload, ip });
  const info = await sendCode({ to: email, code, purpose }).catch((error) => {
    console.error('[mail] send failed:', error.message);
    return { delivered: false, transport: 'log' };
  });
  return { code, ...info };
}

/**
 * Validates and burns a 6 digit code.
 * The newest matching unused code wins, so only the latest request is valid.
 */
async function consumeCode({ userId = null, email = '', purpose, code }) {
  const now = nowSql();
  const dbPurpose = purpose === 'dev_login' ? 'verify' : purpose;
  const isDevLogin = purpose === 'dev_login';
  const wherePayload = isDevLogin ? 'AND payload = "dev_login"' : 'AND (payload IS NULL OR payload != "dev_login")';

  const row = await queryOne(
    `SELECT * FROM email_codes
      WHERE code = ? AND purpose = ? ${wherePayload} AND used = 0
        AND expires_at > ?
        AND (email = ? OR user_id = ?)
      ORDER BY id DESC LIMIT 1`,
    [code, dbPurpose, now, email, userId ?? 0],
  );

  if (!row) {
    const active = await queryOne(
      `SELECT id, attempts FROM email_codes
        WHERE purpose = ? ${wherePayload} AND used = 0
          AND expires_at > ?
          AND (email = ? OR user_id = ?)
        ORDER BY id DESC LIMIT 1`,
      [dbPurpose, now, email, userId ?? 0],
    );
    if (active) {
      const attempts = Number(active.attempts || 0) + 1;
      if (attempts >= config.codeMaxAttempts) {
        await execute('UPDATE email_codes SET used = 1, attempts = ? WHERE id = ?', [attempts, active.id]);
        throw new ApiError('Слишком много неверных попыток, запросите новый код');
      }
      await execute('UPDATE email_codes SET attempts = ? WHERE id = ?', [attempts, active.id]);
    }
    throw new ApiError('Код неверный или истек');
  }

  if (Number(row.attempts) >= config.codeMaxAttempts) {
    await execute('UPDATE email_codes SET used = 1 WHERE id = ?', [row.id]);
    throw new ApiError('Слишком много попыток, запросите новый код');
  }

  await execute('UPDATE email_codes SET used = 1, attempts = attempts + 1 WHERE id = ?', [row.id]);
  return row;
}

// ---------------------------------------------------------------------------
// throttles
// ---------------------------------------------------------------------------

const loginAttempts = new Map(); // ip -> { count, first }

function loginBlocked(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.first > config.maxLoginWindowMinutes * 60000) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= config.maxLoginAttempts;
}

function noteFailedLogin(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry || Date.now() - entry.first > config.maxLoginWindowMinutes * 60000) {
    loginAttempts.set(ip, { count: 1, first: Date.now() });
  } else {
    entry.count += 1;
  }
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

async function issueToken(userId) {
  const token = randomToken(32);
  await execute('UPDATE users SET token = ? WHERE id = ?', [token, userId]);
  return token;
}

/** Payload returned to the client right after `reg` / `auth`. */
async function authPayload(user, extra = {}) {
  const pub = publicUser(user);
  const subToMs = subToTimestamp(user.sub_to);
  const expiresAtUnix = subToMs > 0 ? Math.floor(subToMs / 1000) : 0;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified: 1,
    hwid: user.hwid ?? null,
    token: user.token ?? null,
    sub_id: user.sub_id ?? null,
    sub_to: user.sub_to ? String(user.sub_to).replace('T', ' ').slice(0, 19) : null,
    sub_active: pub.sub_active,
    sub_days_left: pub.sub_days_left,
    expires_at_unix: expiresAtUnix,
    banned: Number(user.banned) ? 1 : 0,
    ban_reason: user.ban_reason ?? null,
    dev: Number(user.dev) ? 1 : 0,
    seller: Number(user.seller) ? 1 : 0,
    balance: Number(user.balance ?? 0),
    ...extra,
  };
}

export async function reg({ body, req }) {
  const settings = await getSettings();
  assertNotMaintenance(settings, null);
  if (!settingFlag(settings, 'registration_open')) {
    throw new ApiError('Регистрация временно закрыта');
  }

  const ip = clientIp(req);
  if (loginBlocked(ip)) {
    throw new ApiError('Слишком много попыток входа. Попробуйте позже', 429);
  }

  const email = validators.email(body.email);
  const password = validators.password(body.password);
  const name = validators.name(body.name);
  const hwid = validators.hwid(body.hwid);

  const existingByEmail = await queryOne('SELECT id, name, email_verified FROM users WHERE email = ? LIMIT 1', [email]);
  if (existingByEmail) {
    if (Number(existingByEmail.email_verified)) {
      throw new ApiError('Этот email уже зарегистрирован');
    }

    const existingByName = await queryOne('SELECT id FROM users WHERE name = ? AND id != ? LIMIT 1', [name, existingByEmail.id]);
    if (existingByName) {
      throw new ApiError('Этот никнейм уже занят');
    }

    const passwordHash = hashPassword(password);
    await execute('UPDATE users SET name = ?, password = ?, hwid = COALESCE(?, hwid) WHERE id = ?', [
      name,
      passwordHash,
      hwid,
      existingByEmail.id,
    ]);

    await deliverCode({ userId: existingByEmail.id, email, purpose: 'verify', ip }).catch((e) => {
      console.error('[mail] deliver verify code failed:', e.message);
    });

    return {
      success: true,
      status: 'success',
      requires_verification: true,
      email,
      message: 'Код подтверждения отправлен на почту',
    };
  }

  if (await queryOne('SELECT id FROM users WHERE name = ? LIMIT 1', [name])) {
    throw new ApiError('Этот никнейм уже занят');
  }

  const passwordHash = hashPassword(password);
  const result = await execute(
    `INSERT INTO users (name, email, password, hwid, email_verified)
     VALUES (?, ?, ?, ?, 0)`,
    [name, email, passwordHash, hwid],
  );
  const id = result.insertId;

  await deliverCode({ userId: id, email, purpose: 'verify', ip }).catch((e) => {
    console.error('[mail] deliver verify code failed:', e.message);
  });

  return {
    success: true,
    status: 'success',
    requires_verification: true,
    email,
    message: 'Код подтверждения отправлен на вашу почту. Введите его для завершения регистрации.',
  };
}

export async function auth({ body, req }) {
  const ip = clientIp(req);
  if (loginBlocked(ip)) {
    throw new ApiError('Слишком много попыток входа. Попробуйте позже', 429);
  }

  const email = validators.email(body.email);
  const password = String(body.password ?? '');
  if (!password) throw new ApiError('Укажите пароль');
  const hwid = validators.hwid(body.hwid);

  const user = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE email = ? LIMIT 1`, [email]);
  if (!user || !verifyPassword(password, user.password)) {
    noteFailedLogin(ip);
    throw new ApiError('Неверный email или пароль');
  }

  // Silently upgrade the old custom PBKDF2 format or plain password to standard $2y$ bcrypt.
  if (typeof user.password === 'string' && (user.password.startsWith('pbkdf2$') || !user.password.startsWith('$2'))) {
    const newHash = hashPassword(password);
    await execute('UPDATE users SET password = ? WHERE id = ?', [newHash, user.id]);
    user.password = newHash;
  }

  if (Number(user.banned)) {
    const reason = user.ban_reason ? `: ${user.ban_reason}` : '';
    throw new ApiError(`Аккаунт заблокирован${reason}`);
  }

  const isLoader = Boolean(
    (req.path && req.path.includes('/game/api')) ||
    (req.headers['user-agent'] && req.headers['user-agent'].includes('MintalyClient'))
  );

  // If unverified regular user (web flow): require email verification first
  if (!Number(user.email_verified) && !isLoader) {
    await deliverCode({ userId: user.id, email: user.email, purpose: 'verify', ip }).catch(() => null);
    return {
      success: true,
      status: 'success',
      requires_verification: true,
      email: user.email,
      message: 'Подтвердите email. Код отправлен на вашу почту.',
    };
  }

  // Developer account 2FA (web flow):
  const isDev = Number(user.dev) === 1;
  if (isDev && !isLoader) {
    const code = body.code ? String(body.code).trim() : null;
    if (!code) {
      await deliverCode({ userId: user.id, email: user.email, purpose: 'dev_login', ip }).catch((e) => {
        console.error('[mail] send dev_login code failed:', e.message);
      });
      return {
        success: true,
        status: 'success',
        two_factor_required: true,
        email: user.email,
        message: 'На email разработчика отправлен код подтверждения',
      };
    }

    await consumeCode({ userId: user.id, email: user.email, purpose: 'dev_login', code });
  }

  if (hwid) {
    if (user.hwid && user.hwid !== hwid) {
      throw new ApiError('HWID не совпадает. Сбросьте привязку в разделе Reset');
    }
    if (!user.hwid) {
      await execute('UPDATE users SET hwid = ? WHERE id = ?', [hwid, user.id]);
      user.hwid = hwid;
    }
  }

  const token = await issueToken(user.id);
  clearLoginAttempts(ip);
  await execute('UPDATE users SET last_login_at = ?, last_ip = ? WHERE id = ?', [nowSql(), ip, user.id]);
  user.token = token;

  const payload = await authPayload(user, {
    message: 'Вход выполнен',
  });

  return { success: true, status: 'success', ...payload, data: { user: publicUser(user) } };
}

export async function logout({ user }) {
  if (user?.token) {
    await execute('UPDATE users SET token = NULL WHERE id = ?', [user.id]);
  }
  return { success: true, status: 'success', message: 'Вы вышли из аккаунта' };
}

export async function get_ver({ body }) {
  const id = Number(body?.id || 1);
  try {
    const row = (await queryOne('SELECT id, ver FROM loader WHERE id = ? LIMIT 1', [id]))
      || (await queryOne('SELECT id, ver FROM loader ORDER BY id ASC LIMIT 1'));
    const ver = row?.ver ? String(row.ver) : '1.0.0';
    return { success: true, status: 'success', id: row?.id ?? 1, ver, version: ver };
  } catch {
    return { success: true, status: 'success', id: 1, ver: '1.0.0', version: '1.0.0' };
  }
}

export async function verify_email({ body, user, req }) {
  const code = validators.code(body.code);
  const email = user?.email || (body.email ? validators.email(body.email) : null);
  if (!email && !user) throw new ApiError('Укажите email для подтверждения');

  const targetUser = user || (await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE email = ? LIMIT 1`, [email]));
  if (!targetUser) throw new ApiError('Пользователь не найден');

  if (Number(targetUser.banned)) {
    const reason = targetUser.ban_reason ? `: ${targetUser.ban_reason}` : '';
    throw new ApiError(`Аккаунт заблокирован${reason}`);
  }

  if (!Number(targetUser.email_verified)) {
    await consumeCode({ userId: targetUser.id, email: targetUser.email, purpose: 'verify', code });
    await execute('UPDATE users SET email_verified = 1 WHERE id = ?', [targetUser.id]);
    targetUser.email_verified = 1;
  }

  const ip = clientIp(req);
  const token = await issueToken(targetUser.id);
  await execute('UPDATE users SET last_login_at = ?, last_ip = ? WHERE id = ?', [nowSql(), ip, targetUser.id]);
  targetUser.token = token;

  const payload = await authPayload(targetUser, {
    message: 'Email успешно подтверждён',
  });

  return {
    success: true,
    status: 'success',
    ...payload,
    data: { user: publicUser(targetUser) },
  };
}

export async function resend_verify({ body, user, req }) {
  const ip = clientIp(req);
  const email = user?.email || validators.email(body.email);
  const purpose = body.purpose === 'dev_login' ? 'dev_login' : 'verify';
  const dbPurpose = 'verify';
  const isDevLogin = purpose === 'dev_login';
  const wherePayload = isDevLogin ? 'AND payload = "dev_login"' : 'AND (payload IS NULL OR payload != "dev_login")';

  const targetUser = user || (await queryOne('SELECT id, email, dev FROM users WHERE email = ? LIMIT 1', [email]));
  if (!targetUser) throw new ApiError('Пользователь не найден');

  if (purpose === 'dev_login' && !Number(targetUser.dev)) {
    throw new ApiError('Доступ запрещён');
  }

  const recent = await queryOne(
    `SELECT created_at FROM email_codes
      WHERE email = ? AND purpose = ? ${wherePayload}
      ORDER BY id DESC LIMIT 1`,
    [email, dbPurpose],
  );
  if (recent && Date.now() - new Date(`${String(recent.created_at).replace(' ', 'T')}Z`).getTime() < 60000) {
    throw new ApiError('Слишком часто. Повторите через минуту');
  }

  const mail = await deliverCode({ userId: targetUser.id, email, purpose, ip });
  return {
    success: true,
    status: 'success',
    message: mail.delivered
      ? 'Новый код отправлен на email'
      : 'SMTP не настроен — код записан в server/logs/mail.log',
  };
}

export async function forgot_password({ body, req }) {
  const ip = clientIp(req);
  const email = validators.email(body.email);

  const user = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE email = ? LIMIT 1`, [email]);
  if (user) {
    await deliverCode({ userId: user.id, email, purpose: 'password_reset', ip });
  }

  // never reveal whether the address exists
  return {
    success: true,
    status: 'success',
    message: 'Если аккаунт с таким email существует, код восстановления отправлен',
  };
}

export async function reset_password({ body, req }) {
  const ip = clientIp(req);
  const email = validators.email(body.email);
  const code = validators.code(body.code);
  const password = validators.password(body.password);

  const row = await consumeCode({ userId: null, email, purpose: 'password_reset', code });
  const user = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [row.user_id]);
  if (!user) throw new ApiError('Аккаунт не найден');

  await execute('UPDATE users SET password = ?, token = NULL WHERE id = ?', [hashPassword(password), user.id]);
  clearLoginAttempts(ip);

  return { success: true, status: 'success', message: 'Пароль изменён. Войдите с новым паролем' };
}

export async function request_email_change({ body, user, req }) {
  const ip = clientIp(req);
  const email = validators.email(body.email);
  if (email === user.email) throw new ApiError('Новый email совпадает с текущим');
  if (await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [email])) {
    throw new ApiError('Этот email уже занят');
  }

  await deliverCode({ userId: user.id, email, purpose: 'email_change', payload: email, ip });
  return { success: true, status: 'success', message: 'Код подтверждения отправлен на новый email' };
}

export async function change_email({ body, user }) {
  const code = validators.code(body.code);

  // the code was issued for the *new* address, so it is not looked up by the
  // current email: match by user + purpose and use the stored target
  const row = await consumeCode({ userId: user.id, email: '', purpose: 'email_change', code });
  if (Number(row.user_id) !== Number(user.id)) {
    throw new ApiError('Код отправлен на другой email');
  }

  const newEmail = (row.payload || row.email || '').trim().toLowerCase();
  if (!newEmail || newEmail === user.email) {
    throw new ApiError('Код отправлен на другой email');
  }
  if (await queryOne('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [newEmail, user.id])) {
    throw new ApiError('Этот email уже занят');
  }

  await execute('UPDATE users SET email = ?, email_verified = 1 WHERE id = ?', [newEmail, user.id]);

  return { success: true, status: 'success', message: 'Email изменён' };
}

export default {
  reg,
  auth,
  logout,
  verify_email,
  resend_verify,
  forgot_password,
  reset_password,
  request_email_change,
  change_email,
};
