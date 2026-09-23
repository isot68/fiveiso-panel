import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const source = 'https://docs.fivem.net/docs/game-references/blips/';
const root = resolve('public/assets/blips');
const html = await fetch(source).then((response) => {
  if (!response.ok) throw Error(`Blip reference: HTTP ${response.status}`);
  return response.text();
});
const page = html.replace(/<!--[\s\S]*?-->/g, '');
const sprites = [...page.matchAll(/<div class="blip"><div><div><img src="(https:\/\/docs-backend\.fivem\.net\/blips\/([a-z0-9_]+)\.(gif|png))" alt="([^"]+)"><\/div><\/div><span><strong>(\d+)<\/strong><br>([^<]+)<\/span><\/div>/g)].map((match) => ({
  id: Number(match[5]), name: match[6], asset: `/assets/blips/${match[2]}.${match[3] === 'png' ? 'webp' : match[3]}`, url: match[1],
}));
const colors = [...page.matchAll(/<div class="blip bcolor"><div class="blip_color" style="background-color: (#[0-9a-fA-F]{6})"><\/div><span><strong>([^<]+)<\/strong><br>([^<]+)<\/span><\/div>/g)].map((match) => ({
  code: match[2], id: Number.parseInt(match[2], 10), name: match[3], hex: match[1].toLowerCase(),
}));
if (sprites.length < 800 || colors.length < 86) throw Error(`Eksik referans: ${sprites.length} blip, ${colors.length} renk`);
if (new Set(sprites.map((sprite) => sprite.id)).size !== sprites.length) throw Error('Tekrarlanan blip kodu');
await mkdir(root, { recursive: true });
let next = 0;
let downloaded = 0;
async function worker() {
  while (next < sprites.length) {
    const sprite = sprites[next++];
    const path = resolve(root, sprite.asset.split('/').at(-1));
    try { if ((await readFile(path)).length > 0) continue; } catch { /* Not downloaded yet. */ }
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(sprite.url);
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
          throw Error(`HTTP ${response.status}: ${sprite.url}`);
        const downloadedImage = Buffer.from(await response.arrayBuffer());
        const image = sprite.asset.endsWith('.webp')
          ? await sharp(downloadedImage).webp({ lossless: true }).toBuffer()
          : downloadedImage;
        await writeFile(path, image);
        downloaded++;
        lastError = null;
        break;
      } catch (error) { lastError = error; }
    }
    if (lastError) throw lastError;
  }
}
await Promise.all(Array.from({ length: 16 }, worker));
await writeFile(resolve(root, 'catalog.json'), JSON.stringify({ source, sprites: sprites.map(({ id, name, asset }) => ({ id, name, asset })), colors }, null, 2) + '\n');
console.log(`${sprites.length} blip, ${colors.length} renk; ${downloaded} görsel indirildi.`);
