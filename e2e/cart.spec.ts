import { expect, test } from '@playwright/test';
import { LoginPage } from '../pages/loginPage';
import { ProductPage } from '../pages/productsPage';
import { readCsvFile } from '../utils/csvReader';
import userDetails from '../test-data/userdetails.json'

test.describe('Cart tests', () => {
  test.beforeEach(async ({ page }) => {
    const credentials = readCsvFile();
    const loginPage = new LoginPage(page);
    await loginPage.login('standard_user', 'secret_sauce');
    await loginPage.verifyLoginStatus(credentials[0].validitystatus);
  });

  test('add an item to cart', async ({ page }) => {
    const productsPage = new ProductPage(page);
    await productsPage.clickAddToCart('Sauce Labs Backpack');
    await productsPage.goToCartPage();
    await productsPage.checkoutProduct();
    await productsPage.enterUserDetails(userDetails[0].firstName, userDetails[0].lastName, userDetails[0].PostalCode);
    await productsPage.completeCheckout();
  });

  test('add all items to cart', async ({ page }) => {
    const productsPage = new ProductPage(page);
    await productsPage.addAllItemsToCart();
    await productsPage.goToCartPage();
    await productsPage.checkoutProduct();
    await productsPage.enterUserDetails(userDetails[0].firstName, userDetails[0].lastName, userDetails[0].PostalCode);
    await productsPage.completeCheckout();
  });
});
