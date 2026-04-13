import { test, expect } from '@playwright/test';

// Setting up a mock route to test the application in isolation if backend isn't up
test.describe('E2E User Experience Flow', () => {

  test('User can visit Login page, submit email, and see OTP field', async ({ page }) => {
    
    // We will intercept network requests to mock backend so tests don't fail without db
    await page.route('**/api/auth/otp/request', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'OTP sent', testCode: '1234' })
      });
    });

    await page.route('**/api/auth/otp/verify', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'mock-token', role: 'ADMIN' })
      });
    });

    // Mock dashboard fetch
    await page.route('**/api/tickets', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('/login');

    // Email Step
    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    // OTP Step
    await expect(page.locator('input[placeholder="• • • • • •"]')).toBeVisible();
    await page.fill('input[type="text"]', '1234');
    await page.click('button[type="submit"]');

    // Dashboard Redirection
    await expect(page).toHaveURL(/.*dashboard/);
  });

});
