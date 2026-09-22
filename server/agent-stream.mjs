import { WebSocket, WebSocketServer } from 'ws';
import { sameToken } from './security.mjs';

export function createAgentStream(server, db) {
  const sockets = new Map();
  const upgrades = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 1024 });

  server.on('upgrade', (req, socket, head) => {
    let path;
    try { path = new URL(req.url, 'http://localhost').pathname; } catch { socket.destroy(); return; }
    if (path !== '/api/agent/stream') { socket.destroy(); return; }
    const id = req.headers['x-fiveiso-server'];
    const bearer = req.headers.authorization?.replace(/^Bearer /, '') || '';
    const agent = typeof id === 'string'
      ? db.prepare('SELECT token_hash FROM servers WHERE id=?').get(id)
      : null;
    if (!agent || !sameToken(bearer, agent.token_hash)) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      return;
    }
    upgrades.handleUpgrade(req, socket, head, (ws) => {
      sockets.get(id)?.terminate();
      sockets.set(id, ws);
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('close', () => { if (sockets.get(id) === ws) sockets.delete(id); });
      // A reconnect also wakes the agent, so queued commands are not stranded.
      try { ws.send('wake'); } catch { ws.terminate(); }
    });
  });

  const ping = setInterval(() => {
    for (const ws of sockets.values()) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 20000);
  ping.unref();

  return {
    wake(id) {
      const ws = sockets.get(id);
      if (ws?.readyState === WebSocket.OPEN) {
        try { ws.send('wake'); } catch { ws.terminate(); }
      }
    },
    dispose() {
      clearInterval(ping);
      for (const ws of sockets.values()) ws.terminate();
      sockets.clear();
      upgrades.close();
    },
  };
}
