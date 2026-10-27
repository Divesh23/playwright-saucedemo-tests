/**
 * Minimal, zero-dependency Playwright reporter for Azure DevOps Test Plans.
 * Uses only Node's built-in fetch (Node 18+) and Playwright's own reporter types.
 *
 * Link a test to a test case by putting the test case ID in square brackets in the title:
 *   test('[12345] Login with valid user', async ({ page }) => { ... });
 *   test('[1,2,3] One test covering several cases', ...);
 *
 * The test case must already be in the Test Plan (and a suite) you configure.
 */
import type { FullResult, Reporter, TestCase } from '@playwright/test/reporter';

export interface AzureReporterOptions {
  /** e.g. https://dev.azure.com/your-organization-name */
  orgUrl: string;
  projectName: string;
  planId: number;
  /** Optional. Limit the lookup to one suite. If omitted, every suite in the plan is searched. */
  suiteId?: number;
  /** Personal Access Token (Test Management: Read & write). Falls back to env AZURE_TOKEN. */
  token?: string;
  testRunTitle?: string;
  logging?: boolean;
  isDisabled?: boolean;
}

type Outcome = 'Passed' | 'Failed' | 'NotExecuted';

interface Entry {
  outcome: Outcome;
  error?: string;
  durationMs: number;
  titles: string[];
}

const API_VERSION = '7.1'; // if a call is rejected, Microsoft's docs also list '7.1-preview.6' for some test endpoints
const ANSI = /\u001b\[[0-9;]*m/g;
const ID_IN_BRACKETS = /\[([\d,\s]+)\]/g;
const RANK: Record<Outcome, number> = { NotExecuted: 0, Passed: 1, Failed: 2 };

export default class AzureDevOpsReporter implements Reporter {
  private readonly opts: AzureReporterOptions;
  private readonly base: string;
  private readonly auth: string;
  private readonly enabled: boolean;
  private readonly tests = new Map<string, TestCase>();

  constructor(options: AzureReporterOptions) {
    this.opts = { testRunTitle: 'Playwright Test Run', ...options };
    const token = options.token ?? process.env.AZURE_TOKEN;
    this.enabled = !options.isDisabled && !!token;
    if (!options.isDisabled && !token) {
      console.warn(
        '[azure-reporter] No token (option or AZURE_TOKEN env var). Reporter disabled.',
      );
    }
    this.auth = 'Basic ' + Buffer.from(`:${token ?? ''}`).toString('base64');
    this.base = `${options.orgUrl.replace(/\/+$/, '')}/${encodeURIComponent(options.projectName)}/_apis`;
  }

  printsToStdio(): boolean {
    return false;
  }

  onTestEnd(test: TestCase): void {
    if (this.enabled && this.caseIds(test.title).length > 0)
      this.tests.set(test.id, test);
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (!this.enabled || this.tests.size === 0) return;
    try {
      await this.publish();
    } catch (err) {
      // Never fail the test run because reporting failed.
      console.error(
        '[azure-reporter] Publishing failed (test results are unaffected):',
        err,
      );
    }
  }

  // ---- helpers -----------------------------------------------------------

  private caseIds(title: string): number[] {
    const ids = new Set<number>();
    for (const m of title.matchAll(ID_IN_BRACKETS)) {
      for (const part of m[1].split(',')) {
        const n = parseInt(part, 10);
        if (!Number.isNaN(n)) ids.add(n);
      }
    }
    return [...ids];
  }

  private async api<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.base}${path}${path.includes('?') ? '&' : '?'}api-version=${API_VERSION}`;
    if (this.opts.logging) console.log(`[azure-reporter] ${method} ${url}`);
    const res = await fetch(url, {
      method,
      headers: { Authorization: this.auth, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok)
      throw new Error(
        `${method} ${path} failed: ${res.status} ${await res.text()}`,
      );
    return (await res.json()) as T;
  }

  /** One entry per test case ID. If several tests share an ID, the worst outcome wins. */
  private collect(): Map<number, Entry> {
    const byCase = new Map<number, Entry>();
    for (const test of this.tests.values()) {
      const last = test.results[test.results.length - 1];
      const o = test.outcome();
      const outcome: Outcome =
        o === 'unexpected'
          ? 'Failed'
          : o === 'skipped'
            ? 'NotExecuted'
            : 'Passed'; // flaky = passed on retry
      const error = last?.error?.message?.replace(ANSI, '').slice(0, 4000);
      const duration = last?.duration ?? 0;

      for (const id of this.caseIds(test.title)) {
        const cur = byCase.get(id);
        if (!cur) {
          byCase.set(id, {
            outcome,
            error,
            durationMs: duration,
            titles: [test.title],
          });
          continue;
        }
        cur.titles.push(test.title);
        cur.durationMs += duration;
        if (RANK[outcome] > RANK[cur.outcome]) {
          cur.outcome = outcome;
          cur.error = error;
        }
      }
    }
    return byCase;
  }

  private async suiteIds(): Promise<number[]> {
    const r = await this.api<{ value: { id: number }[] }>(
      'GET',
      `/test/Plans/${this.opts.planId}/suites`,
    );
    return r.value.map((s) => s.id);
  }

  // ---- publishing --------------------------------------------------------

  private async publish(): Promise<void> {
    const { planId } = this.opts;
    const results = this.collect();
    const suites = this.opts.suiteId
      ? [this.opts.suiteId]
      : await this.suiteIds();

    // 1. Find the test point(s) for each test case ID (a point = test case + suite + configuration).
    const pointIds = new Set<number>();
    for (const caseId of results.keys()) {
      let found = false;
      for (const suiteId of suites) {
        const r = await this.api<{ value: { id: number }[] }>(
          'GET',
          `/test/Plans/${planId}/Suites/${suiteId}/points?testCaseId=${caseId}`,
        );
        for (const p of r.value) {
          pointIds.add(p.id);
          found = true;
        }
      }
      if (!found)
        console.warn(
          `[azure-reporter] Test case ${caseId} not found in plan ${planId}. Skipped.`,
        );
    }
    if (pointIds.size === 0) return;

    // 2. Create a test run for those points.
    const run = await this.api<{ id: number }>('POST', '/test/runs', {
      name: this.opts.testRunTitle,
      plan: { id: String(planId) },
      pointIds: [...pointIds],
      automated: true,
    });

    // 3. The run now holds one (not executed) result per point. Fill in outcomes.
    const created = await this.api<{
      value: { id: number; testCase?: { id: string } }[];
    }>('GET', `/test/Runs/${run.id}/results`);
    const now = new Date().toISOString();
    const updates = [];
    for (const r of created.value) {
      const entry = results.get(Number(r.testCase?.id));
      if (!entry || entry.outcome === 'NotExecuted') continue;
      updates.push({
        id: r.id,
        outcome: entry.outcome,
        state: 'Completed',
        durationInMs: entry.durationMs,
        errorMessage: entry.error,
        comment: `Playwright: ${entry.titles.join(' | ')}`,
        completedDate: now,
      });
    }
    if (updates.length > 0)
      await this.api('PATCH', `/test/Runs/${run.id}/results`, updates);

    // 4. Close the run.
    await this.api('PATCH', `/test/runs/${run.id}`, { state: 'Completed' });
    console.log(
      `[azure-reporter] Published ${updates.length} result(s) to test run ${run.id}.`,
    );
  }
}
