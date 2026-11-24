// 인물 사진: 직업마다 손으로 그린 SVG (viewBox 0 0 60 60, 가슴 위 상반신, 갈색조).
// 증인 8명은 사용자가 확인한 시안(docs/mockups/2026-11-24-portraits-fonts.html) 그대로.
// 직업마다 머리 윤곽(모자·머리 모양)과 소품이 달라 작은 크기에서도 구별된다. 악 진영은 바탕이 더 어둡다.
import { type RoleId } from '../core/types';
import { h } from './dom';

export interface Portrait {
  /** 사진 바탕색 #rrggbb */
  bg: string;
  /** viewBox 0 0 60 60 안에 들어갈 도형 마크업 */
  art: string;
}

const SKIN = '#c9b291';

export const PORTRAITS: Record<RoleId, Portrait> = {
  // ---------- 증인 ----------
  postman: {
    bg: '#46505a',
    art: `<path d="M8 60 Q9 41 30 39 Q51 41 52 60Z" fill="#5d6874"/>
<path d="M14 42 L46 60 L41 60 L12 45Z" fill="#8a7a62"/>
<rect x="26" y="33" width="8" height="7" fill="${SKIN}"/>
<ellipse cx="30" cy="25" rx="9" ry="10" fill="${SKIN}"/>
<path d="M19 20 Q30 9 41 20 L41 22 L19 22Z" fill="#2f3944"/>
<path d="M17 22 H43 Q42 25 30 25 Q18 25 17 22Z" fill="#1f262e"/>
<rect x="28" y="15" width="4" height="3" fill="#b9a77a"/>
<rect x="37" y="48" width="13" height="9" fill="#e6dccb" transform="rotate(-10 43 52)"/>
<path d="M37 48 l6.5 5 l6.5 -5" stroke="#8e4a3c" stroke-width="1.2" fill="none" transform="rotate(-10 43 52)"/>`,
  },
  pharmacist: {
    bg: '#4e5a4f',
    art: `<path d="M10 60 Q11 42 30 40 Q49 42 50 60Z" fill="#e4ddcf"/>
<path d="M30 40 L25 60 M30 40 L35 60" stroke="#b8ae9c" stroke-width="1.5"/>
<path d="M26 41 L30 50 L34 41Z" fill="#7a8a76"/>
<rect x="27" y="33" width="6" height="8" fill="${SKIN}"/>
<ellipse cx="30" cy="26" rx="8.5" ry="10" fill="${SKIN}"/>
<path d="M21 25 Q20 14 30 14 Q40 14 39 25 Q36 18 30 18 Q24 18 21 25Z" fill="#3e3025"/>
<circle cx="30" cy="11" r="5" fill="#3e3025"/>
<circle cx="26.5" cy="27" r="3" fill="none" stroke="#2a241d" stroke-width="1"/>
<circle cx="33.5" cy="27" r="3" fill="none" stroke="#2a241d" stroke-width="1"/>
<path d="M29.5 27 h1" stroke="#2a241d"/>
<path d="M40 48 h3 v-3 h3 v3 h3 v3 h-3 v3 h-3 v-3 h-3z" fill="#6f8a6a"/>`,
  },
  mayor: {
    bg: '#57483a',
    art: `<path d="M5 60 Q6 39 30 37 Q54 39 55 60Z" fill="#3a332c"/>
<path d="M25 38 L30 47 L35 38Z" fill="#e4ddcf"/>
<path d="M29 41 h2 l1 10 l-2 3 l-2 -3z" fill="#8e4a3c"/>
<path d="M12 44 L48 58 L46 61 L10 47Z" fill="#b39b62"/>
<rect x="25" y="30" width="10" height="9" fill="${SKIN}"/>
<ellipse cx="30" cy="24" rx="11" ry="11" fill="${SKIN}"/>
<path d="M19 23 Q19 29 21 30 L21 22Z M41 23 Q41 29 39 30 L39 22Z" fill="#8f8577"/>
<path d="M23 29 Q30 25 37 29 Q34 31 30 29.5 Q26 31 23 29Z" fill="#6f665a"/>
<path d="M25 22 h3 M32 22 h3" stroke="#2a241d" stroke-width="1.2"/>`,
  },
  guard: {
    bg: '#3b4048',
    art: `<path d="M2 60 Q3 40 30 38 Q57 40 58 60Z" fill="#4b5563"/>
<rect x="6" y="41" width="12" height="3" fill="#b9a77a" transform="rotate(-12 12 42)"/>
<rect x="42" y="41" width="12" height="3" fill="#b9a77a" transform="rotate(12 48 42)"/>
<path d="M30 40 v20" stroke="#2f3640" stroke-width="1.5"/>
<circle cx="30" cy="46" r="1.2" fill="#b9a77a"/><circle cx="30" cy="52" r="1.2" fill="#b9a77a"/>
<rect x="25" y="32" width="10" height="8" fill="${SKIN}"/>
<path d="M20 22 Q20 36 30 36 Q40 36 40 22Z" fill="${SKIN}"/>
<path d="M17 19 Q30 6 43 19 L41 21 H19Z" fill="#2f3640"/>
<path d="M16 21 H44 L40 24 H20Z" fill="#1d2228"/>
<path d="M28 12 l2 -2 l2 2 l-2 4z" fill="#b9a77a"/>
<path d="M24 27 h4 M32 27 h4" stroke="#2a241d" stroke-width="1.3"/>`,
  },
  baker: {
    bg: '#6a523a',
    art: `<path d="M6 60 Q6 40 30 38 Q54 40 54 60Z" fill="#d8cdb8"/>
<path d="M18 46 H42 V60 H18Z" fill="#efe8da"/>
<path d="M22 46 Q30 42 38 46" stroke="#b8ae9c" fill="none"/>
<rect x="35" y="40" width="5" height="22" rx="2.5" fill="#a5814f" transform="rotate(25 37 51)"/>
<ellipse cx="30" cy="29" rx="11" ry="10" fill="${SKIN}"/>
<circle cx="24" cy="31" r="2" fill="#c2977a" opacity=".6"/><circle cx="36" cy="31" r="2" fill="#c2977a" opacity=".6"/>
<rect x="21" y="16" width="18" height="6" fill="#f1ece2"/>
<circle cx="23" cy="12" r="5.5" fill="#f1ece2"/><circle cx="30" cy="9" r="6.5" fill="#f1ece2"/><circle cx="37" cy="12" r="5.5" fill="#f1ece2"/>
<path d="M26 34 Q30 37 34 34" stroke="#2a241d" fill="none" stroke-width="1.2"/>`,
  },
  photographer: {
    bg: '#2c2925',
    art: `<path d="M8 60 Q9 42 30 40 Q51 42 52 60Z" fill="#6b5f50"/>
<path d="M22 41 Q30 48 38 41" stroke="#4a4136" stroke-width="3" fill="none"/>
<rect x="27" y="33" width="6" height="8" fill="${SKIN}"/>
<ellipse cx="30" cy="25" rx="9" ry="10" fill="${SKIN}"/>
<ellipse cx="29" cy="16" rx="12" ry="5" fill="#8e4a3c"/>
<circle cx="29" cy="11.5" r="1.5" fill="#8e4a3c"/>
<rect x="17" y="22" width="26" height="14" rx="2" fill="#26221e"/>
<rect x="20" y="19" width="7" height="4" fill="#26221e"/>
<circle cx="30" cy="29" r="5.5" fill="#55504a"/><circle cx="30" cy="29" r="3" fill="#8c8a86"/>
<rect x="12" y="30" width="6" height="8" rx="3" fill="${SKIN}"/><rect x="42" y="30" width="6" height="8" rx="3" fill="${SKIN}"/>`,
  },
  reporter: {
    bg: '#55534f',
    art: `<path d="M7 60 Q8 41 30 39 Q52 41 53 60Z" fill="#9a8a6c"/>
<path d="M22 39 L30 52 L38 39 L34 38 L30 45 L26 38Z" fill="#7d6f55"/>
<rect x="27" y="32" width="6" height="8" fill="${SKIN}"/>
<path d="M22 25 Q22 35 30 35 Q38 35 38 25Z" fill="${SKIN}"/>
<path d="M12 23 Q30 19 48 23 Q44 25 30 25 Q16 25 12 23Z" fill="#3a352e"/>
<path d="M20 23 Q20 10 30 11 Q40 10 40 23Z" fill="#4a443b"/>
<rect x="20" y="19" width="20" height="3" fill="#2a2620"/>
<rect x="34" y="14" width="5" height="6" fill="#e6dccb" transform="rotate(8 36 17)"/>
<rect x="39" y="46" width="11" height="13" fill="#e6dccb" transform="rotate(-8 44 52)"/>
<path d="M41 50 h7 M41 53 h7 M41 56 h5" stroke="#8a7f6c" stroke-width=".8" transform="rotate(-8 44 52)"/>
<rect x="12" y="44" width="2" height="12" fill="#b39b62" transform="rotate(20 13 50)"/>`,
  },
  bellringer: {
    bg: '#4a3a42',
    art: `<path d="M9 60 Q10 38 30 36 Q50 38 51 60Z" fill="#5e4b3d"/>
<path d="M17 32 Q15 12 30 10 Q45 12 43 32 Q42 38 30 38 Q18 38 17 32Z" fill="#5e4b3d"/>
<ellipse cx="30" cy="25" rx="8" ry="9" fill="${SKIN}"/>
<path d="M22 27 Q22 44 30 48 Q38 44 38 27 Q34 31 30 30 Q26 31 22 27Z" fill="#ddd6c8"/>
<path d="M25 23 h3 M32 23 h3" stroke="#2a241d" stroke-width="1.1"/>
<path d="M41 42 Q41 34 46 34 Q51 34 51 42 L53 46 H39Z" fill="#b39b62"/>
<circle cx="46" cy="48" r="1.6" fill="#8c7646"/>
<rect x="45" y="30" width="2" height="5" fill="#6f5a33"/>`,
  },

  // ---------- 말썽꾼 ----------
  braggart: {
    // 두 팔을 번쩍 든 과장된 몸짓, 크게 벌린 입, 나비넥타이, 말아 올린 앞머리
    bg: '#6b4f3f',
    art: `<path d="M12 60 Q13 43 30 41 Q47 43 48 60Z" fill="#8a5a44"/>
<path d="M16 48 L6 22" stroke="#8a5a44" stroke-width="7" stroke-linecap="round"/>
<path d="M44 48 L54 22" stroke="#8a5a44" stroke-width="7" stroke-linecap="round"/>
<circle cx="6" cy="19" r="4" fill="${SKIN}"/><circle cx="54" cy="19" r="4" fill="${SKIN}"/>
<rect x="27" y="34" width="6" height="7" fill="${SKIN}"/>
<path d="M23 40 L30 44 L23 48Z M37 40 L30 44 L37 48Z" fill="#9a3a2e"/>
<circle cx="30" cy="44" r="1.8" fill="#6e241c"/>
<ellipse cx="30" cy="27" rx="9" ry="10" fill="${SKIN}"/>
<path d="M21 23 Q22 13 31 13 Q40 13 39 22 Q35 17 28 18 Q24 19 21 23Z" fill="#2a241d"/>
<circle cx="35" cy="12" r="3.2" fill="none" stroke="#2a241d" stroke-width="2"/>
<path d="M25 25 q1.5 -2 3 0 M32 25 q1.5 -2 3 0" stroke="#2a241d" stroke-width="1.1" fill="none"/>
<ellipse cx="30" cy="32" rx="4" ry="3" fill="#3a2420"/>`,
  },
  lost: {
    // 챙 넓은 등산모, 배낭끈, 가슴 앞에 펼친 지도, 머리 위 물음표
    bg: '#5f6650',
    art: `<path d="M8 60 Q9 42 30 40 Q51 42 52 60Z" fill="#7a6a4e"/>
<path d="M18 41 L20 60 M42 41 L40 60" stroke="#4a3f2c" stroke-width="3"/>
<rect x="27" y="33" width="6" height="8" fill="${SKIN}"/>
<ellipse cx="30" cy="26" rx="8.5" ry="9.5" fill="${SKIN}"/>
<path d="M14 22 Q30 17 46 22 Q42 24 30 24 Q18 24 14 22Z" fill="#8f8a63"/>
<path d="M21 22 Q22 12 30 12 Q38 12 39 22Z" fill="#a39d74"/>
<circle cx="26.5" cy="27" r="1.2" fill="#2a241d"/><circle cx="33.5" cy="27" r="1.2" fill="#2a241d"/>
<path d="M27 32 q3 -1.5 6 0" stroke="#2a241d" stroke-width="1.1" fill="none"/>
<rect x="12" y="44" width="36" height="16" fill="#e2d6b8" transform="rotate(-4 30 52)"/>
<path d="M24 44 v16 M36 44 v16" stroke="#b5a787" stroke-width=".8" transform="rotate(-4 30 52)"/>
<path d="M15 56 q6 -8 12 -2 t12 -4" stroke="#8e4a3c" stroke-width="1" stroke-dasharray="2 1.5" fill="none" transform="rotate(-4 30 52)"/>
<path d="M46 6 q4 -3 7 0 q2 3 -3 5 v3" stroke="#e6dccb" stroke-width="2" fill="none" stroke-linecap="round"/>
<circle cx="50" cy="17.5" r="1.3" fill="#e6dccb"/>`,
  },
  gossip: {
    // 턱 밑에서 묶은 머릿수건, 입가에 댄 손, 옆으로 흘긴 눈
    bg: '#6a5560',
    art: `<path d="M9 60 Q10 42 30 40 Q50 42 51 60Z" fill="#7d5d52"/>
<path d="M20 41 Q30 50 40 41" stroke="#a88a6a" stroke-width="3" fill="none"/>
<ellipse cx="30" cy="27" rx="8.5" ry="9.5" fill="${SKIN}"/>
<path d="M18 30 Q16 11 30 11 Q44 11 42 30 L39 26 Q38 17 30 17 Q22 17 21 26Z" fill="#a0704a"/>
<circle cx="24" cy="15" r="1.2" fill="#e6dccb"/><circle cx="31" cy="13" r="1.2" fill="#e6dccb"/><circle cx="37" cy="16" r="1.2" fill="#e6dccb"/>
<path d="M27 36 L30 41 L33 36Z" fill="#a0704a"/>
<path d="M26 26 h2.5 M33 26 h2.5" stroke="#2a241d" stroke-width="1"/>
<circle cx="28" cy="27.3" r="1" fill="#2a241d"/><circle cx="35.4" cy="27.3" r="1" fill="#2a241d"/>
<path d="M46 60 L40 36" stroke="#7d5d52" stroke-width="7" stroke-linecap="round"/>
<ellipse cx="38.5" cy="32" rx="4" ry="5.5" fill="${SKIN}"/>
<path d="M29 32.5 q1.5 1 3 0" stroke="#2a241d" stroke-width="1" fill="none"/>`,
  },
  hidden: {
    // 깃을 높이 세운 코트로 코 아래를 가리고, 납작모를 눈 바로 위까지 눌러 씀
    bg: '#4c4a44',
    art: `<path d="M6 60 Q7 42 30 40 Q53 42 54 60Z" fill="#6f6a5e"/>
<ellipse cx="30" cy="27" rx="8.5" ry="9.5" fill="${SKIN}"/>
<path d="M15 60 L16 30 L30 37 L44 30 L45 60Z" fill="#7f796b"/>
<path d="M16 30 L30 37 L44 30 L42 36 L30 42 L18 36Z" fill="#5c574c"/>
<path d="M19 22 Q20 13 31 13 Q42 14 42 21 L44 23 Q30 26 18 23Z" fill="#4a4338"/>
<path d="M25 26 h3 M32 26 h3" stroke="#2a241d" stroke-width="1.3"/>
<path d="M30 40 v20" stroke="#5c574c" stroke-width="1.2"/>`,
  },

  // ---------- 공범 ----------
  thief: {
    // 털모자, 눈가리개 복면, 줄무늬 옷
    bg: '#2e2a28',
    art: `<path d="M8 60 Q9 42 30 40 Q51 42 52 60Z" fill="#5b5752"/>
<path d="M9 47 H51 M8 53 H52 M8 59 H52" stroke="#2f2c29" stroke-width="3"/>
<rect x="27" y="33" width="6" height="8" fill="${SKIN}"/>
<ellipse cx="30" cy="27" rx="9" ry="10" fill="${SKIN}"/>
<path d="M20 22 Q20 10 30 10 Q40 10 40 22Z" fill="#3a3633"/>
<rect x="19" y="20" width="22" height="4" fill="#2a2725"/>
<circle cx="30" cy="9" r="3" fill="#3a3633"/>
<rect x="18" y="25" width="24" height="6" rx="2" fill="#141211"/>
<circle cx="25.5" cy="28" r="1.8" fill="#e6dccb"/><circle cx="34.5" cy="28" r="1.8" fill="#e6dccb"/>
<path d="M27 34 h6" stroke="#2a241d" stroke-width="1.2"/>`,
  },
  blackmailer: {
    // 기름 바른 가르마, 가는 콧수염, 앞으로 내민 붉은 봉랍 봉투
    bg: '#2a2b31',
    art: `<path d="M8 60 Q9 42 30 40 Q51 42 52 60Z" fill="#33343c"/>
<path d="M23 40 L30 50 L37 40 L33 39 L30 44 L27 39Z" fill="#d9d2c4"/>
<rect x="27" y="33" width="6" height="8" fill="${SKIN}"/>
<ellipse cx="30" cy="26" rx="8.5" ry="10" fill="${SKIN}"/>
<path d="M21 24 Q21 14 30 14 Q39 14 39 24 Q37 19 33 18 L31 21 L30 18 Q24 18 21 24Z" fill="#1b1a1d"/>
<path d="M25 26 l3 .8 M35 26 l-3 .8" stroke="#2a241d" stroke-width="1.4"/>
<path d="M25 31.5 Q30 30 35 31.5" stroke="#1b1a1d" stroke-width="1.3" fill="none"/>
<rect x="11" y="43" width="22" height="14" fill="#e8dfcd" transform="rotate(-8 22 50)"/>
<path d="M11 43 L22 51 L33 43" stroke="#a89c86" stroke-width="1" fill="none" transform="rotate(-8 22 50)"/>
<circle cx="22" cy="51" r="3" fill="#8e2a22" transform="rotate(-8 22 50)"/>`,
  },
  lookout: {
    // 귀덮개 모자, 눈앞에 댄 쌍안경
    bg: '#262c2a',
    art: `<path d="M8 60 Q9 42 30 40 Q51 42 52 60Z" fill="#4e5a4a"/>
<rect x="27" y="33" width="6" height="8" fill="${SKIN}"/>
<ellipse cx="30" cy="27" rx="9" ry="10" fill="${SKIN}"/>
<path d="M19 26 Q18 12 30 12 Q42 12 41 26Z" fill="#6b5a3e"/>
<path d="M19 22 Q16 30 19 34 L23 33 L22 23Z M41 22 Q44 30 41 34 L37 33 L38 23Z" fill="#6b5a3e"/>
<rect x="18" y="23" width="10" height="8" rx="2" fill="#1e1c1a"/><rect x="32" y="23" width="10" height="8" rx="2" fill="#1e1c1a"/>
<rect x="27" y="25" width="6" height="3" fill="#1e1c1a"/>
<circle cx="23" cy="27" r="2.6" fill="#6f7a80"/><circle cx="37" cy="27" r="2.6" fill="#6f7a80"/>
<path d="M14 60 L18 34 M46 60 L42 34" stroke="#4e5a4a" stroke-width="6" stroke-linecap="round"/>
<path d="M27 35 q3 1 6 0" stroke="#2a241d" stroke-width="1.1" fill="none"/>`,
  },
  shill: {
    // 납작한 밀짚모자, 함박웃음, 옆으로 든 확성기
    bg: '#3a2c28',
    art: `<path d="M8 60 Q9 42 30 40 Q51 42 52 60Z" fill="#7a4e3a"/>
<path d="M24 41 v19 M36 41 v19" stroke="#e6dccb" stroke-width="2"/>
<rect x="27" y="33" width="6" height="8" fill="${SKIN}"/>
<ellipse cx="28" cy="27" rx="8.5" ry="9.5" fill="${SKIN}"/>
<rect x="12" y="17" width="32" height="3" rx="1.5" fill="#c9a865"/>
<rect x="19" y="11" width="18" height="7" fill="#c9a865"/>
<rect x="19" y="15" width="18" height="2" fill="#8e4a3c"/>
<path d="M23 25 q1.5 -1.5 3 0 M30 25 q1.5 -1.5 3 0" stroke="#2a241d" stroke-width="1.1" fill="none"/>
<path d="M22 30 Q28 37 34 30Z" fill="#3a2420"/>
<path d="M36 30 L52 22 L54 40 L36 34Z" fill="#b39b62"/>
<rect x="33" y="30" width="4" height="5" fill="#8c7646"/>
<path d="M55 26 q3 5 0 10 M57 23 q5 8 0 16" stroke="#e6dccb" stroke-width="1" fill="none"/>`,
  },
  smooth: {
    // 비스듬히 쓴 모자, 한쪽 눈 찡긋, 비죽 웃음, 목에 두른 스카프
    bg: '#322a30',
    art: `<path d="M8 60 Q9 42 30 40 Q51 42 52 60Z" fill="#5a4652"/>
<path d="M22 40 Q30 47 38 40 L36 50 Q30 53 24 50Z" fill="#9a6a5a"/>
<rect x="27" y="33" width="6" height="7" fill="${SKIN}"/>
<ellipse cx="30" cy="26" rx="8.5" ry="10" fill="${SKIN}"/>
<g transform="rotate(-14 30 18)"><path d="M13 21 Q30 17 47 21 Q43 23 30 23 Q17 23 13 21Z" fill="#2a2228"/>
<path d="M21 21 Q21 10 30 11 Q39 10 39 21Z" fill="#3c3038"/><rect x="21" y="18" width="18" height="2.5" fill="#8e4a3c"/></g>
<path d="M24.5 27 q1.8 -1.6 3.6 0" stroke="#2a241d" stroke-width="1.2" fill="none"/>
<circle cx="34" cy="26.5" r="1.3" fill="#2a241d"/>
<path d="M26 32 Q31 34 35 30.5" stroke="#2a241d" stroke-width="1.2" fill="none"/>`,
  },

  // ---------- 주범 ----------
  chief: {
    // 아주 넓은 어깨, 홈부르크 모자, 시가와 연기
    bg: '#241f1c',
    art: `<path d="M0 60 Q1 38 30 36 Q59 38 60 60Z" fill="#3a332e"/>
<path d="M24 37 L30 50 L36 37Z" fill="#d9d2c4"/><path d="M29 39 h2 l1 12 l-2 3 l-2 -3z" fill="#5a1e18"/>
<rect x="24" y="30" width="12" height="8" fill="${SKIN}"/>
<path d="M19 22 Q19 36 30 36 Q41 36 41 22Z" fill="${SKIN}"/>
<path d="M13 21 Q30 18 47 21 Q44 24 30 24 Q16 24 13 21Z" fill="#141210"/>
<path d="M19 21 Q18 9 30 9 Q42 9 41 21Z" fill="#1f1b18"/>
<path d="M22 13 Q30 10 38 13" stroke="#141210" stroke-width="1.5" fill="none"/>
<rect x="19" y="18" width="22" height="3" fill="#5a1e18"/>
<path d="M24 27 h4 M32 27 h4" stroke="#2a241d" stroke-width="1.5"/>
<rect x="33" y="31" width="12" height="2.6" rx="1" fill="#6a4a2e"/><circle cx="45.5" cy="32.3" r="1.4" fill="#c25a3a"/>
<path d="M47 29 q3 -3 0 -6 q-3 -3 1 -6" stroke="#8c847a" stroke-width="1.1" fill="none"/>`,
  },
  shadow: {
    // 두건 쓴 검은 실루엣, 희미하게 빛나는 두 눈뿐
    bg: '#1d1b1a',
    art: `<path d="M4 60 Q6 38 30 36 Q54 38 56 60Z" fill="#0d0c0b"/>
<path d="M15 40 Q12 10 30 8 Q48 10 45 40 Q38 44 30 44 Q22 44 15 40Z" fill="#0d0c0b"/>
<path d="M20 36 Q19 17 30 16 Q41 17 40 36 Q35 38 30 38 Q25 38 20 36Z" fill="#050404"/>
<ellipse cx="25.5" cy="27" rx="2" ry="1" fill="#b9a77a"/><ellipse cx="34.5" cy="27" rx="2" ry="1" fill="#b9a77a"/>`,
  },
  briber: {
    // 실크해트, 외알 안경, 부채처럼 편 돈다발, 금줄
    bg: '#2d2620',
    art: `<path d="M8 60 Q9 42 30 40 Q51 42 52 60Z" fill="#4a2e2a"/>
<path d="M23 40 L30 49 L37 40Z" fill="#d9d2c4"/>
<path d="M16 50 Q24 56 30 50" stroke="#c9a54a" stroke-width="1.4" fill="none"/>
<rect x="27" y="33" width="6" height="8" fill="${SKIN}"/>
<ellipse cx="30" cy="27" rx="9" ry="10" fill="${SKIN}"/>
<rect x="15" y="17" width="30" height="3" rx="1.5" fill="#141210"/>
<rect x="21" y="2" width="18" height="16" fill="#1a1715"/>
<rect x="21" y="13" width="18" height="2.5" fill="#6e241c"/>
<path d="M24 26 h3" stroke="#2a241d" stroke-width="1.2"/>
<circle cx="34.5" cy="26" r="3" fill="none" stroke="#c9a54a" stroke-width="1.2"/><circle cx="34.5" cy="26" r=".9" fill="#2a241d"/>
<path d="M37 28 q2 6 -1 12" stroke="#c9a54a" stroke-width=".7" fill="none"/>
<path d="M26 32 q4 2 8 0" stroke="#2a241d" stroke-width="1.1" fill="none"/>
<rect x="37" y="42" width="15" height="8" fill="#7e8a6a" transform="rotate(-30 40 50)"/>
<rect x="38" y="43" width="15" height="8" fill="#8f9b78" transform="rotate(-10 40 50)"/>
<rect x="39" y="44" width="15" height="8" fill="#a1ad88" transform="rotate(10 40 50)"/>
<circle cx="46" cy="50" r="2" fill="#5e6a4e"/>`,
  },
};

/** 직업을 모르는 증인이나 없는 직업: 이름 없는 실루엣 */
export const FALLBACK: Portrait = {
  bg: '#4a4540',
  art: `<path d="M8 60 Q9 42 30 40 Q51 42 52 60Z" fill="#6e665c"/>
<rect x="27" y="33" width="6" height="8" fill="#8a8073"/>
<ellipse cx="30" cy="26" rx="9" ry="10" fill="#8a8073"/>`,
};

export function portraitOf(id: RoleId): Portrait {
  return Object.prototype.hasOwnProperty.call(PORTRAITS, id) ? PORTRAITS[id] : FALLBACK;
}

/** 인물 사진 요소: span.photo (바탕색) 안에 svg. 그림은 이 파일의 상수뿐이라 innerHTML 로 넣는다. */
export function photo(id: RoleId, cls?: string): HTMLElement {
  const p = portraitOf(id);
  const el = h('span', { class: cls ? `photo ${cls}` : 'photo', style: `background:${p.bg}` });
  el.innerHTML = `<svg viewBox="0 0 60 60" aria-hidden="true" focusable="false">${p.art}</svg>`;
  return el;
}
