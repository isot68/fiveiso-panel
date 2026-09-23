import { randomBytes, randomUUID, createCipheriv } from 'node:crypto';
import { isIP } from 'node:net';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
import { sameToken, hashToken, token } from './security.mjs';
import { activeTenant, permissionRecord, tenantFor } from './tenancy.mjs';
const fail = (message, status = 403) => Object.assign(Error(message), { status });
export function migrateLicenses(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS resource_licenses(
    server_id TEXT PRIMARY KEY REFERENCES servers(id), tenant_id TEXT NOT NULL REFERENCES tenants(id),
    package_id TEXT NOT NULL, encryption_key TEXT, archive BLOB, bound_ip TEXT, fingerprint TEXT,
    lease_until INTEGER NOT NULL DEFAULT 0, revoked INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL
  )`);
}
export function clientAddress(req, trustProxy = process.env.PANEL_TRUST_LOCAL_PROXY === 'true') {
  let address = req.socket.remoteAddress || '';
  if (trustProxy && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) {
    const forwarded = req.headers['x-real-ip'];
    if (typeof forwarded !== 'string' || !isIP(forwarded)) throw fail('Kaynak IP doğrulanamadı.');
    address = forwarded;
  }
  if (address.startsWith('::ffff:') && isIP(address.slice(7)) === 4) address = address.slice(7);
  if (!isIP(address)) throw fail('Kaynak IP doğrulanamadı.');
  return isIP(address) === 6 ? new URL(`http://[${address}]/`).hostname.slice(1, -1) : address;
}
function principal(db, req) {
  const id = req.headers['x-fiveiso-server'];
  const secret = req.headers.authorization?.replace(/^Bearer /, '') || '';
  const server = typeof id === 'string' ? db.prepare('SELECT * FROM servers WHERE id=?').get(id) : null;
  if (!server || !sameToken(secret, server.token_hash)) throw fail('Sunucu yetkilendirilemedi.', 401);
  const tenant = db.prepare('SELECT t.* FROM tenants t JOIN server_tenants st ON st.tenant_id=t.id WHERE st.server_id=?').get(id);
  if (!activeTenant(tenant)) throw fail('Panel erişimi durdurulmuş veya süresi dolmuş.');
  const license = db.prepare('SELECT server_id,tenant_id,package_id,encryption_key,bound_ip,fingerprint,lease_until,revoked FROM resource_licenses WHERE server_id=?').get(id);
  if (license && (license.revoked || license.tenant_id !== tenant.id)) throw fail('Lisans silinmiş veya müşteri ataması değişmiş.');
  return { server, tenant, license };
}
export function authorizeAgent(db, req, { host = false } = {}) {
  const { server, license } = principal(db, req);
  if (license && (!license.bound_ip || license.bound_ip !== clientAddress(req) ||
    (!host && (license.fingerprint !== req.headers['x-fiveiso-instance'] || license.lease_until <= Date.now()))))
    throw fail('Lisans bu sunucuya bağlı değil veya doğrulama süresi doldu.');
  return server;
}
export function activateLicense(db, req, packageId) {
  const { license, server } = principal(db, req);
  if (!license || license.package_id !== packageId || !license.encryption_key) throw fail('Kurulum paketi geçersiz.');
  const fingerprint = req.headers['x-fiveiso-instance'];
  if (typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint)) throw fail('Sunucu parmak izi geçersiz.');
  const ip = clientAddress(req);
  if (license.bound_ip && (license.bound_ip !== ip || license.fingerprint !== fingerprint))
    throw fail('Lisans başka sunucuya bağlı. Lisansı silip yeniden oluşturun.', 409);
  const leaseSeconds = 90;
  db.prepare('UPDATE resource_licenses SET bound_ip=?,fingerprint=?,lease_until=? WHERE server_id=?')
    .run(ip, fingerprint, Date.now() + leaseSeconds * 1000, server.id);
  return { ok: true, packageId: license.package_id, key: license.encryption_key, leaseSeconds };
}
export function licenseManager(db, user, serverId) {
  const assignment = db.prepare('SELECT tenant_id FROM server_tenants WHERE server_id=?').get(serverId);
  if (!assignment) throw fail('Sunucu bulunamadı.', 404);
  if (user.role !== 'owner' && (!permissionRecord(db, user).manager || tenantFor(db, user).id !== assignment.tenant_id))
    throw fail('Bu sunucunun lisansını yalnızca panel sahibi yönetebilir.');
  return assignment.tenant_id;
}
export function licenseStatus(db, id) {
  const row = db.prepare('SELECT package_id,bound_ip,revoked,created,lease_until,tenant_id FROM resource_licenses WHERE server_id=?').get(id);
  if (!row) return { state: 'unconfigured', ip: null };
  const assignment = db.prepare('SELECT tenant_id FROM server_tenants WHERE server_id=?').get(id);
  return { state: row.revoked || assignment?.tenant_id !== row.tenant_id ? 'revoked' : row.bound_ip ? 'bound' : 'pending', ip: row.bound_ip, created: row.created };
}
export function revokeLicense(db, id) {
  const current = db.prepare('SELECT server_id FROM resource_licenses WHERE server_id=?').get(id);
  if (!current) throw fail('Silinecek lisans bulunamadı.', 404);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE resource_licenses SET revoked=1,encryption_key=NULL,archive=NULL,lease_until=0 WHERE server_id=?').run(id);
    db.prepare('UPDATE servers SET token_hash=?,last_seen=0 WHERE id=?').run(hashToken(token()), id);
    db.prepare("UPDATE commands SET status='expired' WHERE server_id=? AND status='queued'").run(id);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
function encodeArchive(template, config, key, iv = randomBytes(12)) {
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(config.packageId));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(template.payload)), cipher.final()]);
  const payload = Buffer.concat([Buffer.from('FISO1'), iv, cipher.getAuthTag(), encrypted]).toString('base64');
  const files = Object.fromEntries(Object.entries(template.files).map(([name, content]) => [name, strToU8(content)]));
  files['fiveiso/license.json'] = strToU8(JSON.stringify(config));
  files['fiveiso/runtime.fiso'] = strToU8(payload);
  return Buffer.from(zipSync(files));
}
export async function updateResourcePackage(db,id,templatePath=resolve('dist/resource-template.json')) {
  const template=JSON.parse(await readFile(templatePath,'utf8').catch(()=>{throw fail('Kurulum paketi henüz derlenmedi.',503);}));
  const archive=downloadResourcePackage(db,id);
  const license=db.prepare('SELECT package_id,encryption_key FROM resource_licenses WHERE server_id=?').get(id);
  const files=unzipSync(new Uint8Array(archive));
  const config=JSON.parse(strFromU8(files['fiveiso/license.json']));
  const server=db.prepare('SELECT token_hash FROM servers WHERE id=?').get(id);
  if(!license.encryption_key||config.packageId!==license.package_id||config.serverId!==id||!sameToken(config.token,server.token_hash))throw fail('Kurulum kimliği doğrulanamadı.',409);
  const updated=encodeArchive(template,config,Buffer.from(license.encryption_key,'base64'));
  db.prepare('UPDATE resource_licenses SET archive=? WHERE server_id=? AND package_id=?').run(updated,id,license.package_id);
  return {ok:true};
}
export async function createResourcePackage(db, id, origin, templatePath = resolve('dist/resource-template.json')) {
  if (new URL(origin).protocol !== 'https:') throw fail('Kurulum paketleri HTTPS panel adresi gerektiriyor.', 409);
  const template = JSON.parse(await readFile(templatePath, 'utf8').catch(() => { throw fail('Kurulum paketi henüz derlenmedi.', 503); }));
  const assignment = db.prepare('SELECT t.* FROM tenants t JOIN server_tenants st ON st.tenant_id=t.id WHERE st.server_id=?').get(id);
  if (!activeTenant(assignment)) throw fail('Müşterinin panel erişimi aktif olmalı.');
  const old = db.prepare('SELECT revoked FROM resource_licenses WHERE server_id=?').get(id);
  if (old && !old.revoked) throw fail('Lisans zaten var. Mevcut paketi indirin veya önce lisansı silin.', 409);
  const packageId = randomUUID(), secret = token(), key = randomBytes(32), iv = randomBytes(12);
  const archive = encodeArchive(template,{origin,serverId:id,packageId,token:secret},key,iv);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO resource_licenses(server_id,tenant_id,package_id,encryption_key,archive,created)
      VALUES(?,?,?,?,?,?) ON CONFLICT(server_id) DO UPDATE SET tenant_id=excluded.tenant_id,package_id=excluded.package_id,
      encryption_key=excluded.encryption_key,archive=excluded.archive,created=excluded.created,bound_ip=NULL,fingerprint=NULL,lease_until=0,revoked=0`)
      .run(id, assignment.id, packageId, key.toString('base64'), archive, Date.now());
    db.prepare('UPDATE servers SET token_hash=?,last_seen=0 WHERE id=?').run(hashToken(secret), id);
    db.prepare("UPDATE commands SET status='expired' WHERE server_id=? AND status='queued'").run(id);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { packageId };
}
export function downloadResourcePackage(db, id) {
  const row = db.prepare('SELECT * FROM resource_licenses WHERE server_id=?').get(id);
  const tenant = db.prepare('SELECT t.* FROM tenants t JOIN server_tenants st ON st.tenant_id=t.id WHERE st.server_id=?').get(id);
  if (!row || row.revoked || !row.archive || row.tenant_id !== tenant?.id || !activeTenant(tenant)) throw fail('İndirilebilir aktif lisans bulunamadı.', 404);
  return row.archive;
}
