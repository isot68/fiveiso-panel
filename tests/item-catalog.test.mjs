import test from 'node:test';
import assert from 'node:assert/strict';
import { itemGroup, parseData } from '../scripts/item-catalog.mjs';

test('eşya kataloğu: Türkçe etiketler, iç tablolar ve FiveM hashleri', () => {
  const data = parseData("return { ['su'] = { label = 'İçme Suyu', weight = 100, stack = false, client = { image = 'water.png', model = `prop_water` } } }");
  assert.equal(data.su.label, 'İçme Suyu');
  assert.equal(data.su.weight, 100);
  assert.equal(data.su.stack, false);
  assert.equal(data.su.client.image, 'water.png');
  assert.equal(data.su.client.model, 'prop_water');
});
test('eşya kataloğu: callbackler ve çağrılar çalıştırılmaz', () => {
  const data = parseData("return { item = { label = 'Test', client = { export = 'test.use' }, use = function() error('do not run') end, weight = dangerous() } }");
  assert.equal(data.item.label, 'Test');
  assert.equal(data.item.use, undefined);
  assert.equal(data.item.weight, undefined);
});
test('eşya kataloğu: filtre grupları', () => {
  assert.equal(itemGroup('WEAPON_GLOCK26', { label: 'Glock' }, 'Weapons'), 'weapons');
  assert.equal(itemGroup('ammo-9', { label: '9mm' }, 'Ammo'), 'weapons');
  assert.equal(itemGroup('bandage', { label: 'Bandage' }), 'health');
  assert.equal(itemGroup('firstaid', { label: 'First Aid' }), 'health');
  assert.equal(itemGroup('burger', { label: 'Burger', client: { status: { hunger: 200000 } } }), 'food');
  assert.equal(itemGroup('water', { label: 'Water', client: { status: { thirst: 200000 } } }), 'drinks');
  assert.equal(itemGroup('strawberry_seed', { label: 'Çilek Tohumu' }), 'other');
  assert.equal(itemGroup('phone', { label: 'Telefon' }), 'other');
});
