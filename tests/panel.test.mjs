import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createPanel } from '../server/index.mjs';
import { openStore } from '../server/store.mjs';
import { hashPassword, verifyPassword } from '../server/security.mjs';
const origin = 'http://localhost:3030';
async function fixture(t, options = {}) {
  const db = openStore(':memory:');
  for (const role of ['owner', 'admin', 'moderator', 'viewer'])
    db.prepare('INSERT INTO users VALUES(?,?,?)').run(
      role,
      hashPassword('test-password-123'),
      role,
    );
  const { server } = createPanel({ db, origin, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    server.close();
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, body, cookie = '', headers = {}) => {
    const r = await fetch(base + '/api' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        Cookie: cookie,
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get('set-cookie')?.split(';')[0],
    };
  };
  const login = async (role) =>
    (await request('/login', { username: role, password: 'test-password-123' }))
      .cookie;
  return { db, request, login, base };
}
const snapshot = {
  players: [{ id: '1', name: 'Arda', ping: 35, license: 'license:123' }],
  resources: [
    { name: 'qb-core', state: 'started' },
    { name: 'fiveiso', state: 'started' },
  ],
  maxPlayers: 128,
  uptime: 60,
  acks: [],
};
test('envanter görselleri ajan üzerinden aktarılır ve yalnızca bellekte sunulur', async (t) => {
  const { request, login, base } = await fixture(t);
  const owner = await login('owner');
  const admin = await login('admin');
  const agent = (await request('/servers', { name: 'Inventory', region: 'TR', framework: 'QBCore' }, owner)).data;
  const headers = { 'X-FiveISO-Server': agent.id, Authorization: `Bearer ${agent.token}` };
  const heartbeat = await request('/agent/heartbeat', {
    ...snapshot,
    itemCatalog: [{ name: 'water', label: 'Su', image: 'water.png', group: 'drinks' }],
  }, '', headers);
  assert.deepEqual(heartbeat.data.inventoryImages, ['water.png']);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const uploaded = await fetch(base + '/api/agent/inventory-image', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'image/png', 'X-FiveISO-Image': 'water.png' },
    body: png,
  });
  assert.equal(uploaded.status, 201);
  const image = await fetch(base + `/api/servers/${agent.id}/inventory-images/water.png`, {
    headers: { Cookie: admin },
  });
  assert.equal(image.status, 200);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  const next = await request('/agent/heartbeat', { pollOnly: true }, '', headers);
  assert.deepEqual(next.data.inventoryImages, []);
});
test('ajan WebSocket sinyali komutu uyandırır; komut mevcut güvenli kuyruktan alınır', async (t) => {
  const { request, login, base } = await fixture(t);
  const owner = await login('owner');
  const manager = await login('admin');
  const agent = (await request('/servers', { name: 'Socket', region: 'TR', framework: 'QBCore' }, owner)).data;
  const headers = { 'X-FiveISO-Server': agent.id, Authorization: `Bearer ${agent.token}` };
  await request('/agent/heartbeat', { ...snapshot, capabilities: ['consoleCommand'] }, '', headers);
  const streamUrl = base.replace(/^http/, 'ws') + '/api/agent/stream';
  const rejected = new WebSocket(streamUrl, { headers: { ...headers, Authorization: 'Bearer invalid' } });
  await assert.rejects(once(rejected, 'open'), /401/);
  const ws = new WebSocket(streamUrl, { headers });
  const firstWake = once(ws, 'message');
  await once(ws, 'open');
  assert.equal((await firstWake)[0].toString(), 'wake');
  const nextWake = once(ws, 'message');
  const queued = await request(`/servers/${agent.id}/actions`, { type: 'consoleCommand', value: 'status' }, manager);
  assert.equal(queued.status, 202);
  assert.equal((await nextWake)[0].toString(), 'wake');
  const delivered = await request('/agent/heartbeat', { pollOnly: true }, '', headers);
  assert.equal(delivered.data.commands[0].id, queued.data.id);
  const closed = once(ws, 'close');
  ws.terminate();
  await closed;
});
test('harita blipleri: müşteri ajanına yazılır, sunucu izolasyonu ve doğrulama korunur', async (t) => {
  const { db, request, login } = await fixture(t);
  const owner = await login('owner');
  const viewer = await login('viewer');
  const one = (await request('/servers', { name: 'Map A', region: 'TR', framework: 'QBCore' }, owner)).data;
  const two = (await request('/servers', { name: 'Map B', region: 'TR', framework: 'QBCore' }, owner)).data;
  const path = `/servers/${one.id}/map-blips`;
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(path, undefined, owner)).status, 403);
  assert.deepEqual((await request(path, undefined, viewer)).data.blips, []);
  const blip = { op: 'add', sprite: 1, colorCode: '1', label: 'Toplanma noktası', size: 1.7, x: 100, y: -200 };
  assert.equal((await request(path, { ...blip, sprite: 999999 }, viewer)).status, 400);
  assert.equal((await request(path, { ...blip, colorCode: '999' }, viewer)).status, 400);
  assert.equal((await request(path, { ...blip, x: 99999 }, viewer)).status, 400);
  assert.equal((await request(path, { ...blip, size: 3.1 }, viewer)).status, 400);
  assert.equal((await request(path, blip, viewer)).status, 409);
  const headers = { 'X-FiveISO-Server': one.id, Authorization: `Bearer ${one.token}` };
  await request('/agent/heartbeat', { ...snapshot, mapBlips: [] }, '', headers);
  const runBlip = async (payload, rows) => {
      const pending = request(path, payload, viewer);
      let queued;
      for (let attempt = 0; attempt < 50 && !queued; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        queued = db.prepare("SELECT payload FROM commands WHERE server_id=? AND status='queued' ORDER BY created DESC LIMIT 1").get(one.id);
      }
      assert.ok(queued);
    assert.deepEqual(JSON.parse(queued.payload), { type: 'mapBlip' });
    const polled = await request('/agent/heartbeat', { pollOnly: true }, '', headers);
    const command = polled.data.commands.find((entry) => entry.type === 'mapBlip');
    assert.ok(command);
    assert.equal(Object.hasOwn(command.params, 'created'), false);
    if (payload.op !== 'delete') assert.equal(command.params.size, payload.size ?? 1);
    await request('/agent/heartbeat', { pollOnly: true, acks: [{ id: command.id, ok: true, data: { blips: rows } }] }, '', headers);
    return pending;
  };
  const added = await runBlip(blip, [{ id: 'pending', sprite: 1, colorCode: '1', label: blip.label, size: 1.7, x: 100, y: -200 }]);
  assert.equal(added.status, 201);
  const marker = { id: added.data.id, sprite: 1, colorCode: '1', label: blip.label, size: 1.7, x: 100, y: -200 };
  await request('/agent/heartbeat', { ...snapshot, mapBlips: [marker] }, '', headers);
  assert.equal((await request(path, undefined, viewer)).data.blips[0].label, blip.label);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM map_blips').get().count, 0);
  const updated = { ...marker, label: 'Yeni toplanma noktası', size: 2.2 };
  assert.equal((await runBlip({ op: 'update', id: marker.id, sprite: 1, colorCode: '1', label: updated.label, size: updated.size }, [updated])).status, 200);
  assert.equal((await request(path, undefined, viewer)).data.blips[0].label, updated.label);
  assert.equal((await request(path, undefined, viewer)).data.blips[0].size, 2.2);
  assert.deepEqual((await request(`/servers/${two.id}/map-blips`, undefined, viewer)).data.blips, []);
  db.prepare("UPDATE tenants SET features=? WHERE id='local'").run(JSON.stringify(['overview']));
  assert.equal((await request(path, undefined, viewer)).status, 403);
  assert.equal((await request(path, { op: 'delete', id: added.data.id }, viewer)).status, 403);
  db.prepare("UPDATE tenants SET features=? WHERE id='local'").run(JSON.stringify(['overview', 'map']));
  assert.equal((await runBlip({ op: 'delete', id: added.data.id }, [])).status, 200);
  assert.deepEqual((await request(path, undefined, viewer)).data.blips, []);
});
test('eski panel blipleri müşteri ajanına aktarılınca panel kaydı temizlenir', async (t) => {
  const { db, request, login } = await fixture(t);
  const owner = await login('owner');
  const viewer = await login('viewer');
  const server = (await request('/servers', { name: 'Migration', region: 'TR', framework: 'QBCore' }, owner)).data;
  const marker = { id: '11111111-1111-4111-8111-111111111111', sprite: 1, colorCode: '1', label: 'Eski blip', x: 10, y: 20 };
  db.prepare('INSERT INTO map_blips VALUES(?,?,?,?,?,?,?,?,?)').run(marker.id, server.id, marker.sprite, marker.colorCode, marker.label, marker.x, marker.y, Date.now(), 'viewer');
  const headers = { 'X-FiveISO-Server': server.id, Authorization: `Bearer ${server.token}` };
  const poll = await request('/agent/heartbeat', { ...snapshot, mapBlips: {} }, '', headers);
  const command = poll.data.commands.find((entry) => entry.type === 'mapBlip' && entry.params.op === 'import');
  assert.ok(command);
  assert.equal(command.params.rows[0].id, marker.id);
  assert.equal(Object.hasOwn(command.params.rows[0], 'created'), false);
  await request('/agent/heartbeat', { pollOnly: true, acks: [{ id: command.id, ok: true, data: { blips: [marker] } }] }, '', headers);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM map_blips').get().count, 0);
  assert.deepEqual((await request(`/servers/${server.id}/map-blips`, undefined, viewer)).data.blips, [marker]);
});
test('canlı ekran: yetki, ajan kimliği, sessiz SDP, sinyalleşme ve kapatma', async (t) => {
  const {request, login} = await fixture(t);
  const owner = await login('owner');
  const viewer = await login('viewer');
  const admin = await login('admin');
  const a = (await request('/servers', {name:'Screen A',region:'TR',framework:'QBCore'},owner)).data;
  const b = (await request('/servers', {name:'Screen B',region:'TR',framework:'QBCore'},owner)).data;
  const headers = s => ({'X-FiveISO-Server':s.id,Authorization:`Bearer ${s.token}`});
  await request('/agent/heartbeat',snapshot,'',headers(a));
  const base = `/servers/${a.id}/screens`;
  assert.equal((await request(base)).status,401);
  assert.equal((await request(base,undefined,viewer)).status,200);
  const offer = {type:'offer',sdp:'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n'};
  assert.equal((await request(base,{target:'1',offer},owner)).status,403);
  assert.equal((await request('/agent/screens',{updates:[]},'',{'X-FiveISO-Server':a.id,Authorization:'Bearer wrong'})).status,401);
  await request('/agent/screens',{updates:[]},'',headers(a));
  assert.equal((await request(base,{target:'1',offer:{...offer,sdp:offer.sdp+'m=audio 9 RTP/AVP 0\r\n'}},viewer)).status,400);
  const started = await request(base,{target:'1',offer},viewer);
  assert.equal(started.status,200);
  const path = `${base}/${started.data.id}`;
  assert.equal((await request(path,undefined,admin)).status,404);
  assert.equal((await request('/agent/screens',{updates:[]},'',headers(b))).data.streams.length,0);
  const desired = await request('/agent/screens',{updates:[]},'',headers(a));
  assert.equal(desired.data.streams[0].license,'license:123');
  const answer = {...offer,type:'answer'};
  await request('/agent/screens',{updates:[{id:started.data.id,answer}]},'',headers(b));
  assert.equal((await request(path,undefined,viewer)).data.answer,null);
  await request('/agent/screens',{updates:[{id:started.data.id,answer}]},'',headers(a));
  assert.deepEqual((await request(path,undefined,viewer)).data.answer,answer);
  assert.equal((await request(path,{},viewer)).status,200);
  assert.equal((await request('/agent/screens',{updates:[]},'',headers(a))).data.streams.length,0);
});
test('canlı ekran: lisanslı viewer kendi sunucusunu izler; lisans iptali yayını kapatır', async (t) => {
  const {db,request,login} = await fixture(t);
  const owner = await login('owner'), viewer = await login('viewer');
  const create = async name => (await request('/servers',{name,region:'TR',framework:'QBCore'},owner)).data;
  const own = await create('Own'), other = await create('Other');
  db.prepare('INSERT INTO tenants(id,name,features) VALUES(?,?,?)').run('other','Other',JSON.stringify(['overview','map']));
  db.prepare('UPDATE server_tenants SET tenant_id=? WHERE server_id=?').run('other',other.id);
  const headers = {'X-FiveISO-Server':own.id,Authorization:`Bearer ${own.token}`};
  const agent = () => request('/agent/screens',{updates:[]},'',headers);
  await request('/agent/heartbeat',snapshot,'',headers); await agent();
  const payload = {target:'1',offer:{type:'offer',sdp:'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n'}};
  const base = `/servers/${own.id}/screens`;
  assert.equal((await request(`/servers/${other.id}/screens`,undefined,viewer)).status,403);
  assert.equal((await request(`/servers/${other.id}/screens`,payload,viewer)).status,403);
  assert.equal((await request(base,payload,viewer)).status,200);
  assert.equal((await agent()).data.streams.length,1);
  db.prepare("UPDATE tenants SET enabled=0 WHERE id='local'").run();
  assert.equal((await agent()).status,403);
  assert.equal((await request(base,payload,viewer)).status,403);
  db.prepare("UPDATE tenants SET enabled=1,expires=? WHERE id='local'").run('2000-01-01T00:00:00Z');
  assert.equal((await request(base,payload,viewer)).status,403);
  db.prepare("UPDATE tenants SET expires=NULL,features=? WHERE id='local'").run(JSON.stringify(['overview']));
  assert.equal((await request(base,payload,viewer)).status,403);
});
test('canlı ekran: oturum çıkışı ve oyuncu kimliği değişimi yayını durdurur', async (t) => {
  const {request,login} = await fixture(t);
  const owner = await login('owner');
  let viewer = await login('viewer');
  const a = (await request('/servers',{name:'Screen',region:'TR',framework:'QBCore'},owner)).data;
  const headers = {'X-FiveISO-Server':a.id,Authorization:`Bearer ${a.token}`};
  const agent = () => request('/agent/screens',{updates:[]},'',headers);
  await request('/agent/heartbeat',snapshot,'',headers); await agent();
  const base = `/servers/${a.id}/screens`;
  const payload = {target:'1',offer:{type:'offer',sdp:'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n'}};
  assert.equal((await request(base,payload,viewer)).status,200);
  await request('/logout',{},viewer);
  assert.equal((await agent()).data.streams.length,0);
  viewer=await login('viewer');
  assert.equal((await request(base,payload,viewer)).status,200);
  await request('/agent/heartbeat',{...snapshot,players:[{...snapshot.players[0],license:'license:new'}]},'',headers);
  assert.equal((await agent()).data.streams.length,0);
});
test('parola tuzlama ve doğrulama', () => {
  const h = hashPassword('test-password-123');
  assert.notEqual(h, hashPassword('test-password-123'));
  assert.equal(verifyPassword('test-password-123', h), true);
  assert.equal(verifyPassword('incorrect', h), false);
});
test('giriş sınırı vekilden gelen gerçek istemci IP adresine göre uygulanır', async (t) => {
  const { request } = await fixture(t);
  const credentials = { username: 'owner', password: 'wrong' };
  for (let attempt = 0; attempt < 8; attempt++)
    assert.equal((await request('/login', credentials, '', { 'X-Real-IP': '198.51.100.1' })).status, 401);
  assert.equal((await request('/login', credentials, '', { 'X-Real-IP': '198.51.100.1' })).status, 429);
  assert.equal((await request('/login', { username: 'owner', password: 'test-password-123' }, '', { 'X-Real-IP': '198.51.100.2' })).status, 200);
});
test('giriş, CSRF, yetki ve oturum sonlandırma', async (t) => {
  const { request, login } = await fixture(t);
  assert.equal((await request('/state')).status, 401);
  assert.equal(
    (await request('/login', { username: 'admin', password: 'wrong' })).status,
    401,
  );
  const viewer = await login('viewer');
  assert.equal(
    (
      await request(
        '/servers',
        { name: 'A', region: 'TR', framework: 'ESX' },
        viewer,
      )
    ).status,
    403,
  );
  const admin = await login('owner');
  assert.equal(
    (
      await request('/servers', { name: 'A' }, admin, {
        Origin: 'https://evil.invalid',
      })
    ).status,
    403,
  );
  assert.equal((await request('/logout', {}, admin)).status, 200);
  assert.equal((await request('/state', undefined, admin)).status, 401);
});
test('sunucu izolasyonu, güvenli kaynak işlemi ve ajan onayı', async (t) => {
  const { request, login } = await fixture(t);
  const owner = await login('owner');
  const admin = await login('admin');
  const create = async (name) =>
    (
      await request(
        '/servers',
        { name, region: 'TR', framework: 'QBCore' },
        owner,
      )
    ).data;
  const a = await create('A');
  const b = await create('B');
  const heartbeat = (s, payload = snapshot) =>
    request('/agent/heartbeat', payload, '', {
      'X-FiveISO-Server': s.id,
      Authorization: `Bearer ${s.token}`,
    });
  assert.equal((await heartbeat({ ...a, token: b.token })).status, 401);
  assert.equal((await heartbeat(a)).status, 200);
  await heartbeat(b);
  const viewer = await login('viewer');
  assert.equal(
    (
      await request(
        `/servers/${a.id}/actions`,
        { type: 'kick', target: '1', value: 'test' },
        viewer,
      )
    ).status,
    403,
  );
  const mod = await login('moderator');
  assert.equal(
    (
      await request(
        `/servers/${a.id}/actions`,
        { type: 'restart', target: 'qb-core' },
        mod,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/servers/${a.id}/actions`,
        { type: 'restart', target: 'fiveiso' },
        admin,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        `/servers/${a.id}/actions`,
        { type: 'restart', target: 'qb-core; quit' },
        admin,
      )
    ).status,
    400,
  );
  const action = await request(
    `/servers/${a.id}/actions`,
    { type: 'restart', target: 'qb-core' },
    admin,
  );
  assert.equal(action.status, 202);
  assert.equal((await heartbeat(b)).data.commands.length, 0);
  assert.equal((await heartbeat(a)).data.commands[0].id, action.data.id);
  assert.equal((await heartbeat(a)).data.commands.length, 0);
  await heartbeat(a, {
    ...snapshot,
    acks: [{ id: action.data.id, ok: true, result: 'OK' }],
  });
  const state = (await request('/state', undefined, admin)).data;
  assert.equal(
    state.audit.find((x) => x.id === action.data.id).status,
    'completed',
  );
  assert.equal(JSON.stringify(state).includes(a.token), false);
});
test('sunucu yaşam döngüsü yalnızca bağımsız FiveISO yöneticisine gönderilir', async (t) => {
  const { request, login } = await fixture(t);
  const owner = await login('owner');
  const admin = await login('admin');
  const agent = (await request('/servers', { name: 'Lifecycle', region: 'TR', framework: 'QBCore' }, owner)).data;
  const headers = { 'X-FiveISO-Server': agent.id, Authorization: `Bearer ${agent.token}` };
  const unavailable = await request(`/servers/${agent.id}/actions`, { type: 'serverStart' }, admin);
  assert.equal(unavailable.status, 409);
  const first = await request('/host/heartbeat', { running: false, acks: [] }, '', headers);
  assert.equal(first.status, 200);
  const queued = await request(`/servers/${agent.id}/actions`, { type: 'serverStart' }, admin);
  assert.equal(queued.status, 202);
  const delivered = await request('/host/heartbeat', { running: false, acks: [] }, '', headers);
  assert.deepEqual(delivered.data.commands, [{ id: queued.data.id, type: 'serverStart' }]);
  await request('/host/heartbeat', {
    running: true,
    acks: [{ id: queued.data.id, ok: true, result: 'Sunucu başlatıldı.' }],
  }, '', headers);
  const state = (await request('/state', undefined, admin)).data;
  assert.equal(state.servers[0].supervisorOnline, true);
  assert.equal(state.servers[0].processRunning, true);
  assert.equal(state.audit.find((row) => row.id === queued.data.id).status, 'completed');
});
test('kalıcı yasaklar, çapraz sunucu yasağı kaldırma engeli ve çevrimdışı işlem', async (t) => {
  const { db, request, login } = await fixture(t);
  const owner = await login('owner');
  const admin = await login('admin');
  const a = (
    await request(
      '/servers',
      { name: 'A', region: 'TR', framework: 'ESX' },
      owner,
    )
  ).data;
  await request('/agent/heartbeat', snapshot, '', {
    'X-FiveISO-Server': a.id,
    Authorization: `Bearer ${a.token}`,
  });
  assert.equal(
    (
      await request(
        `/servers/${a.id}/actions`,
        { type: 'ban', target: '1', value: 'Kural ihlali' },
        admin,
      )
    ).status,
    202,
  );
  let state = (await request('/state', undefined, admin)).data;
  assert.equal(state.bans[0].license, 'license:123');
  const b = (
    await request(
      '/servers',
      { name: 'B', region: 'DE', framework: 'ESX' },
      owner,
    )
  ).data;
  assert.equal(
    (
      await request(
        `/servers/${b.id}/actions`,
        { type: 'unban', target: state.bans[0].id },
        admin,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(
        `/servers/${a.id}/actions`,
        { type: 'unban', target: state.bans[0].id },
        admin,
      )
    ).status,
    200,
  );
  db.prepare('UPDATE servers SET last_seen=0 WHERE id=?').run(a.id);
  assert.equal(
    (
      await request(
        `/servers/${a.id}/actions`,
        { type: 'restart', target: 'qb-core' },
        admin,
      )
    ).status,
    409,
  );
});

test('müşteri izolasyonu, paket kapatma ve bekleyen komut iptali', async (t) => {
  const { db, request, login } = await fixture(t);
  const owner = await login('owner');
  const tenant = async (name) =>
    (
      await request(
        '/owner/tenants',
        {
          name,
          features: [
            'overview',
            'players',
            'resources',
            'audit',
            'bans',
            'team',
          ],
          enabled: true,
        },
        owner,
      )
    ).data.id;
  const a = await tenant('Müşteri A'),
    b = await tenant('Müşteri B');
  for (const [username, tenantId] of [
    ['alice', a],
    ['bravo', b],
  ])
    assert.equal(
      (
        await request(
          '/owner/users',
          { username, tenantId, role: 'admin', password: 'test-password-123' },
          owner,
        )
      ).status,
      200,
    );
  const server = (
    await request(
      '/servers',
      { name: 'A sunucusu', region: 'TR', framework: 'qbx_core' },
      owner,
    )
  ).data;
  await request(
    '/owner/assign-server',
    { serverId: server.id, tenantId: a },
    owner,
  );
  const heartbeat = () =>
    request('/agent/heartbeat', snapshot, '', {
      'X-FiveISO-Server': server.id,
      Authorization: `Bearer ${server.token}`,
    });
  await heartbeat();
  const alice = await login('alice'),
    bravo = await login('bravo');
  assert.equal((await request('/owner', undefined, alice)).status, 403);
  assert.equal(
    (await request('/state', undefined, alice)).data.servers.length,
    1,
  );
  assert.equal(
    (await request('/state', undefined, bravo)).data.servers.length,
    0,
  );
  assert.equal(
    (await request('/state', undefined, bravo)).data.audit.length,
    0,
  );
  assert.equal(
    (await request('/state', undefined, alice)).data.users.some(
      (u) => u.username === 'bravo' || u.role === 'owner',
    ),
    false,
  );
  assert.equal(
    (
      await request(
        `/servers/${server.id}/actions`,
        { type: 'restart', target: 'qb-core' },
        bravo,
      )
    ).status,
    403,
  );
  const queued = await request(
    `/servers/${server.id}/actions`,
    { type: 'restart', target: 'qb-core' },
    alice,
  );
  assert.equal(queued.status, 202);
  await request(
    '/owner/tenants',
    {
      id: a,
      name: 'Müşteri A',
      features: ['overview', 'players', 'audit'],
      enabled: true,
    },
    owner,
  );
  assert.equal((await heartbeat()).data.commands.length, 0);
  assert.equal(
    db.prepare('SELECT status FROM audit WHERE id=?').get(queued.data.id).status,
    'cancelled',
  );
  assert.equal(
    (
      await request(
        `/servers/${server.id}/actions`,
        { type: 'restart', target: 'qb-core' },
        alice,
      )
    ).status,
    403,
  );
  await request(
    '/owner/tenants',
    { id: a, name: 'Müşteri A', features: ['overview'], enabled: false },
    owner,
  );
  assert.equal((await request('/state', undefined, alice)).status, 403);
  assert.equal((await request('/state', undefined, owner)).status, 200);
});

test('süre dolumu, owner rolü izolasyonu ve parola güncellemede oturum iptali', async (t) => {
  const { request, login } = await fixture(t);
  const owner = await login('owner');
  const tenant = (
    await request(
      '/owner/tenants',
      { name: 'Süreli paket', features: ['overview'], enabled: true },
      owner,
    )
  ).data.id;
  await request(
    '/owner/users',
    {
      username: 'customer',
      tenantId: tenant,
      role: 'admin',
      password: 'test-password-123',
    },
    owner,
  );
  const cookie = await login('customer');
  assert.equal((await request('/owner/users', {
    username: 'intruder', tenantId: tenant, role: 'owner', password: 'test-password-123',
  }, owner)).status, 200);
  const intruder = await login('intruder');
  const intruderMe = (await request('/me', undefined, intruder)).data;
  assert.equal(intruderMe.role, 'user');
  assert.equal(intruderMe.manager, true);
  await request(
    '/owner/users',
    {
      username: 'customer',
      tenantId: tenant,
      role: 'admin',
      password: 'different-password',
    },
    owner,
  );
  assert.equal((await request('/state', undefined, cookie)).status, 401);
  const newCookie = (
    await request('/login', {
      username: 'customer',
      password: 'different-password',
    })
  ).cookie;
  await request(
    '/owner/tenants',
    {
      id: tenant,
      name: 'Süreli paket',
      features: ['overview'],
      expires: '2020-01-01T00:00:00Z',
      enabled: true,
    },
    owner,
  );
  assert.equal((await request('/state', undefined, newCookie)).status, 403);
});

test('oyun işlemlerinde adaptör, miktar ve müşteri modül doğrulaması', async (t) => {
  const { request, login } = await fixture(t);
  const owner = await login('owner');
  const manager = await login('admin');
  const server = (
    await request(
      '/servers',
      { name: 'Game', region: 'TR', framework: 'qbx_core' },
      owner,
    )
  ).data;
  const heartbeat = (payload) =>
    request('/agent/heartbeat', payload, '', {
      'X-FiveISO-Server': server.id,
      Authorization: `Bearer ${server.token}`,
    });
  await heartbeat(snapshot);
  const action = {
    type: 'addMoney',
    target: '1',
    value: 'Destek telafisi',
    params: { account: 'cash', amount: 500 },
  };
  assert.equal(
    (await request(`/servers/${server.id}/actions`, action, manager)).status,
    400,
  );
  await heartbeat({ ...snapshot, capabilities: ['addMoney'] });
  assert.equal(
    (
      await request(
        `/servers/${server.id}/actions`,
        { ...action, params: { account: 'cash', amount: -10 } },
        manager,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        `/servers/${server.id}/actions`,
        { ...action, params: { account: 'cash', amount: Infinity } },
        manager,
      )
    ).status,
    400,
  );
  assert.equal(
    (await request(`/servers/${server.id}/actions`, action, manager)).status,
    202,
  );
  const result = await heartbeat({ ...snapshot, capabilities: ['addMoney'] });
  assert.equal(result.data.commands[0].license, 'license:123');
  assert.equal(result.data.commands[0].params.amount, 500);
  await heartbeat({ ...snapshot, capabilities: ['setJoinLock'], acks: [{ id: result.data.commands[0].id, ok: true }] });
  assert.equal(
    (await request(`/servers/${server.id}/actions`, { type: 'setJoinLock', params: { enabled: 'true' } }, manager)).status,
    400,
  );
  assert.equal(
    (await request(`/servers/${server.id}/actions`, { type: 'setJoinLock', params: { enabled: true } }, manager)).status,
    202,
  );
  const fastPoll = await heartbeat({ pollOnly: true, acks: [] });
  assert.equal(fastPoll.status, 200);
  assert.equal(fastPoll.data.commands[0].type, 'setJoinLock');
  assert.equal(fastPoll.data.commands[0].license, undefined);
  await heartbeat({ ...snapshot, capabilities: ['createJob', 'createGang'], acks: [{ id: fastPoll.data.commands[0].id, ok: true }] });
  const create = { type: 'createJob', params: { name: 'panel_test', label: 'Panel Test', type: 'leo', defaultDuty: true, offDutyPay: false, grades: [{ grade: 0, name: 'Çalışan', payment: 100, isboss: false }] } };
  assert.equal((await request(`/servers/${server.id}/actions`, create, manager)).status, 202);
  assert.equal((await request(`/servers/${server.id}/actions`, { ...create, params: { ...create.params, grades: [{ ...create.params.grades[0], payment: -1 }] } }, manager)).status, 400);
  const createPoll = await heartbeat({ pollOnly: true, acks: [] });
  assert.equal(createPoll.data.commands[0].type, 'createJob');
  assert.equal(createPoll.data.commands[0].license, undefined);
  assert.equal(createPoll.data.commands[0].params.grades[0].payment, 100);
  assert.equal(createPoll.data.commands[0].params.type, 'leo');
  assert.equal(createPoll.data.commands[0].params.offDutyPay, false);
  await heartbeat({ ...snapshot, capabilities: ['createJob', 'createGang'], acks: [{ id: createPoll.data.commands[0].id, ok: true }] });
  const withoutType = { ...create, params: { ...create.params, name: 'panel_without_type' } };
  delete withoutType.params.type;
  assert.equal((await request(`/servers/${server.id}/actions`, withoutType, manager)).status, 202);
  const optionalTypePoll = await heartbeat({ pollOnly: true, acks: [] });
  assert.equal(Object.hasOwn(optionalTypePoll.data.commands[0].params, 'type'), false);
  await heartbeat({ ...snapshot, capabilities: ['updateJob', 'deleteJob'], acks: [{ id: optionalTypePoll.data.commands[0].id, ok: true }] });
  const update = { type: 'updateJob', params: { ...create.params, name: 'police', grades: [{ ...create.params.grades[0], sourceGrade: 0 }] } };
  assert.equal((await request(`/servers/${server.id}/actions`, update, manager)).status, 202);
  assert.equal((await request(`/servers/${server.id}/actions`, { ...update, params: { ...update.params, grades: [...update.params.grades, { ...update.params.grades[0], grade: 1 }] } }, manager)).status, 400);
  const updatePoll = await heartbeat({ pollOnly: true, acks: [] });
  assert.equal(updatePoll.data.commands[0].type, 'updateJob');
  assert.equal(updatePoll.data.commands[0].license, undefined);
  assert.equal(updatePoll.data.commands[0].params.grades[0].sourceGrade, 0);
  await heartbeat({ ...snapshot, capabilities: ['updateJob', 'deleteJob'], acks: [{ id: updatePoll.data.commands[0].id, ok: true }] });
  assert.equal((await request(`/servers/${server.id}/actions`, { type: 'deleteJob', params: { name: 'police' } }, manager)).status, 202);
  assert.equal((await request(`/servers/${server.id}/actions`, { type: 'deleteJob', params: { name: '../qb-core' } }, manager)).status, 400);
  const deletePoll = await heartbeat({ pollOnly: true, acks: [] });
  assert.equal(deletePoll.data.commands[0].type, 'deleteJob');
  assert.equal(deletePoll.data.commands[0].license, undefined);
});

test('müşteri ekip yöneticisi başka müşteriye veya sahip hesabına müdahale edemez', async (t) => {
  const { request, login } = await fixture(t);
  const owner = await login('owner');
  const a = (
    await request(
      '/owner/tenants',
      { name: 'Ekip A', features: ['overview', 'team', 'audit'] },
      owner,
    )
  ).data.id;
  const b = (
    await request(
      '/owner/tenants',
      { name: 'Ekip B', features: ['overview', 'team'] },
      owner,
    )
  ).data.id;
  for (const [username, tenantId] of [
    ['manager', a],
    ['outsider', b],
  ])
    await request(
      '/owner/users',
      { username, tenantId, role: 'admin', password: 'test-password-123' },
      owner,
    );
  const manager = await login('manager');
  assert.equal(
    (
      await request(
        '/team/users',
        {
          username: 'helper',
          password: 'test-password-123',
          permissions: ['overview', 'audit'],
        },
        manager,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        '/team/users',
        { username: 'outsider', password: 'test-password-123', permissions: [] },
        manager,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        '/team/users',
        { username: 'owner', password: 'test-password-123', permissions: [] },
        manager,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        '/team/users',
        { username: 'newowner', role: 'owner', password: 'test-password-123', permissions: ['overview'] },
        manager,
      )
    ).status,
    200,
  );
  const newOwnerAttempt = await login('newowner');
  assert.equal((await request('/me', undefined, newOwnerAttempt)).data.role, 'user');
  const helper = await login('helper');
  const helperState = (await request('/state', undefined, helper)).data;
  assert.deepEqual(helperState.features.sort(), ['audit', 'overview']);
  assert.deepEqual(helperState.permissions.sort(), ['audit', 'overview']);
  assert.equal(
    (await request('/team/users', {
      username: 'forbidden', password: 'test-password-123', permissions: ['overview'],
    }, helper)).status,
    403,
  );
  const state = (await request('/state', undefined, manager)).data;
  assert.equal(
    state.users.some((u) => u.username === 'helper'),
    true,
  );
  assert.equal(
    state.audit.some((a) => a.action.includes('helper')),
    true,
  );
});
test('panel sahibi rol oluşturur, üyeye atar ve rol yetkisi değişince erişim güncellenir', async (t) => {
  const { request, login } = await fixture(t);
  const owner = await login('owner');
  const tenantA = (await request('/owner/tenants', { name: 'Rol A', features: ['overview', 'team', 'audit'] }, owner)).data.id;
  const tenantB = (await request('/owner/tenants', { name: 'Rol B', features: ['overview', 'team'] }, owner)).data.id;
  await request('/owner/users', { username: 'rolemanager', tenantId: tenantA, password: 'test-password-123' }, owner);
  await request('/owner/users', { username: 'othermanager', tenantId: tenantB, password: 'test-password-123' }, owner);
  const manager = await login('rolemanager');
  const other = await login('othermanager');
  const role = await request('/team/roles', { name: 'Denetçi', permissions: ['overview', 'audit'] }, manager);
  assert.equal(role.status, 200);
  assert.equal((await request('/team/roles', { id: role.data.id, name: 'Değiştir', permissions: ['overview'] }, other)).status, 404);
  assert.equal((await request('/team/users', {
    username: 'rolehelper', password: 'test-password-123', roleId: role.data.id, permissions: [],
  }, manager)).status, 200);
  const helper = await login('rolehelper');
  assert.deepEqual((await request('/state', undefined, helper)).data.features.sort(), ['audit', 'overview']);
  assert.equal((await request('/team/roles', { name: 'Yönetici', permissions: ['team', 'teamManage'] }, helper)).status, 403);
  assert.equal((await request('/team/roles', { id: role.data.id, name: 'Denetçi', permissions: ['overview'] }, manager)).status, 200);
  const updated = (await request('/state', undefined, helper)).data;
  assert.deepEqual(updated.features, ['overview']);
  assert.deepEqual(updated.permissions, ['overview']);
  const managerState = (await request('/state', undefined, manager)).data;
  assert.equal(managerState.roles.find((entry) => entry.id === role.data.id)?.name, 'Denetçi');
  assert.equal(managerState.users.find((entry) => entry.username === 'rolehelper')?.roleId, role.data.id);
});
test('Discord daveti tek kullanımlık rol hesabı açar; state ve hesap bağlantısı korunur', async (t) => {
  let identity = { id: '123456789012345678', username: 'tester' };
  const discordFetch = async (url) => url.endsWith('/oauth2/token')
    ? Response.json({ access_token: 'mock-token' })
    : Response.json(identity);
  const { request, login, base } = await fixture(t, { discord: {
    clientId: '123', clientSecret: 'secret', redirectUri: `${origin}/api/auth/discord/callback`, fetch: discordFetch,
  } });
  const manager = await login('admin');
  const role = (await request('/team/roles', { name: 'Discord Üye', permissions: ['overview', 'players'] }, manager)).data;
  const invite = (await request('/team/discord-invites', { roleId: role.id }, manager)).data.invite;
  const start = await fetch(`${base}/api/auth/discord/start?invite=${invite}`, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const wrongState = await fetch(`${base}/api/auth/discord/callback?state=${state}&code=ok`, { redirect: 'manual' });
  assert.match(wrongState.headers.get('location'), /invalid_state/);
  const retry = await fetch(`${base}/api/auth/discord/start?invite=${invite}`, { redirect: 'manual' });
  const validState = new URL(retry.headers.get('location')).searchParams.get('state');
  const validCookie = retry.headers.get('set-cookie').split(';')[0];
  const callback = await fetch(`${base}/api/auth/discord/callback?state=${validState}&code=ok`, { redirect: 'manual', headers: { Cookie: validCookie } });
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), '/panel');
  const session = callback.headers.getSetCookie().find((value) => value.startsWith('fiveiso_session=')).split(';')[0];
  const me = (await request('/me', undefined, session)).data;
  assert.deepEqual(me.features.sort(), ['overview', 'players']);
  assert.equal(me.roleId, role.id);
  identity = { id: '987654321098765432', username: 'other' };
  const reused = await fetch(`${base}/api/auth/discord/start?invite=${invite}`, { redirect: 'manual' });
  assert.match(reused.headers.get('location'), /invalid_invite/);
  const noInvite = await fetch(`${base}/api/auth/discord/start`, { redirect: 'manual' });
  const noInviteState = new URL(noInvite.headers.get('location')).searchParams.get('state');
  const uninvited = await fetch(`${base}/api/auth/discord/callback?state=${noInviteState}&code=ok`, { redirect: 'manual', headers: { Cookie: noInvite.headers.get('set-cookie').split(';')[0] } });
  assert.match(uninvited.headers.get('location'), /invite_required/);
  identity = { id: '123456789012345678', username: 'tester' };
  const loginStart = await fetch(`${base}/api/auth/discord/start`, { redirect: 'manual' });
  const loginState = new URL(loginStart.headers.get('location')).searchParams.get('state');
  const loginCallback = await fetch(`${base}/api/auth/discord/callback?state=${loginState}&code=ok`, { redirect: 'manual', headers: { Cookie: loginStart.headers.get('set-cookie').split(';')[0] } });
  assert.equal(loginCallback.headers.get('location'), '/panel');
  identity = { id: '111111111111111111', username: 'manager' };
  const linkStart = await fetch(`${base}/api/auth/discord/start?mode=link`, { redirect: 'manual', headers: { Cookie: manager } });
  const linkState = new URL(linkStart.headers.get('location')).searchParams.get('state');
  const linked = await fetch(`${base}/api/auth/discord/callback?state=${linkState}&code=ok`, { redirect: 'manual', headers: { Cookie: linkStart.headers.get('set-cookie').split(';')[0] } });
  assert.equal(linked.headers.get('location'), '/panel');
  const managerLogin = await fetch(`${base}/api/auth/discord/start`, { redirect: 'manual' });
  const managerState = new URL(managerLogin.headers.get('location')).searchParams.get('state');
  const managerCallback = await fetch(`${base}/api/auth/discord/callback?state=${managerState}&code=ok`, { redirect: 'manual', headers: { Cookie: managerLogin.headers.get('set-cookie').split(';')[0] } });
  const managerSession = managerCallback.headers.getSetCookie().find((value) => value.startsWith('fiveiso_session=')).split(';')[0];
  assert.equal((await request('/me', undefined, managerSession)).data.username, 'admin');
});
test('FiveM konsol komutu özel yetkiyle doğrulanır, ajana iletilir ve sonucu döner', async (t) => {
  const { request, login } = await fixture(t);
  const owner = await login('owner');
  const manager = await login('admin');
  const viewer = await login('viewer');
  const server = (await request('/servers', {
    name: 'Console', region: 'TR', framework: 'QBCore',
  }, owner)).data;
  const heartbeat = (acks = []) => request('/agent/heartbeat', {
    ...snapshot, capabilities: ['consoleCommand', 'kill'], acks,
  }, '', {
    'X-FiveISO-Server': server.id,
    Authorization: `Bearer ${server.token}`,
  });
  await heartbeat();
  const send = (value, cookie) => request(`/servers/${server.id}/actions`, {
    type: 'consoleCommand', value,
  }, cookie);
  assert.equal((await send('status', owner)).status, 403);
  assert.equal((await send('status', viewer)).status, 403);
  assert.equal((await send('status\nquit', manager)).status, 400);
  const queued = await send('ensure qb-core', manager);
  assert.equal(queued.status, 202);
  const delivered = await heartbeat();
  assert.equal(delivered.data.commands[0].type, 'consoleCommand');
  assert.equal(delivered.data.commands[0].value, 'ensure qb-core');
  await heartbeat([{ id: queued.data.id, ok: true, result: 'Komut çalıştırıldı' }]);
  const result = await request('/commands/' + queued.data.id, undefined, manager);
  assert.equal(result.data.status, 'completed');
  assert.equal(result.data.result, 'Komut çalıştırıldı');
  const kill = await send('kill 1', manager);
  assert.equal(kill.status, 202);
  const killDelivery = await heartbeat();
  assert.equal(killDelivery.data.commands[0].type, 'kill');
  assert.equal(killDelivery.data.commands[0].target, '1');
  assert.equal(killDelivery.data.commands[0].license, 'license:123');
  await heartbeat([{ id: kill.data.id, ok: true, result: 'Oyuncu öldürüldü' }]);
  const custom = await send('sunucuya-ozel-komut ilk ikinci', manager);
  assert.equal(custom.status, 202);
  const customDelivery = await heartbeat();
  assert.equal(customDelivery.data.commands[0].type, 'consoleCommand');
  assert.equal(customDelivery.data.commands[0].value, 'sunucuya-ozel-komut ilk ikinci');
});
test('SQL komutları: doğrulama, sonuç gizliliği, modül iptali ve ajan izolasyonu', async (t) => {
  const { request, login, db } = await fixture(t);
  const owner = await login('owner');
  const admin = await login('admin');
  const viewer = await login('viewer');
  const a = (
    await request(
      '/servers',
      { name: 'SQL A', region: 'TR', framework: 'QBCore' },
      owner,
    )
  ).data;
  const b = (
    await request(
      '/servers',
      { name: 'SQL B', region: 'TR', framework: 'ESX' },
      owner,
    )
  ).data;
  const heartbeat = (srv, acks = []) =>
    request(
      '/agent/heartbeat',
      {
        ...snapshot,
        capabilities: ['dbCharacters', 'dbBalances', 'dbSetBalance'],
        acks,
      },
      '',
      { Authorization: 'Bearer ' + srv.token, 'X-FiveISO-Server': srv.id },
    );
  await heartbeat(a);
  const send = (body, cookie = admin) =>
    request(`/servers/${a.id}/actions`, body, cookie);
  assert.equal(
    (
      await send(
        { type: 'dbCharacters', params: { query: '', page: 0 } },
        viewer,
      )
    ).status,
    202,
  );
  // Dispatch the viewer's read before checking the next query's payload.
  await heartbeat(a);
  assert.equal(
    (await send({ type: 'dbCharacters', params: { query: '', page: -1 } }))
      .status,
    400,
  );
  assert.equal(
    (
      await send({
        type: 'dbSetBalance',
        target: 'ABC',
        value: 'test',
        params: { account: 'bank', amount: -1, expected: 10 },
      })
    ).status,
    400,
  );
  const queued = await send({
    type: 'dbCharacters',
    params: { query: "' OR 1=1 --", page: 0 },
  });
  assert.equal(queued.status, 202);
  const delivered = await heartbeat(a);
  assert.equal(delivered.data.commands[0].params.query, "' OR 1=1 --");
  const data = {
    rows: [{ identifier: 'ABC', firstname: 'Test', lastname: 'User' }],
    more: false,
  };
  await heartbeat(b, [{ id: queued.data.id, ok: true, data }]);
  assert.equal(
    (await request('/commands/' + queued.data.id, undefined, admin)).data
      .status,
    'dispatched',
  );
  await heartbeat(a, [{ id: queued.data.id, ok: true, result: 'Tamam', data }]);
  assert.deepEqual(
    (await request('/commands/' + queued.data.id, undefined, admin)).data.data,
    data,
  );
  assert.equal(
    (await request('/commands/' + queued.data.id, undefined, viewer)).status,
    404,
  );
  db.prepare("UPDATE tenants SET features=? WHERE id='local'").run(
    JSON.stringify(['overview', 'economy']),
  );
  assert.equal(
    (await request('/commands/' + queued.data.id, undefined, admin)).status,
    403,
  );
  const balance = await send({
    type: 'dbBalances',
    params: { query: '', page: 0 },
  });
  assert.equal(balance.status, 202);
  db.prepare("UPDATE tenants SET features=? WHERE id='local'").run(
    '["overview"]',
  );
  assert.equal((await heartbeat(a)).data.commands.length, 0);
  assert.equal(
    db.prepare('SELECT status FROM commands WHERE id=?').get(balance.data.id)
      .status,
    'cancelled',
  );
});

test('email signup creates nothing before verification; codes expire, are single-use and never grant paid server access',async t=>{
 const sent=[];
 const {db,request,login}=await fixture(t,{registration:{deliver:async message=>sent.push(message)}});
 assert.equal((await request('/registration/config')).data.enabled,true);
 const start=await request('/registration/request',{username:'newcustomer',email:'new@example.test',password:'test-password-123'});
 assert.equal(start.status,200);assert.equal(sent.length,1);
 assert.equal(db.prepare('SELECT username FROM users WHERE username=?').get('newcustomer'),undefined);
 assert(!JSON.stringify(start.data).includes('test-password'));
 assert.deepEqual(Object.keys(start.data).sort(),['expiresIn','id']);
 const code=sent[0].text.match(/\b\d{6}\b/)[0];
 assert.notEqual(db.prepare('SELECT code_hash FROM registration_pending WHERE id=?').get(start.data.id).code_hash,code);
 assert.equal((await request('/registration/verify',{id:start.data.id,code:code==='000000'?'111111':'000000'})).status,400);
 assert.equal((await request('/registration/verify',{id:start.data.id,code})).status,201);
 assert.equal((await request('/registration/verify',{id:start.data.id,code})).status,410);
 const cookie=await login('newcustomer');
 const me=await request('/me',undefined,cookie);
 assert.equal(me.status,200);assert.equal(me.data.role,'user');assert.equal(me.data.manager,true);
 assert.deepEqual(me.data.features,['overview','settings']);
 assert.equal((await request('/state',undefined,cookie)).data.servers.length,0);
 assert.equal((await request('/owner',undefined,cookie)).status,403);
 assert.equal((await request('/servers',{name:'x',region:'TR',framework:'QBCore'},cookie)).status,403);
 assert.equal((await request('/registration/request',{username:'NEWCUSTOMER',email:'other@example.test',password:'test-password-123'})).status,409);
 const expired=await request('/registration/request',{username:'expired',email:'expired@example.test',password:'test-password-123'});
 db.prepare('UPDATE registration_pending SET expires=0 WHERE id=?').run(expired.data.id);
 assert.equal((await request('/registration/verify',{id:expired.data.id,code:sent.at(-1).text.match(/\b\d{6}\b/)[0]})).status,410);
 const limited=await request('/registration/request',{username:'limited',email:'limited@example.test',password:'test-password-123'});
 const real=sent.at(-1).text.match(/\b\d{6}\b/)[0],wrong=real==='000000'?'111111':'000000';
 for(let i=0;i<5;i++)assert.equal((await request('/registration/verify',{id:limited.data.id,code:wrong})).status,400);
 assert.equal((await request('/registration/verify',{id:limited.data.id,code:real})).status,410);
});
test('registration delivery failures leave no account or usable pending code',async t=>{
 const {db,request}=await fixture(t,{registration:{deliver:async()=>{throw Error('private smtp detail');}}});
 const result=await request('/registration/request',{username:'failedmail',email:'failed@example.test',password:'test-password-123'});
 assert.equal(result.status,503);assert(!JSON.stringify(result.data).includes('private smtp'));
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registration_pending').get().n,0);
 assert.equal(db.prepare('SELECT username FROM users WHERE username=?').get('failedmail'),undefined);
});
test('owner can edit/delete servers and users; deleting a tenant removes its records and invalidates sessions',async t=>{
 const {db,request,login}=await fixture(t);
 const owner=await login('owner'),viewer=await login('viewer');
 const srv=(await request('/servers',{name:'Old name',region:'TR',framework:'QBCore'},owner)).data;
 assert.equal((await request('/owner/servers',{id:srv.id,name:'New name',region:'EU',framework:'Qbox'},owner)).status,200);
 assert.equal(db.prepare('SELECT name FROM servers WHERE id=?').get(srv.id).name,'New name');
 assert.equal((await request('/owner/delete',{kind:'server',id:srv.id},viewer)).status,403);
 assert.equal((await request('/owner/delete',{kind:'user',id:'owner'},owner)).status,403);
 assert.equal((await request('/owner/delete',{kind:'user',id:'viewer'},owner)).status,200);
 assert.equal((await request('/me',undefined,viewer)).status,401);
 assert.equal((await request('/owner/delete',{kind:'tenant',id:'local'},owner)).status,200);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM servers').get().n,0);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_tenants').get().n,0);
 assert.equal(db.prepare("SELECT username FROM users WHERE role='owner'").get().username,'owner');
 // A restart must not silently resurrect the deleted default customer.
 const {migrateTenancy}=await import('../server/tenancy.mjs');migrateTenancy(db);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tenants').get().n,0);
});

test('account home distinguishes registration from assigned packages and keeps inactive data private', async (t) => {
  const { db, request, login } = await fixture(t);
  assert.equal((await request('/account')).status, 401);
  const cookie = await login('admin');
  db.prepare('UPDATE tenants SET features=? WHERE id=?').run(JSON.stringify(['overview', 'settings']), 'local');
  const fresh = await request('/state', undefined, cookie);
  assert.equal(fresh.data.account.hasPackage, false);
  assert.equal(fresh.data.account.status, 'unconfigured');
  assert.equal(fresh.data.account.serverCount, 0);
  assert.equal(fresh.data.account.emailVerified, false);
  db.prepare('UPDATE tenants SET features=? WHERE id=?').run(JSON.stringify(['overview', 'settings', 'players']), 'local');
  assert.equal((await request('/account', undefined, cookie)).data.status, 'active');
  db.prepare('UPDATE tenants SET expires=? WHERE id=?').run('2000-01-01', 'local');
  assert.equal((await request('/state', undefined, cookie)).status, 403);
  assert.equal((await request('/me', undefined, cookie)).status, 403);
  const expired = await request('/account', undefined, cookie);
  assert.equal(expired.status, 200);
  assert.equal(expired.data.status, 'expired');
  assert.equal(expired.data.hasPackage, true);
  assert.equal(expired.data.servers, undefined);
  assert.equal(expired.data.features, undefined);
  assert.equal(expired.data.token, undefined);
  db.prepare('UPDATE tenants SET enabled=0 WHERE id=?').run('local');
  assert.equal((await request('/account', undefined, cookie)).data.status, 'suspended');
  assert.equal((await request('/logout', {}, cookie)).status, 200);
  assert.equal((await request('/account', undefined, cookie)).status, 401);
});

async function invitationFixture(t, deliver = async () => {}) {
 const f=await fixture(t,{registration:{deliver}});
 for(const username of ['viewer','moderator']){
  f.db.prepare('INSERT INTO tenants(id,name,features) VALUES(?,?,?)').run(username+'-home',username,JSON.stringify(['overview','settings']));
  f.db.prepare('UPDATE user_tenants SET tenant_id=? WHERE username=?').run(username+'-home',username);
  f.db.prepare('UPDATE user_permissions SET manager=1 WHERE username=?').run(username);
  f.db.prepare('INSERT INTO user_emails VALUES(?,?,?)').run(username,username+'@example.test',Date.now());
 }
 return {...f,admin:await f.login('admin'),viewer:await f.login('viewer'),other:await f.login('moderator'),owner:await f.login('owner')};
}
test('verified email invitations require recipient consent, start with zero access and isolate workspace permissions',async t=>{
 const sent=[];const {db,request,admin,viewer,other,owner}=await invitationFixture(t,m=>sent.push(m));
 const server=(await request('/servers',{name:'Private server',region:'TR',framework:'QBCore'},owner)).data;
 const invite=await request('/team/invitations',{email:'  VIEWER@example.test '},admin);
 assert.equal(invite.status,200);assert.equal(sent[0].to,'viewer@example.test');
 assert.equal((await request('/team/invitations',{email:'viewer@example.test'},admin)).status,409);
 assert.equal((await request('/account',undefined,other)).data.invitations.length,0);
 assert.equal((await request('/account/invitations/respond',{id:invite.data.id,action:'accept'},other)).status,404);
 assert.equal((await request('/account',undefined,viewer)).data.invitations.length,1);
 assert.equal((await request('/account/invitations/respond',{id:invite.data.id,action:'accept'},viewer)).status,200);
 assert.equal((await request('/account/invitations/respond',{id:invite.data.id,action:'accept'},viewer)).status,404);
 let state=(await request('/state',undefined,viewer)).data;
 assert.deepEqual(state.permissions,[]);assert.equal(state.manager,false);assert.deepEqual(state.servers,[]);assert.deepEqual(state.audit,[]);assert.deepEqual(state.users,[]);assert.equal(state.account.hasAccess,false);assert.equal(state.account.workspaceId,'local');
 assert.equal((await request('/team/invitations',{email:'other@example.test'},viewer)).status,403);
 assert.equal((await request('/servers/'+server.id+'/actions',{type:'kick',target:'1'},viewer)).status,403);
 assert.equal((await request('/team/users',{username:'viewer',password:'stolen-password-123',permissions:['overview']},admin)).status,403);
 assert.equal((await request('/team/users',{username:'viewer',permissions:['overview','players']},admin)).status,200);
 state=(await request('/state',undefined,viewer)).data;assert.equal(state.servers.length,1);assert.equal(state.account.hasAccess,true);assert.equal(state.manager,false);
 assert.equal((await request('/state',undefined,admin)).data.users.find(u=>u.username==='viewer').invited,true);
 assert.equal((await request('/account/workspace',{id:'moderator-home'},viewer)).status,403);
 assert.equal((await request('/account/workspace',{id:'viewer-home'},viewer)).status,200);
 state=(await request('/state',undefined,viewer)).data;assert.equal(state.manager,true);assert.equal(state.servers.length,0);
 await request('/account/workspace',{id:'local'},viewer);
 assert.equal((await request('/team/invitations/revoke',{id:invite.data.id},other)).status,403);
 assert.equal((await request('/team/invitations/revoke',{id:invite.data.id},admin)).status,200);
 state=(await request('/state',undefined,viewer)).data;assert.equal(state.account.workspaceId,'viewer-home');assert.equal(state.account.workspaces.length,1);assert.deepEqual(state.servers,[]);
 assert.equal((await request('/account/workspace',{id:'local'},viewer)).status,403);
 const again=(await request('/team/invitations',{email:'viewer@example.test'},admin)).data;
 await request('/account/invitations/respond',{id:again.id,action:'accept'},viewer);
 await request('/team/invitations/revoke',{id:invite.data.id},admin);
 assert.equal((await request('/account',undefined,viewer)).data.workspaceId,'local');
 assert.equal((await request('/team/members/remove',{username:'viewer'},admin)).status,200);
 assert.equal(db.prepare('SELECT username FROM users WHERE username=?').get('viewer').username,'viewer');
});
test('invitations handle rejection, expiry, cancellation, unverified email and email delivery failure',async t=>{
 const {db,request,admin,viewer}=await invitationFixture(t);
 let invite=(await request('/team/invitations',{email:'viewer@example.test'},admin)).data;
 db.prepare('UPDATE user_emails SET verified=0 WHERE username=?').run('viewer');
 assert.equal((await request('/account',undefined,viewer)).data.invitations.length,0);
 assert.equal((await request('/account/invitations/respond',{id:invite.id,action:'accept'},viewer)).status,404);
 db.prepare('UPDATE user_emails SET verified=1 WHERE username=?').run('viewer');
 assert.equal((await request('/account/invitations/respond',{id:invite.id,action:'reject'},viewer)).status,200);
 assert.equal((await request('/account',undefined,viewer)).data.workspaceId,'viewer-home');
 invite=(await request('/team/invitations',{email:'viewer@example.test'},admin)).data;
 db.prepare('UPDATE panel_invitations SET expires=0 WHERE id=?').run(invite.id);
 assert.equal((await request('/account/invitations/respond',{id:invite.id,action:'accept'},viewer)).status,404);
 invite=(await request('/team/invitations',{email:'viewer@example.test'},admin)).data;
 await request('/team/invitations/revoke',{id:invite.id},admin);
 assert.equal((await request('/account/invitations/respond',{id:invite.id,action:'accept'},viewer)).status,404);
 const failed=await invitationFixture(t,async()=>{throw Error('SMTP down');});
 assert.equal((await failed.request('/team/invitations',{email:'viewer@example.test'},failed.admin)).status,503);
 assert.equal((await failed.request('/account',undefined,failed.viewer)).data.invitations.length,0);
});
test('owner grants user package modules and duration without granting invited workspace management',async t=>{
 const {db,request,admin,viewer,owner}=await invitationFixture(t);
 const invite=(await request('/team/invitations',{email:'viewer@example.test'},admin)).data;
 await request('/account/invitations/respond',{id:invite.id,action:'accept'},viewer);
 const grant={username:'viewer',features:['overview','players','team'],expires:'2099-01-01'};
 assert.equal((await request('/owner/licenses',grant,admin)).status,403);
 assert.equal((await request('/owner/licenses',{...grant,username:'owner'},owner)).status,404);
 assert.equal((await request('/owner/licenses',{...grant,expires:'2000-01-01'},owner)).status,400);
 assert.equal((await request('/owner/licenses',grant,owner)).status,200);
 let state=(await request('/state',undefined,viewer)).data;
 assert.equal(state.manager,false);assert.equal(state.account.workspaceId,'local');assert.equal(state.account.hasAccess,false);
 await request('/account/workspace',{id:'viewer-home'},viewer);
 state=(await request('/state',undefined,viewer)).data;
 assert.equal(state.account.status,'active');assert.equal(state.manager,true);assert.deepEqual(state.features,['overview','players','team']);assert.equal(state.account.expires,'2099-01-01');
 assert.equal((await request('/owner/delete',{kind:'tenant',id:'local'},owner)).status,200);
 assert.equal((await request('/account',undefined,viewer)).data.workspaces.length,1);
 assert.ok(db.prepare('SELECT username FROM users WHERE username=?').get('viewer'));
});

test('owner licensing an existing staff member preserves their old membership without taking over its panel',async t=>{
 const {db,request,login}=await fixture(t);
 const owner=await login('owner'),viewer=await login('viewer');
 db.prepare('UPDATE user_permissions SET manager=0,permissions=? WHERE username=?').run('["overview"]','viewer');
 const result=await request('/owner/licenses',{username:'viewer',features:['overview','players'],expires:null},owner);
 assert.equal(result.status,200);assert.notEqual(result.data.tenantId,'local');
 const state=(await request('/state',undefined,viewer)).data;
 assert.equal(state.account.workspaceId,result.data.tenantId);assert.equal(state.manager,true);assert.equal(state.account.workspaces.length,2);
 await request('/account/workspace',{id:'local'},viewer);
 const member=(await request('/state',undefined,viewer)).data;
 assert.equal(member.manager,false);assert.deepEqual(member.permissions,['overview']);
 assert.equal((await request('/account/workspace',{id:'local'},owner)).status,403);
});
