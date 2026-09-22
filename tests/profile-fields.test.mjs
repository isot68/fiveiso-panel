import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDatabaseAction,
  DB_FEATURES,
} from '../server/database-actions.mjs';
import { can } from '../server/security.mjs';
import { openStore } from '../server/store.mjs';
import { migrateTenancy } from '../server/tenancy.mjs';
const snapshot = { capabilities: ['dbSetProfile'] };
const action = (field, value, extra = {}) => ({
  type: 'dbSetProfile',
  target: 'CHAR1',
  value: 'Profil düzenlemesi',
  params: { field, value, expected: '', ...extra },
});
test('kişisel bilgi düzenlemeleri alan, tarih ve değer sınırlarını doğrular', () => {
  for (const [field, value] of [
    ['gender', '0'],
    ['gender', '1'],
    ['birthdate', '2000-02-29'],
    ['nationality', 'Türkiye'],
    ['phone', '555-1234'],
  ])
    assert.doesNotThrow(() =>
      validateDatabaseAction(action(field, value), snapshot),
    );
  assert.doesNotThrow(() =>
    validateDatabaseAction(
      action('name', 'Ada Test', { firstname: 'Ada', lastname: 'Test' }),
      snapshot,
    ),
  );
  for (const [field, value] of [
    ['license', 'abc'],
    ['gender', '2'],
    ['birthdate', '2023-02-29'],
    ['birthdate', '2024-04-31'],
    ['phone', 'abc'],
    ['nationality', 'x'.repeat(61)],
  ])
    assert.throws(() => validateDatabaseAction(action(field, value), snapshot));
  assert.throws(() =>
    validateDatabaseAction(
      action('name', 'Ada', { firstname: 'Ada', lastname: '' }),
      snapshot,
    ),
  );
  assert.throws(() =>
    validateDatabaseAction(action('phone', '123', { expected: 123 }), snapshot),
  );
  assert.throws(() =>
    validateDatabaseAction(action('phone', '123'), { capabilities: [] }),
  );
  assert.equal(DB_FEATURES.dbSetProfile, 'accounts');
});
test('kişisel bilgi yazma yetkisi salt okuma hesabına verilmez', () => {
  const db = openStore(':memory:');
  db.prepare('INSERT INTO users VALUES(?,?,?)').run('reader', 'hash', 'viewer');
  migrateTenancy(db);
  db.prepare(
    'UPDATE user_permissions SET manager=0,permissions=? WHERE username=?',
  ).run(JSON.stringify(['dbCharacters', 'dbCharacterDetail']), 'reader');
  assert.equal(
    can(db, { username: 'reader', role: 'user' }, 'dbSetProfile'),
    false,
  );
  db.close();
});
