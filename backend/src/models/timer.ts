import sqlite3 from 'sqlite3';
import { getDatabase } from './database';

type TimerRow = {
  id: number;
  is_active: number;
  is_infinite: number;
  duration_seconds: number;
  started_at: string | null;
  started_at_epoch?: number | null;
};

export type CtfTimerState = {
  isActive: boolean;
  isInfinite: boolean;
  durationSeconds: number;
  startedAt: string | null;
  endsAt: string | null;
  timeLeftSeconds: number | null;
  isExpired: boolean;
  canSubmit: boolean;
};

function run(query: string, params: Array<string | number | null> = []): Promise<void> {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.run(query, params, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function get<T>(query: string, params: Array<string | number | null> = []): Promise<T | undefined> {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.get<T>(query, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

async function ensureTimerRow(): Promise<void> {
  await run(
    `INSERT OR IGNORE INTO ctf_timer (id, is_active, is_infinite, duration_seconds, started_at, updated_at)
     VALUES (1, 0, 0, 7200, NULL, CURRENT_TIMESTAMP)`
  );
}

function toIsoOrNull(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const sqliteUtcPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  const normalizedValue = sqliteUtcPattern.test(value) ? value.replace(' ', 'T') + 'Z' : value;
  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function computeState(row: TimerRow): CtfTimerState {
  const startedAtMs =
    typeof row.started_at_epoch === 'number' && Number.isFinite(row.started_at_epoch)
      ? row.started_at_epoch * 1000
      : (() => {
          const iso = toIsoOrNull(row.started_at);
          return iso ? new Date(iso).getTime() : null;
        })();
  const startedAtIso = startedAtMs ? new Date(startedAtMs).toISOString() : null;
  const isActive = row.is_active === 1;
  const isInfinite = row.is_infinite === 1;
  const durationSeconds = Math.max(0, row.duration_seconds);

  if (!isActive || !startedAtIso) {
    return {
      isActive,
      isInfinite,
      durationSeconds,
      startedAt: startedAtIso,
      endsAt: null,
      timeLeftSeconds: null,
      isExpired: false,
      canSubmit: false
    };
  }

  if (startedAtMs === null) {
    return {
      isActive,
      isInfinite,
      durationSeconds,
      startedAt: null,
      endsAt: null,
      timeLeftSeconds: null,
      isExpired: false,
      canSubmit: false
    };
  }

  if (isInfinite) {
    return {
      isActive,
      isInfinite,
      durationSeconds,
      startedAt: startedAtIso,
      endsAt: null,
      timeLeftSeconds: null,
      isExpired: false,
      canSubmit: true
    };
  }

  const endsMs = startedAtMs + durationSeconds * 1000;
  const nowMs = Date.now();
  const isExpired = nowMs >= endsMs;
  const timeLeftSeconds = Math.max(0, Math.ceil((endsMs - nowMs) / 1000));

  return {
    isActive,
    isInfinite,
    durationSeconds,
    startedAt: startedAtIso,
    endsAt: new Date(endsMs).toISOString(),
    timeLeftSeconds,
    isExpired,
    canSubmit: !isExpired
  };
}

export async function getCtfTimerState(): Promise<CtfTimerState> {
  await ensureTimerRow();
  const row = await get<TimerRow>(
    `SELECT id, is_active, is_infinite, duration_seconds, started_at,
            CAST(strftime('%s', started_at) AS INTEGER) as started_at_epoch
     FROM ctf_timer
     WHERE id = 1`
  );
  if (!row) {
    return {
      isActive: false,
      isInfinite: false,
      durationSeconds: 7200,
      startedAt: null,
      endsAt: null,
      timeLeftSeconds: null,
      isExpired: false,
      canSubmit: false
    };
  }
  return computeState(row);
}

export async function setFiniteDuration(durationSeconds: number): Promise<CtfTimerState> {
  await ensureTimerRow();
  const normalized = Math.max(60, Math.floor(durationSeconds));
  await run(
    `UPDATE ctf_timer
     SET is_active = 0, is_infinite = 0, duration_seconds = ?, started_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
    [normalized]
  );
  return getCtfTimerState();
}

export async function startFiniteTimer(durationSeconds?: number): Promise<CtfTimerState> {
  await ensureTimerRow();
  if (typeof durationSeconds === 'number') {
    const normalized = Math.max(60, Math.floor(durationSeconds));
    await run(
      `UPDATE ctf_timer
       SET is_active = 1, is_infinite = 0, duration_seconds = ?, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [normalized]
    );
  } else {
    await run(
      `UPDATE ctf_timer
       SET is_active = 1, is_infinite = 0, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`
    );
  }
  return getCtfTimerState();
}

export async function restartFiniteTimer(durationSeconds?: number): Promise<CtfTimerState> {
  await ensureTimerRow();
  if (typeof durationSeconds === 'number') {
    const normalized = Math.max(60, Math.floor(durationSeconds));
    await run(
      `UPDATE ctf_timer
       SET is_active = 1, is_infinite = 0, duration_seconds = ?, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [normalized]
    );
  } else {
    await run(
      `UPDATE ctf_timer
       SET is_active = 1, is_infinite = 0, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`
    );
  }
  return getCtfTimerState();
}

export async function addTimerSeconds(seconds: number): Promise<CtfTimerState> {
  await ensureTimerRow();
  const normalized = Math.max(60, Math.floor(seconds));
  await run(
    `UPDATE ctf_timer
     SET duration_seconds = duration_seconds + ?, is_infinite = 0, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
    [normalized]
  );
  return getCtfTimerState();
}

export async function setInfiniteTimer(): Promise<CtfTimerState> {
  await ensureTimerRow();
  await run(
    `UPDATE ctf_timer
     SET is_active = 1, is_infinite = 1, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`
  );
  return getCtfTimerState();
}
