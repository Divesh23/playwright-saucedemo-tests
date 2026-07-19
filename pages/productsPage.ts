import { Page, Locator } from '@playwright/test';

export class ProductPage {
  readonly page: Page;
  readonly listOfProducts: Locator;
  readonly checkoutButton: Locator;
  readonly firstNameField: Locator;
  readonly lastNameField: Locator;
  readonly postalCodeField: Locator;
  readonly continueButton: Locator;
  readonly finishButton: Locator;
  readonly allProducts: string[];

  constructor(page: Page) {
    this.page = page;
    this.listOfProducts = this.page.locator('.inventory_item');
    this.checkoutButton = this.page.getByRole('button', { name: 'Checkout' });
    this.firstNameField = this.page.locator('[name="firstName"]');
    this.lastNameField = this.page.locator('[name="lastName"]');
    this.postalCodeField = this.page.locator('[name="postalCode"]');
    this.continueButton = this.page.getByRole('button', { name: 'Continue' });
    this.finishButton = this.page.getByRole('button', { name: 'Finish' });
    this.allProducts = [
      'Sauce Labs Backpack',
      'Sauce Labs Bike Light',
      'Sauce Labs Bolt T-Shirt',
      'Sauce Labs Fleece Jacket',
      'Sauce Labs Onesie',
      'Test.allTheThings() T-Shirt (Red)',
    ];
  }

  async clickAddToCart(productName: string) {
    await this.listOfProducts
      .filter({ has: this.page.getByText(productName) })
      .getByRole('button', { name: 'Add to cart' })
      .click();
  }

  async addAllItemsToCart() {
    for (const product of this.allProducts){
        await this.clickAddToCart(product);
    }
  }

  async goToCartPage() {
    await this.page.goto('/cart.html');
  }

  async checkoutProduct() {
    await this.checkoutButton.click();
  }

  async enterUserDetails(
    firstName: string,
    lastName: string,
    postalCode: string,
  ) {
    await this.firstNameField.fill(firstName);
    await this.lastNameField.fill(lastName);
    await this.postalCodeField.fill(postalCode);
  }

  async completeCheckout() {
    await this.continueButton.click();
    await this.finishButton.click();
  }
}
