import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDatabaseAction } from '../server/database-actions.mjs';
import { ACTION_FEATURE } from '../server/tenancy.mjs';

const capabilities = ['dbCharacterDetail', 'dbSetJob', 'dbSetGang', 'dbInventoryAdd', 'dbInventoryRemove', 'dbSetBalance'];
const server = { capabilities };

test('karakter ayrıntısı ve çevrimdışı işlemler doğru izin alanlarına bağlıdır', () => {
  for (const type of capabilities) assert.equal(ACTION_FEATURE[type], 'accounts');
  assert.doesNotThrow(() => validateDatabaseAction({ type: 'dbCharacterDetail', target: 'CITIZEN123', params: {} }, server));
  assert.throws(() => validateDatabaseAction({ type: 'dbCharacterDetail', target: '', params: {} }, server));
});

test('çevrimdışı meslek ve envanter istekleri sınırlandırılır', () => {
  const base = { target: 'CITIZEN123', value: 'Panel karakter işlemi' };
  assert.doesNotThrow(() => validateDatabaseAction({ ...base, type: 'dbSetJob', params: { name: 'police', grade: 2, expected: '0123456789abcdef' } }, server));
  assert.throws(() => validateDatabaseAction({ ...base, type: 'dbSetGang', params: { name: 'bad name', grade: 0, expected: '0123456789abcdef' } }, server));
  assert.doesNotThrow(() => validateDatabaseAction({ ...base, type: 'dbInventoryAdd', params: { name: 'water', amount: 3, expected: '0123456789abcdef0123456789abcdef' } }, server));
  assert.throws(() => validateDatabaseAction({ ...base, type: 'dbInventoryRemove', params: { name: 'water', amount: 1001, expected: '0123456789abcdef0123456789abcdef' } }, server));
});
