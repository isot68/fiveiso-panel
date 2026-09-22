import { openStore } from './store.mjs';
import { hashPassword, token, hashToken } from './security.mjs';
const [command, arg] = process.argv.slice(2);
const db = openStore();
try {
  if (command === 'owner') {
    const password = process.env.FIVEISO_NEW_PASSWORD;
    if (
      !arg ||
      !/^[a-zA-Z0-9_.-]{3,40}$/.test(arg) ||
      !password ||
      password.length < 12 ||
      password.length > 256
    )
      throw Error(
        'Kullanım: FIVEISO_NEW_PASSWORD ortam değişkeni (12–256 karakter) ile node server/manage.mjs owner KULLANICI',
      );
    db.prepare(
      'INSERT INTO users VALUES(?,?,?) ON CONFLICT(username) DO UPDATE SET password=excluded.password,role=excluded.role',
    ).run(arg, hashPassword(password), 'owner');
    console.log(`${arg} owner hesabı kaydedildi.`);
  } else if (command === 'rotate-token') {
    const secret = token();
    const result = db
      .prepare('UPDATE servers SET token_hash=? WHERE id=?')
      .run(hashToken(secret), arg);
    if (!result.changes) throw Error('Sunucu bulunamadı.');
    console.log(
      `Yeni sunucu anahtarı (ajan yapılandırmasını güncelleyin): ${secret}`,
    );
  } else throw Error('Komutlar: owner KULLANICI, rotate-token SUNUCU_ID');
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  db.close();
}
