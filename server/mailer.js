import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

let transportPromise = null;

async function getTransport() {
  if (!config.smtp.host) return null;
  if (!transportPromise) {
    transportPromise = (async () => {
      const { default: nodemailer } = await import('nodemailer');
      return nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      });
    })();
  }
  return transportPromise;
}

async function appendToLog(line) {
  try {
    await fs.mkdir(path.dirname(config.mailLogFile), { recursive: true });
    await fs.appendFile(config.mailLogFile, `${line}\n`, 'utf8');
  } catch {
    /* logging must never break the request */
  }
}

const SUBJECTS = {
  verify: 'Mintaly — Код подтверждения регистрации',
  dev_login: 'Mintaly — Вход в аккаунт разработчика',
  password_reset: 'Mintaly — Код восстановления пароля',
  email_change: 'Mintaly — Код подтверждения смены email',
};

const BODIES = {
  verify: 'Вы зарегистрировались в Mintaly. Введите этот код, чтобы подтвердить ваш email и завершить регистрацию:',
  dev_login: 'Внимание: зафиксирована попытка входа в аккаунт разработчика Mintaly. Если это вы, введите следующий код для подтверждения авторизации:',
  password_reset: 'Мы получили запрос на восстановление пароля. Введите этот код, чтобы задать новый пароль:',
  email_change: 'Введите этот код, чтобы подтвердить смену email на аккаунте:',
};

/**
 * Sends a 6 digit code. If SMTP is not configured the code is written to
 * server/logs/mail.log and printed to the console so local dev still works.
 *
 * @returns {Promise<{ delivered: boolean, transport: 'smtp'|'log' }>}
 */
export async function sendCode({ to, code, purpose, extraNote }) {
  const subject = SUBJECTS[purpose] || SUBJECTS.verify;
  const isDevLogin = purpose === 'dev_login';
  const warningText = isDevLogin
    ? '\n\nВАЖНО: Это уведомление безопасности входа в аккаунт разработчика. Если вы не выполняли вход, немедленно смените пароль!'
    : '\nЕсли вы не запрашивали это действие — просто проигнорируйте письмо.';
  const text = `${BODIES[purpose] || BODIES.verify}\n\n    ${code}\n\nКод действителен ${config.codeTtlMinutes} минут.${warningText}${extraNote ? `\n\n${extraNote}` : ''}`;

  const transport = await getTransport().catch(() => null);
  if (transport) {
    await transport.sendMail({ from: config.smtp.from, to, subject, text });
    return { delivered: true, transport: 'smtp' };
  }

  const line = `[${new Date().toISOString()}] to=${to} purpose=${purpose} code=${code}`;
  console.log(`[mail:log] ${line}`);
  await appendToLog(line);
  return { delivered: false, transport: 'log' };
}
