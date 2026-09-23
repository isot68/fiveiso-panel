import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { protectJavaScript } from './obfuscation.mjs';
for (const source of ['server', 'fiveiso-host']) {
  const target = join('dist/protected', source);
  await mkdir(target, { recursive: true });
  for (const file of await readdir(source)) {
    if (!/\.m?js$/.test(file)) continue;
    await writeFile(join(target, file), protectJavaScript(await readFile(join(source, file), 'utf8')));
    console.log(`Protected ${source}/${file}`);
  }
}
