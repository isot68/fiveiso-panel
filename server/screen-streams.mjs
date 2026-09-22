import { randomUUID } from 'node:crypto';
import { access } from './tenancy.mjs';
import { hashToken, sameToken } from './security.mjs';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export function createScreenStreams({ db, sessions, body, send, audit, secureCookie = false }) {
  const streams = new Map();
  const agents = new Map();
  const iceServers = JSON.parse(process.env.FIVEISO_ICE_SERVERS || '[{"urls":"stun:stun.l.google.com:19302"}]');
  const permitted = (user, id) => user && access(db, user, id, 'map');
  function close(stream, reason) {
    if (!streams.delete(stream.id)) return;
    audit(stream.username, stream.serverId, `Ekran izleme sonlandırıldı: ${stream.target} · ${reason}`);
  }
  function valid(stream) {
    const session = sessions.get(stream.sessionKey);
    const user = db.prepare('SELECT username,role FROM users WHERE username=?').get(stream.username);
    const srv = db.prepare('SELECT * FROM servers WHERE id=?').get(stream.serverId);
    const player = srv && JSON.parse(srv.snapshot).players?.find(p => p.id === stream.target);
    return session && session.expires > Date.now() && permitted(user, stream.serverId)
      && Date.now() - stream.touched < 180000
      && srv && Date.now() - srv.last_seen < 25000 && player?.license === stream.license;
  }
  function prune() {
    for (const stream of streams.values()) if (!valid(stream)) close(stream, 'Oturum veya bağlantı sona erdi');
  }
  const timer = setInterval(prune, 5000);
  timer.unref();
  function description(value, type) {
    if (!value || value.type !== type || typeof value.sdp !== 'string' || value.sdp.length > 100000 || !value.sdp.startsWith('v=0')) throw fail('Geçersiz yayın bağlantısı.');
    if (/^m=audio /m.test(value.sdp)) throw fail('Ses yayını desteklenmiyor.');
    return { type, sdp: value.sdp };
  }
  return {
    dispose() { clearInterval(timer); streams.clear(); },
    async agent(req, res) {
      const serverId = req.headers['x-fiveiso-server'];
      const srv = typeof serverId === 'string' && db.prepare('SELECT * FROM servers WHERE id=?').get(serverId);
      if (!srv || !sameToken(req.headers.authorization?.replace(/^Bearer /, '') || '', srv.token_hash)) throw fail('Ajan yetkilendirilemedi.', 401);
      const payload = await body(req);
      prune();
      agents.set(serverId, Date.now());
      const updates = Array.isArray(payload.updates) ? payload.updates : [];
      if (updates.length > 20) throw fail('Çok fazla yayın güncellemesi.');
      for (const update of updates) {
        const stream = streams.get(update.id);
        if (!stream || stream.serverId !== serverId) continue;
        if (update.answer) stream.answer = description(update.answer, 'answer');
        if (typeof update.error === 'string') stream.error = update.error.slice(0, 300);
      }
      send(res, 200, { streams: [...streams.values()].filter(s => s.serverId === serverId && !s.error).map(s => ({
        id: s.id, target: s.target, license: s.license, offer: s.offer, iceServers,
      })) });
    },
    async viewer(req, res, path, user, cookie) {
      const match = path.match(/^\/api\/servers\/([^/]+)\/screens(?:\/([^/]+))?$/);
      if (!match) return false;
      const serverId = decodeURIComponent(match[1]);
      if (!permitted(user, serverId)) throw fail('Canlı ekran izleme yetkiniz yok.', 403);
      prune();
      if (!match[2] && req.method === 'GET') {
        send(res, 200, { iceServers, ready: Date.now() - (agents.get(serverId) || 0) < 10000 });
        return true;
      }
      if (!match[2] && req.method === 'POST') {
        if (Date.now() - (agents.get(serverId) || 0) >= 10000) throw fail('Güncel fiveiso-agent çalışmıyor. Ajanı güncelleyip yeniden başlatın.', 409);
        const payload = await body(req);
        const srv = db.prepare('SELECT * FROM servers WHERE id=?').get(serverId);
        const target = String(payload.target);
        const player = srv && JSON.parse(srv.snapshot).players?.find(p => p.id === target);
        if (!player?.license || Date.now() - srv.last_seen > 20000) throw fail('Oyuncu veya sunucu çevrimdışı.', 409);
        if ([...streams.values()].some(s => s.serverId === serverId && s.target === target)) throw fail('Bu oyuncunun ekranı zaten izleniyor.', 409);
        if ([...streams.values()].filter(s => s.username === user.username).length >= 1 || streams.size >= 20) throw fail('Önce açık ekran izleme oturumunu kapatın.', 429);
        const stream = { id: randomUUID(), serverId, target, license: player.license, username: user.username,
          sessionKey: hashToken(cookie), touched: Date.now(), offer: description(payload.offer, 'offer') };
        streams.set(stream.id, stream);
        audit(user.username, serverId, `Sessiz ekran izleme başlatıldı: ${target}`);
        send(res, 200, { id: stream.id });
        return true;
      }
      const stream = streams.get(match[2]);
      if (!stream || stream.serverId !== serverId || stream.sessionKey !== hashToken(cookie)) throw fail('Yayın sona erdi veya erişim yok.', 404);
      if (req.method === 'GET') {
        stream.touched = Date.now();
        const session = sessions.get(stream.sessionKey);
        if (session && session.expires - Date.now() < 3600_000) {
          session.expires = Date.now() + 8 * 3600_000;
          res.setHeader('Set-Cookie', `fiveiso_session=${cookie}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookie ? '; Secure' : ''}`);
        }
        send(res, 200, { answer: stream.answer || null, error: stream.error || null });
      } else if (req.method === 'POST') {
        close(stream, 'İzleyici kapattı');
        send(res, 200, { ok: true });
      } else throw fail('Yöntem desteklenmiyor.', 405);
      return true;
    },
  };
}
