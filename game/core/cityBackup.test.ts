import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { World } from './World';
import { CITY_BACKUP_FORMAT, CITY_BACKUP_VERSION, exportCityBackup, MAX_CITY_BACKUP_CHARS, readCityBackup } from './cityBackup';
import { getWorld, installCityBackup } from './worldStore';
import { serializeWorld } from './mapSerialization';

const KEY = 'cimulity:save:v20';
const store = globalThis as typeof globalThis & {
  localStorage?: Storage;
  __cimulityWorld?: World;
  __cimulityWorldGuard?: string;
};

const savedDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let data: Map<string, string>;

beforeEach(() => {
  data = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v); },
      removeItem: (k: string) => { data.delete(k); },
      clear: () => data.clear(),
    },
  });
  delete store.__cimulityWorld;
  delete store.__cimulityWorldGuard;
});

afterEach(() => {
  delete store.__cimulityWorld;
  delete store.__cimulityWorldGuard;
  if (savedDescriptor) Object.defineProperty(globalThis, 'localStorage', savedDescriptor);
  else delete store.localStorage;
});

const original = () => {
  const world = new World(64, 64, { regenerate: false });
  world.setMoney(7654);
  world.setElapsedDays(49);
  return world;
};

describe('City Vault portable backup format', () => {
  it('round-trips real city state, currency and calendar', () => {
    const text = exportCityBackup(original(), new Date('2026-11-05T01:02:03.000Z'));
    const envelope = JSON.parse(text);
    expect(envelope.format).toBe(CITY_BACKUP_FORMAT);
    expect(envelope.version).toBe(CITY_BACKUP_VERSION);
    expect(envelope.savedAt).toBe('2026-11-05T01:02:03.000Z');
    const parsed = readCityBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.meta.money).toBe(7654);
      expect(parsed.meta.day).toBeGreaterThan(0);
      expect(parsed.worldJSON).toBe(serializeWorld(original()));
    }
  });

  it.each([
    ['', 'empty'],
    ['garbage', 'not JSON'],
    ['[]', 'array'],
    [JSON.stringify({ format: 'untrusted-app', version: 1, world: '{}' }), 'wrong app'],
    ['x'.repeat(MAX_CITY_BACKUP_CHARS + 1), 'size limit'],
  ])('rejects invalid %s without touching the live save', (input) => {
    data.set(KEY, 'KEEP_CURRENT_CITY');
    expect(readCityBackup(input).ok).toBe(false);
    expect(data.get(KEY)).toBe('KEEP_CURRENT_CITY');
  });

  it('rejects older and corrupted world data even if the wrapper looks correct', () => {
    const envelope = JSON.parse(exportCityBackup(original()));
    const ancient = JSON.parse(envelope.world);
    ancient.v = 2;
    envelope.world = JSON.stringify(ancient);
    expect(readCityBackup(JSON.stringify(envelope)).ok).toBe(false);
    envelope.world = JSON.stringify({ ...ancient, v: 20, m: -100 });
    expect(readCityBackup(JSON.stringify(envelope)).ok).toBe(false);
  });
});

describe('City Vault atomic restore', () => {
  it('installs a valid snapshot, discards the old singleton and restores after reload', () => {
    const current = getWorld();
    expect(current.getMoney()).not.toBe(7654);
    const copy = exportCityBackup(original());
    const parsed = readCityBackup(copy);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(installCityBackup(parsed.worldJSON)).toBe(true);
    expect(data.get(KEY)).toBe(parsed.worldJSON);
    expect(getWorld().getMoney()).toBe(7654);
    expect(getWorld().getElapsedDays()).toBe(49);
  });

  it('rejects malformed JSON and preserves both storage and the current game', () => {
    const current = getWorld();
    data.set(KEY, serializeWorld(current));
    const before = data.get(KEY);
    expect(installCityBackup('{"bad":true}')).toBe(false);
    expect(getWorld()).toBe(current);
    expect(data.get(KEY)).toBe(before);
  });

  it('does not discard the city if localStorage write fails', () => {
    const current = getWorld();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => null, setItem: () => { throw new Error('quota'); } },
    });
    expect(installCityBackup(serializeWorld(original()))).toBe(false);
    expect(getWorld()).toBe(current);
  });
});
