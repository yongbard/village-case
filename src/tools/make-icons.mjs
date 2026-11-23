// 아이콘 생성: node src/tools/make-icons.mjs  → src/public/icon-192.png, icon-512.png
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PAPER = [0xf3, 0xed, 0xe1];
const ACCENT = [0x2c, 0x4c, 0x7c];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size) {
  // 돋보기: 렌즈 고리 + 대각선 손잡이 (maskable 안전 영역 안쪽에 둔다)
  const cx = size * 0.42, cy = size * 0.42, R = size * 0.2, w = size * 0.045;
  const hx0 = cx + R * 0.72, hy0 = cy + R * 0.72;
  const hx1 = size * 0.72, hy1 = size * 0.72, hw = size * 0.05;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      let ink = Math.abs(d - R) <= w;
      // 손잡이: 선분까지의 거리
      const vx = hx1 - hx0, vy = hy1 - hy0;
      const t = Math.max(0, Math.min(1, ((x - hx0) * vx + (y - hy0) * vy) / (vx * vx + vy * vy)));
      if (Math.hypot(x - (hx0 + t * vx), y - (hy0 + t * vy)) <= hw) ink = true;
      const c = ink ? ACCENT : PAPER;
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = fileURLToPath(new URL('../public/', import.meta.url));
mkdirSync(outDir, { recursive: true });
for (const s of [192, 512]) writeFileSync(`${outDir}icon-${s}.png`, png(s));
console.log('icons written to', outDir);
