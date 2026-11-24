// 글꼴(sfnt: TrueType/OpenType) 의 name 표 읽기와 이름 바꾸기.
// OFL 의 예약 글꼴 이름(Reserved Font Name)이 있는 글꼴은 부분 집합(수정본)을 다른 이름으로 내야 해서 쓴다.

export interface NameRecord {
  platformID: number;
  encodingID: number;
  languageID: number;
  nameID: number;
  value: string;
}

interface Table {
  tag: string;
  data: Uint8Array;
}

const tagOf = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

function tables(sfnt: Uint8Array): { version: number; list: Table[] } {
  const v = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);
  const n = v.getUint16(4);
  const list: Table[] = [];
  for (let i = 0; i < n; i++) {
    const r = 12 + i * 16;
    const off = v.getUint32(r + 8);
    const len = v.getUint32(r + 12);
    list.push({ tag: tagOf(sfnt, r), data: sfnt.slice(off, off + len) });
  }
  return { version: v.getUint32(0), list };
}

const utf16 = (platformID: number) => platformID === 0 || platformID === 3;

function decode(platformID: number, b: Uint8Array): string {
  if (!utf16(platformID)) return String.fromCharCode(...b);
  let s = '';
  for (let i = 0; i + 1 < b.length; i += 2) s += String.fromCharCode((b[i] << 8) | b[i + 1]);
  return s;
}

function encode(platformID: number, s: string): number[] {
  if (!utf16(platformID)) return [...s].map((c) => c.charCodeAt(0) & 0xff);
  return [...s].flatMap((c) => [c.charCodeAt(0) >> 8, c.charCodeAt(0) & 0xff]);
}

function parseName(t: Uint8Array): NameRecord[] {
  const v = new DataView(t.buffer, t.byteOffset, t.byteLength);
  const count = v.getUint16(2);
  const strings = v.getUint16(4);
  const out: NameRecord[] = [];
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    const platformID = v.getUint16(r);
    const len = v.getUint16(r + 8);
    const off = strings + v.getUint16(r + 10);
    out.push({
      platformID,
      encodingID: v.getUint16(r + 2),
      languageID: v.getUint16(r + 4),
      nameID: v.getUint16(r + 6),
      value: decode(platformID, t.subarray(off, off + len)),
    });
  }
  return out;
}

function buildName(records: NameRecord[]): Uint8Array {
  const sorted = [...records].sort(
    (a, b) => a.platformID - b.platformID || a.encodingID - b.encodingID || a.languageID - b.languageID || a.nameID - b.nameID,
  );
  const bytes = sorted.map((r) => encode(r.platformID, r.value));
  const head = 6 + sorted.length * 12;
  const out = new Uint8Array(head + bytes.reduce((a, b) => a + b.length, 0));
  const v = new DataView(out.buffer);
  v.setUint16(0, 0);
  v.setUint16(2, sorted.length);
  v.setUint16(4, head);
  let off = 0;
  sorted.forEach((r, i) => {
    const p = 6 + i * 12;
    v.setUint16(p, r.platformID);
    v.setUint16(p + 2, r.encodingID);
    v.setUint16(p + 4, r.languageID);
    v.setUint16(p + 6, r.nameID);
    v.setUint16(p + 8, bytes[i].length);
    v.setUint16(p + 10, off);
    out.set(bytes[i], head + off);
    off += bytes[i].length;
  });
  return out;
}

function checksum(b: Uint8Array): number {
  const padded = new Uint8Array((b.length + 3) & ~3);
  padded.set(b);
  const v = new DataView(padded.buffer);
  let sum = 0;
  for (let i = 0; i < padded.length; i += 4) sum = (sum + v.getUint32(i)) >>> 0;
  return sum;
}

function buildSfnt(version: number, list: Table[]): Uint8Array {
  const sorted = [...list].sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const n = sorted.length;
  const pow = 2 ** Math.floor(Math.log2(n));
  let size = 12 + n * 16;
  const offsets = sorted.map((t) => {
    const o = size;
    size += (t.data.length + 3) & ~3;
    return o;
  });
  const out = new Uint8Array(size);
  const v = new DataView(out.buffer);
  v.setUint32(0, version);
  v.setUint16(4, n);
  v.setUint16(6, pow * 16);
  v.setUint16(8, Math.log2(pow));
  v.setUint16(10, n * 16 - pow * 16);
  sorted.forEach((t, i) => {
    const r = 12 + i * 16;
    for (let k = 0; k < 4; k++) out[r + k] = t.tag.charCodeAt(k);
    if (t.tag === 'head') new DataView(t.data.buffer, t.data.byteOffset).setUint32(8, 0); // checkSumAdjustment 은 맨 끝에
    v.setUint32(r + 4, checksum(t.data));
    v.setUint32(r + 8, offsets[i]);
    v.setUint32(r + 12, t.data.length);
    out.set(t.data, offsets[i]);
  });
  const head = sorted.findIndex((t) => t.tag === 'head');
  if (head >= 0) v.setUint32(offsets[head] + 8, (0xb1b0afba - checksum(out)) >>> 0);
  return out;
}

/** sfnt 글꼴의 name 표 기록들 */
export function readNames(sfnt: Uint8Array): NameRecord[] {
  const name = tables(sfnt).list.find((t) => t.tag === 'name');
  return name ? parseName(name.data) : [];
}

/**
 * 글꼴 이름을 family 로 바꾼 sfnt. 글꼴 이름 기록(1 family, 3 unique, 4 full, 6 PostScript, 16·18·21 typographic)만 바꾸고
 * 저작권·라이선스 기록(0, 13, 14 등)은 그대로 둔다(OFL 이 저작권 표시를 남기라고 한다).
 */
export function renameFamily(sfnt: Uint8Array, family: string): Uint8Array {
  const { version, list } = tables(sfnt);
  const ps = family.replace(/[^A-Za-z0-9]/g, '') + '-Regular';
  const value: Record<number, string> = { 1: family, 3: `${ps};subset`, 4: family, 6: ps, 16: family, 18: family, 21: family };
  return buildSfnt(
    version,
    list.map((t) =>
      t.tag === 'name'
        ? { tag: 'name', data: buildName(parseName(t.data).map((r) => (r.nameID in value ? { ...r, value: value[r.nameID] } : r))) }
        : t,
    ),
  );
}
