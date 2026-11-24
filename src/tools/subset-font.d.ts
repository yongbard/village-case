// subset-font 는 타입 선언이 없어 쓰는 부분만 적는다.
declare module 'subset-font' {
  export default function subsetFont(
    font: Uint8Array,
    text: string,
    options?: { targetFormat?: 'woff2' | 'woff' | 'truetype' | 'sfnt' },
  ): Promise<Uint8Array>;
}
