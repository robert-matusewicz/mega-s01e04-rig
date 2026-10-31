// Run log reader contract (plan.md § 1). Section 2 builds against this file only.

export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job's night, folded from its lines in runs/<night>.jsonl. */
export type DigestRow = {
  job: string;
  /** null when the log says so; the view shows it as `—`. */
  owner: string | null;
  /** Lines logged for this job. */
  runs: number;
  /** Lines with status `retry`. */
  retries: number;
  /** Status of the job's last line, in log order. */
  lastStatus: RunStatus;
  /** Most recent `error` logged for this job, or null if it never logged one. */
  lastError: string | null;
  /** `at` of the job's first and last line, offset kept exactly as logged (never UTC). */
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  /** One row per job, sorted by job. Empty for an empty file. */
  rows: DigestRow[];
  /** Lines that didn't parse or lacked required fields. Counted, never thrown. */
  badLines: number;
};

/**
 * readNight(runsDir, night): read runs/<night>.jsonl.
 * null when the file does not exist (or night isn't YYYY-MM-DD), so routes can 404.
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;
