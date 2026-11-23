import { describe, expect, test } from 'vitest';
import { loadSave, writeSave } from './save';

const def = { v: 1, cleared: [], seenCards: [], endlessBest: 0 };
const get = (x: unknown) => ({ getItem: () => JSON.stringify(x) });

describe('save', () => {
  test('corrupt or old save falls back to default', () => {
    expect(loadSave({ getItem: () => '{not json' })).toEqual(def);
    expect(loadSave({ getItem: () => JSON.stringify({ v: 0, x: 1 }) })).toEqual(def);
    expect(loadSave({ getItem: () => null })).toEqual(def);
    expect(loadSave({ getItem: () => { throw new Error('x'); } })).toEqual(def);
  });

  test('strict shape validation', () => {
    expect(loadSave(get({ v: 1, cleared: ['a'], seenCards: [], endlessBest: 0 }))).toEqual(def);
    expect(loadSave(get({ v: 1, cleared: [1], seenCards: [2], endlessBest: 0 }))).toEqual(def);
    expect(loadSave(get({ v: 1, cleared: [1], seenCards: [], endlessBest: '3' }))).toEqual(def);
    expect(loadSave(get({ v: 1, cleared: [1], seenCards: [], endlessBest: null }))).toEqual(def);
    expect(loadSave(get({ v: 1, cleared: [1], seenCards: [], endlessBest: 1, endless: { n: 1, rep: 'x', seed: 1 } }))).toEqual(def);
    expect(loadSave(get(null))).toEqual(def);
  });

  test('round trip incl. endless', () => {
    const s = { v: 1 as const, cleared: [0, 1], seenCards: ['a'], endlessBest: 4, endless: { n: 2, rep: 7, seed: 99 } };
    let raw = '';
    writeSave({ setItem: (k, v) => { expect(k).toBe('village-case-save'); raw = v; } }, s);
    expect(loadSave({ getItem: () => raw })).toEqual(s);
    const s2 = { v: 1 as const, cleared: [], seenCards: [], endlessBest: 0 };
    writeSave({ setItem: (_k, v) => { raw = v; } }, s2);
    expect(loadSave({ getItem: () => raw })).toEqual(s2);
  });
});
