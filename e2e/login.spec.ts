import { test, expect, Locator } from '@playwright/test';
import { LoginPage } from '../pages/loginPage';
import { readCsvFile } from '../utils/csvReader';

test.describe('Login tests', () => {
  const credentials = readCsvFile();

  for (const user of credentials) {
    test(`${user.validitystatus} user ${user.username} logs in`, async ({
      page,
    }) => {
      if (user.shouldRun === 'true') {
        const loginPage = new LoginPage(page);
        await loginPage.login(user.username, user.password);
        await loginPage.verifyLoginStatus(user.validitystatus);
      }
    });
  }
});
