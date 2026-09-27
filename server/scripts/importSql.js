#!/usr/bin/env node
/**
 * Imports schema.sql into the configured database.
 * Statements are split on ";" at the end of a line, which is enough for the
 * plain DDL/DML shipped in schema.sql.
 *
 *   npm run db:import
 *   npm run db:import -- --file=./schema.sql
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { config, ROOT_DIR } from '../config.js';

const args = process.argv.slice(2);
const fileArg = args.find((item) => item.startsWith('--file='));
const file = fileArg ? fileArg.slice('--file='.length) : path.join(ROOT_DIR, 'schema.sql');

let sql;
try {
  sql = await fs.readFile(file, 'utf8');
} catch (error) {
  console.error(`[db] cannot read ${file}: ${error.message}`);
  process.exit(1);
}

// Adapt target database name to config.db.database
const targetDb = config.db.database || 'mintaly';
sql = sql
  .replace(/CREATE DATABASE IF NOT EXISTS `?[a-zA-Z0-9_]+`?/gi, `CREATE DATABASE IF NOT EXISTS \`${targetDb}\``)
  .replace(/USE `?[a-zA-Z0-9_]+`?;/gi, `USE \`${targetDb}\`;`);

const connection = await mysql.createConnection({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  multipleStatements: true,
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
});

if (targetDb) {
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${targetDb}\``);
    await connection.query(`USE \`${targetDb}\``);
  } catch (err) {
    console.warn(`[db] warning on USE ${targetDb}: ${err.message}`);
  }
}

// Strip block comments /* ... */ and line comments -- ...
const cleanedSql = sql
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

const statements = cleanedSql
  .split(/;\s*(?:\r?\n|$)/)
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

let applied = 0;
for (const statement of statements) {
  try {
    await connection.query(statement);
    applied += 1;
  } catch (error) {
    console.error(`[db] failed statement:\n${statement.slice(0, 200)}\n  -> ${error.message}`);
    process.exit(1);
  }
}

console.log(`[db] imported ${applied} statements from ${path.basename(file)} into ${targetDb}`);
await connection.end();
process.exit(0);
