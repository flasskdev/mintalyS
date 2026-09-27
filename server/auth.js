import { queryOne } from './db.js';
import { bearerToken, clientIp, publicUser } from './helpers.js';

export const USER_COLUMNS = `
  id, name, email, password, email_verified, hwid, hwid_reset_at, hwid_reset_count,
  sub_id, sub_to, banned, ban_reason, banned_at, dev, seller, forum_banned,
  balance, token, last_login_at, last_ip, created_at, updated_at
`;

/** Loads the user behind the `Authorization: Bearer <token>` header. */
export async function resolveUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const row = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE token = ? LIMIT 1`, [token]);
  return row ?? null;
}

/**
 * Attaches `req.user` when a valid token is present.
 * A banned user keeps the session object so pages can render the ban notice,
 * but every mutating action is rejected by `requireAuth`.
 */
export async function attachUser(req, _res, next) {
  try {
    req.user = await resolveUser(req);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Requires an authenticated, non-banned user.
 * Pass `{ verified: false }` while the user still has to confirm the email.
 */
export function requireAuth(req, { verified = true } = {}) {
  if (!req.user) {
    const error = new Error('Требуется авторизация');
    error.httpStatus = 401;
    throw error;
  }
  if (Number(req.user.banned)) {
    const reason = req.user.ban_reason ? `: ${req.user.ban_reason}` : '';
    const error = new Error(`Аккаунт заблокирован${reason}`);
    error.httpStatus = 403;
    error.code = 'banned';
    throw error;
  }
  return req.user;
}

/** Requires an authenticated, verified, non-banned user with an active sub. */
export function requireSub(req) {
  const user = requireAuth(req);
  if (!user.sub_to || new Date(`${String(user.sub_to).replace(' ', 'T')}Z`).getTime() <= Date.now()) {
    const error = new Error('Требуется активная подписка');
    error.httpStatus = 403;
    error.code = 'no_subscription';
    throw error;
  }
  return user;
}

/** Requires the `dev` flag. */
export function requireDev(req) {
  const user = requireAuth(req);
  if (!Number(user.dev)) {
    const error = new Error('Недостаточно прав');
    error.httpStatus = 403;
    error.code = 'forbidden';
    throw error;
  }
  return user;
}

export function isDev(user) {
  return !!user && Number(user.dev) === 1;
}

export { clientIp, publicUser };
