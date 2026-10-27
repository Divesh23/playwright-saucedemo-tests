import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['html', { outputFolder: 'Playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit/results.xml' }],
    [
      './reporter.ts',
      {
        orgUrl: 'https://dev.azure.com/diveshdavid/',
        projectName: 'Playwright test',
        token: process.env.AZURE_TOKEN,
      },
    ],
  ],

  testDir: './tests',

  timeout: 30000,

  retries: 1,

  workers: 4,

  use: {
    baseURL: 'https://www.saucedemo.com',

    headless: false,

    screenshot: 'only-on-failure',

    trace: 'retain-on-failure',

    video: 'retain-on-failure',
  },
});
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['html', { outputFolder: 'Playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit/results.xml' }],
    [
      './reporter.ts',
      {
        orgUrl: 'https://dev.azure.com/{org_url}',
        projectName: '{name of Project}',
        token: process.env.AZURE_TOKEN,
      },
    ],
  ],

  testDir: './tests',

  timeout: 30000,

  retries: 1,

  workers: 4,

  use: {
    baseURL: 'https://www.saucedemo.com',

    headless: false,

    screenshot: 'only-on-failure',

    trace: 'retain-on-failure',

    video: 'retain-on-failure',
  },
});
