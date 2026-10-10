import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { getCurrentUserId } from './auth/session';

export type MushroomObservation = {
  id: number;
  name: string;
  probability: number;
  notes: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
};

export type SyncObservation = {
  clientId: string;
  name: string;
  probability: number;
  notes: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
  deleted: number;
};

const db = SQLite.openDatabaseSync('forest_sense.db');
const listeners = new Set<() => void>();

export function subscribeObservations(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyObservations(): void {
  listeners.forEach((listener) => listener());
}

function columnNames(): Set<string> {
  const columns = db.getAllSync('PRAGMA table_info(observations)') as Array<{ name: string }>;
  return new Set(columns.map((column) => column.name));
}

export function initDatabase(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      probability INTEGER NOT NULL CHECK(probability BETWEEN 0 AND 100),
      notes TEXT NOT NULL DEFAULT '',
      latitude REAL,
      longitude REAL,
      createdAt TEXT NOT NULL,
      clientId TEXT,
      updatedAt TEXT,
      dirty INTEGER NOT NULL DEFAULT 1,
      deleted INTEGER NOT NULL DEFAULT 0,
      ownerId TEXT
    );
  `);

  const columns = columnNames();
  if (!columns.has('latitude')) db.execSync('ALTER TABLE observations ADD COLUMN latitude REAL');
  if (!columns.has('longitude')) db.execSync('ALTER TABLE observations ADD COLUMN longitude REAL');
  if (!columns.has('clientId')) db.execSync('ALTER TABLE observations ADD COLUMN clientId TEXT');
  if (!columns.has('updatedAt')) db.execSync('ALTER TABLE observations ADD COLUMN updatedAt TEXT');
  if (!columns.has('dirty')) db.execSync('ALTER TABLE observations ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1');
  if (!columns.has('deleted')) db.execSync('ALTER TABLE observations ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0');
  if (!columns.has('ownerId')) db.execSync('ALTER TABLE observations ADD COLUMN ownerId TEXT');

  const missing = db.getAllSync(
    `SELECT id, createdAt FROM observations WHERE clientId IS NULL OR clientId = ''`,
  ) as Array<{ id: number; createdAt: string }>;
  for (const row of missing) {
    db.runSync(
      `UPDATE observations SET clientId = ?, updatedAt = COALESCE(updatedAt, ?), dirty = 1, deleted = COALESCE(deleted, 0) WHERE id = ?`,
      [Crypto.randomUUID(), row.createdAt, row.id],
    );
  }
  db.runSync(`UPDATE observations SET updatedAt = createdAt WHERE updatedAt IS NULL OR updatedAt = ''`);
  db.execSync('CREATE UNIQUE INDEX IF NOT EXISTS idx_observations_client_id ON observations(clientId)');
}

export function getObservations(ownerId?: string | null): MushroomObservation[] {
  if (ownerId) {
    return db.getAllSync(
      `SELECT id, name, probability, notes, latitude, longitude, createdAt
       FROM observations
       WHERE deleted = 0 AND (ownerId IS NULL OR ownerId = ?)
       ORDER BY createdAt DESC`,
      [ownerId],
    ) as MushroomObservation[];
  }
  return db.getAllSync(
    `SELECT id, name, probability, notes, latitude, longitude, createdAt
     FROM observations
     WHERE deleted = 0
     ORDER BY createdAt DESC`,
  ) as MushroomObservation[];
}

export function addObservation(
  name: string,
  probability: number,
  notes: string,
  latitude?: number,
  longitude?: number,
): void {
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO observations
      (name, probability, notes, latitude, longitude, createdAt, clientId, updatedAt, dirty, deleted, ownerId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
    [
      name.trim(),
      Math.max(0, Math.min(100, Math.round(probability))),
      notes.trim(),
      latitude ?? null,
      longitude ?? null,
      now,
      Crypto.randomUUID(),
      now,
      getCurrentUserId(),
    ],
  );
  notifyObservations();
}

export function claimUnownedObservations(ownerId: string): void {
  db.runSync(`UPDATE observations SET ownerId = ? WHERE ownerId IS NULL`, [ownerId]);
}

export function getDirtyObservations(ownerId: string): SyncObservation[] {
  return db.getAllSync(
    `SELECT clientId, name, probability, notes, latitude, longitude, createdAt, updatedAt, deleted
     FROM observations
     WHERE dirty = 1 AND ownerId = ?
     ORDER BY updatedAt ASC
     LIMIT 100`,
    [ownerId],
  ) as SyncObservation[];
}

export function upsertRemoteObservation(record: SyncObservation & { ownerId: string }): void {
  db.runSync(
    `INSERT INTO observations
      (name, probability, notes, latitude, longitude, createdAt, clientId, updatedAt, dirty, deleted, ownerId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(clientId) DO UPDATE SET
      name = excluded.name,
      probability = excluded.probability,
      notes = excluded.notes,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      createdAt = excluded.createdAt,
      updatedAt = excluded.updatedAt,
      dirty = 0,
      deleted = excluded.deleted,
      ownerId = excluded.ownerId
     WHERE excluded.updatedAt >= observations.updatedAt`,
    [
      record.name,
      record.probability,
      record.notes,
      record.latitude,
      record.longitude,
      record.createdAt,
      record.clientId,
      record.updatedAt,
      record.deleted,
      record.ownerId,
    ],
  );
}
