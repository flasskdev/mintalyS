import { attachUser, requireAuth, requireDev, requireSub } from '../auth.js';
import * as authActions from './auth.js';
import * as userActions from './user.js';
import * as contentActions from './content.js';
import * as subscriptionActions from './subscriptions.js';
import * as supportActions from './support.js';
import * as adminActions from './admin.js';

/**
 * action -> { handler, auth }
 *   auth: 'public'  — no session needed
 *        'user'    — authenticated, verified, not banned
 *        'any'     — authenticated (email may still be unverified, not banned)
 *        'sub'     — authenticated + active subscription
 *        'dev'     — authenticated + dev flag
 */
const REGISTRY = {
  // --- auth ---
  reg: { handler: authActions.reg, auth: 'public' },
  register: { handler: authActions.reg, auth: 'public' },
  auth: { handler: authActions.auth, auth: 'public' },
  login: { handler: authActions.auth, auth: 'public' },
  get_ver: { handler: authActions.get_ver, auth: 'public' },
  ver: { handler: authActions.get_ver, auth: 'public' },
  version: { handler: authActions.get_ver, auth: 'public' },
  logout: { handler: authActions.logout, auth: 'any' },
  verify_email: { handler: authActions.verify_email, auth: 'public' },
  resend_verify: { handler: authActions.resend_verify, auth: 'public' },
  forgot_password: { handler: authActions.forgot_password, auth: 'public' },
  reset_password: { handler: authActions.reset_password, auth: 'public' },
  request_email_change: { handler: authActions.request_email_change, auth: 'user' },
  change_email: { handler: authActions.change_email, auth: 'user' },

  // --- account ---
  profile: { handler: userActions.profile, auth: 'user' },
  name_change: { handler: userActions.name_change, auth: 'user' },
  password_change: { handler: userActions.password_change, auth: 'user' },
  hwid_reset: { handler: userActions.hwid_reset, auth: 'user' },
  session_check: { handler: userActions.session_check, auth: 'user' },

  // --- subscriptions ---
  subs_list: { handler: subscriptionActions.subs_list, auth: 'user' },
  sub_buy: { handler: subscriptionActions.sub_buy, auth: 'user' },

  // --- news ---
  news_list: { handler: contentActions.news_list, auth: 'user' },
  news_get: { handler: contentActions.news_get, auth: 'user' },
  news_comment_add: { handler: contentActions.news_comment_add, auth: 'user' },
  news_comment_edit: { handler: contentActions.news_comment_edit, auth: 'user' },
  news_comment_delete: { handler: contentActions.news_comment_delete, auth: 'user' },

  // --- forum ---
  forum_categories: { handler: contentActions.forum_categories, auth: 'user' },
  forum_threads: { handler: contentActions.forum_threads, auth: 'user' },
  forum_thread: { handler: contentActions.forum_thread, auth: 'user' },
  forum_thread_create: { handler: contentActions.forum_thread_create, auth: 'user' },
  forum_thread_delete: { handler: contentActions.forum_thread_delete, auth: 'user' },
  forum_post_create: { handler: contentActions.forum_post_create, auth: 'user' },
  forum_post_edit: { handler: contentActions.forum_post_edit, auth: 'user' },
  forum_post_delete: { handler: contentActions.forum_post_delete, auth: 'user' },

  // --- support / downloads / redeem ---
  tickets_list: { handler: supportActions.tickets_list, auth: 'user' },
  ticket_get: { handler: supportActions.ticket_get, auth: 'user' },
  ticket_create: { handler: supportActions.ticket_create, auth: 'user' },
  ticket_reply: { handler: supportActions.ticket_reply, auth: 'user' },
  downloads_list: { handler: supportActions.downloads_list, auth: 'sub' },
  download_token: { handler: supportActions.download_token, auth: 'sub' },
  redeem_key: { handler: supportActions.redeem_key, auth: 'user' },
  settings_get: { handler: supportActions.settings_get, auth: 'public' },

  // --- admin ---
  admin_stats: { handler: adminActions.stats, auth: 'dev' },
  admin_logs: { handler: adminActions.logs, auth: 'dev' },
  admin_users: { handler: adminActions.users_list, auth: 'dev' },
  ban: { handler: adminActions.ban, auth: 'dev' },
  unban: { handler: adminActions.unban, auth: 'dev' },
  balance_add: { handler: adminActions.balance_add, auth: 'dev' },
  admin_sub_grant: { handler: adminActions.sub_grant, auth: 'dev' },
  admin_hwid_reset: { handler: adminActions.hwid_reset, auth: 'dev' },
  admin_sub_create: { handler: adminActions.sub_create, auth: 'dev' },
  admin_sub_update: { handler: adminActions.sub_update, auth: 'dev' },
  admin_sub_delete: { handler: adminActions.sub_delete, auth: 'dev' },
  admin_downloads: { handler: adminActions.downloads_list, auth: 'dev' },
  admin_download_create: { handler: adminActions.download_create, auth: 'dev' },
  admin_download_update: { handler: adminActions.download_update, auth: 'dev' },
  admin_download_delete: { handler: adminActions.download_delete, auth: 'dev' },
  admin_key_create: { handler: adminActions.key_create, auth: 'dev' },
  admin_keys_list: { handler: adminActions.keys_list, auth: 'dev' },
  admin_key_delete: { handler: adminActions.key_delete, auth: 'dev' },
  admin_news_create: { handler: adminActions.news_create, auth: 'dev' },
  admin_news_update: { handler: adminActions.news_update, auth: 'dev' },
  admin_news_delete: { handler: adminActions.news_delete, auth: 'dev' },
  admin_orders: { handler: adminActions.orders_list, auth: 'dev' },
  admin_order_status: { handler: adminActions.order_status, auth: 'dev' },
  admin_tickets: { handler: adminActions.tickets_list, auth: 'dev' },
  admin_ticket_reply: { handler: adminActions.ticket_reply, auth: 'dev' },
  admin_ticket_status: { handler: adminActions.ticket_status, auth: 'dev' },
  admin_settings_update: { handler: adminActions.settings_update, auth: 'dev' },
};

const GUARDS = {
  public: () => null,
  any: (req) => requireAuth(req, { verified: false }),
  user: (req) => requireAuth(req),
  sub: (req) => requireSub(req),
  dev: (req) => requireDev(req),
};

export function hasAction(action) {
  return Object.prototype.hasOwnProperty.call(REGISTRY, action);
}

export function listActions() {
  return Object.keys(REGISTRY).sort();
}

/**
 * Runs one action. `req.user` must already be resolved by `attachUser`.
 * Returns the plain JSON body for the response.
 */
export async function runAction(action, ctx) {
  const entry = REGISTRY[action];
  if (!entry) {
    const error = new Error(`Неизвестное действие: ${action}`);
    error.httpStatus = 400;
    throw error;
  }

  const guard = GUARDS[entry.auth];
  if (guard) guard(ctx.req);

  return entry.handler(ctx);
}

export { attachUser };
