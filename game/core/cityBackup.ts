/**
 * Cimulity portable local backups.
 *
 * The game already auto-saves into localStorage. This module provides a
 * deliberately portable, versioned file that can be restored on another
 * device without copying browser-specific keys.
 *
 * A backup is always validated in an isolated World BEFORE it is permitted
 * to replace the current save. Never trust JSON from an uploaded file.
 */
import { World } from './World';
import { deserializeWorldInto, serializeWorld, WORLD_SAVE_VERSION } from './mapSerialization';

export const CITY_BACKUP_FORMAT = 'cimulity-city-backup';
export const CITY_BACKUP_VERSION = 1;
export const MAX_CITY_BACKUP_CHARS = 5_000_000;
const DEFAULT_SIZE = 64;

export interface CityBackupMeta {
  savedAt: string;
  money: number;
  year: number;
  month: number;
  day: number;
}
export type CityBackupRead =
  | { ok: true; worldJSON: string; meta: CityBackupMeta }
  | { ok: false; reason: string };

export function exportCityBackup(world: World, now = new Date()): string {
  const date = world.getDate();
  return JSON.stringify({
    format: CITY_BACKUP_FORMAT,
    version: CITY_BACKUP_VERSION,
    engineVersion: WORLD_SAVE_VERSION,
    savedAt: now.toISOString(),
    city: {
      money: world.getMoney(),
      year: date.year, month: date.month, day: date.day,
    },
    world: serializeWorld(world),
  });
}

export function readCityBackup(text: string): CityBackupRead {
  if (!text || text.length > MAX_CITY_BACKUP_CHARS) {
    return { ok: false, reason: 'The backup is empty or exceeds the 5 MB limit.' };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'Not a valid JSON backup file.' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: 'Unrecognized backup data.' };
  }
  const backup = data as Record<string, unknown>;
  if (backup.format !== CITY_BACKUP_FORMAT || backup.version !== CITY_BACKUP_VERSION) {
    return { ok: false, reason: 'This is not a supported Cimulity backup.' };
  }
  if (backup.engineVersion !== WORLD_SAVE_VERSION) {
    return { ok: false, reason: 'The save was made by an incompatible city simulation version.' };
  }
  if (typeof backup.world !== 'string' || backup.world.length > MAX_CITY_BACKUP_CHARS) {
    return { ok: false, reason: 'The backup does not contain a valid city.' };
  }
  if (typeof backup.savedAt !== 'string' || !Number.isFinite(Date.parse(backup.savedAt))) {
    return { ok: false, reason: 'Invalid backup timestamp.' };
  }

  // Validate all tile, terrain, finance, footprint and entity invariants
  // in a separate world. The real city is not touched on parse failure.
  const candidate = new World(DEFAULT_SIZE, DEFAULT_SIZE, { regenerate: false });
  if (!deserializeWorldInto(candidate, backup.world)) {
    return { ok: false, reason: 'City data is corrupted or is no longer compatible.' };
  }
  const date = candidate.getDate();
  return {
    ok: true,
    worldJSON: backup.world,
    meta: {
      savedAt: backup.savedAt,
      money: candidate.getMoney(),
      year: date.year, month: date.month, day: date.day,
    },
  };
}
