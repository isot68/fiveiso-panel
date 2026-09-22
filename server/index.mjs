import { DB_ACTIONS } from './database-actions.mjs';
import { createScreenStreams } from './screen-streams.mjs';
import { createAgentStream } from './agent-stream.mjs';
import { GAME_ACTIONS, projectGameData } from './game-actions.mjs';
import {
  FEATURES,
  ACTION_FEATURE,
  migrateTenancy,
  tenantFor,
  activeTenant,
  access,
  cleanFeatures,
  PERMISSIONS,
  ALL_PERMISSIONS,
  permissionRecord,
  visibleFeatures,
  cleanPermissions,
  hasPermission,
} from './tenancy.mjs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.mjs';
import {
  token,
  hashToken,
  sameToken,
  verifyPassword,
  hashPassword,
  can,
  validateAction,
} from './security.mjs';
const fail = (message, status = 400) =>
  Object.assign(Error(message), { status });
const blipCatalog = JSON.parse(readFileSync(new URL('../public/assets/blips/catalog.json', import.meta.url), 'utf8'));
const blipSprites = new Set(blipCatalog.sprites.map((entry) => entry.id));
const blipColors = new Set(blipCatalog.colors.map((entry) => entry.code));
export function createPanel({
  db = openStore(),
  origin = process.env.PANEL_ORIGIN || 'http://localhost:3030',
  staticRoot = resolve('dist/client'),
  discord = {},
} = {}) {
  migrateTenancy(db);
  const discordClientId = discord.clientId ?? process.env.DISCORD_CLIENT_ID;
  const discordClientSecret = discord.clientSecret ?? process.env.DISCORD_CLIENT_SECRET;
  const discordRedirectUri = discord.redirectUri ?? process.env.DISCORD_REDIRECT_URI ?? `${origin}/api/auth/discord/callback`;
  const discordFetch = discord.fetch ?? fetch;
  const discordEnabled = !!(discordClientId && discordClientSecret && discordRedirectUri);
  const allowedOrigins = new Set([
    new URL(origin).origin,
    ...(process.env.PANEL_ALLOWED_ORIGINS || '').split(',')
      .map((value) => value.trim()).filter(Boolean)
      .map((value) => new URL(value).origin),
  ]);
  const sessions = new Map();
  const discordStates = new Map();
  const attempts = new Map();
  const mapBlipsByServer = new Map();
  const pendingMapBlips = new Map();
  const mapBlipActions = new Map();
  const hostStates = new Map();
  const hostCommands = new Map();
  // Inventory PNGs are relayed by fiveiso-agent and deliberately kept in RAM only.
  const inventoryImages = new Map();
  const dummy = hashPassword(token());
  const send = (res, status, data) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(data));
  };
  const discordRedirect = (res, error) => {
    res.writeHead(302, { Location: `/panel?discord_error=${error}`, 'Cache-Control': 'no-store' });
    res.end();
  };
  function audit(
    actor,
    serverId,
    action,
    status = 'completed',
    id = randomUUID(),
  ) {
    db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').run(
      id,
      new Date().toISOString(),
      actor,
      serverId,
      action,
      status,
    );
    return id;
  }
  async function body(req) {
    let size = 0;
    const parts = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1024 * 1024) throw fail('İstek çok büyük.', 413);
      parts.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(parts).toString() || '{}');
    } catch {
      throw fail('Geçersiz JSON.');
    }
  }
  async function rawBody(req, limit = 2 * 1024 * 1024) {
    let size = 0;
    const parts = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) throw fail('Dosya çok büyük.', 413);
      parts.push(chunk);
    }
    return Buffer.concat(parts);
  }
  const safeInventoryName = (value) => {
    if (typeof value !== 'string') return '';
    const name = value.split(/[\\/]/).pop()?.toLowerCase() || '';
    return /^[a-z0-9][a-z0-9_.-]{0,119}\.png$/.test(name) ? name : '';
  };
  const inventoryKey = (serverId, name) => `${serverId}:${name}`;
  const screens = createScreenStreams({ db, sessions, body, send, audit, secureCookie: origin.startsWith('https:') });
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      if (!path.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD')
          throw fail('Yöntem desteklenmiyor.', 405);
        const relative = ['/', '/owner', '/panel'].includes(
          decodeURIComponent(path),
        )
          ? 'index.html'
          : decodeURIComponent(path).slice(1);
        const file = resolve(staticRoot, relative);
        if (!file.startsWith(staticRoot + sep))
          throw fail('Geçersiz dosya.', 403);
        try {
          if (!(await stat(file)).isFile()) throw Error();
          const content = await readFile(file);
          const mime = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.svg': 'image/svg+xml',
            '.woff2': 'font/woff2',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon',
          };
          res.writeHead(200, {
            'Content-Type': mime[extname(file)] || 'application/octet-stream',
            'Cache-Control': extname(file) === '.html'
              ? 'no-store, max-age=0'
              : 'public, max-age=31536000, immutable',
          });
          res.end(req.method === 'HEAD' ? undefined : content);
          return;
        } catch {
          throw fail('Sayfa bulunamadı. Önce paneli derleyin.', 404);
        }
      }
      if (path === '/api/auth/discord/config' && req.method === 'GET') {
        send(res, 200, { enabled: discordEnabled });
        return;
      }
      if (path === '/api/auth/discord/start' && req.method === 'GET') {
        if (!discordEnabled) return discordRedirect(res, 'not_configured');
        const invite = url.searchParams.get('invite') || '';
        const linking = url.searchParams.get('mode') === 'link';
        if (invite && !/^[a-f0-9]{64}$/.test(invite)) return discordRedirect(res, 'invalid_invite');
        const inviteHash = invite ? hashToken(invite) : null;
        if (inviteHash && !db.prepare('SELECT token_hash FROM discord_invites WHERE token_hash=? AND expires>?').get(inviteHash, Date.now()))
          return discordRedirect(res, 'invalid_invite');
        const sessionCookie = req.headers.cookie?.match(/(?:^|;\s*)fiveiso_session=([a-f0-9]{64})(?:;|$)/)?.[1] || '';
        const sessionHash = hashToken(sessionCookie);
        const linkSession = linking ? sessions.get(sessionHash) : null;
        if (linking && !linkSession) return discordRedirect(res, 'login_required');
        for (const [key, value] of discordStates)
          if (value.expires < Date.now()) discordStates.delete(key);
        const state = token();
        discordStates.set(state, { expires: Date.now() + 600_000, inviteHash, linkSessionHash: linking ? sessionHash : null });
        const authorize = new URL('https://discord.com/oauth2/authorize');
        authorize.search = new URLSearchParams({ response_type: 'code', client_id: discordClientId, redirect_uri: discordRedirectUri, scope: 'identify', state }).toString();
        res.setHeader('Set-Cookie', `fiveiso_discord_state=${state}; HttpOnly; SameSite=Lax; Path=/api/auth/discord; Max-Age=600${origin.startsWith('https:') ? '; Secure' : ''}`);
        res.writeHead(302, { Location: authorize.href, 'Cache-Control': 'no-store' });
        res.end();
        return;
      }
      if (path === '/api/auth/discord/callback' && req.method === 'GET') {
        res.setHeader('Set-Cookie', 'fiveiso_discord_state=; HttpOnly; SameSite=Lax; Path=/api/auth/discord; Max-Age=0');
        const state = url.searchParams.get('state') || '';
        const cookieState = req.headers.cookie?.match(/(?:^|;\s*)fiveiso_discord_state=([a-f0-9]{64})(?:;|$)/)?.[1] || '';
        const pending = discordStates.get(state);
        discordStates.delete(state);
        if (!pending || !state || state !== cookieState || pending.expires < Date.now())
          return discordRedirect(res, 'invalid_state');
        const code = url.searchParams.get('code');
        if (!code || url.searchParams.has('error')) return discordRedirect(res, 'denied');
        try {
          const tokenResponse = await discordFetch('https://discord.com/api/v10/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: discordRedirectUri, client_id: discordClientId, client_secret: discordClientSecret }),
            signal: AbortSignal.timeout(10000),
          });
          if (!tokenResponse.ok) return discordRedirect(res, 'failed');
          const credentials = await tokenResponse.json();
          if (typeof credentials.access_token !== 'string') return discordRedirect(res, 'failed');
          const userResponse = await discordFetch('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${credentials.access_token}` }, signal: AbortSignal.timeout(10000),
          });
          if (!userResponse.ok) return discordRedirect(res, 'failed');
          const identity = await userResponse.json();
          if (typeof identity.id !== 'string' || !/^\d{16,22}$/.test(identity.id)) return discordRedirect(res, 'failed');
          let account = db.prepare('SELECT u.username,u.role FROM users u JOIN discord_accounts d ON d.username=u.username WHERE d.discord_id=?').get(identity.id);
          if (pending.linkSessionHash) {
            const linkSession = sessions.get(pending.linkSessionHash);
            if (!linkSession || linkSession.expires < Date.now()) return discordRedirect(res, 'login_required');
            if (account && account.username !== linkSession.username) return discordRedirect(res, 'already_linked');
            const current = db.prepare('SELECT username,role FROM users WHERE username=?').get(linkSession.username);
            if (!current) return discordRedirect(res, 'login_required');
            const priorLink = db.prepare('SELECT discord_id FROM discord_accounts WHERE username=?').get(current.username);
            if (priorLink && priorLink.discord_id !== identity.id) return discordRedirect(res, 'already_linked');
            db.prepare('INSERT OR IGNORE INTO discord_accounts(discord_id,username) VALUES(?,?)').run(identity.id, current.username);
            audit(current.username, 'tenant:' + (current.role === 'owner' ? 'owner' : tenantFor(db, current).id), 'Discord hesabı bağlandı');
            const linkedSessionId = token();
            sessions.set(hashToken(linkedSessionId), { username: current.username, expires: Date.now() + 8 * 3600_000 });
            res.setHeader('Set-Cookie', [
              'fiveiso_discord_state=; HttpOnly; SameSite=Lax; Path=/api/auth/discord; Max-Age=0',
              `fiveiso_session=${linkedSessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${origin.startsWith('https:') ? '; Secure' : ''}`,
            ]);
            res.writeHead(302, { Location: current.role === 'owner' ? '/owner' : '/panel', 'Cache-Control': 'no-store' });
            res.end();
            return;
          }
          if (!account) {
            if (!pending.inviteHash) return discordRedirect(res, 'invite_required');
            const invite = db.prepare('SELECT * FROM discord_invites WHERE token_hash=? AND expires>?').get(pending.inviteHash, Date.now());
            if (!invite || !activeTenant(db.prepare('SELECT * FROM tenants WHERE id=?').get(invite.tenant_id))) return discordRedirect(res, 'invalid_invite');
            const role = db.prepare('SELECT * FROM team_roles WHERE id=? AND tenant_id=?').get(invite.role_id, invite.tenant_id);
            if (!role) return discordRedirect(res, 'invalid_invite');
            const safeName = String(identity.username || 'user').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 22) || 'user';
            let username = `dc_${safeName}_${identity.id.slice(-6)}`;
            if (db.prepare('SELECT username FROM users WHERE username=?').get(username)) username = `dc_${identity.id}`;
            db.exec('BEGIN');
            try {
              if (!db.prepare('DELETE FROM discord_invites WHERE token_hash=? AND expires>?').run(pending.inviteHash, Date.now()).changes)
                throw fail('Davet bağlantısı kullanılmış.', 409);
              db.prepare('INSERT INTO users(username,password,role) VALUES(?,?,?)').run(username, hashPassword(token()), 'user');
              db.prepare('INSERT INTO user_tenants(username,tenant_id) VALUES(?,?)').run(username, invite.tenant_id);
              db.prepare('INSERT INTO user_permissions(username,permissions,manager,role_id) VALUES(?,?,0,?)').run(username, role.permissions, role.id);
              db.prepare('INSERT INTO discord_accounts(discord_id,username) VALUES(?,?)').run(identity.id, username);
              db.exec('COMMIT');
            } catch (error) { db.exec('ROLLBACK'); throw error; }
            account = { username, role: 'user' };
            audit(username, 'tenant:' + invite.tenant_id, 'Discord ile kayıt oluşturuldu');
          }
          if (account.role !== 'owner' && !activeTenant(tenantFor(db, account))) return discordRedirect(res, 'inactive');
          const sessionId = token();
          sessions.set(hashToken(sessionId), { username: account.username, expires: Date.now() + 8 * 3600_000 });
          res.setHeader('Set-Cookie', [
            'fiveiso_discord_state=; HttpOnly; SameSite=Lax; Path=/api/auth/discord; Max-Age=0',
            `fiveiso_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${origin.startsWith('https:') ? '; Secure' : ''}`,
          ]);
          res.writeHead(302, { Location: account.role === 'owner' ? '/owner' : '/panel', 'Cache-Control': 'no-store' });
          res.end();
          return;
        } catch {
          return discordRedirect(res, 'failed');
        }
      }
      if (
        req.method === 'POST' &&
        path !== '/api/agent/heartbeat' &&
        path !== '/api/host/heartbeat' &&
        path !== '/api/agent/screens' &&
        path !== '/api/agent/inventory-image' &&
        !allowedOrigins.has(req.headers.origin)
      )
        throw fail('Kaynak adresi doğrulanamadı.', 403);
      if (path === '/api/host/heartbeat' && req.method === 'POST') {
        const id = req.headers['x-fiveiso-server'];
        const bearer = req.headers.authorization?.replace(/^Bearer /, '') || '';
        const srv = typeof id === 'string'
          ? db.prepare('SELECT * FROM servers WHERE id=?').get(id)
          : null;
        if (!srv || !sameToken(bearer, srv.token_hash))
          throw fail('Sunucu yöneticisi yetkilendirilemedi.', 401);
        const b = await body(req);
        const now = Date.now();
        hostStates.set(id, { seen: now, running: b.running === true });
        const queue = hostCommands.get(id) || [];
        const acknowledgements = Array.isArray(b.acks) ? b.acks.slice(0, 20) : [];
        for (const ack of acknowledgements) {
          const command = queue.find((item) => item.id === ack?.id);
          if (!command) continue;
          const status = ack.ok === true ? 'completed' : 'failed';
          const result = String(ack.result || '').slice(0, 300);
          db.prepare('UPDATE audit SET status=?,action=action || ? WHERE id=?').run(
            status,
            result ? ` · ${result}` : '',
            command.id,
          );
          queue.splice(queue.indexOf(command), 1);
        }
        for (const command of [...queue]) {
          if (now - command.created <= 60000) continue;
          db.prepare("UPDATE audit SET status='expired' WHERE id=?").run(command.id);
          queue.splice(queue.indexOf(command), 1);
        }
        hostCommands.set(id, queue);
        send(res, 200, {
          commands: queue.map(({ id: commandId, type }) => ({ id: commandId, type })),
        });
        return;
      }
      if (path === '/api/login' && req.method === 'POST') {
        const ip = req.socket.remoteAddress;
        const now = Date.now();
        for (const [key, item] of attempts)
          if (item.until < now) attempts.delete(key);
        const attempt = attempts.get(ip) || {
          count: 0,
          until: now + 15 * 60_000,
        };
        if (attempt.count >= 8)
          throw fail(
            'Çok fazla giriş denemesi. 15 dakika sonra tekrar dene.',
            429,
          );
        const b = await body(req);
        if (
          typeof b.username !== 'string' ||
          typeof b.password !== 'string' ||
          b.password.length > 256
        )
          throw fail('Geçersiz giriş.');
        const user = db
          .prepare('SELECT * FROM users WHERE username=?')
          .get(b.username);
        const verified = verifyPassword(b.password, user?.password || dummy);
        if (!user || !verified) {
          attempt.count++;
          attempts.set(ip, attempt);
          throw fail('Kullanıcı adı veya parola hatalı.', 401);
        }
        attempts.delete(ip);
        const id = token();
        sessions.set(hashToken(id), {
          username: user.username,
          expires: now + 8 * 3600_000,
        });
        res.setHeader(
          'Set-Cookie',
          `fiveiso_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${origin.startsWith('https:') ? '; Secure' : ''}`,
        );
        send(res, 200, { username: user.username, role: user.role, ...permissionRecord(db, user) });
        return;
      }
      if (path === '/api/agent/screens' && req.method === 'POST') {
        await screens.agent(req, res);
        return;
      }
      if (path === '/api/agent/inventory-image' && req.method === 'POST') {
        const id = req.headers['x-fiveiso-server'];
        const bearer = req.headers.authorization?.replace(/^Bearer /, '') || '';
        const srv = typeof id === 'string' ? db.prepare('SELECT * FROM servers WHERE id=?').get(id) : null;
        if (!srv || !sameToken(bearer, srv.token_hash)) throw fail('Ajan yetkilendirilemedi.', 401);
        const name = safeInventoryName(req.headers['x-fiveiso-image']);
        if (!name) throw fail('Görsel adı geçersiz.');
        const content = await rawBody(req);
        if (content.length < 8 || !content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
          throw fail('Yalnızca PNG görseller kabul edilir.');
        let serverBytes = 0;
        for (const [key, image] of inventoryImages) if (key.startsWith(id + ':')) serverBytes += image.length;
        const previous = inventoryImages.get(inventoryKey(id, name));
        if (serverBytes - (previous?.length || 0) + content.length > 64 * 1024 * 1024)
          throw fail('Sunucunun geçici görsel kotası doldu.', 413);
        inventoryImages.set(inventoryKey(id, name), content);
        send(res, 201, { ok: true });
        return;
      }
      if (path === '/api/agent/heartbeat' && req.method === 'POST') {
        const id = req.headers['x-fiveiso-server'];
        const bearer = req.headers.authorization?.replace(/^Bearer /, '') || '';
        const srv =
          typeof id === 'string'
            ? db.prepare('SELECT * FROM servers WHERE id=?').get(id)
            : null;
        if (!srv || !sameToken(bearer, srv.token_hash))
          throw fail('Ajan yetkilendirilemedi.', 401);
        const b = await body(req);
        const pollOnly = b.pollOnly === true;
        const now = Date.now();
        let currentItemCatalog = JSON.parse(srv.snapshot || '{}').itemCatalog || [];
        if (!pollOnly) {
        // Lua serializers can encode an empty list as an empty object.
        for (const field of ['players', 'resources']) {
          if (
            b[field] &&
            !Array.isArray(b[field]) &&
            typeof b[field] === 'object' &&
            Object.keys(b[field]).length === 0
          )
            b[field] = [];
        }
        if (b.mapBlips && !Array.isArray(b.mapBlips) && typeof b.mapBlips === 'object' && Object.keys(b.mapBlips).length === 0)
          b.mapBlips = [];
        if (
          !Array.isArray(b.players) ||
          !Array.isArray(b.resources) ||
          b.players.length > 2048 ||
          b.resources.length > 5000
        )
          throw fail('Geçersiz ölçüm.');
        const players = b.players.map((p) => ({
          id: String(p.id).slice(0, 8),
          name: String(p.name).slice(0, 100),
          ping: Math.max(0, Math.min(9999, Number(p.ping) || 0)),
          license:
            typeof p.license === 'string' ? p.license.slice(0, 120) : undefined,
          steamHex:
            typeof p.steamHex === 'string' && /^steam:[a-fA-F0-9]+$/.test(p.steamHex)
              ? p.steamHex.slice(0, 32)
              : undefined,
          discord:
            typeof p.discord === 'string' && /^discord:\d{16,22}$/.test(p.discord)
              ? p.discord.slice(0, 30)
              : undefined,
        }));
        const resources = b.resources.map((r) => ({
          name: String(r.name).slice(0, 80),
          state: String(r.state).slice(0, 20),
          version: String(r.version || '').slice(0, 30),
        }));
        const gameData = {};
        if (b.metrics && typeof b.metrics === 'object')
          gameData.metrics = Object.fromEntries(
            [
              'cpuPercent',
              'ramPercent',
              'totalMemory',
              'usedMemory',
              'cores',
            ].map((key) => [
              key,
              Math.max(0, Number.isFinite(b.metrics[key]) ? b.metrics[key] : 0),
            ]),
          );
        for (const field of [
          'accounts',
          'items',
          'jobs',
          'factions',
          'vehicles',
          'locations',
          'economy',
        ]) {
          gameData[field] = Array.isArray(b[field])
            ? b[field].slice(0, 2048)
            : [];
        }
        const itemCatalog = Array.isArray(b.itemCatalog) ? b.itemCatalog.slice(0, 5000) : [];
        gameData.itemCatalog = itemCatalog.flatMap((item) => {
          if (!item || typeof item !== 'object') return [];
          const name = String(item.name || '').slice(0, 80);
          const image = safeInventoryName(item.image || `${name}.png`);
          if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(name)) return [];
          return [{
            name,
            label: String(item.label || name).slice(0, 120),
            weight: Math.max(0, Number(item.weight) || 0),
            description: String(item.description || '').slice(0, 500),
            image,
            stack: item.stack !== false,
            group: ['weapons', 'health', 'food', 'drinks', 'other'].includes(item.group) ? item.group : 'other',
          }];
        });
        const snapshot = {
          ...gameData,
          capabilities: Array.isArray(b.capabilities)
            ? b.capabilities.filter((c) =>
                [...GAME_ACTIONS, ...DB_ACTIONS, 'consoleCommand'].includes(c),
              )
            : [],
          players,
          resources,
          maxPlayers: Math.max(1, Math.min(2048, Number(b.maxPlayers) || 64)),
          uptime: Math.max(0, Number(b.uptime) || 0),
          joinLocked: b.joinLocked === true,
        };
        currentItemCatalog = snapshot.itemCatalog;
        db.prepare('UPDATE servers SET snapshot=?,last_seen=? WHERE id=?').run(
          JSON.stringify(snapshot),
          now,
          id,
        );
        if (Array.isArray(b.mapBlips) && b.mapBlips.length <= 300) {
          mapBlipsByServer.set(id, b.mapBlips);
          const legacy = db.prepare('SELECT id,sprite,color_code AS colorCode,label,x,y,actor FROM map_blips WHERE server_id=? ORDER BY created,id').all(id);
          const importing = db.prepare("SELECT id FROM commands WHERE server_id=? AND status IN ('queued','dispatched') AND payload LIKE '%\"op\":\"import\"%' LIMIT 1").get(id);
          if (legacy.length && !importing) {
            const cid = audit('system', id, 'Eski blipler müşteri SQL veritabanına taşınıyor', 'queued');
            db.prepare('INSERT INTO commands(id,server_id,actor,payload,status,created) VALUES(?,?,?,?,?,?)').run(cid, id, 'system', JSON.stringify({ type: 'mapBlip', params: { op: 'import', rows: legacy } }), 'queued', now);
          }
        }
        const latest = db
          .prepare('SELECT MAX(time) AS time FROM history WHERE server_id=?')
          .get(id);
        if (!latest.time || now - latest.time >= 60000)
          db.prepare('INSERT INTO history VALUES(?,?,?)').run(
            id,
            now,
            players.length,
          );
        db.prepare('DELETE FROM history WHERE time<?').run(now - 86400000);
        db.prepare('DELETE FROM command_data WHERE created<?').run(
          now - 3600000,
        );
        }
        for (const ack of (Array.isArray(b.acks) ? b.acks : []).slice(0, 100)) {
          if (typeof ack.id !== 'string') continue;
          const cmd = db
            .prepare(
              "SELECT * FROM commands WHERE id=? AND server_id=? AND status='dispatched'",
            )
            .get(ack.id, id);
          if (cmd) {
            const status = ack.ok === true ? 'completed' : 'failed';
            const action = mapBlipActions.get(cmd.id) || JSON.parse(cmd.payload);
            if (action.type === 'mapBlip') {
              if (ack.data?.blips && !Array.isArray(ack.data.blips) && typeof ack.data.blips === 'object' && Object.keys(ack.data.blips).length === 0)
                ack.data.blips = [];
              if (ack.ok === true && Array.isArray(ack.data?.blips)) {
                mapBlipsByServer.set(id, ack.data.blips);
                if (action.params?.op === 'import') db.prepare('DELETE FROM map_blips WHERE server_id=?').run(id);
              }
              pendingMapBlips.get(cmd.id)?.({ ok: ack.ok === true, result: String(ack.result || '') });
              pendingMapBlips.delete(cmd.id);
              mapBlipActions.delete(cmd.id);
            }
            if (
              DB_ACTIONS.includes(action.type) &&
              ack.ok === true &&
              ack.data &&
              typeof ack.data === 'object'
            ) {
              const data = JSON.stringify(ack.data);
              if (Buffer.byteLength(data) <= 200000)
                db.prepare(
                  'INSERT OR REPLACE INTO command_data VALUES(?,?,?)',
                ).run(cmd.id, data, now);
            }
            const result = String(ack.result || '').slice(0, 300);
            db.prepare('UPDATE commands SET status=?,result=? WHERE id=?').run(
              status,
              result,
              ack.id,
            );
            db.prepare(
              'UPDATE audit SET status=?,action=action || ? WHERE id=?',
            ).run(status, result ? ` · ${result}` : '', ack.id);
            if (action.type === 'mapBlip') db.prepare('DELETE FROM commands WHERE id=?').run(cmd.id);
          }
        }
        const stale = db
          .prepare(
            "SELECT id FROM commands WHERE server_id=? AND status IN ('queued','dispatched') AND created<?",
          )
          .all(id, now - 60000);
        for (const c of stale) {
          db.prepare("UPDATE commands SET status='expired' WHERE id=?").run(
            c.id,
          );
          db.prepare("UPDATE audit SET status='expired' WHERE id=?").run(c.id);
        }
        const commands = db
          .prepare(
            "SELECT * FROM commands WHERE server_id=? AND status='queued' ORDER BY created LIMIT 20",
          )
          .all(id);
        const deliverable = commands.filter((c) => {
          const action = mapBlipActions.get(c.id) || JSON.parse(c.payload);
          const actor = db
            .prepare('SELECT username,role FROM users WHERE username=?')
            .get(c.actor);
          const allowed =
            (c.actor === 'system' && action.type === 'mapBlip' && action.params?.op === 'import') ||
            (actor && (action.type === 'mapBlip'
              ? mapBlipActions.has(c.id) && access(db, actor, id, 'map')
              : can(db, actor, action.type) && access(db, actor, id, ACTION_FEATURE[action.type])));
          if (!allowed) {
            db.prepare("UPDATE commands SET status='cancelled' WHERE id=?").run(
              c.id,
            );
            db.prepare("UPDATE audit SET status='cancelled' WHERE id=?").run(
              c.id,
            );
            pendingMapBlips.get(c.id)?.({ ok: false, result: 'Blip işlemi yetkisi kaldırıldı.' });
            pendingMapBlips.delete(c.id);
            mapBlipActions.delete(c.id);
          }
          return allowed;
        });
        for (const c of deliverable) {
          db.prepare("UPDATE commands SET status='dispatched' WHERE id=?").run(
            c.id,
          );
          db.prepare("UPDATE audit SET status='dispatched' WHERE id=?").run(
            c.id,
          );
        }
        const requestedImages = [];
        for (const item of currentItemCatalog) {
          const name = safeInventoryName(item.image || `${item.name}.png`);
          if (!name || requestedImages.includes(name)) continue;
          if (!inventoryImages.has(inventoryKey(id, name))) requestedImages.push(name);
          if (requestedImages.length >= 20) break;
        }
        send(res, 200, {
          commands: deliverable.map((c) => ({
            id: c.id,
            ...(mapBlipActions.get(c.id) || JSON.parse(c.payload)),
          })),
          bans: db
            .prepare('SELECT license,reason FROM bans WHERE server_id=?')
            .all(id),
          inventoryImages: requestedImages,
        });
        return;
      }
      for (const [key, session] of sessions)
        if (session.expires < Date.now()) sessions.delete(key);
      const cookie =
        req.headers.cookie?.match(
          /(?:^|;\s*)fiveiso_session=([a-f0-9]{64})(?:;|$)/,
        )?.[1] || '';
      const session = sessions.get(hashToken(cookie));
      const user = session
        ? db
            .prepare('SELECT username,role FROM users WHERE username=?')
            .get(session.username)
        : null;
      if (!user) throw fail('Giriş yapmalısın.', 401);
      if (user.role !== 'owner' && !activeTenant(tenantFor(db, user)))
        throw fail('Panel erişimi durdurulmuş veya süresi dolmuş.', 403);
      if (await screens.viewer(req, res, path, user, cookie)) return;
      const inventoryImageMatch = path.match(/^\/api\/servers\/([^/]+)\/inventory-images\/([^/]+)$/);
      if (inventoryImageMatch && (req.method === 'GET' || req.method === 'HEAD')) {
        const id = decodeURIComponent(inventoryImageMatch[1]);
        const name = safeInventoryName(decodeURIComponent(inventoryImageMatch[2]));
        if (!name || !access(db, user, id, 'items')) throw fail('Görsel bulunamadı.', 404);
        const content = inventoryImages.get(inventoryKey(id, name));
        if (!content) throw fail('Görsel bulunamadı.', 404);
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=3600' });
        res.end(req.method === 'HEAD' ? undefined : content);
        return;
      }
      if (path === '/api/me' && req.method === 'GET') {
        send(res, 200, {
          ...user,
          ...permissionRecord(db, user),
          tenant: user.role === 'owner' ? null : tenantFor(db, user),
          features:
            user.role === 'owner'
              ? []
              : visibleFeatures(db, user),
        });
        return;
      }
      if (path === '/api/logout' && req.method === 'POST') {
        sessions.delete(hashToken(cookie));
        res.setHeader(
          'Set-Cookie',
          'fiveiso_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
        );
        send(res, 200, { ok: true });
        return;
      }

      if (path === '/api/team/roles' && req.method === 'POST') {
        if (!access(db, user, null, 'team') || !permissionRecord(db, user).manager)
          throw fail('Rol yönetimi için panel sahibi yetkisi gerekli.', 403);
        const b = await body(req);
        const tenant = tenantFor(db, user);
        const name = typeof b.name === 'string' ? b.name.trim() : '';
        if (name.length < 2 || name.length > 50)
          throw fail('Rol adı 2–50 karakter olmalı.');
        const permissions = cleanPermissions(tenant, b.permissions);
        const previous = b.id
          ? db.prepare('SELECT id FROM team_roles WHERE id=? AND tenant_id=?').get(b.id, tenant.id)
          : null;
        if (b.id && !previous) throw fail('Rol bulunamadı.', 404);
        if (!b.id && db.prepare('SELECT COUNT(*) AS count FROM team_roles WHERE tenant_id=?').get(tenant.id).count >= 50)
          throw fail('En fazla 50 rol oluşturulabilir.', 409);
        const id = b.id || randomUUID();
        try {
          db.prepare('INSERT INTO team_roles(id,tenant_id,name,permissions) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,permissions=excluded.permissions')
            .run(id, tenant.id, name, JSON.stringify(permissions));
        } catch (error) {
          if (String(error.message).includes('UNIQUE')) throw fail('Bu rol adı zaten kullanılıyor.', 409);
          throw error;
        }
        audit(user.username, 'tenant:' + tenant.id, `Rol kaydedildi: ${name}`);
        send(res, 200, { id });
        return;
      }
      if (path === '/api/team/discord-invites' && req.method === 'POST') {
        if (!discordEnabled) throw fail('Discord girişi henüz yapılandırılmadı.', 409);
        if (!access(db, user, null, 'team') || !permissionRecord(db, user).manager)
          throw fail('Davet oluşturmak için panel sahibi yetkisi gerekli.', 403);
        const b = await body(req);
        const tenant = tenantFor(db, user);
        const role = typeof b.roleId === 'string'
          ? db.prepare('SELECT id FROM team_roles WHERE id=? AND tenant_id=?').get(b.roleId, tenant.id)
          : null;
        if (!role) throw fail('Davet için geçerli bir rol seçin.');
        db.prepare('DELETE FROM discord_invites WHERE expires<?').run(Date.now());
        const invite = token();
        db.prepare('INSERT INTO discord_invites(token_hash,tenant_id,role_id,expires,created_by) VALUES(?,?,?,?,?)')
          .run(hashToken(invite), tenant.id, role.id, Date.now() + 7 * 86400_000, user.username);
        audit(user.username, 'tenant:' + tenant.id, 'Discord daveti oluşturuldu');
        send(res, 200, { invite, expiresInDays: 7 });
        return;
      }
      if (path === '/api/team/users' && req.method === 'POST') {
        if (!access(db, user, null, 'team') || !hasPermission(db, user, 'teamManage'))
          throw fail('Müşteri yöneticisi yetkisi gerekli.', 403);
        const b = await body(req);
        const tenant = tenantFor(db, user);
        const previous = db
          .prepare('SELECT username,role,password FROM users WHERE username=?')
          .get(b.username);
        if (
          typeof b.username !== 'string' ||
          !/^[a-zA-Z0-9_.-]{3,40}$/.test(b.username) ||
          ((!previous || b.password) &&
            (typeof b.password !== 'string' || b.password.length < 12 || b.password.length > 256))
        )
          throw fail('Geçersiz hesap bilgileri.');
        const roleId = b.roleId == null ? null : b.roleId;
        const assignedRole = roleId && typeof roleId === 'string'
          ? db.prepare('SELECT id,permissions FROM team_roles WHERE id=? AND tenant_id=?').get(roleId, tenant.id)
          : null;
        if (roleId && !assignedRole) throw fail('Rol bulunamadı.', 404);
        if (roleId && !permissionRecord(db, user).manager)
          throw fail('Rol atamak için panel sahibi yetkisi gerekli.', 403);
        const memberPermissions = assignedRole
          ? JSON.parse(assignedRole.permissions)
          : cleanPermissions(tenant, b.permissions);
        if (
          !permissionRecord(db, user).manager &&
          memberPermissions.some((permission) => !hasPermission(db, user, permission))
        )
          throw fail('Kendinizde olmayan bir yetkiyi veremezsiniz.', 403);
        if (
          previous &&
          (previous.role === 'owner' ||
            tenantFor(db, previous).id !== tenant.id)
        )
          throw fail('Bu kullanıcı adı kullanılamıyor.', 409);
        if (b.username === user.username)
          throw fail(
            'Kendi hesabını değiştirmek için ana panel sahibini kullan.',
            403,
          );
        if (previous && permissionRecord(db, previous).manager)
          throw fail('Panel sahibinin hesabı bu ekrandan değiştirilemez.', 403);
        db.exec('BEGIN');
        try {
          db.prepare(
            'INSERT INTO users VALUES(?,?,?) ON CONFLICT(username) DO UPDATE SET password=excluded.password,role=excluded.role',
          ).run(b.username, b.password ? hashPassword(b.password) : previous.password, 'user');
          db.prepare(
            'INSERT INTO user_tenants VALUES(?,?) ON CONFLICT(username) DO UPDATE SET tenant_id=excluded.tenant_id',
          ).run(b.username, tenant.id);
          db.prepare(
            'INSERT INTO user_permissions(username,permissions,manager,role_id) VALUES(?,?,0,?) ON CONFLICT(username) DO UPDATE SET permissions=excluded.permissions,manager=0,role_id=excluded.role_id',
          ).run(b.username, JSON.stringify(memberPermissions), roleId);
          db.exec('COMMIT');
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
        for (const [key, session] of sessions)
          if (session.username === b.username) sessions.delete(key);
        audit(
          user.username,
          'tenant:' + tenant.id,
          'Ekip hesabı güncellendi: ' + b.username,
        );
        send(res, 200, { ok: true });
        return;
      }
      if (path.startsWith('/api/owner')) {
        if (user.role !== 'owner')
          throw fail('Yalnızca ana panel sahibi erişebilir.', 403);
        if (path === '/api/owner' && req.method === 'GET') {
          send(res, 200, {
            features: FEATURES,
            tenants: db
              .prepare('SELECT * FROM tenants')
              .all()
              .map((t) => ({ ...t, features: JSON.parse(t.features) })),
            users: db
              .prepare(
                "SELECT u.username,u.role,ut.tenant_id AS tenantId FROM users u LEFT JOIN user_tenants ut ON ut.username=u.username WHERE u.role!='owner'",
              )
              .all(),
            servers: db
              .prepare(
                'SELECT s.id,s.name,st.tenant_id AS tenantId FROM servers s LEFT JOIN server_tenants st ON st.server_id=s.id',
              )
              .all(),
          });
          return;
        }
        if (path === '/api/owner/tenants' && req.method === 'POST') {
          const b = await body(req);
          if (
            typeof b.name !== 'string' ||
            !b.name.trim() ||
            b.name.length > 80
          )
            throw fail('Müşteri adı gerekli.');
          const features = cleanFeatures(b.features);
          const expires = b.expires || null;
          if (
            expires &&
            (!Number.isFinite(Date.parse(expires)) ||
              !String(expires).match(/^\d{4}-\d{2}-\d{2}/))
          )
            throw fail('Geçersiz bitiş tarihi.');
          const id = b.id || randomUUID();
          if (b.id && !db.prepare('SELECT id FROM tenants WHERE id=?').get(id))
            throw fail('Müşteri bulunamadı.', 404);
          db.prepare(
            'INSERT INTO tenants VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,enabled=excluded.enabled,expires=excluded.expires,features=excluded.features',
          ).run(
            id,
            b.name.trim(),
            b.enabled === false ? 0 : 1,
            expires,
            JSON.stringify(features),
          );
          audit(
            user.username,
            'owner',
            'Müşteri / modül ayarları güncellendi: ' + b.name,
          );
          send(res, 200, { id });
          return;
        }
        if (path === '/api/owner/users' && req.method === 'POST') {
          const b = await body(req);
          if (
            typeof b.username !== 'string' ||
            !/^[a-zA-Z0-9_.-]{3,40}$/.test(b.username)
          )
            throw fail('Geçersiz hesap bilgileri.');
          if (!db.prepare('SELECT id FROM tenants WHERE id=?').get(b.tenantId))
            throw fail('Müşteri bulunamadı.', 404);
          const previous = db
            .prepare('SELECT * FROM users WHERE username=?')
            .get(b.username);
          if (previous?.role === 'owner')
            throw fail('Sahip hesabı bu ekrandan değiştirilemez.', 403);
          if (
            (!previous || b.password) &&
            (typeof b.password !== 'string' ||
              b.password.length < 12 ||
              b.password.length > 256)
          )
            throw fail('Parola 12–256 karakter olmalı.');
          db.exec('BEGIN');
          try {
            db.prepare(
              'INSERT INTO users VALUES(?,?,?) ON CONFLICT(username) DO UPDATE SET password=excluded.password,role=excluded.role',
            ).run(
              b.username,
              b.password ? hashPassword(b.password) : previous.password,
              'user',
            );
            db.prepare(
              'INSERT INTO user_tenants VALUES(?,?) ON CONFLICT(username) DO UPDATE SET tenant_id=excluded.tenant_id',
            ).run(b.username, b.tenantId);
            db.prepare(
              'INSERT INTO user_permissions(username,permissions,manager,role_id) VALUES(?,?,1,NULL) ON CONFLICT(username) DO UPDATE SET permissions=excluded.permissions,manager=1,role_id=NULL',
            ).run(b.username, JSON.stringify(ALL_PERMISSIONS));
            db.exec('COMMIT');
          } catch (e) {
            db.exec('ROLLBACK');
            throw e;
          }
          for (const [key, session] of sessions)
            if (session.username === b.username) sessions.delete(key);
          audit(user.username, 'owner', 'Kullanıcı güncellendi: ' + b.username);
          send(res, 200, { ok: true });
          return;
        }
        if (path === '/api/owner/assign-server' && req.method === 'POST') {
          const b = await body(req);
          if (
            !db.prepare('SELECT id FROM tenants WHERE id=?').get(b.tenantId) ||
            !db.prepare('SELECT id FROM servers WHERE id=?').get(b.serverId)
          )
            throw fail('Müşteri veya sunucu bulunamadı.', 404);
          db.prepare(
            'INSERT INTO server_tenants VALUES(?,?) ON CONFLICT(server_id) DO UPDATE SET tenant_id=excluded.tenant_id',
          ).run(b.serverId, b.tenantId);
          audit(
            user.username,
            b.serverId,
            'Sunucu müşteri ataması güncellendi',
          );
          send(res, 200, { ok: true });
          return;
        }
        throw fail('İşlem bulunamadı.', 404);
      }
      if (path === '/api/state' && req.method === 'GET') {
        const servers = db
          .prepare(
            'SELECT id,name,region,framework,last_seen,snapshot FROM servers',
          )
          .all()
          .filter((s) => access(db, user, s.id))
          .map((s) => ({
            ...projectGameData(JSON.parse(s.snapshot), (feature) =>
              access(db, user, s.id, feature),
            ),
            id: s.id,
            name: s.name,
            region: s.region,
            framework: s.framework,
            lastSeen: s.last_seen,
            online: Date.now() - s.last_seen < 20000,
            supervisorOnline: Date.now() - (hostStates.get(s.id)?.seen || 0) < 10000,
            processRunning: hostStates.get(s.id)?.running === true,
            players: access(db, user, s.id, 'players')
              ? JSON.parse(s.snapshot).players || []
              : [],
            resources: access(db, user, s.id, 'resources')
              ? JSON.parse(s.snapshot).resources || []
              : [],
            maxPlayers: JSON.parse(s.snapshot).maxPlayers || 64,
            uptime: JSON.parse(s.snapshot).uptime || 0,
            history: db
              .prepare(
                'SELECT time,players FROM history WHERE server_id=? ORDER BY time DESC LIMIT 1440',
              )
              .all(s.id)
              .reverse()
              .map((h) => ({
                time: new Date(h.time).toLocaleTimeString('tr-TR', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                players: h.players,
              })),
          }));
        send(res, 200, {
          servers,
          features:
            user.role === 'owner'
              ? []
              : visibleFeatures(db, user),
          permissions: permissionRecord(db, user).permissions,
          manager: permissionRecord(db, user).manager,
          permissionOptions: user.role === 'owner' ? {} : Object.fromEntries(
            Object.entries(PERMISSIONS).filter(([key]) =>
              cleanPermissions(tenantFor(db, user), [key]).length === 1 &&
              (permissionRecord(db, user).manager || hasPermission(db, user, key)),
            ),
          ),
          roles: access(db, user, null, 'team')
            ? db.prepare('SELECT id,name,permissions FROM team_roles WHERE tenant_id=? ORDER BY name COLLATE NOCASE').all(tenantFor(db, user).id)
                .map((role) => ({ ...role, permissions: JSON.parse(role.permissions) }))
            : [],
          users: access(db, user, null, 'team')
            ? db
                .prepare("SELECT u.username,u.role,p.permissions,p.manager FROM users u JOIN user_permissions p ON p.username=u.username WHERE u.role!='owner'")
                .all()
                .filter(
                  (u) =>
                    tenantFor(db, u).id === tenantFor(db, user).id,
                )
                .map((u) => ({ username: u.username, ...permissionRecord(db, u) }))
            : [],
          audit: db
            .prepare(
              'SELECT id,time,actor,server_id AS serverId,action,status FROM audit ORDER BY time DESC',
            )
            .all()
            .filter(
              (a) =>
                access(db, user, a.serverId, 'audit') ||
                (access(db, user, a.serverId, 'console') &&
                  a.action.startsWith('consoleCommand ')),
            )
            .slice(0, 500),
          bans: db
            .prepare(
              'SELECT id,server_id AS serverId,license,reason,created FROM bans',
            )
            .all()
            .filter((b) => access(db, user, b.serverId, 'bans')),
        });
        return;
      }
      if (path === '/api/servers' && req.method === 'POST') {
        if (user.role !== 'owner')
          throw fail('Sunucu eklemek için ana panel sahibi gerekli.', 403);
        const b = await body(req);
        for (const field of ['name', 'region', 'framework'])
          if (
            typeof b[field] !== 'string' ||
            !b[field].trim() ||
            b[field].length > 80
          )
            throw fail('Sunucu bilgilerini kontrol et.');
        const id = randomUUID();
        const secret = token();
        db.prepare(
          'INSERT INTO servers(id,name,region,framework,token_hash) VALUES(?,?,?,?,?)',
        ).run(
          id,
          b.name.trim(),
          b.region.trim(),
          b.framework.trim(),
          hashToken(secret),
        );
        db.prepare('INSERT INTO server_tenants VALUES(?,?)').run(id, 'local');
        audit(user.username, id, 'Sunucu eklendi');
        send(res, 201, { id, token: secret });
        return;
      }
      const blipMatch = path.match(/^\/api\/servers\/([^/]+)\/map-blips$/);

      if (blipMatch && ['GET', 'POST'].includes(req.method)) {
        const id = decodeURIComponent(blipMatch[1]);

        if (!db.prepare('SELECT id FROM servers WHERE id=?').get(id)) throw fail('Sunucu bulunamadı.', 404);
        if (!access(db, user, id, 'map')) throw fail('Canlı konumlar erişimin yok.', 403);

        if (req.method === 'GET') {
          send(res, 200, {
            blips: mapBlipsByServer.get(id) || [],
          });
          return;
        }

        const b = await body(req);
        const blipSize = b?.size === undefined ? 1 : b.size;
        if (!['add', 'update', 'delete'].includes(b?.op)) throw fail('Blip işlemi geçersiz.');
        if (b.op !== 'add' && (typeof b.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(b.id))) throw fail('Blip kimliği geçersiz.');
        if (b.op !== 'delete' && (
          !Number.isInteger(b.sprite) || !blipSprites.has(b.sprite) ||
          typeof b.colorCode !== 'string' || !blipColors.has(b.colorCode) ||
          typeof b.label !== 'string' || !b.label.trim() || b.label.trim().length > 60 ||
          typeof blipSize !== 'number' || !Number.isFinite(blipSize) || blipSize < 0.5 || blipSize > 3
        )) throw fail('Blip bilgileri geçersiz.');
        if (b.op === 'add' && (
          typeof b.x !== 'number' || !Number.isFinite(b.x) || Math.abs(b.x) > 10000 ||
          typeof b.y !== 'number' || !Number.isFinite(b.y) || Math.abs(b.y) > 10000
        )) throw fail('Blip bilgileri geçersiz.');
        const current = mapBlipsByServer.get(id);
        const lastSeen = db.prepare('SELECT last_seen FROM servers WHERE id=?').get(id).last_seen;
        if (Date.now() - lastSeen > 20000 || !current) throw fail('Sunucu veya blip veritabanı hazır değil.', 409);
        if (b.op === 'add' && current.length >= 300) throw fail('Bu sunucuda en fazla 300 harita blipi olabilir.', 409);
        if (b.op !== 'add' && !current.some((entry) => entry.id === b.id)) throw fail('Blip bulunamadı.', 404);

        const markerId = b.op === 'add' ? randomUUID() : b.id;
        const cid = audit(user.username, id, `Harita blipi ${b.op}: ${markerId}`, 'queued');
        mapBlipActions.set(cid, { type: 'mapBlip', params: { op: b.op, id: markerId, sprite: b.sprite, colorCode: b.colorCode, label: b.label?.trim(), size: blipSize, x: b.x, y: b.y, actor: user.username } });
        db.prepare('INSERT INTO commands(id,server_id,actor,payload,status,created) VALUES(?,?,?,?,?,?)').run(
          cid, id, user.username,
          JSON.stringify({ type: 'mapBlip' }),
          'queued', Date.now(),
        );
        agentStream.wake(id);
        const result = await new Promise((resolve) => {
          const timer = setTimeout(() => { pendingMapBlips.delete(cid); mapBlipActions.delete(cid); resolve({ ok: false, result: 'Blip işlemi zaman aşımına uğradı.' }); }, 20000);
          pendingMapBlips.set(cid, (value) => { clearTimeout(timer); resolve(value); });
        });
        if (!result.ok) throw fail(result.result || 'Blip işlemi başarısız.', 409);
        send(res, b.op === 'add' ? 201 : 200, b.op === 'add' ? { id: markerId } : { ok: true });
        return;
      }
      const resultMatch = path.match(/^\/api\/commands\/([^/]+)$/);
      if (resultMatch && req.method === 'GET') {
        const c = db
          .prepare('SELECT * FROM commands WHERE id=?')
          .get(decodeURIComponent(resultMatch[1]));
        if (!c || (c.actor !== user.username && user.role !== 'owner'))
          throw fail('İşlem bulunamadı.', 404);
        const type = JSON.parse(c.payload).type;
        if (
          !can(db, user, type) ||
          !access(db, user, c.server_id, ACTION_FEATURE[type])
        )
          throw fail('Erişimin yok.', 403);
        const data = db
          .prepare('SELECT data FROM command_data WHERE id=? AND created>?')
          .get(c.id, Date.now() - 3600000);
        send(res, 200, {
          status: c.status,
          result: c.result,
          data: data ? JSON.parse(data.data) : null,
        });
        return;
      }
      const match = path.match(/^\/api\/servers\/([^/]+)\/actions$/);
      if (match && req.method === 'POST') {
        const id = decodeURIComponent(match[1]);
        const srv = db.prepare('SELECT * FROM servers WHERE id=?').get(id);
        if (!srv) throw fail('Sunucu bulunamadı.', 404);
        const b = await body(req);
        if (!access(db, user, id, ACTION_FEATURE[b.type]))
          throw fail('Bu sunucu veya modül için erişimin yok.', 403);
        if (!can(db, user, b.type))
          throw fail('Bu işlem için yetkin yok.', 403);
        const snap = JSON.parse(srv.snapshot);
        validateAction(b, snap);
        if (['serverStart', 'serverStop', 'serverRestart'].includes(b.type)) {
          const state = hostStates.get(id);
          if (!state || Date.now() - state.seen >= 10000)
            throw fail('FiveISO sunucu yöneticisi çevrimdışı.', 409);
          if (b.type === 'serverStart' && state.running)
            throw fail('Sunucu zaten çalışıyor.', 409);
          if (b.type !== 'serverStart' && !state.running)
            throw fail('Sunucu zaten kapalı.', 409);
          const queue = hostCommands.get(id) || [];
          if (queue.length >= 10) throw fail('Sunucu işlem kuyruğu dolu.', 429);
          const labels = {
            serverStart: 'Sunucu başlatılıyor',
            serverStop: 'Sunucu durduruluyor',
            serverRestart: 'Sunucu yeniden başlatılıyor',
          };
          const cid = audit(user.username, id, labels[b.type], 'queued');
          queue.push({ id: cid, type: b.type, created: Date.now() });
          hostCommands.set(id, queue);
          send(res, 202, { id: cid, status: 'queued' });
          return;
        }
        let effective = b;
        if (b.type === 'consoleCommand') {
          const shortcut = b.value.trim().match(
            /^(kill|heal|revive|freeze|unfreeze)\s+(\d{1,8})$/i,
          );
          if (shortcut) {
            effective = {
              type: shortcut[1].toLowerCase(),
              target: shortcut[2],
              value: 'Panel konsol komutu',
            };
            if (
              !access(db, user, id, ACTION_FEATURE[effective.type]) ||
              !can(db, user, effective.type)
            )
              throw fail('Bu oyuncu işlemi için ayrıca ilgili işlem yetkisi gerekli.', 403);
            validateAction(effective, snap);
          }
        }
        if (effective.type === 'unban') {
          const result = db
            .prepare('DELETE FROM bans WHERE id=? AND server_id=?')
            .run(effective.target, id);
          if (!result.changes) throw fail('Yasak kaydı bulunamadı.', 404);
          audit(user.username, id, `Yasak kaldırıldı: ${effective.target}`);
          send(res, 200, { ok: true });
          return;
        }
        if (Date.now() - srv.last_seen > 20000)
          throw fail('Sunucu çevrimdışı. İşlem gönderilmedi.', 409);
        const queued = db
          .prepare(
            "SELECT COUNT(*) AS count FROM commands WHERE server_id=? AND status IN ('queued','dispatched')",
          )
          .get(id);
        if (queued.count >= 100) throw fail('İşlem kuyruğu dolu.', 429);
        const action = {
          type: effective.type,
          target: effective.target,
          value: effective.value,
          params: effective.params,
        };
        if (['kick', 'ban', ...GAME_ACTIONS.filter((type) => !['setJoinLock', 'createJob', 'updateJob', 'deleteJob', 'createGang'].includes(type))].includes(effective.type)) {
          action.license = snap.players.find((p) => p.id === effective.target)?.license;
          if (!action.license) throw fail('Oyuncunun lisansı doğrulanamadı.');
        }
        db.exec('BEGIN');
        try {
          if (effective.type === 'ban')
            db.prepare(
              'INSERT INTO bans VALUES(?,?,?,?,?) ON CONFLICT(server_id,license) DO UPDATE SET reason=excluded.reason',
            ).run(
              randomUUID(),
              id,
              action.license,
              effective.value,
              new Date().toISOString(),
            );
          const cid = audit(
            user.username,
            id,
            b.type === 'consoleCommand'
              ? `consoleCommand · ${b.value}`
              : `${effective.type} ${effective.target || ''}${effective.value ? ' · ' + effective.value : ''}`,
            'queued',
          );
          db.prepare(
            'INSERT INTO commands(id,server_id,actor,payload,status,created) VALUES(?,?,?,?,?,?)',
          ).run(
            cid,
            id,
            user.username,
            JSON.stringify(action),
            'queued',
            Date.now(),
          );
          db.exec('COMMIT');
          agentStream.wake(id);
          send(res, 202, { id: cid, status: 'queued' });
          return;
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      }
      throw fail('İşlem bulunamadı.', 404);
    } catch (e) {
      send(res, e.status || 400, {
        error: e.message?.includes('SQL') ? 'İstek tamamlanamadı.' : e.message,
      });
    }
  });
  const agentStream = createAgentStream(server, db);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    screens.dispose();
    agentStream.dispose();
  };
  server.on('close', dispose);
  return { server, db, dispose };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const app = createPanel();
  const host = process.env.PANEL_HOST || '127.0.0.1';
  const port = Number(process.env.PANEL_PORT || 3030);
  app.server.listen(port, host, () =>
    console.log(
      `FiveISO merkez: ${process.env.PANEL_ORIGIN || `http://localhost:${port}`}`,
    ),
  );
  const shutdown = () => {
    app.dispose();
    app.server.close(() => {
      app.db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
