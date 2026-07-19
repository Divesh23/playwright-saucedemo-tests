import { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly username: Locator;
  readonly password: Locator;
  readonly loginButton: Locator;
  readonly siteTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.username = this.page.locator('#user-name');
    this.password = this.page.locator('#password');
    this.loginButton = this.page.getByRole('button', { name: 'Login' });
    this.siteTitle = this.page.locator('[data-test="title"]');
  }

  async login(username: string, password: string) {
    await this.page.goto('/', {
      waitUntil: 'domcontentloaded',
    });
    await this.username.fill(username);
    await this.password.fill(password);
    await this.loginButton.click();
  }

  async verifyLoginStatus(userStatus: string, timeout: number = 5000) {
    if (userStatus === 'Valid') {
      await expect(this.siteTitle).toBeVisible();
    } else if (userStatus === 'LockedOut') {
      await expect(this.page.locator('.error-message-container')).toHaveText(
        'Epic sadface: Sorry, this user has been locked out.',
      );
    } else if (userStatus === 'Invalid') {
      await expect(this.page.locator('.error-message-container')).toHaveText(
        'Epic sadface: Username and password do not match any user in this service',
      );
    }
  }
}
