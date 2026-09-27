#!/usr/bin/env node
/**
 * Creates or updates a user from the command line.
 *
 *   npm run user:create -- --name=Mintaly --email=dev@mintaly.local --password=secret123 --dev
 *   npm run user:create -- --name=Tester --email=test@example.com --password=secret123 --subdays=30
 */
import { execute, queryOne, testConnection } from '../db.js';
import { hashPassword, sqlDate } from '../helpers.js';
import { config } from '../config.js';

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
    if (match) args[match[1]] = match[2] ?? true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const name = args.name || process.env.USER_NAME;
const email = String(args.email || process.env.USER_EMAIL || '').trim().toLowerCase();
const password = args.password || process.env.USER_PASSWORD;
const isDev = args.dev === true || args.dev === 'true';
const verified = args.unverified ? 0 : 1;
const subDays = parseInt(args.subdays ?? 0, 10);

if (!name || !email || !password) {
  console.error('Usage: npm run user:create -- --name=<nick> --email=<mail> --password=<pass> [--dev] [--subdays=30]');
  process.exit(1);
}
if (name.length < 4 || name.length > 32) {
  console.error('Nickname must be 4-32 characters long');
  process.exit(1);
}
if (password.length < 6) {
  console.error('Password must be at least 6 characters long');
  process.exit(1);
}

try {
  await testConnection();
} catch (error) {
  console.error(`[db] connection failed: ${error.message}`);
  process.exit(1);
}

const passwordHash = hashPassword(String(password));
const existing = await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
const subTo = subDays > 0 ? sqlDate(Date.now() + subDays * 86400000) : null;
// a subscription is always attached to a plan, otherwise the UI has no name for it
const firstSubId = subDays > 0 ? (await queryOne('SELECT id FROM subscriptions ORDER BY sort_order ASC, id ASC LIMIT 1'))?.id ?? null : null;

let userId;
if (existing) {
  userId = existing.id;
  await execute(
    `UPDATE users
        SET name = ?, password = ?, email_verified = ?, dev = ?,
            sub_id = COALESCE(sub_id, ?),
            sub_to = CASE WHEN ? > 0 THEN ? ELSE sub_to END
      WHERE id = ?`,
    [name, passwordHash, verified, isDev ? 1 : 0, firstSubId, subDays, subTo, userId],
  );
  console.log(`[users] updated #${userId} (${email})`);
} else {
  const result = await execute(
    `INSERT INTO users (name, email, password, email_verified, dev, sub_id, sub_to)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, email, passwordHash, verified, isDev ? 1 : 0, firstSubId, subTo],
  );
  userId = result.insertId;
  console.log(`[users] created #${userId} (${email})`);
}

console.log(`[users] dev=${isDev ? 'yes' : 'no'} email_verified=${verified ? 'yes' : 'no'} subscription=${subDays > 0 ? `${subDays} days` : 'none'}`);
console.log(`[users] database: ${config.db.database}`);
process.exit(0);
