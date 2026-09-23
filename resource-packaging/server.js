// Bootstrap only: the feature payload key is released by the license service.
const https = require('node:https');
const crypto = require('node:crypto');
const os = require('node:os');
const resource = GetCurrentResourceName();
const config = JSON.parse(LoadResourceFile(resource, 'license.json'));
const fingerprint = crypto.createHash('sha256').update([
  os.hostname(), GetConvar('sv_licenseKey', ''), GetConvar('netPort', '30120'), GetResourcePath(resource),
].join('\0')).digest('hex');
let loaded = false;
let stopped = false;
let deadline = 0;
let busy = false;
let timer;
let watchdog;
function onGameThread(fn) { setImmediate(() => { if (!stopped) fn(); }); }
function halt(reason) {
  if (stopped) return;
  stopped = true;
  clearInterval(timer);
  clearInterval(watchdog);
  console.error('[FiveISO] ' + reason);
  emit('fiveiso:license:lease', 0);
  StopResource(resource);
}
function openPayload(key) {
  const data = Buffer.from(LoadResourceFile(resource, 'runtime.fiso'), 'base64');
  if (data.subarray(0, 5).toString() !== 'FISO1') throw Error('Paket biçimi geçersiz.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), data.subarray(5, 17));
  decipher.setAAD(Buffer.from(config.packageId));
  decipher.setAuthTag(data.subarray(17, 33));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(33)), decipher.final()]).toString('utf8'));
}
function activate() {
  if (busy || stopped) return;
  busy = true;
  const target = new URL('/api/license/activate', config.origin);
  if (target.protocol !== 'https:') return halt('Lisans doğrulaması HTTPS gerektiriyor.');
  const request = https.request(target, { method: 'POST', timeout: 10000, headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + config.token,
    'X-FiveISO-Server': config.serverId, 'X-FiveISO-Instance': fingerprint,
  } }, response => {
    let data = ''; let oversized = false;
    response.on('data', chunk => {
      data += chunk;
      if (data.length > 16384) { oversized = true; response.destroy(); }
    });
    response.on('error', () => { busy = false; });
    response.on('end', () => onGameThread(() => {
      busy = false;
      if (oversized) return halt('Lisans yanıtı geçersiz.');
      if (response.statusCode === 401 || response.statusCode === 403 || response.statusCode === 409)
        return halt('Lisans geçersiz, silinmiş veya başka sunucuya bağlı.');
      if (response.statusCode !== 200) return;
      try {
        const reply = JSON.parse(data);
        if (reply.ok !== true || reply.packageId !== config.packageId || !Number.isInteger(reply.leaseSeconds) || reply.leaseSeconds < 1 || reply.leaseSeconds > 90)
          throw Error('Lisans yanıtı geçersiz.');
        deadline = Date.now() + reply.leaseSeconds * 1000;
        emit('fiveiso:license:lease', reply.leaseSeconds);
        if (loaded) return;
        const payload = openPayload(reply.key);
        SetConvar('fiveiso_url', config.origin);
        SetConvar('fiveiso_server_id', config.serverId);
        SetConvar('fiveiso_token', config.token);
        SetConvar('fiveiso_instance', fingerprint);
        for (const script of payload.serverJs) {
          const module = { exports: {} };
          new Function('require', 'exports', 'module', script.code)(require, exports, module);
        }
        emit('fiveiso:license:load', JSON.stringify(payload));
        loaded = true;
        console.log('[FiveISO] Lisans doğrulandı; korumalı paket yüklendi.');
      } catch { halt('Paket doğrulanamadı. Panelden kurulum paketini tekrar indirin.'); }
    }));
  });
  request.on('timeout', () => request.destroy());
  request.on('error', () => { busy = false; });
  request.end(JSON.stringify({ packageId: config.packageId }));
}
on('onResourceStop', name => { if (name === resource) { stopped = true; clearInterval(timer); clearInterval(watchdog); } });
const started = Date.now();
timer = setInterval(() => onGameThread(activate), 30000);
watchdog = setInterval(() => onGameThread(() => {
  if ((loaded && Date.now() >= deadline) || (!loaded && Date.now() - started >= 90000))
    return halt('Lisans doğrulama süresi doldu.');
}), 1000);
activate();
