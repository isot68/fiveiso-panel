import { openStore } from '../server/store.mjs';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const db = openStore();
try {
  mkdirSync('data/backups', { recursive: true });
  const file = resolve(
    'data/backups',
    `fiveiso-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`,
  );
  db.prepare('VACUUM INTO ?').run(file);
  console.log(`Merkez veritabanı yedeklendi: ${file}`);
} finally {
  db.close();
}
