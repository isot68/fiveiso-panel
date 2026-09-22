import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
export function openStore(path = process.env.PANEL_DB || 'data/fiveiso.sqlite') {
  if (path !== ':memory:')
    mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS command_data(id TEXT PRIMARY KEY, data TEXT NOT NULL, created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS users(username TEXT PRIMARY KEY, password TEXT NOT NULL, role TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS servers(id TEXT PRIMARY KEY,name TEXT NOT NULL,region TEXT NOT NULL,framework TEXT NOT NULL,token_hash TEXT NOT NULL,last_seen INTEGER DEFAULT 0,snapshot TEXT NOT NULL DEFAULT '{}');
 CREATE TABLE IF NOT EXISTS history(server_id TEXT NOT NULL,time INTEGER NOT NULL,players INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY,server_id TEXT NOT NULL,actor TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL,result TEXT);
 CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,time TEXT NOT NULL,actor TEXT NOT NULL,server_id TEXT NOT NULL,action TEXT NOT NULL,status TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS bans(id TEXT PRIMARY KEY,server_id TEXT NOT NULL,license TEXT NOT NULL,reason TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(server_id,license));
 CREATE TABLE IF NOT EXISTS map_blips(id TEXT PRIMARY KEY,server_id TEXT NOT NULL REFERENCES servers(id),sprite INTEGER NOT NULL,color_code TEXT NOT NULL,label TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,created INTEGER NOT NULL,actor TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS map_blips_server ON map_blips(server_id,created);
 CREATE INDEX IF NOT EXISTS history_server ON history(server_id,time);
 CREATE INDEX IF NOT EXISTS commands_server ON commands(server_id,status);
 `);
  return db;
}
