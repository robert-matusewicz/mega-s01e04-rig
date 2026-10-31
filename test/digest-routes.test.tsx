import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };
const good1 = '{"at":"2026-09-02T01:00:00+01:00","job":"a/one","status":"ok","owner":"rook"}';
const good2 = '{"at":"2026-09-02T02:00:00+01:00","job":"b/two","status":"fail","owner":null,"error":"boom"}';

let tmp: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(join(tmp, '2026-10-28.jsonl'), readFileSync('runs/2026-10-28.jsonl', 'utf8'));
  writeFileSync(join(tmp, '2026-09-01.jsonl'), '');
  writeFileSync(join(tmp, '2026-09-02.jsonl'), `${good1}\nnot json at all\n${good2}\n`);
  app = createApp({ ...base, runsDir: tmp });
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function firstCells(html: string): string[] {
  const body = html.split('<tbody>')[1] ?? '';
  return [...body.matchAll(/<tr><td>([^<]*)<\/td>/g)].map((m) => m[1] ?? '');
}

describe('digest page', () => {
  it('renders the night with its jobs in a table', async () => {
    const res = await app.request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<table>');
    for (const job of ['rig/rotate-logs', 'lane/sync', 'fixtures/refresh', 'notes/backup', 'digest/render']) {
      expect(html).toContain(job);
    }
  });

  it('404s for a night with no file', async () => {
    expect((await app.request('/digest/1999-01-01')).status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request('/digest/2026-09-01');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders a night with a bad line and counts it', async () => {
    const res = await app.request('/digest/2026-09-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toMatch(/1 lines didn.{1,6}t parse/);
  });

  it('carries the lane marker in the banner', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const html = await (await app.request('/digest/2026-10-28')).text();
    expect(html).toContain('TEST-MARKER');
  });
});

describe('digest json', () => {
  it('returns rows in the same order as the page', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    const night = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(night.rows.length).toBe(5);
    expect(night.badLines).toBe(1);
    const html = await (await app.request('/digest/2026-10-28')).text();
    expect(night.rows.map((r) => r.job)).toEqual(firstCells(html));
  });

  it('404s for a night with no file', async () => {
    expect((await app.request('/api/digest/1999-01-01')).status).toBe(404);
  });

  it('gives no rows for an empty night', async () => {
    const res = await app.request('/api/digest/2026-09-01');
    const night = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(night.rows).toEqual([]);
  });

  it('counts the bad line and keeps the good ones', async () => {
    const night = (await (await app.request('/api/digest/2026-09-02')).json()) as Night;
    expect(night.badLines).toBe(1);
    expect(night.rows.length).toBe(2);
  });
});
