import { DB_FEATURES } from './database-actions.mjs';
export const FEATURES = {
  overview: 'Kontrol merkezi',
  players: 'Oyuncu yönetimi',
  accounts: 'Karakter hesapları',
  map: 'Canlı konumlar',
  vehicles: 'Araçlar',
  items: 'Eşyalar',
  jobs: 'Meslekler',
  factions: 'Çeteler / gruplar',
  economy: 'Para yönetimi',
  resources: 'Kaynaklar',
  console: 'Konsol',
  bans: 'Yasaklamalar',
  audit: 'İşlem kayıtları',
  team: 'Yetkililer',
  settings: 'Ayarlar',
};
export const ACTION_FEATURE = {
  ...DB_FEATURES,
  kick: 'players',
  ban: 'bans',
  unban: 'bans',
  announce: 'players',
  start: 'resources',
  stop: 'resources',
  restart: 'resources',
  heal: 'players',
  revive: 'players',
  freeze: 'players',
  unfreeze: 'players',
  kill: 'players',
  teleport: 'map',
  message: 'players',
  setJob: 'jobs',
  setGang: 'factions',
  createJob: 'jobs',
  updateJob: 'jobs',
  deleteJob: 'jobs',
  createGang: 'factions',
  giveItem: 'items',
  removeItem: 'items',
  addMoney: 'economy',
  removeMoney: 'economy',
  spawnVehicle: 'vehicles',
  repairVehicle: 'vehicles',
  deleteVehicle: 'vehicles',
  setBucket: 'players',
  setJoinLock: 'settings',
  consoleCommand: 'console',
  serverStart: 'overview',
  serverStop: 'overview',
  serverRestart: 'overview',
};
export const PERMISSIONS = {
  ...Object.fromEntries(Object.entries(FEATURES).map(([key, label]) => [key, `${label} bölümünü gör`])),
  kick: 'Oyuncuyu uzaklaştır', ban: 'Oyuncuyu yasakla', unban: 'Yasağı kaldır', announce: 'Duyuru gönder',
  start: 'Kaynak başlat', stop: 'Kaynak durdur', restart: 'Kaynağı yeniden başlat',
  heal: 'Oyuncuyu iyileştir', revive: 'Oyuncuyu canlandır', freeze: 'Oyuncuyu dondur', unfreeze: 'Oyuncunun dondurmasını kaldır',
  kill: 'Oyuncuyu öldür', teleport: 'Oyuncuyu ışınla', message: 'Oyuncuya mesaj gönder', setJob: 'Meslek ata', setGang: 'Çete ata',
  createJob: 'Meslek ekle', updateJob: 'Meslek düzenle', deleteJob: 'Meslek sil', createGang: 'Çete ekle',
  giveItem: 'Eşya ver', removeItem: 'Eşya al', addMoney: 'Para ekle', removeMoney: 'Para al',
  spawnVehicle: 'Araç oluştur', repairVehicle: 'Aracı onar', deleteVehicle: 'Aracı sil', setBucket: 'Routing bucket değiştir',
  dbCharacters: 'Karakter kayıtlarını sorgula', dbVehicles: 'Araç kayıtlarını sorgula', dbBalances: 'Bakiye kayıtlarını sorgula',
  dbSetCharacter: 'Karakter kaydını düzenle', dbSetGarage: 'Araç garajını düzenle', dbSetBalance: 'Bakiye kaydını düzenle',
  dbCharacterDetail: 'Karakter ayrıntılarını ve envanterini gör',
  dbSetProfile: 'Karakter kişisel bilgilerini düzenle',
  dbSetJob: 'Çevrimdışı meslek ata', dbSetGang: 'Çevrimdışı çete ata',
  dbInventoryAdd: 'Çevrimdışı envantere eşya ekle', dbInventoryRemove: 'Çevrimdışı envanterden eşya al',
  setJoinLock: 'Oyuncu girişlerini aç/kapat', teamManage: 'Ekip hesaplarını ve yetkilerini yönet',
  consoleCommand: 'Sunucu konsoluna komut gönder',
  serverStart: 'Sunucuyu başlat', serverStop: 'Sunucuyu durdur', serverRestart: 'Sunucuyu yeniden başlat',
};
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS);
export function migrateTenancy(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS tenants(id TEXT PRIMARY KEY,name TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,expires TEXT,features TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS user_tenants(username TEXT PRIMARY KEY REFERENCES users(username),tenant_id TEXT NOT NULL REFERENCES tenants(id));
 CREATE TABLE IF NOT EXISTS server_tenants(server_id TEXT PRIMARY KEY REFERENCES servers(id),tenant_id TEXT NOT NULL REFERENCES tenants(id));
 CREATE TABLE IF NOT EXISTS user_permissions(username TEXT PRIMARY KEY REFERENCES users(username),permissions TEXT NOT NULL,manager INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS team_roles(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),name TEXT NOT NULL,permissions TEXT NOT NULL,UNIQUE(tenant_id,name));
 CREATE TABLE IF NOT EXISTS discord_accounts(discord_id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE REFERENCES users(username));
 CREATE TABLE IF NOT EXISTS discord_invites(token_hash TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),role_id TEXT NOT NULL REFERENCES team_roles(id),expires INTEGER NOT NULL,created_by TEXT NOT NULL);`);
  if (!db.prepare('PRAGMA table_info(user_permissions)').all().some((column) => column.name === 'role_id'))
    db.exec('ALTER TABLE user_permissions ADD COLUMN role_id TEXT');
  db.exec('CREATE TABLE IF NOT EXISTS app_migrations(name TEXT PRIMARY KEY)');
  const orphans = db.prepare("SELECT username FROM users WHERE role!='owner' AND username NOT IN (SELECT username FROM user_tenants) LIMIT 1").get()
    || db.prepare('SELECT id FROM servers WHERE id NOT IN (SELECT server_id FROM server_tenants) LIMIT 1').get();
  if (!db.prepare("SELECT name FROM app_migrations WHERE name='default-tenant'").get() || orphans) {
    db.prepare('INSERT OR IGNORE INTO tenants(id,name,features) VALUES(?,?,?)').run('local', 'Mevcut çalışma alanı', JSON.stringify(Object.keys(FEATURES)));
    db.prepare("INSERT OR IGNORE INTO app_migrations VALUES('default-tenant')").run();
  }
  db.exec(
    "INSERT OR IGNORE INTO user_tenants SELECT username,'local' FROM users WHERE role != 'owner'; INSERT OR IGNORE INTO server_tenants SELECT id,'local' FROM servers;",
  );
  const users = db.prepare("SELECT username,role FROM users WHERE role!='owner'").all();
  for (const member of users) {
    if (db.prepare('SELECT username FROM user_permissions WHERE username=?').get(member.username)) continue;
    const tenant = tenantFor(db, member);
    const count = db.prepare('SELECT COUNT(*) AS count FROM user_tenants WHERE tenant_id=?').get(tenant.id).count;
    const manager = member.role === 'admin' || count === 1;
    const legacyActions = member.role === 'moderator'
      ? ['kick', 'ban', 'unban', 'announce', 'dbCharacters', 'dbVehicles', 'dbSetCharacter', 'dbSetGarage', 'setJoinLock']
      : ['dbCharacters', 'dbVehicles', 'dbSetCharacter', 'dbSetGarage', 'setJoinLock'];
    const views = JSON.parse(tenant.features);
    db.prepare('INSERT INTO user_permissions(username,permissions,manager) VALUES(?,?,?)').run(
      member.username,
      JSON.stringify(manager ? ALL_PERMISSIONS : [...new Set([...views, ...legacyActions])]),
      manager ? 1 : 0,
    );
  }
  db.prepare("UPDATE users SET role='user' WHERE role!='owner'").run();
}
export function tenantFor(db, user) {
  return (
    db
      .prepare(
        'SELECT t.* FROM tenants t JOIN user_tenants u ON u.tenant_id=t.id WHERE u.username=?',
      )
      .get(user.username) ||
    db.prepare("SELECT * FROM tenants WHERE id='local'").get()
  );
}
export function activeTenant(t) {
  return !!t?.enabled && (!t.expires || Date.parse(t.expires) > Date.now());
}
export function access(db, user, serverId, feature) {
  if (user.role === 'owner') return false;
  const tenant = tenantFor(db, user);
  if (!activeTenant(tenant)) return false;
  if (
    serverId &&
    serverId !== 'tenant:' + tenant.id &&
    db
      .prepare('SELECT tenant_id FROM server_tenants WHERE server_id=?')
      .get(serverId)?.tenant_id !== tenant.id
  )
    return false;
  return !feature || (JSON.parse(tenant.features).includes(feature) && hasPermission(db, user, feature));
}
export function permissionRecord(db, user) {
  if (!user || user.role === 'owner') return { manager: false, permissions: [] };
  const record = db.prepare('SELECT permissions,manager,role_id FROM user_permissions WHERE username=?').get(user.username);
  const role = record?.role_id
    ? db.prepare('SELECT name,permissions FROM team_roles WHERE id=? AND tenant_id=?').get(record.role_id, tenantFor(db, user).id)
    : null;
  return {
    manager: record?.manager === 1,
    roleId: record?.role_id || null,
    roleName: role?.name || null,
    permissions: role ? JSON.parse(role.permissions) : record?.role_id ? [] : record ? JSON.parse(record.permissions) : [],
  };
}
export function hasPermission(db, user, permission) {
  const record = permissionRecord(db, user);
  return record.manager || record.permissions.includes(permission);
}
export function visibleFeatures(db, user) {
  if (user.role === 'owner') return [];
  const tenant = tenantFor(db, user);
  return JSON.parse(tenant.features).filter((feature) => hasPermission(db, user, feature));
}
export function cleanPermissions(tenant, permissions) {
  if (!Array.isArray(permissions) || permissions.some((key) => !Object.hasOwn(PERMISSIONS, key)))
    throw Error('Geçersiz kullanıcı yetkileri.');
  const features = JSON.parse(tenant.features);
  return [...new Set(permissions)].filter((key) =>
    Object.hasOwn(FEATURES, key) ? features.includes(key) : key === 'teamManage' ? features.includes('team') : features.includes(ACTION_FEATURE[key]),
  );
}
export function cleanFeatures(features) {
  if (
    !Array.isArray(features) ||
    features.some((x) => !Object.hasOwn(FEATURES, x))
  )
    throw Error('Geçersiz modül listesi.');
  return [...new Set(['overview', ...features])];
}
