#!/usr/bin/env node
/**
 * Creates license keys from the command line.
 *
 *   npm run key:create -- --sub=2 --count=5
 *   npm run key:create -- --sub=2 --count=1 --days=90 --note="reseller batch"
 *
 * `--sub` defaults to the first plan, `--count` to 1.
 */
import crypto from 'node:crypto';
import { execute, queryOne, testConnection } from '../db.js';

const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
    if (match) args[match[1]] = match[2] ?? true;
  }
  return args;
}

function generateKeyCode() {
  let out = '';
  for (let i = 0; i < 64; i += 1) {
    out += KEY_ALPHABET[crypto.randomInt(0, KEY_ALPHABET.length)];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const count = Math.min(Math.max(parseInt(args.count ?? 1, 10) || 1, 1), 200);
const days = args.days ? parseInt(args.days, 10) : null;
const note = args.note ? String(args.note).slice(0, 255) : null;

try {
  await testConnection();
} catch (error) {
  console.error(`[db] connection failed: ${error.message}`);
  process.exit(1);
}

const subId = args.sub
  ? parseInt(args.sub, 10)
  : (await queryOne('SELECT id FROM subscriptions ORDER BY sort_order ASC LIMIT 1'))?.id;

if (!subId) {
  console.error('No subscription plans found. Import schema.sql first.');
  process.exit(1);
}

const sub = await queryOne('SELECT name, sub_days FROM subscriptions WHERE id = ? LIMIT 1', [subId]);
if (!sub) {
  console.error(`Plan #${subId} not found`);
  process.exit(1);
}

console.log(`[keys] plan=${sub.name} (#${subId}, ${sub.sub_days} days) count=${count}${days ? ` override=${days}` : ''}`);

for (let i = 0; i < count; i += 1) {
  const code = generateKeyCode();
  const result = await execute(
    'INSERT INTO license_keys (key_code, sub_id, days_override, note) VALUES (?, ?, ?, ?)',
    [code, subId, days, note],
  );
  console.log(`#${result.insertId}  ${code}`);
}

process.exit(0);
