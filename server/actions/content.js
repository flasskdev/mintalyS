import { execute, query, queryOne } from '../db.js';
import { isDev } from '../auth.js';
import { getSettings, settingFlag } from '../settings-store.js';
import { ApiError, paginate, validators } from '../helpers.js';

const NEWS_SELECT = `
  SELECT n.id, n.title, n.short_desc, n.content, n.author_id, n.is_pinned,
         n.is_published, n.views, n.created_at, n.updated_at,
         (SELECT COUNT(*) FROM news_comments c WHERE c.news_id = n.id AND c.is_deleted = 0) AS comments_count
    FROM news n
`;
const NEWS_SORT = ' ORDER BY n.is_pinned DESC, n.created_at DESC';

const COMMENT_SELECT = `
  SELECT c.id, c.news_id, c.user_id, c.content, c.is_deleted, c.created_at, c.updated_at,
         u.name AS user_name
    FROM news_comments c
    LEFT JOIN users u ON u.id = c.user_id
`;

// In-memory view deduplication (prevents fake view bumps on reload/comment)
const newsViewMap = new Map();
const threadViewMap = new Map();

function shouldCountView(cache, id, user, ip) {
  const viewerKey = user?.id ? `u:${user.id}` : `ip:${ip || 'unknown'}`;
  const key = `${id}:${viewerKey}`;
  const now = Date.now();
  const last = cache.get(key);
  if (last && now - last < 30 * 60 * 1000) {
    return false;
  }
  cache.set(key, now);
  if (cache.size > 5000) {
    for (const [k, ts] of cache.entries()) {
      if (now - ts > 30 * 60 * 1000) cache.delete(k);
    }
  }
  return true;
}

// In-memory comment flood control (15s cooldown)
const commentFloodMap = new Map();

function checkCommentFlood(user, ip, cooldownSec = 15) {
  if (isDev(user)) return;
  const key = user?.id ? `u:${user.id}` : `ip:${ip || 'unknown'}`;
  const now = Date.now();
  const last = commentFloodMap.get(key);
  if (last && now - last < cooldownSec * 1000) {
    const remaining = Math.ceil((cooldownSec * 1000 - (now - last)) / 1000);
    throw new ApiError(`Подождите ${remaining} сек. перед отправкой следующего комментария (флуд-контроль)`, 429);
  }
}

function recordCommentSent(user, ip) {
  const key = user?.id ? `u:${user.id}` : `ip:${ip || 'unknown'}`;
  commentFloodMap.set(key, Date.now());
}

function toIsoDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  const s = String(val).trim();
  if (!s) return null;
  if (s.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(s)) return s;
  return s.replace(' ', 'T') + 'Z';
}

function isRowEdited(created_at, updated_at) {
  if (!created_at || !updated_at) return false;
  const created = new Date(toIsoDate(created_at)).getTime();
  const updated = new Date(toIsoDate(updated_at)).getTime();
  return updated - created > 2000;
}

function mapComment(row) {
  if (!row) return null;
  return {
    ...row,
    created_at: toIsoDate(row.created_at),
    updated_at: toIsoDate(row.updated_at),
    is_deleted: Number(row.is_deleted) ? 1 : 0,
    is_edited: isRowEdited(row.created_at, row.updated_at),
    user: row.user_id ? { id: row.user_id, name: row.user_name || `User #${row.user_id}` } : null,
  };
}

function mapNews(row) {
  if (!row) return null;
  return {
    ...row,
    is_published: Number(row.is_published) ? 1 : 0,
    is_pinned: Number(row.is_pinned) ? 1 : 0,
    views: Number(row.views ?? 0),
    comments_count: Number(row.comments_count ?? 0),
  };
}

export async function news_list({ body, user }) {
  const page = validators.page(body.page, 1);
  const perPage = validators.perPage(body.per_page, 10, 100);
  const offset = (page - 1) * perPage;

  // devs also see drafts so the admin panel can list everything
  const where = isDev(user) ? '' : 'WHERE n.is_published = 1';

  const rows = await query(`${NEWS_SELECT} ${where} ${NEWS_SORT} LIMIT ? OFFSET ?`, [perPage, offset]);
  const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM news n ${where}`);
  const total = Number(totalRow?.total ?? 0);

  // the card list never needs the full body — devs do, they edit from the list
  const items = rows.map((row) => {
    const item = mapNews(row);
    if (!isDev(user)) item.content = '';
    return item;
  });

  return { success: true, status: 'success', message: 'OK', data: paginate(items, page, perPage, total) };
}

export async function news_get({ body, user, ip }) {
  const id = validators.id(body.id, { field: 'новости' });

  const news = await queryOne(`${NEWS_SELECT} WHERE n.id = ? LIMIT 1`, [id]);
  if (!news) throw new ApiError('Новость не найдена');
  if (!Number(news.is_published) && !isDev(user)) throw new ApiError('Новость не найдена');

  let views = Number(news.views ?? 0);
  if (shouldCountView(newsViewMap, id, user, ip)) {
    await execute('UPDATE news SET views = views + 1 WHERE id = ?', [id]);
    views += 1;
  }

  const comments = await query(`${COMMENT_SELECT} WHERE c.news_id = ? ORDER BY c.created_at ASC`, [id]);

  return {
    success: true,
    status: 'success',
    message: 'OK',
    data: {
      news: { ...mapNews(news), views },
      comments: comments.map(mapComment),
    },
  };
}

export async function news_comment_add({ body, user, ip }) {
  const newsId = validators.id(body.news_id, { field: 'новости' });
  const content = validators.text(body.content, { field: 'Комментарий', min: 1, max: 2000 });

  checkCommentFlood(user, ip, 15);

  const news = await queryOne('SELECT id, is_published FROM news WHERE id = ? LIMIT 1', [newsId]);
  if (!news || (!Number(news.is_published) && !isDev(user))) throw new ApiError('Новость не найдена');

  const result = await execute('INSERT INTO news_comments (news_id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())', [
    newsId,
    user.id,
    content,
  ]);

  recordCommentSent(user, ip);

  const row = await queryOne(`${COMMENT_SELECT} WHERE c.id = ? LIMIT 1`, [result.insertId]);
  return { success: true, status: 'success', message: 'Комментарий добавлен', data: { comment: mapComment(row) } };
}

export async function news_comment_edit({ body, user }) {
  const id = validators.id(body.id, { field: 'комментария' });
  const content = validators.text(body.content, { field: 'Комментарий', min: 1, max: 2000 });

  const row = await queryOne('SELECT user_id, is_deleted FROM news_comments WHERE id = ? LIMIT 1', [id]);
  if (!row) throw new ApiError('Комментарий не найден');
  if (row.user_id !== user.id && !isDev(user)) throw new ApiError('Недостаточно прав');

  await execute('UPDATE news_comments SET content = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [content, id]);
  return { success: true, status: 'success', message: 'Комментарий обновлён' };
}

export async function news_comment_delete({ body, user }) {
  const id = validators.id(body.id, { field: 'комментария' });

  const row = await queryOne('SELECT user_id FROM news_comments WHERE id = ? LIMIT 1', [id]);
  if (!row) throw new ApiError('Комментарий не найден');
  if (row.user_id !== user.id && !isDev(user)) throw new ApiError('Недостаточно прав');

  await execute('UPDATE news_comments SET is_deleted = 1 WHERE id = ?', [id]);
  return { success: true, status: 'success', message: 'Комментарий удалён' };
}

export async function forum_categories({ user }) {
  const settings = await getSettings();
  if (!settingFlag(settings, 'forum_open') && !isDev(user)) {
    throw new ApiError('Форум временно закрыт', 403);
  }

  const rows = await query(
    `SELECT id, name, description, sort_order, min_sub_required, is_locked, created_at
       FROM forum_categories ORDER BY sort_order ASC, id ASC`,
  );

  return {
    success: true,
    status: 'success',
    message: 'OK',
    data: { categories: rows.map((row) => ({ ...row, is_locked: Number(row.is_locked) ? 1 : 0, min_sub_required: Number(row.min_sub_required) ? 1 : 0 })) },
  };
}

const THREAD_SELECT = `
  SELECT t.id, t.category_id, t.user_id, t.title, t.content, t.is_pinned, t.is_locked,
         t.is_deleted, t.views, t.posts_count, t.last_post_at, t.created_at, t.updated_at,
         u.name AS user_name,
         c.name AS category_name, c.description AS category_description,
         c.sort_order AS category_sort_order, c.min_sub_required AS category_min_sub,
         c.is_locked AS category_is_locked
    FROM forum_threads t
    LEFT JOIN users u ON u.id = t.user_id
    LEFT JOIN forum_categories c ON c.id = t.category_id
`;

function mapThread(row) {
  if (!row) return null;
  return {
    id: row.id,
    category_id: row.category_id,
    user_id: row.user_id,
    title: row.title,
    content: row.content,
    is_pinned: Number(row.is_pinned) ? 1 : 0,
    is_locked: Number(row.is_locked) ? 1 : 0,
    is_deleted: Number(row.is_deleted) ? 1 : 0,
    views: Number(row.views ?? 0),
    posts_count: Number(row.posts_count ?? 0),
    last_post_at: row.last_post_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: row.user_id ? { id: row.user_id, name: row.user_name || `User #${row.user_id}` } : null,
    category: row.category_id
      ? {
          id: row.category_id,
          name: row.category_name,
          description: row.category_description,
          sort_order: row.category_sort_order,
          min_sub_required: Number(row.category_min_sub) ? 1 : 0,
          is_locked: Number(row.category_is_locked) ? 1 : 0,
        }
      : null,
  };
}

const POST_SELECT = `
  SELECT p.id, p.thread_id, p.user_id, p.content, p.is_deleted, p.created_at, p.updated_at,
         u.name AS user_name
    FROM forum_posts p
    LEFT JOIN users u ON u.id = p.user_id
`;

function mapPost(row) {
  return {
    ...row,
    created_at: toIsoDate(row.created_at),
    updated_at: toIsoDate(row.updated_at),
    is_deleted: Number(row.is_deleted) ? 1 : 0,
    is_edited: isRowEdited(row.created_at, row.updated_at),
    user: row.user_id ? { id: row.user_id, name: row.user_name || `User #${row.user_id}` } : null,
  };
}

async function assertCanPostInCategory(categoryId, user) {
  const settings = await getSettings();
  if (!settingFlag(settings, 'forum_open') && !isDev(user)) {
    throw new ApiError('Форум временно закрыт', 403);
  }
  if (Number(user.forum_banned)) throw new ApiError('Вам запрещено писать на форуме', 403);

  const category = await queryOne('SELECT * FROM forum_categories WHERE id = ? LIMIT 1', [categoryId]);
  if (!category) throw new ApiError('Раздел не найден');
  if (Number(category.is_locked) && !isDev(user)) throw new ApiError('Раздел закрыт', 403);
  if (Number(category.min_sub_required) && !isDev(user)) {
    const fresh = await queryOne('SELECT sub_to FROM users WHERE id = ? LIMIT 1', [user.id]);
    const active = fresh?.sub_to && new Date(`${String(fresh.sub_to).replace(' ', 'T')}Z`).getTime() > Date.now();
    if (!active) throw new ApiError('Раздел доступен только с активной подпиской', 403);
  }
  return category;
}

export async function forum_threads({ body, user }) {
  const categoryId = validators.id(body.category_id ?? 1, { field: 'раздела' });
  const page = validators.page(body.page, 1);
  const perPage = validators.perPage(body.per_page, 20, 50);
  const offset = (page - 1) * perPage;

  const category = await queryOne('SELECT * FROM forum_categories WHERE id = ? LIMIT 1', [categoryId]);
  if (!category) throw new ApiError('Раздел не найден');

  if (Number(category.min_sub_required) && !isDev(user)) {
    const fresh = await queryOne('SELECT sub_to FROM users WHERE id = ? LIMIT 1', [user.id]);
    const active = fresh?.sub_to && new Date(`${String(fresh.sub_to).replace(' ', 'T')}Z`).getTime() > Date.now();
    if (!active) throw new ApiError('Раздел доступен только с активной подпиской', 403);
  }

  const rows = await query(
    `${THREAD_SELECT} WHERE t.category_id = ? AND t.is_deleted = 0
      ORDER BY t.is_pinned DESC, COALESCE(t.last_post_at, t.created_at) DESC
      LIMIT ? OFFSET ?`,
    [categoryId, perPage, offset],
  );
  const totalRow = await queryOne(
    'SELECT COUNT(*) AS total FROM forum_threads WHERE category_id = ? AND is_deleted = 0',
    [categoryId],
  );

  const items = rows.map((row) => {
    const thread = mapThread(row);
    thread.content = '';
    return thread;
  });

  return { success: true, status: 'success', message: 'OK', data: paginate(items, page, perPage, Number(totalRow?.total ?? 0)) };
}

export async function forum_thread({ body, user, ip }) {
  const id = validators.id(body.id, { field: 'темы' });

  const row = await queryOne(`${THREAD_SELECT} WHERE t.id = ? LIMIT 1`, [id]);
  if (!row || Number(row.is_deleted)) throw new ApiError('Тема не найдена');

  let views = Number(row.views ?? 0);
  if (shouldCountView(threadViewMap, id, user, ip)) {
    await execute('UPDATE forum_threads SET views = views + 1 WHERE id = ?', [id]);
    views += 1;
  }

  const posts = await query(`${POST_SELECT} WHERE p.thread_id = ? ORDER BY p.created_at ASC, p.id ASC`, [id]);

  const thread = mapThread(row);
  thread.views = views;

  return { success: true, status: 'success', message: 'OK', data: { thread, posts: posts.map(mapPost) } };
}

export async function forum_thread_create({ body, user, ip }) {
  const categoryId = validators.id(body.category_id, { field: 'раздела' });
  const title = validators.text(body.title, { field: 'Заголовок', min: 3, max: 180 });
  const content = validators.text(body.content, { field: 'Сообщение', min: 1, max: 20000 });

  checkCommentFlood(user, ip, 30);
  await assertCanPostInCategory(categoryId, user);

  const result = await execute(
    'INSERT INTO forum_threads (category_id, user_id, title, content, posts_count, last_post_at) VALUES (?, ?, ?, ?, 0, NULL)',
    [categoryId, user.id, title, content],
  );
  recordCommentSent(user, ip);
  const id = result.insertId;

  const row = await queryOne(`${THREAD_SELECT} WHERE t.id = ? LIMIT 1`, [id]);
  return { success: true, status: 'success', message: 'Тема создана', data: { thread: mapThread(row) } };
}

export async function forum_post_create({ body, user, ip }) {
  const threadId = validators.id(body.thread_id, { field: 'темы' });
  const content = validators.text(body.content, { field: 'Сообщение', min: 1, max: 20000 });

  checkCommentFlood(user, ip, 15);

  const thread = await queryOne('SELECT * FROM forum_threads WHERE id = ? LIMIT 1', [threadId]);
  if (!thread || Number(thread.is_deleted)) throw new ApiError('Тема не найдена');
  if (Number(thread.is_locked) && !isDev(user)) throw new ApiError('Тема закрыта', 403);

  await assertCanPostInCategory(thread.category_id, user);

  const result = await execute('INSERT INTO forum_posts (thread_id, user_id, content) VALUES (?, ?, ?)', [
    threadId,
    user.id,
    content,
  ]);
  recordCommentSent(user, ip);

  await execute(
    'UPDATE forum_threads SET posts_count = posts_count + 1, last_post_at = UTC_TIMESTAMP() WHERE id = ?',
    [threadId],
  );

  const row = await queryOne(`${POST_SELECT} WHERE p.id = ? LIMIT 1`, [result.insertId]);
  return { success: true, status: 'success', message: 'Отправлено', data: { post: mapPost(row) } };
}

export async function forum_post_edit({ body, user }) {
  const id = validators.id(body.id, { field: 'сообщения' });
  const content = validators.text(body.content, { field: 'Сообщение', min: 1, max: 20000 });

  const row = await queryOne('SELECT user_id FROM forum_posts WHERE id = ? LIMIT 1', [id]);
  if (!row) throw new ApiError('Сообщение не найдено');
  if (row.user_id !== user.id && !isDev(user)) throw new ApiError('Недостаточно прав');

  await execute('UPDATE forum_posts SET content = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [content, id]);
  return { success: true, status: 'success', message: 'Сообщение обновлено' };
}

export async function forum_post_delete({ body, user }) {
  const id = validators.id(body.id, { field: 'сообщения' });

  const row = await queryOne('SELECT user_id, thread_id FROM forum_posts WHERE id = ? LIMIT 1', [id]);
  if (!row) throw new ApiError('Сообщение не найдено');
  if (row.user_id !== user.id && !isDev(user)) throw new ApiError('Недостаточно прав');

  await execute('UPDATE forum_posts SET is_deleted = 1 WHERE id = ?', [id]);
  if (Number(row.thread_id)) {
    await execute(
      'UPDATE forum_threads SET posts_count = GREATEST(posts_count - 1, 0) WHERE id = ?',
      [row.thread_id],
    );
  }

  return { success: true, status: 'success', message: 'Сообщение удалено' };
}

export async function forum_thread_delete({ body, user }) {
  const id = validators.id(body.id, { field: 'темы' });

  const row = await queryOne('SELECT user_id FROM forum_threads WHERE id = ? LIMIT 1', [id]);
  if (!row) throw new ApiError('Тема не найдена');
  if (row.user_id !== user.id && !isDev(user)) throw new ApiError('Недостаточно прав');

  await execute('UPDATE forum_threads SET is_deleted = 1 WHERE id = ?', [id]);
  return { success: true, status: 'success', message: 'Тема удалена' };
}

export default {
  news_list,
  news_get,
  news_comment_add,
  news_comment_edit,
  news_comment_delete,
  forum_categories,
  forum_threads,
  forum_thread,
  forum_thread_create,
  forum_thread_delete,
  forum_post_create,
  forum_post_edit,
  forum_post_delete,
};
