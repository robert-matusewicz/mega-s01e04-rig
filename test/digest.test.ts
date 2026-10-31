import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  const row = (job: string) => night?.rows.find((r) => r.job === job);

  it('has 5 jobs sorted by job and 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts 3 retries then ok for fixtures/refresh', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('folds lane/sync across midnight, keeping the offset', () => {
    expect(row('lane/sync')).toMatchObject({
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'lock held',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });

  it('keeps the fail of notes/backup', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', owner: 'lane-07' });
  });

  it('keeps the row with a null owner', () => {
    expect(row('digest/render')).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok', lastError: null });
  });
});

describe('readNight edge cases', () => {
  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for a night with no file', () => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('returns no rows for an empty file', () => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts lines missing required fields as bad', () => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    const lines = [
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}',
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"weird","owner":"rook"}',
      '{"job":"a","status":"ok","owner":"rook"}',
      '[]',
    ];
    writeFileSync(join(dir, '2026-01-03.jsonl'), lines.join('\n') + '\n');
    const night = readNight(dir, '2026-01-03');
    expect(night?.rows).toHaveLength(1);
    expect(night?.badLines).toBe(3);
  });

  it('rejects a night that is not a date', () => {
    expect(readNight('runs', '../package')).toBeNull();
  });
});
