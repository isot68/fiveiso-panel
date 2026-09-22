import { ACTION_FEATURE } from './tenancy.mjs';
export const GAME_ACTIONS = [
  'heal',
  'revive',
  'freeze',
  'unfreeze',
  'kill',
  'teleport',
  'message',
  'setJob',
  'setGang',
  'createJob',
  'updateJob',
  'deleteJob',
  'createGang',
  'giveItem',
  'removeItem',
  'addMoney',
  'removeMoney',
  'spawnVehicle',
  'repairVehicle',
  'deleteVehicle',
  'setBucket',
  'setJoinLock',
];
export function validateGameAction(action, snapshot) {
  if (!GAME_ACTIONS.includes(action.type)) return;
  if (!snapshot.capabilities?.includes(action.type))
    throw Error('Bu işlem için sunucuda gerekli adaptör etkin değil.');
  if (action.type === 'setJoinLock') {
    if (typeof action.params?.enabled !== 'boolean')
      throw Error('Oyuncu giriş ayarı geçersiz.');
    return;
  }
  if (action.type === 'deleteJob') {
    if (typeof action.params?.name !== 'string' || !/^[a-z][a-z0-9_]{1,49}$/.test(action.params.name))
      throw Error('Meslek kodu geçersiz.');
    return;
  }
  if (['createJob', 'updateJob', 'createGang'].includes(action.type)) {
    const p = action.params;
    if (!p || typeof p !== 'object' || Array.isArray(p) ||
      typeof p.name !== 'string' || !/^[a-z][a-z0-9_]{1,49}$/.test(p.name) ||
      typeof p.label !== 'string' || !p.label.trim() || p.label.length > 50 ||
      !Array.isArray(p.grades) || p.grades.length < 1 || p.grades.length > 20)
      throw Error('Meslek/çete tanımı geçersiz.');
    const seen = new Set();
    const sources = new Set();
    for (const grade of p.grades) {
      if (!grade || !Number.isInteger(grade.grade) || grade.grade < 0 || grade.grade > 100 ||
        seen.has(grade.grade) || typeof grade.name !== 'string' ||
        !grade.name.trim() || grade.name.length > 50 ||
        !Number.isInteger(grade.payment) || grade.payment < 0 || grade.payment > 1000000 ||
        typeof grade.isboss !== 'boolean' ||
        (grade.sourceGrade !== undefined && (action.type !== 'updateJob' || !Number.isInteger(grade.sourceGrade) || grade.sourceGrade < 0 || grade.sourceGrade > 100 || sources.has(grade.sourceGrade))))
        throw Error('Rütbe tanımı geçersiz.');
      seen.add(grade.grade);
      if (grade.sourceGrade !== undefined) sources.add(grade.sourceGrade);
    }
    if (!seen.has(0)) throw Error('Başlangıç rütbesi (0) gerekli.');
    if (['createJob', 'updateJob'].includes(action.type) && (
      (p.type !== undefined && (typeof p.type !== 'string' || !/^[a-z][a-z0-9_]{0,31}$/.test(p.type))) ||
      (p.defaultDuty !== undefined && typeof p.defaultDuty !== 'boolean') ||
      (p.offDutyPay !== undefined && typeof p.offDutyPay !== 'boolean')
    )) throw Error('Meslek türü veya görev ayarları geçersiz.');
    return;
  }
  if (
    !/^\d{1,8}$/.test(action.target || '') ||
    !snapshot.players?.some((p) => p.id === action.target)
  )
    throw Error('Oyuncu oturumu bulunamadı.');
  const p = action.params || {};
  if (typeof p !== 'object' || Array.isArray(p))
    throw Error('Geçersiz işlem parametresi.');
  const integer = (key, min, max) => {
    if (!Number.isInteger(p[key]) || p[key] < min || p[key] > max)
      throw Error('Geçersiz ' + key);
  };
  const name = (key) => {
    if (typeof p[key] !== 'string' || !/^[a-zA-Z0-9_.-]{1,80}$/.test(p[key]))
      throw Error('Geçersiz ' + key);
  };
  if (['giveItem', 'removeItem'].includes(action.type)) {
    name('name');
    integer('amount', 1, 1000);
  }
  if (['addMoney', 'removeMoney'].includes(action.type)) {
    if (!['cash', 'bank'].includes(p.account)) throw Error('Geçersiz hesap.');
    integer('amount', 1, 10000000);
  }
  if (['setJob', 'setGang'].includes(action.type)) {
    name('name');
    integer('grade', 0, 100);
  }
  if (action.type === 'spawnVehicle') name('model');
  if (action.type === 'setBucket') integer('bucket', 0, 65535);
  if (action.type === 'teleport')
    for (const key of ['x', 'y', 'z'])
      if (
        typeof p[key] !== 'number' ||
        !Number.isFinite(p[key]) ||
        Math.abs(p[key]) > 20000
      )
        throw Error('Geçersiz koordinat.');
  if (
    action.type === 'message' &&
    (typeof action.value !== 'string' ||
      !action.value.trim() ||
      action.value.length > 300)
  )
    throw Error('Mesaj 1–300 karakter olmalı.');
  if (
    typeof action.value !== 'string' ||
    !action.value.trim() ||
    action.value.length > 300
  )
    throw Error('İşlem sebebi gerekli.');
}
export function projectGameData(snapshot, allowed) {
  const result = {
    capabilities: (snapshot.capabilities || []).filter((c) =>
      allowed(ACTION_FEATURE[c]),
    ),
  };
  if (allowed('settings')) result.joinLocked = snapshot.joinLocked === true;
  result.targets = result.capabilities.length
    ? (snapshot.players || []).map((p) => ({ id: p.id, name: p.name }))
    : [];
  if (allowed('overview')) result.metrics = snapshot.metrics;
  if (allowed('accounts')) result.accounts = snapshot.accounts || [];
  if (allowed('items')) result.items = snapshot.items || [];
  if (allowed('items')) result.itemCatalog = snapshot.itemCatalog || [];
  if (allowed('jobs')) result.jobs = snapshot.jobs || [];
  if (allowed('factions')) result.factions = snapshot.factions || [];
  if (allowed('vehicles')) result.vehicles = snapshot.vehicles || [];
  if (allowed('map')) result.locations = snapshot.locations || [];
  if (allowed('economy')) result.economy = snapshot.economy || [];
  return result;
}
