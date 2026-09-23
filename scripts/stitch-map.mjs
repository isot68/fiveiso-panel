import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const mapDirectory = new URL('../map/', import.meta.url);
const size = 1080;
const tiles = [];
for (let row = 0; row < 3; row++) {
  for (let column = 0; column < 2; column++) {
    const input = fileURLToPath(new URL(`minimap_sea_${row}_${column}.webp`, mapDirectory));
    const metadata = await sharp(input).metadata();
    if (metadata.width !== size || metadata.height !== size) throw Error(`Harita parçasının ölçüsü beklenenden farklı: ${input}`);
    tiles.push({ input, left: column * size, top: row * size });
  }
}
await sharp({ create: { width: size * 2, height: size * 3, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(tiles).webp({ lossless: true }).toFile(fileURLToPath(new URL('minimap-stitched.webp', mapDirectory)));
console.log('minimap-stitched.webp hazır.');
