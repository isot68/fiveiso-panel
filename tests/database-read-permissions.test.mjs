import test from 'node:test';
import assert from 'node:assert/strict';
import { can } from '../server/security.mjs';
import { openStore } from '../server/store.mjs';
import { migrateTenancy } from '../server/tenancy.mjs';

test('özel yetkiler yalnızca seçilen işlemleri açar', () => {
  const db = openStore(':memory:');
  db.prepare('INSERT INTO users VALUES(?,?,?)').run('member', 'hash', 'viewer');
  migrateTenancy(db);
  db.prepare('UPDATE user_permissions SET manager=0,permissions=? WHERE username=?').run(JSON.stringify(['dbCharacters', 'kick']), 'member');
  const member = { username: 'member', role: 'user' };
  assert.equal(can(db, member, 'dbCharacters'), true);
  assert.equal(can(db, member, 'kick'), true);
  assert.equal(can(db, member, 'ban'), false);
  assert.equal(can(db, member, 'dbSetCharacter'), false);
  assert.equal(can(db, { username: 'owner', role: 'owner' }, 'kick'), false);
  db.close();
});
