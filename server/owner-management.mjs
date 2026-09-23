import { randomUUID } from 'node:crypto';
import { primaryTenant, cleanFeatures, ALL_PERMISSIONS } from './tenancy.mjs';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
function removeUser(db,username) {
 const user=db.prepare('SELECT role FROM users WHERE username=?').get(username);
 if(!user)throw fail('Kullanıcı bulunamadı.',404);
 if(user.role==='owner')throw fail('Ana sahip hesabı bu ekrandan silinemez.',403);
 for(const table of ['selected_workspaces','panel_memberships','discord_accounts','user_emails','user_permissions','user_tenants']) db.prepare(`DELETE FROM ${table} WHERE username=?`).run(username);
 db.prepare('DELETE FROM registration_pending WHERE username=? COLLATE NOCASE').run(username);
 db.prepare("UPDATE panel_invitations SET status='revoked',accepted_by=NULL WHERE accepted_by=? OR created_by=?").run(username,username);
 db.prepare('DELETE FROM users WHERE username=?').run(username);
}
function removeServer(db,id) {
 if(!db.prepare('SELECT id FROM servers WHERE id=?').get(id))throw fail('Sunucu bulunamadı.',404);
 db.prepare('DELETE FROM command_data WHERE id IN (SELECT id FROM commands WHERE server_id=?)').run(id);
 for(const table of ['resource_licenses','map_blips','server_tenants','history','commands','bans']) db.prepare(`DELETE FROM ${table} WHERE server_id=?`).run(id);
 db.prepare('DELETE FROM servers WHERE id=?').run(id);
}
export function deleteOwnerRecord(db,kind,id) {
 const users=[],servers=[];
 db.exec('BEGIN IMMEDIATE');
 try {
  if(kind==='user'){removeUser(db,id);users.push(id);}
  else if(kind==='server'){removeServer(db,id);servers.push(id);}
  else if(kind==='tenant'){
   if(!db.prepare('SELECT id FROM tenants WHERE id=?').get(id))throw fail('Müşteri bulunamadı.',404);
   for(const row of db.prepare('SELECT username FROM user_tenants WHERE tenant_id=?').all(id)){removeUser(db,row.username);users.push(row.username);}
   for(const row of db.prepare('SELECT server_id FROM server_tenants WHERE tenant_id=?').all(id)){removeServer(db,row.server_id);servers.push(row.server_id);}
   // Reassigned servers may still have a revoked package belonging to the old tenant.
   db.prepare("UPDATE resource_licenses SET tenant_id=(SELECT tenant_id FROM server_tenants WHERE server_id=resource_licenses.server_id),revoked=1,encryption_key=NULL,archive=NULL,lease_until=0 WHERE tenant_id=?").run(id);
   db.prepare('DELETE FROM discord_invites WHERE tenant_id=?').run(id);
   db.prepare('DELETE FROM team_roles WHERE tenant_id=?').run(id);
   db.prepare('DELETE FROM selected_workspaces WHERE tenant_id=?').run(id);
   db.prepare('DELETE FROM panel_invitations WHERE tenant_id=?').run(id);
   db.prepare('DELETE FROM panel_memberships WHERE tenant_id=?').run(id);
   db.prepare('DELETE FROM tenants WHERE id=?').run(id);
  }else throw fail('Silme türü geçersiz.');
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 return {users,servers};
}
export function updateOwnerServer(db,b) {
 const existing=typeof b.id==='string'?db.prepare('SELECT region,framework FROM servers WHERE id=?').get(b.id):null;
 b.region ??= existing?.region; b.framework ??= existing?.framework;
 for(const key of ['name','region','framework'])if(typeof b[key]!=='string'||!b[key].trim()||b[key].length>80)throw fail('Sunucu bilgilerini kontrol et.');
 if(typeof b.id!=='string'||!db.prepare('SELECT id FROM servers WHERE id=?').get(b.id))throw fail('Sunucu bulunamadı.',404);
 db.prepare('UPDATE servers SET name=?,region=?,framework=? WHERE id=?').run(b.name.trim(),b.region.trim(),b.framework.trim(),b.id);
}

export function grantUserLicense(db,b) {
 if(typeof b.username!=='string')throw fail('Kullanıcı seç.');
 const user=db.prepare('SELECT username,role FROM users WHERE username=?').get(b.username);
 if(!user||user.role==='owner')throw fail('Müşteri hesabı bulunamadı.',404);
 const features=cleanFeatures(b.features);
 if(!features.some(key=>!['overview','settings'].includes(key)))throw fail('Lisans için en az bir yönetim modülü seç.');
 const expires=b.expires||null;
 if(expires&&(!Number.isFinite(Date.parse(expires))||Date.parse(expires)<=Date.now()))throw fail('İleri bir bitiş tarihi seç veya süresiz bırak.');
 const previous=primaryTenant(db,user.username);
 const permissions=db.prepare('SELECT * FROM user_permissions WHERE username=?').get(user.username);
 const id=permissions?.manager===1?previous.id:randomUUID();
 db.exec('BEGIN IMMEDIATE');
 try{
  if(id!==previous.id){
   db.prepare('INSERT OR IGNORE INTO panel_memberships(username,tenant_id,permissions,role_id) VALUES(?,?,?,?)').run(user.username,previous.id,permissions?.permissions||'[]',permissions?.role_id||null);
   db.prepare('INSERT INTO tenants(id,name,features) VALUES(?,?,?)').run(id,user.username,JSON.stringify(features));
   db.prepare('UPDATE user_tenants SET tenant_id=? WHERE username=?').run(id,user.username);
  }
  db.prepare('UPDATE tenants SET enabled=1,expires=?,features=? WHERE id=?').run(expires,JSON.stringify(features),id);
  db.prepare('INSERT INTO user_permissions(username,permissions,manager,role_id) VALUES(?,?,1,NULL) ON CONFLICT(username) DO UPDATE SET permissions=excluded.permissions,manager=1,role_id=NULL').run(user.username,JSON.stringify(ALL_PERMISSIONS));
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
 return {ok:true,tenantId:id};
}
