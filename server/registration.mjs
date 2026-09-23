import { randomInt, randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { hashPassword, verifyPassword } from './security.mjs';
import { ALL_PERMISSIONS } from './tenancy.mjs';
import { clientAddress } from './licensing.mjs';
const fail = (message, status = 400) => Object.assign(Error(message), { status });
export function createRegistration(db, { deliver } = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS user_emails(username TEXT PRIMARY KEY REFERENCES users(username),email TEXT NOT NULL UNIQUE,verified INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS registration_pending(id TEXT PRIMARY KEY,email TEXT NOT NULL,username TEXT NOT NULL,password TEXT NOT NULL,code_hash TEXT NOT NULL,expires INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS registration_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);`);
  const configured = !!deliver || !!(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
  const transport = configured && !deliver ? nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com', port: Number(process.env.SMTP_PORT || 465),
    secure: (process.env.SMTP_PORT || '465') === '465', requireTLS: (process.env.SMTP_PORT || '465') !== '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  }) : null;
  const sendMail = deliver || (message => transport.sendMail({ from: process.env.SMTP_FROM, ...message }));
  function limit(key, max, duration) {
    const now=Date.now();
    db.prepare('DELETE FROM registration_limits WHERE until<?').run(now);
    const current=db.prepare('SELECT * FROM registration_limits WHERE key=?').get(key);
    if (current?.count >= max) throw fail('Çok fazla deneme. Daha sonra tekrar dene.',429);
    db.prepare('INSERT INTO registration_limits VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=count+1')
      .run(key,1,now+duration);
  }
  return {
    enabled: configured,
    async request(req,b) {
      if (!configured) throw fail('E-posta doğrulaması henüz etkin değil. Lütfen daha sonra tekrar dene.',503);
      limit('register-ip:'+clientAddress(req),8,3600_000);
      const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
      const username=typeof b.username==='string'?b.username.trim():'';
      if(!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)||typeof b.password!=='string'||b.password.length<12||b.password.length>256||email.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))
        throw fail('Geçerli e-posta, 3–40 karakter kullanıcı adı ve en az 12 karakter parola gir.');
      limit('register-email:'+email,3,3600_000);
      if(db.prepare('SELECT username FROM users WHERE username=? COLLATE NOCASE').get(username)||db.prepare('SELECT username FROM user_emails WHERE email=?').get(email))
        throw fail('Bu kullanıcı adı veya e-posta zaten kayıtlı.',409);
      db.prepare('DELETE FROM registration_pending WHERE expires<?').run(Date.now());
      const id=randomUUID(),code=String(randomInt(0,1000000)).padStart(6,'0');
      db.prepare('INSERT INTO registration_pending(id,email,username,password,code_hash,expires) VALUES(?,?,?,?,?,?)')
        .run(id,email,username,hashPassword(b.password),hashPassword(code),Date.now()+10*60_000);
      try {
        await sendMail({to:email,subject:'FiveISO kayıt doğrulama kodun',text:`FiveISO doğrulama kodun: ${code}\n\nKod 10 dakika geçerlidir. Bu kaydı sen başlatmadıysan e-postayı dikkate alma. Kodunu kimseyle paylaşma.`});
      } catch {
        db.prepare('DELETE FROM registration_pending WHERE id=?').run(id);
        throw fail('Doğrulama e-postası gönderilemedi. Lütfen daha sonra tekrar dene.',503);
      }
      return { id, expiresIn:600 };
    },
    verify(req,b) {
      limit('verify-ip:'+clientAddress(req),30,15*60_000);
      if(typeof b.id!=='string'||typeof b.code!=='string'||!/^\d{6}$/.test(b.code))throw fail('6 haneli doğrulama kodunu gir.');
      const pending=db.prepare('SELECT * FROM registration_pending WHERE id=?').get(b.id);
      if(!pending||pending.expires<=Date.now()||pending.attempts>=5)throw fail('Kodun süresi dolmuş veya deneme sınırına ulaşılmış. Yeniden kayıt başlat.',410);
      db.prepare('UPDATE registration_pending SET attempts=attempts+1 WHERE id=?').run(pending.id);
      if(!verifyPassword(b.code,pending.code_hash))throw fail('Doğrulama kodu hatalı.');
      if(db.prepare('SELECT username FROM users WHERE username=? COLLATE NOCASE').get(pending.username)||db.prepare('SELECT username FROM user_emails WHERE email=?').get(pending.email))
        throw fail('Bu kullanıcı adı veya e-posta zaten kayıtlı.',409);
      const tenantId=randomUUID();
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('INSERT INTO users VALUES(?,?,?)').run(pending.username,pending.password,'user');
        db.prepare('INSERT INTO tenants(id,name,features) VALUES(?,?,?)').run(tenantId,pending.username,JSON.stringify(['overview','settings']));
        db.prepare('INSERT INTO user_tenants VALUES(?,?)').run(pending.username,tenantId);
        db.prepare('INSERT INTO user_permissions(username,permissions,manager) VALUES(?,?,1)').run(pending.username,JSON.stringify(ALL_PERMISSIONS));
        db.prepare('INSERT INTO user_emails VALUES(?,?,?)').run(pending.username,pending.email,Date.now());
        db.prepare('DELETE FROM registration_pending WHERE email=? OR username=? COLLATE NOCASE').run(pending.email,pending.username);
        db.exec('COMMIT');
      }catch(e){db.exec('ROLLBACK');throw e;}
      return {ok:true,username:pending.username};
    },
  };
}
