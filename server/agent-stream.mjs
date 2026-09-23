import { authorizeAgent } from './licensing.mjs';
import { WebSocket, WebSocketServer } from 'ws';

export function createAgentStream(server, db) {
  const sockets = new Map();
  const upgrades = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 1024 });

  server.on('upgrade', (req, socket, head) => {
    let path;
    try { path = new URL(req.url, 'http://localhost').pathname; } catch { socket.destroy(); return; }
    if (path !== '/api/agent/stream') { socket.destroy(); return; }
    const id = req.headers['x-fiveiso-server'];
    try { authorizeAgent(db, req); } catch {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      return;
    }
    upgrades.handleUpgrade(req, socket, head, (ws) => {
      sockets.get(id)?.terminate();
      sockets.set(id, ws);
      ws.agentRequest = req;
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('close', () => { if (sockets.get(id) === ws) sockets.delete(id); });
      // A reconnect also wakes the agent, so queued commands are not stranded.
      try { ws.send('wake'); } catch { ws.terminate(); }
    });
  });

  const ping = setInterval(() => {
    for (const ws of sockets.values()) {
      try { authorizeAgent(db, ws.agentRequest); } catch { ws.terminate(); continue; }
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 20000);
  ping.unref();

  return {
    disconnect(id) { sockets.get(id)?.terminate(); sockets.delete(id); },
    wake(id) {
      const ws = sockets.get(id);
      if (ws?.readyState === WebSocket.OPEN) {
        try { authorizeAgent(db, ws.agentRequest); ws.send('wake'); } catch { ws.terminate(); }
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
