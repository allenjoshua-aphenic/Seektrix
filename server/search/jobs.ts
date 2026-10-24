/**
 * In-memory store for search jobs (one per "Search Registries" click).
 *
 * The result is cached ON the job, so the dashboard's /matches request is
 * served from memory instead of running the database search a second time.
 * Jobs expire after two hours; a server restart forgets them (the UI shows an
 * honest error in that case). Persisting jobs in a Supabase table is the
 * natural next step once the free-tier storage limit is lifted.
 */
import type { SearchResult, StageInfo } from './engine';

export type PipelineStep =
  | 'queued' | 'pdf_indexing' | 'ocr_scanning' | 'fuzzy_matching'
  | 'cross_referencing' | 'report_assembly' | 'completed' | 'failed';

export interface JobLog {
  timestamp: string;
  message: string;
  step: PipelineStep;
  status: 'info' | 'success' | 'warning' | 'processing';
}

export interface SearchJob {
  id: string;
  fullName: string;
  /** 'typed' = the user entered the name; 'email' = derived from the email's local part. */
  nameSource: 'typed' | 'email';
  city: string;
  state: string;
  email: string;
  submittedAt: string;
  status: PipelineStep;
  progressPercent: number;
  estimatedCompletionMinutes: number;
  matchedCount: number;
  confidenceScore: number;
  totalMatchedValue: number;
  logs: JobLog[];
  result?: SearchResult;
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

const JOB_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_JOBS = 1000;

export function nowStamp(withSeconds = true): string {
  return new Date().toISOString().replace('T', ' ').slice(0, withSeconds ? 19 : 16);
}

function newId(): string {
  const t = Date.now().toString(36).toUpperCase().slice(-5);
  const r = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `REQ-${t}${r}`;
}

export class JobStore {
  private jobs = new Map<string, SearchJob>();

  create(input: { fullName: string; nameSource?: 'typed' | 'email'; city: string; state: string; email: string }): SearchJob {
    this.prune();
    const job: SearchJob = {
      id: newId(),
      fullName: input.fullName,
      nameSource: input.nameSource || 'typed',
      city: input.city,
      state: input.state,
      email: input.email,
      submittedAt: nowStamp(false),
      status: 'queued',
      progressPercent: 2,
      estimatedCompletionMinutes: 0.25,
      matchedCount: 0,
      confidenceScore: 0,
      totalMatchedValue: 0,
      logs: [],
      startedAt: Date.now(),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  get(id: string): SearchJob | undefined {
    return this.jobs.get(id);
  }

  log(job: SearchJob, step: PipelineStep, message: string, status: JobLog['status'] = 'info') {
    job.logs.push({ timestamp: nowStamp(), message, step, status });
  }

  /** Public view: everything except the (potentially large) result payload. */
  publicView(job: SearchJob) {
    const { result, ...rest } = job;
    return {
      ...rest,
      engine: result?.meta.engine,
      degraded: result?.meta.degraded ?? false,
      degradedReason: result?.meta.degradedReason,
      degradedDetail: result?.meta.degradedDetail,
    };
  }

  stageMessage(stage: StageInfo): string {
    const where = stage.state ? ` in ${stage.state}` : ' across all of India';
    if (stage.mode === 'v1') {
      return stage.error
        ? `Legacy search failed (${stage.error}).`
        : `Legacy search returned ${stage.rows} candidate${stage.rows === 1 ? '' : 's'} in ${stage.ms} ms.`;
    }
    if (stage.name === 'ranking') {
      return `Ranked candidates by spelling, initials, sound-alike forms and state. ${stage.rows} passed the ${'quality bar'}.`;
    }
    if (stage.error) {
      return `${stage.name[0].toUpperCase()}${stage.name.slice(1)} could not finish (${stage.error}) after ${stage.ms} ms.`;
    }
    if (stage.mode === 'prefix') {
      return `${stage.name[0].toUpperCase()}${stage.name.slice(1)}${stage.state ? '' : where}: ${stage.rows} candidate${stage.rows === 1 ? '' : 's'} in ${stage.ms} ms.`;
    }
    if (stage.mode === 'word') {
      return `Word-for-word match${where} (strictness ${stage.threshold}): ${stage.rows} candidate${stage.rows === 1 ? '' : 's'} in ${stage.ms} ms.`;
    }
    return `Typo-tolerant match${where} (similarity ≥ ${stage.threshold}): ${stage.rows} candidate${stage.rows === 1 ? '' : 's'} in ${stage.ms} ms.`;
  }

  private prune() {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if (now - job.startedAt > JOB_TTL_MS) this.jobs.delete(id);
    }
    while (this.jobs.size >= MAX_JOBS) {
      const oldest = this.jobs.keys().next().value;
      if (oldest === undefined) break;
      this.jobs.delete(oldest);
    }
  }
}
