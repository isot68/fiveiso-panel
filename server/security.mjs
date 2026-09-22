import { validateDatabaseAction } from './database-actions.mjs';
import { validateGameAction } from './game-actions.mjs';
import { ACTION_FEATURE, hasPermission } from './tenancy.mjs';
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, stored) {
  try {
    const [salt, hash] = stored.split(':');
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
export const hashToken = (token) =>
  createHash('sha256').update(token).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export function sameToken(actual, expected) {
  const a = Buffer.from(hashToken(actual));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function can(db, user, action) {
  return user?.role !== 'owner' && hasPermission(db, user, action);
}
export function validateAction(action, snapshot) {
  validateDatabaseAction(action, snapshot);
  validateGameAction(action, snapshot);
  if (!action || typeof action.type !== 'string')
    throw Error('Geçersiz işlem.');
  if (!Object.hasOwn(ACTION_FEATURE, action.type))
    throw Error('Desteklenmeyen işlem.');
  if (
    action.type === 'consoleCommand' &&
    (typeof action.value !== 'string' ||
      !action.value.trim() ||
      action.value.length > 500 ||
      /[\x00-\x1f\x7f]/.test(action.value))
  )
    throw Error('Konsol komutu tek satır ve en fazla 500 karakter olmalı.');
  if (
    action.type === 'consoleCommand' &&
    !snapshot.capabilities?.includes('consoleCommand')
  )
    throw Error('fiveiso konsol komutlarını desteklemiyor; ajanı güncelleyin.');
  if (['start', 'stop', 'restart'].includes(action.type)) {
    if (
      typeof action.target !== 'string' ||
      !/^[a-zA-Z0-9_.-]{1,80}$/.test(action.target) ||
      action.target === 'fiveiso' ||
      !snapshot.resources?.some((r) => r.name === action.target)
    )
      throw Error('Kaynak geçersiz veya korumalı.');
  }
  if (
    ['kick', 'ban'].includes(action.type) &&
    (!/^\d{1,8}$/.test(action.target || '') ||
      !snapshot.players?.some((p) => p.id === action.target))
  )
    throw Error('Oyuncu artık sunucuda değil.');
  if (
    ['kick', 'ban', 'announce'].includes(action.type) &&
    (typeof action.value !== 'string' ||
      !action.value.trim() ||
      action.value.length > 300 ||
      /[\x00-\x08\x0b-\x1f]/.test(action.value))
  )
    throw Error('1–300 karakterlik bir sebep veya mesaj gir.');
  if (action.type === 'unban' && typeof action.target !== 'string')
    throw Error('Yasak kimliği gerekli.');
}
