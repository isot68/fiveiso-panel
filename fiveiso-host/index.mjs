import { execFile, spawn } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const center = String(process.env.FIVEISO_URL || '').replace(/\/$/, '');
const serverId = process.env.FIVEISO_SERVER_ID || '';
const token = process.env.FIVEISO_TOKEN || '';
const executable = resolve(process.env.FXSERVER_EXECUTABLE || 'FXServer.exe');
const cwd = resolve(process.env.FXSERVER_CWD || dirname(executable));
let args = [];
try {
  args = JSON.parse(process.env.FXSERVER_ARGS_JSON || '[]');
  if (!Array.isArray(args) || args.some((value) => typeof value !== 'string')) throw Error();
} catch {
  throw Error('FXSERVER_ARGS_JSON geçerli bir JSON dizisi olmalı.');
}
if (!center || !serverId || !token) throw Error('FIVEISO_URL, FIVEISO_SERVER_ID ve FIVEISO_TOKEN gerekli.');

const ps = (value) => `'${String(value).replaceAll("'", "''")}'`;
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
const acks = new Map();
const handled = new Set();

async function roots() {
  if (process.platform !== 'win32') throw Error('FiveISO sunucu yöneticisi şu anda Windows içindir.');
  const script = `$p=${ps(executable)}; Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -eq $p} | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress`;
  const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
  if (!stdout.trim()) return [];
  const rows = JSON.parse(stdout);
  const list = Array.isArray(rows) ? rows : [rows];
  const ids = new Set(list.map((row) => Number(row.ProcessId)));
  return list.filter((row) => !ids.has(Number(row.ParentProcessId))).map((row) => Number(row.ProcessId));
}

async function running() {
  return (await roots()).length > 0;
}

async function startServer() {
  if (await running()) return 'Sunucu zaten çalışıyor.';
  const child = spawn(executable, args, { cwd, detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  await delay(1500);
  if (!(await running())) throw Error('FXServer işlemi başlatılamadı.');
  return 'Sunucu başlatıldı.';
}

async function stopServer() {
  const ids = await roots();
  if (!ids.length) return 'Sunucu zaten kapalı.';
  for (const pid of ids) await exec('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }).catch(() => {});
  for (let attempt = 0; attempt < 15 && await running(); attempt++) await delay(500);
  if (await running()) throw Error('FXServer işlemi durdurulamadı.');
  return 'Sunucu durduruldu.';
}

async function execute(command) {
  if (command.type === 'serverStart') return startServer();
  if (command.type === 'serverStop') return stopServer();
  if (command.type === 'serverRestart') {
    await stopServer();
    await delay(1500);
    await startServer();
    return 'Sunucu yeniden başlatıldı.';
  }
  throw Error('Desteklenmeyen sunucu işlemi.');
}

async function heartbeat() {
  const response = await fetch(`${center}/api/host/heartbeat`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-fiveiso-server': serverId,
    },
    body: JSON.stringify({ running: await running(), acks: [...acks.values()] }),
  });
  if (!response.ok) throw Error(`Merkez bağlantısı başarısız (${response.status}).`);
  acks.clear();
  const data = await response.json();
  for (const command of Array.isArray(data.commands) ? data.commands : []) {
    if (handled.has(command.id)) continue;
    handled.add(command.id);
    try {
      acks.set(command.id, { id: command.id, ok: true, result: await execute(command) });
    } catch (error) {
      acks.set(command.id, { id: command.id, ok: false, result: error.message });
    }
  }
}

console.log(`FiveISO sunucu yöneticisi hazır: ${basename(executable)}`);
for (;;) {
  try {
    await heartbeat();
  } catch (error) {
    console.error(error.message);
  }
  await delay(2000);
}
