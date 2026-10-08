// Generates the PWA icons + favicon from the footprints mark (cream on deep sage).
//   npm run icons   →  public/icons/{icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png}, public/favicon.ico
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const SAGE = '#56633f', CREAM = '#f5ead8';
// lucide "footprints" (the prototype's `feet` icon), 24×24 viewBox
const FEET = [
  'M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z',
  'M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z',
  'M16 17h4',
  'M4 13h4',
];

/** shape: 'circle' (transparent corners, like the in-app mark) or 'square' (full bleed). scale: glyph width / canvas. */
function svg({ shape, scale }) {
  const k = (512 * scale) / 24;
  const bg = shape === 'circle' ? `<circle cx="256" cy="256" r="256" fill="${SAGE}"/>` : `<rect width="512" height="512" fill="${SAGE}"/>`;
  const paths = FEET.map(d => `<path d="${d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}<g transform="translate(256 256) scale(${k.toFixed(4)}) translate(-12 -12)" fill="none" stroke="${CREAM}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

const png = (source, size) => sharp(Buffer.from(source), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/** A .ico holding PNG-encoded images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map(i => i.data)]);
}

const dir = path.join(root, 'icons');
mkdirSync(dir, { recursive: true });

const round = svg({ shape: 'circle', scale: 0.48 }); // matches the 58px mark with its 28px glyph
const square = svg({ shape: 'square', scale: 0.46 });
const maskable = svg({ shape: 'square', scale: 0.4 }); // glyph inside the 80% safe zone

writeFileSync(path.join(dir, 'icon.svg'), round);
writeFileSync(path.join(dir, 'icon-192.png'), await png(round, 192));
writeFileSync(path.join(dir, 'icon-512.png'), await png(round, 512));
writeFileSync(path.join(dir, 'icon-maskable-512.png'), await png(maskable, 512));
writeFileSync(path.join(dir, 'apple-touch-icon.png'), await png(square, 180));
writeFileSync(path.join(root, 'favicon.ico'), ico(await Promise.all([16, 32, 48].map(async size => ({ size, data: await png(round, size) })))));
console.log('icons written to', path.relative(process.cwd(), root));
