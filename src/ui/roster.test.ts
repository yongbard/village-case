import { expect, test } from 'vitest';
import { rosterList, rosterRows } from './roster';

test('rows: boss, accomplice, trouble, witness; roles in table order; zero roles dropped', () => {
  const rows = rosterRows({ chief: 1, briber: 1, thief: 2, braggart: 1, pharmacist: 4, postman: 3, mayor: 0 });
  expect(rows.map((r) => [r.camp, r.label, r.total])).toEqual([
    ['boss', '주범', 2],
    ['accomplice', '공범', 2],
    ['trouble', '말썽꾼', 1],
    ['witness', '증인', 7],
  ]);
  expect(rows[0].items.map((x) => [x.name, x.count])).toEqual([['두목', 1], ['매수왕', 1]]);
  expect(rows[3].items.map((x) => x.id)).toEqual(['postman', 'pharmacist']);
});

test('a camp with nobody still shows with 0', () => {
  const rows = rosterRows({ chief: 1, postman: 8 });
  expect(rows.map((r) => [r.label, r.total, r.items.length])).toEqual([
    ['주범', 1, 1], ['공범', 0, 0], ['말썽꾼', 0, 0], ['증인', 8, 1],
  ]);
});

test('list: non-witness roles with counts and camps, boss → accomplice → trouble', () => {
  expect(rosterList({ chief: 2, thief: 1, blackmailer: 1, gossip: 2, postman: 3 })).toEqual([
    { id: 'chief', name: '두목', count: 2, camp: 'boss' },
    { id: 'thief', name: '좀도둑', count: 1, camp: 'accomplice' },
    { id: 'blackmailer', name: '협박꾼', count: 1, camp: 'accomplice' },
    { id: 'gossip', name: '소문쟁이', count: 2, camp: 'trouble' },
  ]);
  expect(rosterList({ postman: 9 })).toEqual([]);
});
