import type { FullResult, Reporter, TestCase } from '@playwright/test/reporter';

export interface AzureLinkReporterOptions {
  orgUrl: string;
  projectName: string;
  token?: string;
  isDisabled?: boolean;
}

interface AutomationLink {
  testId: string;
  testName: string;
  testStorage: string;
}

const CASE_ID_IN_BRACKETS = /\[([\d,\s]+)\]/g;
const API_VERSION = '7.1';

export default class AzureLinkReporter implements Reporter {
  private readonly base: string;
  private readonly auth: string;
  private readonly enabled: boolean;
  private readonly links = new Map<number, Set<AutomationLink>>();

  constructor(options: AzureLinkReporterOptions) {
    const token = options.token ?? process.env.AZURE_TOKEN;
    this.enabled = !options.isDisabled && Boolean(token);
    if (!options.isDisabled && !token) {
      console.warn(
        '[azure-link-reporter] No token (option or AZURE_TOKEN env var). Reporter disabled.',
      );
    }

    this.auth = `Basic ${Buffer.from(`:${token ?? ''}`).toString('base64')}`;
    this.base = `${options.orgUrl.replace(/\/+$/, '')}/${encodeURIComponent(options.projectName)}/_apis/wit/workitems`;
  }

  printsToStdio(): boolean {
    return false;
  }

  onTestEnd(test: TestCase): void {
    if (!this.enabled) return;

    const link: AutomationLink = {
      testId: test.id,
      testName: test.titlePath().join(' > '),
      testStorage: test.location.file,
    };

    for (const caseId of this.caseIds(test.title)) {
      const links = this.links.get(caseId) ?? new Set<AutomationLink>();
      links.add(link);
      this.links.set(caseId, links);
    }
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (!this.enabled) return;

    for (const [caseId, links] of this.links) {
      if (links.size !== 1) {
        console.warn(
          `[azure-link-reporter] Test case ${caseId} matches multiple Playwright tests. Association skipped.`,
        );
        continue;
      }

      const [link] = [...links];
      try {
        await this.linkTestCase(caseId, link);
        console.log(
          `[azure-link-reporter] Linked test case ${caseId} to "${link.testName}".`,
        );
      } catch (error) {
        console.error(
          `[azure-link-reporter] Could not link test case ${caseId}:`,
          error,
        );
      }
    }
  }

  private caseIds(title: string): number[] {
    const ids = new Set<number>();
    for (const match of title.matchAll(CASE_ID_IN_BRACKETS)) {
      for (const part of match[1].split(',')) {
        const id = Number.parseInt(part.trim(), 10);
        if (Number.isSafeInteger(id) && id > 0) ids.add(id);
      }
    }
    return [...ids];
  }

  private async linkTestCase(
    caseId: number,
    link: AutomationLink,
  ): Promise<void> {
    const url = `${this.base}/${caseId}?api-version=${API_VERSION}`;
    const operations = [
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.TCM.AutomationStatus',
        value: 'Automated',
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.TCM.AutomatedTestId',
        value: link.testId,
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.TCM.AutomatedTestName',
        value: link.testName,
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.TCM.AutomatedTestStorage',
        value: link.testStorage,
      },
    ];

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: this.auth,
        'Content-Type': 'application/json-patch+json',
      },
      body: JSON.stringify(operations),
    });

    if (!response.ok) {
      throw new Error(
        `Updating test case ${caseId} failed: ${response.status} ${await response.text()}`,
      );
    }
  }
}
