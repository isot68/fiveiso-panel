import { build } from 'vite';
import { protectJavaScript as obfuscate } from './obfuscation.mjs';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const root = resolve(process.env.FIVEISO_SOURCE || '../fiveiso');
const output = resolve('dist/resource-template.json');
const read = name => readFile(join(root, name), 'utf8');
const lua = code => `assert(load("${Array.from(Buffer.from(code)).map(b => '\\' + String(b).padStart(3, '0')).join('')}",nil,"t",_ENV))()`;
const serverLua = ['database.lua', 'groups.lua', 'bridge.lua', 'server.lua', 'screen-server.lua'];
const clientLua = ['client.lua', 'screen-client.lua'];
// Fail closed when a new top-level runtime script has not been assigned to a bundle.
const known = new Set([...serverLua, ...clientLua, 'fxmanifest.lua', 'database-config.lua', 'metrics.js', 'command-stream.js', 'command-stream.bundle.js']);
for (const file of await readdir(root)) {
  if (/\.(lua|m?js)$/.test(file) && !known.has(file)) throw Error(`Unpackaged runtime script: ${file}`);
}
const ui = await build({ configFile: false, root, logLevel: 'warn', build: {
  write: false, target: 'chrome91', minify: true, sourcemap: false,
  lib: { entry: join(root, 'ui/src/screen.js'), formats: ['iife'], name: 'FiveISOScreen' },
} });
const chunks = (Array.isArray(ui) ? ui : [ui]).flatMap(result => result.output);
if (chunks.length !== 1 || chunks[0].type !== 'chunk') throw Error('NUI must be one bundled script.');
const payload = {
  serverJs: await Promise.all(['metrics.js', 'command-stream.bundle.js'].map(async name => ({ name, code: obfuscate(await read(name)) }))),
  serverLua: await Promise.all(serverLua.map(async name => ({ name, code: lua(await read(name)) }))),
  clientLua: await Promise.all(clientLua.map(async name => ({ name, code: lua(await read(name)) }))),
  nui: obfuscate(chunks[0].code, 'browser'),
};
const files = {
  'fiveiso/bootstrap.js': obfuscate(await read('protection/server.js')),
  'fiveiso/bootstrap.lua': lua(await read('protection/server.lua')),
  'fiveiso/client-bootstrap.lua': lua(await read('protection/client.lua')),
  'fiveiso/database-config.lua': await read('database-config.lua'),
  'fiveiso/ui/screen.js': obfuscate(await read('protection/ui.js'), 'browser'),
  'fiveiso/ui/index.html': await read('ui/index.html'),
  'install.sh': await read('protection/install.sh'),
  'install.ps1': await read('protection/install.ps1'),
  'KURULUM.txt': await read('protection/README.txt'),
  'fiveiso/fxmanifest.lua': `fx_version 'cerulean'\ngame 'gta5'\nauthor 'FiveISO'\nversion '2.0.0'\nnode_version '22'\ndependency 'oxmysql'\nserver_scripts {'@oxmysql/lib/MySQL.lua', 'database-config.lua', 'bootstrap.lua', 'bootstrap.js'}\nclient_script 'client-bootstrap.lua'\nui_page 'ui/index.html'\nfiles {'ui/index.html', 'ui/screen.js'}\nescrow_ignore 'database-config.lua'\n`,
};
await mkdir(resolve('dist'), { recursive: true });
await writeFile(output, JSON.stringify({ version: 1, payload, files }));
console.log(`Protected template: ${output}. All resource Lua, server JS and Vite-bundled NUI included; no source maps.`);
