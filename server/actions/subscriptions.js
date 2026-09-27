import { execute, query, queryOne, transaction } from '../db.js';
import { isDev } from '../auth.js';
import { getSettings } from '../settings-store.js';
import { ApiError, nextSubTo, publicSubscription, validators } from '../helpers.js';

export async function subs_list({ user }) {
  // devs get every plan (including hidden) so the admin table can edit them
  let rows;
  try {
    rows = isDev(user)
      ? await query('SELECT * FROM subscriptions ORDER BY sort_order ASC, id ASC')
      : await query('SELECT * FROM subscriptions WHERE is_visible = 1 ORDER BY sort_order ASC, id ASC');
  } catch {
    rows = isDev(user)
      ? await query('SELECT * FROM subs ORDER BY sort_order ASC, id ASC')
      : await query('SELECT * FROM subs WHERE is_visible = 1 ORDER BY sort_order ASC, id ASC');
  }

  return {
    success: true,
    status: 'success',
    message: 'OK',
    data: { subs: rows.map(publicSubscription) },
  };
}

/**
 * Creates an order for the chosen plan.
 *  - enough balance  -> paid instantly from the internal balance
 *  - otherwise       -> `pending` order, a dev confirms it in the admin panel
 *  - free plans      -> granted immediately
 */
export async function sub_buy({ body, user }) {
  const subId = validators.id(body.sub_id, { field: 'плана' });

  let sub;
  try {
    sub = await queryOne('SELECT * FROM subscriptions WHERE id = ? LIMIT 1', [subId]);
  } catch {
    sub = await queryOne('SELECT * FROM subs WHERE id = ? LIMIT 1', [subId]);
  }
  if (!sub) throw new ApiError('План не найден');
  if (!Number(sub.is_visible) && !isDev(user)) throw new ApiError('План недоступен');

  const plan = publicSubscription(sub);
  const finalCost = Number(plan.final_cost ?? plan.finalCost ?? plan.cost ?? 0);
  const discount = Number(plan.discount ?? 0);
  const settings = await getSettings();
  const current = await queryOne('SELECT sub_to, balance FROM users WHERE id = ? LIMIT 1', [user.id]);

  if (finalCost === 0) {
    const subTo = nextSubTo(current.sub_to, sub.sub_days);
    await transaction(async (conn) => {
      await conn.execute('UPDATE users SET sub_id = ?, sub_to = ? WHERE id = ?', [sub.id, subTo, user.id]);
      await conn.execute('UPDATE subscriptions SET subs_value = subs_value + 1 WHERE id = ?', [sub.id]);
      await conn.execute(
        `INSERT INTO orders (user_id, sub_id, sub_name, days, amount, discount, method, status)
         VALUES (?, ?, ?, ?, ?, ?, 'manual', 'paid')`,
        [user.id, sub.id, sub.name, sub.sub_days, 0, discount],
      );
    });
    return { success: true, status: 'success', message: 'Подписка активирована бесплатно', data: { sub_to: subTo } };
  }

  const balance = Number(current.balance ?? 0);
  if (balance >= finalCost) {
    const subTo = nextSubTo(current.sub_to, sub.sub_days);
    await transaction(async (conn) => {
      await conn.execute('UPDATE users SET balance = balance - ?, sub_id = ?, sub_to = ? WHERE id = ?', [
        finalCost,
        sub.id,
        subTo,
        user.id,
      ]);
      await conn.execute('UPDATE subscriptions SET subs_value = subs_value + 1 WHERE id = ?', [sub.id]);
      await conn.execute(
        `INSERT INTO orders (user_id, sub_id, sub_name, days, amount, discount, method, status)
         VALUES (?, ?, ?, ?, ?, ?, 'balance', 'paid')`,
        [user.id, sub.id, sub.name, sub.sub_days, finalCost, discount],
      );
    });
    return {
      success: true,
      status: 'success',
      message: 'Подписка оплачена с баланса',
      data: { sub_to: subTo, order_status: 'paid' },
    };
  }

  const pending = await queryOne(
    "SELECT id FROM orders WHERE user_id = ? AND sub_id = ? AND status = 'pending' LIMIT 1",
    [user.id, sub.id],
  );
  if (pending) throw new ApiError(`Заказ #${pending.id} по этому тарифу уже ожидает подтверждения`);

  const result = await execute(
    `INSERT INTO orders (user_id, sub_id, sub_name, days, amount, discount, method, status)
     VALUES (?, ?, ?, ?, ?, ?, 'external', 'pending')`,
    [user.id, sub.id, sub.name, sub.sub_days, finalCost, discount],
  );

  return {
    success: true,
    status: 'success',
    message: `Создан заказ #${result.insertId} на ${finalCost.toFixed(2)} $. Ожидайте подтверждения${settings.site_name ? ` (${settings.site_name})` : ''}`,
    data: { order_id: result.insertId, order_status: 'pending', amount: finalCost },
  };
}

export default { subs_list, sub_buy };
